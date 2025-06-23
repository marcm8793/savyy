import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { schema, bankAccount, transaction } from "../../../db/schema";
import { TinkTransaction, StorageResult } from "./types";

/**
 * Service responsible for storing transactions in the database
 * Handles bulk upserts, batching, and database operations
 */
export class TransactionStorageService {
  private readonly BATCH_SIZE = 50;

  /**
   * Store transactions with bulk upsert strategy to handle duplicates
   * Uses PostgreSQL's ON CONFLICT to eliminate N+1 query pattern
   */
  async storeTransactionsWithUpsert(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    bankAccountId: string,
    tinkTransactions: TinkTransaction[]
  ): Promise<StorageResult> {
    const errors: string[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process in batches for better performance
    for (let i = 0; i < tinkTransactions.length; i += this.BATCH_SIZE) {
      const batch = tinkTransactions.slice(i, i + this.BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          // Prepare batch data for bulk upsert with enhanced status tracking
          const batchData = batch.map((tinkTx) => ({
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
            originalStatus: tinkTx.status, // Store original status for new transactions
            statusLastUpdated: new Date(), // Always update status timestamp
            displayDescription: (tinkTx.descriptions.display ?? "").substring(
              0,
              500
            ),
            originalDescription: (tinkTx.descriptions.original ?? "").substring(
              0,
              500
            ),
            providerTransactionId:
              tinkTx.identifiers?.providerTransactionId?.substring(0, 255),
            merchantName: tinkTx.merchantInformation?.merchantName?.substring(
              0,
              255
            ),
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
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          // Bulk upsert using ON CONFLICT with enhanced status change detection
          const result = await tx
            .insert(transaction)
            .values(batchData)
            .onConflictDoUpdate({
              target: transaction.tinkTransactionId,
              set: {
                status: sql`EXCLUDED.status`,
                // Only update statusLastUpdated if status actually changed
                statusLastUpdated: sql`CASE
                  WHEN transactions.status != EXCLUDED.status
                  THEN EXCLUDED.status_last_updated
                  ELSE transactions.status_last_updated
                END`,
                amount: sql`EXCLUDED.amount`,
                amountScale: sql`EXCLUDED.amount_scale`,
                displayDescription: sql`EXCLUDED.display_description`,
                originalDescription: sql`EXCLUDED.original_description`,
                merchantName: sql`EXCLUDED.merchant_name`,
                merchantCategoryCode: sql`EXCLUDED.merchant_category_code`,
                categoryId: sql`EXCLUDED.category_id`,
                categoryName: sql`EXCLUDED.category_name`,
                updatedAt: sql`EXCLUDED.updated_at`,
              },
            })
            .returning({
              id: transaction.id,
              tinkTransactionId: transaction.tinkTransactionId,
              createdAt: transaction.createdAt,
              updatedAt: transaction.updatedAt,
            });

          // Count created vs updated based on timestamps
          const batchCreated = result.filter(
            (r) => r.createdAt.getTime() === r.updatedAt.getTime()
          ).length;
          const batchUpdated = result.length - batchCreated;

          totalCreated += batchCreated;
          totalUpdated += batchUpdated;
        });
      } catch (error) {
        const errorMsg = `Error processing batch starting at index ${i}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { created: totalCreated, updated: totalUpdated, errors };
  }

  /**
   * Update bank account's last refreshed timestamp
   */
  async updateAccountLastRefreshed(
    db: NodePgDatabase<typeof schema>,
    bankAccountId: string
  ): Promise<void> {
    await db
      .update(bankAccount)
      .set({
        lastRefreshed: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankAccount.id, bankAccountId));
  }

  /**
   * Update bank account's incremental sync timestamp for consent refresh tracking
   */
  async updateAccountIncrementalSync(
    db: NodePgDatabase<typeof schema>,
    bankAccountId: string,
    syncType: "full" | "incremental" = "incremental"
  ): Promise<void> {
    const now = new Date();

    if (syncType === "full") {
      await db
        .update(bankAccount)
        .set({
          lastRefreshed: now,
          lastIncrementalSync: now,
          updatedAt: now,
        })
        .where(eq(bankAccount.id, bankAccountId));
    } else {
      await db
        .update(bankAccount)
        .set({
          lastIncrementalSync: now,
          updatedAt: now,
        })
        .where(eq(bankAccount.id, bankAccountId));
    }
  }

  /**
   * Update account consent status for tracking consent health
   */
  async updateAccountConsentStatus(
    db: NodePgDatabase<typeof schema>,
    bankAccountId: string,
    status: string,
    expiresAt?: Date
  ): Promise<void> {
    if (expiresAt) {
      await db
        .update(bankAccount)
        .set({
          consentStatus: status,
          consentExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, bankAccountId));
    } else {
      await db
        .update(bankAccount)
        .set({
          consentStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(bankAccount.id, bankAccountId));
    }
  }

  /**
   * Get sync status for a bank account using SQL aggregates for performance
   * Uses O(1) SQL aggregation instead of loading all transactions into memory
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

    // Get transaction statistics using SQL aggregates (O(1) performance)
    const statsResult = await db
      .select({
        totalTransactions: sql<number>`COUNT(*)::int`,
        oldestTransaction: sql<string | null>`MIN(${transaction.bookedDate})`,
        newestTransaction: sql<string | null>`MAX(${transaction.bookedDate})`,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.bankAccountId, bankAcc.id),
          eq(transaction.userId, userId)
        )
      );

    const stats = statsResult[0];

    return {
      accountId: tinkAccountId,
      lastSynced: bankAcc.lastRefreshed,
      totalTransactions: stats.totalTransactions,
      oldestTransaction: stats.oldestTransaction,
      newestTransaction: stats.newestTransaction,
    };
  }

  /**
   * Verify bank account exists and belongs to user
   * Returns the bank account record if found
   */
  async verifyBankAccount(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId: string
  ) {
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

    return bankAccountResult[0];
  }
}

export const transactionStorageService = new TransactionStorageService();
