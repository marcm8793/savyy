/**
 * Test fixtures for consistent test data
 */

export const testUsers = {
  validUser: {
    id: "user-123",
    email: "user@example.com",
    name: "Test User",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  adminUser: {
    id: "admin-123",
    email: "admin@example.com",
    name: "Admin User",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
};

export const testAccounts = {
  checkingAccount: {
    id: "account-123",
    userId: "user-123",
    name: "Test Checking Account",
    type: "checking",
    balance: 1500.0,
    currency: "USD",
    providerId: "tink-provider-123",
    externalId: "external-account-123",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  savingsAccount: {
    id: "account-456",
    userId: "user-123",
    name: "Test Savings Account",
    type: "savings",
    balance: 5000.0,
    currency: "USD",
    providerId: "tink-provider-123",
    externalId: "external-account-456",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
};

export const testTransactions = {
  expense: {
    id: "transaction-123",
    accountId: "account-123",
    amount: -50.0,
    description: "Coffee Shop Purchase",
    date: new Date("2024-01-15T10:30:00.000Z"),
    category: "Food & Dining",
    externalId: "external-transaction-123",
    createdAt: new Date("2024-01-15T10:30:00.000Z"),
    updatedAt: new Date("2024-01-15T10:30:00.000Z"),
  },
  income: {
    id: "transaction-456",
    accountId: "account-123",
    amount: 2500.0,
    description: "Salary Deposit",
    date: new Date("2024-01-01T09:00:00.000Z"),
    category: "Income",
    externalId: "external-transaction-456",
    createdAt: new Date("2024-01-01T09:00:00.000Z"),
    updatedAt: new Date("2024-01-01T09:00:00.000Z"),
  },
};

export const testTinkData = {
  accessToken: "test-access-token-123",
  refreshToken: "test-refresh-token-123",
  providerConsent: {
    id: "consent-123",
    userId: "user-123",
    providerId: "tink-provider-123",
    status: "granted",
    consentId: "tink-consent-123",
    credentialsId: "tink-credentials-123",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  webhookPayload: {
    eventType: "account-balance-updated",
    data: {
      accountId: "external-account-123",
      balance: 1450.0,
      currency: "USD",
    },
    timestamp: "2024-01-15T10:30:00.000Z",
  },
};
