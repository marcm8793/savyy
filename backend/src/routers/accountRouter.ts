import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { accountService } from "../services/accountService";

// Initialize tRPC with context
const t = initTRPC.create();

// Define account router
export const accountRouter = t.router({
  getAccounts: t.procedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return await accountService.getAccounts(input.userId);
    }),
});
