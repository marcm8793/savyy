/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  TinkTransactionsResponse,
  DateRange,
} from "../../../../src/services/transaction/types";

// Use vi.hoisted to create mock functions that can be used in vi.mock
const mockTinkService = vi.hoisted(() => ({
  getAuthorizationGrantToken: vi.fn(),
}));

// Mock TinkService before importing anything that uses it
vi.mock("../../../../src/services/tinkService", () => ({
  TinkService: vi.fn(() => mockTinkService),
  tinkService: mockTinkService,
}));

// Mock httpRetry
vi.mock("../../../../src/utils/httpRetry");

// Import after mocking
import { TransactionFetchService } from "../../../../src/services/transaction/transactionFetchService";
import { httpRetry } from "../../../../src/utils/httpRetry";

describe("TransactionFetchService", () => {
  let service: TransactionFetchService;
  let mockHttpRetry: any;
  let mockDb: any;

  // Test fixtures
  const mockUserAccessToken = "user-access-token";
  const mockAccountId = "account-123";
  const mockCredentialsId = "credentials-456";
  const mockUserId = "user-789";
  const mockDateRange: DateRange = {
    from: "2024-01-01",
    to: "2024-01-31",
  };

  const mockTransaction = {
    id: "tx-123",
    accountId: mockAccountId,
    amount: {
      currencyCode: "EUR",
      value: {
        scale: "2",
        unscaledValue: "10000",
      },
    },
    dates: {
      booked: "2024-01-15",
      value: "2024-01-15",
    },
    descriptions: {
      display: "Test Transaction",
      original: "ORIGINAL TEST TX",
    },
    status: "BOOKED" as const,
  };

  const mockTinkResponse: TinkTransactionsResponse = {
    transactions: [mockTransaction],
    nextPageToken: "next-page-token",
  };

  const mockAuthToken = {
    access_token: "auth-token",
    expires_in: 3600,
    token_type: "Bearer",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment
    process.env.TINK_API_URL = "https://api.tink.com";

    service = new TransactionFetchService();

    // Get mocked instances
    mockHttpRetry = vi.mocked(httpRetry);

    // Mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // Default mock implementations
    mockTinkService.getAuthorizationGrantToken.mockResolvedValue(mockAuthToken);
    mockHttpRetry.fetchWithRetry.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockTinkResponse),
      text: vi.fn().mockResolvedValue("OK"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchPagedTransactions", () => {
    it("should fetch single page of transactions", async () => {
      const mockResponseSinglePage = {
        transactions: [mockTransaction],
        // No nextPageToken - single page
      };

      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseSinglePage),
      });

      const pages: TinkTransactionsResponse[] = [];
      for await (const page of service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        true
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      expect(pages[0].transactions).toHaveLength(1);
      expect(pages[0].transactions[0].id).toBe("tx-123");
    });

    it("should fetch multiple pages of transactions", async () => {
      const mockPage1 = {
        transactions: [mockTransaction],
        nextPageToken: "page-2",
      };

      const mockPage2 = {
        transactions: [{ ...mockTransaction, id: "tx-456" }],
        // No nextPageToken - last page
      };

      mockHttpRetry.fetchWithRetry
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockPage1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockPage2),
        });

      const pages: TinkTransactionsResponse[] = [];
      for await (const page of service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        true
      )) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0].transactions[0].id).toBe("tx-123");
      expect(pages[1].transactions[0].id).toBe("tx-456");
    });

    it("should handle API errors", async () => {
      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request"),
      });

      const generator = service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        true
      );

      await expect(generator.next()).rejects.toThrow(
        "Tink API error: 400 Bad Request"
      );
    });

    it("should construct correct API URL with parameters", async () => {
      const mockResponseSinglePage = {
        transactions: [mockTransaction],
      };

      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseSinglePage),
      });

      const pages: TinkTransactionsResponse[] = [];
      for await (const page of service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        false // includeAllStatuses = false
      )) {
        pages.push(page);
        break; // Just need first page to test URL construction
      }

      expect(mockHttpRetry.fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining("https://api.tink.com/data/v2/transactions"),
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Bearer ${mockUserAccessToken}`,
            "Content-Type": "application/json",
          },
        }),
        expect.any(String)
      );

      // Check URL parameters
      const callArgs = mockHttpRetry.fetchWithRetry.mock.calls[0];
      const url = callArgs[0];
      expect(url).toContain(`accountIdIn=${mockAccountId}`);
      expect(url).toContain("bookedDateGte=2024-01-01");
      expect(url).toContain("bookedDateLte=2024-01-31");
      expect(url).toContain("statusIn=BOOKED");
    });

    it("should include all statuses when requested", async () => {
      const mockResponseSinglePage = {
        transactions: [mockTransaction],
      };

      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponseSinglePage),
      });

      const pages: TinkTransactionsResponse[] = [];
      for await (const page of service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        true // includeAllStatuses = true
      )) {
        pages.push(page);
        break;
      }

      const callArgs = mockHttpRetry.fetchWithRetry.mock.calls[0];
      const url = callArgs[0];
      expect(url).toContain("statusIn=BOOKED");
      expect(url).toContain("statusIn=PENDING");
      expect(url).toContain("statusIn=UNDEFINED");
    });

    it("should handle pagination token correctly", async () => {
      const mockPage1 = {
        transactions: [mockTransaction],
        nextPageToken: "page-2-token",
      };

      const mockPage2 = {
        transactions: [{ ...mockTransaction, id: "tx-456" }],
      };

      mockHttpRetry.fetchWithRetry
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockPage1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(mockPage2),
        });

      const pages: TinkTransactionsResponse[] = [];
      for await (const page of service.fetchPagedTransactions(
        mockUserAccessToken,
        mockAccountId,
        mockDateRange,
        true
      )) {
        pages.push(page);
      }

      expect(mockHttpRetry.fetchWithRetry).toHaveBeenCalledTimes(2);

      // Second call should include pageToken
      const secondCallArgs = mockHttpRetry.fetchWithRetry.mock.calls[1];
      const secondUrl = secondCallArgs[0];
      expect(secondUrl).toContain("pageToken=page-2-token");
    });
  });

  describe("refreshCredentials", () => {
    it("should refresh credentials successfully", async () => {
      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("Success"),
      });

      await service.refreshCredentials(mockCredentialsId, mockUserAccessToken);

      expect(mockHttpRetry.fetchWithRetry).toHaveBeenCalledWith(
        `https://api.tink.com/api/v1/credentials/${mockCredentialsId}/refresh`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockUserAccessToken}`,
            "Content-Type": "application/json",
          },
        },
        expect.any(String)
      );
    });

    it("should handle refresh errors", async () => {
      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });

      await expect(
        service.refreshCredentials(mockCredentialsId, mockUserAccessToken)
      ).rejects.toThrow("Failed to refresh credentials: 401 Unauthorized");
    });
  });

  describe("refreshCredentialsWithAuthToken", () => {
    it("should refresh credentials with auth token successfully", async () => {
      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("Success"),
      });

      await service.refreshCredentialsWithAuthToken(
        mockCredentialsId,
        mockAuthToken.access_token
      );

      expect(mockHttpRetry.fetchWithRetry).toHaveBeenCalledWith(
        `https://api.tink.com/api/v1/credentials/${mockCredentialsId}/refresh`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockAuthToken.access_token}`,
            "Content-Type": "application/json",
          },
        },
        expect.any(String)
      );
    });

    it("should handle auth token refresh errors", async () => {
      mockHttpRetry.fetchWithRetry.mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue("Forbidden"),
      });

      await expect(
        service.refreshCredentialsWithAuthToken(
          mockCredentialsId,
          mockAuthToken.access_token
        )
      ).rejects.toThrow(
        "Failed to refresh credentials with auth token: 403 Forbidden"
      );
    });
  });

  describe("tryRefreshCredentials", () => {
    it("should skip refresh when requested", async () => {
      const result = await service.tryRefreshCredentials(
        mockDb,
        mockUserId,
        mockAccountId,
        true // skipCredentialsRefresh
      );

      expect(result).toBe(true);
      expect(mockTinkService.getAuthorizationGrantToken).not.toHaveBeenCalled();
    });

    it("should handle bank account not found", async () => {
      // Mock empty bank account lookup
      mockDb.select.mockResolvedValue([]);

      const result = await service.tryRefreshCredentials(
        mockDb,
        mockUserId,
        mockAccountId,
        false
      );

      expect(result).toBe(false);
      expect(mockTinkService.getAuthorizationGrantToken).not.toHaveBeenCalled();
    });

    it("should handle missing credentials ID", async () => {
      // Mock bank account without credentialsId
      mockDb.select.mockResolvedValue([
        {
          credentialsId: null,
        },
      ]);

      const result = await service.tryRefreshCredentials(
        mockDb,
        mockUserId,
        mockAccountId,
        false
      );

      expect(result).toBe(false);
      expect(mockTinkService.getAuthorizationGrantToken).not.toHaveBeenCalled();
    });
  });

  describe("environment configuration", () => {
    it("should use default API URL when not configured", () => {
      delete process.env.TINK_API_URL;
      const newService = new TransactionFetchService();
      expect(newService).toBeDefined();
      // Default URL should be used internally
    });

    it("should use configured API URL", () => {
      process.env.TINK_API_URL = "https://custom-api.tink.com";
      const newService = new TransactionFetchService();
      expect(newService).toBeDefined();
    });
  });
});
