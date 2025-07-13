import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  TinkWebhookService,
  TinkWebhookPayload,
  TinkWebhookContext,
  TinkWebhookContent,
} from "../services/tinkWebhookService";
import { eq, and } from "drizzle-orm";
import { bankAccount, user } from "../../db/schema";

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  const webhookService = new TinkWebhookService();

  // Tink webhook endpoint
  fastify.post("/api/webhook/tink", {
    config: {
      // Parse raw body for signature verification
      rawBody: true,
    },
    handler: async (request, reply) => {
      try {
        const signature = request.headers["x-tink-signature"] as string;
        const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;

        if (!signature) {
          fastify.log.error("Missing X-Tink-Signature header");
          return reply.status(400).send({ error: "Missing signature header" });
        }

        if (!rawBody) {
          fastify.log.error("Missing raw body for signature verification");
          return reply.status(400).send({ error: "Missing request body" });
        }

        const webhookSecret = process.env.TINK_WEBHOOK_SECRET;
        if (!webhookSecret) {
          fastify.log.error("TINK_WEBHOOK_SECRET not configured");
          return reply
            .status(500)
            .send({ error: "Webhook secret not configured" });
        }

        const requestBodyString = rawBody.toString("utf8");

        // Verify webhook signature
        const isValidSignature = webhookService.verifyWebhookSignature(
          signature,
          requestBodyString,
          webhookSecret
        );

        if (!isValidSignature) {
          fastify.log.error("Invalid webhook signature", {
            receivedSignature: signature,
            bodyLength: requestBodyString.length,
            bodyPreview: requestBodyString.substring(0, 200),
            hasWebhookSecret: !!webhookSecret,
            webhookSecretLength: webhookSecret?.length,
          });
          return reply.status(401).send({ error: "Invalid signature" });
        }

        // Parse webhook payload
        const webhookPayload =
          webhookService.parseWebhookPayload(requestBodyString);

        fastify.log.info("Received Tink webhook", {
          event: webhookPayload.event,
          userId: webhookPayload.context.userId,
          externalUserId: webhookPayload.context.externalUserId,
        });

        // Process webhook event
        await processWebhookEvent(fastify, webhookPayload);

        return reply.status(200).send({ success: true });
      } catch (error) {
        fastify.log.error("Error processing Tink webhook:", error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  });

  // Webhook setup endpoint (for development/admin use)
  fastify.post("/api/webhook/tink/setup", {
    handler: async (request, reply) => {
      try {
        const { webhookUrl } = request.body as { webhookUrl: string };

        if (!webhookUrl) {
          return reply.status(400).send({ error: "webhookUrl is required" });
        }

        const webhookResponse = await webhookService.createWebhookEndpoint(
          webhookUrl
        );

        // Store the webhook secret securely
        fastify.log.info("Webhook endpoint created", {
          id: webhookResponse.id,
          url: webhookResponse.url,
          enabledEvents: webhookResponse.enabledEvents,
        });

        return reply.status(201).send({
          success: true,
          webhookId: webhookResponse.id,
          secret: webhookResponse.secret, // Return secret only once
          enabledEvents: webhookResponse.enabledEvents,
        });
      } catch (error) {
        fastify.log.error("Error setting up webhook:", error);
        return reply.status(500).send({
          error: "Failed to setup webhook",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });

  /**
   * Process different types of Tink webhook events
   */
  async function processWebhookEvent(
    fastify: FastifyInstance,
    payload: TinkWebhookPayload
  ) {
    const { event, context, content } = payload;

    switch (event) {
      case "refresh:finished":
        await handleRefreshFinished(fastify, context, content);
        break;

      case "account-transactions:modified":
      case "account-booked-transactions:modified":
        await handleTransactionsModified(fastify, context, content);
        break;

      case "account-transactions:deleted":
        await handleTransactionsDeleted(fastify, context, content);
        break;

      case "account:created":
      case "account:updated":
        await handleAccountUpdated(fastify, context, content);
        break;

      default:
        fastify.log.info(`Unhandled webhook event: ${event as string}`);
    }
  }

  /**
   * Handle refresh:finished event
   */
  async function handleRefreshFinished(
    fastify: FastifyInstance,
    context: TinkWebhookContext,
    content: TinkWebhookContent
  ) {
    fastify.log.info("Processing refresh:finished event", {
      credentialsId: content.credentialsId,
      status: content.credentialsStatus,
      source: content.source,
      sessionExpiryDate: content.sessionExpiryDate,
    });

    // If refresh was successful, update consent expiry data
    if (content.credentialsStatus === "UPDATED") {
      // Find user by external user ID
      const externalUserId = context.externalUserId;
      if (externalUserId) {
        try {
          const userResult = await fastify.db
            .select()
            .from(user)
            .where(eq(user.id, externalUserId))
            .limit(1);

          if (userResult.length > 0) {
            const userId = userResult[0].id;

            // Get user's bank accounts with matching credentialsId
            const bankAccounts = await fastify.db
              .select()
              .from(bankAccount)
              .where(
                and(
                  eq(bankAccount.userId, userId),
                  eq(bankAccount.credentialsId, content.credentialsId || "")
                )
              );

            // Update consent expiry date if provided in webhook
            if (content.sessionExpiryDate && bankAccounts.length > 0) {
              const consentExpiryDate = new Date(content.sessionExpiryDate);
              
              // Update all accounts with this credentialsId
              for (const account of bankAccounts) {
                try {
                  await fastify.db
                    .update(bankAccount)
                    .set({
                      consentExpiresAt: consentExpiryDate,
                      consentStatus: "ACTIVE", // Mark as active since refresh was successful
                      updatedAt: new Date(),
                    })
                    .where(eq(bankAccount.id, account.id));

                  fastify.log.info("Updated consent expiry for account", {
                    accountId: account.id,
                    accountName: account.accountName,
                    consentExpiryDate: consentExpiryDate.toISOString(),
                  });
                } catch (error) {
                  fastify.log.error("Failed to update consent expiry for account", {
                    error,
                    accountId: account.id,
                  });
                }
              }
            }

            // Sync transactions for all accounts (background process)
            setImmediate(() => {
              void (async () => {
                for (const account of bankAccounts) {
                  try {
                    // Check if we have a valid access token and refresh if needed
                    const { tokenService } = await import(
                      "../services/tokenService.js"
                    );
                    const tokenResult = await tokenService.refreshUserTokenIfNeeded(
                      fastify.db,
                      userId,
                      account.tinkAccountId
                    );

                    if (tokenResult) {
                      // Use the refreshed token for sync
                      const refreshedAccount = tokenResult.account;

                      fastify.log.info(
                        "Starting webhook-triggered transaction sync after refresh",
                        {
                          accountId: account.tinkAccountId,
                          userId,
                          credentialsId: content.credentialsId,
                        }
                      );

                      // Import transaction sync service
                      const { TransactionSyncService } = await import(
                        "../services/transaction/transactionSyncService.js"
                      );
                      const syncService = new TransactionSyncService();

                      // Calculate date range for incremental sync (last 30 days to catch any updates)
                      const thirtyDaysAgo = new Date();
                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                      
                      const dateRange = {
                        from: thirtyDaysAgo.toISOString().split("T")[0],
                        to: new Date().toISOString().split("T")[0],
                      };

                      // Sync transactions for the account
                      const syncResult =
                        await syncService.syncTransactionsForDateRange(
                          fastify.db,
                          userId,
                          account.tinkAccountId,
                          refreshedAccount.accessToken!,
                          dateRange
                        );

                      fastify.log.info(
                        "Webhook-triggered transaction sync completed after refresh",
                        {
                          accountId: account.tinkAccountId,
                          created: syncResult.transactionsCreated,
                          updated: syncResult.transactionsUpdated,
                          errors: syncResult.errors.length,
                          totalFetched: syncResult.totalTransactionsFetched,
                        }
                      );
                    } else {
                      fastify.log.warn(
                        "Cannot sync transactions after refresh - access token expired and could not be refreshed",
                        {
                          accountId: account.tinkAccountId,
                          userId,
                          hasToken: !!account.accessToken,
                          tokenExpired: account.tokenExpiresAt
                            ? account.tokenExpiresAt <= new Date()
                            : true,
                        }
                      );
                    }
                  } catch (error) {
                    fastify.log.error(
                      "Error syncing transactions after refresh",
                      {
                        error,
                        accountId: account.tinkAccountId,
                        userId,
                        credentialsId: content.credentialsId,
                      }
                    );
                  }
                }
              })();
            });
          }
        } catch (error) {
          fastify.log.error("Error processing refresh:finished webhook", error);
        }
      }
    } else {
      fastify.log.warn("Refresh failed", {
        status: content.credentialsStatus,
        detailedError: content.detailedError,
      });
    }
  }

  /**
   * Handle account-transactions:modified event
   */
  async function handleTransactionsModified(
    fastify: FastifyInstance,
    context: TinkWebhookContext,
    content: TinkWebhookContent
  ) {
    fastify.log.info("Processing transactions modified event", {
      accountId: content.account?.id,
      inserted: content.transactions?.inserted,
      updated: content.transactions?.updated,
      deleted: content.transactions?.deleted,
      dateRange: {
        earliest: content.transactions?.earliestModifiedBookedDate,
        latest: content.transactions?.latestModifiedBookedDate,
      },
    });

    // Find user and account
    const externalUserId = context.externalUserId;
    const accountId = content.account?.id;

    if (externalUserId && accountId) {
      try {
        const userResult = await fastify.db
          .select()
          .from(user)
          .where(eq(user.id, externalUserId))
          .limit(1);

        if (userResult.length > 0) {
          const userId = userResult[0].id;

          // Check if we have this account in our database
          const accountResult = await fastify.db
            .select()
            .from(bankAccount)
            .where(
              and(
                eq(bankAccount.userId, userId),
                eq(bankAccount.tinkAccountId, accountId)
              )
            )
            .limit(1);

          if (accountResult.length > 0) {
            const account = accountResult[0];

            // Check if we have a valid access token and refresh if needed
            const { tokenService } = await import(
              "../services/tokenService.js"
            );
            const tokenResult = await tokenService.refreshUserTokenIfNeeded(
              fastify.db,
              userId,
              account.tinkAccountId
            );

            if (tokenResult) {
              // Use the refreshed token for sync
              const refreshedAccount = tokenResult.account;

              // Trigger transaction sync for this specific account in the background
              setImmediate(() => {
                void (async () => {
                  try {
                    const { TransactionSyncService } = await import(
                      "../services/transaction/transactionSyncService.js"
                    );
                    const syncService = new TransactionSyncService();

                    // Calculate date range for sync based on webhook content
                    const dateRange = {
                      from:
                        content.transactions?.earliestModifiedBookedDate ||
                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split("T")[0], // Last 7 days
                      to:
                        content.transactions?.latestModifiedBookedDate ||
                        new Date().toISOString().split("T")[0], // Today
                    };

                    fastify.log.info(
                      "Starting webhook-triggered transaction sync",
                      {
                        accountId,
                        userId,
                        dateRange,
                      }
                    );

                    // Sync transactions for the specific date range
                    const syncResult =
                      await syncService.syncTransactionsForDateRange(
                        fastify.db,
                        userId,
                        accountId,
                        refreshedAccount.accessToken!,
                        dateRange
                      );

                    fastify.log.info(
                      "Webhook-triggered transaction sync completed",
                      {
                        accountId,
                        created: syncResult.transactionsCreated,
                        updated: syncResult.transactionsUpdated,
                        errors: syncResult.errors.length,
                        totalFetched: syncResult.totalTransactionsFetched,
                      }
                    );
                  } catch (error) {
                    fastify.log.error(
                      "Error in webhook-triggered transaction sync",
                      {
                        error,
                        accountId,
                        userId,
                      }
                    );
                  }
                })();
              });
            } else {
              fastify.log.warn(
                "Cannot sync transactions - access token expired and could not be refreshed. User needs to reconnect bank account.",
                {
                  accountId,
                  userId,
                  hasToken: !!account.accessToken,
                  tokenExpired: account.tokenExpiresAt
                    ? account.tokenExpiresAt <= new Date()
                    : true,
                }
              );
            }
          }
        }
      } catch (error) {
        fastify.log.error(
          "Error processing transactions modified webhook",
          error
        );
      }
    }
  }

  /**
   * Handle account-transactions:deleted event
   */
  async function handleTransactionsDeleted(
    fastify: FastifyInstance,
    context: TinkWebhookContext,
    content: TinkWebhookContent
  ) {
    fastify.log.info("Processing transactions deleted event", {
      accountId: content.account?.id,
      deletedTransactionIds: content.transactions?.ids,
    });

    // Handle deleted transactions
    const deletedIds = content.transactions?.ids;
    if (deletedIds && deletedIds.length > 0) {
      try {
        // TODO: You would implement transaction deletion logic here
        // For example, soft delete or remove from database
        fastify.log.info("Would delete transactions", {
          transactionIds: deletedIds,
        });
      } catch (error) {
        fastify.log.error("Error processing deleted transactions", error);
      }
    }
  }

  /**
   * Handle account created/updated event
   */
  async function handleAccountUpdated(
    fastify: FastifyInstance,
    context: TinkWebhookContext,
    _content: TinkWebhookContent
  ) {
    fastify.log.info("Processing account updated event", {
      userId: context.userId,
      externalUserId: context.externalUserId,
    });

    // Trigger account sync
    // This would typically refresh account information and balances
  }
};

export default webhookRoutes;
