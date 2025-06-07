import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../server/src/routers";
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
      // Add authentication headers if needed
      async headers() {
        const headers: Record<string, string> = {};

        // Better Auth automatically handles cookies through the browser
        // For server-side requests, you might need to forward cookies
        if (typeof window === "undefined") {
          // Server-side: you can add cookie forwarding here if needed
          // headers.cookie = getServerSideCookies();
        }

        return headers;
      },
    }),
  ],
});

/**
 * Export the AppRouter type for use in other files
 */
export type { AppRouter } from "../../server/src/routers";
