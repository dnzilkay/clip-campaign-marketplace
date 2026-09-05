import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env";
import {
  clearSessionCookie,
  createSessionCookie,
} from "@/server/auth/session";
import { users } from "@/server/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

function requireDevAuth() {
  if (!env.DEV_AUTH_ENABLED) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Development authentication is disabled",
    });
  }
}

export const authRouter = createTRPCRouter({
  session: publicProcedure.query(({ ctx }) => ({
    user: ctx.user,
    switcherEnabled: env.DEV_AUTH_ENABLED,
  })),

  availableUsers: publicProcedure.query(async ({ ctx }) => {
    requireDevAuth();

    return ctx.db.query.users.findMany({
      columns: { id: true, email: true, role: true },
      orderBy: (table, { asc }) => [asc(table.role), asc(table.email)],
    });
  }),

  switchUser: publicProcedure
    .input(z.object({ userId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireDevAuth();

      const user = await ctx.db.query.users.findFirst({
        columns: { id: true, email: true, role: true },
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      ctx.responseHeaders.append(
        "set-cookie",
        createSessionCookie(
          user.id,
          env.AUTH_COOKIE_SECRET,
          process.env.NODE_ENV === "production",
        ),
      );

      return user;
    }),

  signOut: publicProcedure.mutation(({ ctx }) => {
    ctx.responseHeaders.append(
      "set-cookie",
      clearSessionCookie(process.env.NODE_ENV === "production"),
    );

    return { success: true };
  }),
});
