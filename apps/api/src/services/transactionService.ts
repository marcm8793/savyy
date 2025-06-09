import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { schema, Transaction, transaction } from "../../db/schema";

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

// Transaction service methods
export const transactionService = {
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
      nextPageToken:
        results.length === pageSize ? "next_page_token_here" : undefined,
    };
  },

  // Get transaction by Tink-style ID (string instead of number)
  async getTransactionById(
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
  },

  // Create transaction with Tink-style data structure
  async createTransaction(
    db: NodePgDatabase<typeof schema>,
    data: {
      userId: string;
      accountId: string;
      amount: {
        currencyCode: string;
        value: {
          scale: string;
          unscaledValue: string;
        };
      };
      status: "UNDEFINED" | "PENDING" | "BOOKED";
      dates: {
        booked: string;
        transaction?: string;
        value?: string;
      };
      descriptions: {
        display: string;
        original: string;
        detailed?: {
          unstructured?: string;
        };
      };
      reference?: string;
      merchantInformation?: {
        merchantCategoryCode?: string;
        merchantName?: string;
      };
      counterparties?: {
        payee?: {
          name?: string;
          identifiers?: {
            financialInstitution?: {
              accountNumber?: string;
            };
          };
        };
        payer?: {
          name?: string;
          identifiers?: {
            financialInstitution?: {
              accountNumber?: string;
            };
          };
        };
      };
    }
  ) {
    // Transform the Tink-style data to match your database schema
    const transformedData = {
      userId: data.userId,
      tinkTransactionId: `tink_${Date.now()}_${Math.random()}`, // Generate unique ID
      tinkAccountId: data.accountId,
      bankAccountId: 1, // You'll need to provide this based on your logic
      amount: data.amount.value.unscaledValue,
      amountScale: parseInt(data.amount.value.scale),
      currencyCode: data.amount.currencyCode,
      status: data.status,
      bookedDate: data.dates.booked,
      transactionDate: data.dates.transaction,
      valueDate: data.dates.value,
      displayDescription: data.descriptions.display,
      originalDescription: data.descriptions.original,
      detailedDescription: data.descriptions.detailed?.unstructured,
      reference: data.reference,
      merchantCategoryCode: data.merchantInformation?.merchantCategoryCode,
      merchantName: data.merchantInformation?.merchantName,
      payeeName: data.counterparties?.payee?.name,
      payeeAccountNumber:
        data.counterparties?.payee?.identifiers?.financialInstitution
          ?.accountNumber,
      payerName: data.counterparties?.payer?.name,
      payerAccountNumber:
        data.counterparties?.payer?.identifiers?.financialInstitution
          ?.accountNumber,
    };

    const result = await db
      .insert(transaction)
      .values(transformedData)
      .returning();
    return result[0];
  },

  // Update transaction
  async updateTransaction(
    db: NodePgDatabase<typeof schema>,
    transactionId: string, // Changed to string
    data: Partial<typeof transaction.$inferInsert>,
    userId: string
  ) {
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
  },

  // Delete transaction
  async deleteTransaction(
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
  },

  // Additional method to get transactions by account ID (common Tink use case)
  async getTransactionsByAccountId(
    db: NodePgDatabase<typeof schema>,
    accountId: string,
    userId: string,
    filters?: Omit<TinkTransactionFilters, "accountIdIn">
  ) {
    return this.getTransactions(db, userId, {
      ...filters,
      accountIdIn: [accountId],
    });
  },
};
