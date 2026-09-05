import { asc, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "@/server/db/schema";

import { calculatePayoutCents } from "./payout";

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getCampaignAdminDetail(
  database: Database,
  campaignId: string,
) {
  const campaign = await database.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    return null;
  }

  const campaignSubmissions = await database
    .select({
      id: submissions.id,
      creatorId: submissions.creatorId,
      creatorEmail: users.email,
      postUrl: submissions.postUrl,
      platform: submissions.platform,
      status: submissions.status,
      rejectionReason: submissions.rejectionReason,
      approvedPayoutCents: submissions.approvedPayoutCents,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.creatorId))
    .where(eq(submissions.campaignId, campaign.id))
    .orderBy(desc(submissions.createdAt));

  const submissionIds = campaignSubmissions.map((submission) => submission.id);
  const metrics =
    submissionIds.length === 0
      ? []
      : await database
          .select({
            submissionId: submissionMetrics.submissionId,
            capturedAt: submissionMetrics.capturedAt,
            views: submissionMetrics.views,
          })
          .from(submissionMetrics)
          .where(
            inArray(submissionMetrics.submissionId, submissionIds),
          )
          .orderBy(
            asc(submissionMetrics.submissionId),
            asc(submissionMetrics.capturedAt),
          );

  const latestViews = new Map<string, number>();
  const dailyViews = new Map<string, number>();
  const approvedIds = new Set(
    campaignSubmissions
      .filter((submission) =>
        ["approved", "paid"].includes(submission.status),
      )
      .map((submission) => submission.id),
  );
  const previousViews = new Map<string, number>();
  const startsOn = utcDate(campaign.startsAt);
  const endsOn = utcDate(campaign.endsAt);

  for (const metric of metrics) {
    latestViews.set(metric.submissionId, metric.views);

    if (!approvedIds.has(metric.submissionId)) {
      continue;
    }

    const previous = previousViews.get(metric.submissionId) ?? 0;
    const gained = Math.max(0, metric.views - previous);
    previousViews.set(metric.submissionId, metric.views);

    if (metric.capturedAt >= startsOn && metric.capturedAt <= endsOn) {
      dailyViews.set(
        metric.capturedAt,
        (dailyViews.get(metric.capturedAt) ?? 0) + gained,
      );
    }
  }

  const chart: Array<{ date: string; views: number }> = [];
  const cursor = new Date(`${startsOn}T00:00:00.000Z`);
  const end = new Date(`${endsOn}T00:00:00.000Z`);

  while (cursor <= end) {
    const date = utcDate(cursor);
    chart.push({ date, views: dailyViews.get(date) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const totalApprovedViews = [...approvedIds].reduce(
    (total, submissionId) => total + (latestViews.get(submissionId) ?? 0),
    0,
  );
  const budgetSpent = campaignSubmissions.reduce(
    (total, submission) =>
      total + (submission.approvedPayoutCents ?? 0),
    0,
  );

  return {
    campaign,
    overview: {
      totalApprovedViews,
      budgetSpent,
      budgetLeft: Math.max(0, campaign.totalBudget - budgetSpent),
      chart,
    },
    reviewQueue: campaignSubmissions
      .filter((submission) => submission.status === "pending")
      .map((submission) => ({
        ...submission,
        currentViews: latestViews.get(submission.id) ?? 0,
        estimatedPayoutCents: calculatePayoutCents(
          latestViews.get(submission.id) ?? 0,
          campaign.payoutPer1kViews,
        ),
      })),
  };
}
