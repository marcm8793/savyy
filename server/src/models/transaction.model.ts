import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// Define transaction schema for Drizzle ORM
export const transaction = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  accountId: integer("account_id").notNull(),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  description: varchar("description", { length: 255 }),
});
