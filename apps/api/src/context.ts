import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { auth } from "./utils/auth";
import { FastifyRequest } from "fastify";
import { userEncryptionService } from "./services/userEncryptionService";
import { eq } from "drizzle-orm";
import { user as userTable } from "../db/schema";
import type { User } from "../db/schema";

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

  // If we have a user in the session, get the full user data and decrypt it
  let decryptedUser = null;
  if (session?.user) {
    try {
      // Better Auth session only contains limited user data
      // We need to fetch the full user record to get encrypted fields
      const db = (req as FastifyRequest).server.db;
      const fullUser = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1);

      if (fullUser.length > 0) {
        // Decrypt the full user data
        const dbUser: User = fullUser[0];
        decryptedUser = await userEncryptionService.prepareUserForFrontend(
          dbUser
        );
      } else {
        // Fallback to session user if database lookup fails
        decryptedUser = session.user;
      }
    } catch (error) {
      console.error("Failed to fetch and decrypt user data in context:", error);
      // Fallback to raw user data if fetch/decryption fails
      decryptedUser = session.user;
    }
  }

  return {
    req,
    res,
    // Provide decrypted user data and session from Better Auth
    user: decryptedUser,
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
