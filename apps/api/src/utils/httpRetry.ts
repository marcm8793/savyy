/**
 * Shared HTTP retry utility with exponential backoff
 * Provides consistent retry behavior across all services
 */

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

export class HttpRetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = "HttpRetryError";
  }
}

export class HttpRetryUtil {
  private readonly DEFAULT_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    retryableStatuses: [
      408, // Request Timeout
      429, // Too Many Requests (rate limiting)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ],
  };

  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an HTTP error is retryable (transient)
   */
  private isRetryableError(status: number): boolean {
    return (
      status >= 500 || // All server errors
      this.config.retryableStatuses.includes(status)
    );
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    context: string = "HTTP request"
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(
          `${context}: Attempt ${attempt + 1}/${this.config.maxRetries + 1}`
        );

        const response = await fetch(url, options);

        // If successful or non-retryable error, return immediately
        if (response.ok || !this.isRetryableError(response.status)) {
          if (attempt > 0) {
            console.log(`${context}: Succeeded after ${attempt + 1} attempts`);
          }
          return response;
        }

        // For retryable errors, prepare for retry
        const errorText = await response.text();
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);

        console.warn(
          `${context}: Retryable error on attempt ${attempt + 1}: ${
            lastError.message
          }`
        );
      } catch (error) {
        // Network errors, timeouts, etc.
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `${context}: Network error on attempt ${attempt + 1}: ${
            lastError.message
          }`
        );
      }

      // If this was the last attempt, don't wait
      if (attempt === this.config.maxRetries) {
        break;
      }

      // Calculate delay and wait before retry
      const delay = this.calculateDelay(attempt);
      console.log(`${context}: Waiting ${Math.round(delay)}ms before retry...`);
      await this.sleep(delay);
    }

    // All retries exhausted
    throw new HttpRetryError(
      `${context} failed after ${this.config.maxRetries + 1} attempts`,
      this.config.maxRetries + 1,
      lastError || new Error("Unknown error")
    );
  }
}

// Default instance for common use cases
export const httpRetry = new HttpRetryUtil();

// Convenience function for quick usage
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  context?: string,
  config?: RetryConfig
): Promise<Response> {
  const retryUtil = config ? new HttpRetryUtil(config) : httpRetry;
  return retryUtil.fetchWithRetry(url, options, context);
}
