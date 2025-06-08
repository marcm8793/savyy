/**
 * Centralized configuration for client-server communication
 * This file handles URL configuration for both tRPC and auth clients
 *
 * Local Development:
 * - Client runs on: http://localhost:3000
 * - Server runs on: http://localhost:8080
 * - Client makes requests TO server on port 8080
 */

/**
 * Get the base server URL based on environment
 */
function getBaseUrl(): string {
  // Browser should use relative path for same-origin requests in production
  // In development, we need to specify the server port explicitly
  if (typeof window !== "undefined") {
    // Browser environment
    if (process.env.NODE_ENV === "development") {
      // In development, client (port 3000) needs to call server (port 8080)
      return "http://localhost:8080";
    }
    // In production, use relative path (same domain)
    return "";
  }

  // Server-side rendering environments
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME) {
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  }

  // Development fallback for SSR - server runs on port 8080
  return "http://localhost:8080";
}

/**
 * Get the tRPC API endpoint URL
 */
export function getTRPCUrl(): string {
  return `${getBaseUrl()}/trpc`;
}

/**
 * Get the auth API endpoint URL
 */
export function getAuthUrl(): string {
  const base = getBaseUrl();

  // In production, use the configured auth URL if available
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_AUTH_URL
  ) {
    return process.env.NEXT_PUBLIC_AUTH_URL;
  }

  return base || "http://localhost:8080";
}

/**
 * Configuration object for easy access
 */
export const config = {
  urls: {
    trpc: getTRPCUrl(),
    auth: getAuthUrl(),
    base: getBaseUrl(),
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
} as const;
