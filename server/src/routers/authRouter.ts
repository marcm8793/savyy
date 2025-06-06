import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";

// Define authentication router
export const authRouter = router({
  // Get current session - public procedure that returns user if authenticated
  getSession: publicProcedure.query(async ({ ctx }) => {
    return {
      user: ctx.user,
      session: ctx.session,
      isAuthenticated: !!ctx.user,
    };
  }),

  // Get user profile - protected procedure (requires authentication)
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // ctx.user and ctx.session are guaranteed to be non-null here
    return {
      user: ctx.user,
      session: {
        id: ctx.session.id,
        expiresAt: ctx.session.expiresAt,
      },
    };
  }),

  // Update user profile - protected procedure
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        // Add other profile fields as needed
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Here you would update the user in your database
      // ctx.user and ctx.session are guaranteed to be non-null

      // Example: Update user in database
      // await ctx.db.update(users).set(input).where(eq(users.id, ctx.user.id));

      return {
        message: "Profile updated successfully",
        userId: ctx.user.id,
        updates: input,
      };
    }),

  // Delete account - protected procedure
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // Here you would delete the user account
    // ctx.user is guaranteed to be non-null

    return {
      message: "Account deletion initiated",
      userId: ctx.user.id,
    };
  }),
});
