import { BetterAuthOptions } from "better-auth";

// Better Auth configuration
export const authConfig: BetterAuthOptions = {
  secret: process.env.AUTH_SECRET || "your-secret-key",
  jwt: {
    secret: process.env.JWT_SECRET || "your-jwt-secret",
    expiresIn: 60 * 60, // 1 hour in seconds
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  },
};
