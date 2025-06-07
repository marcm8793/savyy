import Fastify from "fastify";
import databasePlugin from "../db/db";
import corsPlugin from "./plugins/cors";
import trpcPlugin from "./plugins/trpc";
import authRoutes from "./routes/auth";
import healthRoutes from "./routes/health";
import protectedRoutes from "./routes/protected";
import publicRoutes from "./routes/public";

export async function createApp() {
  const fastify = Fastify({
    logger: true,
    maxParamLength: 5000,
  });

  // Register plugins in order
  await fastify.register(databasePlugin, {
    connectionString: process.env.DATABASE_URL,
  });

  await fastify.register(corsPlugin);
  await fastify.register(trpcPlugin);

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(healthRoutes);
  await fastify.register(protectedRoutes);
  await fastify.register(publicRoutes);

  return fastify;
}
