import { FastifyPluginAsync } from "fastify";
import { tinkService } from "../services/tinkService";
import { authMiddleware } from "../middleware/authMiddleware";
import { AccountsAndBalancesService } from "../services/accountsAndBalancesService.js";
import { tokenService } from "../services/tokenService";

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

          try {
            // Exchange authorization code for user access token
            const tokenResponse = await tinkService.getUserAccessToken(code);

            // Use AccountsAndBalancesService to sync accounts
            const accountsService = new AccountsAndBalancesService();
            const syncResult = await accountsService.syncAccountsAndBalances(
              fastify.db,
              String(stateData.userId),
              tokenResponse.access_token,
              tokenResponse.scope,
              tokenResponse.expires_in
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
        await tinkService.getUserAccessToken(code);
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
        // TODO:
        //         market and locale are extracted via type-cast but never validated.
        // Senders can post { market: 123, locale: {} } and the code will happily build an invalid URL.

        // Use Fastify’s schema or Zod or other solution to validate the request body market and locale

        const { market = "FR", locale = "en_US" } = request.body as {
          market?: string;
          locale?: string;
        };

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
            idHint: user.name,
          }
        );

        // Build connection URL with state using existing method
        const connectionUrl = tinkService.buildTinkUrlWithAuthorizationCode(
          grantResponse.code,
          { market, locale, state }
        );

        // TODO:
        //         market and locale are extracted via type-cast but never validated.
        // Senders can post { market: 123, locale: {} } and the code will happily build an invalid URL.

        // Use Fastify’s schema or Zod:

        // schema: {
        //   body: z.object({
        //     market: z.string().default("FR"),
        //     locale: z.string().default("en_US")
        //   }).parse

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
