import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  role: userRole("role").default("user").notNull(),
  tinkUserId: text("tink_user_id"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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

// Define bank account schema for Drizzle ORM (based on actual Tink API response)
export const bankAccount = pgTable("bank_accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // From Tink API /data/v2/accounts
  tinkAccountId: varchar("tink_account_id", { length: 255 }).notNull().unique(), // id from API - unique constraint needed for foreign key reference
  accountName: varchar("account_name", { length: 255 }).notNull(), // name from API
  accountType: varchar("account_type", { length: 100 }), // type from API (CHECKING, SAVINGS, etc.)
  financialInstitutionId: varchar("financial_institution_id", {
    length: 255,
  }), // financialInstitutionId from API
  // Credentials information (from Tink callback URL)
  credentialsId: varchar("credentials_id", { length: 255 }), // credentials_id from callback URL - needed for refresh operations (can be null initially)
  balance: numeric("balance"), // Store balance in cents (from balances.booked.amount)
  currency: varchar("currency", { length: 3 }).default("EUR"), // from balances.booked.amount.currencyCode
  iban: varchar("iban", { length: 34 }), // from identifiers.iban.iban (can be null for some account types)
  lastRefreshed: timestamp("last_refreshed"), // from dates.lastRefreshed
  // Enhanced fields for consent refresh tracking
  lastIncrementalSync: timestamp("last_incremental_sync"), // Track last incremental sync for efficient updates
  consentStatus: varchar("consent_status", { length: 50 }).default("ACTIVE"), // Track consent health
  consentExpiresAt: timestamp("consent_expires_at"), // Track when consent expires
  // OAuth token info (from /api/v1/oauth/token)
  accessToken: text("access_token"), // access_token from OAuth response
  tokenExpiresAt: timestamp("token_expires_at"), // calculated from expires_in
  tokenScope: varchar("token_scope", { length: 255 }), // scope from OAuth response
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Define transaction schema for Drizzle ORM (based on Tink API v2/transactions)
export const transaction = pgTable("transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Core Tink API fields
  tinkTransactionId: varchar("tink_transaction_id", {
    length: 255,
  })
    .notNull()
    .unique(), // id from Tink API
  tinkAccountId: varchar("tink_account_id", { length: 255 })
    .notNull()
    // leverage the UNIQUE key on bank_accounts.tink_account_id
    .references(() => bankAccount.tinkAccountId, { onDelete: "cascade" }),

  // Amount information
  amount: numeric("amount").notNull(), // unscaledValue from amount.value
  amountScale: integer("amount_scale").default(0), // scale from amount.value
  currencyCode: varchar("currency_code", { length: 3 }).notNull(), // currencyCode from amount

  // Dates
  bookedDate: varchar("booked_date", { length: 10 }).notNull(), // dates.booked (YYYY-MM-DD) - every transaction should have a booked date
  transactionDate: varchar("transaction_date", { length: 10 }), // dates.transaction (YYYY-MM-DD)
  valueDate: varchar("value_date", { length: 10 }), // dates.value (YYYY-MM-DD)
  bookedDateTime: timestamp("booked_date_time"), // bookedDateTime (ISO-8601)
  transactionDateTime: timestamp("transaction_date_time"), // transactionDateTime (ISO-8601)
  valueDateTime: timestamp("value_date_time"), // valueDateTime (ISO-8601)

  // Descriptions
  displayDescription: varchar("display_description", { length: 500 }), // descriptions.display
  originalDescription: varchar("original_description", { length: 500 }), // descriptions.original
  detailedDescription: text("detailed_description"), // descriptions.detailed.unstructured

  // Status and type
  status: varchar("status", { length: 20 }).notNull(), // status (BOOKED, PENDING, UNDEFINED)
  transactionType: varchar("transaction_type", { length: 50 }), // types.type
  financialInstitutionTypeCode: varchar("fi_type_code", { length: 10 }), // types.financialInstitutionTypeCode

  // Additional fields
  reference: varchar("reference", { length: 255 }), // reference
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }), // identifiers.providerTransactionId
  merchantName: varchar("merchant_name", { length: 255 }), // merchantInformation.merchantName
  merchantCategoryCode: varchar("merchant_category_code", { length: 10 }), // merchantInformation.merchantCategoryCode

  // Category information (PFM)
  categoryId: varchar("category_id", { length: 255 }), // categories.pfm.id
  categoryName: varchar("category_name", { length: 255 }), // categories.pfm.name

  // Counterparty information
  payeeName: varchar("payee_name", { length: 255 }), // counterparties.payee.name
  payeeAccountNumber: varchar("payee_account_number", { length: 50 }), // counterparties.payee.identifiers.financialInstitution.accountNumber
  payerName: varchar("payer_name", { length: 255 }), // counterparties.payer.name
  payerAccountNumber: varchar("payer_account_number", { length: 50 }), // counterparties.payer.identifiers.financialInstitution.accountNumber

  // Mutability
  providerMutability: varchar("provider_mutability", { length: 50 }), // providerMutability

  // Enhanced fields for status tracking
  statusLastUpdated: timestamp("status_last_updated").$defaultFn(
    () => new Date()
  ), // Track when status last changed
  originalStatus: varchar("original_status", { length: 20 }), // Track original status for audit

  // Internal tracking
  bankAccountId: text("bank_account_id")
    .notNull()
    .references(() => bankAccount.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
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
