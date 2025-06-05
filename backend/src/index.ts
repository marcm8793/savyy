import Fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { authMiddleware } from "./middleware/authMiddleware";
import { db } from "./utils/db";

// Initialize Fastify server
const fastify = Fastify({ logger: true });

// Register tRPC plugin
fastify.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

// Register authentication middleware for protected routes
fastify.register(authMiddleware);

// Start the server
async function start() {
  try {
    await fastify.listen({ port: 8080 });
    console.log("Server listening on http://localhost:8080/trpc");
    console.log("tRPC API is ready to use");
    console.log("Visit http://localhost:8080/trpc/docs for API documentation");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
