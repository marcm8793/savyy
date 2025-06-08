// Re-export the main AppRouter type from server
export type { AppRouter } from "../../server/src/routers";

// Import tRPC utility types for type inference
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../server/src/routers";

// Import database types directly from server (single source of truth)
import type {
  User,
  UserInsert,
  Session,
  SessionInsert,
  Account,
  AccountInsert,
  Verification,
  VerificationInsert,
  BankAccount,
  BankAccountInsert,
  Transaction,
  TransactionInsert,
} from "../../server/src/types";
import { z } from "zod";

// Client-side validation schemas (for form validation)
export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

// Re-export database types for client use
export type {
  User,
  UserInsert,
  Session,
  SessionInsert,
  Account,
  AccountInsert,
  Verification,
  VerificationInsert,
  BankAccount,
  BankAccountInsert,
  Transaction,
  TransactionInsert,
};

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

export type AccountsOutput = RouterOutputs["account"]["getAccounts"];
export type CreateAccountOutput = RouterOutputs["account"]["createAccount"];

// Better Auth types (for client-side auth)
export interface AuthSession {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

// Form types for client components (using tRPC input types)
export type SignInFormData = SignInInput;
export type SignUpFormData = SignUpInput;
