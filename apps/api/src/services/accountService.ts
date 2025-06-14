import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bankAccount, schema } from "../../db/schema";

// Account service methods that accept database instances
export const accountService = {
  async getAccountsFromDb(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    const baseQuery = db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));

    // Apply pagination if provided
    if (options?.limit !== undefined && options?.offset !== undefined) {
      return await baseQuery.limit(options.limit).offset(options.offset);
    } else if (options?.limit) {
      return await baseQuery.limit(options.limit);
    } else if (options?.offset) {
      return await baseQuery.offset(options.offset);
    }

    return await baseQuery;
  },
};
