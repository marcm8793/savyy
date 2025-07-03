/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TransactionSyncService } from "../../../../src/services/transaction/transactionSyncService";
import { TransactionFetchService } from "../../../../src/services/transaction/transactionFetchService";
import { TransactionStorageService } from "../../../../src/services/transaction/transactionStorageService";
import { TRANSACTION_SYNC_CONFIG } from "../../../../src/constants/transactions";
import type {
  SyncResult,
  TransactionFetchOptions,
  DateRange,
  TinkTransaction,
  TransactionPage,
  StorageResult,
} from "../../../../src/services/transaction/types";

// Mock the dependencies
vi.mock("../../../../src/services/transaction/transactionFetchService");
vi.mock("../../../../src/services/transaction/transactionStorageService");

describe("TransactionSyncService", () => {
  let syncService: TransactionSyncService;
  let mockFetchService: any;
  let mockStorageService: any;
  let mockDb: any;

  // Test fixtures
  const mockUserId = "user-123";
  const mockTinkAccountId = "tink-account-456";
  const mockUserAccessToken = "user-access-token";
  const mockBankAccountId = "bank-account-789";

  const mockBankAccount = {
    id: mockBankAccountId,
    tinkAccountId: mockTinkAccountId,
    userId: mockUserId,
    name: "Test Bank Account",
    balance: 1000,
    currency: "EUR",
    lastRefreshed: new Date(),
  };

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
  };

  const mockTransactionPage: TransactionPage = {
    transactions: [mockTinkTransaction],
    nextPageToken: "next-page-token",
    totalFetched: 1,
  };

  const mockStorageResult: StorageResult = {
    created: 1,
    updated: 0,
    errors: [],
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create service instance
    syncService = new TransactionSyncService();

    // Get mocked instances
    mockFetchService = vi.mocked(TransactionFetchService.prototype);
    mockStorageService = vi.mocked(TransactionStorageService.prototype);

    // Create mock database
    mockDb = { query: vi.fn() };

    // Setup default mock implementations
    mockStorageService.verifyBankAccount.mockResolvedValue(mockBankAccount);
    mockStorageService.updateAccountLastRefreshed.mockResolvedValue(undefined);
    mockStorageService.storeTransactionsWithUpsert.mockResolvedValue(
      mockStorageResult
    );
    mockFetchService.tryRefreshCredentials.mockResolvedValue(undefined);
    mockFetchService.fetchPagedTransactions.mockImplementation(
      async function* () {
        yield mockTransactionPage;
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with fetch and storage services", () => {
      expect(syncService).toBeInstanceOf(TransactionSyncService);
      expect(TransactionFetchService).toHaveBeenCalledOnce();
      expect(TransactionStorageService).toHaveBeenCalledOnce();
    });
  });

  describe("syncInitialTransactions", () => {
    it("should successfully sync initial transactions", async () => {
      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.accountId).toBe(mockTinkAccountId);
      expect(result.transactionsCreated).toBe(1);
      expect(result.transactionsUpdated).toBe(0);
      expect(result.totalTransactionsFetched).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify service interactions
      expect(mockStorageService.verifyBankAccount).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockTinkAccountId
      );
      expect(mockFetchService.tryRefreshCredentials).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        false
      );
      expect(
        mockStorageService.updateAccountLastRefreshed
      ).toHaveBeenCalledWith(mockDb, mockBankAccountId);
    });

    it("should handle consent refresh scenario", async () => {
      const lastSyncDate = new Date("2024-01-01");
      const options = {
        isConsentRefresh: true,
        lastSyncDate,
      };

      // Mock the consent refresh method
      const mockConsentRefreshResult: SyncResult = {
        success: true,
        accountId: mockTinkAccountId,
        transactionsCreated: 2,
        transactionsUpdated: 3,
        errors: [],
        totalTransactionsFetched: 5,
      };

      const consentRefreshSpy = vi
        .spyOn(syncService, "syncTransactionsForConsentRefresh")
        .mockResolvedValue(mockConsentRefreshResult);

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        options
      );

      expect(consentRefreshSpy).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        {
          lastSyncDate,
          forceFullSync: false,
          includeStatusUpdates: true,
        }
      );
      expect(result).toEqual(mockConsentRefreshResult);
    });

    it("should handle custom date range options", async () => {
      const options: TransactionFetchOptions = {
        dateRangeMonths: 6,
        includeAllStatuses: false,
        skipCredentialsRefresh: true,
      };

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        options
      );

      expect(result.success).toBe(true);
      expect(mockFetchService.tryRefreshCredentials).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        true
      );
    });

    it("should handle multiple pages of transactions", async () => {
      const mockPage1: TransactionPage = {
        transactions: [mockTinkTransaction],
        nextPageToken: "page-2",
        totalFetched: 1,
      };

      const mockPage2: TransactionPage = {
        transactions: [{ ...mockTinkTransaction, id: "tx-456" }],
        totalFetched: 2,
      };

      mockFetchService.fetchPagedTransactions.mockImplementation(
        async function* () {
          yield mockPage1;
          yield mockPage2;
        }
      );

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.totalTransactionsFetched).toBe(2); // 1 + 1 (transactions.length)
      expect(result.transactionsCreated).toBe(2); // 1 + 1 (2 store calls)
      expect(
        mockStorageService.storeTransactionsWithUpsert
      ).toHaveBeenCalledTimes(2);
    });

    it("should handle bank account verification failure", async () => {
      mockStorageService.verifyBankAccount.mockRejectedValue(
        new Error("Bank account not found")
      );

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Bank account not found");
    });

    it("should handle storage errors", async () => {
      const storageResultWithErrors: StorageResult = {
        created: 0,
        updated: 0,
        errors: ["Storage error occurred"],
      };

      mockStorageService.storeTransactionsWithUpsert.mockResolvedValue(
        storageResultWithErrors
      );

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(true);
      expect(result.errors).toContain("Storage error occurred");
    });

    it("should handle fetch service errors", async () => {
      mockFetchService.fetchPagedTransactions.mockImplementation(
        async function* () {
          throw new Error("Fetch error");
          yield mockTransactionPage;
        }
      );

      const result = await syncService.syncInitialTransactions(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Fetch error");
    });
  });

  describe("syncTransactionsForDateRange", () => {
    const mockDateRange: DateRange = {
      from: "2024-01-01",
      to: "2024-01-31",
    };

    it("should successfully sync transactions for date range", async () => {
      const result = await syncService.syncTransactionsForDateRange(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        mockDateRange
      );

      expect(result.success).toBe(true);
      expect(result.accountId).toBe(mockTinkAccountId);
      expect(result.transactionsCreated).toBe(1);
      expect(result.transactionsUpdated).toBe(0);
      expect(result.totalTransactionsFetched).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify fetch was called with correct parameters
      expect(mockFetchService.fetchPagedTransactions).toHaveBeenCalledWith(
        mockUserAccessToken,
        mockTinkAccountId,
        mockDateRange,
        true // include all statuses
      );
    });

    it("should handle verification errors", async () => {
      mockStorageService.verifyBankAccount.mockRejectedValue(
        new Error("Invalid account")
      );

      const result = await syncService.syncTransactionsForDateRange(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        mockDateRange
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Invalid account");
    });
  });

  describe("getSyncStatus", () => {
    it("should delegate to storage service", async () => {
      const mockSyncStatus = {
        accountId: mockTinkAccountId,
        lastSynced: new Date(),
        totalTransactions: 100,
        oldestTransaction: "2024-01-01",
        newestTransaction: "2024-01-31",
      };

      mockStorageService.getSyncStatus.mockResolvedValue(mockSyncStatus);

      const result = await syncService.getSyncStatus(
        mockDb,
        mockUserId,
        mockTinkAccountId
      );

      expect(result).toEqual(mockSyncStatus);
      expect(mockStorageService.getSyncStatus).toHaveBeenCalledWith(
        mockDb,
        mockUserId,
        mockTinkAccountId
      );
    });
  });

  describe("syncTransactionsForConsentRefresh", () => {
    it("should handle full sync when no last sync date", async () => {
      const options = {
        forceFullSync: true,
        includeStatusUpdates: true,
      };

      const result = await syncService.syncTransactionsForConsentRefresh(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        options
      );

      expect(result.success).toBe(true);
      expect(result.transactionsCreated).toBe(1);
      expect(result.transactionsUpdated).toBe(0);
    });

    it("should handle incremental sync with last sync date", async () => {
      const lastSyncDate = new Date("2024-01-15");
      const options = {
        lastSyncDate,
        forceFullSync: false,
        includeStatusUpdates: true,
      };

      const result = await syncService.syncTransactionsForConsentRefresh(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        options
      );

      expect(result.success).toBe(true);
      expect(result.transactionsCreated).toBe(1);
      expect(result.transactionsUpdated).toBe(0);
    });

    it("should perform status update check for incremental sync", async () => {
      const lastSyncDate = new Date("2024-01-15");
      const options = {
        lastSyncDate,
        forceFullSync: false,
        includeStatusUpdates: true,
      };

      // Mock multiple pages to simulate status updates
      mockFetchService.fetchPagedTransactions.mockImplementation(
        async function* () {
          yield mockTransactionPage;
          yield mockTransactionPage; // Second call for status updates
        }
      );

      const result = await syncService.syncTransactionsForConsentRefresh(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken,
        options
      );

      expect(result.success).toBe(true);
      expect(mockFetchService.fetchPagedTransactions).toHaveBeenCalledTimes(2);
    });

    it("should handle errors during consent refresh", async () => {
      mockStorageService.verifyBankAccount.mockRejectedValue(
        new Error("Consent refresh error")
      );

      const result = await syncService.syncTransactionsForConsentRefresh(
        mockDb,
        mockUserId,
        mockTinkAccountId,
        mockUserAccessToken
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Consent refresh error");
    });
  });

  describe("createDateRange", () => {
    it("should create correct date range", () => {
      const dateRangeMonths = 3;
      const today = new Date();
      const expectedFromDate = new Date();
      expectedFromDate.setMonth(today.getMonth() - dateRangeMonths);

      // Access the private method using bracket notation
      const result = (syncService as any).createDateRange(dateRangeMonths);

      expect(result.from).toBe(expectedFromDate.toISOString().split("T")[0]);
      expect(result.to).toBe(today.toISOString().split("T")[0]);
    });
  });

  describe("performStatusUpdateCheck", () => {
    it("should perform status update check", async () => {
      const lastSyncDate = new Date("2024-01-15");

      // Mock the private method by accessing it through the instance
      const performStatusUpdateCheck = (syncService as any)
        .performStatusUpdateCheck;

      const result = await performStatusUpdateCheck.call(
        syncService,
        mockDb,
        mockUserId,
        mockBankAccountId,
        mockUserAccessToken,
        mockTinkAccountId,
        lastSyncDate
      );

      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle errors during status update check", async () => {
      mockFetchService.fetchPagedTransactions.mockImplementation(
        async function* () {
          throw new Error("Status update error");
          yield mockTransactionPage;
        }
      );

      const performStatusUpdateCheck = (syncService as any)
        .performStatusUpdateCheck;

      const result = await performStatusUpdateCheck.call(
        syncService,
        mockDb,
        mockUserId,
        mockBankAccountId,
        mockUserAccessToken,
        mockTinkAccountId,
        new Date()
      );

      expect(result.updated).toBe(0);
      expect(result.errors).toContain("Status update error");
    });
  });

  describe("configuration constants", () => {
    it("should use correct default configuration", () => {
      expect(TRANSACTION_SYNC_CONFIG.DEFAULT_DATE_RANGE_MONTHS).toBe(3);
      expect(TRANSACTION_SYNC_CONFIG.WEBHOOK_LOOKBACK_DAYS).toBe(7);
      expect(TRANSACTION_SYNC_CONFIG.STATUS_UPDATE_LOOKBACK_DAYS).toBe(30);
    });
  });
});
