import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bankAccount, schema } from "../../db/schema";

// Account service methods that accept database instances
export const accountService = {
  async getAccounts(db: NodePgDatabase<typeof schema>, userId: string) {
    return await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));
  },
};
