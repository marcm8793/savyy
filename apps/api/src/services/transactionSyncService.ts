import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { schema, bankAccount, transaction } from "../../db/schema";
import { TinkService } from "./tinkService";

// Types for Tink API responses
interface TinkTransaction {
  id: string;
  accountId: string;
  amount: {
    currencyCode: string;
    value: {
      scale: string;
      unscaledValue: string;
    };
  };
  categories?: {
    pfm?: {
      id: string;
      name: string;
    };
  };
  dates: {
    booked: string;
    value?: string;
  };
  descriptions: {
    display: string;
    original: string;
  };
  identifiers?: {
    providerTransactionId?: string;
  };
  merchantInformation?: {
    merchantCategoryCode?: string;
    merchantName?: string;
  };
  status: "BOOKED" | "PENDING" | "UNDEFINED";
  types?: {
    financialInstitutionTypeCode?: string;
    type?: string;
  };
  reference?: string;
}

interface TinkTransactionsResponse {
  nextPageToken?: string;
  transactions: TinkTransaction[];
}

interface SyncResult {
  success: boolean;
  accountId: string;
  transactionsCreated: number;
  transactionsUpdated: number;
  errors: string[];
  totalTransactionsFetched: number;
}

export class TransactionSyncService {
  private tinkService: TinkService;

