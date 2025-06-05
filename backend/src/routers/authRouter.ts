import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { authService } from "../services/authService";

// Initialize tRPC with context
const t = initTRPC.create();

// Define authentication router
export const authRouter = t.router({
  register: t.procedure
    .input(z.object({ email: z.string().email(), password: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const user = await authService.register(input.email, input.password);
      return { user };
    }),
  login: t.procedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const { user, token } = await authService.login(
        input.email,
        input.password
      );
      return { user, token };
    }),
});
