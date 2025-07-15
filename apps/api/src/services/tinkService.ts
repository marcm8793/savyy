export interface TinkTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface TinkCreateUserRequest {
  external_user_id: string;
  id_hint: string;
  market: string;
  locale: string;
}

export interface TinkCreateUserResponse {
  user_id: string;
  external_user_id: string;
}

export interface TinkGrantUserAccessResponse {
  code: string;
}

export interface TinkUserAuthorizationCodeResponse {
  code: string;
}

// Provider consent types based on Tink API documentation
export interface TinkProviderConsent {
  accountIds: string[];
  credentialsId: string;
  detailedError?: {
    details: {
      reason: string;
      retryable: boolean;
    };
    displayMessage: string;
    type: string;
  };
  providerName: string;
  sessionExpiryDate: number;
  status: string;
  statusUpdated: number;
}

export interface TinkProviderConsentsResponse {
  providerConsents: TinkProviderConsent[];
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
    if (
      !this.clientId ||
      !this.clientSecret ||
      !this.redirectUri ||
      !this.actorClientId
    ) {
      throw new Error(
        `Missing required Tink environment variables: clientId=${!!this
          .clientId}, clientSecret=${!!this.clientSecret}, redirectUri=${!!this
          .redirectUri}, actorClientId=${!!this.actorClientId}`
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
    userId: string,
    market: string = "FR",
    locale: string = "en_US",
    idHint: string
  ): Promise<TinkCreateUserResponse> {
    const requestBody: TinkCreateUserRequest = {
      external_user_id: userId,
      id_hint: idHint,
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
      userId,
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
      tinkUserId: userData.user_id, // This is Tink's internal user ID
      externalUserId: userData.external_user_id, // This is our user ID
      fullResponse: userData, // Debug: log the full response to see the actual structure
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
      userId?: string; // Tink's internal user_id (rarely used)
      tinkUserId?: string; // Our external_user_id (commonly used)
      scope?: string;
      idHint: string;
    }
  ): Promise<TinkGrantUserAccessResponse> {
    // Validate that either userId (Tink internal) or tinkUserId (external) is provided
    if (!options.userId && !options.tinkUserId) {
      throw new Error(
        "Either userId (Tink internal) or tinkUserId (external) must be provided"
      );
    }

    if (!options.idHint) {
      throw new Error("idHint must be provided");
    }

    // Default scope as per Tink documentation Section 2.2 - Grant user access
    // This should NOT include data access scopes (accounts:read, etc.)
    const defaultScope =
      "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read";

    const requestBody = new URLSearchParams({
      actor_client_id: this.actorClientId,
      scope: options.scope || defaultScope,
    });

    // Add user identification (only one should be provided)
    if (options.userId) {
      requestBody.append("user_id", options.userId);
    } else if (options.tinkUserId) {
      requestBody.append("external_user_id", options.tinkUserId);
    }

    requestBody.append("id_hint", options.idHint);

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
      userIdentifier: options.tinkUserId
        ? { type: "external_user_id", value: options.tinkUserId }
        : { type: "user_id", value: options.userId },
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
      usedExternalUserId: !!options.tinkUserId,
      usedTinkInternalUserId: !!options.userId,
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
   * Generate authorization code for existing user to access their data
   * Uses client access token with authorization:grant scope
   */
  async generateUserAuthorizationCode(
    clientAccessToken: string,
    options: {
      userId?: string;
      tinkUserId?: string;
      scope?: string;
    }
  ): Promise<TinkUserAuthorizationCodeResponse> {
    // Validate that either userId or externalUserId is provided
    if (!options.userId && !options.tinkUserId) {
      throw new Error("Either userId or tinkUserId must be provided");
    }

    // Default scope for data access - includes credentials:refresh for refresh tokens
    const defaultScope =
      "accounts:read,balances:read,transactions:read,provider-consents:read,credentials:refresh";

    const requestBody = new URLSearchParams({
      scope: options.scope || defaultScope,
    });

    // Add user identification (only one should be provided)
    // For continuous access, we should use external_user_id with our internal user ID
    if (options.userId) {
      requestBody.append("user_id", options.userId);
    } else if (options.tinkUserId) {
      // tinkUserId parameter actually contains our internal user ID for external_user_id
      requestBody.append("external_user_id", options.tinkUserId);
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
      tinkUserId: options.tinkUserId,
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
    tinkUserId?: string;
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

  // Note: refreshAccessToken method removed as Tink doesn't provide refresh tokens reliably
  // Use getUserAccessTokenFlow for token renewal instead

  //____________________________________________________________________________________
  //____________________________________________________________________________________
  // NOTE:
  // Provider Consent Management
  //____________________________________________________________________________________
  //____________________________________________________________________________________

  /**
   * List provider consents for a user
   * Requires user access token with provider-consents:read scope
   */
  async listProviderConsents(
    userAccessToken: string
  ): Promise<TinkProviderConsentsResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/provider-consents`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Tink provider consents response:", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to list provider consents:", errorText);
      throw new Error(
        `Failed to list provider consents: ${response.status} ${errorText}`
      );
    }

    const data: TinkProviderConsentsResponse =
      (await response.json()) as TinkProviderConsentsResponse;

    console.log("Provider consents fetched:", {
      consentCount: data.providerConsents?.length || 0,
      consents:
        data.providerConsents?.map((consent) => ({
          credentialsId: consent.credentialsId,
          providerName: consent.providerName,
          status: consent.status,
          accountCount: consent.accountIds?.length || 0,
          hasError: !!consent.detailedError,
          sessionExpiryDate: new Date(consent.sessionExpiryDate).toISOString(),
        })) || [],
    });

    return data;
  }

  /**
   * Build Tink URL for updating consent
   * Used when a consent needs to be refreshed due to expiration or errors
   */
  buildUpdateConsentUrl(
    authorizationCode: string,
    credentialsId: string,
    options: {
      market?: string;
      locale?: string;
      state?: string;
      redirectUri?: string;
    } = {}
  ): string {
    const { market = "FR", state, redirectUri = this.redirectUri } = options;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      credentials_id: credentialsId,
      authorization_code: authorizationCode,
      market,
    });

    if (state) {
      params.append("state", state);
    }

    return `https://link.tink.com/1.0/transactions/update-consent?${params.toString()}`;
  }

  /**
   * Build Tink URL for extending consent
   * Used to extend the validity of an existing consent session
   */
  buildExtendConsentUrl(
    authorizationCode: string,
    credentialsId: string,
    options: {
      market?: string;
      locale?: string;
      state?: string;
      redirectUri?: string;
    } = {}
  ): string {
    const { market = "FR", state, redirectUri = this.redirectUri } = options;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      credentials_id: credentialsId,
      authorization_code: authorizationCode,
      market,
    });

    if (state) {
      params.append("state", state);
    }

    return `https://link.tink.com/1.0/transactions/extend-consent?${params.toString()}`;
  }

  /**
   * Check if a consent needs updating based on status and expiry
   */
  isConsentUpdateNeeded(consent: TinkProviderConsent): boolean {
    const now = Date.now();

    // Enhanced logging for debugging session expiry issues
    console.log("Checking consent update need:", {
      credentialsId: consent.credentialsId,
      providerName: consent.providerName,
      status: consent.status,
      currentTimestamp: now,
      sessionExpiryDate: consent.sessionExpiryDate,
      sessionExpiryDateFormatted: new Date(
        consent.sessionExpiryDate
      ).toISOString(),
      currentTimeFormatted: new Date(now).toISOString(),
      timeUntilExpiry: consent.sessionExpiryDate - now,
      timeUntilExpiryHours:
        Math.round(
          ((consent.sessionExpiryDate - now) / (1000 * 60 * 60)) * 100
        ) / 100,
      isExpired: consent.sessionExpiryDate < now,
      hasRetryableError: !!consent.detailedError?.details?.retryable,
    });

    // Check if consent has expired
    if (consent.sessionExpiryDate && consent.sessionExpiryDate < now) {
      console.warn("Consent has expired:", {
        credentialsId: consent.credentialsId,
        expiredSince: now - consent.sessionExpiryDate,
        expiredSinceHours:
          Math.round(
            ((now - consent.sessionExpiryDate) / (1000 * 60 * 60)) * 100
          ) / 100,
      });
      return true;
    }

    // Check if consent has errors that are retryable
    if (consent.detailedError?.details?.retryable) {
      console.warn("Consent has retryable error:", {
        credentialsId: consent.credentialsId,
        errorType: consent.detailedError.type,
        errorReason: consent.detailedError.details.reason,
        errorMessage: consent.detailedError.displayMessage,
      });
      return true;
    }

    // Check status - these typically need updates
    const statusesNeedingUpdate = [
      "TEMPORARY_ERROR",
      "AUTHENTICATION_ERROR",
      "SESSION_EXPIRED",
    ];

    if (statusesNeedingUpdate.includes(consent.status)) {
      console.warn("Consent status requires update:", {
        credentialsId: consent.credentialsId,
        status: consent.status,
      });
      return true;
    }

    return false;
  }

  /**
   * Check if a consent is about to expire (within the next 24 hours)
   * This can be used to proactively refresh consents before they expire
   */
  isConsentExpiringsoon(
    consent: TinkProviderConsent,
    hoursBeforeExpiry: number = 24
  ): boolean {
    const now = Date.now();
    const expiryThreshold = now + hoursBeforeExpiry * 60 * 60 * 1000;

    const isExpiringSoon = !!(
      consent.sessionExpiryDate && consent.sessionExpiryDate < expiryThreshold
    );

    if (isExpiringSoon) {
      console.log("Consent expiring soon:", {
        credentialsId: consent.credentialsId,
        providerName: consent.providerName,
        sessionExpiryDate: new Date(consent.sessionExpiryDate).toISOString(),
        hoursUntilExpiry:
          Math.round(
            ((consent.sessionExpiryDate - now) / (1000 * 60 * 60)) * 100
          ) / 100,
        thresholdHours: hoursBeforeExpiry,
      });
    }

    return isExpiringSoon;
  }

  /**
   * Refresh credentials to extend session validity
   * This should be called when a consent needs updating or is about to expire
   */
  async refreshCredentials(
    userAccessToken: string,
    credentialsId: string
  ): Promise<void> {
    console.log("Refreshing credentials:", { credentialsId });

    const response = await fetch(
      `${this.baseUrl}/api/v1/credentials/${credentialsId}/refresh`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Tink credentials refresh response:", {
      status: response.status,
      statusText: response.statusText,
      credentialsId,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to refresh credentials:", {
        credentialsId,
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Failed to refresh credentials ${credentialsId}: ${response.status} ${errorText}`
      );
    }

    // Note: This endpoint returns 204 No Content on success
    console.log("Credentials refresh initiated successfully:", {
      credentialsId,
    });
  }

  /**
   * Get consent by credentials ID
   */
  async getConsentByCredentialsId(
    userAccessToken: string,
    credentialsId: string
  ): Promise<TinkProviderConsent | null> {
    const consentsResponse = await this.listProviderConsents(userAccessToken);

    const consent = consentsResponse.providerConsents.find(
      (c) => c.credentialsId === credentialsId
    );

    return consent || null;
  }

  /**
   * Analyze all provider consents and return expiry status summary
   * This helps with proactive session management and monitoring
   */
  async analyzeConsentExpiryStatus(userAccessToken: string): Promise<{
    total: number;
    expired: TinkProviderConsent[];
    expiringSoon: TinkProviderConsent[];
    needingUpdate: TinkProviderConsent[];
    healthy: TinkProviderConsent[];
    summary: {
      expiredCount: number;
      expiringSoonCount: number;
      needingUpdateCount: number;
      healthyCount: number;
      avgHoursUntilExpiry: number;
    };
  }> {
    const consentsResponse = await this.listProviderConsents(userAccessToken);
    const consents = consentsResponse.providerConsents;

    const expired: TinkProviderConsent[] = [];
    const expiringSoon: TinkProviderConsent[] = [];
    const needingUpdate: TinkProviderConsent[] = [];
    const healthy: TinkProviderConsent[] = [];

    let totalHoursUntilExpiry = 0;
    let validExpiryCount = 0;

    for (const consent of consents) {
      const now = Date.now();

      // Calculate hours until expiry for averaging
      if (consent.sessionExpiryDate) {
        const hoursUntilExpiry =
          (consent.sessionExpiryDate - now) / (1000 * 60 * 60);
        totalHoursUntilExpiry += hoursUntilExpiry;
        validExpiryCount++;
      }

      // Categorize consents
      if (this.isConsentUpdateNeeded(consent)) {
        if (consent.sessionExpiryDate && consent.sessionExpiryDate < now) {
          expired.push(consent);
        } else {
          needingUpdate.push(consent);
        }
      } else if (this.isConsentExpiringsoon(consent, 24)) {
        expiringSoon.push(consent);
      } else {
        healthy.push(consent);
      }
    }

    const avgHoursUntilExpiry =
      validExpiryCount > 0 ? totalHoursUntilExpiry / validExpiryCount : 0;

    const analysis = {
      total: consents.length,
      expired,
      expiringSoon,
      needingUpdate,
      healthy,
      summary: {
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
        needingUpdateCount: needingUpdate.length,
        healthyCount: healthy.length,
        avgHoursUntilExpiry: Math.round(avgHoursUntilExpiry * 100) / 100,
      },
    };

    console.log("Consent expiry analysis:", {
      totalConsents: analysis.total,
      summary: analysis.summary,
      expiredCredentials: expired.map((c) => ({
        credentialsId: c.credentialsId,
        providerName: c.providerName,
        status: c.status,
        expiredHoursAgo:
          Math.round(
            ((Date.now() - c.sessionExpiryDate) / (1000 * 60 * 60)) * 100
          ) / 100,
      })),
      expiringSoonCredentials: expiringSoon.map((c) => ({
        credentialsId: c.credentialsId,
        providerName: c.providerName,
        hoursUntilExpiry:
          Math.round(
            ((c.sessionExpiryDate - Date.now()) / (1000 * 60 * 60)) * 100
          ) / 100,
      })),
    });

    return analysis;
  }
}

export const tinkService = new TinkService();
