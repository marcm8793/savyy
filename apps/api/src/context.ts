import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { auth } from './utils/auth';
import { FastifyRequest } from 'fastify';
import { Session } from 'better-auth';

/**
 * Creates context for an incoming request
 * @see https://trpc.io/docs/context
 */
export async function createContext({ req, res }: CreateFastifyContextOptions) {
  let session = null;

  try {
    // Get user session from Better Auth using request headers
    // Better Auth automatically handles cookies and session validation
    session = await auth.api.getSession({
      headers: req.headers as any,
    });
  } catch (error) {
    // Log the error but don't throw - allow the request to continue without auth
    console.error('Error getting session in tRPC context:', error);
    console.error('Request headers:', req.headers);
  }

  return {
    req,
    res,
    // Provide both user and session from Better Auth
    user: session?.user || null,
    session: session?.session || null,
    // Access database through Fastify instance
    // The database is available through the Fastify instance via the database plugin
    db: (req as FastifyRequest).server.db, // Access Drizzle ORM instance
    pg: (req as FastifyRequest).server.pg, // Access raw PostgreSQL pool if needed
  };
}

/**
 * Export context type for tRPC
 * This type will be available in all your procedures
 */
export type Context = Awaited<ReturnType<typeof createContext>>;
