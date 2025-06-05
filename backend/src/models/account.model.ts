import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";

// Define account schema for Drizzle ORM
export const account = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  bankId: varchar("bank_id", { length: 255 }).notNull(),
});
