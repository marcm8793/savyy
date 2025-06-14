import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { BankAccount, bankAccount, schema } from "../../db/schema";

// Types based on Tink API documentation
interface CurrencyDenominatedAmount {
  currencyCode: string;
  value: {
    scale: string;
    unscaledValue: string;
  };
}

interface Balance {
  amount: CurrencyDenominatedAmount;
}

interface Balances {
  available?: Balance;
  booked?: Balance;
}

interface FinancialInstitution {
  accountNumber: string;
  referenceNumbers?: object;
}

interface IBAN {
  bban: string;
  bic?: string;
  iban: string;
}

interface Pan {
  masked: string;
}

interface SortCode {
  accountNumber: string;
  code: string;
}

interface Identifiers {
  financialInstitution?: FinancialInstitution;
  iban?: IBAN;
  pan?: Pan;
  sortCode?: SortCode;
}

interface Dates {
  lastRefreshed: string;
}

type CustomerSegment = "UNDEFINED_CUSTOMER_SEGMENT" | "PERSONAL" | "BUSINESS";
type AccountType = "UNDEFINED" | "CHECKING" | "SAVINGS" | "CREDIT_CARD";

interface Account {
  id: string;
  name: string;
  type: AccountType;
  balances?: Balances;
  customerSegment?: CustomerSegment;
  dates: Dates;
  financialInstitutionId?: string;
  identifiers?: Identifiers;
}

interface ListAccountsResponse {
  accounts: Account[];
  nextPageToken?: string;
}

// Query parameters for the API
interface ListAccountsParams {
  pageSize?: number;
  pageToken?: string;
  idIn?: string[];
  typesIn?: AccountType[];
}

// Enhanced account type with processed balance information
interface ProcessedAccount extends Account {
  processedBalance?: {
    amount: number;
    currency: string;
  };
}

