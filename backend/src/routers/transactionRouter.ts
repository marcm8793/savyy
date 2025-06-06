import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { transactionService } from "../services/transactionService";

// Define transaction router
export const transactionRouter = router({
  getTransactions: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      // You can access ctx.user, ctx.req, ctx.res, ctx.db here
      return await transactionService.getTransactions(ctx.db, input.userId);
    }),
});
