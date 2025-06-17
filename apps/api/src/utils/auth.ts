import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDatabase } from "../../db/db";
import * as schema from "../../db/schema";

// Create a dedicated database instance for Better Auth
const { db } = createDatabase();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.CLIENT_ORIGIN
    ? [process.env.CLIENT_ORIGIN]
    : ["http://localhost:3000"], // Default for development
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false, // Make it optional so we can set it via database hook
      },
      lastName: {
        type: "string",
        required: false, // Make it optional so we can set it via database hook
      },
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // Don't allow user to set role
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Split the name field into firstName and lastName
          if (user.name) {
            const nameParts = user.name.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            return {
              data: {
                ...user,
                firstName,
                lastName,
              },
            };
          }
          return { data: user };
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
    freshAge: 60 * 5, // 5 minutes (the session is fresh if created within the last 5 minutes)
  },
});
