export interface OAuth2AuthenticationTokenResponse {
  access_token: string;
  expires_in: number;
  id_hint?: string;
  scope: string;
  token_type: string;
}

export interface GetAccessTokenRequest {
  client_id: string;
  client_secret?: string;
  grant_type:
    | "authorization_code"
    | "client_credentials"
    | "urn:ietf:params:oauth:grant-type:jwt-bearer";
  code?: string;
  scope?: string;
  assertion?: string;
}

export interface CreateAuthorizationGrantRequest {
  user_id?: string;
  external_user_id?: string;
  scope: string;
}

export interface CreateDelegatedAuthorizationGrantRequest {
  user_id?: string;
  external_user_id?: string;
  id_hint: string;
  actor_client_id: string;
  scope: string;
}

export interface OAuth2AuthorizeResponse {
  code: string;
}

export interface RevokeAllTokensRequest {
  user_id?: string;
  external_user_id?: string;
}

export class OAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = process.env.CLIENT_ID || "";
    this.clientSecret = process.env.CLIENT_SECRET || "";
    this.baseUrl = process.env.TINK_API_URL || "";
    if (!this.clientId || !this.clientSecret || !this.baseUrl) {
      throw new Error(
        "CLIENT_ID, CLIENT_SECRET, and TINK_API_URL environment variables are required"
      );
    }
  }

  /**
   * Get an access token using various grant types
   * For client credentials: Uses client_id and client_secret with grant_type=client_credentials
   * For authorization code: Uses client_id, client_secret, code with grant_type=authorization_code
   * For JWT bearer: Uses client_id, assertion with grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
   */
  async getClientAccessToken(
    request: GetAccessTokenRequest
  ): Promise<OAuth2AuthenticationTokenResponse> {
    const requestBody = new URLSearchParams({
      grant_type: request.grant_type,
      client_id: request.client_id,
    });

    // Add client_secret if provided
    if (request.client_secret) {
      requestBody.append("client_secret", request.client_secret);
    }

    // Add code if provided (for authorization_code grant)
    if (request.code) {
      requestBody.append("code", request.code);
    }

    // Add scope if provided
    if (request.scope) {
      requestBody.append("scope", request.scope);
    }

    // Add assertion if provided (for JWT bearer grant)
    if (request.assertion) {
      requestBody.append("assertion", request.assertion);
    }

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Get access token error:", errorText);
      throw new Error(
        `Failed to get access token: ${response.status} ${errorText}`
      );
    }

    const tokenData =
      (await response.json()) as OAuth2AuthenticationTokenResponse;
    console.log("Get access token success:", {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      grantType: request.grant_type,
      idHint: tokenData.id_hint,
    });

    return tokenData;
  }

  /**
   * Create a scoped authorization code for a user
   * Uses client access token with authorization:grant scope
   */
  async createAuthorizationGrant(
    clientAccessToken: string,
    request: CreateAuthorizationGrantRequest
  ): Promise<OAuth2AuthorizeResponse> {
    // Validate that either user_id or external_user_id is provided, but not both
    if (request.user_id && request.external_user_id) {
      throw new Error("Cannot specify both user_id and external_user_id");
    }

    if (!request.user_id && !request.external_user_id) {
      throw new Error("Must specify either user_id or external_user_id");
    }

    const requestBody = new URLSearchParams({
      scope: request.scope,
    });

    if (request.user_id) {
      requestBody.append("user_id", request.user_id);
    }

    if (request.external_user_id) {
      requestBody.append("external_user_id", request.external_user_id);
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Create authorization grant error:", errorText);
      throw new Error(
        `Failed to create authorization grant: ${response.status} ${errorText}`
      );
    }

    const authData = (await response.json()) as OAuth2AuthorizeResponse;
    console.log("Create authorization grant success:", {
      hasCode: !!authData.code,
      userId: request.user_id,
      externalUserId: request.external_user_id,
      scope: request.scope,
    });

    return authData;
  }

  /**
   * Create a delegated scoped authorization code for a user
   * Uses client access token with authorization:grant scope
   * Allows specifying an actor client that can use the authorization code
   */
  async createDelegatedAuthorizationGrant(
    clientAccessToken: string,
    request: CreateDelegatedAuthorizationGrantRequest
  ): Promise<OAuth2AuthorizeResponse> {
    // Validate that either user_id or external_user_id is provided, but not both
    if (request.user_id && request.external_user_id) {
      throw new Error("Cannot specify both user_id and external_user_id");
    }

    if (!request.user_id && !request.external_user_id) {
      throw new Error("Must specify either user_id or external_user_id");
    }

    const requestBody = new URLSearchParams({
      id_hint: request.id_hint,
      actor_client_id: request.actor_client_id,
      scope: request.scope,
    });

    if (request.user_id) {
      requestBody.append("user_id", request.user_id);
    }

    if (request.external_user_id) {
      requestBody.append("external_user_id", request.external_user_id);
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/oauth/authorization-grant/delegate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientAccessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: requestBody,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Create delegated authorization grant error:", errorText);
      throw new Error(
        `Failed to create delegated authorization grant: ${response.status} ${errorText}`
      );
    }

    const authData = (await response.json()) as OAuth2AuthorizeResponse;
    console.log("Create delegated authorization grant success:", {
      hasCode: !!authData.code,
      userId: request.user_id,
      externalUserId: request.external_user_id,
      idHint: request.id_hint,
      actorClientId: request.actor_client_id,
      scope: request.scope,
    });

    return authData;
  }

  /**
   * Revoke all access tokens for a user
   * Uses client access token with authorization:revoke scope
   */
  async revokeAllTokens(
    clientAccessToken: string,
    request: RevokeAllTokensRequest
  ): Promise<void> {
    // Validate that either user_id or external_user_id is provided, but not both
    if (request.user_id && request.external_user_id) {
      throw new Error("Cannot specify both user_id and external_user_id");
    }

    if (!request.user_id && !request.external_user_id) {
      throw new Error("Must specify either user_id or external_user_id");
    }

    const requestBody = new URLSearchParams();

    if (request.user_id) {
      requestBody.append("user_id", request.user_id);
    }

    if (request.external_user_id) {
      requestBody.append("external_user_id", request.external_user_id);
    }

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/revoke-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientAccessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Revoke all tokens error:", errorText);
      throw new Error(
        `Failed to revoke all tokens: ${response.status} ${errorText}`
      );
    }

    console.log("Revoke all tokens success:", {
      userId: request.user_id,
      externalUserId: request.external_user_id,
    });
  }
}