  constructor() {
    this.tinkService = new TinkService();
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
    options: {
      dateRangeMonths?: number; // How many months back to fetch (default: 12)
      includeAllStatuses?: boolean; // Include PENDING and UNDEFINED (default: true)
      skipCredentialsRefresh?: boolean; // Skip credentials refresh if token lacks scope (default: false)
    } = {}
  ): Promise<SyncResult> {
    const {
      dateRangeMonths = 12,
      includeAllStatuses = true,
      skipCredentialsRefresh = false,
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
      const bankAccountResult = await db
        .select()
        .from(bankAccount)
        .where(
          and(
            eq(bankAccount.tinkAccountId, tinkAccountId),
            eq(bankAccount.userId, userId)
          )
        )
        .limit(1);

      if (bankAccountResult.length === 0) {
        throw new Error(
          `Bank account ${tinkAccountId} not found for user ${userId}`
        );
      }

      const bankAcc = bankAccountResult[0];

      // 2. Set up date range for initial fetch (last 12 months by default)
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - dateRangeMonths);
      const toDate = new Date();

      const dateRange = {
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
      };

      console.log(
        `Fetching transactions from ${dateRange.from} to ${dateRange.to}`
      );

      // 3. Optionally refresh credentials to get fresher data
      if (!skipCredentialsRefresh) {
        try {
          // Try to refresh credentials with authorization grant token
          const authToken = await this.tinkService.getAuthorizationGrantToken();
          await this.refreshCredentialsWithAuthToken(
            tinkAccountId,
            authToken.access_token
          );

          // Wait a bit for Tink to process the refresh
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log(
            `Credentials refreshed successfully for ${tinkAccountId}`
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.warn(
            `Failed to refresh credentials for ${tinkAccountId}, continuing with existing data:`,
            errorMessage
          );
          // Continue without refresh - we can still fetch transactions
        }
      } else {
        console.log(
          "Skipping credentials refresh - fetching transactions directly"
        );
      }

      // 4. Fetch all transactions with pagination
      const allTransactions = await this.fetchAllTransactions(
        userAccessToken,
        tinkAccountId,
        dateRange,
        includeAllStatuses
      );

      result.totalTransactionsFetched = allTransactions.length;
      console.log(
        `Fetched ${allTransactions.length} transactions from Tink API`
      );

      // 5. Store transactions with upsert strategy
      const storeResult = await this.storeTransactionsWithUpsert(
        db,
        userId,
        bankAcc.id,
        allTransactions
      );

      result.transactionsCreated = storeResult.created;
      result.transactionsUpdated = storeResult.updated;
      result.errors = storeResult.errors;

      // 6. Update bank account's last refreshed timestamp
      await db
        .update(bankAccount)
        .set({
          lastRefreshed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, bankAcc.id));

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
   * Refresh credentials to trigger fresh data fetch from bank
   * Uses user access token (may not have credentials:refresh scope)
   */
  private async refreshCredentials(
    credentialsId: string,
    userAccessToken: string
  ): Promise<void> {
    const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";

    const response = await fetch(
      `${baseUrl}/api/v1/credentials/${credentialsId}/refresh`,
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

    console.log(`Credentials refresh initiated for ${credentialsId}`);
  }

  /**
   * Refresh credentials using authorization grant token
   * This token should have credentials:refresh scope
   */
  private async refreshCredentialsWithAuthToken(
    credentialsId: string,
    authToken: string
  ): Promise<void> {
    const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";

    const response = await fetch(
      `${baseUrl}/api/v1/credentials/${credentialsId}/refresh`,
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
      `Credentials refresh initiated for ${credentialsId} using auth token`
    );
  }

  /**
   * Fetch all transactions with pagination
   */
  private async fetchAllTransactions(
    userAccessToken: string,
    accountId: string,
    dateRange: { from: string; to: string },
    includeAllStatuses: boolean
  ): Promise<TinkTransaction[]> {
    const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
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

      const url = `${baseUrl}/data/v2/transactions?${params.toString()}`;

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
   * Store transactions with upsert strategy to handle duplicates
   */
  private async storeTransactionsWithUpsert(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    bankAccountId: number,
    tinkTransactions: TinkTransaction[]
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process in batches for better performance
    const BATCH_SIZE = 50;

    for (let i = 0; i < tinkTransactions.length; i += BATCH_SIZE) {
      const batch = tinkTransactions.slice(i, i + BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          for (const tinkTx of batch) {
            try {
              // Check if transaction already exists
              const existing = await tx
                .select({ id: transaction.id })
                .from(transaction)
                .where(eq(transaction.tinkTransactionId, tinkTx.id))
                .limit(1);

              const transactionData = {
                userId,
                tinkTransactionId: tinkTx.id,
                tinkAccountId: tinkTx.accountId,
                bankAccountId,
                amount: tinkTx.amount.value.unscaledValue,
                amountScale: parseInt(tinkTx.amount.value.scale) || 0,
                currencyCode: tinkTx.amount.currencyCode,
                bookedDate: tinkTx.dates.booked,
                valueDate: tinkTx.dates.value || tinkTx.dates.booked,
                status: tinkTx.status,
                displayDescription: tinkTx.descriptions.display.substring(
                  0,
                  500
                ),
                originalDescription: tinkTx.descriptions.original.substring(
                  0,
                  500
                ),
                providerTransactionId:
                  tinkTx.identifiers?.providerTransactionId?.substring(0, 255),
                merchantName:
                  tinkTx.merchantInformation?.merchantName?.substring(0, 255),
                merchantCategoryCode:
                  tinkTx.merchantInformation?.merchantCategoryCode?.substring(
                    0,
                    10
                  ),
                categoryId: tinkTx.categories?.pfm?.id?.substring(0, 255),
                categoryName: tinkTx.categories?.pfm?.name?.substring(0, 255),
                transactionType: tinkTx.types?.type?.substring(0, 50),
                financialInstitutionTypeCode:
                  tinkTx.types?.financialInstitutionTypeCode?.substring(0, 10),
                reference: tinkTx.reference?.substring(0, 255),
                updatedAt: new Date(),
              };

              if (existing.length > 0) {
                // Update existing transaction (status might have changed from PENDING to BOOKED)
                await tx
                  .update(transaction)
                  .set(transactionData)
                  .where(eq(transaction.id, existing[0].id));
                updated++;
              } else {
                // Create new transaction
                await tx.insert(transaction).values({
                  ...transactionData,
                  createdAt: new Date(),
                });
                created++;
              }
            } catch (error) {
              const errorMsg = `Error processing transaction ${tinkTx.id}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`;
              console.error(errorMsg);
              errors.push(errorMsg);
            }
          }
        });
      } catch (error) {
        const errorMsg = `Error processing batch starting at index ${i}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { created, updated, errors };
  }

  /**
   * Get sync status for a bank account
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
    // Get bank account info
    const bankAccountResult = await db
      .select({
        id: bankAccount.id,
        lastRefreshed: bankAccount.lastRefreshed,
      })
      .from(bankAccount)
      .where(
        and(
          eq(bankAccount.tinkAccountId, tinkAccountId),
          eq(bankAccount.userId, userId)
        )
      )
      .limit(1);

    if (bankAccountResult.length === 0) {
      throw new Error(`Bank account ${tinkAccountId} not found`);
    }

    const bankAcc = bankAccountResult[0];

    // Get transaction statistics
    const transactions = await db
      .select({
        bookedDate: transaction.bookedDate,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.bankAccountId, bankAcc.id),
          eq(transaction.userId, userId)
        )
      );

    const bookedDates = transactions
      .map((t) => t.bookedDate)
      .filter((date) => date !== null)
      .sort();

    return {
      accountId: tinkAccountId,
      lastSynced: bankAcc.lastRefreshed,
      totalTransactions: transactions.length,
      oldestTransaction: bookedDates.length > 0 ? bookedDates[0] : null,
      newestTransaction:
        bookedDates.length > 0 ? bookedDates[bookedDates.length - 1] : null,
    };
  }
}
