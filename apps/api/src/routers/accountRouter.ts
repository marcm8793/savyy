import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { accountService } from "../services/accountService";
import { tinkService } from "../services/tinkService";

// Define Zod schemas manually for bank accounts (updated to match database schema)
const bankAccountSchema = z.object({
  id: z.number(),
  userId: z.string(),
  tinkAccountId: z.string(),
  accountName: z.string(),
  accountType: z.string().nullable(),
  financialInstitutionId: z.string().nullable(),
  balance: z
    .string()
    .nullable()
    .transform((val) => (val ? parseFloat(val) : null)),
  currency: z.string().nullable(),
  iban: z.string().nullable(),
  lastRefreshed: z.date().nullable(),
  accessToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  tokenScope: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const createBankAccountSchema = z.object({
  accountName: z.string().min(1).max(255),
  tinkAccountId: z.string().min(1).max(255),
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
      const accounts = await accountService.getAccounts(ctx.db, ctx.user.id);
      console.log(
        "getAccounts called for user:",
        ctx.user.id,
        "found:",
        accounts.length,
        "accounts"
      );
      console.log("Accounts data:", accounts);
      return accounts;
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

  // Get Tink connection URL
  getTinkConnectionUrl: protectedProcedure
    .input(
      z.object({
        market: z.string().default("FR"),
        locale: z.string().default("en_US"),
      })
    )
    .output(
      z.object({
        url: z.string(),
        message: z.string(),
      })
    )
    .query(async ({ input }) => {
      const connectionUrl = tinkService.getTinkConnectionUrl(
        input.market,
        input.locale
      );
      return {
        url: connectionUrl,
        message: "Redirect user to this URL to connect their bank account",
      };
    }),

  // Get secure Tink connection URL with state parameter
  getTinkConnectionUrlSecure: protectedProcedure
    .input(
      z.object({
        market: z.string().default("FR"),
        locale: z.string().default("en_US"),
      })
    )
    .output(
      z.object({
        url: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Generate state parameter with user ID for security
      const state = tinkService.generateStateToken(ctx.user.id);

      const connectionUrl = tinkService.getTinkConnectionUrlWithState(
        input.market,
        input.locale,
        state
      );
      return {
        url: connectionUrl,
        message: "Redirect user to this URL to connect their bank account",
      };
    }),

  // Sync accounts from Tink
  syncTinkAccounts: protectedProcedure
    .input(
      z.object({
        code: z.string(),
      })
    )
    .output(
      z.object({
        message: z.string(),
        accounts: z.array(bankAccountSchema),
        count: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Sync user accounts using the consolidated method
      const syncResult = await tinkService.syncUserAccounts(
        ctx.db,
        ctx.user.id,
        input.code
      );

      return {
        message: "Accounts synchronized successfully",
        accounts: syncResult.accounts,
        count: syncResult.count,
      };
    }),
});
