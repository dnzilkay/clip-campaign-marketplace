import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, postgresClient } from "@/server/db";
import { campaigns, submissionMetrics, submissions, users } from "@/server/db/schema";

import { getCampaignAdminDetail } from "./campaign-overview";

const creatorId = randomUUID();
const campaignIds: string[] = [];

async function createCampaign() {
  const id = randomUUID();
  campaignIds.push(id);
  await db.insert(campaigns).values({
    id,
    title: "Overview test",
    platforms: ["youtube"],
    payoutPer1kViews: 100,
    totalBudget: 10_000,
    status: "active",
    startsAt: new Date("2025-02-01T12:00:00Z"),
    endsAt: new Date("2025-02-05T12:00:00Z"),
  });
  return id;
}

beforeAll(async () => {
  await db.insert(users).values({
    id: creatorId,
    email: `overview-${creatorId}@example.com`,
    role: "creator",
  });
});

afterEach(async () => {
  if (campaignIds.length) {
    await db.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    campaignIds.length = 0;
  }
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, creatorId));
  await postgresClient.end();
});

describe("campaign daily views", () => {
  it("includes every campaign day, even when there are no submissions", async () => {
    const campaignId = await createCampaign();
    const detail = await getCampaignAdminDetail(db, campaignId);

    expect(detail?.overview.chart).toEqual([
      { date: "2025-02-01", views: 0 },
      { date: "2025-02-02", views: 0 },
      { date: "2025-02-03", views: 0 },
      { date: "2025-02-04", views: 0 },
      { date: "2025-02-05", views: 0 },
    ]);
  });

  it("sums approved daily gains, fills gaps, and excludes metrics outside the period", async () => {
    const campaignId = await createCampaign();
    const approvedId = randomUUID();
    const paidId = randomUUID();
    const pendingId = randomUUID();
    const rejectedId = randomUUID();
    await db.insert(submissions).values(
      ([
        [approvedId, "approved"],
        [paidId, "paid"],
        [pendingId, "pending"],
        [rejectedId, "rejected"],
      ] as const).map(([id, status]) => ({
        id,
        campaignId,
        creatorId,
        postUrl: `https://youtube.com/shorts/${id}`,
        normalizedPostUrl: `https://youtube.com/shorts/${id}`,
        platform: "youtube" as const,
        status,
        approvedPayoutCents: status === "approved" || status === "paid" ? 100 : null,
        rejectionReason: status === "rejected" ? "Not eligible" : null,
      })),
    );
    await db.insert(submissionMetrics).values(
      [
        { submissionId: approvedId, capturedAt: "2025-01-31", views: 1_000 },
        { submissionId: approvedId, capturedAt: "2025-02-02", views: 1_500 },
        { submissionId: approvedId, capturedAt: "2025-02-04", views: 2_200 },
        { submissionId: approvedId, capturedAt: "2025-02-06", views: 3_000 },
        { submissionId: paidId, capturedAt: "2025-02-02", views: 300 },
        { submissionId: paidId, capturedAt: "2025-02-05", views: 400 },
        { submissionId: pendingId, capturedAt: "2025-02-03", views: 9_000 },
        { submissionId: rejectedId, capturedAt: "2025-02-03", views: 8_000 },
      ].map((metric) => ({ ...metric, likes: 0, comments: 0 })),
    );

    const detail = await getCampaignAdminDetail(db, campaignId);

    expect(detail?.overview.chart).toEqual([
      { date: "2025-02-01", views: 0 },
      { date: "2025-02-02", views: 800 },
      { date: "2025-02-03", views: 0 },
      { date: "2025-02-04", views: 700 },
      { date: "2025-02-05", views: 100 },
    ]);
  });
});
