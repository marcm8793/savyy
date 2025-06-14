import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../db/schema";
import { TransactionFetchService } from "./transactionFetchService";
import { TransactionStorageService } from "./transactionStorageService";
import { SyncResult, TransactionFetchOptions, DateRange } from "./types";

/**
 * Core transaction sync service that orchestrates the sync process
 * Coordinates between fetch and storage services
 */
export class TransactionSyncService {
  private fetchService: TransactionFetchService;
  private storageService: TransactionStorageService;

  constructor() {
    this.fetchService = new TransactionFetchService();
    this.storageService = new TransactionStorageService();
  }

  /**
   * Initial transaction sync when user connects a new bank account
   * This is called after successful bank account connection
   */
  async syncInitialTransactions(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId: string,
    userAccessToken: string,
    options: TransactionFetchOptions = {}
  ): Promise<SyncResult> {
    const {
      dateRangeMonths = 12, // 12 months by default
      includeAllStatuses = true, // include all statuses by default
      skipCredentialsRefresh = false, // skip credentials refresh by default
    } = options;

    console.log(
      `Starting initial transaction sync for account ${tinkAccountId}`
    );

    const result: SyncResult = {
      success: false,
      accountId: tinkAccountId,
      transactionsCreated: 0,
      transactionsUpdated: 0,
      errors: [],
      totalTransactionsFetched: 0,
    };

    try {
      // 1. Verify bank account exists and belongs to user
      const bankAcc = await this.storageService.verifyBankAccount(
        db,
        userId,
        tinkAccountId
      );

      // 2. Set up date range for initial fetch (last 12 months by default)
      const dateRange = this.createDateRange(dateRangeMonths);

      console.log(
        `Fetching transactions from ${dateRange.from} to ${dateRange.to}`
      );

      // 3. Optionally refresh credentials to get fresher data
      //TODO: Possible credentials mis-mapping
      // refreshCredentialsWithAuthToken is invoked with tinkAccountId, but the Tink endpoint expects a credentials ID, not an account ID. If those IDs differ, refresh will 404 and silently fall back to stale data.
      // 3. Optionally refresh credentials to get fresher data
      //       Credentials refresh is called with an account ID, not credentials ID.
      // refreshCredentialsWithAuthToken(tinkAccountId, …) passes a bank‐account ID to the /credentials/:id/refresh endpoint, which expects credentialsId.
      // Result: 404 → stale data despite “success” log.

      // Pass the correct credentialsId (often available on the bankAccount row) or map account → credentials before calling.
      await this.fetchService.tryRefreshCredentials(
        tinkAccountId,
        skipCredentialsRefresh
      );

      // 4. Fetch and process transactions page by page (memory-efficient)
      let totalCreated = 0;
      let totalUpdated = 0;
      const allErrors: string[] = [];

      for await (const page of this.fetchService.fetchPagedTransactions(
        userAccessToken,
        tinkAccountId,
        dateRange,
        includeAllStatuses
      )) {
        result.totalTransactionsFetched += page.transactions.length;

        // Process this page immediately to avoid memory buildup
        const storeResult =
          await this.storageService.storeTransactionsWithUpsert(
            db,
            userId,
            bankAcc.id,
            page.transactions
          );

        totalCreated += storeResult.created;
        totalUpdated += storeResult.updated;
        allErrors.push(...storeResult.errors);

        console.log(
          `Processed page: ${storeResult.created} created, ${storeResult.updated} updated, ${storeResult.errors.length} errors`
        );
      }

      console.log(
        `Completed processing ${result.totalTransactionsFetched} transactions from Tink API`
      );

      result.transactionsCreated = totalCreated;
      result.transactionsUpdated = totalUpdated;
      result.errors = allErrors;

      // 6. Update bank account's last refreshed timestamp
      await this.storageService.updateAccountLastRefreshed(db, bankAcc.id);

      result.success = true;

      console.log(`Initial sync completed for account ${tinkAccountId}:`, {
        created: result.transactionsCreated,
        updated: result.transactionsUpdated,
        errors: result.errors.length,
        totalFetched: result.totalTransactionsFetched,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Error in initial transaction sync for account ${tinkAccountId}:`,
        error
      );

      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Get sync status for a bank account
   * Delegates to storage service
   */
  async getSyncStatus(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId: string
  ): Promise<{
    accountId: string;
    lastSynced: Date | null;
    totalTransactions: number;
    oldestTransaction: string | null;
    newestTransaction: string | null;
  }> {
    return this.storageService.getSyncStatus(db, userId, tinkAccountId);
  }

  /**
   * Create date range for transaction fetching
   * Helper method to generate date ranges
   */
  private createDateRange(dateRangeMonths: number): DateRange {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - dateRangeMonths);
    const toDate = new Date();

    return {
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
    };
  }
}

export const transactionSyncService = new TransactionSyncService();
