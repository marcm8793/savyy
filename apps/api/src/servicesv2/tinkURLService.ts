import { TokenService } from "./tokenService";

export interface BuildTinkConnectUrlRequest {
  authorizationCode: string;
  market: string;
  locale: string;
  redirectUri?: string;
  state?: string;
  generateState?: boolean;
}

export interface BuildTinkConnectUrlResponse {
  url: string;
  state?: string;
}

export interface TinkURLConfig {
  clientId: string;
  redirectUri: string;
  baseUrl: string;
}

export class TinkURLService {
  private readonly clientId: string;
  private readonly defaultRedirectUri: string;
  private readonly baseUrl: string;
  private readonly tokenService: TokenService;

  constructor(config?: Partial<TinkURLConfig>) {
    this.clientId = config?.clientId || process.env.TINK_CLIENT_ID || "";
    this.defaultRedirectUri = config?.redirectUri || process.env.TINK_REDIRECT_URI || "";
    this.baseUrl = config?.baseUrl || "https://link.tink.com";
    this.tokenService = new TokenService();

    if (!this.clientId) {
      throw new Error("TINK_CLIENT_ID environment variable is required");
    }

    if (!this.defaultRedirectUri) {
      throw new Error("TINK_REDIRECT_URI environment variable is required");
    }
  }

  buildConnectAccountsUrl(request: BuildTinkConnectUrlRequest): BuildTinkConnectUrlResponse {
    const {
      authorizationCode,
      market,
      locale,
      redirectUri,
      state,
      generateState = false
    } = request;

    if (!authorizationCode) {
      throw new Error("Authorization code is required");
    }

    if (!market) {
      throw new Error("Market is required");
    }

    if (!locale) {
      throw new Error("Locale is required");
    }

    const finalRedirectUri = redirectUri || this.defaultRedirectUri;
    let finalState = state;

    if (generateState && !state) {
      finalState = this.tokenService.generateStateToken();
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      authorization_code: authorizationCode,
      redirect_uri: finalRedirectUri,
      market,
      locale
    });

    if (finalState) {
      params.append("state", finalState);
    }

    const url = `${this.baseUrl}/1.0/transactions/connect-accounts?${params.toString()}`;

    console.log("Built Tink connect accounts URL:", {
      hasUrl: !!url,
      hasState: !!finalState,
      market,
      locale,
      clientId: this.clientId,
      redirectUri: finalRedirectUri
    });

    return {
      url,
      state: finalState
    };
  }

  buildUpdateConsentUrl(request: {
    authorizationCode: string;
    credentialsId: string;
    market: string;
    locale?: string;
    redirectUri?: string;
    state?: string;
    generateState?: boolean;
  }): BuildTinkConnectUrlResponse {
    const {
      authorizationCode,
      credentialsId,
      market,
      locale,
      redirectUri,
      state,
      generateState = false
    } = request;

    if (!authorizationCode) {
      throw new Error("Authorization code is required");
    }

    if (!credentialsId) {
      throw new Error("Credentials ID is required");
    }

    if (!market) {
      throw new Error("Market is required");
    }

    const finalRedirectUri = redirectUri || this.defaultRedirectUri;
    let finalState = state;

    if (generateState && !state) {
      finalState = this.tokenService.generateStateToken();
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: finalRedirectUri,
      credentials_id: credentialsId,
      authorization_code: authorizationCode,
      market
    });

    if (locale) {
      params.append("locale", locale);
    }

    if (finalState) {
      params.append("state", finalState);
    }

    const url = `${this.baseUrl}/1.0/transactions/update-consent?${params.toString()}`;

    console.log("Built Tink update consent URL:", {
      hasUrl: !!url,
      hasState: !!finalState,
      market,
      locale,
      credentialsId,
      clientId: this.clientId,
      redirectUri: finalRedirectUri
    });

    return {
      url,
      state: finalState
    };
  }

  buildExtendConsentUrl(request: {
    authorizationCode: string;
    credentialsId: string;
    market: string;
    locale?: string;
    redirectUri?: string;
    state?: string;
    generateState?: boolean;
  }): BuildTinkConnectUrlResponse {
    const {
      authorizationCode,
      credentialsId,
      market,
      locale,
      redirectUri,
      state,
      generateState = false
    } = request;

    if (!authorizationCode) {
      throw new Error("Authorization code is required");
    }

    if (!credentialsId) {
      throw new Error("Credentials ID is required");
    }

    if (!market) {
      throw new Error("Market is required");
    }

    const finalRedirectUri = redirectUri || this.defaultRedirectUri;
    let finalState = state;

    if (generateState && !state) {
      finalState = this.tokenService.generateStateToken();
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: finalRedirectUri,
      credentials_id: credentialsId,
      authorization_code: authorizationCode,
      market
    });

    if (locale) {
      params.append("locale", locale);
    }

    if (finalState) {
      params.append("state", finalState);
    }

    const url = `${this.baseUrl}/1.0/transactions/extend-consent?${params.toString()}`;

    console.log("Built Tink extend consent URL:", {
      hasUrl: !!url,
      hasState: !!finalState,
      market,
      locale,
      credentialsId,
      clientId: this.clientId,
      redirectUri: finalRedirectUri
    });

    return {
      url,
      state: finalState
    };
  }
}