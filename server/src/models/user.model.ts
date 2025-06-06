import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

// Define user schema for Drizzle ORM
export const user = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
});
