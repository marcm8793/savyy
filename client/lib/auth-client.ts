import { createAuthClient } from "better-auth/react";
import { getAuthUrl } from "./config";

export const authClient = createAuthClient({
  baseURL: getAuthUrl(),
});

// Export commonly used methods for convenience
export const { signIn, signOut, signUp, useSession } = authClient;
