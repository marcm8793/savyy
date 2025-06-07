import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { account } from "../schema";

// Account service methods that accept database instances
export const accountService = {
  async getAccounts(db: NodePgDatabase<any>, userId: number) {
    return await db.select().from(account).where(eq(account.userId, userId));
  },
};

// Alternative: Create a service factory that receives the database instances
export const createAccountService = (db: NodePgDatabase<any>, pg: Pool) => ({
  async getAccounts(userId: number) {
    return await db.select().from(account).where(eq(account.userId, userId));
  },

  async getAccountsRaw(userId: string) {
    const result = await pg.query("SELECT * FROM accounts WHERE user_id = $1", [
      userId,
    ]);
    return result.rows;
  },
});
