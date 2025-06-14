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
export {
  TransactionQueryService,
  transactionQueryService,
} from "./transactionQueryService";

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

// Additional query service types
export type {
  TinkTransactionFilters,
  TinkTransactionResponse,
} from "./transactionQueryService";

// Default export for main sync service (backward compatibility)
export { transactionSyncService as default } from "./transactionSyncService";
