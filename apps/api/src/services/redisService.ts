import { Redis } from "@upstash/redis";

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;

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
        this.client.sismember("processing_codes", code),
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
      // Atomically claim the code using pipeline
      const results = await this.client!.pipeline()
        .exists(`processed_code:${code}`)
        .sadd("processing_codes", code)
        .exec();

      // Extract results with proper typing
      const isCompleted = (results[0] as unknown as [unknown, number])[1];
      const added = (results[1] as unknown as [unknown, number])[1];

      if (isCompleted === 1 || added === 0) {
        // already processed or someone else just claimed it
        return false;
      }
      await this.client!.setex(
        `processing_start:${code}`,
        600,
        Date.now().toString()
      ); // 10 min TTL

      return true;
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

      // Mark as processed with 5-minute TTL (prevent reuse)
      pipeline.setex(`processed_code:${code}`, 300, Date.now().toString());

      // Remove from processing set and cleanup start timestamp
      pipeline.srem("processing_codes", code);
      pipeline.del(`processing_start:${code}`);

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
      // Remove from processing set and cleanup start timestamp
      const pipeline = this.client!.pipeline();
      pipeline.srem("processing_codes", code);
      pipeline.del(`processing_start:${code}`);
      await pipeline.exec();
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
      const processingCount = await this.client!.scard("processing_codes");

      // Note: Can't easily count processed codes due to TTL, but could implement if needed
      return {
        processedCodes: -1, // Not tracked due to TTL
        processingCodes: processingCount,
      };
    } catch (error) {
      console.error(
        "Error getting Redis stats:",
        error instanceof Error ? error.message : String(error)
      );
      return { processedCodes: 0, processingCodes: 0 };
    }
  }

  /**
   * Clean up stuck processing codes (codes that have been processing too long)
   */
  async cleanupProcessingCodes(): Promise<void> {
    if (!this.isRedisAvailable()) {
      return;
    }

    try {
      // Get all processing codes
      const processingCodes = await this.client!.smembers("processing_codes");

      if (processingCodes.length === 0) {
        return;
      }

      const now = Date.now();
      // TODO: Make this configurable
      //       Ensure consistency with the hardcoded timeout value.
      // This hardcoded value should match the TTL set in markCodeAsProcessing. Consider using the same configurable constant suggested earlier.

      // -      const maxProcessingTime = 10 * 60 * 1000; // 10 minutes
      // +      const maxProcessingTime = this.PROCESSING_TIMEOUT_SECONDS * 1000;
      const maxProcessingTime = 10 * 60 * 1000; // 10 minutes
      const codesToRemove: string[] = [];

      // Check each processing code
      for (const code of processingCodes) {
        try {
          const startTime = await this.client!.get(`processing_start:${code}`);

          if (!startTime || typeof startTime !== "string") {
            // No start time found - this code is orphaned, remove it
            codesToRemove.push(code);
            continue;
          }

          const parsed = Number.parseInt(startTime, 10);

          if (Number.isNaN(parsed) || now - parsed > maxProcessingTime) {
            // Code has been processing too long - it's stuck
            codesToRemove.push(code);
          }
        } catch {
          // If we can't check this code, consider it orphaned
          console.warn(
            `Failed to check processing time for code ${code.substring(
              0,
              8
            )}...`
          );
          codesToRemove.push(code);
        }
      }

      // Remove stuck codes in batch
      if (codesToRemove.length > 0) {
        const pipeline = this.client!.pipeline();

        for (const code of codesToRemove) {
          pipeline.srem("processing_codes", code);
          pipeline.del(`processing_start:${code}`);
        }

        await pipeline.exec();

        console.log(
          `Cleaned up ${codesToRemove.length} stuck processing codes (processing >10min or orphaned)`
        );
      }
    } catch (error) {
      console.error(
        "Error cleaning up processing codes:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Create singleton instance
export const redisService = new RedisService();
