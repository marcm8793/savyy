import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginCallback } from "fastify";
import * as schema from "./schema";

export interface DatabaseOptions {
  connectionString?: string;
  poolConfig?: PoolConfig; // Allow pool configuration
}

// Factory function - no global state
export function createDatabase(
  connectionString?: string,
  poolConfig?: PoolConfig
) {
  const pool = new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
    ...poolConfig,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}

// For external use (like Better Auth), create when needed
export function getSharedDatabase() {
  return createDatabase();
}

declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    pg: Pool;
  }
}

const databasePlugin: FastifyPluginCallback<DatabaseOptions> = (
  fastify: FastifyInstance,
  options: DatabaseOptions,
  done
) => {
  const { db: pluginDb, pool: pluginPool } = createDatabase(
    options.connectionString,
    options.poolConfig
  );

  fastify.decorate("db", pluginDb);
  fastify.decorate("pg", pluginPool);

  fastify.addHook("onClose", async () => {
    await pluginPool.end();
    fastify.log.info("Database connection pool closed");
  });

  pluginPool.connect((err, client, release) => {
    if (err) {
      fastify.log.error("Error connecting to database:", err);
      return done(err);
    }
    fastify.log.info("Database connected successfully");
    release();
    done();
  });
};

export default fp(databasePlugin, {
  name: "database-plugin",
  fastify: "5.x",
});
