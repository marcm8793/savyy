import 'dotenv/config';
import { createApp } from './app';

const PORT = Number(process.env.PORT) || 8080;

// Create and start server
createApp()
  .then((fastify) => {
    fastify.listen({ port: PORT }, (err) => {
      if (err) {
        fastify.log.error(err);
        process.exit(1);
      }
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
