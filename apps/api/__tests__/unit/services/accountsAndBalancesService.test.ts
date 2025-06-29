import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AccountsAndBalancesService } from "../../../src/services/accountsAndBalancesService";
import { httpRetry } from "../../../src/utils/httpRetry";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema, BankAccount } from "../../../db/schema";

// Mock the httpRetry utility
vi.mock("../../../src/utils/httpRetry", () => ({
  httpRetry: {
    fetchWithRetry: vi.fn(),
  },
}));

// Mock environment variables
const mockEnv = {
  TINK_API_URL: "https://api.tink.com",
};

// Test fixtures
const mockTinkAccount = {
  id: "tink-account-123",
  name: "Test Checking Account",
  type: "CHECKING" as const,
  balances: {
    booked: {
      amount: {
        currencyCode: "EUR",
        value: {
          scale: "2",
          unscaledValue: "150000", // 1500.00 EUR
        },
      },
    },
  },
  customerSegment: "PERSONAL" as const,
  dates: {
    lastRefreshed: "2024-01-15T10:30:00Z",
  },
  financialInstitutionId: "bank-123",
  identifiers: {
    iban: {
      bban: "1234567890",
      iban: "DE89370400440532013000",
    },
  },
};

const mockTinkAccountWithoutBalance = {
  id: "tink-account-456",
  name: "Test Savings Account",
  type: "SAVINGS" as const,
  dates: {
    lastRefreshed: "2024-01-15T10:30:00Z",
  },
  financialInstitutionId: "bank-123",
};

const mockListAccountsResponse = {
  accounts: [mockTinkAccount, mockTinkAccountWithoutBalance],
  nextPageToken: "next-page-token",
};

const mockBankAccount: BankAccount = {
  id: "db-account-123",
  userId: "user-123",
  tinkAccountId: "tink-account-123",
  accountName: "Test Checking Account",
  accountType: "CHECKING",
  financialInstitutionId: "bank-123",
  credentialsId: "credentials-123",
  balance: "150000", // in cents
  currency: "EUR",
  iban: "DE89370400440532013000",
  lastRefreshed: new Date("2024-01-15T10:30:00Z"),
  lastIncrementalSync: null,
  consentStatus: "ACTIVE",
  consentExpiresAt: null,
  accessToken: "access-token-123",
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  tokenScope: "accounts:read balances:read",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-15T10:30:00Z"),
};

