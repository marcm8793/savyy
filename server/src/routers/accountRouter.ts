import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { accountService } from "../services/accountService";

// Define account router
export const accountRouter = router({
  getAccounts: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Use the database from context
      return await accountService.getAccounts(ctx.db, Number(input.userId));
    }),
});
