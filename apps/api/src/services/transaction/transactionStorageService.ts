import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { schema, bankAccount, transaction } from "../../../db/schema";
import { TinkTransaction, StorageResult } from "./types";
import { AICategorizationService } from "./aiCategorizationService";
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
  private readonly aiCategorizationService = new AICategorizationService();

  // TODO: method to be used
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
  ): Promise<StorageResult> {
    const errors: string[] = [];
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process in batches for better performance
    for (let i = 0; i < tinkTransactions.length; i += this.BATCH_SIZE) {
      const batch = tinkTransactions.slice(i, i + this.BATCH_SIZE);

      try {
        await db.transaction(async (tx) => {
          // Categorize the batch before storage using AI
          const categorizations = await this.aiCategorizationService.categorizeBatch(
            tx,
            batch
          );

          // Prepare batch data for bulk upsert with AI categorization
          const batchData = batch.map((tinkTx) => {
            const categorization = categorizations.get(tinkTx.id) || {
              mainCategory: "To Classify",
              subCategory: "Needs Review",
              userModified: false,
            };

            return {
              userId,
              tinkTransactionId: tinkTx.id,
              tinkAccountId: tinkTx.accountId,
              bankAccountId,
              amount: tinkTx.amount.value.unscaledValue,
              amountScale: parseInt(tinkTx.amount.value.scale) || 0,
              currencyCode: tinkTx.amount.currencyCode,
              bookedDate: tinkTx.dates.booked,
              valueDate:
                tinkTx.dates.value || tinkTx.dates.booked,
              status: tinkTx.status,
              originalStatus: tinkTx.status, // Store original status for new transactions
              statusLastUpdated: new Date(), // Always update status timestamp
              displayDescription: (
                tinkTx.descriptions.display ?? ""
              ).substring(0, 500),
              originalDescription: (
                tinkTx.descriptions.original ?? ""
              ).substring(0, 500),
              providerTransactionId:
                tinkTx.identifiers?.providerTransactionId?.substring(
                  0,
                  255
                ),
              merchantName:
                tinkTx.merchantInformation?.merchantName?.substring(
                  0,
                  255
                ),
              merchantCategoryCode:
                tinkTx.merchantInformation?.merchantCategoryCode?.substring(
                  0,
                  10
                ),

              // Original Tink categories (preserved)
              categoryId: tinkTx.categories?.pfm?.id?.substring(0, 255),
              categoryName: tinkTx.categories?.pfm?.name?.substring(
                0,
                255
              ),

              // Simplified AI categorization
              mainCategory: categorization.mainCategory,
              subCategory: categorization.subCategory,
              userModified: categorization.userModified,

              transactionType: tinkTx.types?.type?.substring(0, 50),
              financialInstitutionTypeCode:
                tinkTx.types?.financialInstitutionTypeCode?.substring(
                  0,
                  10
                ),
              reference: tinkTx.reference?.substring(0, 255),
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

                // AI categorization fields
                mainCategory: sql`EXCLUDED.main_category`,
                subCategory: sql`EXCLUDED.sub_category`,
                userModified: sql`EXCLUDED.user_modified`,

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

          console.log(
            `Batch processed: ${batchCreated} created, ${batchUpdated} updated`
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
