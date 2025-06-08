import Fastify from 'fastify';
import databasePlugin from '../db/db';
import corsPlugin from './plugins/cors';
import trpcPlugin from './plugins/trpc';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import protectedRoutes from './routes/protected';
import publicRoutes from './routes/public';
import tinkRoutes from './routes/tink';

export async function createApp() {
  const fastify = Fastify({
    logger: true,
    maxParamLength: 5000,
  });

  // Register plugins in order
  await fastify.register(databasePlugin, {
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Register plugins
    try {
      await fastify.register(corsPlugin);
      await fastify.register(trpcPlugin);
    } catch (error) {
      fastify.log.error('Failed to register plugins:', error);
      throw error;
    }

    // Register routes
    try {
      await fastify.register(authRoutes);
      await fastify.register(healthRoutes);
      await fastify.register(protectedRoutes);
      await fastify.register(publicRoutes);
      await fastify.register(tinkRoutes);
    } catch (error) {
      fastify.log.error('Failed to register routes:', error);
      throw error;
    }

    return fastify;
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}
