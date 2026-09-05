import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";

import type { SessionUser, TRPCContext } from "@/server/api/context";
import { appRouter } from "@/server/api/root";
import { db, postgresClient } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "@/server/db/schema";

import { approveSubmission, rejectSubmission } from "./submission-review";

const creator: SessionUser = {
  id: randomUUID(),
  email: `review-creator-${randomUUID()}@example.com`,
  role: "creator",
};

const admin: SessionUser = {
  id: randomUUID(),
  email: `review-admin-${randomUUID()}@example.com`,
  role: "admin",
};

const campaignIds: string[] = [];

function adminContext(): TRPCContext {
  return {
    db,
    user: admin,
    responseHeaders: new Headers(),
  };
}

async function createScenario({
  budgetCents,
  payoutPer1kViews,
  views,
  status = "active",
}: {
  budgetCents: number;
  payoutPer1kViews: number;
  views: number[];
  status?: "active" | "paused";
}) {
  const campaignId = randomUUID();
  const now = new Date();
  campaignIds.push(campaignId);

  await db.insert(campaigns).values({
    id: campaignId,
    title: `Review test ${campaignId}`,
    platforms: ["youtube"],
    payoutPer1kViews,
    totalBudget: budgetCents,
    status,
    startsAt: new Date(now.getTime() - 60_000),
    endsAt: new Date(now.getTime() + 60_000),
  });

  const submissionIds = views.map(() => randomUUID());

  await db.insert(submissions).values(
    submissionIds.map((id, index) => ({
      id,
      campaignId,
      creatorId: creator.id,
      postUrl: `https://www.youtube.com/shorts/${id}`,
      normalizedPostUrl: `https://www.youtube.com/shorts/${id}`,
      platform: "youtube" as const,
      status: "pending" as const,
      createdAt: new Date(now.getTime() + index),
    })),
  );

  await db.insert(submissionMetrics).values(
    submissionIds.map((submissionId, index) => ({
      submissionId,
      capturedAt: now.toISOString().slice(0, 10),
      views: views[index] ?? 0,
      likes: 0,
      comments: 0,
    })),
  );

  return { campaignId, submissionIds };
}

beforeAll(async () => {
  await db.insert(users).values([creator, admin]);
});

afterEach(async () => {
  if (campaignIds.length > 0) {
    await db.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    campaignIds.length = 0;
  }
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [creator.id, admin.id]));
  await postgresClient.end();
});

describe("submission approval", () => {
  it("reserves payout from the most recent metric", async () => {
    const { campaignId, submissionIds } = await createScenario({
      budgetCents: 1_000,
      payoutPer1kViews: 400,
      views: [2_999],
    });

    const result = await approveSubmission(db, submissionIds[0]!);

    expect(result.payoutCents).toBe(800);
    expect(result.remainingBudgetCents).toBe(200);
    expect(result.submission?.status).toBe("approved");

    const storedSubmission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionIds[0]!),
    });
    const storedCampaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });

    expect(storedSubmission?.approvedPayoutCents).toBe(800);
    expect(storedCampaign?.status).toBe("active");
  });

  it("keeps the submission pending when approval exceeds the budget", async () => {
    const { submissionIds } = await createScenario({
      budgetCents: 700,
      payoutPer1kViews: 400,
      views: [2_000],
    });

    await expect(
      approveSubmission(db, submissionIds[0]!),
    ).rejects.toMatchObject({ code: "CAMPAIGN_BUDGET_EXCEEDED" });

    const storedSubmission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionIds[0]!),
    });

    expect(storedSubmission?.status).toBe("pending");
    expect(storedSubmission?.approvedPayoutCents).toBeNull();
  });

  it("allows only one concurrent approval when the budget covers one", async () => {
    const { campaignId, submissionIds } = await createScenario({
      budgetCents: 1_000,
      payoutPer1kViews: 1_000,
      views: [1_000, 1_000],
    });

    const results = await Promise.allSettled(
      submissionIds.map((submissionId) =>
        approveSubmission(db, submissionId),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );

    const rejectedResult = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejectedResult?.reason).toMatchObject({
      code: "CAMPAIGN_BUDGET_EXCEEDED",
    });

    const storedCampaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });
    const storedSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.campaignId, campaignId),
    });
    const [budget] = await db
      .select({
        spentCents: sql<number>`coalesce(sum(${submissions.approvedPayoutCents}), 0)::integer`,
      })
      .from(submissions)
      .where(eq(submissions.campaignId, campaignId));

    expect(storedCampaign?.status).toBe("completed");
    expect(
      storedSubmissions.filter((submission) => submission.status === "approved"),
    ).toHaveLength(1);
    expect(storedSubmissions.filter((submission) => submission.status === "pending"))
      .toHaveLength(1);
    expect(Number(budget?.spentCents)).toBe(1_000);
  });

  it("returns a typed tRPC error the UI can act on", async () => {
    const { submissionIds } = await createScenario({
      budgetCents: 500,
      payoutPer1kViews: 1_000,
      views: [1_000],
    });
    const caller = appRouter.createCaller(adminContext());

    await expect(
      caller.submission.approve({ submissionId: submissionIds[0]! }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      cause: { code: "CAMPAIGN_BUDGET_EXCEEDED" },
    });
  });
});

describe("submission rejection", () => {
  it("stores the required rejection reason", async () => {
    const { submissionIds } = await createScenario({
      budgetCents: 1_000,
      payoutPer1kViews: 100,
      views: [0],
    });

    const result = await rejectSubmission(
      db,
      submissionIds[0]!,
      "The post is not publicly accessible.",
    );

    expect(result?.status).toBe("rejected");
    expect(result?.rejectionReason).toBe(
      "The post is not publicly accessible.",
    );
  });
});
