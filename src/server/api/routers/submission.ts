import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { submissions } from "@/server/db/schema";

import { createTRPCRouter, creatorProcedure } from "../trpc";

export const submissionRouter = createTRPCRouter({
  getMineById: creatorProcedure
    .input(z.object({ submissionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: and(
          eq(submissions.id, input.submissionId),
          eq(submissions.creatorId, ctx.user.id),
        ),
      });

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return submission;
    }),
});
