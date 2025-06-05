import { BetterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../utils/db";
import { user } from "../models/user.model";

// Initialize Better Auth
const auth = new BetterAuth({
  database: drizzleAdapter(db, { user }),
  secret: process.env.AUTH_SECRET || "your-secret-key",
  jwt: { secret: process.env.JWT_SECRET || "your-jwt-secret" },
});

// Authentication service methods
export const authService = {
  async register(email: string, password: string) {
    const user = await auth.register({ email, password });
    return user;
  },

  async login(email: string, password: string) {
    const result = await auth.login({ email, password });
    return result;
  },

  async verifyToken(token: string) {
    const user = await auth.verifyToken(token);
    return user || null;
  },
};
