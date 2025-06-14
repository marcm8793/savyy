import { TinkService } from "../tinkService";
import { TinkTransactionsResponse, DateRange } from "./types";
import { httpRetry } from "../../utils/httpRetry";

/**
 * Service responsible for fetching transactions from Tink API
 * Handles pagination, rate limiting, and API communication
 * Uses shared HTTP retry utility for robust error handling
 */
export class TransactionFetchService {
  private readonly baseUrl: string;
  private tinkService: TinkService;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
    this.tinkService = new TinkService();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch transactions page by page with async iteration
   * Memory-efficient approach that processes one page at a time
   * Uses shared retry utility for robust error handling
   */
  async *fetchPagedTransactions(
    userAccessToken: string,
    accountId: string,
    dateRange: DateRange,
    includeAllStatuses: boolean
  ): AsyncGenerator<TinkTransactionsResponse, void, unknown> {
    let nextPageToken: string | undefined;
    let totalFetched = 0;
    let pageNumber = 1;

    const statusFilter = includeAllStatuses
      ? ["BOOKED", "PENDING", "UNDEFINED"]
      : ["BOOKED"];

    do {
      const params = new URLSearchParams();
      params.append("accountIdIn", accountId);
      params.append("bookedDateGte", dateRange.from);
      params.append("bookedDateLte", dateRange.to);
      params.append("pageSize", "100"); // Maximum allowed

      statusFilter.forEach((status) => params.append("statusIn", status));

      if (nextPageToken) {
        params.append("pageToken", nextPageToken);
      }

      const url = `${this.baseUrl}/data/v2/transactions?${params.toString()}`;
      const context = `Fetch transactions page ${pageNumber} for account ${accountId}`;

      const response = await httpRetry.fetchWithRetry(
        url,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            "Content-Type": "application/json",
          },
        },
        context
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tink API error: ${response.status} ${errorText}`);
      }

      const data: TinkTransactionsResponse =
        (await response.json()) as TinkTransactionsResponse;

      totalFetched += data.transactions.length;
      nextPageToken = data.nextPageToken;

      console.log(
        `Fetched page ${pageNumber} with ${data.transactions.length} transactions, total so far: ${totalFetched}`
      );

      // Yield the page for immediate processing
      yield data;

      // Add small delay to avoid rate limiting
      if (nextPageToken) {
        await this.sleep(100);
      }

      pageNumber++;
    } while (nextPageToken);

    console.log(
      `Completed fetching ${totalFetched} transactions in total across ${
        pageNumber - 1
      } pages`
    );
  }

  /**
   * Refresh credentials to get fresher transaction data
   * Uses shared retry utility for robustness
   * Note: This method has a known issue where it passes accountId instead of credentialsId
   * TODO: Fix credentials ID mapping
   */
  async refreshCredentials(
    credentialsId: string,
    userAccessToken: string
  ): Promise<void> {
    const url = `${this.baseUrl}/data/v2/credentials/${credentialsId}/refresh`;
    const context = `Refresh credentials ${credentialsId}`;

    const response = await httpRetry.fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      },
      context
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to refresh credentials: ${response.status} ${errorText}`
      );
    }

    console.log(`Credentials ${credentialsId} refreshed successfully`);
  }

  /**
   * Refresh credentials using authorization grant token
   * Alternative method for credential refresh with retry logic
   */
  async refreshCredentialsWithAuthToken(
    credentialsId: string,
    authToken: string
  ): Promise<void> {
    const url = `${this.baseUrl}/data/v2/credentials/${credentialsId}/refresh`;
    const context = `Refresh credentials ${credentialsId} with auth token`;

    const response = await httpRetry.fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      },
      context
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to refresh credentials with auth token: ${response.status} ${errorText}`
      );
    }

    console.log(
      `Credentials ${credentialsId} refreshed successfully with auth token`
    );
  }

  /**
   * Attempt to refresh credentials with proper error handling
   * Returns true if successful, false if failed (but allows continuation)
   */
  async tryRefreshCredentials(
    tinkAccountId: string,
    skipCredentialsRefresh: boolean = false
  ): Promise<boolean> {
    if (skipCredentialsRefresh) {
      console.log(
        "Skipping credentials refresh - fetching transactions directly"
      );
      return true;
    }
    //TODO: Possible credentials mis-mapping
    // refreshCredentialsWithAuthToken is invoked with tinkAccountId, but the Tink endpoint expects a credentials ID, not an account ID. If those IDs differ, refresh will 404 and silently fall back to stale data.
    // 3. Optionally refresh credentials to get fresher data
    //       Credentials refresh is called with an account ID, not credentials ID.
    // refreshCredentialsWithAuthToken(tinkAccountId, …) passes a bank‐account ID to the /credentials/:id/refresh endpoint, which expects credentialsId.
    // Result: 404 → stale data despite "success" log.

    // Pass the correct credentialsId (often available on the bankAccount row) or map account → credentials before calling.
    try {
      // Try to refresh credentials with authorization grant token
      const authToken = await this.tinkService.getAuthorizationGrantToken();
      await this.refreshCredentialsWithAuthToken(
        tinkAccountId,
        authToken.access_token
      );

      // Wait a bit for Tink to process the refresh
      await this.sleep(2000);
      console.log(`Credentials refreshed successfully for ${tinkAccountId}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `Failed to refresh credentials for ${tinkAccountId}, continuing with existing data:`,
        errorMessage
      );
      // Continue without refresh - we can still fetch transactions
      return false;
    }
  }
}

export const transactionFetchService = new TransactionFetchService();
