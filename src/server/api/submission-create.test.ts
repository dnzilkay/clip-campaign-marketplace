import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, postgresClient } from "@/server/db";
import { campaigns, submissions, users } from "@/server/db/schema";

import type { SessionUser } from "./context";
import { appRouter } from "./root";

const creators: SessionUser[] = [1, 2].map(() => {
  const id = randomUUID();
  return { id, email: `submission-test-${id}@example.com`, role: "creator" };
});
const campaignIds: string[] = [];
const originalUrl = "https://www.youtube.com/shorts/dQw4w9WgXcQ/?feature=share#clip";
const equivalentUrl = "https://youtube.com/shorts/dQw4w9WgXcQ";

function callerFor(creator: SessionUser) {
  return appRouter.createCaller({ db, user: creator, responseHeaders: new Headers() });
}

async function createCampaign() {
  const id = randomUUID();
  campaignIds.push(id);
  const now = Date.now();
  await db.insert(campaigns).values({
    id,
    title: "Submission test",
    platforms: ["youtube"],
    payoutPer1kViews: 100,
    totalBudget: 10_000,
    status: "active",
    startsAt: new Date(now - 86_400_000),
    endsAt: new Date(now + 86_400_000),
  });
  return id;
}

beforeAll(async () => {
  await db.insert(users).values(creators);
});

afterEach(async () => {
  if (campaignIds.length) {
    await db.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    campaignIds.length = 0;
  }
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, creators.map((creator) => creator.id)));
  await postgresClient.end();
});

describe("submission URL uniqueness through tRPC", () => {
  it("rejects an equivalent URL from another creator with a useful conflict error", async () => {
    const campaignId = await createCampaign();
    const first = await callerFor(creators[0]!).submission.create({
      campaignId, postUrl: originalUrl, platform: "youtube",
    });
    expect(first?.normalizedPostUrl).toBe(equivalentUrl);

    await expect(callerFor(creators[1]!).submission.create({
      campaignId, postUrl: equivalentUrl, platform: "youtube",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This post URL has already been submitted to the campaign",
    });

    const stored = await db.select().from(submissions).where(eq(submissions.campaignId, campaignId));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.creatorId).toBe(creators[0]!.id);
  });

  it("allows the same post in different campaigns", async () => {
    const firstCampaign = await createCampaign();
    const secondCampaign = await createCampaign();
    const caller = callerFor(creators[0]!);
    const first = await caller.submission.create({
      campaignId: firstCampaign, postUrl: originalUrl, platform: "youtube",
    });
    const second = await caller.submission.create({
      campaignId: secondCampaign, postUrl: equivalentUrl, platform: "youtube",
    });
    expect(first?.id).toBeDefined();
    expect(second?.id).toBeDefined();
    expect(first?.id).not.toBe(second?.id);
  });

  it("stores only one submission when equivalent URLs arrive concurrently", async () => {
    const campaignId = await createCampaign();
    const results = await Promise.allSettled([
      callerFor(creators[0]!).submission.create({
        campaignId, postUrl: originalUrl, platform: "youtube",
      }),
      callerFor(creators[1]!).submission.create({
        campaignId, postUrl: equivalentUrl, platform: "youtube",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected");
    expect(failure?.reason).toMatchObject({ code: "CONFLICT" });
    const stored = await db.select().from(submissions).where(eq(submissions.campaignId, campaignId));
    expect(stored).toHaveLength(1);
  });
});
