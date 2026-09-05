import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, postgresClient } from "@/server/db";
import { campaigns, submissions, users } from "@/server/db/schema";

import { updateCampaignSafely } from "./campaign-update";

const creatorId = randomUUID();
const campaignIds: string[] = [];

async function createCampaignWithCommittedPayout() {
  const campaignId = randomUUID();
  const postId = randomUUID();
  const now = new Date();
  campaignIds.push(campaignId);

  await db.insert(campaigns).values({
    id: campaignId,
    title: "Campaign update test",
    platforms: ["youtube"],
    payoutPer1kViews: 100,
    totalBudget: 1_000,
    status: "active",
    startsAt: new Date(now.getTime() - 60_000),
    endsAt: new Date(now.getTime() + 60_000),
  });
  await db.insert(submissions).values({
    campaignId,
    creatorId,
    postUrl: `https://www.youtube.com/shorts/${postId}`,
    normalizedPostUrl: `https://www.youtube.com/shorts/${postId}`,
    platform: "youtube",
    status: "approved",
    approvedPayoutCents: 800,
  });

  return { campaignId, now };
}

beforeAll(async () => {
  await db.insert(users).values({
    id: creatorId,
    email: `campaign-update-${creatorId}@example.com`,
    role: "creator",
  });
});

afterAll(async () => {
  for (const campaignId of campaignIds) {
    await db.delete(campaigns).where(eq(campaigns.id, campaignId));
  }
  await db.delete(users).where(eq(users.id, creatorId));
  await postgresClient.end();
});

describe("campaign updates", () => {
  it("does not allow the budget below committed payouts", async () => {
    const { campaignId, now } = await createCampaignWithCommittedPayout();

    await expect(
      updateCampaignSafely(db, campaignId, {
        title: "Campaign update test",
        platforms: ["youtube"],
        payoutPer1kViews: 100,
        totalBudget: 799,
        status: "active",
        startsAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 60_000),
      }),
    ).rejects.toMatchObject({ code: "CAMPAIGN_BUDGET_BELOW_COMMITTED" });

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });
    expect(campaign?.totalBudget).toBe(1_000);
  });

  it("keeps a fully committed campaign completed", async () => {
    const { campaignId, now } = await createCampaignWithCommittedPayout();

    const campaign = await updateCampaignSafely(db, campaignId, {
      title: "Campaign update test",
      platforms: ["youtube"],
      payoutPer1kViews: 100,
      totalBudget: 800,
      status: "active",
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 60_000),
    });

    expect(campaign?.status).toBe("completed");
    expect(campaign?.totalBudget).toBe(800);
  });
});
