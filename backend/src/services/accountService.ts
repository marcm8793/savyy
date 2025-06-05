import { db } from "../utils/db";
import { account } from "../models/account.model";

// Account service methods
export const accountService = {
  async getAccounts(userId: string) {
    return await db.select().from(account).where({ userId });
  },
};
