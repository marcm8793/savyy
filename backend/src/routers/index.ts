import { initTRPC } from "@trpc/server";
import { authRouter } from "./authRouter";
import { transactionRouter } from "./transactionRouter";
import { accountRouter } from "./accountRouter";

// Initialize tRPC
const t = initTRPC.create();

// Combine all routers
export const appRouter = t.router({
  auth: authRouter,
  transaction: transactionRouter,
  account: accountRouter,
});

// Export type for frontend use
export type AppRouter = typeof appRouter;
