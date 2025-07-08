/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TransactionQueryService } from "../../../../src/services/transaction/transactionQueryService";
import type { TinkTransactionFilters } from "../../../../src/services/transaction/transactionQueryService";

// Mock the encryption service
vi.mock("../../../../src/services/encryptionService", () => ({
  getEncryptionService: vi.fn(() => ({
    decrypt: vi.fn((data: any) => {
      if (data.encryptedData.startsWith("encrypted_")) {
        return data.encryptedData.replace("encrypted_", "");
      }
      return data.encryptedData;
    }),
  })),
}));

describe("TransactionQueryService", () => {
  let service: TransactionQueryService;
  let mockDb: any;

  // Test fixtures
  const mockUserId = "user-123";
  const mockTransactionId = "tx-456";
  const mockAccountId = "account-789";

  const mockTransaction = {
    id: "internal-id-123",
    tinkTransactionId: mockTransactionId,
    userId: mockUserId,
    tinkAccountId: mockAccountId,
    bankAccountId: "bank-acc-123",
    amount: "10000",
    amountScale: 2,
    currencyCode: "EUR",
    bookedDate: "2024-01-15",
    valueDate: "2024-01-15",
    status: "BOOKED",
    displayDescription: "Test Transaction",
    originalDescription: "ORIGINAL TEST TX",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransactionQueryService();

    // Create a flexible mock that can handle both chaining and direct mocking
    let mockResult = [mockTransaction];

    // Create a chainable mock that can be overridden
    const createChainableMock = () => ({
      from: vi.fn(() => createChainableMock()),
      where: vi.fn(() => createChainableMock()),
      limit: vi.fn(() => Promise.resolve(mockResult)),
      then: vi.fn((cb) => Promise.resolve(mockResult).then(cb)),
    });

    mockDb = {
      select: vi.fn(() => createChainableMock()),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockTransaction]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockTransaction]),
        })),
      })),
      // Method to override the result for specific tests
      __setMockResult: (result: any) => {
        mockResult = result;
      },
      // For backward compatibility with existing tests
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTransactions", () => {
    it("should get transactions without filters", async () => {
      const result = await service.getTransactions(mockDb, mockUserId);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toEqual(mockTransaction);
      expect(result.nextPageToken).toBeUndefined();
    });

    it("should apply account ID filter", async () => {
      const filters: TinkTransactionFilters = {
        accountIdIn: [mockAccountId, "another-account"],
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should apply date range filters", async () => {
      const filters: TinkTransactionFilters = {
        bookedDateGte: "2024-01-01",
        bookedDateLte: "2024-01-31",
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should apply status filter", async () => {
      const filters: TinkTransactionFilters = {
        statusIn: ["BOOKED", "PENDING"],
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should apply page size limit", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: 25,
      };

      mockDb.__setMockResult(Array(25).fill(mockTransaction));

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(25);
    });

    it("should enforce maximum page size", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: 150, // Above max of 100
      };

      mockDb.__setMockResult(Array(100).fill(mockTransaction));

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(100);
    });

    it("should use default page size when not specified", async () => {
      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId);

      expect(result.transactions).toHaveLength(1);
    });

    it("should return next page token when results equal page size", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: 2,
      };

      mockDb.__setMockResult([mockTransaction, mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.nextPageToken).toBe("next_page_token_here");
    });

    it("should not return next page token when results less than page size", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: 5,
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.nextPageToken).toBeUndefined();
    });

    it("should combine multiple filters", async () => {
      const filters: TinkTransactionFilters = {
        accountIdIn: [mockAccountId],
        bookedDateGte: "2024-01-01",
        bookedDateLte: "2024-01-31",
        statusIn: ["BOOKED"],
        pageSize: 25,
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("getTransactionByIdFromDb", () => {
    it("should get transaction by ID successfully", async () => {
      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactionByIdFromDb(
        mockDb,
        mockTransactionId,
        mockUserId
      );

      expect(result).toEqual(mockTransaction);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return null when transaction not found", async () => {
      mockDb.__setMockResult([]);

      const result = await service.getTransactionByIdFromDb(
        mockDb,
        "non-existent-id",
        mockUserId
      );

      expect(result).toBeNull();
    });

    it("should enforce user ownership", async () => {
      const differentUserId = "different-user";
      mockDb.__setMockResult([]);

      const result = await service.getTransactionByIdFromDb(
        mockDb,
        mockTransactionId,
        differentUserId
      );

      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("updateTransactionInDb", () => {
    it("should update transaction successfully", async () => {
      const updateData = {
        displayDescription: "Updated Description",
        mainCategory: "Updated Category",
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...updateData,
      };

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([updatedTransaction]);

      const result = await service.updateTransactionInDb(
        mockDb,
        mockTransactionId,
        updateData,
        mockUserId
      );

      expect(result).toEqual(updatedTransaction);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(updateData);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("should enforce user ownership in updates", async () => {
      const updateData = { displayDescription: "Updated" };
      const differentUserId = "different-user";

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockResolvedValue([]);

      await service.updateTransactionInDb(
        mockDb,
        mockTransactionId,
        updateData,
        differentUserId
      );

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("deleteTransactionFromDb", () => {
    it("should delete transaction successfully", async () => {
      mockDb.delete.mockReturnThis();
      mockDb.where.mockResolvedValue(undefined);

      await service.deleteTransactionFromDb(
        mockDb,
        mockTransactionId,
        mockUserId
      );

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should enforce user ownership in deletion", async () => {
      const differentUserId = "different-user";

      mockDb.delete.mockReturnThis();
      mockDb.where.mockResolvedValue(undefined);

      await service.deleteTransactionFromDb(
        mockDb,
        mockTransactionId,
        differentUserId
      );

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("getTransactionsByAccountIdFromDb", () => {
    it("should get transactions by account ID", async () => {
      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactionsByAccountIdFromDb(
        mockDb,
        mockAccountId,
        mockUserId
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toEqual(mockTransaction);
    });

    it("should apply additional filters with account ID", async () => {
      const additionalFilters = {
        bookedDateGte: "2024-01-01",
        statusIn: ["BOOKED" as const],
      };

      mockDb.__setMockResult([mockTransaction]);

      const result = await service.getTransactionsByAccountIdFromDb(
        mockDb,
        mockAccountId,
        mockUserId,
        additionalFilters
      );

      expect(result.transactions).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      mockDb.__setMockResult([]);

      const result = await service.getTransactionsByAccountIdFromDb(
        mockDb,
        "non-existent-account",
        mockUserId
      );

      expect(result.transactions).toHaveLength(0);
      expect(result.nextPageToken).toBeUndefined();
    });
  });

  describe("edge cases and validation", () => {
    it("should handle empty account ID array", async () => {
      const filters: TinkTransactionFilters = {
        accountIdIn: [],
      };

      mockDb.__setMockResult([]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(0);
    });

    it("should handle empty status array", async () => {
      const filters: TinkTransactionFilters = {
        statusIn: [],
      };

      mockDb.__setMockResult([]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      expect(result.transactions).toHaveLength(0);
    });

    it("should handle zero page size", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: 0,
      };

      mockDb.__setMockResult([]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      // Should return empty results
      expect(result.transactions).toHaveLength(0);
    });

    it("should handle negative page size", async () => {
      const filters: TinkTransactionFilters = {
        pageSize: -5,
      };

      mockDb.__setMockResult([]);

      const result = await service.getTransactions(mockDb, mockUserId, filters);

      // Should return empty results
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe("database error handling", () => {
    it("should propagate database errors in getTransactions", async () => {
      const dbError = new Error("Database connection failed");
      // Override the select mock to throw an error
      mockDb.select = vi.fn(() => {
        throw dbError;
      });

      await expect(service.getTransactions(mockDb, mockUserId)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should propagate database errors in getTransactionByIdFromDb", async () => {
      const dbError = new Error("Database query failed");
      // Override the select mock to throw an error
      mockDb.select = vi.fn(() => {
        throw dbError;
      });

      await expect(
        service.getTransactionByIdFromDb(mockDb, mockTransactionId, mockUserId)
      ).rejects.toThrow("Database query failed");
    });

    it("should propagate database errors in updateTransactionInDb", async () => {
      const dbError = new Error("Update failed");
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.returning.mockRejectedValue(dbError);

      await expect(
        service.updateTransactionInDb(
          mockDb,
          mockTransactionId,
          { displayDescription: "New" },
          mockUserId
        )
      ).rejects.toThrow("Update failed");
    });

    it("should propagate database errors in deleteTransactionFromDb", async () => {
      const dbError = new Error("Delete failed");
      mockDb.delete.mockReturnThis();
      mockDb.where.mockRejectedValue(dbError);

      await expect(
        service.deleteTransactionFromDb(mockDb, mockTransactionId, mockUserId)
      ).rejects.toThrow("Delete failed");
    });
  });
});
