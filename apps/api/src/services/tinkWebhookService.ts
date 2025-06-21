import crypto from "crypto";

// Tink webhook event types based on documentation
export interface TinkWebhookContext {
  userId: string;
  externalUserId?: string;
}

export interface TinkWebhookContent {
  // Common fields
  userId?: string;
  externalUserId?: string;

  // refresh:finished event fields
  credentialsId?: string;
  status?: string; // DEPRECATED
  credentialsStatus?:
    | "UPDATED"
    | "TEMPORARY_ERROR"
    | "AUTHENTICATION_ERROR"
    | "SESSION_EXPIRED";
  finished?: number; // timestamp
  source?:
    | "OPERATION_SOURCE_API"
    | "OPERATION_SOURCE_BACKGROUND"
    | "OPERATION_SOURCE_STREAMING";
  sessionExpiryDate?: number; // timestamp
  detailedError?: {
    type: string;
    displayMessage: string;
    details: {
      reason: string;
      retryable: boolean;
    };
  };

  // account-transactions:modified event fields
  account?: {
    id: string;
  };
  transactions?: {
    earliestModifiedBookedDate?: string;
    latestModifiedBookedDate?: string;
    inserted?: number;
    updated?: number;
    deleted?: number;
    ids?: string[]; // for account-transactions:deleted event
  };
}

export interface TinkWebhookPayload {
  context: TinkWebhookContext;
  content: TinkWebhookContent;
  event:
    | "refresh:finished"
    | "account-transactions:modified"
    | "account-booked-transactions:modified"
    | "account-transactions:deleted"
    | "account:created"
    | "account:updated";
}

export interface TinkWebhookEndpointRequest {
  description: string;
  disabled: boolean;
  enabledEvents: string[];
  url: string;
}

export interface TinkWebhookEndpointResponse {
  createdAt: string;
  description: string;
  disabled: boolean;
  enabledEvents: string[];
  id: string;
  secret: string;
  updatedAt: string;
  url: string;
}

export class TinkWebhookService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_API_URL || "https://api.tink.com";
  }

  /**
   * Generate a client access token for webhook management
   * Requires webhook-endpoints scope for webhook management
   */
  async getWebhookClientAccessToken(): Promise<string> {
    const requestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.TINK_CLIENT_ID!,
      client_secret: process.env.TINK_CLIENT_SECRET!,
      scope: "authorization:grant,user:create webhook-endpoints",
    });

    const response = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get webhook client access token: ${response.status} ${errorText}`
      );
    }

    const tokenData = (await response.json()) as {
      access_token: string;
    };
    return tokenData.access_token;
  }

  /**
   * Set up a webhook endpoint with Tink
   * This should only be done once per app
   */
  async createWebhookEndpoint(
    webhookUrl: string,
    description: string = "Savyy webhook",
    enabledEvents: string[] = [
      "refresh:finished",
      "account-transactions:modified",
      "account-booked-transactions:modified",
      "account-transactions:deleted",
      "account:created",
      "account:updated",
    ]
  ): Promise<TinkWebhookEndpointResponse> {
    const clientAccessToken = await this.getWebhookClientAccessToken();

    const requestBody: TinkWebhookEndpointRequest = {
      description,
      disabled: false,
      enabledEvents,
      url: webhookUrl,
    };

    const response = await fetch(
      `${this.baseUrl}/events/v2/webhook-endpoints`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create webhook endpoint: ${response.status} ${errorText}`
      );
    }

    const webhookResponse: TinkWebhookEndpointResponse =
      (await response.json()) as TinkWebhookEndpointResponse;

    console.log("Webhook endpoint created successfully:", {
      id: webhookResponse.id,
      url: webhookResponse.url,
      enabledEvents: webhookResponse.enabledEvents,
      // Don't log the secret for security
      hasSecret: !!webhookResponse.secret,
    });

    return webhookResponse;
  }

  /**
   * Verify webhook signature according to Tink's documentation
   * X-Tink-Signature: t=1620198421,v1=8a19c43be75fa428d09e99c13f52bbbe4e924f9ef6cf6aaf4b1414f3bd280233
   */
  verifyWebhookSignature(
    signature: string,
    timestamp: string,
    requestBody: string,
    secret: string
  ): boolean {
    try {
      // Parse the signature header
      const keyValues = signature.split(",");
      const validKeys = ["t", "v1"];
      const values = keyValues
        .map((kv) => kv.split("="))
        .filter((kv) => validKeys.includes(kv[0]))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

      const headerTimestamp = values.t;
      const headerSignature = values.v1;

      if (!headerTimestamp || !headerSignature) {
        console.error("Missing timestamp or signature in header");
        return false;
      }

      // Verify timestamp is within acceptable range (5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const webhookTimestamp = parseInt(headerTimestamp);

      if (Math.abs(now - webhookTimestamp) > 300) {
        // 5 minutes
        console.error("Webhook timestamp too old or too far in future");
        return false;
      }

      // Calculate expected signature
      const messageToSign = `${headerTimestamp}.${requestBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(messageToSign)
        .digest("hex");

      // Use constant-time comparison to prevent timing attacks
      if (headerSignature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(headerSignature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch (error) {
      console.error("Error verifying webhook signature:", error);
      return false;
    }
  }

  /**
   * Parse and validate Tink webhook payload
   */
  parseWebhookPayload(requestBody: string): TinkWebhookPayload {
    try {
      const payload = JSON.parse(requestBody) as TinkWebhookPayload;

      // Basic validation of required fields
      if (!payload.context || !payload.content || !payload.event) {
        throw new Error("Missing required webhook fields");
      }

      return payload;
    } catch (error) {
      throw new Error(
        `Invalid webhook payload: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
