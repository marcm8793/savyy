import { router } from "../trpc";
import { authRouter } from "./authRouter";
import { transactionRouter } from "./transactionRouter";
import { accountRouter } from "./accountRouter";
import { providerConsentRouter } from "./providerConsentRouter";
import { tinkUserRouter } from "../routersv2/tinkUserRouter";

// Combine all routers using the centralized tRPC setup
export const appRouter = router({
  auth: authRouter,
  transaction: transactionRouter,
  account: accountRouter,
  providerConsent: providerConsentRouter,
  tinkUser: tinkUserRouter,
});

// Export type for frontend use
export type AppRouter = typeof appRouter;
