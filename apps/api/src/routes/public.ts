import { FastifyPluginAsync } from "fastify";
import { optionalAuthMiddleware } from "../middleware/authMiddleware";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(optionalAuthMiddleware);

  fastify.get("/api/public/content", async (request, _reply) => {
    if (request.user) {
      return {
        message: "Welcome back!",
        personalizedContent: true,
        user: request.user.email,
      };
    } else {
      return {
        message: "Welcome, guest!",
        personalizedContent: false,
      };
    }
  });
};

export default publicRoutes;
