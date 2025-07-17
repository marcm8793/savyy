import { Redis } from "@upstash/redis";

/*

## OAuth Code Security Configuration

The system uses a conservative but efficient approach to prevent OAuth code replay attacks:

- **Processing TTL**: 10 minutes (handles temporary failures)
- **Processed TTL**: 2 hours (4x Tink's 30-minute access token lifetime)

This configuration:
- ✅ Prevents replay attacks during the entire OAuth code validity period
- ✅ More memory-efficient than longer TTL approaches
- ✅ Based on Tink's documented 30-minute access token lifetime
- ✅ Provides safety margin for clock skew and edge cases

The TTL can be adjusted in `RedisService` constants if other OAuth providers are added with different token lifetimes.

*/

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  // Configuration constants for OAuth code security
  // Based on Tink's specification: access tokens expire after 30 minutes
  // OAuth codes typically expire in 10-15 minutes, so we use 2 hours for safety margin
  private readonly OAUTH_CODE_PROCESSED_TTL = 7200; // 2 hours in seconds (4x Tink's 30min token lifetime)
  private readonly OAUTH_CODE_PROCESSING_TTL = 600; // 10 minutes in seconds

  // Lua script for atomic OAuth code claiming
  // This eliminates the race condition between EXISTS and SETNX operations
  private readonly CLAIM_CODE_SCRIPT = `
    -- Check if code is already processed
    if redis.call('EXISTS', KEYS[1]) == 1 then
      return 0  -- Already processed
    end

    -- Atomically claim the processing slot
    if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', ARGV[2]) then
      return 1  -- Successfully claimed
    else
      return 0  -- Someone else claimed it
    end
  `;

  constructor() {
    // Initialize Upstash Redis client from environment variables
    try {
      // Check if environment variables are present
      if (
        !process.env.UPSTASH_REDIS_REST_URL ||
        !process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        console.warn(
          "Redis environment variables not configured. Redis features will be disabled."
        );
        this.isConnected = false;
        return;
      }

      this.client = Redis.fromEnv();
      this.isConnected = true;
      console.log("Upstash Redis client initialized successfully");
    } catch (error: unknown) {
      let message: string;

      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      } else {
        message = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }

      console.warn("Failed to initialize Upstash Redis client:", message);
      console.warn(
        "Redis features will be disabled. Application will continue without Redis."
      );
      this.isConnected = false;
      // Don't throw - allow application to continue without Redis
    }
  }

  /**
   * Check if Redis is available and connected
   */
  private isRedisAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Check if an OAuth code has been processed or is currently being processed
   */
  async isCodeProcessed(code: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.warn(
        "Redis not connected, falling back to allowing code processing"
      );
      return false;
    }

    try {
      const [isCompleted, isProcessing] = await Promise.all([
        this.client.exists(`processed_code:${code}`),
        this.client.exists(`processing_code:${code}`),
      ]);

      return isCompleted === 1 || isProcessing === 1;
    } catch (error) {
      console.error(
        "Error checking if code is processed:",
        error instanceof Error ? error.message : String(error)
      );
      // Fail open - allow processing if Redis is down
      return false;
    }
  }

  /**
   * Mark an OAuth code as currently being processed
   * Returns true if successfully marked, false if already being processed
   *
   * RACE CONDITION FIX: Uses Lua script to atomically check processed_code
   * and claim processing_code in a single operation. This prevents the race
   * where a worker could complete processing between our EXISTS check and
   * SETNX operation, leading to duplicate processing.
   */
  async markCodeAsProcessing(code: string): Promise<boolean> {
    if (!this.isRedisAvailable()) {
      console.warn("Redis not connected, allowing code processing");
      return true;
    }

    try {
      // Use Lua script for completely atomic claim operation
      // This eliminates the race condition between checking processed_code and setting processing_code
      const claimed = await this.client!.eval(
        this.CLAIM_CODE_SCRIPT,
        [`processed_code:${code}`, `processing_code:${code}`],
        [Date.now().toString(), this.OAUTH_CODE_PROCESSING_TTL.toString()]
      );

      return claimed === 1;
    } catch (error) {
      console.error(
        "Error marking code as processing:",
        error instanceof Error ? error.message : String(error)
      );
      // Fail open - allow processing if Redis is down
      return true;
    }
  }

  /**
   * Mark an OAuth code as completed and remove from processing
   *
   * ATOMICITY FIX: Uses MULTI/EXEC transaction to ensure both operations
   * succeed or fail together. This prevents dangling processing_code keys
   * if the setex succeeds but del fails.
   *
   * INCIDENT RESPONSE NOTE: If this method fails completely, a processing_code
   * key may remain dangling, but it will auto-expire after 10 minutes via TTL.
   * This is preferable to having unprotected processed codes that could allow
   * replay attacks.
   */
  async markCodeAsCompleted(code: string): Promise<void> {
    if (!this.isRedisAvailable()) {
      console.warn("Redis not connected, skipping completion marking");
      return;
    }

    try {
      // Use MULTI/EXEC transaction for true atomicity
      // Both commands will execute atomically or not at all
      const result = await this.client!.multi()
        .setex(
          `processed_code:${code}`,
          this.OAUTH_CODE_PROCESSED_TTL,
          Date.now().toString()
        )
        .del(`processing_code:${code}`)
        .exec();

      // Check if transaction succeeded
      // Note: In case of transaction failure, we'll rely on TTL cleanup
      // since processing_code keys have 10-minute expiration
      if (!result) {
        console.warn(
          `Transaction returned null for code completion: ${code.substring(
            0,
            8
          )}...`
        );
        // Attempt cleanup of processing code as fallback
        try {
          await this.client!.del(`processing_code:${code}`);
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup processing code after transaction failure:",
            cleanupError
          );
        }
      }
    } catch (error) {
      console.error(
        "Error marking code as completed:",
        error instanceof Error ? error.message : String(error)
      );

      // Fallback cleanup: try to remove processing lock even if main operation failed
      try {
        await this.client!.del(`processing_code:${code}`);
        console.log(
          `Fallback cleanup: removed processing lock for code ${code.substring(
            0,
            8
          )}...`
        );
      } catch (cleanupError) {
        console.error(
          "Fallback cleanup also failed - processing code may be dangling:",
          cleanupError
        );
        // This creates a dangling processing_code key, but it will expire via TTL
        // Document this for incident responders
      }

      // Don't throw - this is cleanup, not critical for main flow
    }
  }

  /**
   * Remove code from processing set (used on error)
   */
  async removeFromProcessing(code: string): Promise<void> {
    if (!this.isRedisAvailable()) {
      console.warn("Redis not connected, skipping processing removal");
      return;
    }

    try {
      // Remove the processing claim
      await this.client!.del(`processing_code:${code}`);
    } catch (error) {
      console.error(
        "Error removing code from processing:",
        error instanceof Error ? error.message : String(error)
      );
      // Don't throw - this is cleanup
    }
  }

  /**
   * Get Redis connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Health check method
   */
  async ping(): Promise<boolean> {
    if (!this.isRedisAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === "PONG";
    } catch (error) {
      console.error(
        "Redis ping failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Get stats about processed codes (for monitoring)
   */
  async getStats(): Promise<{
    processedCodes: number;
    processingCodes: number;
  }> {
    if (!this.isRedisAvailable()) {
      return { processedCodes: 0, processingCodes: 0 };
    }

    try {
      // Note: Can't easily count processing codes without scanning all keys
      // This is a limitation of the new atomic approach, but the trade-off is worth it
      return {
        processedCodes: -1, // Not tracked due to TTL
        processingCodes: -1, // Not easily trackable with individual keys
      };
    } catch (error) {
      console.error(
        "Error getting Redis stats:",
        error instanceof Error ? error.message : String(error)
      );
      return { processedCodes: 0, processingCodes: 0 };
    }
  }
}

// Create singleton instance
export const redisService = new RedisService();
