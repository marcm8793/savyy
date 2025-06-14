// Shared types for transaction services

// Types for Tink API responses
export interface TinkTransaction {
  id: string;
  accountId: string;
  amount: {
    currencyCode: string;
    value: {
      scale: string;
      unscaledValue: string;
    };
  };
  categories?: {
    pfm?: {
      id: string;
      name: string;
    };
  };
  dates: {
    booked: string;
    value?: string;
  };
  descriptions: {
    display: string;
    original: string;
  };
  identifiers?: {
    providerTransactionId?: string;
  };
  merchantInformation?: {
    merchantCategoryCode?: string;
    merchantName?: string;
  };
  status: "BOOKED" | "PENDING" | "UNDEFINED";
  types?: {
    financialInstitutionTypeCode?: string;
    type?: string;
  };
  reference?: string;
}

export interface TinkTransactionsResponse {
  nextPageToken?: string;
  transactions: TinkTransaction[];
}

export interface SyncResult {
  success: boolean;
  accountId: string;
  transactionsCreated: number;
  transactionsUpdated: number;
  errors: string[];
  totalTransactionsFetched: number;
}

export interface TransactionFetchOptions {
  dateRangeMonths?: number;
  includeAllStatuses?: boolean;
  skipCredentialsRefresh?: boolean;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface StorageResult {
  created: number;
  updated: number;
  errors: string[];
}

export interface TransactionPage {
  transactions: TinkTransaction[];
  nextPageToken?: string;
  totalFetched: number;
}
