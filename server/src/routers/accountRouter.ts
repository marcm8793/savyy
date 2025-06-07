import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { accountService } from "../services/accountService";

// Define Zod schemas manually for bank accounts
const bankAccountSchema = z.object({
  id: z.number(),
  userId: z.string(),
  accountName: z.string(),
  bankId: z.string(),
});

const createBankAccountSchema = z.object({
  accountName: z.string().min(1).max(255),
  bankId: z.string().min(1).max(255),
});

// Define account router with proper schema integration
export const accountRouter = router({
  // Get bank accounts for authenticated user
  getAccounts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .output(z.array(bankAccountSchema))
    .query(async ({ input, ctx }) => {
      return await accountService.getAccounts(ctx.db, ctx.user.id);
    }),

  // Create a new bank account
  createAccount: protectedProcedure
    .input(createBankAccountSchema)
    .output(bankAccountSchema)
    .mutation(async ({ input, ctx }) => {
      return await accountService.createAccount(ctx.db, {
        ...input,
        userId: ctx.user.id,
      });
    }),
});
