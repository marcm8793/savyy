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

interface TinkCreateUserRequest {
  external_user_id?: string;
  market: string;
  locale: string;
}

interface TinkCreateUserResponse {
  external_user_id?: string;
  user_id: string;
}

interface TinkGrantUserAccessResponse {
  code: string;
}

interface TinkUserAuthorizationCodeResponse {
  code: string;
}

export class TinkService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl: string;
  private readonly actorClientId: string;

  constructor() {
    this.clientId = process.env.TINK_CLIENT_ID!;
    this.clientSecret = process.env.TINK_CLIENT_SECRET!;
    this.redirectUri = process.env.TINK_REDIRECT_URI!;
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
    this.actorClientId = process.env.TINK_ACTOR_CLIENT_ID!;
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error(
        `Missing required Tink environment variables: clientId=${!!this
          .clientId}, clientSecret=${!!this.clientSecret}, redirectUri=${!!this
          .redirectUri}`
      );
    }
  }

  //____________________________________________________________________________________
  //____________________________________________________________________________________
  // NOTE:
  // Provide continuous access to the user's bank accounts
  //____________________________________________________________________________________
  //____________________________________________________________________________________

  /**
   * Get client access token for user creation
   * Uses client_credentials grant type with user:create scope
   */
  async getClientAccessToken(): Promise<TinkTokenResponse> {
    const requestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "user:create",
    });

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    console.log("Tink client access token response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink client access token error:", errorText);
      throw new Error(
        `Failed to get client access token: ${response.status} ${errorText}`
      );
    }

    const tokenData = (await response.json()) as TinkTokenResponse;
    console.log("Tink client access token success:", {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    });

    return tokenData;
  }

  /**
   * Create a new user in Tink
   * Uses client access token with user:create scope
   */
  async createUser(
    clientAccessToken: string,
    externalUserId: string,
    market: string = "FR",
    locale: string = "en_US"
  ): Promise<TinkCreateUserResponse> {
    const requestBody: TinkCreateUserRequest = {
      external_user_id: externalUserId,
      market,
      locale,
    };

    const response = await fetch(`${this.baseUrl}/api/v1/user/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Tink create user response:", {
      status: response.status,
      statusText: response.statusText,
      externalUserId,
      market,
      locale,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink create user error:", errorText);
      throw new Error(`Failed to create user: ${response.status} ${errorText}`);
    }

    const userData = (await response.json()) as TinkCreateUserResponse;
    console.log("Tink create user success:", {
      externalUserId: userData.external_user_id,
      userId: userData.user_id,
    });

    return userData;
  }

  /**
   * Get client access token for authorization grants
   * Uses client_credentials grant type with authorization:grant scope
   */
  async getAuthorizationGrantToken(): Promise<TinkTokenResponse> {
    const requestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "authorization:grant",
    });

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    console.log("Tink authorization grant token response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink authorization grant token error:", errorText);
      throw new Error(
        `Failed to get authorization grant token: ${response.status} ${errorText}`
      );
    }

    const tokenData = (await response.json()) as TinkTokenResponse;
    console.log("Tink authorization grant token success:", {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    });

    return tokenData;
  }

  /**
   * Grant user access for bank account connection
   * Uses authorization grant token to delegate access to a user
   */
  async grantUserAccess(
    authorizationGrantToken: string,
    options: {
      userId?: string;
      externalUserId?: string;
      idHint?: string;
      scope?: string;
    }
  ): Promise<TinkGrantUserAccessResponse> {
    // Validate that either userId or externalUserId is provided
    if (!options.userId && !options.externalUserId) {
      throw new Error("Either userId or externalUserId must be provided");
    }

    // Default scope as per Tink documentation
    const defaultScope =
      "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read";

    const requestBody = new URLSearchParams({
      actor_client_id: this.actorClientId,
      scope: options.scope || defaultScope,
    });

    // Add user identification (only one should be provided)
    if (options.userId) {
      requestBody.append("user_id", options.userId);
    } else if (options.externalUserId) {
      requestBody.append("external_user_id", options.externalUserId);
    }

    // Add optional id_hint
    if (options.idHint) {
      requestBody.append("id_hint", options.idHint);
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/oauth/authorization-grant/delegate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authorizationGrantToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
      }
    );

    console.log("Tink grant user access response:", {
      status: response.status,
      statusText: response.statusText,
      userId: options.userId,
      externalUserId: options.externalUserId,
      idHint: options.idHint,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink grant user access error:", errorText);
      throw new Error(
        `Failed to grant user access: ${response.status} ${errorText}`
      );
    }

    const grantData = (await response.json()) as TinkGrantUserAccessResponse;
    console.log("Tink grant user access success:", {
      hasCode: !!grantData.code,
      codeLength: grantData.code?.length,
    });

    return grantData;
  }

  /**
   * Build complete Tink URL with authorization code for user bank connection
   * This URL allows users to authenticate with their bank and connect accounts
   */
  buildTinkUrlWithAuthorizationCode(
    authorizationCode: string,
    options: {
      market?: string;
      locale?: string;
      state?: string;
      redirectUri?: string;
    } = {}
  ): string {
    const {
      market = "FR",
      locale = "en_US",
      state,
      redirectUri = this.redirectUri,
    } = options;

    const params = new URLSearchParams({
      client_id: this.clientId,
      authorization_code: authorizationCode,
      redirect_uri: redirectUri,
      market,
      locale,
    });

    // Add optional state parameter for CSRF protection and user tracking
    if (state) {
      params.append("state", state);
    }

    const url = `https://link.tink.com/1.0/transactions/connect-accounts?${params.toString()}`;

    console.log("Built Tink URL:", {
      hasAuthorizationCode: !!authorizationCode,
      market,
      locale,
      hasState: !!state,
      redirectUri,
    });

    return url;
  }

  /**
   * Parse callback URL parameters from Tink redirect
   * Extracts credentials_id, state, and other parameters from the callback
   */
  parseCallbackUrl(callbackUrl: string): {
    clientId?: string;
    credentialsId?: string;
    state?: string;
    redirectUri?: string;
  } | null {
    try {
      const url = new URL(callbackUrl);
      const params = url.searchParams;

      const result = {
        clientId: params.get("client_id") || undefined,
        credentialsId: params.get("credentials_id") || undefined,
        state: params.get("state") || undefined,
        redirectUri: params.get("redirect_uri") || undefined,
      };

      console.log("Parsed callback URL:", {
        hasCredentialsId: !!result.credentialsId,
        hasState: !!result.state,
        clientId: result.clientId,
      });

      return result;
    } catch (error) {
      console.error("Failed to parse callback URL:", { callbackUrl, error });
      return null;
    }
  }

  /**
   * Generate authorization code for existing user to access their data
   * Uses client access token with authorization:grant scope
   */
  async generateUserAuthorizationCode(
    clientAccessToken: string,
    options: {
      userId?: string;
      externalUserId?: string;
      scope?: string;
    }
  ): Promise<TinkUserAuthorizationCodeResponse> {
    // Validate that either userId or externalUserId is provided
    if (!options.userId && !options.externalUserId) {
      throw new Error("Either userId or externalUserId must be provided");
    }

    // Default scope for data access
    const defaultScope =
      "accounts:read,balances:read,transactions:read,provider-consents:read";

    const requestBody = new URLSearchParams({
      scope: options.scope || defaultScope,
    });

    // Add user identification (only one should be provided)
    if (options.userId) {
      requestBody.append("user_id", options.userId);
    } else if (options.externalUserId) {
      requestBody.append("external_user_id", options.externalUserId);
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/oauth/authorization-grant`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientAccessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
      }
    );

    console.log("Tink user authorization code response:", {
      status: response.status,
      statusText: response.statusText,
      userId: options.userId,
      externalUserId: options.externalUserId,
      scope: options.scope || defaultScope,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink user authorization code error:", errorText);
      throw new Error(
        `Failed to generate user authorization code: ${response.status} ${errorText}`
      );
    }

    const codeData =
      (await response.json()) as TinkUserAuthorizationCodeResponse;
    console.log("Tink user authorization code success:", {
      hasCode: !!codeData.code,
      codeLength: codeData.code?.length,
    });

    return codeData;
  }

  /**
   * Get user access token for data fetching
   * Exchange user authorization code for user access token
   */
  async getUserAccessToken(
    userAuthorizationCode: string
  ): Promise<TinkTokenResponse> {
    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: userAuthorizationCode,
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

    console.log("Tink user access token response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink user access token error:", errorText);
      throw new Error(
        `Failed to get user access token: ${response.status} ${errorText}`
      );
    }

    const tokenData = (await response.json()) as TinkTokenResponse;
    console.log("Tink user access token success:", {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    });

    return tokenData;
  }

  /**
   * Complete flow to get user access token for data fetching
   * Combines authorization code generation and token exchange
   */
  async getUserAccessTokenFlow(options: {
    userId?: string;
    externalUserId?: string;
    scope?: string;
  }): Promise<TinkTokenResponse> {
    // 1. Get client access token for authorization grants
    const clientToken = await this.getAuthorizationGrantToken();

    // 2. Generate user authorization code
    const authCode = await this.generateUserAuthorizationCode(
      clientToken.access_token,
      options
    );

    // 3. Exchange authorization code for user access token
    const userToken = await this.getUserAccessToken(authCode.code);

    return userToken;
  }

  //____________________________________________________________________________________
  //____________________________________________________________________________________
  //____________________________________________________________________________________
  //____________________________________________________________________________________

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

    const tokenData = (await response.json()) as TinkTokenResponse;
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

    const data: TinkAccountsResponse =
      (await response.json()) as TinkAccountsResponse;

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

    return response.json() as Promise<TinkTokenResponse>;
  }

  /**
   * Store Tink accounts in database
   */
  async storeAccounts(
    db: NodePgDatabase<typeof schema>,
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
        balance: balanceValue !== null ? Math.round(balanceValue * 100) : 0, // Convert to cents, default to 0 if undefined
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
              eq(bankAccount.tinkAccountId, accountData.tinkAccountId),
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
              balance: accountData.balance.toString(),
            })
            .where(eq(bankAccount.id, existing[0].id))
            .returning();
          results.push(updated[0]);
          console.log("Account updated successfully");
        } else {
          console.log("Inserting new account");
          // Insert new account
          // Insert new account
          const inserted = await db
            .insert(bankAccount)
            .values({
              ...accountData,
              balance: accountData.balance.toString(),
            })
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
  //   Unsigned state token – easy to forge
  // generateStateToken merely base64-encodes JSON, offering no authenticity guarantees.
  // Add an HMAC or switch to JWT:

  // +import crypto from "node:crypto";
  //  ...
  //  generateStateToken(userId: string): string {
  // -  return Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString("base64");
  // +  const payload = JSON.stringify({ userId, timestamp: Date.now() });
  // +  const sig = crypto
  // +    .createHmac("sha256", process.env.TINK_STATE_SECRET!)
  // +    .update(payload)
  // +    .digest("base64url");
  // +  return Buffer.from(`${payload}.${sig}`).toString("base64url");
  //  }
  // Validate the signature in parseStateToken.

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
