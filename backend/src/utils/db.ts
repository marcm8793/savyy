import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://user:password@localhost:5432/finance",
});

// Initialize Drizzle ORM
export const db = drizzle(pool);
