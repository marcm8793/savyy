import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { transactionService } from "../services/transactionService";

// Initialize tRPC with context
const t = initTRPC.create();

// Define transaction router
export const transactionRouter = t.router({
  getTransactions: t.procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return await transactionService.getTransactions(input.userId);
    }),
});
