/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TinkTransaction } from "../../../../src/services/transaction/types";

// Mock the encryption service before importing anything that uses it
vi.mock("../../../../src/services/encryptionService", () => {
  const mockEncryptionService = {
    encrypt: vi.fn().mockResolvedValue({
      encryptedData: "encrypted-data",
      iv: "mock-iv",
      authTag: "mock-auth-tag",
      keyId: "mock-key-id",
    }),
    decrypt: vi.fn().mockResolvedValue("decrypted-data"),
    getActiveKeyId: vi.fn().mockResolvedValue("mock-key-id"),
  };
  return {
    getEncryptionService: vi.fn(() => mockEncryptionService),
    resetEncryptionService: vi.fn(),
  };
});

// Mock the AI categorization service
vi.mock(
  "../../../../src/services/transaction/aiCategorizationService"
);

// Import after mocking
import { TransactionStorageService } from "../../../../src/services/transaction/transactionStorageService";
import { AICategorizationService } from "../../../../src/services/transaction/aiCategorizationService";

describe("TransactionStorageService", () => {
  let service: TransactionStorageService;
  let mockDb: any;
  let mockTransaction: any;
  let mockCategorizationService: any;

  // Test fixtures
  const mockUserId = "user-123";
  const mockBankAccountId = "bank-acc-456";
  const mockTinkAccountId = "tink-acc-789";

  const mockTinkTransaction: TinkTransaction = {
    id: "tx-123",
    accountId: mockTinkAccountId,
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
    merchantInformation: {
      merchantName: "Test Merchant",
      merchantCategoryCode: "5814",
    },
    categories: {
      pfm: {
        id: "pfm-123",
        name: "Food and drink",
      },
    },
    identifiers: {
      providerTransactionId: "provider-123",
    },
    types: {
      type: "CARD_PAYMENT",
      financialInstitutionTypeCode: "FI001",
    },
    reference: "REF123",
  };

  const mockCategorization = new Map([
    [mockTinkTransaction.id, {
      mainCategory: "Food & Dining",
      subCategory: "Restaurants",
      userModified: false,
    }]
  ]);

  const mockBankAccount = {
    id: mockBankAccountId,
    tinkAccountId: mockTinkAccountId,
    userId: mockUserId,
    name: "Test Bank Account",
    lastRefreshed: new Date(),
    lastIncrementalSync: new Date(),
    consentStatus: "GRANTED",
    consentExpiresAt: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransactionStorageService();

    // Get mocked AI categorization service
    mockCategorizationService = vi.mocked(AICategorizationService.prototype);

    // Create flexible mocks for database operations
    let mockResult = [mockBankAccount];
    let mockTransactionResult = [
      {
        id: "internal-123",
        tinkTransactionId: "tx-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Create a chainable mock that can be overridden
    const createChainableMock = (resultSet = mockResult) => ({
      from: vi.fn(() => createChainableMock(resultSet)),
      where: vi.fn(() => createChainableMock(resultSet)),
      limit: vi.fn(() => Promise.resolve(resultSet)),
      then: vi.fn((cb) => Promise.resolve(resultSet).then(cb)),
      values: vi.fn(() => createChainableMock(resultSet)),
      onConflictDoUpdate: vi.fn(() => createChainableMock(resultSet)),
      set: vi.fn(() => createChainableMock(resultSet)),
      returning: vi.fn(() => Promise.resolve(mockTransactionResult)),
    });

    // Mock database transaction wrapper
    mockTransaction = {
      insert: vi.fn(() => createChainableMock()),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn(() => Promise.resolve(mockTransactionResult)),
      update: vi.fn(() => createChainableMock()),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn(() => createChainableMock()),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // Mock database
    mockDb = {
      transaction: vi
        .fn()
        .mockImplementation((callback) => callback(mockTransaction)),
      update: vi.fn(() => createChainableMock()),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn(() => createChainableMock()),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      // Method to override the result for specific tests
      __setMockResult: (result: any) => {
        mockResult = result;
      },
      __setTransactionResult: (result: any) => {
        mockTransactionResult = result;
      },
    };

    // Default mock implementations
    mockCategorizationService.categorizeBatch.mockResolvedValue(
      mockCategorization
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("storeTransactionsWithUpsert", () => {
    it("should handle categorization errors gracefully", async () => {
      // Mock AI service to return fallback categorization
      const fallbackCategorization = new Map([
        [mockTinkTransaction.id, {
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        }]
      ]);
      
      mockCategorizationService.categorizeBatch.mockResolvedValue(
        fallbackCategorization
      );

      const result = await service.storeTransactionsWithUpsert(
        mockDb,
        mockUserId,
        mockBankAccountId,
        [mockTinkTransaction]
      );

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle transactions with minimal data", async () => {
      const minimalTransaction: TinkTransaction = {
        id: "tx-minimal",
        accountId: mockTinkAccountId,
        amount: {
          currencyCode: "EUR",
          value: {
            scale: "2",
            unscaledValue: "5000",
          },
        },
        dates: {
          booked: "2024-01-15",
        },
        descriptions: {
          display: "Minimal Transaction",
          original: "MINIMAL",
        },
        status: "BOOKED",
      };

      const minimalCategorization = new Map([
        [minimalTransaction.id, {
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        }]
      ]);

      mockCategorizationService.categorizeBatch.mockResolvedValue(
        minimalCategorization
      );

      const result = await service.storeTransactionsWithUpsert(
        mockDb,
        mockUserId,
        mockBankAccountId,
        [minimalTransaction]
      );

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("data mapping and truncation", () => {
    it("should handle null/undefined values gracefully", async () => {
      const sparseTransaction: TinkTransaction = {
        id: "tx-sparse",
        accountId: mockTinkAccountId,
        amount: {
          currencyCode: "EUR",
          value: {
            scale: "2",
            unscaledValue: "5000",
          },
        },
        dates: {
          booked: "2024-01-15",
          // value is optional
        },
        descriptions: {
          display: "Sparse Transaction",
          original: "SPARSE",
        },
        status: "BOOKED",
        // All optional fields omitted
      };

      const sparseCategorization = new Map([
        [sparseTransaction.id, {
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        }]
      ]);

      mockCategorizationService.categorizeBatch.mockResolvedValue(
        sparseCategorization
      );

      const result = await service.storeTransactionsWithUpsert(
        mockDb,
        mockUserId,
        mockBankAccountId,
        [sparseTransaction]
      );

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
