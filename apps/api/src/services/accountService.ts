import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { bankAccount } from "../../db/schema";

// Account service methods that accept database instances
export const accountService = {
  async getAccounts(db: NodePgDatabase<any>, userId: string) {
    return await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));
  },

  async createAccount(
    db: NodePgDatabase<any>,
    data: typeof bankAccount.$inferInsert
  ) {
    const result = await db.insert(bankAccount).values(data).returning();

    return result[0];
  },
};

// Alternative: Create a service factory that receives the database instances
export const createAccountService = (db: NodePgDatabase<any>, pg: Pool) => ({
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
    return result.rows;
  },
});
