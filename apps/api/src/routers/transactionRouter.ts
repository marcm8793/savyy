import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { transaction, bankAccount, schema } from "../../db/schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tinkService } from "../services/tinkService";
import { TinkWebhookService } from "../services/tinkWebhookService";
import { tokenService } from "../services/tokenService";

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

const webhookSetupSchema = z.object({
  webhookUrl: z.string().url(),
  description: z.string().optional(),
  enabledEvents: z.array(z.string()).optional(),
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

// Note: Webhook signature verification moved to TinkWebhookService

// Transaction storage with bulk upsert strategy to eliminate N+1 queries
async function storeTransactionsWithUpsert(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  tinkTransactions: TinkTransaction[]
): Promise<{ created: number; updated: number; errors: number }> {
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Process in batches for better performance
  const BATCH_SIZE = 50;

  for (let i = 0; i < tinkTransactions.length; i += BATCH_SIZE) {
    const batch = tinkTransactions.slice(i, i + BATCH_SIZE);

    try {
      await db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
        // First, get all bank account IDs for this batch in a single query
        const accountIds = [...new Set(batch.map((tx) => tx.accountId))];
        const bankAccountMap = new Map<string, string>();

        const bankAccounts = await tx
          .select({
            tinkAccountId: bankAccount.tinkAccountId,
            id: bankAccount.id,
          })
          .from(bankAccount)
          .where(
            and(
              inArray(bankAccount.tinkAccountId, accountIds),
              eq(bankAccount.userId, userId)
            )
          );

        bankAccounts.forEach((acc) => {
          bankAccountMap.set(acc.tinkAccountId, acc.id);
        });

        // Prepare batch data for bulk upsert, filtering out transactions without bank accounts
        const batchData = batch
          .map((tinkTx) => {
            const bankAccountId = bankAccountMap.get(tinkTx.accountId);
            if (!bankAccountId) {
              console.warn(
                `Bank account not found for tinkAccountId: ${tinkTx.accountId}`
              );
              totalErrors++;
              return null;
            }

            return {
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
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (batchData.length === 0) {
          return; // Skip if no valid transactions in this batch
        }

        // Bulk upsert using ON CONFLICT - single query for entire batch
        const result = await tx
          .insert(transaction)
          .values(batchData)
          .onConflictDoUpdate({
            target: transaction.tinkTransactionId,
            set: {
              status: sql`EXCLUDED.status`,
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
      console.error(`Error processing batch starting at index ${i}:`, error);
      totalErrors += batch.length;
    }
  }

  return { created: totalCreated, updated: totalUpdated, errors: totalErrors };
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

// Refresh credentials data by generating a fresh user token with credentials:refresh scope
async function refreshCredentialsData(
  credentialsId: string,
  userId: string
): Promise<void> {
  console.log(
    "Generating fresh user access token with credentials:refresh scope"
  );

  // Generate a fresh user access token with credentials:refresh scope
  const freshUserToken = await tinkService.getUserAccessTokenFlow({
    tinkUserId: userId,
    scope:
      "accounts:read,balances:read,transactions:read,credentials:refresh,credentials:read,credentials:write",
  });

  console.log("Fresh user token generated:", {
    credentialsId,
    tokenType: freshUserToken.token_type,
    scope: freshUserToken.scope,
    hasToken: !!freshUserToken.access_token,
    expiresIn: freshUserToken.expires_in,
  });

  // Use the fresh user token for refresh
  const baseUrl = process.env.TINK_API_URL || "https://api.tink.com";

  const response = await fetch(
    `${baseUrl}/api/v1/credentials/${credentialsId}/refresh`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${freshUserToken.access_token}`,
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

  console.log(
    `Credentials ${credentialsId} refreshed successfully with fresh user token`
  );
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
        //  TODO               pageToken parameter never used
        // Clients can pass pageToken, but the query always starts from the top and generates a new token.
        // his causes duplicate pages and prevents forward navigation.
        // Implement seek pagination (e.g. WHERE booked_date < :lastBooked OR (booked_date = :lastBooked AND id < :lastId))
        // or remove the pageToken field for now.
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

            // Check token expiration and refresh if needed
            const tokenResult = await tokenService.refreshUserTokenIfNeeded(
              db,
              user.id,
              account.tinkAccountId
            );

            if (!tokenResult) {
              console.warn(
                `Access token expired and could not be refreshed for account ${account.tinkAccountId}`
              );
              totalErrors++;
              continue;
            }

            // Use the refreshed token
            const refreshedAccount = tokenResult.account;

            // Set up date range (default to last year)
            const dateRange = input.dateRange || {
              from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              to: new Date().toISOString().split("T")[0],
            };

            // Process transactions page-by-page to avoid memory issues
            let nextPageToken: string | undefined;
            let accountCreated = 0;
            let accountUpdated = 0;
            let accountErrors = 0;

            do {
              const response = await fetchTinkTransactions(
                refreshedAccount.accessToken!,
                {
                  accountIdIn: [refreshedAccount.tinkAccountId],
                  statusIn: ["BOOKED", "PENDING", "UNDEFINED"],
                  bookedDateGte: dateRange.from,
                  bookedDateLte: dateRange.to,
                  pageSize: 100,
                  pageToken: nextPageToken,
                }
              );

              // Process this page immediately
              const pageResult = await storeTransactionsWithUpsert(
                db,
                user.id,
                response.transactions
              );

              accountCreated += pageResult.created;
              accountUpdated += pageResult.updated;
              accountErrors += pageResult.errors;

              nextPageToken = response.nextPageToken;
            } while (nextPageToken);

            const result = {
              created: accountCreated,
              updated: accountUpdated,
              errors: accountErrors,
            };

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
              .where(eq(bankAccount.id, refreshedAccount.id));
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

        // Get user's bank account by credentialsId (fixed from previous bug)
        const account = await db
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.userId, user.id),
              eq(bankAccount.credentialsId, input.credentialsId)
            )
          )
          .limit(1);

        if (account.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account not found for the provided credentials ID",
          });
        }

        let bankAcc = account[0];

        if (!bankAcc.credentialsId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "No credentials ID stored for this account. Please reconnect your bank account.",
          });
        }

        if (!bankAcc.accessToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No access token available for this account",
          });
        }

        // Check token expiration and refresh if needed
        const tokenResult = await tokenService.refreshUserTokenIfNeeded(
          db,
          user.id,
          bankAcc.tinkAccountId
        );

        if (!tokenResult) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Your bank connection has expired and needs to be renewed. Please reconnect your bank account to continue accessing your financial data.",
          });
        }

        // Update bankAcc with fresh token
        bankAcc = tokenResult.account;

        // Debug: Log token info before refresh
        console.log("Debug - Token info:", {
          credentialsId: bankAcc.credentialsId,
          hasAccessToken: !!bankAcc.accessToken,
          tokenScope: bankAcc.tokenScope,
          tokenExpiresAt: bankAcc.tokenExpiresAt,
          tokenLength: bankAcc.accessToken?.length,
        });

        // Trigger refresh at Tink using the correct credentialsId and fresh user token
        if (!bankAcc.credentialsId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No credentials ID available after token refresh",
          });
        }
        await refreshCredentialsData(bankAcc.credentialsId, user.id);

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

  // Setup webhook endpoint with Tink (admin function)
  setupWebhook: publicProcedure
    .input(webhookSetupSchema)
    .mutation(async ({ input }) => {
      try {
        const webhookService = new TinkWebhookService();

        const webhookResponse = await webhookService.createWebhookEndpoint(
          input.webhookUrl,
          input.description,
          input.enabledEvents
        );

        return {
          success: true,
          webhookId: webhookResponse.id,
          secret: webhookResponse.secret,
          enabledEvents: webhookResponse.enabledEvents,
          message: "Webhook endpoint created successfully",
        };
      } catch (error) {
        console.error("Error setting up webhook:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to setup webhook",
          cause: error,
        });
      }
    }),

  // Get transaction statistics using SQL aggregates for performance
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

        // Get basic statistics using SQL aggregates (O(1) performance)
        const basicStatsResult = await db
          .select({
            totalTransactions: sql<number>`COUNT(*)::int`,
            totalIncome: sql<number>`
              COALESCE(
                SUM(
                  CASE
                    WHEN (${transaction.amount}::numeric / POWER(10, COALESCE(${transaction.amountScale}, 0))) > 0
                    THEN (${transaction.amount}::numeric / POWER(10, COALESCE(${transaction.amountScale}, 0)))
                    ELSE 0
                  END
                )::numeric,
                0
              )
            `,
            totalExpenses: sql<number>`
              COALESCE(
                ABS(
                  SUM(
                    CASE
                      WHEN (${transaction.amount}::numeric / POWER(10, COALESCE(${transaction.amountScale}, 0))) < 0
                      THEN (${transaction.amount}::numeric / POWER(10, COALESCE(${transaction.amountScale}, 0)))
                      ELSE 0
                    END
                  )
                )::numeric,
                0
              )
            `,
          })
          .from(transaction)
          .where(and(...conditions));

        // Get status breakdown using SQL aggregates
        const statusStatsResult = await db
          .select({
            status: transaction.status,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(transaction)
          .where(and(...conditions))
          .groupBy(transaction.status);

        // Get category breakdown using SQL aggregates
        const categoryStatsResult = await db
          .select({
            categoryName: sql<string>`COALESCE(${transaction.categoryName}, 'Uncategorized')`,
            count: sql<number>`COUNT(*)::int`,
            amount: sql<number>`
              COALESCE(
                SUM(${transaction.amount}::numeric / POWER(10, COALESCE(${transaction.amountScale}, 0)))::numeric,
                0
              )
            `,
          })
          .from(transaction)
          .where(and(...conditions))
          .groupBy(sql`COALESCE(${transaction.categoryName}, 'Uncategorized')`);

        const basicStats = basicStatsResult[0];
        const totalIncome = Number(basicStats.totalIncome);
        const totalExpenses = Number(basicStats.totalExpenses);

        // Transform results into expected format
        const statusBreakdown = statusStatsResult.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {} as Record<string, number>);

        const categoryBreakdown = categoryStatsResult.reduce((acc, row) => {
          acc[row.categoryName] = {
            count: row.count,
            amount: Number(row.amount),
          };
          return acc;
        }, {} as Record<string, { count: number; amount: number }>);

        return {
          totalTransactions: basicStats.totalTransactions,
          totalIncome,
          totalExpenses,
          netAmount: totalIncome - totalExpenses,
          categoryBreakdown,
          statusBreakdown,
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
