/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIService } from "../services/AIService";
import { AIServiceConfig, Logger, AnonymizedTransaction, CategoryStructure } from "../types";

// Mock fetch for AI API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("AIService", () => {
  let service: AIService;
  let config: AIServiceConfig;

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

  const mockTransactions: AnonymizedTransaction[] = [
    {
      merchantHash: "abcd1234",
      descriptionSanitized: "Netflix Subscription",
      amount: 12.99,
      transactionType: "debit",
    },
    {
      merchantHash: "efgh5678",
      descriptionSanitized: "Amazon Purchase",
      amount: 25.0,
      transactionType: "debit",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      apiKey: "test-api-key",
      apiUrl: "https://test-api.com/v1/messages",
      model: "claude-3-haiku-20240307",
      timeout: 10000,
      maxTokens: 4000,
      temperature: 0,
    };
    service = new AIService(config, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with valid configuration", () => {
      expect(service).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "AIService initialized",
        expect.objectContaining({
          apiUrl: config.apiUrl,
          model: config.model,
          timeout: config.timeout,
          hasApiKey: true,
        })
      );
    });

    it("should throw error with invalid configuration", () => {
      const invalidConfig = { ...config, apiKey: "" };
      expect(() => new AIService(invalidConfig, mockLogger)).toThrow(
        "Invalid AI service configuration"
      );
    });

    it("should throw error with missing API URL", () => {
      const invalidConfig = { ...config, apiUrl: "" };
      expect(() => new AIService(invalidConfig, mockLogger)).toThrow(
        "Invalid AI service configuration"
      );
    });

    it("should throw error with invalid timeout", () => {
      const invalidConfig = { ...config, timeout: 0 };
      expect(() => new AIService(invalidConfig, mockLogger)).toThrow(
        "Invalid AI service configuration"
      );
    });
  });

  describe("buildSystemPrompt", () => {
    it("should generate system prompt with category structure", () => {
      const systemPrompt = service.buildSystemPrompt(mockCategories);

      expect(systemPrompt).toContain("Bills & Utilities: Subscription - Others, Internet");
      expect(systemPrompt).toContain("Shopping: Shopping - Others");
      expect(systemPrompt).toContain("To Classify: Needs Review");
      expect(systemPrompt).toContain("CRITICAL RULES - STRICTLY ENFORCE");
      expect(systemPrompt).toContain("DO NOT invent new categories");
      expect(systemPrompt).toContain("Any invented categories will be rejected");
    });

    it("should handle empty category list", () => {
      const systemPrompt = service.buildSystemPrompt([]);
      expect(systemPrompt).toContain("Available Categories");
      expect(systemPrompt).toContain("CRITICAL RULES");
    });
  });

  describe("buildUserPrompt", () => {
    it("should generate user prompt with anonymized transactions", () => {
      const userPrompt = service.buildUserPrompt(mockTransactions);

      expect(userPrompt).toContain("Please categorize these 2 anonymized transactions");
      expect(userPrompt).toContain(
        '1. Merchant: abcd1234, Description: "Netflix Subscription", Amount: 12.99 debit'
      );
      expect(userPrompt).toContain(
        '2. Merchant: efgh5678, Description: "Amazon Purchase", Amount: 25 debit'
      );
      expect(userPrompt).toContain("Return a JSON array with exactly 2 categorization results");
    });

    it("should handle empty transaction list", () => {
      const userPrompt = service.buildUserPrompt([]);
      expect(userPrompt).toContain("Please categorize these 0 anonymized transactions");
      expect(userPrompt).toContain("Return a JSON array with exactly 0 categorization results");
    });
  });

  describe("callAIApi", () => {
    it("should make successful API call", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '[{"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}]' }],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const systemPrompt = service.buildSystemPrompt(mockCategories);
      const userPrompt = service.buildUserPrompt([mockTransactions[0]]);

      const result = await service.callAIApi(systemPrompt, userPrompt);

      expect(mockFetch).toHaveBeenCalledWith(
        config.apiUrl,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          }),
          body: expect.stringContaining('"model":"claude-3-haiku-20240307"'),
        })
      );

      expect(result.content?.[0]?.text).toContain("Bills & Utilities");
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const systemPrompt = service.buildSystemPrompt(mockCategories);
      const userPrompt = service.buildUserPrompt([mockTransactions[0]]);

      await expect(service.callAIApi(systemPrompt, userPrompt)).rejects.toThrow(
        "AI API error: 400 Bad Request"
      );
    });

    it("should handle timeout", async () => {
      const timeoutConfig = { ...config, timeout: 1 };
      const timeoutService = new AIService(timeoutConfig, mockLogger);

      // Mock a delayed response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const systemPrompt = timeoutService.buildSystemPrompt(mockCategories);
      const userPrompt = timeoutService.buildUserPrompt([mockTransactions[0]]);

      await expect(timeoutService.callAIApi(systemPrompt, userPrompt)).rejects.toThrow(
        "AI API timeout after 1ms"
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse valid JSON response correctly", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
      ]`;

      const results = service.parseResponse(validResponse, 1, mockCategories);

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

      const results = service.parseResponse(markdownResponse, 1, mockCategories);

      expect(results).toHaveLength(1);
      expect(results[0].mainCategory).toBe("Bills & Utilities");
    });

    it("should fallback invalid categories to 'To Classify'", () => {
      const invalidResponse = `[
        {"mainCategory": "Invalid Category", "subCategory": "Invalid Subcategory"}
      ]`;

      const results = service.parseResponse(invalidResponse, 1, mockCategories);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AI returned invalid category combination",
        expect.objectContaining({
          index: 0,
          aiMainCategory: "Invalid Category",
          aiSubCategory: "Invalid Subcategory",
        })
      );
    });

    it("should handle mixed valid and invalid responses", () => {
      const mixedResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"},
        {"mainCategory": "Invalid Category", "subCategory": "Invalid Subcategory"}
      ]`;

      const results = service.parseResponse(mixedResponse, 2, mockCategories);

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

      const results = service.parseResponse(malformedResponse, 1, mockCategories);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error parsing AI response",
        expect.objectContaining({
          expectedCount: 1,
        })
      );
    });

    it("should handle count mismatch - fewer results than expected", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}
      ]`;

      const results = service.parseResponse(validResponse, 2, mockCategories);

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

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AI response count mismatch",
        { expected: 2, received: 1 }
      );
    });

    it("should handle count mismatch - more results than expected", () => {
      const validResponse = `[
        {"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"},
        {"mainCategory": "Shopping", "subCategory": "Shopping - Others"},
        {"mainCategory": "Bills & Utilities", "subCategory": "Internet"}
      ]`;

      const results = service.parseResponse(validResponse, 2, mockCategories);

      expect(results).toHaveLength(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "AI response count mismatch",
        { expected: 2, received: 3 }
      );
    });

    it("should handle missing JSON array", () => {
      const invalidResponse = `This is not a JSON response`;

      const results = service.parseResponse(invalidResponse, 1, mockCategories);

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

      const results = service.parseResponse(incompleteResponse, 3, mockCategories);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.mainCategory).toBeDefined();
        expect(result.subCategory).toBeDefined();
        expect(result.userModified).toBe(false);
      });
    });
  });

  describe("classifyTransactions", () => {
    it("should classify transactions successfully", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          content: [{ 
            text: '[{"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}, {"mainCategory": "Shopping", "subCategory": "Shopping - Others"}]' 
          }],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const results = await service.classifyTransactions(mockTransactions, mockCategories);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        mainCategory: "Bills & Utilities",
        subCategory: "Subscription - Others",
        userModified: false,
      });
      expect(results[1]).toEqual({
        mainCategory: "Shopping",
        subCategory: "Shopping - Others",
        userModified: false,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        "AI classification completed successfully",
        expect.objectContaining({
          transactionCount: 2,
          successfulClassifications: 2,
        })
      );
    });

    it("should handle empty transaction batch", async () => {
      const results = await service.classifyTransactions([], mockCategories);

      expect(results).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Empty transaction batch provided for AI classification"
      );
    });

    it("should handle AI API failures", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const results = await service.classifyTransactions(mockTransactions, mockCategories);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result).toEqual({
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        });
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AI classification failed",
        expect.objectContaining({
          error: "AI API error: 500 Internal Server Error",
          transactionCount: 2,
          consecutiveFailures: 1,
        })
      );
    });
  });

  describe("validateConfiguration", () => {
    it("should validate correct configuration", () => {
      expect(service.validateConfiguration()).toBe(true);
    });

    it("should reject empty API key", () => {
      const invalidConfig = { ...config, apiKey: "" };
      const invalidService = new AIService(invalidConfig, mockLogger);
      expect(invalidService.validateConfiguration()).toBe(false);
    });

    it("should reject empty API URL", () => {
      const invalidConfig = { ...config, apiUrl: "" };
      const invalidService = new AIService(invalidConfig, mockLogger);
      expect(invalidService.validateConfiguration()).toBe(false);
    });

    it("should reject invalid timeout", () => {
      const invalidConfig = { ...config, timeout: -1 };
      const invalidService = new AIService(invalidConfig, mockLogger);
      expect(invalidService.validateConfiguration()).toBe(false);
    });
  });

  describe("getHealthStatus", () => {
    it("should return healthy status initially", () => {
      const health = service.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.lastSuccessfulCall).toBe(null);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.configuration).toEqual({
        hasApiKey: true,
        apiUrl: config.apiUrl,
        model: config.model,
        timeout: config.timeout,
      });
    });

    it("should track consecutive failures", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Make multiple failing requests
      for (let i = 0; i < 6; i++) {
        await service.classifyTransactions(mockTransactions, mockCategories);
      }

      const health = service.getHealthStatus();
      expect(health.isHealthy).toBe(false);
      expect(health.consecutiveFailures).toBe(6);
    });

    it("should track successful calls", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          content: [{ 
            text: '[{"mainCategory": "Bills & Utilities", "subCategory": "Subscription - Others"}]' 
          }],
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await service.classifyTransactions([mockTransactions[0]], mockCategories);

      const health = service.getHealthStatus();
      expect(health.isHealthy).toBe(true);
      expect(health.lastSuccessfulCall).toBeInstanceOf(Date);
      expect(health.consecutiveFailures).toBe(0);
    });
  });
});