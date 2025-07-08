import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { schema, bankAccount, transaction } from "../../../db/schema";
import { TinkTransaction, StorageResult } from "./types";
import { transactionCategorizationService } from "./transactionCategorizationService";
import { getEncryptionService } from "../encryptionService";
import { encryptionResultToFields } from "../../types/encryption";

/**
 * Service responsible for storing transactions in the database
 * Handles bulk upserts, batching, and database operations
 * Now includes automatic categorization during storage
 */
export class TransactionStorageService {
  private readonly BATCH_SIZE = 50;
  private readonly encryptionService = getEncryptionService();

  /**
   * Encrypt sensitive transaction fields for storage
   */
  private async encryptTransactionData(
    payeeAccountNumber: string | null,
    payerAccountNumber: string | null
  ) {
    const encryptedFields: {
      encryptedPayeeAccountNumber?: string | null;
      encryptedPayeeAccountNumberIv?: string | null;
      encryptedPayeeAccountNumberAuthTag?: string | null;
      encryptedPayerAccountNumber?: string | null;
      encryptedPayerAccountNumberIv?: string | null;
      encryptedPayerAccountNumberAuthTag?: string | null;
      encryptionKeyId?: string | null;
    } = {};

    // Encrypt payee account number if provided
    if (payeeAccountNumber) {
      const encryptedPayee = await this.encryptionService.encrypt(
        payeeAccountNumber
      );
      const payeeFields = encryptionResultToFields(encryptedPayee);
      encryptedFields.encryptedPayeeAccountNumber = payeeFields.encryptedData;
      encryptedFields.encryptedPayeeAccountNumberIv = payeeFields.iv;
      encryptedFields.encryptedPayeeAccountNumberAuthTag = payeeFields.authTag;
      encryptedFields.encryptionKeyId = payeeFields.keyId;
    }

    // Encrypt payer account number if provided
    if (payerAccountNumber) {
      const encryptedPayer = await this.encryptionService.encrypt(
        payerAccountNumber
      );
      const payerFields = encryptionResultToFields(encryptedPayer);
      encryptedFields.encryptedPayerAccountNumber = payerFields.encryptedData;
      encryptedFields.encryptedPayerAccountNumberIv = payerFields.iv;
      encryptedFields.encryptedPayerAccountNumberAuthTag = payerFields.authTag;
      if (!encryptedFields.encryptionKeyId) {
        encryptedFields.encryptionKeyId = payerFields.keyId;
      }
    }

    return encryptedFields;
  }

  /**
   * Store transactions with bulk upsert strategy and automatic categorization
   * Uses PostgreSQL's ON CONFLICT to eliminate N+1 query pattern
   */
  async storeTransactionsWithUpsert(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    bankAccountId: string,
    tinkTransactions: TinkTransaction[]
  ): Promise<StorageResult & { categorized: number }> {
    const errors: string[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalCategorized = 0;

    // Process in batches for better performance
    for (let i = 0; i < tinkTransactions.length; i += this.BATCH_SIZE) {
      const batch = tinkTransactions.slice(i, i + this.BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          // ✨ NEW: Categorize the batch before storage
          const categorizedBatch =
            await transactionCategorizationService.categorizeBatch(
              tx,
              userId,
              batch
            );

          // Prepare batch data for bulk upsert with enhanced categorization
          const batchData = categorizedBatch.map((categorizedTx) => {
            const { categorization } = categorizedTx;

            return {
              userId,
              tinkTransactionId: categorizedTx.id,
              tinkAccountId: categorizedTx.accountId,
              bankAccountId,
              amount: categorizedTx.amount.value.unscaledValue,
              amountScale: parseInt(categorizedTx.amount.value.scale) || 0,
              currencyCode: categorizedTx.amount.currencyCode,
              bookedDate: categorizedTx.dates.booked,
              valueDate:
                categorizedTx.dates.value || categorizedTx.dates.booked,
              status: categorizedTx.status,
              originalStatus: categorizedTx.status, // Store original status for new transactions
              statusLastUpdated: new Date(), // Always update status timestamp
              displayDescription: (
                categorizedTx.descriptions.display ?? ""
              ).substring(0, 500),
              originalDescription: (
                categorizedTx.descriptions.original ?? ""
              ).substring(0, 500),
              providerTransactionId:
                categorizedTx.identifiers?.providerTransactionId?.substring(
                  0,
                  255
                ),
              merchantName:
                categorizedTx.merchantInformation?.merchantName?.substring(
                  0,
                  255
                ),
              merchantCategoryCode:
                categorizedTx.merchantInformation?.merchantCategoryCode?.substring(
                  0,
                  10
                ),

              // Original Tink categories (preserved)
              categoryId: categorizedTx.categories?.pfm?.id?.substring(0, 255),
              categoryName: categorizedTx.categories?.pfm?.name?.substring(
                0,
                255
              ),

              // ✨ NEW: Enhanced categorization fields
              mainCategory: categorization.mainCategory,
              subCategory: categorization.subCategory,
              categorySource: categorization.source,
              categoryConfidence: categorization.confidence.toString(),
              needsReview: categorization.needsReview,
              categorizedAt: new Date(),

              transactionType: categorizedTx.types?.type?.substring(0, 50),
              financialInstitutionTypeCode:
                categorizedTx.types?.financialInstitutionTypeCode?.substring(
                  0,
                  10
                ),
              reference: categorizedTx.reference?.substring(0, 255),
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });

          // Bulk upsert using ON CONFLICT with enhanced categorization tracking
          const result = await tx
            .insert(transaction)
            .values(batchData)
            .onConflictDoUpdate({
              target: transaction.tinkTransactionId,
              set: {
                status: sql`EXCLUDED.status`,
                // Only update statusLastUpdated if status actually changed
                statusLastUpdated: sql`CASE
                  WHEN ${transaction}.status != EXCLUDED.status
                  THEN EXCLUDED.status_last_updated
                  ELSE ${transaction}.status_last_updated
                END`,
                amount: sql`EXCLUDED.amount`,
                amountScale: sql`EXCLUDED.amount_scale`,
                displayDescription: sql`EXCLUDED.display_description`,
                originalDescription: sql`EXCLUDED.original_description`,
                merchantName: sql`EXCLUDED.merchant_name`,
                merchantCategoryCode: sql`EXCLUDED.merchant_category_code`,
                categoryId: sql`EXCLUDED.category_id`,
                categoryName: sql`EXCLUDED.category_name`,

                // ✨ NEW: Update categorization fields
                mainCategory: sql`EXCLUDED.main_category`,
                subCategory: sql`EXCLUDED.sub_category`,
                categorySource: sql`EXCLUDED.category_source`,
                categoryConfidence: sql`EXCLUDED.category_confidence`,
                needsReview: sql`EXCLUDED.needs_review`,
                categorizedAt: sql`EXCLUDED.categorized_at`,

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
          totalCategorized += result.length; // All transactions were categorized

          console.log(
            `Batch processed: ${batchCreated} created, ${batchUpdated} updated, ${result.length} categorized`
          );
        });
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Batch ${i}-${i + batch.length}: ${errorMessage}`);
      }
    }

    return {
      created: totalCreated,
      updated: totalUpdated,
      errors,
      categorized: totalCategorized,
    };
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
