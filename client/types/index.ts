import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../server/src/routers";

// Infer input and output types from the tRPC router
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Auth-related types (from server auth router)
export type SignInInput = RouterInputs["auth"]["signIn"];
export type SignUpInput = RouterInputs["auth"]["signUp"];
export type UpdateProfileInput = RouterInputs["auth"]["updateProfile"];

export type SessionOutput = RouterOutputs["auth"]["getSession"];
export type ProfileOutput = RouterOutputs["auth"]["getProfile"];

// Transaction-related types (from server transaction router)
export type GetTransactionsInput =
  RouterInputs["transaction"]["getTransactions"];
export type GetTransactionInput = RouterInputs["transaction"]["getTransaction"];
export type CreateTransactionInput =
  RouterInputs["transaction"]["createTransaction"];
export type UpdateTransactionInput =
  RouterInputs["transaction"]["updateTransaction"];
export type DeleteTransactionInput =
  RouterInputs["transaction"]["deleteTransaction"];

export type TransactionsOutput =
  RouterOutputs["transaction"]["getTransactions"];
export type TransactionOutput = RouterOutputs["transaction"]["getTransaction"];
export type CreateTransactionOutput =
  RouterOutputs["transaction"]["createTransaction"];
export type UpdateTransactionOutput =
  RouterOutputs["transaction"]["updateTransaction"];
export type DeleteTransactionOutput =
  RouterOutputs["transaction"]["deleteTransaction"];

// Account-related types (from server account router)
export type GetAccountsInput = RouterInputs["account"]["getAccounts"];
export type CreateAccountInput = RouterInputs["account"]["createAccount"];
export type GetTinkConnectionUrlInput =
  RouterInputs["account"]["getTinkConnectionUrl"];
export type GetTinkConnectionUrlSecureInput =
  RouterInputs["account"]["getTinkConnectionUrlSecure"];
export type SyncTinkAccountsInput = RouterInputs["account"]["syncTinkAccounts"];

export type AccountsOutput = RouterOutputs["account"]["getAccounts"];
export type CreateAccountOutput = RouterOutputs["account"]["createAccount"];
export type TinkConnectionUrlOutput =
  RouterOutputs["account"]["getTinkConnectionUrl"];
export type TinkConnectionUrlSecureOutput =
  RouterOutputs["account"]["getTinkConnectionUrlSecure"];
export type SyncTinkAccountsOutput =
  RouterOutputs["account"]["syncTinkAccounts"];

// Form types for client components (using tRPC input types)
export type SignInFormData = SignInInput;
export type SignUpFormData = SignUpInput;
