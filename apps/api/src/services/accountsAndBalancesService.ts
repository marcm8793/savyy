import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { BankAccount, bankAccount, schema } from "../../db/schema";
import { httpRetry } from "../utils/httpRetry";

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

// Enhanced interfaces for consent refresh handling
interface ConsentRefreshOptions {
  isConsentRefresh: boolean;
  previousCredentialsId?: string;
  skipDuplicateCheck?: boolean;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAccount?: BankAccount;
  duplicateReason?:
    | "same_tink_account"
    | "same_institution_and_identifiers"
    | "same_credentials";
}

interface SyncMode {
  mode: "new_connection" | "consent_refresh" | "token_refresh";
  existingAccounts?: BankAccount[];
  lastSyncDate?: Date;
}

export class AccountsAndBalancesService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
  }

  /**
   * Fetch accounts and balances from Tink API
   * Requires user access token with balances:read and accounts:read scopes
   * Now includes retry logic for robust error handling
   */
  async fetchAccountsAndBalances(
    userAccessToken: string,
    params?: ListAccountsParams
  ): Promise<ListAccountsResponse> {
    const queryParams = new URLSearchParams();

    if (params?.pageSize) {
      queryParams.append("pageSize", params.pageSize.toString());
    }

    if (params?.pageToken) {
      queryParams.append("pageToken", params.pageToken);
    }

    if (params?.idIn && params.idIn.length > 0) {
      params.idIn.forEach((id) => queryParams.append("idIn", id));
    }

    if (params?.typesIn && params.typesIn.length > 0) {
      params.typesIn.forEach((type) => queryParams.append("typesIn", type));
    }

    const url = `${this.baseUrl}/data/v2/accounts${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response = await httpRetry.fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      },
      "Fetch accounts and balances from Tink API"
    );

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
   * Enhanced duplicate detection for accounts
   * Implements Tink-specific duplicate detection logic similar to Plaid's approach
   */
  private async detectAccountDuplicates(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccount: ProcessedAccount,
    credentialsId?: string,
    isConsentRefresh: boolean = false
  ): Promise<DuplicateCheckResult> {
    // First check: Exact Tink account ID match (most reliable)
    const exactMatch = await db
      .select()
      .from(bankAccount)
      .where(
        and(
          eq(bankAccount.userId, userId),
          eq(bankAccount.tinkAccountId, tinkAccount.id)
        )
      )
      .limit(1);

    if (exactMatch.length > 0) {
      return {
        isDuplicate: true,
        existingAccount: exactMatch[0],
        duplicateReason: "same_tink_account",
      };
    }

    // Second check: Same institution + IBAN/account identifiers
    if (
      tinkAccount.identifiers?.iban?.iban &&
      tinkAccount.financialInstitutionId
    ) {
      const identifierMatch = await db
        .select()
        .from(bankAccount)
        .where(
          and(
            eq(bankAccount.userId, userId),
            eq(
              bankAccount.financialInstitutionId,
              tinkAccount.financialInstitutionId
            ),
            eq(bankAccount.iban, tinkAccount.identifiers.iban.iban)
          )
        )
        .limit(1);

      if (identifierMatch.length > 0) {
        return {
          isDuplicate: true,
          existingAccount: identifierMatch[0],
          duplicateReason: "same_institution_and_identifiers",
        };
      }
    }

    // Third check: Same credentials ID (only for consent refresh scenarios)
    // For new connections, multiple accounts can legitimately share the same credentialsId
    if (credentialsId && isConsentRefresh) {
      const credentialsMatch = await db
        .select()
        .from(bankAccount)
        .where(
          and(
            eq(bankAccount.userId, userId),
            eq(bankAccount.credentialsId, credentialsId),
            eq(bankAccount.tinkAccountId, tinkAccount.id) // Also match the specific Tink account ID
          )
        )
        .limit(1);

      if (credentialsMatch.length > 0) {
        return {
          isDuplicate: true,
          existingAccount: credentialsMatch[0],
          duplicateReason: "same_credentials",
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Determine sync mode based on existing accounts and context
   */
  private async determineSyncMode(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    credentialsId?: string,
    options?: ConsentRefreshOptions
  ): Promise<SyncMode> {
    if (options?.isConsentRefresh) {
      const existingAccounts = credentialsId
        ? await db
            .select()
            .from(bankAccount)
            .where(
              and(
                eq(bankAccount.userId, userId),
                eq(bankAccount.credentialsId, credentialsId)
              )
            )
        : [];

      const lastSyncDate =
        existingAccounts.length > 0
          ? existingAccounts.reduce((latest, account) => {
              const accountLastRefresh = account.lastRefreshed;
              if (!accountLastRefresh) {
                return latest;
              }
              if (!latest) {
                return accountLastRefresh;
              }
              return accountLastRefresh > latest ? accountLastRefresh : latest;
            }, null as Date | null)
          : null;

      return {
        mode: "consent_refresh",
        existingAccounts,
        lastSyncDate: lastSyncDate || undefined,
      };
    }

    // Check if user has any existing accounts (might be a reconnection)
    const userAccounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId))
      .limit(5); // Just check if any exist

    if (userAccounts.length > 0) {
      return {
        mode: "token_refresh",
        existingAccounts: userAccounts,
      };
    }

    return { mode: "new_connection" };
  }

  /**
   * Enhanced sync accounts and balances with duplicate detection and consent refresh support
   */
  async syncAccountsAndBalances(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    userAccessToken: string,
    tokenScope?: string,
    expiresIn?: number,
    credentialsId?: string,
    options?: ConsentRefreshOptions
  ): Promise<{ accounts: BankAccount[]; count: number; syncMode: SyncMode }> {
    console.log("Syncing accounts and balances for user:", userId, {
      credentialsId,
      isConsentRefresh: options?.isConsentRefresh,
    });

    // Determine sync mode
    const syncMode = await this.determineSyncMode(
      db,
      userId,
      credentialsId,
      options
    );
    console.log("Determined sync mode:", syncMode.mode);

    // Fetch fresh data from Tink API
    const tinkResponse = await this.fetchAccountsAndBalances(userAccessToken);
    const processedAccounts = this.processAccountsWithBalances(
      tinkResponse.accounts
    );

    // Store accounts with enhanced duplicate handling
    const storedAccounts: BankAccount[] = [];
    const duplicateAccounts: Array<{
      account: ProcessedAccount;
      reason: string;
    }> = [];

    await db.transaction(async (trx) => {
      for (const tinkAccount of processedAccounts) {
        // Check for duplicates unless explicitly skipped
        if (!options?.skipDuplicateCheck) {
          const duplicateCheck = await this.detectAccountDuplicates(
            trx,
            userId,
            tinkAccount,
            credentialsId,
            options?.isConsentRefresh || false
          );

          if (duplicateCheck.isDuplicate && duplicateCheck.existingAccount) {
            console.log(`Duplicate account detected:`, {
              tinkAccountId: tinkAccount.id,
              reason: duplicateCheck.duplicateReason,
              existingAccountId: duplicateCheck.existingAccount.id,
            });

            // For consent refresh or token refresh, update the existing account instead of creating duplicate
            if (
              syncMode.mode === "consent_refresh" ||
              syncMode.mode === "token_refresh" ||
              duplicateCheck.duplicateReason === "same_tink_account"
            ) {
              const updatedAccount = await this.updateExistingAccount(
                trx,
                duplicateCheck.existingAccount,
                tinkAccount,
                userAccessToken,
                tokenScope,
                expiresIn,
                credentialsId
              );
              storedAccounts.push(updatedAccount);
            } else {
              duplicateAccounts.push({
                account: tinkAccount,
                reason: duplicateCheck.duplicateReason || "unknown",
              });
            }
            continue;
          }
        }

        // Create new account
        const newAccount = await this.createNewAccount(
          trx,
          userId,
          tinkAccount,
          userAccessToken,
          tokenScope,
          expiresIn,
          credentialsId
        );
        storedAccounts.push(newAccount);
      }
    });

    // Log results
    if (duplicateAccounts.length > 0) {
      console.warn("Prevented duplicate account creation:", {
        userId,
        duplicateCount: duplicateAccounts.length,
        duplicates: duplicateAccounts.map((d) => ({
          accountName: d.account.name,
          reason: d.reason,
        })),
      });
    }

    console.log("Sync completed:", {
      userId,
      syncMode: syncMode.mode,
      syncedCount: storedAccounts.length,
      totalFromTink: processedAccounts.length,
      duplicatesSkipped: duplicateAccounts.length,
    });

    return {
      accounts: storedAccounts,
      count: storedAccounts.length,
      syncMode,
    };
  }

  /**
   * Update existing account with fresh data from Tink
   */
  private async updateExistingAccount(
    trx: NodePgDatabase<typeof schema>,
    existingAccount: BankAccount,
    tinkAccount: ProcessedAccount,
    userAccessToken: string,
    tokenScope?: string,
    expiresIn?: number,
    credentialsId?: string
  ): Promise<BankAccount> {
    const accountData = {
      accountName: tinkAccount.name,
      accountType: tinkAccount.type,
      financialInstitutionId: tinkAccount.financialInstitutionId,
      credentialsId: credentialsId || existingAccount.credentialsId,
      balance: tinkAccount.processedBalance
        ? Math.round(tinkAccount.processedBalance.amount * 100).toString()
        : existingAccount.balance,
      currency:
        tinkAccount.processedBalance?.currency || existingAccount.currency,
      iban: tinkAccount.identifiers?.iban?.iban || existingAccount.iban,
      lastRefreshed: tinkAccount.dates?.lastRefreshed
        ? new Date(tinkAccount.dates.lastRefreshed)
        : new Date(),
      accessToken: userAccessToken,
      tokenScope: tokenScope || existingAccount.tokenScope,
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : existingAccount.tokenExpiresAt,
      updatedAt: new Date(),
    };

    const updated = await trx
      .update(bankAccount)
      .set(accountData)
      .where(eq(bankAccount.id, existingAccount.id))
      .returning();

    const result = updated[0];
    console.log("Updated existing account:", result.accountName, {
      id: result.id,
      credentialsId: result.credentialsId,
      tokenExpiresAt: result.tokenExpiresAt,
    });

    return result;
  }

  /**
   * Create new account from Tink data
   */
  private async createNewAccount(
    trx: NodePgDatabase<typeof schema>,
    userId: string,
    tinkAccount: ProcessedAccount,
    userAccessToken: string,
    tokenScope?: string,
    expiresIn?: number,
    credentialsId?: string
  ): Promise<BankAccount> {
    const accountData = {
      userId,
      tinkAccountId: tinkAccount.id,
      accountName: tinkAccount.name,
      accountType: tinkAccount.type,
      financialInstitutionId: tinkAccount.financialInstitutionId,
      credentialsId: credentialsId || null,
      balance: tinkAccount.processedBalance
        ? Math.round(tinkAccount.processedBalance.amount * 100).toString()
        : null,
      currency: tinkAccount.processedBalance?.currency || "EUR",
      iban: tinkAccount.identifiers?.iban?.iban || null,
      lastRefreshed: tinkAccount.dates?.lastRefreshed
        ? new Date(tinkAccount.dates.lastRefreshed)
        : null,
      accessToken: userAccessToken,
      tokenScope: tokenScope || "balances:read accounts:read",
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : new Date(Date.now() + 3600 * 1000),
    };

    const inserted = await trx
      .insert(bankAccount)
      .values(accountData)
      .returning();

    const result = inserted[0];
    console.log("Created new account:", result.accountName);

    return result;
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
