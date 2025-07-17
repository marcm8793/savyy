/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TransactionCategorizationService } from "../services/TransactionCategorizationService";
import { ICategoryService } from "../interfaces/ICategoryService";
import { IAIService } from "../interfaces/IAIService";
import { TinkTransaction } from "../../../services/transaction/types";
import { 
  TransactionCategorizationConfig, 
  Logger, 
  CategoryStructure
} from "../types";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../../db/schema";

// Mock services
const mockCategoryService: ICategoryService = {
  getCategories: vi.fn(),
  validateCategoryPair: vi.fn(),
  invalidateCache: vi.fn(),
  getFallbackCategory: vi.fn(),
  isCacheValid: vi.fn(),
  getCacheStats: vi.fn(),
};

const mockAIService: IAIService = {
  classifyTransactions: vi.fn(),
  buildSystemPrompt: vi.fn(),
  buildUserPrompt: vi.fn(),
  parseResponse: vi.fn(),
  callAIApi: vi.fn(),
  validateConfiguration: vi.fn(),
  getHealthStatus: vi.fn(),
};

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock database
const mockDb = {} as NodePgDatabase<typeof schema>;

describe("TransactionCategorizationService", () => {
  let service: TransactionCategorizationService;
  let config: TransactionCategorizationConfig;

  // Mock data
  const mockCategories: CategoryStructure[] = [
    {
      mainCategory: "Bills & Utilities",
      subcategories: ["Subscription - Others", "Internet"],
    },
    {
      mainCategory: "Shopping",
      subcategories: ["Shopping - Others"],
    },
    {
      mainCategory: "To Classify",
      subcategories: ["Needs Review"],
    },
  ];

  const mockTinkTransaction: TinkTransaction = {
    id: "tx-123",
    accountId: "acc-123",
    amount: {
      value: { unscaledValue: "-1299", scale: "2" },
      currencyCode: "EUR",
    },
    dates: { booked: "2024-01-15" },
    descriptions: {
      display: "Netflix Subscription",
      original: "Netflix Subscription",
    },
    merchantInformation: { merchantName: "Netflix Inc." },
    status: "BOOKED",
    categories: { pfm: { id: "entertainment", name: "Entertainment" } },
  };

  const mockTinkTransactions: TinkTransaction[] = [
    mockTinkTransaction,
    {
      id: "tx-456",
      accountId: "acc-123",
      amount: {
        value: { unscaledValue: "-2500", scale: "2" },
        currencyCode: "EUR",
      },
      dates: { booked: "2024-01-16" },
      descriptions: {
        display: "Amazon Purchase",
        original: "Amazon Purchase",
      },
      merchantInformation: { merchantName: "Amazon" },
      status: "BOOKED",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      batchSize: 5,
      enableParallelProcessing: false,
    };

    // Set up default mock implementations
    (mockCategoryService.getCategories as any).mockResolvedValue(mockCategories);
    (mockCategoryService.getFallbackCategory as any).mockReturnValue({
      mainCategory: "To Classify",
      subCategory: "Needs Review",
      userModified: false,
    });
    (mockAIService.classifyTransactions as any).mockResolvedValue([
      {
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      },
      {
        mainCategory: "Shopping",
        subCategory: "Shopping - Others",
        userModified: false,
      },
    ]);

    service = new TransactionCategorizationService(
      mockCategoryService,
      mockAIService,
      config,
      mockLogger
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with provided dependencies", () => {
      expect(service).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "TransactionCategorizationService initialized",
        {
          batchSize: config.batchSize,
          enableParallelProcessing: config.enableParallelProcessing,
        }
      );
    });
  });

  describe("anonymizeTransaction", () => {
    it("should anonymize merchant information correctly", () => {
      const anonymized = service.anonymizeTransaction(mockTinkTransaction);

      expect(anonymized.merchantHash).toBeDefined();
      expect(anonymized.merchantHash).toHaveLength(8);
      expect(anonymized.descriptionSanitized).toBe("Netflix Subscription");
      expect(anonymized.amount).toBe(12.99);
      expect(anonymized.transactionType).toBe("debit");
    });

    it("should handle missing merchant information", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "50000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Salary Payment",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(transaction);

      expect(anonymized.merchantHash).toBeDefined();
      expect(anonymized.descriptionSanitized).toBe("Salary Payment");
      expect(anonymized.amount).toBe(500);
      expect(anonymized.transactionType).toBe("credit");
    });

    it("should handle missing scale gracefully", () => {
      const transaction: TinkTransaction = {
        id: "tx-no-scale",
        accountId: "acc-1",
        amount: {
          value: {
            unscaledValue: "-1000",
            scale: "",
          },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "No scale",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(transaction);
      expect(isNaN(anonymized.amount)).toBe(true);
    });

    it("should calculate scaled amounts correctly", () => {
      const testCases = [
        { unscaledValue: "-12345", scale: "2", expected: 123.45 },
        { unscaledValue: "100000", scale: "3", expected: 100 },
        { unscaledValue: "-999", scale: "0", expected: 999 },
        { unscaledValue: "50", scale: "1", expected: 5 },
      ];

      testCases.forEach(({ unscaledValue, scale, expected }) => {
        const transaction: TinkTransaction = {
          id: "tx-123",
          accountId: "acc-123",
          amount: { value: { unscaledValue, scale }, currencyCode: "EUR" },
          dates: { booked: "2024-01-15" },
          status: "BOOKED",
          descriptions: {
            display: "",
            original: "",
          },
        };

        const anonymized = service.anonymizeTransaction(transaction);
        expect(anonymized.amount).toBe(expected);
      });
    });

    it("should handle zero amount transactions", () => {
      const transaction: TinkTransaction = {
        id: "tx-zero",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "0", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Zero amount",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(transaction);
      expect(anonymized.amount).toBe(0);
      expect(anonymized.transactionType).toBe("credit");
    });
  });

  describe("sanitizeDescription", () => {
    it("should sanitize account numbers from descriptions", () => {
      const sanitized = service.sanitizeDescription("Transfer to account 123456789 ref 987654321");
      expect(sanitized).toBe("Transfer to account [NUMBER] ref [NUMBER]");
    });

    it("should sanitize IBAN from descriptions", () => {
      const sanitized = service.sanitizeDescription("Transfer to GB82WEST12345698765432");
      expect(sanitized).toContain("[IBAN]");
      expect(sanitized).not.toContain("GB82WEST12345698765432");
    });

    it("should sanitize credit card patterns", () => {
      const sanitized = service.sanitizeDescription("Card payment 1234 5678 9012 3456 at Store");
      expect(sanitized).toBe("Card payment [CARD] at Store");
    });

    it("should sanitize phone numbers", () => {
      const sanitized = service.sanitizeDescription("Call +1 (555) 123-4567 for support");
      expect(sanitized).toBe("Call [PHONE] for support");
    });

    it("should sanitize email addresses", () => {
      const sanitized = service.sanitizeDescription("Contact support@example.com for help");
      expect(sanitized).toBe("Contact [EMAIL] for help");
    });

    it("should handle empty or invalid descriptions", () => {
      expect(service.sanitizeDescription("")).toBe("");
      expect(service.sanitizeDescription(null as any)).toBe("");
      expect(service.sanitizeDescription(undefined as any)).toBe("");
      expect(service.sanitizeDescription(123 as any)).toBe("");
    });
  });

  describe("createMerchantHash", () => {
    it("should generate consistent merchant hashes", () => {
      const hash1 = service.createMerchantHash("Netflix Inc.");
      const hash2 = service.createMerchantHash("Netflix Inc.");
      const hash3 = service.createMerchantHash("  NETFLIX INC.  ");

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3); // Should handle case and whitespace
      expect(hash1).toHaveLength(8);
    });

    it("should handle empty merchant data", () => {
      const hash = service.createMerchantHash("");
      expect(hash).toHaveLength(8);
      expect(hash).toBe(service.createMerchantHash(null as any));
      expect(hash).toBe(service.createMerchantHash(undefined as any));
    });
  });

  describe("validateTransaction", () => {
    it("should validate correct transactions", () => {
      expect(service.validateTransaction(mockTinkTransaction)).toBe(true);
    });

    it("should reject transactions without ID", () => {
      const invalid = { ...mockTinkTransaction, id: "" };
      expect(service.validateTransaction(invalid)).toBe(false);
    });

    it("should reject transactions without amount", () => {
      const invalid = { ...mockTinkTransaction, amount: null as any };
      expect(service.validateTransaction(invalid)).toBe(false);
    });

    it("should reject transactions without amount value", () => {
      const invalid = { 
        ...mockTinkTransaction, 
        amount: { ...mockTinkTransaction.amount, value: null as any }
      };
      expect(service.validateTransaction(invalid)).toBe(false);
    });

    it("should reject transactions without currency", () => {
      const invalid = { 
        ...mockTinkTransaction, 
        amount: { ...mockTinkTransaction.amount, currencyCode: "" }
      };
      expect(service.validateTransaction(invalid)).toBe(false);
    });

    it("should reject transactions without dates", () => {
      const invalid = { ...mockTinkTransaction, dates: null as any };
      expect(service.validateTransaction(invalid)).toBe(false);
    });

    it("should reject transactions without booked date", () => {
      const invalid = { 
        ...mockTinkTransaction, 
        dates: { ...mockTinkTransaction.dates, booked: "" }
      };
      expect(service.validateTransaction(invalid)).toBe(false);
    });
  });

  describe("categorizeBatch", () => {
    it("should categorize transactions successfully", async () => {
      const results = await service.categorizeBatch(mockDb, mockTinkTransactions);

      expect(results.size).toBe(2);
      expect(results.get("tx-123")).toEqual({
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      });
      expect(results.get("tx-456")).toEqual({
        mainCategory: "Shopping",
        subCategory: "Shopping - Others",
        userModified: false,
      });

      expect(mockCategoryService.getCategories).toHaveBeenCalledWith(mockDb);
      expect(mockAIService.classifyTransactions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            merchantHash: expect.any(String),
            descriptionSanitized: "Netflix Subscription",
            amount: 12.99,
            transactionType: "debit",
          }),
          expect.objectContaining({
            merchantHash: expect.any(String),
            descriptionSanitized: "Amazon Purchase",
            amount: 25,
            transactionType: "debit",
          }),
        ]),
        mockCategories
      );
    });

    it("should handle empty transaction batch", async () => {
      const results = await service.categorizeBatch(mockDb, []);

      expect(results.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith("Empty transaction batch provided");
    });

    it("should handle no available categories", async () => {
      (mockCategoryService.getCategories as any).mockResolvedValueOnce([]);

      const results = await service.categorizeBatch(mockDb, mockTinkTransactions);

      expect(results.size).toBe(2);
      expect(results.get("tx-123")).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
      expect(results.get("tx-456")).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "No categories available for classification"
      );
    });

    it("should handle AI service failures", async () => {
      (mockAIService.classifyTransactions as any).mockRejectedValueOnce(
        new Error("AI service unavailable")
      );

      const results = await service.categorizeBatch(mockDb, mockTinkTransactions);

      expect(results.size).toBe(2);
      results.forEach((result) => {
        expect(result).toEqual({
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        });
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Batch processing failed",
        expect.objectContaining({
          error: "AI service unavailable",
        })
      );
    });

    it("should handle category service failures", async () => {
      (mockCategoryService.getCategories as any).mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const results = await service.categorizeBatch(mockDb, mockTinkTransactions);

      expect(results.size).toBe(2);
      results.forEach((result) => {
        expect(result).toEqual({
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        });
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Batch categorization failed",
        expect.objectContaining({
          error: "Database connection failed",
        })
      );
    });
  });

  describe("processInBatches", () => {
    it("should process transactions in batches", async () => {
      const manyTransactions = Array(12).fill(null).map((_, i) => ({
        ...mockTinkTransaction,
        id: `tx-${i}`,
      }));

      const batchSize = 5;
      const results = await service.processInBatches(mockDb, manyTransactions, batchSize);

      expect(results.processedCount).toBe(12);
      expect(results.results.size).toBe(12);
      expect(results.errors).toHaveLength(0);

      // Should be called 3 times (12 transactions / 5 batch size = 3 batches)
      expect(mockAIService.classifyTransactions).toHaveBeenCalledTimes(3);
    });

    it("should handle invalid transactions in batch", async () => {
      const invalidTransactions = [
        mockTinkTransaction,
        { ...mockTinkTransaction, id: "" }, // Invalid
        { ...mockTinkTransaction, id: "tx-valid-2" },
      ];

      const results = await service.processInBatches(mockDb, invalidTransactions, 5);

      expect(results.processedCount).toBe(2); // Only valid transactions
      expect(results.results.size).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No valid transactions in batch",
        expect.objectContaining({
          batchIndex: 0,
          originalBatchSize: 3,
        })
      );
    });

    it("should handle batch processing errors", async () => {
      (mockAIService.classifyTransactions as any).mockRejectedValueOnce(
        new Error("Batch processing error")
      );

      const results = await service.processInBatches(mockDb, mockTinkTransactions, 5);

      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain("Batch processing error");
      expect(results.results.size).toBe(2); // Fallback results
    });
  });

  describe("getProcessingStats", () => {
    it("should return initial stats", () => {
      const stats = service.getProcessingStats();

      expect(stats).toEqual({
        totalProcessed: 0,
        successfullyProcessed: 0,
        errors: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
      });
    });

    it("should update stats after processing", async () => {
      await service.categorizeBatch(mockDb, mockTinkTransactions);

      const stats = service.getProcessingStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.successfullyProcessed).toBe(2);
      expect(stats.errors).toBe(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.lastProcessedAt).toBeInstanceOf(Date);
    });

    it("should track errors in stats", async () => {
      (mockCategoryService.getCategories as any).mockRejectedValueOnce(
        new Error("Database error")
      );

      await service.categorizeBatch(mockDb, mockTinkTransactions);

      const stats = service.getProcessingStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.successfullyProcessed).toBe(0);
      expect(stats.errors).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large transaction amounts", () => {
      const largeTransaction: TinkTransaction = {
        id: "tx-large",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "-999999999999", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Large transaction",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(largeTransaction);
      expect(anonymized.amount).toBe(9999999999.99);
      expect(anonymized.transactionType).toBe("debit");
    });

    it("should handle very long descriptions", () => {
      const longDescription = "A".repeat(1000);
      const transaction: TinkTransaction = {
        id: "tx-long",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "-1000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: longDescription,
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(transaction);
      expect(anonymized.descriptionSanitized).toBe(longDescription);
      expect(anonymized.merchantHash).toHaveLength(8);
    });

    it("should handle special characters in descriptions", () => {
      const transaction: TinkTransaction = {
        id: "tx-special",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "-5000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Café & Restaurant München €1234 ñoño",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = service.anonymizeTransaction(transaction);
      expect(anonymized.descriptionSanitized).toBe("Café & Restaurant München €[NUMBER] ñoño");
    });
  });
});