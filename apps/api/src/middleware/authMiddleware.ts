/**
 * Better Auth Middleware for Fastify
 *
 * This middleware integrates better-auth with Fastify to provide session-based authentication.
 *
 * Usage Examples:
 *
 * 1. Protect all routes in a context:
 * ```typescript
 * fastify.register(async function protectedRoutes(fastify) {
 *   await fastify.register(authMiddleware);
 *
 *   fastify.get("/api/protected/profile", async (request, reply) => {
 *     // request.user and request.session are available and typed
 *     return { user: request.user };
 *   });
 * });
 * ```
 *
 * 2. Optional authentication (user might or might not be logged in):
 * ```typescript
 * fastify.register(async function optionalAuthRoutes(fastify) {
 *   await fastify.register(optionalAuthMiddleware);
 *
 *   fastify.get("/api/content", async (request, reply) => {
 *     if (request.user) {
 *       return { message: "Welcome back!", user: request.user };
 *     } else {
 *       return { message: "Welcome, guest!" };
 *     }
 *   });
 * });
 * ```
 *
 * 3. Manual authentication check in a route:
 * ```typescript
 * fastify.get("/api/manual-auth", async (request, reply) => {
 *   await requireAuth(request, reply);
 *   // User is guaranteed to be authenticated here
 *   return { user: request.user };
 * });
 * ```
 *
 * Authentication Flow:
 * - The middleware checks for session cookies or Authorization headers
 * - If valid session found: request.user and request.session are populated
 * - If no valid session: 401 Unauthorized response (for authMiddleware) or undefined user (for optionalAuthMiddleware)
 *
 * Client-side usage:
 * - Sign up: POST /api/auth/sign-up/email with { email, password }
 * - Sign in: POST /api/auth/sign-in/email with { email, password }
 * - Sign out: POST /api/auth/sign-out
 * - Get session: GET /api/auth/get-session
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../utils/auth';

// Extend Fastify request type to include user and session
declare module 'fastify' {
  interface FastifyRequest {
    user?: typeof auth.$Infer.Session.user;
    session?: typeof auth.$Infer.Session.session;
  }
}

// Authentication middleware using better-auth
export const authMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      // Get session using better-auth
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      if (!session) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'No valid session found',
        });
        return;
      }

      // Attach user and session to request object
      request.user = session.user;
      request.session = session.session;
    } catch (error) {
      fastify.log.error('Authentication error:', error);
      reply.code(401).send({
        error: 'Authentication failed',
        message: 'Invalid or expired session',
      });
      return;
    }
  });
};

// Optional: Create a more flexible middleware that allows optional authentication
export const optionalAuthMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const session = await auth.api.getSession({
        headers: request.headers as any,
      });

      if (session) {
        request.user = session.user;
        request.session = session.session;
      } else {
        request.user = undefined;
        request.session = undefined;
      }
    } catch (error) {
      fastify.log.warn('Optional auth check failed:', error);
      request.user = undefined;
      request.session = undefined;
    }
  });
};

// Helper function to require authentication for specific routes
export const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!request.user) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required for this endpoint',
    });
    return;
  }
};
