import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  campaigns,
  submissionMetrics,
  submissions,
} from "@/server/db/schema";
import { calculatePayoutCents } from "@/server/domain/payout";
import { normalizePostUrl } from "@/server/domain/post-url";
import {
  approveSubmission,
  rejectSubmission,
} from "@/server/domain/submission-review";
import { createSubmissionSchema } from "@/shared/schemas/submission";

import { toTRPCError } from "../domain-error";
import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
} from "../trpc";

export const submissionRouter = createTRPCRouter({
  create: creatorProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, input.campaignId),
          eq(campaigns.status, "active"),
        ),
      });
      const now = new Date();

      if (
        !campaign ||
        campaign.startsAt > now ||
        campaign.endsAt < now
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active campaign not found",
        });
      }

      const parsedUrl = normalizePostUrl(input.postUrl);

      if (!parsedUrl || parsedUrl.platform !== input.platform) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter a valid post URL for the selected platform",
        });
      }

      if (!campaign.platforms.includes(input.platform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The selected platform is not enabled for this campaign",
        });
      }

      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          campaignId: campaign.id,
          creatorId: ctx.user.id,
          postUrl: input.postUrl,
          normalizedPostUrl: parsedUrl.normalizedUrl,
          platform: input.platform,
        })
        .onConflictDoNothing({
          target: [submissions.campaignId, submissions.normalizedPostUrl],
        })
        .returning();

      if (!submission) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This post URL has already been submitted to the campaign",
        });
      }

      return submission;
    }),

  listMine: creatorProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select({
        id: submissions.id,
        campaignId: submissions.campaignId,
        campaignTitle: campaigns.title,
        payoutPer1kViews: campaigns.payoutPer1kViews,
        postUrl: submissions.postUrl,
        platform: submissions.platform,
        status: submissions.status,
        rejectionReason: submissions.rejectionReason,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
      .where(eq(submissions.creatorId, ctx.user.id))
      .orderBy(desc(submissions.createdAt));
    const submissionIds = items.map((item) => item.id);
    const metrics =
      submissionIds.length === 0
        ? []
        : await ctx.db
            .select({
              submissionId: submissionMetrics.submissionId,
              views: submissionMetrics.views,
              capturedAt: submissionMetrics.capturedAt,
            })
            .from(submissionMetrics)
            .where(inArray(submissionMetrics.submissionId, submissionIds))
            .orderBy(
              desc(submissionMetrics.capturedAt),
              desc(submissionMetrics.createdAt),
            );
    const latestViews = new Map<string, number>();

    for (const metric of metrics) {
      if (!latestViews.has(metric.submissionId)) {
        latestViews.set(metric.submissionId, metric.views);
      }
    }

    return items.map((item) => {
      const currentViews = latestViews.get(item.id) ?? 0;
      const eligibleForEarnings = ["approved", "paid"].includes(item.status);

      return {
        ...item,
        currentViews,
        estimatedEarningsCents: eligibleForEarnings
          ? calculatePayoutCents(currentViews, item.payoutPer1kViews)
          : 0,
      };
    });
  }),

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
