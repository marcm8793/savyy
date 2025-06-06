import { user } from "./models/user.model";
import { transaction } from "./models/transaction.model";
import { account } from "./models/account.model";

// Export all schemas for Drizzle migrations
export const schema = {
  user,
  transaction,
  account,
};
