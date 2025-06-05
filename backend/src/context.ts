import { inferAsyncReturnType } from "@trpc/server";
import { FastifyRequest, FastifyReply } from "fastify";
import { authService } from "./services/authService";

// Create tRPC context
export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest;
  res: FastifyReply;
}) {
  // Extract token from headers
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = token ? await authService.verifyToken(token) : null;

  return { req, res, user, db };
}

// Export context type for tRPC
export type Context = inferAsyncReturnType<typeof createContext>;
