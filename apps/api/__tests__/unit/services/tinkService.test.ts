import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TinkService } from "../../../src/services/tinkService";
import type {
  TinkProviderConsent,
  TinkProviderConsentsResponse,
} from "../../../src/services/tinkService";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const mockEnv = {
  TINK_CLIENT_ID: "test-client-id",
  TINK_CLIENT_SECRET: "test-client-secret",
  TINK_REDIRECT_URI: "http://localhost:3000/callback",
  TINK_API_URL: "https://api.tink.com",
  TINK_ACTOR_CLIENT_ID: "test-actor-client-id",
};

// Test fixtures
const mockTokenResponse = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "test-scope",
};

const mockCreateUserResponse = {
  user_id: "tink-user-123",
  external_user_id: "user-123",
};

const mockGrantUserAccessResponse = {
  code: "mock-authorization-code",
};

const mockUserAuthorizationCodeResponse = {
  code: "mock-user-auth-code",
};

const mockProviderConsent: TinkProviderConsent = {
  accountIds: ["account-1", "account-2"],
  credentialsId: "credentials-123",
  providerName: "Test Bank",
  sessionExpiryDate: Date.now() + 86400000, // 24 hours from now
  status: "GRANTED",
  statusUpdated: Date.now(),
};

const mockProviderConsentsResponse: TinkProviderConsentsResponse = {
  providerConsents: [mockProviderConsent],
};

