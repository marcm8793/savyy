import { randomBytes, createHmac, timingSafeEqual } from "crypto";

export interface TokenGenerationOptions {
  length?: number;
  encoding?: "hex" | "base64" | "base64url";
}

export interface StateTokenPayload {
  userId: string;
  timestamp: number;
  nonce: string;
}

export class TokenService {
  private readonly defaultLength: number = 32;
  private readonly defaultEncoding: "hex" | "base64" | "base64url" = "hex";
  private readonly STATE_SECRET: string;
  private readonly MAX_STATE_AGE: number = 600000; // 10 minutes

  constructor() {
    this.STATE_SECRET = process.env.STATE_SECRET || "";
    if (!this.STATE_SECRET) {
      throw new Error("STATE_SECRET environment variable is required");
    }
  }

  generateSecureToken(options: TokenGenerationOptions = {}): string {
    const length = options.length || this.defaultLength;
    const encoding = options.encoding || this.defaultEncoding;

    try {
      const randomBuffer = randomBytes(length);

      switch (encoding) {
        case "hex":
          return randomBuffer.toString("hex");
        case "base64":
          return randomBuffer.toString("base64");
        case "base64url":
          return randomBuffer.toString("base64url");
        default:
          throw new Error(`Unsupported encoding: ${encoding as string}`);
      }
    } catch (error) {
      console.error("Token generation error:", error);
      throw new Error("Failed to generate secure token");
    }
  }

  /**
   * Create a secure state token with HMAC signature for OAuth flows
   */
  createSecureStateToken(userId: string): string {
    const payload = {
      userId,
      timestamp: Date.now(),
      nonce: this.generateSecureToken({ length: 16, encoding: "base64url" }),
    };

    const payloadStr = JSON.stringify(payload);
    const signature = createHmac("sha256", this.STATE_SECRET)
      .update(payloadStr)
      .digest("base64url");

    // Format: payload.signature
    return `${Buffer.from(payloadStr).toString("base64url")}.${signature}`;
  }

  /**
   * Verify a secure state token and return the payload if valid
   */
  verifySecureStateToken(token: string): StateTokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) {
        return null;
      }

      const [payloadB64, signature] = parts;
      const payloadStr = Buffer.from(payloadB64, "base64url").toString();

      // Verify signature
      const expectedSignature = createHmac("sha256", this.STATE_SECRET)
        .update(payloadStr)
        .digest("base64url");

      const signatureBuffer = Buffer.from(signature, "base64url");
      const expectedBuffer = Buffer.from(expectedSignature, "base64url");

      if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
      }

      const payload = JSON.parse(payloadStr) as {
        userId?: string;
        timestamp?: number;
        nonce?: string;
      };

      if (!payload.userId || !payload.timestamp || !payload.nonce) {
        return null;
      }

      // Check age
      if (Date.now() - payload.timestamp > this.MAX_STATE_AGE) {
        return null;
      }

      return {
        userId: payload.userId,
        timestamp: payload.timestamp,
        nonce: payload.nonce,
      };
    } catch (error) {
      console.error("State token verification error:", error);
      return null;
    }
  }
}
