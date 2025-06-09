import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { BankAccount, bankAccount, schema } from "../../db/schema";

export class TokenService {
  constructor() {}
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

      const accounts = await db
        .select()
        .from(bankAccount)
        .where(and(...whereConditions))
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
}

export const tokenService = new TokenService();
