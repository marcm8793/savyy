import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { BankAccount, bankAccount, schema } from "../../db/schema";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

export class TokenService {
  private readonly STATE_SECRET: string;

  constructor() {
    const secret = process.env.STATE_SECRET;
    if (!secret) {
      throw new Error("STATE_SECRET environment variable is required");
    }
    this.STATE_SECRET = secret;
  }
  private readonly MAX_STATE_AGE = 10 * 60 * 1000; // 10 minutes

  /**
   * Check if a token is expired or will expire soon
   */
  isTokenExpired(expiresAt: Date, bufferMinutes: number = 5): boolean {
    const now = new Date();
    const expiryWithBuffer = new Date(
      expiresAt.getTime() - bufferMinutes * 60 * 1000
    );
    return now >= expiryWithBuffer;
  }

  /**
   * Check if user's Tink session is still valid
   * Returns false immediately for known expired sessions to avoid unnecessary API calls
   */
  async checkTinkSessionValidity(userId: string): Promise<boolean> {
    try {
      // Import TinkService dynamically to avoid circular dependencies
      const { TinkService } = await import("./tinkService.js");
      const tinkService = new TinkService();

      // Try to get authorization grant token and generate user auth code
      const authToken = await tinkService.getAuthorizationGrantToken();
      await tinkService.generateUserAuthorizationCode(authToken.access_token, {
        tinkUserId: userId,
        scope: "provider-consents:read", // Minimal scope for testing
      });

      return true; // If we get here, session is valid
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check for various session expiration indicators
      if (
        errorMessage.includes("User ID does not exist") ||
        errorMessage.includes("oauth.user_id_does_not_exist") ||
        errorMessage.includes("SESSION_EXPIRED") ||
        errorMessage.includes("AUTHENTICATION_ERROR") ||
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        // 🔍 SESSION LIFESPAN LOGGING - SESSION EXPIRED
        console.log("💀 TINK SESSION EXPIRED DETECTED:", {
          userId,
          expiredAt: new Date().toISOString(),
          errorMessage,
          errorType: "session_expired",
          timestamp: Date.now(),
          note: "This indicates the Tink user session has completely expired and requires full reconnection",
        });

        console.log("User's Tink session has expired, skipping further checks");
        return false; // Session expired
      }

      // Other errors might be temporary, log them but assume session is invalid for safety
      console.warn(
        "Error checking Tink session validity, assuming invalid:",
        errorMessage
      );
      return false;
    }
  }

