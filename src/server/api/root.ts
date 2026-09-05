import { authRouter } from "./routers/auth";
import { submissionRouter } from "./routers/submission";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  submission: submissionRouter,
});

export type AppRouter = typeof appRouter;
