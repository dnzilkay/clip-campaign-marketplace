import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

import { db, postgresClient } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
  users,
} from "@/server/db/schema";

import { ingestDailyMetrics, type MetricSource } from "./metrics-ingestion";

const creatorId = randomUUID();
const campaignIds: string[] = [];
const cleanupDates: string[] = [];

async function createApprovedSubmissions(previousViews: Array<number | null>) {
  const campaignId = randomUUID();
  const now = new Date();
  campaignIds.push(campaignId);

  await db.insert(campaigns).values({
    id: campaignId,
    title: `Ingestion test ${campaignId}`,
    platforms: ["tiktok"],
    payoutPer1kViews: 100,
    totalBudget: 10_000,
    status: "active",
    startsAt: new Date(now.getTime() - 60_000),
    endsAt: new Date(now.getTime() + 60_000),
  });

  const submissionIds = previousViews.map(() => randomUUID());

  await db.insert(submissions).values(
    submissionIds.map((id) => ({
      id,
      campaignId,
      creatorId,
      postUrl: `https://www.tiktok.com/@creator/video/${id}`,
      normalizedPostUrl: `https://www.tiktok.com/@creator/video/${id}`,
      platform: "tiktok" as const,
      status: "approved" as const,
      approvedPayoutCents: 0,
      reviewedAt: now,
    })),
  );

  const previousMetrics = previousViews.flatMap((views, index) =>
    views === null
      ? []
      : [
          {
            submissionId: submissionIds[index]!,
            capturedAt: "2098-12-31",
            views,
            likes: 10,
            comments: 1,
          },
        ],
  );

  if (previousMetrics.length > 0) {
    await db.insert(submissionMetrics).values(previousMetrics);
  }

  return submissionIds;
}

beforeAll(async () => {
  await db.insert(users).values({
    id: creatorId,
    email: `ingestion-${creatorId}@example.com`,
    role: "creator",
  });
});

afterEach(async () => {
  if (cleanupDates.length > 0) {
    await db
      .delete(submissionMetrics)
      .where(inArray(submissionMetrics.capturedAt, cleanupDates));
    cleanupDates.length = 0;
  }

  if (campaignIds.length > 0) {
    await db.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    campaignIds.length = 0;
  }
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, creatorId));
  await postgresClient.end();
});

describe("daily metric ingestion", () => {
  it("leaves the first snapshot unchanged when rerun for the same day", async () => {
    const capturedAt = "2099-01-01";
    cleanupDates.push(capturedAt);
    const [submissionId] = await createApprovedSubmissions([1_000]);
    let sourceCalls = 0;
    const source: MetricSource = async ({ previousMetric }) => {
      sourceCalls += 1;
      return {
        views: (previousMetric?.views ?? 0) + 500,
        likes: (previousMetric?.likes ?? 0) + 20,
        comments: (previousMetric?.comments ?? 0) + 2,
      };
    };

    const firstRun = await ingestDailyMetrics({
      database: db,
      capturedAt,
      source,
    });
    const callsAfterFirstRun = sourceCalls;
    const secondRun = await ingestDailyMetrics({
      database: db,
      capturedAt,
      source,
    });

    const firstResult = firstRun.results.find(
      (result) => result.submissionId === submissionId,
    );
    const secondResult = secondRun.results.find(
      (result) => result.submissionId === submissionId,
    );
    const storedMetric = await db.query.submissionMetrics.findFirst({
      where: and(
        eq(submissionMetrics.submissionId, submissionId!),
        eq(submissionMetrics.capturedAt, capturedAt),
      ),
    });

    expect(firstResult).toMatchObject({ status: "created", views: 1_500 });
    expect(secondResult).toMatchObject({
      status: "skipped",
      reason: "already_ingested",
    });
    expect(sourceCalls).toBe(callsAfterFirstRun);
    expect(storedMetric?.views).toBe(1_500);
  });

  it("reports and refuses a snapshot whose views decreased", async () => {
    const capturedAt = "2099-01-02";
    cleanupDates.push(capturedAt);
    const [submissionId] = await createApprovedSubmissions([2_000]);
    const source: MetricSource = async ({ submission, previousMetric }) => {
      if (submission.id === submissionId) {
        return { views: 1_999, likes: 10, comments: 1 };
      }

      return {
        views: (previousMetric?.views ?? 0) + 1,
        likes: previousMetric?.likes ?? 0,
        comments: previousMetric?.comments ?? 0,
      };
    };

    const report = await ingestDailyMetrics({ database: db, capturedAt, source });
    const result = report.results.find(
      (item) => item.submissionId === submissionId,
    );
    const storedMetric = await db.query.submissionMetrics.findFirst({
      where: and(
        eq(submissionMetrics.submissionId, submissionId!),
        eq(submissionMetrics.capturedAt, capturedAt),
      ),
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "views cannot decrease from 2000 to 1999",
    });
    expect(storedMetric).toBeUndefined();
  });

  it("continues with other submissions after one source failure", async () => {
    const capturedAt = "2099-01-03";
    cleanupDates.push(capturedAt);
    const [failingId, successfulId] = await createApprovedSubmissions([
      null,
      null,
    ]);
    const source: MetricSource = async ({ submission, previousMetric }) => {
      if (submission.id === failingId) {
        throw new Error("provider unavailable");
      }

      return {
        views: (previousMetric?.views ?? 0) + 500,
        likes: previousMetric?.likes ?? 0,
        comments: previousMetric?.comments ?? 0,
      };
    };

    const report = await ingestDailyMetrics({ database: db, capturedAt, source });
    const failedResult = report.results.find(
      (result) => result.submissionId === failingId,
    );
    const successfulResult = report.results.find(
      (result) => result.submissionId === successfulId,
    );
    const successfulMetric = await db.query.submissionMetrics.findFirst({
      where: and(
        eq(submissionMetrics.submissionId, successfulId!),
        eq(submissionMetrics.capturedAt, capturedAt),
      ),
    });

    expect(failedResult).toMatchObject({
      status: "failed",
      error: "provider unavailable",
    });
    expect(successfulResult).toMatchObject({
      status: "created",
      views: 500,
    });
    expect(successfulMetric?.views).toBe(500);
  });
});
