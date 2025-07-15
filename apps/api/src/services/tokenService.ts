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
   * Automatically refresh user access token if expired
   * Returns a fresh token or the existing one if still valid
   */
  async refreshUserTokenIfNeeded(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccountId?: string
  ): Promise<{ accessToken: string; account: BankAccount } | null> {
    try {

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
        accountId: tokenCheck.account.id,
      });

      // Try to refresh credentials using access token and generate new token
      if (!tokenCheck.account.credentialsId) {
        console.error("No credentials ID available for account", {
          userId,
          accountId: tokenCheck.account.id,
          accountName: tokenCheck.account.accountName,
        });
        return null;
      }

      console.log("Attempting to refresh credentials using access token", {
        userId,
        accountId: tokenCheck.account.id,
        credentialsId: tokenCheck.account.credentialsId,
      });

      // Import TinkService dynamically to avoid circular dependencies
      const { TinkService } = await import("./tinkService.js");
      const tinkService = new TinkService();

      // First, try to refresh the credentials
      try {
        await tinkService.refreshCredentials(
          tokenCheck.account.accessToken!,
          tokenCheck.account.credentialsId
        );
      } catch (refreshError) {
        console.warn("Failed to refresh credentials, but continuing with token generation:", refreshError);
      }

      // Generate new access token using the existing flow
      const freshTokenResponse = await tinkService.getUserAccessTokenFlow({
        tinkUserId: userId,
        scope: tokenCheck.account.tokenScope || "accounts:read,balances:read,transactions:read,provider-consents:read,credentials:refresh",
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

      return {
        accessToken: updatedAccounts[0].accessToken!,
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
          reason: `Token expired at ${account.tokenExpiresAt?.toISOString()} and needs refresh.`,
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
