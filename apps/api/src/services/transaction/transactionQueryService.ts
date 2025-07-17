import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { schema, Transaction, transaction } from "../../../db/schema";

// Types based on Tink API structure
export interface TinkTransactionFilters {
  pageSize?: number;
  pageToken?: string;
  accountIdIn?: string[];
  bookedDateGte?: string; // ISO-8601 date format (YYYY-MM-DD)
  bookedDateLte?: string; // ISO-8601 date format (YYYY-MM-DD)
  statusIn?: ("UNDEFINED" | "PENDING" | "BOOKED")[];
}

export interface TinkTransactionResponse {
  nextPageToken?: string;
  transactions: Transaction[];
}

/**
 * Transaction Query Service
 * Handles Tink-style transaction filtering and querying operations
 */
export class TransactionQueryService {

  // Get transactions with Tink-style filtering
  async getTransactions(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    filters?: TinkTransactionFilters
  ): Promise<TinkTransactionResponse> {
    // Build where conditions
    const conditions = [eq(transaction.userId, userId)];

    if (filters?.accountIdIn && filters.accountIdIn.length > 0) {
      conditions.push(inArray(transaction.tinkAccountId, filters.accountIdIn));
    }

    if (filters?.bookedDateGte) {
      conditions.push(gte(transaction.bookedDate, filters.bookedDateGte));
    }

    if (filters?.bookedDateLte) {
      conditions.push(lte(transaction.bookedDate, filters.bookedDateLte));
    }

    if (filters?.statusIn && filters.statusIn.length > 0) {
      conditions.push(inArray(transaction.status, filters.statusIn));
    }

    // Apply pagination
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const results = await db
      .select()
      .from(transaction)
      .where(and(...conditions))
      .limit(pageSize);

    return {
      transactions: results,
      // In a real implementation, you'd generate the next page token based on the last result
      //       pageToken is accepted but never used – pagination is incomplete
      // The service advertises token-based pagination, yet the implementation ignores pageToken and always starts from the first row, returning a placeholder token.

      // At minimum, document the limitation; ideally implement proper offset/seek-based paging:

      // -// TODO: implement proper paging – pageToken is currently ignored
      // -const results = await db
      // +const offset = filters?.pageToken ? Number(filters.pageToken) : 0;
      // +
      // +const results = await db
      //    .select()
      //    .from(transaction)
      //    .where(and(...conditions))
      // -  .limit(pageSize);
      // +  .limit(pageSize)
      // +  .offset(offset);

      //  return {
      //    transactions: results,
      // -  nextPageToken:
      // -    results.length === pageSize ? "next_page_token_here" : undefined,
      // +  nextPageToken:
      // +    results.length === pageSize ? String(offset + pageSize) : undefined,
      //  };
      nextPageToken:
        results.length === pageSize ? "next_page_token_here" : undefined,
    };
  }

  // * Get transaction by id
  async getTransactionByIdFromDb(
    db: NodePgDatabase<typeof schema>,
    transactionId: string, // Changed to string to match Tink API
    userId: string
  ) {
    const result = await db
      .select()
      .from(transaction)
      .where(
        and(
          eq(transaction.tinkTransactionId, transactionId),
          eq(transaction.userId, userId)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  // Update transaction
  async updateTransactionInDb(
    db: NodePgDatabase<typeof schema>,
    transactionId: string, // Changed to string
    data: Partial<typeof transaction.$inferInsert>,
    userId: string
  ): Promise<Transaction | undefined> {
    const result = await db
      .update(transaction)
      .set(data)
      .where(
        and(
          eq(transaction.tinkTransactionId, transactionId),
          eq(transaction.userId, userId)
        )
      )
      .returning();
    return result[0];
  }

  // Delete transaction
  async deleteTransactionFromDb(
    db: NodePgDatabase<typeof schema>,
    transactionId: string, // Changed to string
    userId: string
  ) {
    await db
      .delete(transaction)
      .where(
        and(
          eq(transaction.tinkTransactionId, transactionId),
          eq(transaction.userId, userId)
        )
      );
  }

  // Additional method to get transactions by account ID (common Tink use case)
  async getTransactionsByAccountIdFromDb(
    db: NodePgDatabase<typeof schema>,
    accountId: string,
    userId: string,
    filters?: Omit<TinkTransactionFilters, "accountIdIn">
  ) {
    return this.getTransactions(db, userId, {
      ...filters,
      accountIdIn: [accountId],
    });
  }
}

// Singleton instance
export const transactionQueryService = new TransactionQueryService();
