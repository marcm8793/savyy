import { z } from "zod/v4";
import { router, protectedProcedure } from "../trpc";
import { tinkService } from "../services/tinkService";
import { TransactionSyncService } from "../services/transactionSyncService";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { bankAccount } from "../../db/schema";
import { tokenService } from "../services/tokenService";
import { userService } from "../services/userService";
import { createSelectSchema } from "drizzle-zod";
import { AccountsAndBalancesService } from "../services/accountsAndBalancesService";

const bankAccountSchema = createSelectSchema(bankAccount, {
  balance: (schema) =>
    schema.transform((val) => {
      if (val === null || val === undefined) {
        return null;
      }
      const parsed = typeof val === "string" ? Number(val) : val; // `Number` rejects "Infinity"
      if (!Number.isFinite(parsed)) {
        return null; // Reject Infinity / -Infinity
      }
      return parsed;
    }),
});

export const accountRouter = router({
  // * Get bank accounts for authenticated user from db
  getAccountsFromDb: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .output(z.array(bankAccountSchema))
    .query(async ({ ctx, input }) => {
      try {
        const accounts =
          await new AccountsAndBalancesService().getAccountsFromDb(
            ctx.db,
            ctx.user.id,
            {
              limit: input.limit,
              offset: input.offset,
            }
          );

        ctx.req.server.log.debug(
          {
            userId: ctx.user.id,
            count: accounts.length,
            limit: input.limit,
            offset: input.offset,
          },
          "Fetched accounts with pagination"
        );

        return accounts;
      } catch (error) {
        ctx.req.server.log.error({ error }, "Failed to fetch accounts");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch accounts",
          cause: error,
        });
      }
    }),

  // * Get secure Tink connection URL with state parameter
  connectBankAccount: protectedProcedure
    .input(
      z.object({
        market: z.string().default("FR"),
        locale: z.string().default("en_US"),
      })
    )
    .output(
      z.object({
        url: z.url(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id;
        const idHint = ctx.user.name || ctx.user.email || userId;

        // Step 1: Check if we already have tink_user_id, if not create user in Tink
        let storedTinkUserId = await userService.getTinkUserId(ctx.db, userId);

        if (!storedTinkUserId) {
          const clientToken = await tinkService.getClientAccessToken();

          try {
            const tinkUserResponse = await tinkService.createUser(
              clientToken.access_token,
              userId,
              input.market,
              input.locale,
              idHint
            );

            // Store the Tink user ID in our database
            if (tinkUserResponse.user_id) {
              await userService.updateTinkUserId(
                ctx.db,
                userId,
                tinkUserResponse.user_id
              );

              storedTinkUserId = tinkUserResponse.user_id;

              ctx.req.server.log.debug(
                {
                  tinkUserId: tinkUserResponse.user_id,
                  externalUserId: tinkUserResponse.external_user_id,
                },
                "User created successfully in Tink"
              );
            } else {
              ctx.req.server.log.warn(
                {
                  response: tinkUserResponse,
                },
                "Tink user created but no user_id returned"
              );
            }
          } catch (error) {
            // Check if user already exists (this is expected for returning users)
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            if (
              errorMessage.includes("user_with_external_user_id_already_exists")
            ) {
              ctx.req.server.log.debug(
                "User already exists in Tink, continuing with authorization"
              );
              // For existing users, we'll continue without the tink_user_id
              // The authorization should still work with external_user_id
            } else {
              ctx.req.server.log.warn(
                { error },
                "Unexpected error creating user in Tink"
              );
              // Consider whether to throw here or continue
            }
          }
        } else {
          ctx.req.server.log.debug(
            {
              tinkUserId: storedTinkUserId,
            },
            "User already has tink_user_id stored"
          );
        }

        // Step 2: Get authorization grant token
        const authToken = await tinkService.getAuthorizationGrantToken();

        // Generate secure state parameter with HMAC signature
        const state = tokenService.createSecureStateToken(ctx.user.id);

        // Step 3: Grant user access using external_user_id
        const grantResponse = await tinkService.grantUserAccess(
          authToken.access_token,
          {
            tinkUserId: userId, // Use external_user_id (our internal user ID)
            idHint: idHint,
            scope:
              "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read",
          }
        );

        // Build connection URL with state using existing method
        const connectionUrl = tinkService.buildTinkUrlWithAuthorizationCode(
          grantResponse.code,
          {
            market: input.market,
            locale: input.locale,
            state,
          }
        );

        return {
          url: connectionUrl,
          message: "Redirect user to this URL to connect their bank account",
        };
      } catch (error) {
        ctx.req.server.log.error(
          { error },
          "Failed to get secure Tink connection URL"
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate secure connection URL",
          cause: error,
        });
      }
    }),

  // * Sync accounts from Tink using existing services
  syncTinkAccounts: protectedProcedure
    .input(
      z.object({
        code: z.string(),
      })
    )
    .output(
      z.object({
        message: z.string(),
        accounts: z.array(bankAccountSchema),
        count: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Exchange authorization code for user access token using existing method
        const tokenResponse = await tinkService.getUserAccessToken(input.code);

        // Use AccountsAndBalancesService to sync accounts
        const accountsService = new AccountsAndBalancesService();
        const syncResult = await accountsService.syncAccountsAndBalances(
          ctx.db,
          ctx.user.id,
          tokenResponse.access_token,
          tokenResponse.scope,
          tokenResponse.expires_in
        );

        ctx.req.server.log.info(
          {
            userId: ctx.user.id,
            accountCount: syncResult.count,
          },
          "Accounts synced successfully"
        );

        return {
          message:
            "Accounts synchronized successfully. Transactions are being imported in the background.",
          accounts: syncResult.accounts,
          count: syncResult.count,
        };
      } catch (error) {
        ctx.req.server.log.error({ error }, "Failed to sync Tink accounts");

        // Handle specific Tink errors
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("INVALID_STATE_DUPLICATE_CREDENTIALS")) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "These bank credentials are already connected. Please use a different bank account or contact support if you need to reconnect.",
            cause: error,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync accounts",
          cause: error,
        });
      }
    }),

  // * Manual transaction sync for specific account from Tink
  syncAccountTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        dateRangeMonths: z.number().min(1).max(24).default(3),
        includeAllStatuses: z.boolean().default(true),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        transactionsCreated: z.number(),
        transactionsUpdated: z.number(),
        totalTransactionsFetched: z.number(),
        errors: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get the specific bank account and verify it belongs to the user
        const accounts = await ctx.db
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.userId, ctx.user.id),
              eq(bankAccount.tinkAccountId, input.accountId)
            )
          )
          .limit(1);

        if (accounts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account not found",
          });
        }

        const account = accounts[0];

        if (!account.accessToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "No access token available for this account. Please reconnect your bank account.",
          });
        }

        // Check token expiration
        if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Access token has expired. Please reconnect your bank account.",
          });
        }

        const transactionSyncService = new TransactionSyncService();
        const syncResult = await transactionSyncService.syncInitialTransactions(
          ctx.db,
          ctx.user.id,
          input.accountId,
          account.accessToken,
          {
            dateRangeMonths: input.dateRangeMonths,
            includeAllStatuses: input.includeAllStatuses,
          }
        );

        const message = syncResult.success
          ? `Successfully synced ${syncResult.transactionsCreated} new transactions and updated ${syncResult.transactionsUpdated} existing ones.`
          : `Sync completed with errors. ${syncResult.errors.length} errors occurred.`;

        ctx.req.server.log.info(
          {
            userId: ctx.user.id,
            accountId: input.accountId,
            success: syncResult.success,
            transactionsCreated: syncResult.transactionsCreated,
            transactionsUpdated: syncResult.transactionsUpdated,
            errorCount: syncResult.errors.length,
          },
          "Transaction sync completed"
        );

        return {
          success: syncResult.success,
          message,
          transactionsCreated: syncResult.transactionsCreated,
          transactionsUpdated: syncResult.transactionsUpdated,
          totalTransactionsFetched: syncResult.totalTransactionsFetched,
          errors: syncResult.errors,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        ctx.req.server.log.error(
          { error },
          "Failed to sync account transactions"
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync transactions",
          cause: error,
        });
      }
    }),
});
