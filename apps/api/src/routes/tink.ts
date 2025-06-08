import { FastifyPluginAsync } from "fastify";
import { tinkService } from "../services/tinkService";
import { authMiddleware } from "../middleware/authMiddleware";

const tinkRoutes: FastifyPluginAsync = async (fastify) => {
  // Tink OAuth callback endpoint
  fastify.get("/api/tink/callback", async (request, reply) => {
    try {
      const { code, state, error } = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };

      if (error) {
        fastify.log.error("Tink OAuth error:", error);
        return reply
          .status(400)
          .send({ error: "OAuth authorization failed", details: error });
      }

      if (!code) {
        return reply.status(400).send({ error: "Missing authorization code" });
      }

      // Handle state parameter to get user ID and sync accounts
      if (state) {
        const stateData = tinkService.parseStateToken(state);
        if (stateData?.userId) {
          fastify.log.info("Decoded state parameter", {
            userId: stateData.userId,
          });

          try {
            const syncResult = await tinkService.syncUserAccounts(
              fastify.db,
              stateData.userId,
              code
            );

            fastify.log.info("Accounts synced successfully", {
              userId: stateData.userId,
              accountCount: syncResult.count,
            });
          } catch (syncError) {
            fastify.log.error("Failed to sync accounts", {
              userId: stateData.userId,
              error: syncError,
            });
          }
        }
      } else {
        // If no state parameter, just exchange the code to validate it
        fastify.log.info("No state parameter, validating code");
        await tinkService.exchangeCodeForToken(code);
        fastify.log.info("Code validation successful");
      }

      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      return reply.redirect(`${clientUrl}/accounts?connected=true`);
    } catch (error) {
      fastify.log.error("Error in Tink callback:", error);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      return reply.redirect(`${clientUrl}/accounts?error=connection_failed`);
    }
  });

  // Endpoint to get Tink connection URL
  fastify.get("/api/tink/connect-url", async (request, reply) => {
    try {
      const { market = "FR", locale = "en_US" } = request.query as {
        market?: string;
        locale?: string;
      };

      const connectionUrl = tinkService.getTinkConnectionUrl(market, locale);

      return reply.send({
        url: connectionUrl,
        message: "Redirect user to this URL to connect their bank account",
      });
    } catch (error) {
      fastify.log.error("Error generating Tink connection URL:", error);
      return reply
        .status(500)
        .send({ error: "Failed to generate connection URL" });
    }
  });

  // Protected endpoint to initiate Tink connection for authenticated user
  fastify.register(async function protectedTinkInitRoutes(fastify) {
    await fastify.register(authMiddleware);

    fastify.post("/api/tink/connect", async (request, reply) => {
      try {
        const { market = "FR", locale = "en_US" } = request.body as {
          market?: string;
          locale?: string;
        };

        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "User not authenticated" });
        }

        // Generate state parameter with user ID for security
        const state = tinkService.generateStateToken(user.id);

        const connectionUrl = tinkService.getTinkConnectionUrlWithState(
          market,
          locale,
          state
        );

        return reply.send({
          url: connectionUrl,
          message: "Redirect user to this URL to connect their bank account",
        });
      } catch (error) {
        fastify.log.error("Error generating Tink connection URL:", error);
        return reply
          .status(500)
          .send({ error: "Failed to generate connection URL" });
      }
    });
  });

  // Protected endpoint to sync accounts for authenticated user
  fastify.register(async function protectedTinkRoutes(fastify) {
    await fastify.register(authMiddleware);

    fastify.post("/api/tink/sync-accounts", async (request, reply) => {
      try {
        const { code } = request.body as { code: string };

        if (!code) {
          return reply
            .status(400)
            .send({ error: "Missing authorization code" });
        }

        // Get user from authentication middleware
        const user = request.user;
        if (!user) {
          return reply.status(401).send({ error: "User not authenticated" });
        }

        // Sync user accounts using the consolidated method
        const syncResult = await tinkService.syncUserAccounts(
          fastify.db,
          user.id,
          code
        );

        return reply.send({
          message: "Accounts synchronized successfully",
          accounts: syncResult.accounts,
          count: syncResult.count,
        });
      } catch (error) {
        fastify.log.error("Error syncing Tink accounts:", error);
        return reply.status(500).send({
          error: "Failed to sync accounts",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  });
};

export default tinkRoutes;
