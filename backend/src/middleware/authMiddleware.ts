import { FastifyPluginAsync } from "fastify";
import { authService } from "../services/authService";

// Authentication middleware
export const authMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const user = await authService.verifyToken(token);
    if (!user) {
      reply.code(401).send({ error: "Invalid token" });
      return;
    }
    request.user = user;
  });
};
