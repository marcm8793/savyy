import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import { transaction, bankAccount, schema } from "../../db/schema";

import crypto from "crypto";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

// Tink API response types
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

// Validation schemas
const transactionFiltersSchema = z.object({
  accountIdIn: z.array(z.string()).optional(),
  statusIn: z.array(z.enum(["BOOKED", "PENDING", "UNDEFINED"])).optional(),
  bookedDateGte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  bookedDateLte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pageSize: z.number().min(1).max(100).default(50),
  pageToken: z.string().optional(),
});

const webhookPayloadSchema = z.object({
  event: z.string(),
  userId: z.string(),
  credentialsId: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  timestamp: z.number(),
  signature: z.string(),
});

const refreshCredentialsSchema = z.object({
  credentialsId: z.string(),
  force: z.boolean().default(false),
});

const syncTransactionsSchema = z.object({
  accountIds: z.array(z.string()).optional(),
  dateRange: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .optional(),
  force: z.boolean().default(false),
});

// Security: Webhook signature verification
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

// Transaction storage with upsert strategy
async function storeTransactionsWithUpsert(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  tinkTransactions: TinkTransaction[]
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches for better performance
  const BATCH_SIZE = 50;

  for (let i = 0; i < tinkTransactions.length; i += BATCH_SIZE) {
    const batch = tinkTransactions.slice(i, i + BATCH_SIZE);

    try {
      await db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
        for (const tinkTx of batch) {
          try {
            // Get bank account ID from tink account ID
            const bankAccountResult = await tx
              .select({ id: bankAccount.id })
              .from(bankAccount)
              .where(
                and(
                  eq(bankAccount.tinkAccountId, tinkTx.accountId),
                  eq(bankAccount.userId, userId)
                )
              )
              .limit(1);

            if (bankAccountResult.length === 0) {
              console.warn(
                `Bank account not found for tinkAccountId: ${tinkTx.accountId}`
              );
              errors++;
              continue;
            }

            const bankAccountId = bankAccountResult[0].id;

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
              displayDescription: tinkTx.descriptions.display.substring(0, 500),
              originalDescription: tinkTx.descriptions.original.substring(
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
              updatedAt: new Date(),
            };

            if (existing.length > 0) {
              // Update existing transaction
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
            console.error(`Error processing transaction ${tinkTx.id}:`, error);
            errors++;
          }
        }
      });
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      errors += batch.length;
    }
  }

  return { created, updated, errors };
}