  /**
   * Automatically refresh user access token if expired
   * Returns a fresh token or the existing one if still valid
   */
  async refreshUserTokenIfNeeded(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId?: string
  ): Promise<{ accessToken: string; account: BankAccount } | null> {
    try {
      // Import TinkService dynamically to avoid circular dependencies
      const { TinkService } = await import("./tinkService.js");

      // Check current token validity
      const tokenCheck = await this.isUserTokenValid(db, userId, tinkAccountId);

      if (tokenCheck.isValid && tokenCheck.account) {
        // Token is still valid, return it
        return {
          accessToken: tokenCheck.account.accessToken!,
          account: tokenCheck.account,
        };
      }

      if (!tokenCheck.account) {
        console.error("No bank account found for user:", userId);
        return null;
      }

      console.log("Token expired or invalid, attempting refresh...", {
        userId,
        reason: tokenCheck.reason,
        expiresAt: tokenCheck.account.tokenExpiresAt,
      });

      // Check if Tink session is still valid before attempting refresh
      const sessionValid = await this.checkTinkSessionValidity(userId);
      if (!sessionValid) {
        console.log(
          "User's Tink session has expired - automatic refresh not possible"
        );
        return null;
      }

      // Generate fresh user access token with credentials:refresh scope
      // Only request scopes that were originally granted, plus credentials:refresh
      const tinkService = new TinkService();
      const originalScope =
        tokenCheck.account.tokenScope ||
        "accounts:read,balances:read,transactions:read";
      const baseScopes = originalScope.split(",").map((s) => s.trim());

      // Always include credentials:refresh for token refresh capability
      if (!baseScopes.includes("credentials:refresh")) {
        baseScopes.push("credentials:refresh");
      }

      // Add credentials:read and credentials:write for full credential management
      if (!baseScopes.includes("credentials:read")) {
        baseScopes.push("credentials:read");
      }
      if (!baseScopes.includes("credentials:write")) {
        baseScopes.push("credentials:write");
      }

      const refreshScope = baseScopes.join(",");

      console.log(
        "Generating fresh user access token with scope:",
        refreshScope
      );

      const freshTokenResponse = await tinkService.getUserAccessTokenFlow({
        tinkUserId: userId,
        scope: refreshScope,
      });

      // Calculate expiration time
      const expiresAt = new Date(
        Date.now() + freshTokenResponse.expires_in * 1000
      );

      // Update the stored token
      const updatedAccounts = await db
        .update(bankAccount)
        .set({
          accessToken: freshTokenResponse.access_token,
          tokenExpiresAt: expiresAt,
          tokenScope: freshTokenResponse.scope,
        })
        .where(eq(bankAccount.id, tokenCheck.account.id))
        .returning();

      if (updatedAccounts.length === 0) {
        console.error("Failed to update token in database");
        return null;
      }

      console.log("Token refreshed successfully", {
        userId,
        newExpiresAt: expiresAt,
        scope: freshTokenResponse.scope,
      });

      // 🔍 SESSION LIFESPAN LOGGING - TOKEN REFRESHED (SESSION STILL ACTIVE)
      console.log("🔄 TINK TOKEN REFRESHED (session still active):", {
        userId,
        tokenRefreshedAt: new Date().toISOString(),
        newTokenExpiresAt: expiresAt.toISOString(),
        tokenLifespanHours: Math.floor(freshTokenResponse.expires_in / 3600),
        scope: freshTokenResponse.scope,
        previousTokenExpiredAt:
          tokenCheck.account.tokenExpiresAt?.toISOString(),
        accountId: tokenCheck.account.id,
        credentialsId: tokenCheck.account.credentialsId,
        timestamp: Date.now(),
        note: "Token was successfully refreshed - Tink session is still active and healthy",
      });

      return {
        accessToken: freshTokenResponse.access_token,
        account: updatedAccounts[0],
      };
    } catch (error) {
      console.error("Failed to refresh user token:", error);

      // Check if this is a session expiration vs other error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("User ID does not exist") ||
        errorMessage.includes("oauth.user_id_does_not_exist")
      ) {
        console.log(
          "User's Tink session has expired completely - reconnection required"
        );
      }

      return null;
    }
  }

  /**
   * Check if user's stored token is still valid
   * Returns true if token exists and is not expired
   */
  async isUserTokenValid(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId?: string
  ): Promise<{ isValid: boolean; account?: BankAccount; reason?: string }> {
    try {
      // Get stored account with token info
      const whereConditions = [eq(bankAccount.userId, userId)];

      if (tinkAccountId) {
        whereConditions.push(eq(bankAccount.tinkAccountId, tinkAccountId));
      }

      const query = db.select().from(bankAccount);
      const accounts = await (whereConditions.length === 1
        ? query.where(whereConditions[0]) // single-predicate path
        : query.where(and(...whereConditions))
      ) // multi-predicate path
        .limit(1);

      if (accounts.length === 0) {
        return { isValid: false, reason: "No bank account found for user" };
      }

      const account = accounts[0];

      // Check if token exists
      if (!account.accessToken) {
        return {
          isValid: false,
          account,
          reason: "No access token found for account",
        };
      }
      if (!account.tokenExpiresAt) {
        return {
          isValid: false,
          account,
          reason: "No token expiration date found for account",
        };
      }
      // Check if token is expired or will expire soon
      if (
        account.tokenExpiresAt &&
        this.isTokenExpired(account.tokenExpiresAt)
      ) {
        return {
          isValid: false,
          account,
          reason: `Token expired at ${account.tokenExpiresAt?.toISOString()}. User must reconnect their bank account.`,
        };
      }

      // Token is valid
      return { isValid: true, account };
    } catch (error) {
      return {
        isValid: false,
        reason: `Error checking token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Create a secure state token with HMAC signature for OAuth flows
   */
  createSecureStateToken(userId: string): string {
    const payload = {
      userId,
      timestamp: Date.now(),
      nonce: randomBytes(16).toString("hex"),
    };

    const payloadStr = JSON.stringify(payload);
    const signature = createHmac("sha256", this.STATE_SECRET)
      .update(payloadStr)
      .digest("base64url");

    return Buffer.from(`${payloadStr}.${signature}`).toString("base64url");
  }

  /**
   * Verify a secure state token and return the payload if valid
   */
  verifySecureStateToken(
    token: string
  ): { userId: string; timestamp: number; nonce: string } | null {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf-8");
      const [payloadStr, signature] = decoded.split(".");

      if (!payloadStr || !signature) {
        return null;
      }

      // Verify signature
      const expectedSignature = createHmac("sha256", this.STATE_SECRET)
        .update(payloadStr)
        .digest("base64url");

      const signatureBuffer = Buffer.from(signature, "base64url");
      const expectedBuffer = Buffer.from(expectedSignature, "base64url");

      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
      }

      const payload = JSON.parse(payloadStr) as {
        userId?: string;
        timestamp?: number;
        nonce?: string;
      };

      if (!payload.userId || !payload.timestamp || !payload.nonce) {
        return null;
      }

      // Check age
      if (Date.now() - payload.timestamp > this.MAX_STATE_AGE) {
        return null;
      }

      return {
        userId: payload.userId,
        timestamp: payload.timestamp,
        nonce: payload.nonce,
      };
    } catch {
      return null;
    }
  }
}

export const tokenService = new TokenService();
