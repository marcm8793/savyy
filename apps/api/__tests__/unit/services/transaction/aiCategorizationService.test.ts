/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AICategorizationService,
  CategorizationResult,
} from "../../../../src/services/transaction/aiCategorizationService";
import { TinkTransaction } from "../../../../src/services/transaction/types";

// Mock fetch for AI API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe("AICategorizationService", () => {
  let service: AICategorizationService;
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      AI_API_KEY: mockApiKey,
      AI_API_URL: "https://test-api.com/v1/messages",
      AI_MODEL: "claude-3-haiku-20240307",
      AI_BATCH_SIZE: "5",
      AI_API_TIMEOUT: "10000",
    };

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Constructor and Environment Variables", () => {
    it("should create service with valid API key", () => {
      expect(() => new AICategorizationService()).not.toThrow();
    });

    it("should throw error when AI_API_KEY is missing", () => {
      delete process.env.AI_API_KEY;
      expect(() => new AICategorizationService()).toThrow(
        "AI_API_KEY environment variable is required"
      );
    });

    it("should use default values for optional environment variables", () => {
      delete process.env.AI_BATCH_SIZE;
      delete process.env.AI_API_URL;
      delete process.env.AI_MODEL;
      delete process.env.AI_API_TIMEOUT;

      const service = new AICategorizationService();
      expect(service).toBeDefined();
    });

    it("should handle invalid AI_BATCH_SIZE gracefully", () => {
      process.env.AI_BATCH_SIZE = "invalid";
      const service = new AICategorizationService();
      expect(service).toBeDefined();
    });
  });

  describe("Transaction Anonymization", () => {
    beforeEach(() => {
      service = new AICategorizationService();
    });

    it("should anonymize merchant information correctly", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "-12345", scale: "2" },
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

      const anonymized = (service as any).anonymizeTransaction(transaction);

      expect(anonymized.merchantHash).toBeDefined();
      expect(anonymized.merchantHash).toHaveLength(8);
      expect(anonymized.descriptionSanitized).toBe("Netflix Subscription");
      expect(anonymized.amount).toBe(123.45);
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

      const anonymized = (service as any).anonymizeTransaction(transaction);

      expect(anonymized.merchantHash).toBeDefined();
      expect(anonymized.descriptionSanitized).toBe("Salary Payment");
      expect(anonymized.amount).toBe(500);
      expect(anonymized.transactionType).toBe("credit");
    });

    it("should sanitize account numbers from descriptions", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "-2500", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Transfer to account 123456789 ref 987654321",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = (service as any).anonymizeTransaction(transaction);

      expect(anonymized.descriptionSanitized).toBe(
        "Transfer to account [NUMBER] ref [NUMBER]"
      );
    });

    it("should sanitize IBAN from descriptions", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "-10000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Transfer to GB82WEST12345698765432",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = (service as any).anonymizeTransaction(transaction);

      expect(anonymized.descriptionSanitized).toContain("[IBAN]");
      expect(anonymized.descriptionSanitized).not.toContain(
        "GB82WEST12345698765432"
      );
    });

    it("should sanitize sensitive number sequences from descriptions", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "-10000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Card payment 1234 5678 9012 3456 at Store",
          original: "",
        },
        status: "BOOKED",
      };

      const anonymized = (service as any).anonymizeTransaction(transaction);

      // Number replacement happens first, so we get [NUMBER] for each 4-digit group
      expect(anonymized.descriptionSanitized).toBe(
        "Card payment [NUMBER] [NUMBER] [NUMBER] [NUMBER] at Store"
      );
      expect(anonymized.descriptionSanitized).not.toContain("1234");
    });

    it("should handle missing descriptions gracefully", () => {
      const transaction: TinkTransaction = {
        id: "tx-123",
        accountId: "acc-123",
        amount: {
          value: { unscaledValue: "-5000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        status: "BOOKED",
        descriptions: {
          display: "",
          original: "",
        },
      };

      const anonymized = (service as any).anonymizeTransaction(transaction);

      expect(anonymized.descriptionSanitized).toBe("");
      expect(anonymized.merchantHash).toBeDefined();
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

        const anonymized = (service as any).anonymizeTransaction(transaction);
        expect(anonymized.amount).toBe(expected);
      });
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

      const anonymized = (service as any).anonymizeTransaction(transaction);
      // When scale is undefined, parseInt(undefined) = NaN, so Math.pow(10, NaN) = NaN
      // The amount calculation results in NaN
      expect(isNaN(anonymized.amount)).toBe(true);
    });
  });

  describe("Category Validation", () => {
    beforeEach(() => {
      service = new AICategorizationService();

      // Mock the category cache directly
      (service as any).categoryCache = [
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
    });

    it("should validate correct category pairs", () => {
      const validPairs = [
        ["Bills & Utilities", "Subscription - Others"],
        ["Bills & Utilities", "Internet"],
        ["Shopping", "Shopping - Others"],
        ["To Classify", "Needs Review"],
      ];

      validPairs.forEach(([mainCategory, subCategory]) => {
        const isValid = (service as any).validateCategoryPair(
          mainCategory,
          subCategory
        );
        expect(isValid).toBe(true);
      });
    });

    it("should reject invalid main categories", () => {
      const isValid = (service as any).validateCategoryPair(
        "Invalid Category",
        "Subscription - Others"
      );
      expect(isValid).toBe(false);
    });

    it("should reject invalid subcategories", () => {
      const isValid = (service as any).validateCategoryPair(
        "Bills & Utilities",
        "Invalid Subcategory"
      );
      expect(isValid).toBe(false);
    });

    it("should reject subcategory under wrong main category", () => {
      const isValid = (service as any).validateCategoryPair(
        "Shopping",
        "Internet"
      );
      expect(isValid).toBe(false);
    });

    it("should handle empty category cache", () => {
      (service as any).categoryCache = null;
      const isValid = (service as any).validateCategoryPair(
        "Bills & Utilities",
        "Internet"
      );
      expect(isValid).toBe(false);
    });

    it("should handle empty strings", () => {
      const isValid = (service as any).validateCategoryPair("", "");
      expect(isValid).toBe(false);
    });
  });

  describe("AI Response Parsing", () => {
    beforeEach(() => {
      service = new AICategorizationService();

      // Mock the category cache for validation
      (service as any).categoryCache = [
        {
          mainCategory: "Bills & Utilities",
          subcategories: ["Subscription - Others"],
        },
        {
          mainCategory: "To Classify",
          subcategories: ["Needs Review"],
        },
      ];
    });

    it("should parse valid JSON response correctly", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
      ]`;

      const results = (service as any).parseAIResponse(validResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      });
    });

    it("should handle JSON wrapped in markdown", () => {
      const markdownResponse = `Here are the categorizations:

\`\`\`json
[
  {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
]
\`\`\`

Hope this helps!`;

      const results = (service as any).parseAIResponse(markdownResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0].mainCategory).toBe("Bills & Utilities");
    });

    it("should fallback invalid categories to 'To Classify'", () => {
      const invalidResponse = `[
        {"mainCategory": "Invalid Category", "subCategory": "Invalid Subcategory"}
      ]`;

      const results = (service as any).parseAIResponse(invalidResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should handle mixed valid and invalid responses", () => {
      const mixedResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"},
        {"mainCategory": "Invalid Category", "subCategory": "Invalid Subcategory"}
      ]`;

      const results = (service as any).parseAIResponse(mixedResponse, 2);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      });
      expect(results[1]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should handle malformed JSON gracefully", () => {
      const malformedResponse = `[{"mainCategory": "Bills & Utilities", "subCategory": }]`;

      const results = (service as any).parseAIResponse(malformedResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should handle count mismatch", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
      ]`;

      const results = (service as any).parseAIResponse(validResponse, 2);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should handle missing JSON array", () => {
      const invalidResponse = `This is not a JSON response`;

      const results = (service as any).parseAIResponse(invalidResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should handle incomplete response objects", () => {
      const incompleteResponse = `[
        {"mainCategory": "Bills & Utilities"},
        {"subCategory": "Subscription - Others"},
        {}
      ]`;

      const results = (service as any).parseAIResponse(incompleteResponse, 3);

      expect(results).toHaveLength(3);
      results.forEach((result: CategorizationResult) => {
        expect(result.mainCategory).toBeDefined();
        expect(result.subCategory).toBeDefined();
        expect(result.userModified).toBe(false);
      });
    });
  });

  describe("System and User Prompt Generation", () => {
    beforeEach(() => {
      service = new AICategorizationService();
    });

    it("should generate system prompt with category structure", () => {
      const categories = [
        {
          mainCategory: "Bills & Utilities",
          subcategories: ["Subscription - Others", "Internet"],
        },
        {
          mainCategory: "Shopping",
          subcategories: ["Shopping - Others"],
        },
      ];

      const systemPrompt = (service as any).buildSystemPrompt(categories);

      expect(systemPrompt).toContain(
        "Bills & Utilities: Subscription - Others, Internet"
      );
      expect(systemPrompt).toContain("Shopping: Shopping - Others");
      expect(systemPrompt).toContain("CRITICAL RULES - STRICTLY ENFORCE");
      expect(systemPrompt).toContain("DO NOT invent new categories");
      expect(systemPrompt).toContain(
        "Any invented categories will be rejected"
      );
    });

    it("should generate user prompt with anonymized transactions", () => {
      const transactions = [
        {
          merchantHash: "abcd1234",
          descriptionSanitized: "Netflix Subscription",
          amount: 12.99,
          transactionType: "debit" as const,
        },
        {
          merchantHash: "efgh5678",
          descriptionSanitized: "Amazon Purchase",
          amount: 25.0,
          transactionType: "debit" as const,
        },
      ];

      const userPrompt = (service as any).buildUserPrompt(transactions);

      expect(userPrompt).toContain(
        "Please categorize these 2 anonymized transactions"
      );
      expect(userPrompt).toContain(
        '1. Merchant: abcd1234, Description: "Netflix Subscription", Amount: 12.99 debit'
      );
      expect(userPrompt).toContain(
        '2. Merchant: efgh5678, Description: "Amazon Purchase", Amount: 25 debit'
      );
      expect(userPrompt).toContain(
        "Return a JSON array with exactly 2 categorization results"
      );
    });

    it("should handle empty category list in system prompt", () => {
      const systemPrompt = (service as any).buildSystemPrompt([]);
      expect(systemPrompt).toContain("Available Categories");
      expect(systemPrompt).toContain("CRITICAL RULES");
    });

    it("should handle empty transaction list in user prompt", () => {
      const userPrompt = (service as any).buildUserPrompt([]);
      expect(userPrompt).toContain(
        "Please categorize these 0 anonymized transactions"
      );
      expect(userPrompt).toContain(
        "Return a JSON array with exactly 0 categorization results"
      );
    });
  });

  describe("Edge Cases and Error Handling", () => {
    beforeEach(() => {
      service = new AICategorizationService();
    });

    it("should handle very large transaction amounts", () => {
      const transaction: TinkTransaction = {
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

      const anonymized = (service as any).anonymizeTransaction(transaction);
      expect(anonymized.amount).toBe(9999999999.99);
      expect(anonymized.transactionType).toBe("debit");
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

      const anonymized = (service as any).anonymizeTransaction(transaction);
      expect(anonymized.amount).toBe(0);
      expect(anonymized.transactionType).toBe("credit");
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

      const anonymized = (service as any).anonymizeTransaction(transaction);
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

      const anonymized = (service as any).anonymizeTransaction(transaction);
      expect(anonymized.descriptionSanitized).toBe(
        "Café & Restaurant München €[NUMBER] ñoño"
      );
    });

    it("should generate consistent merchant hashes", () => {
      const transaction1: TinkTransaction = {
        id: "tx-1",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "-1000", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-15" },
        descriptions: {
          display: "Netflix",
          original: "",
        },
        merchantInformation: { merchantName: "Netflix Inc." },
        status: "BOOKED",
      };

      const transaction2: TinkTransaction = {
        id: "tx-2",
        accountId: "acc-1",
        amount: {
          value: { unscaledValue: "-1500", scale: "2" },
          currencyCode: "EUR",
        },
        dates: { booked: "2024-01-16" },
        descriptions: {
          display: "Netflix",
          original: "",
        },
        merchantInformation: { merchantName: "Netflix Inc." },
        status: "BOOKED",
      };

      const anonymized1 = (service as any).anonymizeTransaction(transaction1);
      const anonymized2 = (service as any).anonymizeTransaction(transaction2);

      expect(anonymized1.merchantHash).toBe(anonymized2.merchantHash);
    });
  });

  describe("Critical Category Validation Integration", () => {
    beforeEach(() => {
      service = new AICategorizationService();

      // Mock the category cache for validation
      (service as any).categoryCache = [
        {
          mainCategory: "Bills & Utilities",
          subcategories: ["Subscription - Others", "Internet"],
        },
        {
          mainCategory: "To Classify",
          subcategories: ["Needs Review"],
        },
      ];
    });

    it("should reject AI responses with invented main categories", () => {
      const invalidResponse = `[
        {"mainCategory": "Subscription - Others", "subCategory": "Netflix"}
      ]`;

      const results = (service as any).parseAIResponse(invalidResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should reject AI responses with invented subcategories", () => {
      const invalidResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Netflix"}
      ]`;

      const results = (service as any).parseAIResponse(invalidResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });

    it("should accept valid AI responses", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
      ]`;

      const results = (service as any).parseAIResponse(validResponse, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      });
    });

    it("should log warnings when AI returns invalid categories", () => {
      const consoleSpy = vi.spyOn(console, "warn");

      const invalidResponse = `[
        {"mainCategory": "Invented Category", "subCategory": "Invented Subcategory"}
      ]`;

      (service as any).parseAIResponse(invalidResponse, 1);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("AI returned invalid category combination"),
        expect.stringContaining("Invented Category")
      );
    });
  });
});