// Fetch transactions from Tink API with pagination
async function fetchTinkTransactions(
  userAccessToken: string,
  filters: {
    accountIdIn?: string[];
    statusIn?: string[];
    bookedDateGte?: string;
    bookedDateLte?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<TinkTransactionsResponse> {
  const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";

  const params = new URLSearchParams();

  if (filters.accountIdIn) {
    filters.accountIdIn.forEach((id) => params.append("accountIdIn", id));
  }
  if (filters.statusIn) {
    filters.statusIn.forEach((status) => params.append("statusIn", status));
  }
  if (filters.bookedDateGte) {
    params.append("bookedDateGte", filters.bookedDateGte);
  }
  if (filters.bookedDateLte) {
    params.append("bookedDateLte", filters.bookedDateLte);
  }
  if (filters.pageSize) {
    params.append("pageSize", filters.pageSize.toString());
  }
  if (filters.pageToken) {
    params.append("pageToken", filters.pageToken);
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

  return (await response.json()) as TinkTransactionsResponse;
}

// Refresh credentials data
async function refreshCredentialsData(
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
}

export const transactionRouter = router({
  // Get transactions with filtering and pagination
  list: protectedProcedure
    .input(transactionFiltersSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Build where conditions
        const conditions = [eq(transaction.userId, user.id)];

        if (input.accountIdIn && input.accountIdIn.length > 0) {
          conditions.push(
            inArray(transaction.tinkAccountId, input.accountIdIn)
          );
        }

        if (input.bookedDateGte) {
          conditions.push(gte(transaction.bookedDate, input.bookedDateGte));
        }

        if (input.bookedDateLte) {
          conditions.push(lte(transaction.bookedDate, input.bookedDateLte));
        }

        if (input.statusIn && input.statusIn.length > 0) {
          conditions.push(inArray(transaction.status, input.statusIn));
        }

        // Get transactions with pagination
        const transactions = await db
          .select()
          .from(transaction)
          .where(and(...conditions))
          .orderBy(desc(transaction.bookedDate), desc(transaction.createdAt))
          .limit(input.pageSize);

        // Calculate next page token (simplified - in production, use cursor-based pagination)
        const hasMore = transactions.length === input.pageSize;
        const nextPageToken = hasMore
          ? Buffer.from(
              JSON.stringify({
                lastId: transactions[transactions.length - 1].id,
                pageSize: input.pageSize,
              })
            ).toString("base64")
          : undefined;

        return {
          transactions,
          nextPageToken,
          count: transactions.length,
        };
      } catch (error) {
        console.error("Error fetching transactions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch transactions",
        });
      }
    }),

  // Get single transaction by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        const result = await db
          .select()
          .from(transaction)
          .where(
            and(
              eq(transaction.tinkTransactionId, input.id),
              eq(transaction.userId, user.id)
            )
          )
          .limit(1);

        if (result.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }

        return result[0];
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Error fetching transaction:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch transaction",
        });
      }
    }),

  // Sync transactions from Tink API (manual refresh)
  sync: protectedProcedure
    .input(syncTransactionsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Get user's bank accounts with access tokens
        const userAccounts = await db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.userId, user.id));

        if (userAccounts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "No bank accounts found. Please connect a bank account first.",
          });
        }

        // Filter accounts if specific ones requested
        const accountsToSync = input.accountIds
          ? userAccounts.filter((acc) =>
              input.accountIds!.includes(acc.tinkAccountId)
            )
          : userAccounts;

        if (accountsToSync.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No matching accounts found",
          });
        }

        let totalCreated = 0;
        let totalUpdated = 0;
        let totalErrors = 0;

        // Process each account
        for (const account of accountsToSync) {
          try {
            if (!account.accessToken) {
              console.warn(
                `No access token for account ${account.tinkAccountId}`
              );
              totalErrors++;
              continue;
            }

            // Check token expiration
            if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
              console.warn(
                `Access token expired for account ${account.tinkAccountId}`
              );
              totalErrors++;
              continue;
            }

            // Set up date range (default to last year)
            const dateRange = input.dateRange || {
              from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              to: new Date().toISOString().split("T")[0],
            };

            // Fetch all transactions with pagination
            const allTransactions: TinkTransaction[] = [];
            let nextPageToken: string | undefined;

            do {
              const response = await fetchTinkTransactions(
                account.accessToken,
                {
                  accountIdIn: [account.tinkAccountId],
                  statusIn: ["BOOKED", "PENDING", "UNDEFINED"],
                  bookedDateGte: dateRange.from,
                  bookedDateLte: dateRange.to,
                  pageSize: 100,
                  pageToken: nextPageToken,
                }
              );

              allTransactions.push(...response.transactions);
              nextPageToken = response.nextPageToken;
            } while (nextPageToken);

            // Store transactions with upsert strategy
            const result = await storeTransactionsWithUpsert(
              db,
              user.id,
              allTransactions
            );

            totalCreated += result.created;
            totalUpdated += result.updated;
            totalErrors += result.errors;

            // Update account's last refreshed timestamp
            await db
              .update(bankAccount)
              .set({
                lastRefreshed: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(bankAccount.id, account.id));
          } catch (error) {
            console.error(
              `Error syncing account ${account.tinkAccountId}:`,
              error
            );
            totalErrors++;
          }
        }

        return {
          success: true,
          accountsSynced: accountsToSync.length,
          transactionsCreated: totalCreated,
          transactionsUpdated: totalUpdated,
          errors: totalErrors,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Error syncing transactions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync transactions",
        });
      }
    }),

  // Refresh credentials (trigger Tink to fetch fresh data)
  refreshCredentials: protectedProcedure
    .input(refreshCredentialsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Get user's bank account with the credentials
        const account = await db
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.userId, user.id),
              eq(bankAccount.tinkAccountId, input.credentialsId)
            )
          )
          .limit(1);

        if (account.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account not found",
          });
        }

        const bankAcc = account[0];

        if (!bankAcc.accessToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No access token available for this account",
          });
        }

        // Check token expiration
        if (bankAcc.tokenExpiresAt && bankAcc.tokenExpiresAt < new Date()) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Access token has expired. Please reconnect your bank account.",
          });
        }

        // Trigger refresh at Tink
        await refreshCredentialsData(input.credentialsId, bankAcc.accessToken);

        return {
          success: true,
          message:
            "Credentials refresh initiated. Data will be updated shortly.",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          console.error("Error refreshing credentials:", error);
          throw error;
        }

        console.error("Error refreshing credentials:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to refresh credentials",
        });
      }
    }),

  // Webhook endpoint for Tink notifications
  webhook: publicProcedure
    .input(webhookPayloadSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const webhookSecret = process.env.TINK_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Webhook secret not configured",
          });
        }

        // Verify webhook signature for security
        const payload = JSON.stringify(input);
        if (!verifyWebhookSignature(payload, input.signature, webhookSecret)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid webhook signature",
          });
        }

        // Check timestamp to prevent replay attacks (5 minute window)
        const now = Date.now();
        const webhookTime = input.timestamp;
        if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Webhook timestamp too old",
          });
        }

        const { db } = ctx;

        // Handle different webhook events
        switch (input.event) {
          case "credentials.update":
          case "accounts.update":
          case "transactions.update": {
            // Find user by external ID
            const userResult = await db
              .select()
              .from(bankAccount)
              .where(eq(bankAccount.userId, input.userId))
              .limit(1);

            if (userResult.length === 0) {
              console.warn(`User not found for webhook: ${input.userId}`);
              return {
                success: true,
                message: "User not found, ignoring webhook",
              };
            }

            // Trigger automatic sync for affected accounts
            if (input.accountIds && input.accountIds.length > 0) {
              // This would typically be handled by a background job
              // For now, we'll just log it
              console.log(
                `Webhook received for accounts: ${input.accountIds.join(", ")}`
              );

              // In production, you might want to:
              // 1. Queue a background job to sync these accounts
              // 2. Send a real-time notification to the user
              // 3. Update account status in database
            }
            break;
          }

          default:
            console.log(`Unhandled webhook event: ${input.event}`);
        }

        return {
          success: true,
          message: "Webhook processed successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Error processing webhook:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process webhook",
        });
      }
    }),

  // Get transaction statistics
  stats: protectedProcedure
    .input(
      z.object({
        accountIds: z.array(z.string()).optional(),
        dateRange: z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Build where conditions
        const conditions = [eq(transaction.userId, user.id)];

        if (input.accountIds && input.accountIds.length > 0) {
          conditions.push(inArray(transaction.tinkAccountId, input.accountIds));
        }

        if (input.dateRange) {
          conditions.push(gte(transaction.bookedDate, input.dateRange.from));
          conditions.push(lte(transaction.bookedDate, input.dateRange.to));
        }

        // Get basic statistics
        const transactions = await db
          .select({
            amount: transaction.amount,
            amountScale: transaction.amountScale,
            currencyCode: transaction.currencyCode,
            status: transaction.status,
            categoryName: transaction.categoryName,
          })
          .from(transaction)
          .where(and(...conditions));

        // Calculate statistics
        const totalTransactions = transactions.length;
        const totalIncome = transactions
          .filter((t) => parseFloat(t.amount) > 0)
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalExpenses = Math.abs(
          transactions
            .filter((t) => parseFloat(t.amount) < 0)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        // Group by category
        const categoryStats = transactions.reduce((acc, t) => {
          const category = t.categoryName || "Uncategorized";
          if (!acc[category]) {
            acc[category] = { count: 0, amount: 0 };
          }
          acc[category].count++;
          acc[category].amount += parseFloat(t.amount);
          return acc;
        }, {} as Record<string, { count: number; amount: number }>);

        return {
          totalTransactions,
          totalIncome,
          totalExpenses,
          netAmount: totalIncome - totalExpenses,
          categoryBreakdown: categoryStats,
          statusBreakdown: transactions.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };
      } catch (error) {
        console.error("Error calculating transaction stats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate transaction statistics",
        });
      }
    }),
});
