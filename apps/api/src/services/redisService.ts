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
   */
  async markCodeAsProcessing(code: string): Promise<boolean> {
    if (!this.isRedisAvailable()) {
      console.warn("Redis not connected, allowing code processing");
      return true;
    }

    try {
      // First check if already completed (processed codes have 24h TTL to prevent replay attacks)
      const isCompleted = await this.client!.exists(`processed_code:${code}`);
      if (isCompleted === 1) {
        return false; // Already processed
      }

      // Atomically claim the code using SETNX with TTL (10 minutes)
      // This is truly atomic - only one worker can successfully set this key
      const claimed = await this.client!.set(
        `processing_code:${code}`,
        Date.now().toString(),
        {
          nx: true, // Only set if key doesn't exist (SETNX behavior)
          ex: this.OAUTH_CODE_PROCESSING_TTL, // Use configured TTL
        }
      );

      // claimed will be "OK" if successful, null if key already exists
      return claimed === "OK";
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
   */
  async markCodeAsCompleted(code: string): Promise<void> {
    if (!this.isRedisAvailable()) {
      console.warn("Redis not connected, skipping completion marking");
      return;
    }

    try {
      // Use pipeline for atomic operations
      const pipeline = this.client!.pipeline();

      // SECURITY FIX: Mark as processed with 2-hour TTL to prevent OAuth code replay attacks
      //
      // Problem: OAuth codes from providers like Tink typically have 10-15 minute lifetimes.
      // Tink's access tokens expire after 30 minutes, so OAuth codes likely expire sooner.
      // Previously, we only stored processed codes for 5 minutes, creating a replay vulnerability
      // where the same code could be reused after our Redis key expired but before the OAuth
      // provider's code expired.
      //
      // Solution: Store processed codes for 2 hours (7200 seconds) - 4x Tink's token lifetime
      // to ensure complete coverage of the OAuth code's actual lifetime while being more
      // resource-efficient than the previous 24-hour approach.
      pipeline.setex(
        `processed_code:${code}`,
        this.OAUTH_CODE_PROCESSED_TTL,
        Date.now().toString()
      );

      // Remove the processing claim
      pipeline.del(`processing_code:${code}`);

      await pipeline.exec();
    } catch (error) {
      console.error(
        "Error marking code as completed:",
        error instanceof Error ? error.message : String(error)
      );
      // Don't throw - this is cleanup, not critical
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
