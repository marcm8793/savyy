import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { transactionService } from "../services/transactionService";
import { schema } from "../schema";

// Define Zod schemas manually for transactions
const transactionSchema = z.object({
  id: z.number(),
  userId: z.string(),
  accountId: z.number(),
  amount: z.number(),
  date: z.date(),
  description: z.string().nullable(),
});

const createTransactionSchema = z.object({
  accountId: z.number(),
  amount: z.number(),
  date: z.date(),
  description: z.string().optional(),
});

const updateTransactionSchema = z.object({
  accountId: z.number().optional(),
  amount: z.number().optional(),
  date: z.date().optional(),
  description: z.string().optional(),
});

// Define transaction router with proper schema integration
export const transactionRouter = router({
  // Get transactions for a user
  getTransactions: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(), // Optional - can use authenticated user's ID
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .output(z.array(transactionSchema))
    .query(async ({ input, ctx }) => {
      // Use authenticated user's ID if not provided
      const userId = input.userId || ctx.user.id;
      return await transactionService.getTransactions(ctx.db, userId);
    }),

  // Get a single transaction by ID
  getTransaction: protectedProcedure
    .input(z.object({ id: z.number() }))
    .output(transactionSchema.nullable())
    .query(async ({ input, ctx }) => {
      return await transactionService.getTransactionById(
        ctx.db,
        input.id,
        ctx.user.id
      );
    }),

  // Create a new transaction
  createTransaction: protectedProcedure
    .input(createTransactionSchema)
    .output(transactionSchema)
    .mutation(async ({ input, ctx }) => {
      return await transactionService.createTransaction(ctx.db, {
        ...input,
        userId: ctx.user.id, // Use authenticated user's ID
      });
    }),

  // Update a transaction
  updateTransaction: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: updateTransactionSchema,
      })
    )
    .output(transactionSchema)
    .mutation(async ({ input, ctx }) => {
      return await transactionService.updateTransaction(
        ctx.db,
        input.id,
        input.data,
        ctx.user.id
      );
    }),

  // Delete a transaction
  deleteTransaction: protectedProcedure
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await transactionService.deleteTransaction(ctx.db, input.id, ctx.user.id);
      return { success: true, message: "Transaction deleted successfully" };
    }),
});
