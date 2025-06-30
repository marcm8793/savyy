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
    options: TransactionFetchOptions & {
      isConsentRefresh?: boolean;
      lastSyncDate?: Date;
    } = {}
  ): Promise<SyncResult> {
    const {
      dateRangeMonths = 3,
      includeAllStatuses = true,
      skipCredentialsRefresh = false,
      isConsentRefresh = false,
      lastSyncDate,
    } = options;

    // If this is a consent refresh with existing data, use the enhanced sync method
    if (isConsentRefresh && lastSyncDate) {
      return this.syncTransactionsForConsentRefresh(
        db,
        userId,
        tinkAccountId,
        userAccessToken,
        {
          lastSyncDate,
          forceFullSync: false,
          includeStatusUpdates: true,
        }
      );
    }

    // Otherwise, use the original initial sync logic
    console.log(
      `Starting initial transaction sync for account ${tinkAccountId}`,
      { isConsentRefresh, hasLastSyncDate: !!lastSyncDate }
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

      // 2. Set up date range for initial fetch
      const dateRange = this.createDateRange(dateRangeMonths);

      console.log(
        `Fetching transactions from ${dateRange.from} to ${dateRange.to}`
      );

      // 3. Optionally refresh credentials to get fresher data
      await this.fetchService.tryRefreshCredentials(
        db,
        userId,
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
        isConsentRefresh,
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
   * Sync transactions for a specific date range (used by webhooks)
   * This is called when webhook events indicate transaction changes
   */
  async syncTransactionsForDateRange(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId: string,
    userAccessToken: string,
    dateRange: DateRange
  ): Promise<SyncResult> {
    console.log(
      `Starting webhook-triggered transaction sync for account ${tinkAccountId}, date range: ${dateRange.from} to ${dateRange.to}`
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

      // 2. Fetch and process transactions for the specific date range
      let totalCreated = 0;
      let totalUpdated = 0;
      const allErrors: string[] = [];

      for await (const page of this.fetchService.fetchPagedTransactions(
        userAccessToken,
        tinkAccountId,
        dateRange,
        true // include all statuses
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

      result.transactionsCreated = totalCreated;
      result.transactionsUpdated = totalUpdated;
      result.errors = allErrors;

      // 3. Update bank account's last refreshed timestamp
      await this.storageService.updateAccountLastRefreshed(db, bankAcc.id);

      result.success = true;

      console.log(
        `Webhook-triggered sync completed for account ${tinkAccountId}:`,
        {
          created: result.transactionsCreated,
          updated: result.transactionsUpdated,
          errors: result.errors.length,
          totalFetched: result.totalTransactionsFetched,
          dateRange,
        }
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Error in webhook-triggered transaction sync for account ${tinkAccountId}:`,
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

  /**
   * Enhanced transaction sync for consent refresh scenarios
   * Handles incremental updates and status changes for existing transactions
   */
  async syncTransactionsForConsentRefresh(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId: string,
    userAccessToken: string,
    options: {
      lastSyncDate?: Date;
      forceFullSync?: boolean;
      includeStatusUpdates?: boolean;
    } = {}
  ): Promise<SyncResult> {
    const {
      lastSyncDate,
      forceFullSync = false,
      includeStatusUpdates = true,
    } = options;

    console.log(
      `Starting consent refresh transaction sync for account ${tinkAccountId}`,
      {
        lastSyncDate: lastSyncDate?.toISOString(),
        forceFullSync,
        includeStatusUpdates,
      }
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

      // 2. Determine sync strategy and date range
      let dateRange: DateRange;
      let syncStrategy: "incremental" | "full" | "status_update";

      if (forceFullSync || !lastSyncDate) {
        // Full sync: get last 3 months
        dateRange = this.createDateRange(3);
        syncStrategy = "full";
        console.log("Using full sync strategy");
      } else {
        // Incremental sync: from last sync date with some overlap for status updates
        const overlapDays = 7; // Check last 7 days for status updates
        const fromDate = new Date(lastSyncDate);
        fromDate.setDate(fromDate.getDate() - overlapDays);

        dateRange = {
          from: fromDate.toISOString().split("T")[0],
          to: new Date().toISOString().split("T")[0],
        };
        syncStrategy = "incremental";
        console.log(
          "Using incremental sync strategy with overlap for status updates"
        );
      }

      console.log(
        `Fetching transactions from ${dateRange.from} to ${dateRange.to} (strategy: ${syncStrategy})`
      );

      // 3. Fetch and process transactions page by page
      let totalCreated = 0;
      let totalUpdated = 0;
      const allErrors: string[] = [];

      for await (const page of this.fetchService.fetchPagedTransactions(
        userAccessToken,
        tinkAccountId,
        dateRange,
        true // include all statuses for status updates
      )) {
        result.totalTransactionsFetched += page.transactions.length;

        // Process this page with enhanced upsert that handles status updates
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
          `Processed page (${syncStrategy}): ${storeResult.created} created, ${storeResult.updated} updated, ${storeResult.errors.length} errors`
        );
      }

      // 4. For incremental sync, also check for status updates on recent transactions
      if (syncStrategy === "incremental" && includeStatusUpdates) {
        const statusUpdateResult = await this.performStatusUpdateCheck(
          db,
          userId,
          bankAcc.id,
          userAccessToken,
          tinkAccountId,
          lastSyncDate
        );

        totalUpdated += statusUpdateResult.updated;
        allErrors.push(...statusUpdateResult.errors);

        console.log(
          `Status update check completed: ${statusUpdateResult.updated} transactions updated`
        );
      }

      result.transactionsCreated = totalCreated;
      result.transactionsUpdated = totalUpdated;
      result.errors = allErrors;

      // 5. Update bank account's last refreshed timestamp
      await this.storageService.updateAccountLastRefreshed(db, bankAcc.id);

      result.success = true;

      console.log(
        `Consent refresh sync completed for account ${tinkAccountId}:`,
        {
          strategy: syncStrategy,
          created: result.transactionsCreated,
          updated: result.transactionsUpdated,
          errors: result.errors.length,
          totalFetched: result.totalTransactionsFetched,
        }
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Error in consent refresh transaction sync for account ${tinkAccountId}:`,
        error
      );

      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Check for status updates on existing transactions
   * This is crucial for catching PENDING -> BOOKED status changes
   */
  private async performStatusUpdateCheck(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    bankAccountId: string,
    userAccessToken: string,
    tinkAccountId: string,
    lastSyncDate?: Date
  ): Promise<{ updated: number; errors: string[] }> {
    console.log("Performing status update check for recent transactions");

    const errors: string[] = [];
    let totalUpdated = 0;

    try {
      // Get recent transactions that might have status updates
      // Focus on PENDING transactions and recent BOOKED ones
      const checkDate =
        lastSyncDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const extendedRange = {
        from: checkDate.toISOString().split("T")[0],
        to: new Date().toISOString().split("T")[0],
      };

      // Fetch fresh data from Tink for status comparison
      for await (const page of this.fetchService.fetchPagedTransactions(
        userAccessToken,
        tinkAccountId,
        extendedRange,
        true // include all statuses
      )) {
        // Process with focus on updates rather than creates
        const storeResult =
          await this.storageService.storeTransactionsWithUpsert(
            db,
            userId,
            bankAccountId,
            page.transactions
          );

        totalUpdated += storeResult.updated;
        errors.push(...storeResult.errors);
      }

      return { updated: totalUpdated, errors };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error in status update check:", error);
      errors.push(errorMessage);
      return { updated: totalUpdated, errors };
    }
  }
}

export const transactionSyncService = new TransactionSyncService();