export class AccountsAndBalancesService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
  }

  /**
   * Fetch accounts and balances from Tink API
   * Requires user access token with balances:read and accounts:read scopes
   */
  async fetchAccountsAndBalances(
    userAccessToken: string,
    params?: ListAccountsParams
  ): Promise<ListAccountsResponse> {
    console.log("Fetching accounts and balances from Tink API...");

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params?.pageSize) {
      queryParams.append("pageSize", params.pageSize.toString());
    }
    if (params?.pageToken) {
      queryParams.append("pageToken", params.pageToken);
    }
    if (params?.idIn) {
      params.idIn.forEach((id) => queryParams.append("idIn", id));
    }
    if (params?.typesIn) {
      params.typesIn.forEach((type) => queryParams.append("typesIn", type));
    }

    const url = `${this.baseUrl}/data/v2/accounts${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Tink accounts API response:", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch accounts from Tink:", errorText);
      throw new Error(
        `Failed to fetch accounts and balances: ${response.status} ${errorText}`
      );
    }

    const data: ListAccountsResponse =
      (await response.json()) as ListAccountsResponse;

    console.log("Fetched accounts and balances from Tink:", {
      accountCount: data.accounts?.length || 0,
      hasNextPageToken: !!data.nextPageToken,
      accounts:
        data.accounts?.map((acc) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balances: acc.balances,
          identifiers: acc.identifiers,
        })) || [],
    });

    return data;
  }

  /**
   * Process balance information from Tink's nested structure
   * Converts unscaled value and scale to actual decimal amount
   */
  private processBalance(balance: Balance): {
    amount: number;
    currency: string;
  } {
    const unscaledValue = parseInt(balance.amount.value.unscaledValue);
    const scale = parseInt(balance.amount.value.scale);

    // Scale represents decimal places: unscaledValue * 10^(-scale)
    const amount = unscaledValue * Math.pow(10, -scale);

    return {
      amount,
      currency: balance.amount.currencyCode,
    };
  }

  /**
   * Process accounts to extract and format balance information
   */
  processAccountsWithBalances(accounts: Account[]): ProcessedAccount[] {
    return accounts.map((account) => {
      let processedBalance: ProcessedAccount["processedBalance"];

      // Extract booked balance if available
      if (account.balances?.booked) {
        const { amount, currency } = this.processBalance(
          account.balances.booked
        );
        processedBalance = {
          amount,
          currency,
        };
      }

      return {
        ...account,
        processedBalance,
      };
    });
  }

  /**
   * Get stored accounts from database with pagination support
   * Consolidated from accountService.ts
   */
  async getAccountsFromDb(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<BankAccount[]> {
    const baseQuery = db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId));

    // Apply pagination if provided
    if (options?.limit !== undefined && options?.offset !== undefined) {
      return await baseQuery.limit(options.limit).offset(options.offset);
    } else if (options?.limit) {
      return await baseQuery.limit(options.limit);
    } else if (options?.offset) {
      return await baseQuery.offset(options.offset);
    }

    return await baseQuery;
  }

  /**
   * Sync accounts and balances from Tink API to database
   * This method fetches fresh data from Tink and updates the local database
   */
  async syncAccountsAndBalances(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    userAccessToken: string,
    tokenScope?: string,
    expiresIn?: number
  ): Promise<{ accounts: BankAccount[]; count: number }> {
    console.log("Syncing accounts and balances for user:", userId);

    // Fetch fresh data from Tink API
    const tinkResponse = await this.fetchAccountsAndBalances(userAccessToken);
    const processedAccounts = this.processAccountsWithBalances(
      tinkResponse.accounts
    );

    // Convert to database format and store
    const accountsToStore = processedAccounts.map((account) => ({
      userId,
      tinkAccountId: account.id,
      accountName: account.name,
      accountType: account.type,
      financialInstitutionId: account.financialInstitutionId,
      balance: account.processedBalance
        ? Math.round(account.processedBalance.amount * 100).toString() // Convert to cents
        : null,
      currency: account.processedBalance?.currency || "EUR",
      iban: account.identifiers?.iban?.iban,
      lastRefreshed: account.dates?.lastRefreshed
        ? new Date(account.dates.lastRefreshed)
        : null,
      accessToken: userAccessToken,
      tokenScope: tokenScope || "balances:read accounts:read",
    }));

    // Store accounts in database using transaction for atomicity
    const storedAccounts: BankAccount[] = [];

    await db.transaction(async (trx) => {
      for (const accountData of accountsToStore) {
        // Check if account already exists for this user
        const existing = await trx
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.tinkAccountId, accountData.tinkAccountId),
              eq(bankAccount.userId, userId)
            )
          )
          .limit(1);

        let result: BankAccount;

        if (existing.length > 0) {
          // Update existing account
          // Calculate token expiration: use provided expiresIn or preserve existing
          const newTokenExpiresAt = expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : existing[0].tokenExpiresAt; // Preserve existing expiration

          const updated = await trx
            .update(bankAccount)
            .set({
              ...accountData,
              tokenExpiresAt: newTokenExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(bankAccount.id, existing[0].id))
            .returning();

          result = updated[0];
          console.log("Updated existing account:", result.accountName, {
            tokenExpiresAt: result.tokenExpiresAt,
            usedProvidedExpiration: !!expiresIn,
          });
        } else {
          // Insert new account
          const newTokenExpiresAt = expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : new Date(Date.now() + 3600 * 1000); // Default 1 hour for new accounts

          const inserted = await trx
            .insert(bankAccount)
            .values({
              ...accountData,
              tokenExpiresAt: newTokenExpiresAt,
            })
            .returning();

          result = inserted[0];
          console.log("Inserted new account:", result.accountName);
        }

        storedAccounts.push(result);
      }
    });

    console.log("Sync completed:", {
      userId,
      syncedCount: storedAccounts.length,
      totalFromTink: processedAccounts.length,
    });

    return {
      accounts: storedAccounts,
      count: storedAccounts.length,
    };
  }

  /**
   * Get account balance summary for a user
   */
  async getBalanceSummary(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<{
    totalBalance: number;
    currency: string;
    accountCount: number;
    lastRefreshed: Date | null;
  }> {
    const accounts = await this.getAccountsFromDb(db, userId);

    const totalBalance = accounts.reduce((sum, account) => {
      const balance = account.balance ? parseFloat(account.balance) : 0;
      return sum + balance;
    }, 0);

    const lastRefreshed = accounts.reduce((latest, account) => {
      if (!account.lastRefreshed) {
        return latest;
      }
      if (!latest) {
        return account.lastRefreshed;
      }
      return account.lastRefreshed > latest ? account.lastRefreshed : latest;
    }, null as Date | null);

    // Use the most common currency or default to EUR
    const currencies = accounts
      .map((acc) => acc.currency)
      .filter(Boolean) as string[];
    const currency = currencies.length > 0 ? currencies[0] : "EUR";

    return {
      totalBalance: Math.round(totalBalance), // Return in cents
      currency,
      accountCount: accounts.length,
      lastRefreshed,
    };
  }
}

// Export singleton instance
export const accountsAndBalancesService = new AccountsAndBalancesService();
