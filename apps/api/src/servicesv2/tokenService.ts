import { randomBytes } from "crypto";

export interface TokenGenerationOptions {
  length?: number;
  encoding?: "hex" | "base64" | "base64url";
}

export class TokenService {
  private readonly defaultLength: number = 32;
  private readonly defaultEncoding: "hex" | "base64" | "base64url" = "hex";

  constructor() {}

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

  generateStateToken(): string {
    return this.generateSecureToken({
      length: 32,
      encoding: "base64url"
    });
  }
}