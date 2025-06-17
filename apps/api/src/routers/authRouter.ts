import { z } from "zod/v4";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { userService } from "../services/userService";
import { createDatabase } from "../../db/db";

// Auth schemas - these should match the user table constraints
// email: text().notNull().unique() -> string with email validation
// name: text().notNull() -> string with minimum length
// password: not in user table, stored in account table -> string with minimum length
export const signInSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

// * Define authentication router
export const authRouter = router({
  // * Sign in procedure - handles authentication through Better Auth
  signIn: publicProcedure
    .input(signInSchema)
    .mutation(async ({ input, ctx: _ctx }) => {
      // This procedure validates the input but doesn't handle the actual authentication
      // The actual authentication is handled by Better Auth through the auth client
      // This is mainly for schema validation and can be used for additional logic

      return {
        message: "Sign in request validated",
        email: input.email,
        // Don't return the password for security
      };
    }),

  // * Sign up procedure - similar to sign in, for validation and consistency
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ input, ctx: _ctx }) => {
      // This procedure validates the input but doesn't handle the actual registration
      // The actual registration is handled by Better Auth through the auth client

      return {
        message: "Sign up request validated",
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        // Don't return the password for security
      };
    }),

  // * Get current session - public procedure that returns user if authenticated
  getSession: publicProcedure.query(async ({ ctx }) => {
    return {
      user: ctx.user,
      session: ctx.session,
      isAuthenticated: !!ctx.user,
    };
  }),

  // * Get user profile - protected procedure (requires authentication)
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

  // * Update user profile - protected procedure
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = createDatabase();

      try {
        const updatedUser = await userService.updateUserProfile(
          db,
          ctx.user.id,
          input
        );

        return {
          message: "Profile updated successfully",
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
          },
        };
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to update profile"
        );
      }
    }),

  // * Delete account - protected procedure
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // Here you would delete the user account
    // ctx.user is guaranteed to be non-null

    return {
      message: "Account deletion initiated",
      userId: ctx.user.id,
    };
  }),
});
