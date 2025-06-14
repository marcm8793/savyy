import { TinkService } from "../tinkService";
import { TinkTransaction, TinkTransactionsResponse, DateRange } from "./types";

/**
 * Service responsible for fetching transactions from Tink API
 * Handles pagination, rate limiting, and API communication
 */
export class TransactionFetchService {
  private readonly baseUrl: string;
  private tinkService: TinkService;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
    this.tinkService = new TinkService();
  }

  /**
   * Fetch all transactions with pagination
   * Handles automatic pagination and rate limiting
   */
  async fetchAllTransactions(
    userAccessToken: string,
    accountId: string,
    dateRange: DateRange,
    includeAllStatuses: boolean
  ): Promise<TinkTransaction[]> {
    const allTransactions: TinkTransaction[] = [];
    let nextPageToken: string | undefined;

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

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tink API error: ${response.status} ${errorText}`);
      }

      const data: TinkTransactionsResponse =
        (await response.json()) as TinkTransactionsResponse;
      allTransactions.push(...data.transactions);
      nextPageToken = data.nextPageToken;

      console.log(
        `Fetched ${data.transactions.length} transactions, total so far: ${allTransactions.length}`
      );

      // Add small delay to avoid rate limiting
      if (nextPageToken) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (nextPageToken);

    return allTransactions;
  }

  /**
   * Refresh credentials to get fresher transaction data
   * Note: This method has a known issue where it passes accountId instead of credentialsId
   * TODO: Fix credentials ID mapping
   */
  async refreshCredentials(
    credentialsId: string,
    userAccessToken: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/data/v2/credentials/${credentialsId}/refresh`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      }
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
   * Alternative method for credential refresh
   */
  async refreshCredentialsWithAuthToken(
    credentialsId: string,
    authToken: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/data/v2/credentials/${credentialsId}/refresh`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
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
    // Result: 404 → stale data despite “success” log.

    // Pass the correct credentialsId (often available on the bankAccount row) or map account → credentials before calling.
    try {
      // Try to refresh credentials with authorization grant token
      const authToken = await this.tinkService.getAuthorizationGrantToken();
      await this.refreshCredentialsWithAuthToken(
        tinkAccountId,
        authToken.access_token
      );

      // Wait a bit for Tink to process the refresh
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
