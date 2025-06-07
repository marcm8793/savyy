import { FastifyPluginAsync } from "fastify";
import { authMiddleware } from "../middleware/authMiddleware";

const protectedRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authMiddleware);

  fastify.get("/api/protected/profile", async (request, reply) => {
    return {
      message: "This is a protected route",
      user: request.user,
      session: {
        id: request.session?.id,
        expiresAt: request.session?.expiresAt,
      },
    };
  });

  fastify.get("/api/protected/dashboard", async (request, reply) => {
    return {
      message: `Welcome to your dashboard, ${
        request.user?.name || request.user?.email
      }!`,
      userId: request.user?.id,
    };
  });
};

export default protectedRoutes;
