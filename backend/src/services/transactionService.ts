import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { transaction } from "../models/transaction.model";
import { eq } from "drizzle-orm";

// Transaction service methods
export const transactionService = {
  async getTransactions(db: NodePgDatabase<any>, userId: string) {
    return await db
      .select()
      .from(transaction)
      .where(eq(transaction.userId, userId));
  },
};
