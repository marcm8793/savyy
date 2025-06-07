import { createAuthClient } from "better-auth/react";
import { getAuthUrl } from "./config";

export const authClient = createAuthClient({
  baseURL: getAuthUrl(),
  fetchOptions: {
    credentials: "include",
  },
});

// Export commonly used methods for convenience
export const { signIn, signOut, signUp, useSession } = authClient;