describe("TinkService", () => {
  let tinkService: TinkService;

  beforeEach(() => {
    // Set up environment variables
    Object.assign(process.env, mockEnv);

    // Create new instance for each test
    tinkService = new TinkService();

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with environment variables", () => {
      expect(tinkService).toBeInstanceOf(TinkService);
    });

    it("should throw error when required environment variables are missing", () => {
      // Preserve the original value so we can restore it after the test
      const originalValue = process.env.TINK_CLIENT_ID;
      delete process.env.TINK_CLIENT_ID;

      // Assert that the thrown error mentions the specific missing variable
      expect(() => new TinkService()).toThrow(
        /TINK_CLIENT_ID.*required|missing/i
      );

      // Restore for other tests
      if (originalValue !== undefined) {
        process.env.TINK_CLIENT_ID = originalValue;
      }
    });
  });

  describe("getClientAccessToken", () => {
    it("should successfully get client access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await tinkService.getClientAccessToken();

      expect(result).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should throw error when API request fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid credentials"),
      } as Response);

      await expect(tinkService.getClientAccessToken()).rejects.toThrow();
    });
  });

  describe("createUser", () => {
    it("should successfully create a user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockCreateUserResponse),
      } as Response);

      const result = await tinkService.createUser(
        "client-token",
        "user-123",
        "FR",
        "en_US",
        "id-hint"
      );

      expect(result).toEqual(mockCreateUserResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/user/create",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer client-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_user_id: "user-123",
            id_hint: "id-hint",
            market: "FR",
            locale: "en_US",
          }),
        }
      );
    });

    it("should throw error when user creation fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        text: () => Promise.resolve("User already exists"),
      } as Response);

      await expect(
        tinkService.createUser(
          "client-token",
          "user-123",
          "FR",
          "en_US",
          "id-hint"
        )
      ).rejects.toThrow();
    });
  });

  describe("getAuthorizationGrantToken", () => {
    it("should successfully get authorization grant token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await tinkService.getAuthorizationGrantToken();

      expect(result).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });
  });

  describe("grantUserAccess", () => {
    it("should successfully grant user access with tinkUserId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockGrantUserAccessResponse),
      } as Response);

      const result = await tinkService.grantUserAccess("auth-token", {
        tinkUserId: "user-123",
        idHint: "id-hint",
      });

      expect(result).toEqual(mockGrantUserAccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/authorization-grant/delegate",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer auth-token",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should successfully grant user access with userId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockGrantUserAccessResponse),
      } as Response);

      const result = await tinkService.grantUserAccess("auth-token", {
        userId: "tink-user-123",
        idHint: "id-hint",
      });

      expect(result).toEqual(mockGrantUserAccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/authorization-grant/delegate",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer auth-token",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should throw error when neither userId nor tinkUserId is provided", async () => {
      await expect(
        tinkService.grantUserAccess("auth-token", {
          idHint: "id-hint",
        })
      ).rejects.toThrow();
    });

    it("should throw error when idHint is missing", async () => {
      await expect(
        tinkService.grantUserAccess("auth-token", {
          tinkUserId: "user-123",
          idHint: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("buildTinkUrlWithAuthorizationCode", () => {
    it("should build URL with default options", () => {
      const url = tinkService.buildTinkUrlWithAuthorizationCode("auth-code");

      expect(url).toBe(
        "https://link.tink.com/1.0/transactions/connect-accounts?client_id=test-client-id&authorization_code=auth-code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&market=FR&locale=en_US"
      );
    });

    it("should build URL with custom options", () => {
      const url = tinkService.buildTinkUrlWithAuthorizationCode("auth-code", {
        market: "SE",
        locale: "sv_SE",
        state: "custom-state",
        redirectUri: "https://example.com/callback",
      });

      expect(url).toContain("market=SE");
      expect(url).toContain("locale=sv_SE");
      expect(url).toContain("state=custom-state");
      expect(url).toContain(
        "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback"
      );
    });
  });

  describe("generateUserAuthorizationCode", () => {
    it("should successfully generate user authorization code with tinkUserId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockUserAuthorizationCodeResponse),
      } as Response);

      const result = await tinkService.generateUserAuthorizationCode(
        "client-token",
        {
          tinkUserId: "user-123",
        }
      );

      expect(result).toEqual(mockUserAuthorizationCodeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/authorization-grant",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer client-token",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should use custom scope when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockUserAuthorizationCodeResponse),
      } as Response);

      await tinkService.generateUserAuthorizationCode("client-token", {
        tinkUserId: "user-123",
        scope: "custom:scope",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should throw error when neither userId nor tinkUserId is provided", async () => {
      await expect(
        tinkService.generateUserAuthorizationCode("client-token", {})
      ).rejects.toThrow();
    });
  });

  describe("getUserAccessToken", () => {
    it("should successfully exchange authorization code for access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await tinkService.getUserAccessToken("auth-code");

      expect(result).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        })
      );
    });

    it("should throw error when token exchange fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid authorization code"),
      } as Response);

      await expect(
        tinkService.getUserAccessToken("invalid-code")
      ).rejects.toThrow();
    });
  });

  describe("getUserAccessTokenFlow", () => {
    it("should complete the full flow successfully", async () => {
      // Mock the authorization grant token call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      // Mock the generate user authorization code call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockUserAuthorizationCodeResponse),
      } as Response);

      // Mock the get user access token call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await tinkService.getUserAccessTokenFlow({
        tinkUserId: "user-123",
      });

      expect(result).toEqual(mockTokenResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("listProviderConsents", () => {
    it("should successfully list provider consents", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockProviderConsentsResponse),
      } as Response);

      const result = await tinkService.listProviderConsents("user-token");

      expect(result).toEqual(mockProviderConsentsResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/api/v1/provider-consents",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer user-token",
            "Content-Type": "application/json",
          },
        }
      );
    });

    it("should throw error when listing consents fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid token"),
      } as Response);

      await expect(
        tinkService.listProviderConsents("invalid-token")
      ).rejects.toThrow();
    });
  });

  describe("buildUpdateConsentUrl", () => {
    it("should build update consent URL with default options", () => {
      const url = tinkService.buildUpdateConsentUrl(
        "auth-code",
        "credentials-123"
      );

      expect(url).toBe(
        "https://link.tink.com/1.0/transactions/update-consent?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&credentials_id=credentials-123&authorization_code=auth-code&market=FR"
      );
    });

    it("should build update consent URL with custom options", () => {
      const url = tinkService.buildUpdateConsentUrl(
        "auth-code",
        "credentials-123",
        {
          market: "SE",
          locale: "sv_SE",
          state: "custom-state",
          redirectUri: "https://example.com/callback",
        }
      );

      expect(url).toContain("market=SE");
      expect(url).toContain("state=custom-state");
      expect(url).toContain(
        "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback"
      );
    });
  });

  describe("buildExtendConsentUrl", () => {
    it("should build extend consent URL with default options", () => {
      const url = tinkService.buildExtendConsentUrl(
        "auth-code",
        "credentials-123"
      );

      expect(url).toBe(
        "https://link.tink.com/1.0/transactions/extend-consent?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&credentials_id=credentials-123&authorization_code=auth-code&market=FR"
      );
    });

    it("should build extend consent URL with custom options", () => {
      const url = tinkService.buildExtendConsentUrl(
        "auth-code",
        "credentials-123",
        {
          market: "SE",
          locale: "sv_SE",
          state: "custom-state",
          redirectUri: "https://example.com/callback",
        }
      );

      expect(url).toContain("market=SE");
      expect(url).toContain("state=custom-state");
      expect(url).toContain(
        "redirect_uri=https%3A%2F%2Fexample.com%2Fcallback"
      );
    });
  });

  describe("isConsentUpdateNeeded", () => {
    it("should return true when consent has expired", () => {
      const expiredConsent: TinkProviderConsent = {
        ...mockProviderConsent,
        sessionExpiryDate: Date.now() - 1000, // 1 second ago
      };

      const result = tinkService.isConsentUpdateNeeded(expiredConsent);

      expect(result).toBe(true);
    });

    it("should return true when consent has retryable error", () => {
      const errorConsent: TinkProviderConsent = {
        ...mockProviderConsent,
        detailedError: {
          details: {
            reason: "TEMPORARY_ERROR",
            retryable: true,
          },
          displayMessage: "Temporary error occurred",
          type: "TEMPORARY_ERROR",
        },
      };

      const result = tinkService.isConsentUpdateNeeded(errorConsent);

      expect(result).toBe(true);
    });

    it("should return true for statuses needing update", () => {
      const statusesNeedingUpdate = [
        "TEMPORARY_ERROR",
        "AUTHENTICATION_ERROR",
        "SESSION_EXPIRED",
      ];

      statusesNeedingUpdate.forEach((status) => {
        const consent: TinkProviderConsent = {
          ...mockProviderConsent,
          status,
        };

        const result = tinkService.isConsentUpdateNeeded(consent);

        expect(result).toBe(true);
      });
    });

    it("should return false for valid consent", () => {
      const validConsent: TinkProviderConsent = {
        ...mockProviderConsent,
        status: "GRANTED",
        sessionExpiryDate: Date.now() + 86400000, // 24 hours from now
      };

      const result = tinkService.isConsentUpdateNeeded(validConsent);

      expect(result).toBe(false);
    });
  });

  describe("getConsentByCredentialsId", () => {
    it("should return consent when found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockProviderConsentsResponse),
      } as Response);

      const result = await tinkService.getConsentByCredentialsId(
        "user-token",
        "credentials-123"
      );

      expect(result).toEqual(mockProviderConsent);
    });

    it("should return null when consent not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ providerConsents: [] }),
      } as Response);

      const result = await tinkService.getConsentByCredentialsId(
        "user-token",
        "non-existent-credentials"
      );

      expect(result).toBeNull();
    });

    it("should propagate error from listProviderConsents", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid token"),
      } as Response);

      await expect(
        tinkService.getConsentByCredentialsId(
          "invalid-token",
          "credentials-123"
        )
      ).rejects.toThrow();
    });
  });
});
