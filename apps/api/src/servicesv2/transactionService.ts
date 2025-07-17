import { httpRetry } from "../utils/httpRetry";

// Query parameters for listing transactions
export interface ListTransactionsRequest {
  pageSize?: number;
  pageToken?: string;
  accountIdIn?: string[];
  bookedDateGte?: string;
  bookedDateLte?: string;
  statusIn?: TransactionStatus[];
}

// Transaction status enum
export type TransactionStatus = "UNDEFINED" | "PENDING" | "BOOKED";

// Transaction type enum
export type TransactionType = "UNDEFINED" | "CREDIT_CARD" | "PAYMENT" | "WITHDRAWAL" | "DEFAULT" | "TRANSFER";

// Transaction mutability enum
export type TransactionMutability = "MUTABILITY_UNDEFINED" | "MUTABLE" | "IMMUTABLE";

// Exact number representation for currency amounts
export interface ExactNumber {
  scale: string;
  unscaledValue: string;
}

// Currency denominated amount
export interface CurrencyDenominatedAmount {
  currencyCode: string;
  value: ExactNumber;
}

// PFM Category
export interface PFMCategory {
  id: string;
  name: string;
}

// Categories
export interface Categories {
  pfm?: PFMCategory;
}

// Financial institution identifiers
export interface FinancialInstitution {
  accountNumber?: string;
}

// Identifiers
export interface Identifiers {
  providerTransactionId?: string;
  financialInstitution?: FinancialInstitution;
}

// Counterparty information
export interface CounterpartyInformation {
  name?: string;
  identifiers?: Identifiers;
}

// Counterparties
export interface Counterparties {
  payee?: CounterpartyInformation;
  payer?: CounterpartyInformation;
}

// Transaction dates
export interface Dates {
  booked: string;
  transaction?: string;
  value?: string;
}

// Transaction information
export interface TransactionInformation {
  unstructured?: string;
}

// Transaction descriptions
export interface Descriptions {
  display: string;
  original: string;
  detailed?: TransactionInformation;
}

// Merchant information
export interface MerchantInformation {
  merchantCategoryCode?: string;
  merchantName?: string;
}

// Transaction types
export interface Types {
  type: TransactionType;
  financialInstitutionTypeCode?: string;
}

// Main transaction object
export interface Transaction {
  id: string;
  accountId: string;
  amount: CurrencyDenominatedAmount;
  categories?: Categories;
  counterparties?: Counterparties;
  dates: Dates;
  descriptions: Descriptions;
  identifiers?: Identifiers;
  merchantInformation?: MerchantInformation;
  providerMutability?: TransactionMutability;
  reference?: string;
  status: TransactionStatus;
  types: Types;
}

// List transactions response
export interface ListTransactionsResponse {
  nextPageToken?: string;
  transactions: Transaction[];
}

/**
 * Service for interacting with Tink API v2 transaction endpoints
 * Handles authentication, pagination, and error handling
 */
export class TransactionService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
  }

  /**
   * Build query parameters for the transaction API
   */
  private buildQueryParams(request: ListTransactionsRequest): URLSearchParams {
    const params = new URLSearchParams();

    if (request.pageSize !== undefined) {
      params.append("pageSize", Math.min(request.pageSize, 100).toString());
    }

    if (request.pageToken) {
      params.append("pageToken", request.pageToken);
    }

    if (request.accountIdIn) {
      request.accountIdIn.forEach(accountId => {
        params.append("accountIdIn", accountId);
      });
    }

    if (request.bookedDateGte) {
      params.append("bookedDateGte", request.bookedDateGte);
    }

    if (request.bookedDateLte) {
      params.append("bookedDateLte", request.bookedDateLte);
    }

    if (request.statusIn) {
      request.statusIn.forEach(status => {
        params.append("statusIn", status);
      });
    }

    return params;
  }

  /**
   * List transactions for a user
   * GET /data/v2/transactions
   */
  async listTransactions(
    userAccessToken: string,
    request: ListTransactionsRequest = {}
  ): Promise<ListTransactionsResponse> {
    const params = this.buildQueryParams(request);
    const url = `${this.baseUrl}/data/v2/transactions?${params.toString()}`;
    
    const context = `List transactions${request.accountIdIn ? ` for accounts ${request.accountIdIn.join(", ")}` : ""}`;

    const response = await httpRetry.fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      },
      context
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tink API error: ${response.status} ${errorText}`);
    }

    const data: ListTransactionsResponse = await response.json() as ListTransactionsResponse;
    return data;
  }

  /**
   * Fetch all transactions with automatic pagination
   * Useful for getting complete transaction history
   */
  async *listAllTransactions(
    userAccessToken: string,
    request: ListTransactionsRequest = {}
  ): AsyncGenerator<Transaction[], void, unknown> {
    let nextPageToken: string | undefined;
    let pageNumber = 1;
    let totalFetched = 0;

    do {
      const pageRequest: ListTransactionsRequest = {
        ...request,
        pageToken: nextPageToken,
      };

      const response = await this.listTransactions(userAccessToken, pageRequest);
      
      if (response.transactions.length > 0) {
        totalFetched += response.transactions.length;
        console.log(`Fetched page ${pageNumber} with ${response.transactions.length} transactions, total so far: ${totalFetched}`);
        yield response.transactions;
      }

      nextPageToken = response.nextPageToken;
      pageNumber++;

      // Small delay to avoid rate limiting
      if (nextPageToken) {
        await this.sleep(100);
      }
    } while (nextPageToken);

    console.log(`Completed fetching ${totalFetched} transactions in total across ${pageNumber - 1} pages`);
  }

  /**
   * Utility method to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate date range parameters
   */
  static validateDateRange(from?: string, to?: string): void {
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      throw new Error("bookedDateGte must be in YYYY-MM-DD format");
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new Error("bookedDateLte must be in YYYY-MM-DD format");
    }
    if (from && to && from > to) {
      throw new Error("bookedDateGte must be less than or equal to bookedDateLte");
    }
  }

  /**
   * Helper method to create a date range for the last N days
   */
  static createDateRange(days: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }
}

// Export a singleton instance for convenience
export const transactionService = new TransactionService();