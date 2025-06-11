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
   * Get token information for a user's accounts
   * Useful for checking token expiration and scope
   */
  async getTokenInfo(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<{
    accessToken: string | null;
    tokenExpiresAt: Date | null;
    tokenScope: string | null;
    isExpired: boolean;
  } | null> {
    const accounts = await db
      .select({
        accessToken: bankAccount.accessToken,
        tokenExpiresAt: bankAccount.tokenExpiresAt,
        tokenScope: bankAccount.tokenScope,
      })
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId))
      .limit(1);

    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    const isExpired = account.tokenExpiresAt
      ? account.tokenExpiresAt < new Date()
      : true; // Consider expired if no expiration date

    return {
      accessToken: account.accessToken,
      tokenExpiresAt: account.tokenExpiresAt,
      tokenScope: account.tokenScope,
      isExpired,
    };
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
