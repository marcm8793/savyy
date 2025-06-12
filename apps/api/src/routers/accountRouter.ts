import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { accountService } from "../services/accountService";
import { tinkService } from "../services/tinkService";
import { AccountsAndBalancesService } from "../services/accountsAndBalancesService";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { bankAccount } from "../../db/schema.js";
import { tokenService } from "../services/tokenService";
import { userService } from "../services/userService";

// Define Zod schemas manually for bank accounts (updated to match database schema)
const bankAccountSchema = z.object({
  id: z.number(),
  userId: z.string(),
  tinkAccountId: z.string(),
  accountName: z.string(),
  accountType: z.string().nullable(),
  financialInstitutionId: z.string().nullable(),
  balance: z
    .string()
    .nullable()
    .transform((val) => (val ? parseFloat(val) : null)),
  currency: z.string().nullable(),
  iban: z.string().nullable(),
  lastRefreshed: z.date().nullable(),
  accessToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  tokenScope: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Define account router with proper schema integration
export const accountRouter = router({
  // Get bank accounts for authenticated user
  getAccounts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .output(z.array(bankAccountSchema))
    .query(async ({ ctx }) => {
      try {
        const accounts = await accountService.getAccounts(ctx.db, ctx.user.id);
        ctx.req.server.log.debug(
          {
            userId: ctx.user.id,
            count: accounts.length,
            accounts: accounts,
          },
          "Fetched accounts"
        );
        return accounts;
      } catch (error) {
        ctx.req.server.log.error("Failed to fetch accounts:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch accounts",
          cause: error,
        });
      }
    }),

  // Check if user has existing accounts and their status
  checkExistingAccounts: protectedProcedure
    .output(
      z.object({
        hasAccounts: z.boolean(),
        accountCount: z.number(),
        needsReconnection: z.boolean(),
        message: z.string(),
      })
    )
    .query(async ({ ctx }) => {
      try {
        const accounts = await accountService.getAccounts(ctx.db, ctx.user.id);
        const hasAccounts = accounts.length > 0;

        // Check if any accounts need token refresh
        const now = new Date();
        const needsReconnection = accounts.some(
          (account) => !account.tokenExpiresAt || account.tokenExpiresAt < now
        );

        let message = "";
        if (!hasAccounts) {
          message =
            "No bank accounts connected. You can connect your first account.";
        } else if (needsReconnection) {
          message = `You have ${accounts.length} account(s) but some connections have expired. Please reconnect.`;
        } else {
          message = `You have ${accounts.length} active account(s) connected.`;
        }

        return {
          hasAccounts,
          accountCount: accounts.length,
          needsReconnection,
          message,
        };
      } catch (error) {
        ctx.req.server.log.error("Failed to check existing accounts:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check account status",
          cause: error,
        });
      }
    }),

  // Remove existing bank accounts to allow reconnection
  removeAllAccounts: protectedProcedure
    .output(
      z.object({
        message: z.string(),
        removedCount: z.number(),
      })
    )
    .mutation(async ({ ctx }) => {
      try {
        // Delete all accounts for this user from our database
        const result = await ctx.db
          .delete(bankAccount)
          .where(eq(bankAccount.userId, ctx.user.id))
          .returning();

        const removedCount = Array.isArray(result) ? result.length : 0;

        ctx.req.server.log.info("Removed all accounts for user:", {
          userId: ctx.user.id,
          removedCount,
        });

        return {
          message: `Successfully removed ${removedCount} account(s). You can now connect your bank account again.`,
          removedCount,
        };
      } catch (error) {
        ctx.req.server.log.error("Failed to remove accounts:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove accounts",
          cause: error,
        });
      }
    }),

  // Get secure Tink connection URL with state parameter
  connectBankAccount: protectedProcedure
    .input(
      z.object({
        market: z.string().default("FR"),
        locale: z.string().default("en_US"),
      })
    )
    .output(
      z.object({
        url: z.string(),
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

              ctx.req.server.log.debug("User created successfully in Tink", {
                tinkUserId: tinkUserResponse.user_id,
                externalUserId: tinkUserResponse.external_user_id,
              });
            } else {
              ctx.req.server.log.warn(
                "Tink user created but no user_id returned",
                {
                  response: tinkUserResponse,
                }
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
                "Unexpected error creating user in Tink:",
                error
              );
            }
          }
        } else {
          ctx.req.server.log.debug("User already has tink_user_id stored", {
            tinkUserId: storedTinkUserId,
          });
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
          "Failed to get secure Tink connection URL:",
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate secure connection URL",
          cause: error,
        });
      }
    }),

  // Sync accounts from Tink using existing services
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

        ctx.req.server.log.info("Accounts synced successfully:", {
          userId: ctx.user.id,
          accountCount: syncResult.count,
        });

        return {
          message: "Accounts synchronized successfully",
          accounts: syncResult.accounts,
          count: syncResult.count,
        };
      } catch (error) {
        ctx.req.server.log.error("Failed to sync Tink accounts:", error);

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
});
