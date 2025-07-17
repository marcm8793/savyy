export interface TinkTransaction {
  accountId: string;
  amount: {
    currencyCode: string;
    value: {
      scale: string;
      unscaledValue: string;
    };
  };
  dates: {
    booked?: string;
    value?: string;
  };
  descriptions: {
    display: string;
    original: string;
  };
  id: string;
  identifiers?: {
    providerTransactionId?: string;
  };
  merchantInformation?: {
    merchantCategoryCode?: string;
    merchantName?: string;
  };
  providerMutability?: "MUTABILITY_UNDEFINED" | "MUTABLE" | "IMMUTABLE";
  reference?: string;
  status: "PENDING" | "BOOKED";
  types: {
    financialInstitutionTypeCode?: string;
  };
}

export interface ListTransactionsResponse {
  nextPageToken?: string;
  transactions: TinkTransaction[];
}
