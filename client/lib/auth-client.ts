import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_AUTH_URL
      : "http://localhost:3000", // Your server URL
});

// Export commonly used methods for convenience
export const { signIn, signOut, signUp, useSession } = authClient;
