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

      fastify.log.info("Attempting to exchange code for token", { code });

      // Exchange code for access token
      const tokenResponse = await tinkService.exchangeCodeForToken(code);

      fastify.log.info("Successfully exchanged code for token", {
        hasAccessToken: !!tokenResponse.access_token,
        expiresIn: tokenResponse.expires_in,
      });

      // Handle state parameter to get user ID
      let userId: string | null = null;
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, "base64").toString());
          userId = stateData.userId;
          fastify.log.info("Decoded state parameter", { userId });
        } catch (error) {
          fastify.log.warn("Failed to decode state parameter", { state });
        }
      }

      // If we have a user ID, sync accounts automatically
      if (userId) {
        try {
          // Fetch accounts from Tink
          const tinkAccounts = await tinkService.fetchAccounts(
            tokenResponse.access_token
          );

          // Store accounts in database
          const storedAccounts = await tinkService.storeAccounts(
            fastify.db,
            userId,
            tinkAccounts,
            tokenResponse.access_token,
            tokenResponse.scope,
            tokenResponse.expires_in
          );

          fastify.log.info("Accounts synced successfully", {
            userId,
            accountCount: storedAccounts.length,
          });
        } catch (syncError) {
          fastify.log.error("Failed to sync accounts", {
            userId,
            error: syncError,
          });
        }
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
        const state = Buffer.from(
          JSON.stringify({
            userId: user.id,
            timestamp: Date.now(),
          })
        ).toString("base64");

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

        // Exchange code for token
        const tokenResponse = await tinkService.exchangeCodeForToken(code);

        // Fetch accounts from Tink
        const tinkAccounts = await tinkService.fetchAccounts(
          tokenResponse.access_token
        );

        // Store accounts in database
        const storedAccounts = await tinkService.storeAccounts(
          fastify.db,
          user.id,
          tinkAccounts,
          tokenResponse.access_token,
          tokenResponse.scope,
          tokenResponse.expires_in
        );

        return reply.send({
          message: "Accounts synchronized successfully",
          accounts: storedAccounts,
          count: storedAccounts.length,
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
