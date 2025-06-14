// Transaction services re-exports for backward compatibility and clean imports

// Core services
export {
  TransactionSyncService,
  transactionSyncService,
} from "./transactionSyncService";
export {
  TransactionFetchService,
  transactionFetchService,
} from "./transactionFetchService";
export {
  TransactionStorageService,
  transactionStorageService,
} from "./transactionStorageService";

// Types
export type {
  TinkTransaction,
  TinkTransactionsResponse,
  SyncResult,
  TransactionFetchOptions,
  DateRange,
  StorageResult,
  TransactionPage,
} from "./types";

// Default export for main sync service (backward compatibility)
export { transactionSyncService as default } from "./transactionSyncService";
