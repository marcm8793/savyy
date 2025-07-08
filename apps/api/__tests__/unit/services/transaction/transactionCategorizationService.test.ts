/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TransactionCategorizationService } from "../../../../src/services/transaction/transactionCategorizationService";
// Import the service for testing
// Types are imported inline where needed
import type { TinkTransaction } from "../../../../src/services/transaction/types";

describe("TransactionCategorizationService", () => {
  let service: TransactionCategorizationService;
  let mockDb: any;

  // Test fixtures
  const mockUserId = "user-123";
  const mockTinkTransaction: TinkTransaction = {
    id: "tx-123",
    accountId: "account-456",
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
    status: "BOOKED",
  };

  const mockCategoryDefinition = {
    mainCategory: "Food & Dining",
    subCategory: "Restaurants",
    isActive: true,
  };

  const mockCategoryRule = {
    id: "rule-123",
    userId: mockUserId,
    ruleType: "merchant",
    pattern: "mcdonalds",
    mainCategory: "Food & Dining",
    subCategory: "Fast Food",
    confidence: "0.95",
    priority: 1,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransactionCategorizationService();

    // Create a flexible mock that can handle both chaining and direct mocking
    let mockResult: any[] = [];

    // Create a chainable mock that can be overridden
    const createChainableMock = () => ({
      from: vi.fn(() => createChainableMock()),
      where: vi.fn(() => createChainableMock()),
      orderBy: vi.fn(() => createChainableMock()),
      limit: vi.fn(() => Promise.resolve(mockResult)),
      then: vi.fn((cb: any) => Promise.resolve(mockResult).then(cb)),
    });

    mockDb = {
      select: vi.fn(() => createChainableMock()),
      // Method to override the result for specific tests
      __setMockResult: (result: any) => {
        mockResult = result;
      },
      // For backward compatibility with existing tests
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    service.clearCache();
  });

  describe("categorizeTransaction", () => {
    it("should use Tink PFM category when available", async () => {
      const transactionWithPfm = {
        ...mockTinkTransaction,
        categories: {
          pfm: {
            id: "pfm-123",
            name: "Food and drink",
          },
        },
      };

      // Mock category validation - use mockImplementation to control return values
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCategoryDefinition]),
        }),
      }));

      const result = await service.categorizeTransaction(
        mockDb,
        mockUserId,
        transactionWithPfm
      );

      expect(result.source).toBe("tink");
      expect(result.mainCategory).toBe("Food & Dining");
      expect(result.subCategory).toBe("Restaurants");
      expect(result.confidence).toBe(0.85);
    });

    it("should apply description patterns", async () => {
      const transactionWithSalary = {
        ...mockTinkTransaction,
        descriptions: {
          display: "Monthly Salary Payment",
          original: "SALARY PAYMENT",
        },
      };

      // Mock database calls - empty user rules and MCC
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
              // First two calls: empty user rules and MCC
              return Promise.resolve([]);
            } else {
              // Subsequent calls: return category validation
              return Promise.resolve([mockCategoryDefinition]);
            }
          }),
        }),
      }));

      const result = await service.categorizeTransaction(
        mockDb,
        mockUserId,
        transactionWithSalary
      );

      expect(result.source).toBe("description");
      expect(result.mainCategory).toBe("Income");
      expect(result.subCategory).toBe("Salary");
    });

    it("should apply amount-based rules for large amounts", async () => {
      // Mock empty user rules and MCC
      mockDb.select.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const largeAmountTransaction = {
        ...mockTinkTransaction,
        amount: {
          currencyCode: "EUR",
          value: {
            scale: "2",
            unscaledValue: "200000", // 2000 EUR
          },
        },
      };

      const result = await service.categorizeTransaction(
        mockDb,
        mockUserId,
        largeAmountTransaction
      );

      expect(result.source).toBe("amount");
      expect(result.mainCategory).toBe("Income");
      expect(result.subCategory).toBe("Other Income");
      expect(result.needsReview).toBe(true);
    });

    it("should return default category when no rules match", async () => {
      // Mock database calls - empty user rules and MCC
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            // Return empty arrays for all calls (no rules match)
            return Promise.resolve([]);
          }),
        }),
      }));

      const result = await service.categorizeTransaction(
        mockDb,
        mockUserId,
        mockTinkTransaction
      );

      expect(result.source).toBe("default");
      // Based on the actual logic, positive amounts default to "Income"
      expect(result.mainCategory).toBe("Income");
      expect(result.subCategory).toBe("Other Income");
      expect(result.needsReview).toBe(true);
    });
  });

  describe("categorizeBatch", () => {
    it("should categorize multiple transactions efficiently", async () => {
      const transactions = [
        mockTinkTransaction,
        { ...mockTinkTransaction, id: "tx-456" },
        { ...mockTinkTransaction, id: "tx-789" },
      ];

      // Mock empty user rules and MCC for all
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            // Return empty arrays for all calls (no rules match)
            return Promise.resolve([]);
          }),
        }),
      }));

      const results = await service.categorizeBatch(
        mockDb,
        mockUserId,
        transactions
      );

      expect(results).toHaveLength(3);
      expect(results[0].categorization.source).toBe("default");
      expect(results[1].categorization.source).toBe("default");
      expect(results[2].categorization.source).toBe("default");
    });
  });

  describe("cache management", () => {
    it("should clear cache properly", () => {
      service.clearCache();

      // Cache should be empty after clearing
      expect((service as any).userRulesCache.size).toBe(0);
      expect((service as any).mccMappingCache.size).toBe(0);
      expect((service as any).validCategoriesCache.size).toBe(0);
    });
  });

  describe("rule matching", () => {
    it("should match merchant rules correctly", () => {
      const rule = {
        ...mockCategoryRule,
        ruleType: "merchant",
        pattern: "starbucks",
      };

      const transaction = {
        ...mockTinkTransaction,
        merchantInformation: {
          merchantName: "Starbucks Coffee Shop",
        },
      };

      const matches = (service as any).ruleMatches(rule, transaction);
      expect(matches).toBe(true);
    });

    it("should match description rules correctly", () => {
      const rule = {
        ...mockCategoryRule,
        ruleType: "description",
        pattern: "salary",
      };

      const transaction = {
        ...mockTinkTransaction,
        descriptions: {
          display: "Monthly Salary Payment",
          original: "SALARY",
        },
      };

      const matches = (service as any).ruleMatches(rule, transaction);
      expect(matches).toBe(true);
    });

    it("should match MCC rules correctly", () => {
      const rule = {
        ...mockCategoryRule,
        ruleType: "mcc",
        pattern: "5814",
      };

      const transaction = {
        ...mockTinkTransaction,
        merchantInformation: {
          merchantCategoryCode: "5814",
        },
      };

      const matches = (service as any).ruleMatches(rule, transaction);
      expect(matches).toBe(true);
    });

    it("should match amount range rules correctly", () => {
      const rule = {
        ...mockCategoryRule,
        ruleType: "amount_range",
        amountMin: "50",
        amountMax: "200",
      };

      const transaction = {
        ...mockTinkTransaction,
        amount: {
          currencyCode: "EUR",
          value: {
            scale: "2",
            unscaledValue: "10000", // 100 EUR
          },
        },
      };

      const matches = (service as any).ruleMatches(rule, transaction);
      expect(matches).toBe(true);
    });
  });

  describe("amount parsing", () => {
    it("should parse amount correctly", () => {
      const amount = {
        currencyCode: "EUR",
        value: {
          scale: "2",
          unscaledValue: "12345",
        },
      };

      const parsed = (service as any).parseAmount(amount);
      expect(parsed).toBe(123.45);
    });

    it("should handle zero scale", () => {
      const amount = {
        currencyCode: "EUR",
        value: {
          scale: "0",
          unscaledValue: "100",
        },
      };

      const parsed = (service as any).parseAmount(amount);
      expect(parsed).toBe(100);
    });
  });

  describe("Tink category mapping", () => {
    it("should map known Tink categories", () => {
      const mapping = (service as any).mapTinkCategoryToOurs("Food and drink");
      expect(mapping).toEqual({
        mainCategory: "Food & Dining",
        subCategory: "Restaurants",
      });
    });

    it("should return null for unknown Tink categories", () => {
      const mapping = (service as any).mapTinkCategoryToOurs(
        "Unknown Category"
      );
      expect(mapping).toBe(null);
    });
  });
});