describe("AccountsAndBalancesService", () => {
  let service: AccountsAndBalancesService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Set up environment variables
    Object.assign(process.env, mockEnv);

    // Create service instance
    service = new AccountsAndBalancesService();

    // Reset mocks
    vi.clearAllMocks();

    // Mock fetch for httpRetry
    mockFetch = vi.fn();
    vi.spyOn(httpRetry, "fetchWithRetry").mockImplementation(mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with environment variables", () => {
      expect(service).toBeInstanceOf(AccountsAndBalancesService);
    });

    it("should use default API URL when environment variable is not set", () => {
      delete process.env.TINK_API_URL;
      const newService = new AccountsAndBalancesService();
      expect(newService).toBeInstanceOf(AccountsAndBalancesService);
    });
  });

  describe("fetchAccountsAndBalances", () => {
    const userAccessToken = "user-access-token-123";

    it("should successfully fetch accounts and balances", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockListAccountsResponse),
      } as Response);

      const result = await service.fetchAccountsAndBalances(userAccessToken);

      expect(result).toEqual(mockListAccountsResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/data/v2/accounts",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userAccessToken}`,
            "Content-Type": "application/json",
          },
        },
        "Fetch accounts and balances from Tink API"
      );
    });

    it("should handle query parameters correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockListAccountsResponse),
      } as Response);

      const params = {
        pageSize: 10,
        pageToken: "page-token",
        idIn: ["account-1", "account-2"],
        typesIn: ["CHECKING" as const, "SAVINGS" as const],
      };

      await service.fetchAccountsAndBalances(userAccessToken, params);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("pageSize=10"),
        expect.any(Object),
        expect.any(String)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("pageToken=page-token"),
        expect.any(Object),
        expect.any(String)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("idIn=account-1"),
        expect.any(Object),
        expect.any(String)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("typesIn=CHECKING"),
        expect.any(Object),
        expect.any(String)
      );
    });

    it("should throw error when API request fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid token"),
      } as Response);

      await expect(
        service.fetchAccountsAndBalances(userAccessToken)
      ).rejects.toThrow(
        "Failed to fetch accounts and balances: 401 Invalid token"
      );
    });

    it("should handle empty query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(mockListAccountsResponse),
      } as Response);

      await service.fetchAccountsAndBalances(userAccessToken, {});

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tink.com/data/v2/accounts",
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  describe("processAccountsWithBalances", () => {
    it("should process accounts with booked balances", () => {
      const accounts = [mockTinkAccount];
      const result = service.processAccountsWithBalances(accounts);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockTinkAccount,
        processedBalance: {
          amount: 1500.0,
          currency: "EUR",
        },
      });
    });

    it("should handle accounts without balances", () => {
      const accounts = [mockTinkAccountWithoutBalance];
      const result = service.processAccountsWithBalances(accounts);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockTinkAccountWithoutBalance,
        processedBalance: undefined,
      });
    });

    it("should handle mixed accounts with and without balances", () => {
      const accounts = [mockTinkAccount, mockTinkAccountWithoutBalance];
      const result = service.processAccountsWithBalances(accounts);

      expect(result).toHaveLength(2);
      expect(result[0].processedBalance).toBeDefined();
      expect(result[1].processedBalance).toBeUndefined();
    });

    it("should correctly process different scales", () => {
      const accountWithDifferentScale = {
        ...mockTinkAccount,
        balances: {
          booked: {
            amount: {
              currencyCode: "USD",
              value: {
                scale: "3",
                unscaledValue: "1500000", // 1500.000 USD
              },
            },
          },
        },
      };

      const result = service.processAccountsWithBalances([
        accountWithDifferentScale,
      ]);

      expect(result[0].processedBalance).toEqual({
        amount: 1500.0,
        currency: "USD",
      });
    });
  });

  describe("getAccountsFromDb", () => {
    it("should fetch accounts from database", async () => {
      // Create a simple mock database
      const mockSelect = vi.fn();
      const mockFrom = vi.fn();
      const mockWhere = vi.fn().mockResolvedValue([mockBankAccount]);

      mockFrom.mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      const mockDb = {
        select: mockSelect,
      } as unknown as NodePgDatabase<typeof schema>;

      const result = await service.getAccountsFromDb(mockDb, "user-123");

      expect(result).toEqual([mockBankAccount]);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("should apply pagination when provided", async () => {
      const mockLimit = vi.fn();
      const mockOffset = vi.fn().mockResolvedValue([mockBankAccount]);
      const mockSelect = vi.fn();
      const mockFrom = vi.fn();
      const mockWhere = vi.fn();

      mockLimit.mockReturnValue({ offset: mockOffset });
      mockWhere.mockReturnValue({ limit: mockLimit, offset: mockOffset });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({ from: mockFrom });

      const mockDb = {
        select: mockSelect,
      } as unknown as NodePgDatabase<typeof schema>;

      await service.getAccountsFromDb(mockDb, "user-123", {
        limit: 10,
        offset: 20,
      });

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe("balance processing edge cases", () => {
    it("should handle zero balance", () => {
      const zeroBalanceAccount = {
        ...mockTinkAccount,
        balances: {
          booked: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "2",
                unscaledValue: "0",
              },
            },
          },
        },
      };

      const result = service.processAccountsWithBalances([zeroBalanceAccount]);
      expect(result[0].processedBalance).toEqual({
        amount: 0,
        currency: "EUR",
      });
    });

    it("should handle negative balance", () => {
      const negativeBalanceAccount = {
        ...mockTinkAccount,
        balances: {
          booked: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "2",
                unscaledValue: "-50000", // -500.00 EUR
              },
            },
          },
        },
      };

      const result = service.processAccountsWithBalances([
        negativeBalanceAccount,
      ]);
      expect(result[0].processedBalance).toEqual({
        amount: -500.0,
        currency: "EUR",
      });
    });

    it("should handle large numbers", () => {
      const largeBalanceAccount = {
        ...mockTinkAccount,
        balances: {
          booked: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "2",
                unscaledValue: "999999999", // 9,999,999.99 EUR
              },
            },
          },
        },
      };

      const result = service.processAccountsWithBalances([largeBalanceAccount]);
      expect(result[0].processedBalance).toEqual({
        amount: 9999999.99,
        currency: "EUR",
      });
    });

    it("should use booked balance when available", () => {
      const accountWithBothBalances = {
        ...mockTinkAccount,
        balances: {
          available: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "2",
                unscaledValue: "140000", // 1400.00 EUR available
              },
            },
          },
          booked: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "2",
                unscaledValue: "150000", // 1500.00 EUR booked
              },
            },
          },
        },
      };

      const result = service.processAccountsWithBalances([
        accountWithBothBalances,
      ]);
      // Should use booked balance as per current implementation
      expect(result[0].processedBalance).toEqual({
        amount: 1500.0,
        currency: "EUR",
      });
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle malformed balance data gracefully", () => {
      const malformedAccount = {
        ...mockTinkAccount,
        balances: {
          booked: {
            amount: {
              currencyCode: "EUR",
              value: {
                scale: "invalid",
                unscaledValue: "not-a-number",
              },
            },
          },
        },
      };

      expect(() => {
        service.processAccountsWithBalances([malformedAccount]);
      }).not.toThrow(); // Should handle gracefully
    });

    it("should handle missing identifiers", () => {
      const accountWithoutIdentifiers = {
        ...mockTinkAccount,
        identifiers: undefined,
      };

      const result = service.processAccountsWithBalances([
        accountWithoutIdentifiers,
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].identifiers).toBeUndefined();
    });

    it("should handle empty accounts array", () => {
      const result = service.processAccountsWithBalances([]);
      expect(result).toEqual([]);
    });
  });

  describe("API integration", () => {
    it("should handle fetch API errors gracefully", async () => {
      // Mock API error for fetchAccountsAndBalances
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      } as Response);

      await expect(
        service.fetchAccountsAndBalances("invalid-token")
      ).rejects.toThrow(
        "Failed to fetch accounts and balances: 500 Server error"
      );
    });

    it("should handle network errors", async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        service.fetchAccountsAndBalances("valid-token")
      ).rejects.toThrow("Network error");
    });
  });
});
