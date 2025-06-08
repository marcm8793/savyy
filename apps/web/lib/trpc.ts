import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../api/src/routers";
import { getTRPCUrl } from "./config";

/**
 * Create tRPC React hooks for use in components
 * This is the modern way to set up tRPC with React Query
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Create vanilla tRPC client for server-side usage or non-React contexts
 * This client can be used in API routes, middleware, or server components
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getTRPCUrl(),
      async headers() {
        // Only try to get cookies on server-side during request handling
        if (typeof window === "undefined") {
          try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            return { cookie: cookieStore.toString() };
          } catch (error) {
            // cookies() not available (e.g., during build or in wrong context)
            console.warn("Could not access cookies:", error);
            return {};
          }
        }
        return {};
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: typeof window !== "undefined" ? "include" : "omit",
        });
      },
    }),
  ],
});

/**
 * Create shared tRPC client configuration
 * This avoids duplication between vanilla client and React client
 */
export function createTRPCClientConfig() {
  return {
    links: [
      httpBatchLink({
        url: getTRPCUrl(),
        async headers() {
          // Better Auth automatically handles cookies through the browser
          // No need to manually set cookies for same-origin requests in browser context
          return {};
        },
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include", // This ensures cookies are sent with requests
          });
        },
      }),
    ],
  };
}

/**
 * Export the AppRouter type for use in other files
 */
export type { AppRouter } from "../../api/src/routers";
