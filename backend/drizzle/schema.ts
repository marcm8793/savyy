import { user } from "../src/models/user.model";
import { transaction } from "../src/models/transaction.model";
import { account } from "../src/models/account.model";

// Export all schemas for Drizzle migrations
export const schema = {
  user,
  transaction,
  account,
};
