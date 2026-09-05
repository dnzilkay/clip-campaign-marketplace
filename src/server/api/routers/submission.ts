import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { submissions } from "@/server/db/schema";
import {
  approveSubmission,
  rejectSubmission,
} from "@/server/domain/submission-review";

import { toTRPCError } from "../domain-error";
import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
} from "../trpc";

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

  approve: adminProcedure
    .input(z.object({ submissionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveSubmission(ctx.db, input.submissionId);
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  reject: adminProcedure
    .input(
      z.object({
        submissionId: z.uuid(),
        rejectionReason: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await rejectSubmission(
          ctx.db,
          input.submissionId,
          input.rejectionReason,
        );
      } catch (error) {
        throw toTRPCError(error);
      }
    }),
});
