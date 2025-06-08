import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { BankAccount, bankAccount, schema } from "../../db/schema";

// Account service methods that accept database instances
export const accountService = {
  async getAccounts(db: NodePgDatabase<typeof schema>, userId: string) {
    return await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));
  },

  async createAccount(
    db: NodePgDatabase<typeof schema>,
    data: typeof bankAccount.$inferInsert
  ) {
    const result = await db.insert(bankAccount).values(data).returning();

    return result[0];
  },
};

// Alternative: Create a service factory that receives the database instances
// TODO:
// Consider consolidating service patterns.
// Having both a static service object and a factory function creates inconsistency. Choose one pattern for better maintainability and developer experience.

// Consider standardizing on either the static service pattern (lines 7-23) or the factory pattern (lines 26-41), but not both, to avoid confusion about which pattern to use.
export const createAccountService = (
  db: NodePgDatabase<typeof schema>,
  pg: Pool
) => ({
  async getAccounts(userId: string) {
    return await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));
  },

  async getAccountsRaw(userId: string) {
    const result = await pg.query(
      "SELECT * FROM bank_accounts WHERE user_id = $1",
      [userId]
    );
    return result.rows as BankAccount[];
  },
});
