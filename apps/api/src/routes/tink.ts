import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { bankAccount } from "../../db/schema";
import { tinkService } from "../services/tinkService";
import { authMiddleware } from "../middleware/authMiddleware";
import { AccountsAndBalancesService } from "../services/accountsAndBalancesService.js";
import { tokenService } from "../services/tokenService";
import { redisService } from "../services/redisService";
import { TransactionSyncService } from "../services/transaction/transactionSyncService";
import { TRANSACTION_SYNC_CONFIG } from "../constants/transactions";

// Validation schemas
const connectQuerySchema = z.object({
  market: z.string().default("FR"),
  locale: z.string().default("en_US"),
});

const connectBodySchema = z.object({
  market: z.string().default("FR"),
  locale: z.string().default("en_US"),
});

const syncAccountsBodySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  credentialsId: z.string().optional(), // camelCase format
  credentials_id: z.string().optional(), // snake_case format that Tink sometimes uses
});

const tinkRoutes: FastifyPluginAsync = async (fastify) => {
  // Tink OAuth callback endpoint
  // URL setup within Tink console
  fastify.get("/api/tink/callback", async (request, reply) => {
    try {
      const queryResult = callbackQuerySchema.safeParse(request.query);

      if (!queryResult.success) {
        fastify.log.error(
          { err: queryResult.error },
          "Invalid callback query parameters"
        );
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=invalid_parameters`);
      }

      const { code, state, error, credentialsId, credentials_id } =
        queryResult.data;

      // Use whichever credentials ID format Tink provided
      const actualCredentialsId = credentialsId || credentials_id;

      if (error) {
        fastify.log.error({ error }, "Tink OAuth error");
        return reply
          .status(400)
          .send({ error: "OAuth authorization failed", details: error });
      }

      if (!code) {
        return reply.status(400).send({ error: "Missing authorization code" });
      }

      // Handle state parameter to get user ID and sync accounts
      if (state) {
        // Verify secure state token
        const stateData = tokenService.verifySecureStateToken(state);

        if (!stateData) {
          fastify.log.error("Invalid or expired state token");
          const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
          return reply.redirect(`${clientUrl}/accounts?error=invalid_state`);
        }

        if (stateData.userId) {
          fastify.log.info("Verified state parameter", {
            userId: stateData.userId,
          });

          // Check if this authorization code has already been processed or is currently being processed
          const isAlreadyProcessed = await redisService.isCodeProcessed(code);
          if (isAlreadyProcessed) {
            fastify.log.info(
              "Authorization code already processed or being processed, redirecting",
              {
                code: code.substring(0, 8) + "...",
              }
            );
            const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
            return reply.redirect(`${clientUrl}/accounts?connected=true`);
          }

          // Mark this code as being processed to prevent race conditions
          let canProcess = false;
          try {
            canProcess = await redisService.markCodeAsProcessing(code);
          } catch (redisError) {
            fastify.log.warn(
              { err: redisError, code: code.substring(0, 8) + "..." },
              "Redis unavailable for markCodeAsProcessing, allowing processing to continue"
            );
            // Fallback: allow processing when Redis is down to avoid permanent lock-out
            canProcess = true;
          }

          if (!canProcess) {
            fastify.log.info(
              "Authorization code is being processed by another instance, redirecting",
              {
                code: code.substring(0, 8) + "...",
              }
            );
            const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
            return reply.redirect(`${clientUrl}/accounts?connected=true`);
          }

          try {
            // Generate user access token with data access scopes
            // The code from the callback only has authorization scopes, so we need to generate
            // a new authorization code with data access scopes and exchange it for a user token
            const tokenResponse = await tinkService.getUserAccessTokenFlow({
              tinkUserId: stateData.userId,
              scope:
                "accounts:read,balances:read,transactions:read,provider-consents:read",
            });

            // For now, we'll let the AccountsAndBalancesService handle consent refresh detection
            // This avoids import issues and centralizes the logic
            fastify.log.info("Processing connection", {
              userId: stateData.userId,
              credentialsId: actualCredentialsId,
              hasCredentialsId: !!actualCredentialsId,
            });

            // Determine if this is a consent refresh by checking if user already has accounts with this credentialsId
            // Only consider it a consent refresh if the user already has existing accounts with the same credentialsId
            let isConsentRefresh = false;
            if (actualCredentialsId) {
              const existingAccounts = await fastify.db
                .select()
                .from(bankAccount)
                .where(
                  and(
                    eq(bankAccount.userId, String(stateData.userId)),
                    eq(bankAccount.credentialsId, actualCredentialsId)
                  )
                )
                .limit(1);

              isConsentRefresh = existingAccounts.length > 0;

              fastify.log.info("Consent refresh detection:", {
                credentialsId: actualCredentialsId,
                existingAccountsFound: existingAccounts.length,
                isConsentRefresh,
              });
            }

            // Use AccountsAndBalancesService with enhanced duplicate detection
            const accountsService = new AccountsAndBalancesService();
            const syncResult = await accountsService.syncAccountsAndBalances(
              fastify.db,
              String(stateData.userId),
              tokenResponse.access_token,
              tokenResponse.scope,
              tokenResponse.expires_in,
              actualCredentialsId as string,
              {
                isConsentRefresh,
                previousCredentialsId: actualCredentialsId as string,
                skipDuplicateCheck: false,
              }
            );

            fastify.log.info("Accounts synced successfully", {
              userId: stateData.userId,
              accountCount: syncResult.count,
            });

            // Mark as processed and remove from processing set
            try {
              await redisService.markCodeAsCompleted(code);
            } catch (redisError) {
              fastify.log.warn(
                { err: redisError, code: code.substring(0, 8) + "..." },
                "Redis unavailable for markCodeAsCompleted, processing completed but cleanup failed"
              );
              // Note: Processing was successful, Redis cleanup failure is non-critical
              // The code will eventually be cleaned up by the cleanup job or TTL
            }

            // Trigger transaction sync in background (don't await)
            setImmediate(() => {
              void (async () => {
                try {
                  const transactionSyncService = new TransactionSyncService();

                  // Sync transactions for each newly connected account
                  const transactionSyncResults = [];
                  for (const account of syncResult.accounts) {
                    try {
                      const transactionSyncResult =
                        await transactionSyncService.syncInitialTransactions(
                          fastify.db,
                          String(stateData.userId),
                          account.tinkAccountId,
                          tokenResponse.access_token,
                          {
                            dateRangeMonths: TRANSACTION_SYNC_CONFIG.DEFAULT_DATE_RANGE_MONTHS, // Fetch last 3 months
                            includeAllStatuses: true, // Include PENDING and UNDEFINED
                            skipCredentialsRefresh: true, // Skip refresh to avoid scope issues
                            isConsentRefresh,
                            lastSyncDate: account.lastRefreshed || undefined,
                          }
                        );
                      transactionSyncResults.push(transactionSyncResult);

                      fastify.log.info("Initial transaction sync completed", {
                        accountId: account.tinkAccountId,
                        created: transactionSyncResult.transactionsCreated,
                        updated: transactionSyncResult.transactionsUpdated,
                        errors: transactionSyncResult.errors.length,
                      });
                    } catch (error) {
                      fastify.log.error(
                        { err: error, accountId: account.tinkAccountId },
                        `Failed to sync transactions for account ${account.tinkAccountId}`
                      );
                    }
                  }

                  const totalTransactionsCreated =
                    transactionSyncResults.reduce(
                      (sum, result) => sum + result.transactionsCreated,
                      0
                    );
                  const totalTransactionsUpdated =
                    transactionSyncResults.reduce(
                      (sum, result) => sum + result.transactionsUpdated,
                      0
                    );

                  fastify.log.info("Background transaction sync completed", {
                    userId: stateData.userId,
                    accountCount: syncResult.count,
                    transactionsCreated: totalTransactionsCreated,
                    transactionsUpdated: totalTransactionsUpdated,
                  });
                } catch (backgroundError) {
                  fastify.log.error(
                    { err: backgroundError, userId: stateData.userId },
                    "Background transaction sync failed"
                  );
                }
              })();
            });
          } catch (syncError) {
            // Remove from processing set on error
            try {
              await redisService.removeFromProcessing(code);
            } catch (redisError) {
              fastify.log.warn(
                { err: redisError, code: code.substring(0, 8) + "..." },
                "Redis unavailable for removeFromProcessing during error cleanup"
              );
              // Note: Cleanup failure is non-critical, the cleanup job will handle it
            }

            fastify.log.error(
              { err: syncError, userId: stateData.userId },
              "Failed to sync accounts"
            );

            // Redirect to error page on sync failure
            const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
            return reply.redirect(`${clientUrl}/accounts?error=sync_failed`);
          }
        }
      } else {
        // If no state parameter, just exchange the code to validate it
        fastify.log.info("No state parameter, validating code");
        await tinkService.getUserAccessToken(code);
        fastify.log.info("Code validation successful");
      }

      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      return reply.redirect(`${clientUrl}/accounts?connected=true`);
    } catch (error) {
      fastify.log.error({ err: error }, "Error in Tink callback");
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      return reply.redirect(`${clientUrl}/accounts?error=connection_failed`);
    }
  });

  // Endpoint to get Tink connection URL
  fastify.get("/api/tink/connect-url", async (request, reply) => {
    try {
      const queryResult = connectQuerySchema.safeParse(request.query);

      if (!queryResult.success) {
        fastify.log.error(
          { err: queryResult.error },
          "Invalid query parameters for connect-url"
        );
        return reply.status(400).send({
          error: "Invalid parameters",
          details: queryResult.error.errors,
        });
      }

      const { market, locale } = queryResult.data;

      // Get authorization grant token and create user access
      const authToken = await tinkService.getAuthorizationGrantToken();
      const grantResponse = await tinkService.grantUserAccess(
        authToken.access_token,
        {
          tinkUserId: `temp_${Date.now()}`,
          idHint: `temp_${Date.now()}`,
        }
      );

      // Build connection URL using existing method
      const connectionUrl = tinkService.buildTinkUrlWithAuthorizationCode(
        grantResponse.code,
        { market, locale }
      );

      return reply.send({
        url: connectionUrl,
        message: "Redirect user to this URL to connect their bank account",
      });
    } catch (error) {
      fastify.log.error({ err: error }, "Error generating Tink connection URL");
      return reply
        .status(500)
        .send({ error: "Failed to generate connection URL" });
    }
  });

  // Protected endpoint to initiate Tink connection for authenticated user
  await fastify.register(async function protectedTinkInitRoutes(fastify) {
    await fastify.register(authMiddleware);

    fastify.post("/api/tink/connect", async (request, reply) => {
      try {
        const bodyResult = connectBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          fastify.log.error(
            { err: bodyResult.error },
            "Invalid request body for tink connect"
          );
          return reply.status(400).send({
            error: "Invalid parameters",
            details: bodyResult.error.errors,
          });
        }

        const { market, locale } = bodyResult.data;

        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "User not authenticated" });
        }

        // Generate secure state parameter with HMAC signature
        const state = tokenService.createSecureStateToken(user.id);

        // Get authorization grant token and create user access
        const authToken = await tinkService.getAuthorizationGrantToken();
        const grantResponse = await tinkService.grantUserAccess(
          authToken.access_token,
          {
            userId: user.id,
            idHint: user.firstName || user.email,
          }
        );

        // Build connection URL with state using existing method
        const connectionUrl = tinkService.buildTinkUrlWithAuthorizationCode(
          grantResponse.code,
          { market, locale, state }
        );

        return reply.send({
          url: connectionUrl,
          message: "Redirect user to this URL to connect their bank account",
        });
      } catch (error) {
        fastify.log.error(
          { err: error },
          "Error generating Tink connection URL"
        );
        return reply
          .status(500)
          .send({ error: "Failed to generate connection URL" });
      }
    });
  });

  // Protected endpoint to sync accounts for authenticated user
  await fastify.register(async function protectedTinkRoutes(fastify) {
    await fastify.register(authMiddleware);

    fastify.post("/api/tink/sync-accounts", async (request, reply) => {
      try {
        const bodyResult = syncAccountsBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          fastify.log.error(
            { err: bodyResult.error },
            "Invalid request body for sync-accounts"
          );
          return reply.status(400).send({
            error: "Invalid parameters",
            details: bodyResult.error.errors,
          });
        }

        const { code } = bodyResult.data;

        // Get user from authentication middleware
        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "User not authenticated" });
        }

        // Exchange authorization code for user access token using existing method
        const tokenResponse = await tinkService.getUserAccessToken(code);

        // Use AccountsAndBalancesService to sync accounts
        const accountsService = new AccountsAndBalancesService();
        const syncResult = await accountsService.syncAccountsAndBalances(
          fastify.db,
          user.id,
          tokenResponse.access_token,
          tokenResponse.scope,
          tokenResponse.expires_in
        );

        return reply.send({
          message: "Accounts synchronized successfully",
          accounts: syncResult.accounts,
          count: syncResult.count,
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error syncing Tink accounts");
        return reply.status(500).send({
          error: "Failed to sync accounts",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  });
};

export default tinkRoutes;
