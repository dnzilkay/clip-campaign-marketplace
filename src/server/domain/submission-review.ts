import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
} from "@/server/db/schema";

import { DomainError } from "./errors";
import { calculatePayoutCents } from "./payout";

export async function approveSubmission(
  database: Database,
  submissionId: string,
) {
  return database.transaction(async (transaction) => {
    const [submissionReference] = await transaction
      .select({ campaignId: submissions.campaignId })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!submissionReference) {
      throw new DomainError("SUBMISSION_NOT_FOUND", "Submission not found");
    }

    const [campaign] = await transaction
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, submissionReference.campaignId))
      .for("update")
      .limit(1);

    if (!campaign) {
      throw new DomainError("SUBMISSION_NOT_FOUND", "Submission not found");
    }

    const [submission] = await transaction
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.campaignId, campaign.id),
        ),
      )
      .for("update")
      .limit(1);

    if (!submission) {
      throw new DomainError("SUBMISSION_NOT_FOUND", "Submission not found");
    }

    if (submission.status !== "pending") {
      throw new DomainError(
        "SUBMISSION_NOT_PENDING",
        "Only pending submissions can be approved",
      );
    }

    const [latestMetric] = await transaction
      .select({ views: submissionMetrics.views })
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id))
      .orderBy(
        desc(submissionMetrics.capturedAt),
        desc(submissionMetrics.createdAt),
      )
      .limit(1);

    const payoutCents = calculatePayoutCents(
      latestMetric?.views ?? 0,
      campaign.payoutPer1kViews,
    );

    const [budget] = await transaction
      .select({
        spentCents: sql<number>`coalesce(sum(${submissions.approvedPayoutCents}), 0)::integer`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, campaign.id),
          inArray(submissions.status, ["approved", "paid"]),
        ),
      );

    const spentCents = Number(budget?.spentCents ?? 0);
    const nextSpentCents = spentCents + payoutCents;

    if (nextSpentCents > campaign.totalBudget) {
      throw new DomainError(
        "CAMPAIGN_BUDGET_EXCEEDED",
        "Approving this submission would exceed the campaign budget",
      );
    }

    if (campaign.status !== "active") {
      throw new DomainError(
        "CAMPAIGN_NOT_ACTIVE",
        "Only active campaigns can approve submissions",
      );
    }

    const reviewedAt = new Date();
    const [approvedSubmission] = await transaction
      .update(submissions)
      .set({
        status: "approved",
        approvedPayoutCents: payoutCents,
        rejectionReason: null,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(eq(submissions.id, submission.id))
      .returning();

    const remainingBudgetCents = campaign.totalBudget - nextSpentCents;

    if (remainingBudgetCents === 0) {
      await transaction
        .update(campaigns)
        .set({ status: "completed", updatedAt: reviewedAt })
        .where(eq(campaigns.id, campaign.id));
    }

    return {
      submission: approvedSubmission,
      payoutCents,
      remainingBudgetCents,
    };
  });
}

export async function rejectSubmission(
  database: Database,
  submissionId: string,
  rejectionReason: string,
) {
  return database.transaction(async (transaction) => {
    const [submission] = await transaction
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .for("update")
      .limit(1);

    if (!submission) {
      throw new DomainError("SUBMISSION_NOT_FOUND", "Submission not found");
    }

    if (submission.status !== "pending") {
      throw new DomainError(
        "SUBMISSION_NOT_PENDING",
        "Only pending submissions can be rejected",
      );
    }

    const reviewedAt = new Date();
    const [rejectedSubmission] = await transaction
      .update(submissions)
      .set({
        status: "rejected",
        rejectionReason,
        approvedPayoutCents: null,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(eq(submissions.id, submission.id))
      .returning();

    return rejectedSubmission;
  });
}
