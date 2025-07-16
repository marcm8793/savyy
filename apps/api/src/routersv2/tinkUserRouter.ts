import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { OAuthService } from "../servicesv2/oAuthService";
import { TinkUserService } from "../servicesv2/tinkUserService";
import { createDatabase } from "../../db/db";
import { eq } from "drizzle-orm";
import { user } from "../../db/schema";

// Input validation schema for creating a Tink user
const createUserSchema = z.object({
  market: z.string().optional().default("FR"),
  locale: z.string().optional().default("en_US"),
});

export const tinkUserRouter = router({
  // Create a Tink user for the authenticated user
  createTinkUser: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      const { db, pool } = createDatabase();
      const oAuthService = new OAuthService();
      const tinkUserService = new TinkUserService();

      try {
        // Check if the user already has a Tink user ID
        const existingUser = await db
          .select()
          .from(user)
          .where(eq(user.id, ctx.user.id))
          .limit(1);

        if (existingUser[0]?.tinkUserId) {
          throw new Error("User already has a Tink account");
        }

        // Step 1: Get client access token with user:create scope
        console.log("Getting client access token for user creation...");
        const tokenResponse = await oAuthService.getClientAccessToken({
          client_id: process.env.CLIENT_ID || "",
          client_secret: process.env.CLIENT_SECRET || "",
          grant_type: "client_credentials",
          scope: "user:create",
        });

        // Step 2: Create the Tink user using the database user ID as external_user_id
        console.log("Creating Tink user...");
        const tinkUserResponse = await tinkUserService.createUser(
          tokenResponse.access_token,
          ctx.user.id, // Use database user ID as external_user_id
          input.market,
          input.locale
        );

        // Step 3: Update the user record with the Tink user ID
        console.log("Updating user record with Tink user ID...");

        await db
          .update(user)
          .set({
            tinkUserId: tinkUserResponse.user_id,
            updatedAt: new Date(),
          })
          .where(eq(user.id, ctx.user.id));

        return {
          success: true,
          message: "Tink user created successfully",
          tinkUserId: tinkUserResponse.user_id,
          externalUserId: tinkUserResponse.external_user_id,
          market: input.market,
          locale: input.locale,
        };
      } catch (error) {
        console.error("Error creating Tink user:", error);

        if (error instanceof Error) {
          throw new Error(`Failed to create Tink user: ${error.message}`);
        }

        throw new Error("Failed to create Tink user");
      } finally {
        await pool.end();
      }
    }),
});
