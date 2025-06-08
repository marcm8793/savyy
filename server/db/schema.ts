import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

// Define bank account schema for Drizzle ORM
export const bankAccount = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  bankId: varchar("bank_id", { length: 255 }).notNull(),
});

// Define transaction schema for Drizzle ORM
export const transaction = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull(),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull(),
  description: varchar("description", { length: 255 }),
});

// Export schema object for Drizzle Kit configuration
export const schema = {
  user,
  session,
  account,
  verification,
  bankAccount,
  transaction,
};

// Export inferred types from Drizzle schemas
export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;

export type BankAccount = typeof bankAccount.$inferSelect;
export type BankAccountInsert = typeof bankAccount.$inferInsert;

export type Transaction = typeof transaction.$inferSelect;
export type TransactionInsert = typeof transaction.$inferInsert;

// Export Zod schemas for validation
export const userSelectSchema = createSelectSchema(user);
export const userInsertSchema = createInsertSchema(user);

export const sessionSelectSchema = createSelectSchema(session);
export const sessionInsertSchema = createInsertSchema(session);

export const accountSelectSchema = createSelectSchema(account);
export const accountInsertSchema = createInsertSchema(account);

export const verificationSelectSchema = createSelectSchema(verification);
export const verificationInsertSchema = createInsertSchema(verification);

export const bankAccountSelectSchema = createSelectSchema(bankAccount);
export const bankAccountInsertSchema = createInsertSchema(bankAccount);

export const transactionSelectSchema = createSelectSchema(transaction);
export const transactionInsertSchema = createInsertSchema(transaction);
