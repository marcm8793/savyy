import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { BankAccount, bankAccount, schema } from "../../db/schema";

interface TinkTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface TinkAccount {
  id: string;
  name: string;
  type: string;
  balances?: {
    booked?: {
      amount: {
        currencyCode: string;
        value: {
          scale: string;
          unscaledValue: string;
        };
      };
    };
    available?: {
      amount: {
        currencyCode: string;
        value: {
          scale: string;
          unscaledValue: string;
        };
      };
    };
  };
  customerSegment?: string;
  dates?: {
    lastRefreshed: string;
  };
  financialInstitutionId?: string;
  identifiers?: {
    iban?: {
      bban: string;
      iban: string;
    };
    pan?: {
      masked: string;
    };
  };
}

interface TinkAccountsResponse {
  accounts: TinkAccount[];
}

export class TinkService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = process.env.TINK_CLIENT_ID!;
    this.clientSecret = process.env.TINK_CLIENT_SECRET!;
    this.redirectUri = process.env.TINK_REDIRECT_URI!;
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error(
        `Missing required Tink environment variables: clientId=${!!this
          .clientId}, clientSecret=${!!this.clientSecret}, redirectUri=${!!this
          .redirectUri}`
      );
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TinkTokenResponse> {
    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    console.log("Tink token exchange response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink token exchange error:", errorText);
      throw new Error(
        `Failed to exchange code for token: ${response.status} ${errorText}`
      );
    }

    const tokenData = await response.json();
    console.log("Tink token exchange success:", {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    });

    return tokenData;
  }

  /**
   * Fetch accounts from Tink API
   */
  async fetchAccounts(accessToken: string): Promise<TinkAccount[]> {
    console.log("Fetching accounts from Tink API...");

    const response = await fetch(`${this.baseUrl}/data/v2/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
        `Failed to fetch accounts: ${response.status} ${errorText}`
      );
    }

    const data: TinkAccountsResponse = await response.json();

    console.log("Fetched accounts from Tink:", {
      accountCount: data.accounts?.length || 0,
      accounts:
        data.accounts?.map((acc) => ({
          id: acc.id,
          name: acc.name,
          balances: acc.balances,
          type: acc.type,
          identifiers: acc.identifiers,
        })) || [],
    });

    return data.accounts || [];
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TinkTokenResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to refresh token: ${response.status} ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Store Tink accounts in database
   */
  async storeAccounts(
    db: NodePgDatabase<any>,
    userId: string,
    accounts: TinkAccount[],
    accessToken: string,
    tokenScope?: string,
    expiresIn?: number
  ) {
    console.log("storeAccounts called with:", {
      userId,
      accountCount: accounts.length,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        balances: acc.balances,
      })),
    });

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    const accountsToInsert = accounts.map((account) => {
      // Extract balance from Tink's nested balance structure
      let balanceValue: number | null = null;
      let currency = "EUR"; // Default currency

      // Try to get booked balance first, then available balance
      const bookedBalance = account.balances?.booked;
      const availableBalance = account.balances?.available;

      if (bookedBalance) {
        const unscaledValue = parseInt(
          bookedBalance.amount.value.unscaledValue
        );
        const scale = parseInt(bookedBalance.amount.value.scale);
        // Scale represents decimal places: unscaledValue * 10^(-scale)
        balanceValue = unscaledValue * Math.pow(10, -scale);
        currency = bookedBalance.amount.currencyCode;

        console.log(`Booked balance conversion for ${account.name}:`, {
          unscaledValue: bookedBalance.amount.value.unscaledValue,
          scale: bookedBalance.amount.value.scale,
          parsedUnscaled: unscaledValue,
          parsedScale: scale,
          multiplier: Math.pow(10, -scale),
          finalBalance: balanceValue,
          currency,
        });
      } else if (availableBalance) {
        const unscaledValue = parseInt(
          availableBalance.amount.value.unscaledValue
        );
        const scale = parseInt(availableBalance.amount.value.scale);
        // Scale represents decimal places: unscaledValue * 10^(-scale)
        balanceValue = unscaledValue * Math.pow(10, -scale);
        currency = availableBalance.amount.currencyCode;

        console.log(`Available balance conversion for ${account.name}:`, {
          unscaledValue: availableBalance.amount.value.unscaledValue,
          scale: availableBalance.amount.value.scale,
          parsedUnscaled: unscaledValue,
          parsedScale: scale,
          multiplier: Math.pow(10, -scale),
          finalBalance: balanceValue,
          currency,
        });
      }

      console.log(`Processing account ${account.name}:`, {
        bookedBalance: bookedBalance
          ? {
              unscaledValue: bookedBalance.amount.value.unscaledValue,
              scale: bookedBalance.amount.value.scale,
              currency: bookedBalance.amount.currencyCode,
            }
          : null,
        availableBalance: availableBalance
          ? {
              unscaledValue: availableBalance.amount.value.unscaledValue,
              scale: availableBalance.amount.value.scale,
              currency: availableBalance.amount.currencyCode,
            }
          : null,
        extractedBalance: balanceValue,
        currency,
      });

      return {
        userId,
        tinkAccountId: account.id,
        accountName: account.name,
        accountType: account.type,
        financialInstitutionId: account.financialInstitutionId,
        balance: balanceValue != null ? Math.round(balanceValue * 100) : 0, // Convert to cents, default to 0 if undefined
        currency,
        iban: account.identifiers?.iban?.iban,
        lastRefreshed: account.dates?.lastRefreshed
          ? new Date(account.dates.lastRefreshed)
          : null,
        accessToken: accessToken,
        tokenExpiresAt: expiresAt,
        tokenScope: tokenScope,
      };
    });

    console.log("Accounts to insert:", accountsToInsert);

    // Insert accounts, handling duplicates by updating existing ones
    const results = [];
    for (const accountData of accountsToInsert) {
      try {
        console.log("Processing account:", accountData.accountName);

        const existing = await db
          .select()
          .from(bankAccount)
          .where(
            and(
              eq(bankAccount.tinkAccountId, accountData.tinkAccountId!),
              eq(bankAccount.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          console.log("Updating existing account:", existing[0].id);
          // Update existing account
          const updated = await db
            .update(bankAccount)
            .set({
              ...accountData,
              updatedAt: new Date(),
            })
            .where(eq(bankAccount.id, existing[0].id))
            .returning();
          results.push(updated[0]);
          console.log("Account updated successfully");
        } else {
          console.log("Inserting new account");
          // Insert new account
          const inserted = await db
            .insert(bankAccount)
            .values(accountData)
            .returning();
          results.push(inserted[0]);
          console.log("Account inserted successfully:", inserted[0].id);
        }
      } catch (error) {
        console.error("Error storing account:", accountData.accountName, error);
        throw error;
      }
    }

    console.log("storeAccounts completed, stored:", results.length, "accounts");
    return results;
  }

  /**
   * Get Tink connection URL for user
   */
  getTinkConnectionUrl(
    market: string = "FR",
    locale: string = "en_US"
  ): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      market,
      locale,
    });

    return `https://link.tink.com/1.0/transactions/connect-accounts/?${params.toString()}`;
  }

  /**
   * Get Tink connection URL with state parameter for user identification
   */
  getTinkConnectionUrlWithState(
    market: string = "FR",
    locale: string = "en_US",
    state: string
  ): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      market,
      locale,
      state,
    });

    return `https://link.tink.com/1.0/transactions/connect-accounts/?${params.toString()}`;
  }

  /**
   * Generate state token for OAuth flow with user identification
   */
  generateStateToken(userId: string): string {
    return Buffer.from(
      JSON.stringify({
        userId,
        timestamp: Date.now(),
      })
    ).toString("base64");
  }

  // TODO:
  //   Consider adding expiration validation for state tokens.
  // While the state token includes a timestamp, there's no validation to ensure the token hasn't expired during the OAuth flow. This could leave the system vulnerable to replay attacks with old state tokens.

  // Consider implementing token expiration:

  // generateStateToken(userId: string): string {
  //   return Buffer.from(
  //     JSON.stringify({
  //       userId,
  //       timestamp: Date.now(),
  //       // Add a nonce for additional security
  //       nonce: crypto.randomBytes(16).toString('hex')
  //     })
  //   ).toString("base64");
  // }

  /**
   * Parse state token to extract user ID
   */
  parseStateToken(state: string): { userId: string; timestamp: number } | null {
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      return stateData;
    } catch (error) {
      console.warn("Failed to decode state parameter:", { state, error });
      return null;
    }
  }

  // TODO:
  //   Add timestamp validation when parsing state tokens.
  // The parseStateToken method should validate that the token hasn't expired to prevent replay attacks.

  // Apply this enhancement to validate token age:

  // parseStateToken(state: string): { userId: string; timestamp: number } | null {
  //     try {
  //       const stateData = JSON.parse(Buffer.from(state, "base64").toString());
  // +
  // +     // Validate token age (e.g., 10 minutes)
  // +     const TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
  // +     if (Date.now() - stateData.timestamp > TOKEN_MAX_AGE_MS) {
  // +       console.warn("State token expired", {
  // +         age: Date.now() - stateData.timestamp,
  // +         maxAge: TOKEN_MAX_AGE_MS
  // +       });
  // +       return null;
  // +     }
  // +

  /**
   * Complete account synchronization flow: exchange code -> fetch accounts -> store in DB
   */
  async syncUserAccounts(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    code: string
  ): Promise<{ accounts: BankAccount[]; count: number }> {
    // Exchange code for token
    const tokenResponse = await this.exchangeCodeForToken(code);

    // Fetch accounts from Tink
    const tinkAccounts = await this.fetchAccounts(tokenResponse.access_token);

    // Store accounts in database
    const storedAccounts = await this.storeAccounts(
      db,
      userId,
      tinkAccounts,
      tokenResponse.access_token,
      tokenResponse.scope,
      tokenResponse.expires_in
    );

    return {
      accounts: storedAccounts,
      count: storedAccounts.length,
    };
  }
}

export const tinkService = new TinkService();
