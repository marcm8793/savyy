import { vi } from "vitest";

/**
 * Mock implementation of TinkService for testing
 */
export const mockTinkService = {
  // Authentication mocks
  exchangeCodeForTokens: vi.fn().mockResolvedValue({
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
  }),

  refreshAccessToken: vi.fn().mockResolvedValue({
    access_token: "new-mock-access-token",
    expires_in: 3600,
  }),

  // Account mocks
  getAccounts: vi.fn().mockResolvedValue([
    {
      id: "mock-account-1",
      name: "Mock Checking Account",
      type: "CHECKING",
      balance: 1500.0,
      currency: "USD",
    },
    {
      id: "mock-account-2",
      name: "Mock Savings Account",
      type: "SAVINGS",
      balance: 5000.0,
      currency: "USD",
    },
  ]),

  getAccountBalances: vi.fn().mockResolvedValue([
    {
      accountId: "mock-account-1",
      balance: 1500.0,
      currency: "USD",
    },
  ]),

  // Transaction mocks
  getTransactions: vi.fn().mockResolvedValue([
    {
      id: "mock-transaction-1",
      accountId: "mock-account-1",
      amount: -50.0,
      description: "Mock Coffee Purchase",
      date: "2024-01-15",
      category: "Food & Dining",
    },
    {
      id: "mock-transaction-2",
      accountId: "mock-account-1",
      amount: 2500.0,
      description: "Mock Salary",
      date: "2024-01-01",
      category: "Income",
    },
  ]),

  // Provider consent mocks
  getProviderConsents: vi.fn().mockResolvedValue([
    {
      id: "mock-consent-1",
      providerId: "mock-provider-1",
      status: "GRANTED",
    },
  ]),

  // Webhook mocks
  verifyWebhookSignature: vi.fn().mockReturnValue(true),

  // Utility function to reset all mocks
  resetAllMocks: () => {
    Object.values(mockTinkService).forEach((mock) => {
      if (vi.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  },
};

// Export the mock as default for easy importing
export default mockTinkService;
