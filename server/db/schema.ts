import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// Define user schema for Drizzle ORM
export const user = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
});

// Define account schema for Drizzle ORM
export const account = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  bankId: varchar("bank_id", { length: 255 }).notNull(),
});

// Define transaction schema for Drizzle ORM
export const transaction = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  accountId: integer("account_id").notNull(),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  description: varchar("description", { length: 255 }),
});

// Export schema object for Drizzle Kit configuration
export const schema = {
  user,
  account,
  transaction,
};
