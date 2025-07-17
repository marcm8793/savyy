import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { auth } from "./utils/auth";
import { FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable } from "../db/schema";

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
      headers: new Headers(
        Object.entries(req.headers)
          .filter(
            (entry): entry is [string, string | string[]] =>
              entry[1] !== undefined
          )
          .map(
            ([k, v]) =>
              [k, Array.isArray(v) ? v.join(", ") : String(v)] as [
                string,
                string
              ]
          )
      ),
    });
  } catch (error) {
    // Log the error but don't throw - allow the request to continue without auth
    console.error("Error getting session in tRPC context:", error);
    console.error("Request headers:", req.headers);
  }

  // If we have a user in the session, get the full user data
  let fullUser = null;
  if (session?.user) {
    try {
      // Better Auth session only contains limited user data
      // We need to fetch the full user record
      const db = (req as FastifyRequest).server.db;
      const userResult = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1);

      if (userResult.length > 0) {
        fullUser = userResult[0];
      } else {
        // Fallback to session user if database lookup fails
        fullUser = session.user;
      }
    } catch (error) {
      console.error("Failed to fetch user data in context:", error);
      // Fallback to raw user data if fetch fails
      fullUser = session.user;
    }
  }

  return {
    req,
    res,
    // Provide user data and session from Better Auth
    user: fullUser,
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
