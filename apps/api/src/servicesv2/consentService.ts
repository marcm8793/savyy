interface DetailedError {
  details: {
    reason: string;
    retryable: boolean;
  };
  displayMessage: string;
  type: string;
}

interface ProviderConsent {
  accountIds: string[];
  credentialsId: string;
  detailedError?: DetailedError;
  providerName: string;
  sessionExpiryDate: number;
  sessionExtendable: boolean;
  status: string;
  statusUpdated: number;
}

interface ProviderConsentListResponse {
  providerConsents: ProviderConsent[];
}

interface ListProviderConsentsParams {
  credentialsId?: string;
}

export class ConsentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_BASE_URL || "";
    if (!this.baseUrl) {
      throw new Error("TINK_BASE_URL environment variable is required");
    }
  }

  /**
   * List all provider consents for the user
   * Uses user access token with provider-consents:read scope
   */
  async listProviderConsents(
    userAccessToken: string,
    params?: ListProviderConsentsParams
  ): Promise<ProviderConsentListResponse> {
    let url = `${this.baseUrl}/api/v1/provider-consents`;
    
    // Add query parameters if provided
    if (params?.credentialsId) {
      const searchParams = new URLSearchParams();
      searchParams.append('credentialsId', params.credentialsId);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink list provider consents error:", errorText);
      throw new Error(`Failed to list provider consents: ${response.status} ${errorText}`);
    }

    const consentData = (await response.json()) as ProviderConsentListResponse;
    console.log("Tink list provider consents success:", {
      consentCount: consentData.providerConsents.length,
      credentialsFilter: params?.credentialsId || 'none',
    });

    return consentData;
  }
}