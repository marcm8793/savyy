import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDatabase } from "../../db/db";
import * as schema from "../../db/schema";

// Create a dedicated database instance for Better Auth
const { db } = createDatabase();

/**
 * Utility function to split a full name into firstName and lastName with fallbacks
 */
export function splitNameWithFallbacks(
  name?: string | null,
  email?: string | null,
  existingFirstName?: string | null,
  existingLastName?: string | null
): { firstName: string; lastName: string } {
  let firstName = "";
  let lastName = "";

  // Try to split the provided name
  if (name && name.trim()) {
    const nameParts = name.trim().split(" ");
    firstName = nameParts[0] || "";
    lastName = nameParts.slice(1).join(" ") || "";
  }

  // Fallback to existing names if no new name provided
  if (!firstName && existingFirstName) {
    firstName = existingFirstName;
  }
  if (!lastName && existingLastName) {
    lastName = existingLastName;
  }

  // Fallback to email-based name if firstName is still empty
  if (!firstName && email) {
    const emailParts = email.split("@")[0];
    firstName = emailParts || "User";
  }

  // Ensure we always have at least default values
  if (!firstName) {
    firstName = "User";
  }
  if (!lastName) {
    lastName = "Account";
  }

  return { firstName, lastName };
}

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
          // Use the utility function for consistent name handling
          const { firstName, lastName } = splitNameWithFallbacks(
            user.name,
            user.email
          );

          return {
            data: {
              ...user,
              firstName,
              lastName,
            },
          };
        },
      },
      update: {
        before: async (user) => {
          // Cast user to include our additional fields
          const userWithFields = user as typeof user & {
            firstName?: string;
            lastName?: string;
          };

          // Use the utility function for consistent name handling
          const { firstName, lastName } = splitNameWithFallbacks(
            user.name,
            user.email,
            userWithFields.firstName,
            userWithFields.lastName
          );

          return {
            data: {
              ...user,
              firstName,
              lastName,
            },
          };
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
