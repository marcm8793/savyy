import fp from 'fastify-plugin';
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { FastifyPluginAsync } from 'fastify';
import { appRouter, type AppRouter } from '../routers';
import { createContext } from '../context';

const trpcPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        fastify.log.error(`Error in tRPC handler on path '${path}':`, error);
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });
};

export default fp(trpcPlugin, {
  name: 'trpc-plugin',
  fastify: '5.x',
});
