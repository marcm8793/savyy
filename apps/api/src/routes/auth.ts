import { FastifyPluginAsync } from "fastify";
import { auth } from "../utils/auth";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);

        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) {
            headers.append(key, value.toString());
          }
        });

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        if (response.body) {
          const responseBody = await response.text();
          return reply.send(responseBody);
        } else {
          return reply.send(null);
        }
      } catch (error) {
        fastify.log.error("Authentication Error:", error);
        reply.status(500).send({
          error: "Internal authentication error",
          code: "AUTH_FAILURE",
        });
      }
    },
  });
};

export default authRoutes;
