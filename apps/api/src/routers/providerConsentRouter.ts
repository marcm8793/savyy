import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { bankAccount } from "../../db/schema";
import { tinkService } from "../services/tinkService";
import { tokenService } from "../services/tokenService";

// Validation schemas
const listConsentsSchema = z.object({
  credentialsId: z.string().optional(),
});

const updateConsentSchema = z.object({
  credentialsId: z.string(),
  market: z.string().default("FR"),
  locale: z.string().default("en_US"),
});

const extendConsentSchema = z.object({
  credentialsId: z.string(),
  market: z.string().default("FR"),
  locale: z.string().default("en_US"),
});

export const providerConsentRouter = router({
  // List all provider consents for the authenticated user
  list: protectedProcedure
    .input(listConsentsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Get user's bank accounts to find a valid access token
        const accounts = await db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.userId, user.id))
          .limit(1);

        if (accounts.length === 0) {
          // Return empty result instead of throwing error
          return {
            consents: [],
            count: 0,
            needsReconnection: true,
            message:
              "No bank accounts found. Please connect a bank account first.",
          };
        }

        const account = accounts[0];

        // Check if we have a valid access token
        if (!account.accessToken) {
          return {
            consents: [],
            count: 0,
            needsReconnection: true,
            message:
              "No access token available. Please reconnect your bank account.",
          };
        }

        // Check if the stored token is clearly expired before attempting refresh
        if (
          account.tokenExpiresAt &&
          tokenService.isTokenExpired(account.tokenExpiresAt, 5)
        ) {
          return {
            consents: [],
            count: 0,
            needsReconnection: true,
            message:
              "Access token has expired. Please reconnect your bank account.",
          };
        }

        // Try to refresh token if needed
        const tokenResult = await tokenService.refreshUserTokenIfNeeded(
          db,
          user.id,
          account.tinkAccountId
        );

        if (!tokenResult) {
          return {
            consents: [],
            count: 0,
            needsReconnection: true,
            message:
              "Access token has expired. Please reconnect your bank account.",
          };
        }

        // Check if token has the required scope for provider consents
        const hasConsentScope = tokenResult.account.tokenScope?.includes(
          "provider-consents:read"
        );

        if (!hasConsentScope) {
          // Token doesn't have provider-consents:read scope, return empty result
          return {
            consents: [],
            count: 0,
            needsReconnection: false,
            message:
              "Provider consent information is not available for this connection type.",
          };
        }

        // Fetch provider consents from Tink
        const consentsResponse = await tinkService.listProviderConsents(
          tokenResult.accessToken
        );

        // Filter by specific credentials ID if provided
        let consents = consentsResponse.providerConsents;
        if (input.credentialsId) {
          consents = consents.filter(
            (consent) => consent.credentialsId === input.credentialsId
          );
        }

        // Enhance consents with additional metadata
        const enhancedConsents = consents.map((consent) => ({
          ...consent,
          needsUpdate: tinkService.isConsentUpdateNeeded(consent),
          sessionExpiryDateFormatted: new Date(
            consent.sessionExpiryDate
          ).toISOString(),
          statusUpdatedFormatted: new Date(consent.statusUpdated).toISOString(),
        }));

        return {
          consents: enhancedConsents,
          count: enhancedConsents.length,
          needsReconnection: false,
        };
      } catch (error: unknown) {
        // Handle session expiration gracefully
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error) || "Unknown error";

        if (
          errorMessage.includes("User ID does not exist") ||
          errorMessage.includes("oauth.user_id_does_not_exist") ||
          errorMessage.includes("SESSION_EXPIRED") ||
          errorMessage.includes("AUTHENTICATION_ERROR")
        ) {
          return {
            consents: [],
            count: 0,
            needsReconnection: true,
            message:
              "Your bank session has expired. Please reconnect your bank account.",
          };
        }

        // Handle 403 Forbidden error when token doesn't have required scope
        if (
          errorMessage.includes("403") ||
          errorMessage.includes("Forbidden") ||
          errorMessage.includes(
            "You do not have access to the requested endpoint"
          )
        ) {
          return {
            consents: [],
            count: 0,
            needsReconnection: false,
            message:
              "Provider consent information is not available for this connection type.",
          };
        }

        console.error("Error listing provider consents:", error);

        // Return empty result for other errors too, don't break the UI
        return {
          consents: [],
          count: 0,
          needsReconnection: true,
          message:
            "Unable to check connection status. Please try reconnecting your bank account.",
        };
      }
    }),

  // Get specific consent by credentials ID
  getByCredentialsId: protectedProcedure
    .input(z.object({ credentialsId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { db, user } = ctx;

        // Get user's bank account with the specific credentials ID
        const accounts = await db
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.userId, user.id),
              eq(bankAccount.credentialsId, input.credentialsId)
            )
          )
          .limit(1);

        if (accounts.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account not found for the provided credentials ID",
          });
        }

        const account = accounts[0];

        if (!account.accessToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No access token available for this account",
          });
        }

        // Try to refresh token if needed
        const tokenResult = await tokenService.refreshUserTokenIfNeeded(
          db,
          user.id,
          account.tinkAccountId
        );

        if (!tokenResult) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Access token has expired. Please reconnect your bank account.",
          });
        }

        // Get specific consent
        const consent = await tinkService.getConsentByCredentialsId(
          tokenResult.accessToken,
          input.credentialsId
        );

        if (!consent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Provider consent not found for the provided credentials ID",
          });
        }

        return {
          ...consent,
          needsUpdate: tinkService.isConsentUpdateNeeded(consent),
          sessionExpiryDateFormatted: new Date(
            consent.sessionExpiryDate
          ).toISOString(),
          statusUpdatedFormatted: new Date(consent.statusUpdated).toISOString(),
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Error getting provider consent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get provider consent",
        });
      }
    }),

  // Generate URL for updating a consent
  getUpdateConsentUrl: protectedProcedure
    .input(updateConsentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { user } = ctx;

        // Generate authorization code for the user
        const authToken = await tinkService.getAuthorizationGrantToken();
        const authCodeResponse =
          await tinkService.generateUserAuthorizationCode(
            authToken.access_token,
            {
              tinkUserId: user.id,
              scope:
                "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read",
            }
          );

        // Generate secure state parameter
        const state = tokenService.createSecureStateToken(user.id);

        // Build update consent URL
        const updateUrl = tinkService.buildUpdateConsentUrl(
          authCodeResponse.code,
          input.credentialsId,
          {
            market: input.market,
            locale: input.locale,
            state,
          }
        );

        return {
          url: updateUrl,
          message: "Redirect user to this URL to update their bank consent",
        };
      } catch (error: unknown) {
        console.error("Error generating update consent URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate update consent URL",
        });
      }
    }),

  // Generate URL for extending a consent
  // TODO: refactor significant code duplication with getUpdateConsentUrl.
  getExtendConsentUrl: protectedProcedure
    .input(extendConsentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { user } = ctx;

        // Generate authorization code for the user
        const authToken = await tinkService.getAuthorizationGrantToken();
        const authCodeResponse =
          await tinkService.generateUserAuthorizationCode(
            authToken.access_token,
            {
              tinkUserId: user.id,
              scope:
                "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read",
            }
          );

        // Generate secure state parameter
        const state = tokenService.createSecureStateToken(user.id);

        // Build extend consent URL
        const extendUrl = tinkService.buildExtendConsentUrl(
          authCodeResponse.code,
          input.credentialsId,
          {
            market: input.market,
            locale: input.locale,
            state,
          }
        );

        return {
          url: extendUrl,
          message: "Redirect user to this URL to extend their bank consent",
        };
      } catch (error: unknown) {
        console.error("Error generating extend consent URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate extend consent URL",
        });
      }
    }),
});
