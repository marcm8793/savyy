import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDatabase } from "../../db/db";
import * as schema from "../../db/schema";
import { getEncryptionService } from "../services/encryptionService";
import { encryptionResultToFields } from "../types/encryption";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";

// Create a dedicated database instance for Better Auth
const { db } = createDatabase();

/**
 * Hash an email address for storage while maintaining uniqueness
 * This allows us to check for duplicate emails without storing them in plain text
 */
function hashEmail(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
  }
  return createHash("sha256")
    .update(normalizedEmail)
    .update(secret)
    .digest("hex");
}

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
    async getUserByEmail(email: string) {
      // Hash the incoming email to find the user
      const hashedEmail = hashEmail(email);
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, hashedEmail))
        .limit(1);

      return users[0] || null;
    },
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
      // Encrypted email fields
      encryptedEmail: {
        type: "string",
        required: false,
        input: false, // Don't allow user to set these directly
      },
      encryptedEmailIv: {
        type: "string",
        required: false,
        input: false,
      },
      encryptedEmailAuthTag: {
        type: "string",
        required: false,
        input: false,
      },
      encryptionKeyId: {
        type: "string",
        required: false,
        input: false,
      },
      // Encrypted Tink user ID fields
      encryptedTinkUserId: {
        type: "string",
        required: false,
        input: false,
      },
      encryptedTinkUserIdIv: {
        type: "string",
        required: false,
        input: false,
      },
      encryptedTinkUserIdAuthTag: {
        type: "string",
        required: false,
        input: false,
      },
      tinkUserId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log("🔧 USER CREATION HOOK STARTED");
          console.log("📧 Original user data:", {
            email: user.email,
            name: user.name,
          });

          try {
            // Store the original email for encryption
            const originalEmail = user.email;
            console.log("📧 Original email for encryption:", originalEmail);

            // Use the utility function for consistent name handling
            const { firstName, lastName } = splitNameWithFallbacks(
              user.name,
              originalEmail
            );
            console.log("👤 Name split result:", { firstName, lastName });

            // Check environment variables
            console.log("🔑 Environment variables check:");
            console.log(
              "  ENCRYPTION_MASTER_PASSWORD:",
              process.env.ENCRYPTION_MASTER_PASSWORD ? "SET" : "NOT SET"
            );
            console.log(
              "  ENCRYPTION_KEY_SALT:",
              process.env.ENCRYPTION_KEY_SALT ? "SET" : "NOT SET"
            );

            // Initialize encryption service
            console.log("🔐 Initializing encryption service...");
            const encryptionService = getEncryptionService();
            await encryptionService.waitForInitialization();
            console.log("✅ Encryption service initialized");

            // Encrypt the email address and hash it for uniqueness
            let encryptedEmailFields = {};
            let hashedEmail = user.email;

            if (originalEmail) {
              console.log("🔐 Encrypting email:", originalEmail);
              const encryptedEmail = await encryptionService.encrypt(
                originalEmail
              );
              console.log("✅ Email encrypted successfully:", {
                encryptedData:
                  encryptedEmail.encryptedData.substring(0, 20) + "...",
                keyId: encryptedEmail.keyId,
              });

              const emailFields = encryptionResultToFields(encryptedEmail);
              encryptedEmailFields = {
                encryptedEmail: emailFields.encryptedData,
                encryptedEmailIv: emailFields.iv,
                encryptedEmailAuthTag: emailFields.authTag,
                encryptionKeyId: emailFields.keyId,
              };
              console.log(
                "📦 Encrypted email fields prepared:",
                Object.keys(encryptedEmailFields)
              );

              // Hash the email for uniqueness constraint (Better Auth requirement)
              hashedEmail = hashEmail(originalEmail);
              console.log("🔒 Email hashed for uniqueness");
            }

            const finalUserData = {
              ...user,
              email: hashedEmail, // Store hashed email for Better Auth uniqueness
              firstName,
              lastName,
              ...encryptedEmailFields,
            };

            console.log(
              "✅ Final user data prepared with fields:",
              Object.keys(finalUserData)
            );
            console.log("🎯 USER CREATION HOOK SUCCESS");

            return {
              data: finalUserData,
            };
          } catch (error: unknown) {
            console.error("❌ ERROR in user creation hook:", error);
            console.error("❌ Error details:", {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : "No stack trace",
            });
            // Don't throw the error, just log it and continue with basic user creation
            // This ensures user creation doesn't fail even if encryption fails
            const { firstName, lastName } = splitNameWithFallbacks(
              user.name,
              user.email
            );

            return {
              data: {
                ...user,
                firstName,
                lastName,
                email: hashEmail(user.email),
              },
            };
          }
        },
      },
      update: {
        before: async (user) => {
          // Cast user to include our additional fields
          const userWithFields = user as typeof user & {
            firstName?: string;
            lastName?: string;
          };

          // For updates, we need to get the original email from encrypted fields
          // if it's being updated. This is complex, so for now we'll handle name updates only

          // Use the utility function for consistent name handling
          const { firstName, lastName } = splitNameWithFallbacks(
            user.name,
            null, // Don't use email for name fallback during updates
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
