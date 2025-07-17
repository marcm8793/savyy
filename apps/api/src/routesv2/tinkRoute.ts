import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { TokenService } from "../servicesv2/tokenService";
import { redisService } from "../servicesv2/redisService";

// Validation schema for Tink callback query parameters
const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  credentials_id: z.string().optional(),
  client_id: z.string().optional(),
});

const tinkRoute: FastifyPluginAsync = async (fastify) => {
  // Initialize V2 TokenService
  const tokenService = new TokenService();

  // Tink OAuth callback endpoint
  // This endpoint receives the callback from Tink after users complete bank authentication
  fastify.get("/api/tink/callback", async (request, reply) => {
    try {
      // Parse and validate query parameters
      const queryResult = callbackQuerySchema.safeParse(request.query);

      if (!queryResult.success) {
        fastify.log.error(
          { err: queryResult.error },
          "Invalid callback query parameters"
        );
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=invalid_parameters`);
      }

      const { code, state, error, credentials_id, client_id } =
        queryResult.data;

      // Handle OAuth error responses
      if (error) {
        fastify.log.error({ error }, "Tink OAuth error received");
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=oauth_failed`);
      }

      // Validate required parameters
      if (!code) {
        fastify.log.error("Missing authorization code in callback");
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=missing_code`);
      }

      if (!state) {
        fastify.log.error("Missing state parameter in callback");
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=missing_state`);
      }

      // Verify state token using existing token service
      const stateData = tokenService.verifySecureStateToken(state);

      if (!stateData) {
        fastify.log.error("Invalid or expired state token", { state });
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=invalid_state`);
      }

      fastify.log.info("State token verified successfully", {
        userId: stateData.userId,
        timestamp: stateData.timestamp,
        hasCredentialsId: !!credentials_id,
        hasClientId: !!client_id,
      });

      // Check if this authorization code has already been processed
      const isAlreadyProcessed = await redisService.isCodeProcessed(code);
      if (isAlreadyProcessed) {
        fastify.log.info(
          "Authorization code already processed, redirecting to error",
          {
            code: code.substring(0, 8) + "...",
            userId: stateData.userId,
          }
        );
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=already_processed`);
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
          "Authorization code is being processed by another instance, redirecting to error",
          {
            code: code.substring(0, 8) + "...",
            userId: stateData.userId,
          }
        );
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(
          `${clientUrl}/accounts?error=concurrent_processing`
        );
      }

      try {
        // Mark the code as successfully processed
        await redisService.markCodeAsCompleted(code);

        fastify.log.info("Tink callback processed successfully", {
          userId: stateData.userId,
          credentialsId: credentials_id,
          clientId: client_id,
          codePrefix: code.substring(0, 8) + "...",
        });

        // Redirect to frontend with success status
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?connected=true`);
      } catch (processingError) {
        fastify.log.error(
          {
            err:
              processingError instanceof Error
                ? processingError
                : new Error(String(processingError)),
            userId: stateData.userId,
          },
          "Error processing Tink callback"
        );

        // Clear the processing lock on error
        try {
          await redisService.removeFromProcessing(code);
        } catch (clearError) {
          fastify.log.warn(
            {
              err:
                clearError instanceof Error
                  ? clearError
                  : new Error(String(clearError)),
            },
            "Failed to clear processing lock after error"
          );
        }

        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        return reply.redirect(`${clientUrl}/accounts?error=processing_failed`);
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Unexpected error in Tink callback");
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      return reply.redirect(`${clientUrl}/accounts?error=unexpected_error`);
    }
  });
};

export default tinkRoute;
