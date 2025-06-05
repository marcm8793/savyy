import { db } from "../utils/db";
import { transaction } from "../models/transaction.model";

// Transaction service methods
export const transactionService = {
  async getTransactions(userId: string) {
    return await db.select().from(transaction).where({ userId });
  },
};
