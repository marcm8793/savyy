import { z } from "zod/v4";
import { router, protectedProcedure } from "../trpc";
import { tinkService } from "../services/tinkService";
import { TransactionSyncService } from "../services/transaction";
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
      const parsed =
        typeof val === "string"
          ? val.trim() === "" // reject empty / whitespace-only strings
            ? NaN
            : Number(val)
          : val;

      if (!Number.isFinite(parsed)) {
        return null; // Reject NaN / ±Infinity
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
              "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read,accounts:read,balances:read,transactions:read,provider-consents:read",
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

  // Reconnect bank account for expired sessions
  reconnectBankAccount: protectedProcedure
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

        // For reconnection, we skip user creation and go straight to authorization
        // This handles the case where the user exists but their session expired

        // Step 1: Get authorization grant token
        const authToken = await tinkService.getAuthorizationGrantToken();

        // Generate secure state parameter with HMAC signature
        const state = tokenService.createSecureStateToken(ctx.user.id);

        // Step 2: Try to grant user access - if this fails, we'll catch and handle it
        try {
          const grantResponse = await tinkService.grantUserAccess(
            authToken.access_token,
            {
              tinkUserId: userId, // Use external_user_id (our internal user ID)
              idHint: idHint,
              scope:
                "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read,accounts:read,balances:read,transactions:read,provider-consents:read",
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
            message:
              "Redirect user to this URL to reconnect their bank account",
          };
        } catch (grantError: unknown) {
          // If grant fails, try creating a new user (session might be completely expired)
          ctx.req.server.log.info(
            "Grant access failed, attempting to recreate user session",
            { error: grantError }
          );

          const clientToken = await tinkService.getClientAccessToken();

          try {
            // Try to create user again (this might work if previous session is completely gone)
            await tinkService.createUser(
              clientToken.access_token,
              userId,
              input.market,
              input.locale,
              idHint
            );
          } catch (createError) {
            // User already exists, that's fine, continue
            const createErrorMessage =
              createError instanceof Error
                ? createError.message
                : String(createError);
            if (
              !createErrorMessage.includes(
                "user_with_external_user_id_already_exists"
              )
            ) {
              throw createError; // Re-throw if it's not the "already exists" error
            }
          }

          // Try grant access again after user recreation attempt
          const newGrantResponse = await tinkService.grantUserAccess(
            authToken.access_token,
            {
              tinkUserId: userId,
              idHint: idHint,
              scope:
                "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read,accounts:read,balances:read,transactions:read,provider-consents:read",
            }
          );

          const connectionUrl = tinkService.buildTinkUrlWithAuthorizationCode(
            newGrantResponse.code,
            {
              market: input.market,
              locale: input.locale,
              state,
            }
          );

          return {
            url: connectionUrl,
            message:
              "Redirect user to this URL to reconnect their bank account",
          };
        }
      } catch (error) {
        ctx.req.server.log.error({ error }, "Failed to get reconnect URL");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to generate reconnection URL. Please try again or contact support.",
          cause: error,
        });
      }
    }),

  // * Sync accounts from Tink using existing services with enhanced duplicate detection
  syncTinkAccounts: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        isConsentRefresh: z.boolean().optional().default(false),
        previousCredentialsId: z.string().optional(),
      })
    )
    .output(
      z.object({
        message: z.string(),
        accounts: z.array(bankAccountSchema),
        count: z.number(),
        syncMode: z.enum([
          "new_connection",
          "consent_refresh",
          "token_refresh",
        ]),
        duplicatesSkipped: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Exchange authorization code for user access token using existing method
        const tokenResponse = await tinkService.getUserAccessToken(input.code);

        // Extract credentials ID from the token response or determine it
        // For now, we'll use the previousCredentialsId if this is a consent refresh
        // TODO: Implement proper credentials ID extraction from Tink API
        const credentialsId = input.previousCredentialsId;

        // Use AccountsAndBalancesService with enhanced duplicate detection
        const accountsService = new AccountsAndBalancesService();
        const syncResult = await accountsService.syncAccountsAndBalances(
          ctx.db,
          ctx.user.id,
          tokenResponse.access_token,
          tokenResponse.scope,
          tokenResponse.expires_in,
          credentialsId,
          {
            isConsentRefresh: input.isConsentRefresh,
            previousCredentialsId: input.previousCredentialsId,
            skipDuplicateCheck: false,
          }
        );

        const duplicatesSkipped =
          syncResult.accounts.length < syncResult.count
            ? syncResult.count - syncResult.accounts.length
            : 0;

        ctx.req.server.log.info(
          {
            userId: ctx.user.id,
            accountCount: syncResult.count,
            syncMode: syncResult.syncMode.mode,
            duplicatesSkipped,
            isConsentRefresh: input.isConsentRefresh,
          },
          "Accounts synced successfully with enhanced duplicate detection"
        );

        let message = "Accounts synchronized successfully.";
        if (syncResult.syncMode.mode === "consent_refresh") {
          message =
            "Consent refreshed successfully. Account information has been updated.";
        } else if (duplicatesSkipped > 0) {
          message += ` ${duplicatesSkipped} duplicate accounts were skipped.`;
        }
        message += " Transactions are being imported in the background.";

        return {
          message,
          accounts: syncResult.accounts,
          count: syncResult.count,
          syncMode: syncResult.syncMode.mode,
          duplicatesSkipped,
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
            cause: error instanceof Error ? error : new Error(String(error)),
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync accounts",
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }),

  // * Enhanced consent refresh endpoint for existing connections
  refreshConsent: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        credentialsId: z.string(),
        market: z.string().default("FR"),
        locale: z.string().default("en_US"),
      })
    )
    .output(
      z.object({
        message: z.string(),
        accounts: z.array(bankAccountSchema),
        count: z.number(),
        transactionsToUpdate: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Exchange authorization code for user access token
        const tokenResponse = await tinkService.getUserAccessToken(input.code);

        // Use enhanced sync with consent refresh mode
        const accountsService = new AccountsAndBalancesService();
        const syncResult = await accountsService.syncAccountsAndBalances(
          ctx.db,
          ctx.user.id,
          tokenResponse.access_token,
          tokenResponse.scope,
          tokenResponse.expires_in,
          input.credentialsId,
          {
            isConsentRefresh: true,
            previousCredentialsId: input.credentialsId,
            skipDuplicateCheck: false,
          }
        );

        ctx.req.server.log.info(
          {
            userId: ctx.user.id,
            credentialsId: input.credentialsId,
            accountCount: syncResult.count,
            syncMode: syncResult.syncMode.mode,
          },
          "Consent refresh completed successfully"
        );

        // Estimate transactions that might need updating based on last sync date
        let transactionsToUpdate = 0;
        if (syncResult.syncMode.lastSyncDate) {
          const daysSinceLastSync = Math.ceil(
            (Date.now() - syncResult.syncMode.lastSyncDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          // Rough estimate: 2-5 transactions per day per account
          transactionsToUpdate = syncResult.count * daysSinceLastSync * 3;
        }

        return {
          message:
            "Consent refreshed successfully. Your account information and recent transactions will be updated.",
          accounts: syncResult.accounts,
          count: syncResult.count,
          transactionsToUpdate,
        };
      } catch (error) {
        ctx.req.server.log.error({ error }, "Failed to refresh consent");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to refresh consent",
          cause: error instanceof Error ? error : new Error(String(error)),
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

        // Check token expiration and refresh if needed
        const tokenResult = await tokenService.refreshUserTokenIfNeeded(
          ctx.db,
          ctx.user.id,
          account.tinkAccountId
        );

        if (!tokenResult) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Access token has expired and could not be refreshed. Please reconnect your bank account.",
          });
        }

        // Use the refreshed account
        const refreshedAccount = tokenResult.account;

        const transactionSyncService = new TransactionSyncService();
        const syncResult = await transactionSyncService.syncInitialTransactions(
          ctx.db,
          ctx.user.id,
          input.accountId,
          refreshedAccount.accessToken!,
          {
            dateRangeMonths: input.dateRangeMonths,
            includeAllStatuses: input.includeAllStatuses,
            isConsentRefresh: false, // This is manual sync, not consent refresh
            lastSyncDate: refreshedAccount.lastRefreshed || undefined,
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
