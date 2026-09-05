import "dotenv/config";

import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "../src/server/db/schema";
import { db, postgresClient } from "../src/server/db";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  creatorOne: "00000000-0000-4000-8000-000000000002",
  creatorTwo: "00000000-0000-4000-8000-000000000003",
  activeCampaign: "10000000-0000-4000-8000-000000000001",
  draftCampaign: "10000000-0000-4000-8000-000000000002",
  approvedSubmission: "20000000-0000-4000-8000-000000000001",
  pendingSubmission: "20000000-0000-4000-8000-000000000002",
  rejectedSubmission: "20000000-0000-4000-8000-000000000003",
} as const;

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function offsetDate(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function toUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function seed() {
  const now = new Date();
  const today = toUtcDate(now);

  await db
    .insert(users)
    .values([
      { id: ids.admin, email: "admin@example.com", role: "admin" },
      {
        id: ids.creatorOne,
        email: "creator.one@example.com",
        role: "creator",
      },
      {
        id: ids.creatorTwo,
        email: "creator.two@example.com",
        role: "creator",
      },
    ])
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(campaigns)
    .values([
      {
        id: ids.activeCampaign,
        title: "Short-form Launch Campaign",
        platforms: ["tiktok", "instagram", "youtube"],
        payoutPer1kViews: 250,
        totalBudget: 50_000,
        status: "active",
        startsAt: offsetDate(now, -7),
        endsAt: offsetDate(now, 21),
      },
      {
        id: ids.draftCampaign,
        title: "Product Education Clips",
        platforms: ["youtube", "instagram"],
        payoutPer1kViews: 400,
        totalBudget: 75_000,
        status: "draft",
        startsAt: offsetDate(now, 14),
        endsAt: offsetDate(now, 44),
      },
    ])
    .onConflictDoNothing({ target: campaigns.id });

  await db
    .insert(submissions)
    .values([
      {
        id: ids.approvedSubmission,
        campaignId: ids.activeCampaign,
        creatorId: ids.creatorOne,
        postUrl: "https://www.tiktok.com/@creator/video/7412345678901234567",
        normalizedPostUrl:
          "https://www.tiktok.com/@creator/video/7412345678901234567",
        platform: "tiktok",
        status: "approved",
        approvedPayoutCents: 2_000,
        reviewedAt: offsetDate(now, -1),
      },
      {
        id: ids.pendingSubmission,
        campaignId: ids.activeCampaign,
        creatorId: ids.creatorTwo,
        postUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        normalizedPostUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        platform: "youtube",
        status: "pending",
      },
      {
        id: ids.rejectedSubmission,
        campaignId: ids.activeCampaign,
        creatorId: ids.creatorOne,
        postUrl: "https://www.instagram.com/reel/C9Example123/",
        normalizedPostUrl: "https://www.instagram.com/reel/C9Example123",
        platform: "instagram",
        status: "rejected",
        rejectionReason: "The post is not publicly accessible.",
        reviewedAt: offsetDate(now, -2),
      },
    ])
    .onConflictDoNothing({ target: submissions.id });

  await db
    .insert(submissionMetrics)
    .values([
      {
        submissionId: ids.approvedSubmission,
        capturedAt: toUtcDate(offsetDate(now, -1)),
        views: 7_800,
        likes: 620,
        comments: 41,
      },
      {
        submissionId: ids.approvedSubmission,
        capturedAt: today,
        views: 8_420,
        likes: 671,
        comments: 48,
      },
      {
        submissionId: ids.pendingSubmission,
        capturedAt: today,
        views: 15_250,
        likes: 1_140,
        comments: 93,
      },
    ])
    .onConflictDoNothing({
      target: [submissionMetrics.submissionId, submissionMetrics.capturedAt],
    });

  console.info("Seed completed", {
    users: 3,
    campaigns: 2,
    submissions: 3,
    metrics: 3,
  });
}

seed()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgresClient.end();
  });
