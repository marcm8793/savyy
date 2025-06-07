import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginCallback } from "fastify";

// Database plugin options interface
export interface DatabaseOptions {
  connectionString?: string;
}

// Extend Fastify instance to include our database
declare module "fastify" {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle>;
    pg: Pool;
  }
}

// Database plugin implementation
const databasePlugin: FastifyPluginCallback<DatabaseOptions> = (
  fastify: FastifyInstance,
  options: DatabaseOptions,
  done
) => {
  // Initialize PostgreSQL connection pool
  const pool = new Pool({
    connectionString: options.connectionString || process.env.DATABASE_URL,
  });

  // Initialize Drizzle ORM with the pool
  const db = drizzle(pool);

  // Decorate Fastify instance with database connections
  fastify.decorate("db", db);
  fastify.decorate("pg", pool);

  // Add cleanup hook for graceful shutdown
  fastify.addHook("onClose", async (instance) => {
    await pool.end();
    fastify.log.info("Database connection pool closed");
  });

  // Test the connection
  pool.connect((err, client, release) => {
    if (err) {
      fastify.log.error("Error connecting to database:", err);
      return done(err);
    }

    fastify.log.info("Database connected successfully");
    release();
    done();
  });
};

// Export the plugin wrapped with fastify-plugin
export default fp(databasePlugin, {
  name: "database-plugin",
  fastify: "4.x",
});
