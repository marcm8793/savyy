import { vi } from "vitest";
import type {
  TinkProviderConsent,
  TinkProviderConsentsResponse,
  TinkTokenResponse,
  TinkCreateUserResponse,
  TinkGrantUserAccessResponse,
  TinkUserAuthorizationCodeResponse,
} from "../../src/services/tinkService";

/**
 * Mock implementation of TinkService for testing
 */
export const mockTinkService = {
  // Token and authentication mocks
  getClientAccessToken: vi.fn().mockResolvedValue({
    access_token: "mock-client-access-token",
    token_type: "Bearer",
    expires_in: 3600,
    scope: "user:create",
  } as TinkTokenResponse),

  getAuthorizationGrantToken: vi.fn().mockResolvedValue({
    access_token: "mock-auth-grant-token",
    token_type: "Bearer",
    expires_in: 3600,
    scope: "authorization:grant",
  } as TinkTokenResponse),

  getUserAccessToken: vi.fn().mockResolvedValue({
    access_token: "mock-user-access-token",
    refresh_token: "mock-refresh-token",
    token_type: "Bearer",
    expires_in: 3600,
    scope:
      "accounts:read,balances:read,transactions:read,provider-consents:read",
  } as TinkTokenResponse),

  getUserAccessTokenFlow: vi.fn().mockResolvedValue({
    access_token: "mock-user-access-token-flow",
    refresh_token: "mock-refresh-token-flow",
    token_type: "Bearer",
    expires_in: 3600,
    scope:
      "accounts:read,balances:read,transactions:read,provider-consents:read",
  } as TinkTokenResponse),

  // User management mocks
  createUser: vi.fn().mockResolvedValue({
    user_id: "mock-tink-user-id",
    external_user_id: "mock-external-user-id",
  } as TinkCreateUserResponse),

  grantUserAccess: vi.fn().mockResolvedValue({
    code: "mock-authorization-code",
  } as TinkGrantUserAccessResponse),

  generateUserAuthorizationCode: vi.fn().mockResolvedValue({
    code: "mock-user-auth-code",
  } as TinkUserAuthorizationCodeResponse),

  // URL building mocks
  buildTinkUrlWithAuthorizationCode: vi
    .fn()
    .mockReturnValue(
      "https://link.tink.com/1.0/transactions/connect-accounts?client_id=mock&authorization_code=mock&redirect_uri=mock&market=FR&locale=en_US"
    ),

  buildUpdateConsentUrl: vi
    .fn()
    .mockReturnValue(
      "https://link.tink.com/1.0/transactions/update-consent?client_id=mock&redirect_uri=mock&credentials_id=mock&authorization_code=mock&market=FR"
    ),

  buildExtendConsentUrl: vi
    .fn()
    .mockReturnValue(
      "https://link.tink.com/1.0/transactions/extend-consent?client_id=mock&redirect_uri=mock&credentials_id=mock&authorization_code=mock&market=FR"
    ),

  // Provider consent mocks
  listProviderConsents: vi.fn().mockResolvedValue({
    providerConsents: [
      {
        accountIds: ["mock-account-1", "mock-account-2"],
        credentialsId: "mock-credentials-1",
        providerName: "mock-bank",
        sessionExpiryDate: Date.now() + 86400000, // 24 hours from now
        status: "UPDATED",
        statusUpdated: Date.now(),
      },
      {
        accountIds: ["mock-account-3"],
        credentialsId: "mock-credentials-2",
        providerName: "mock-bank-2",
        sessionExpiryDate: Date.now() + 172800000, // 48 hours from now
        status: "UPDATED",
        statusUpdated: Date.now(),
      },
    ] as TinkProviderConsent[],
  } as TinkProviderConsentsResponse),

  getConsentByCredentialsId: vi.fn().mockResolvedValue({
    accountIds: ["mock-account-1", "mock-account-2"],
    credentialsId: "mock-credentials-1",
    providerName: "mock-bank",
    sessionExpiryDate: Date.now() + 86400000, // 24 hours from now
    status: "UPDATED",
    statusUpdated: Date.now(),
  } as TinkProviderConsent),

  // New consent management methods
  isConsentUpdateNeeded: vi.fn().mockReturnValue(false),

  isConsentExpiringsoon: vi.fn().mockReturnValue(false),

  refreshCredentials: vi.fn().mockResolvedValue(undefined),

  analyzeConsentExpiryStatus: vi.fn().mockResolvedValue({
    total: 2,
    expired: [],
    expiringSoon: [],
    needingUpdate: [],
    healthy: [
      {
        accountIds: ["mock-account-1", "mock-account-2"],
        credentialsId: "mock-credentials-1",
        providerName: "mock-bank",
        sessionExpiryDate: Date.now() + 86400000,
        status: "UPDATED",
        statusUpdated: Date.now(),
      },
      {
        accountIds: ["mock-account-3"],
        credentialsId: "mock-credentials-2",
        providerName: "mock-bank-2",
        sessionExpiryDate: Date.now() + 172800000,
        status: "UPDATED",
        statusUpdated: Date.now(),
      },
    ] as TinkProviderConsent[],
    summary: {
      expiredCount: 0,
      expiringSoonCount: 0,
      needingUpdateCount: 0,
      healthyCount: 2,
      avgHoursUntilExpiry: 36,
    },
  }),

  // Legacy mocks for backward compatibility
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

  // Provider consent mocks (legacy)
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

  // Helper to set up specific test scenarios
  setupExpiredConsentScenario: () => {
    mockTinkService.listProviderConsents.mockResolvedValue({
      providerConsents: [
        {
          accountIds: ["mock-account-1"],
          credentialsId: "expired-credentials",
          providerName: "expired-bank",
          sessionExpiryDate: Date.now() - 3600000, // 1 hour ago (expired)
          status: "SESSION_EXPIRED",
          statusUpdated: Date.now(),
        },
      ] as TinkProviderConsent[],
    });
    mockTinkService.isConsentUpdateNeeded.mockReturnValue(true);
  },

  setupExpiringSoonScenario: () => {
    mockTinkService.listProviderConsents.mockResolvedValue({
      providerConsents: [
        {
          accountIds: ["mock-account-1"],
          credentialsId: "expiring-credentials",
          providerName: "expiring-bank",
          sessionExpiryDate: Date.now() + 3600000, // 1 hour from now (expiring soon)
          status: "UPDATED",
          statusUpdated: Date.now(),
        },
      ] as TinkProviderConsent[],
    });
    mockTinkService.isConsentExpiringsoon.mockReturnValue(true);
  },

  setupErrorScenario: () => {
    mockTinkService.listProviderConsents.mockResolvedValue({
      providerConsents: [
        {
          accountIds: ["mock-account-1"],
          credentialsId: "error-credentials",
          providerName: "error-bank",
          sessionExpiryDate: Date.now() + 86400000,
          status: "TEMPORARY_ERROR",
          statusUpdated: Date.now(),
          detailedError: {
            type: "TEMPORARY_ERROR",
            displayMessage: "Temporary connection issue",
            details: {
              reason: "CONNECTION_TIMEOUT",
              retryable: true,
            },
          },
        },
      ] as TinkProviderConsent[],
    });
    mockTinkService.isConsentUpdateNeeded.mockReturnValue(true);
  },

  setupExpiredWithErrorScenario: () => {
    mockTinkService.listProviderConsents.mockResolvedValue({
      providerConsents: [
        {
          accountIds: ["mock-account-1"],
          credentialsId: "expired-with-error-credentials",
          providerName: "expired-with-error-bank",
          sessionExpiryDate: Date.now() - 3600000, // 1 hour ago (expired)
          status: "AUTHENTICATION_ERROR",
          statusUpdated: Date.now(),
          detailedError: {
            type: "USER_LOGIN_ERROR",
            displayMessage: "Authentication failed",
            details: {
              reason: "INVALID_CREDENTIALS",
              retryable: false,
            },
          },
        },
      ] as TinkProviderConsent[],
    });
    mockTinkService.isConsentUpdateNeeded.mockReturnValue(true);
    mockTinkService.isConsentExpiringsoon.mockReturnValue(false); // Expired, not expiring soon
  },
};

// Export the mock as default for easy importing
export default mockTinkService;
