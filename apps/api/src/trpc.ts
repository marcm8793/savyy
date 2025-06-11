import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();

/**
 * Middleware to check if user is authenticated
 * Throws UNAUTHORIZED error if no valid session
 */
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      // Ensure user and session are non-null in protected procedures
      user: ctx.user,
      session: ctx.session,
    },
  });
});

/**
 * Optional authentication middleware
 * Allows both authenticated and non-authenticated users
 */
const optionalAuth = t.middleware(({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      // User and session might be null
      user: ctx.user ?? null,
      session: ctx.session ?? null,
    },
  });
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;

// Public procedure - no authentication required
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthenticated);

// Optional auth procedure - works with or without authentication
export const optionalAuthProcedure = t.procedure.use(optionalAuth);
