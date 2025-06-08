import { FastifyPluginAsync } from "fastify";
import { authMiddleware } from "../middleware/authMiddleware";

const protectedRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authMiddleware);

  fastify.get("/api/protected/profile", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "User not authenticated" });
    }
    return {
      message: "This is a protected route",
      user: {
        id: request.user?.id,
        name: request.user?.name,
        email: request.user?.email,
      },
      session: {
        id: request.session?.id,
        expiresAt: request.session?.expiresAt,
      },
    };
  });

  fastify.get("/api/protected/dashboard", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "User not authenticated" });
    }
    return {
      message: `Welcome to your dashboard, ${
        request.user?.name || request.user?.email
      }!`,
      userId: request.user?.id,
    };
  });
};

export default protectedRoutes;
