import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginCallback } from "fastify";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

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

/**
 * Drops all tables and data from the database
 * WARNING: This will permanently delete ALL data in the database
 */
export async function dropAllTablesAndData(): Promise<void> {
  const { db, pool } = createDatabase();

  try {
    console.log("🗑️  Starting to drop all tables and data...");

    // Disable foreign key checks temporarily to avoid constraint issues
    await db.execute(sql`SET session_replication_role = replica;`);

    // Get all table names from the current schema
    const result = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tableNames = result.rows.map((row) => row.tablename as string);

    if (tableNames.length === 0) {
      console.log("✅ No tables found to drop");
      return;
    }

    console.log(`📋 Found ${tableNames.length} tables to drop:`, tableNames);

    // Drop all tables with CASCADE to handle foreign key constraints
    for (const tableName of tableNames) {
      console.log(`🗑️  Dropping table: ${tableName}`);
      await db.execute(sql.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`));
    }

    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = DEFAULT;`);

    console.log("✅ Successfully dropped all tables and data");
  } catch (error) {
    console.error("❌ Error dropping tables:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
