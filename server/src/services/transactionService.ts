import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { transaction } from "../schema";

// Transaction service methods
export const transactionService = {
  async getTransactions(db: NodePgDatabase<any>, userId: string) {
    return await db
      .select()
      .from(transaction)
      .where(eq(transaction.userId, userId));
  },
};
