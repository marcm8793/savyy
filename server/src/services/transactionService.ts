import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { schema, transaction } from "../../db/schema";

// Transaction service methods
export const transactionService = {
  async getTransactions(db: NodePgDatabase<any>, userId: string) {
    return await db
      .select()
      .from(transaction)
      .where(eq(transaction.userId, userId));
  },

  async getTransactionById(
    db: NodePgDatabase<typeof schema>,
    id: number,
    userId: string
  ) {
    const result = await db
      .select()
      .from(transaction)
      .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
      .limit(1);

    return result[0] || null;
  },

  async createTransaction(
    db: NodePgDatabase<any>,
    data: typeof transaction.$inferInsert
  ) {
    const result = await db.insert(transaction).values(data).returning();

    return result[0];
  },

  async updateTransaction(
    db: NodePgDatabase<any>,
    id: number,
    data: Partial<typeof transaction.$inferInsert>,
    userId: string
  ) {
    const result = await db
      .update(transaction)
      .set(data)
      .where(and(eq(transaction.id, id), eq(transaction.userId, userId)))
      .returning();

    return result[0];
  },

  async deleteTransaction(db: NodePgDatabase<any>, id: number, userId: string) {
    await db
      .delete(transaction)
      .where(and(eq(transaction.id, id), eq(transaction.userId, userId)));
  },
};
