import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../server/src/routers";

// Create the tRPC context for React components
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

// Function to get the API URL
function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  })();
  return `${base}/trpc`;
}

// Create vanilla tRPC client (for server-side usage)
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getUrl(),
      // You can pass any HTTP headers you wish here
      async headers() {
        return {
          // Add authorization headers if needed
          // authorization: getAuthCookie(),
        };
      },
    }),
  ],
});
