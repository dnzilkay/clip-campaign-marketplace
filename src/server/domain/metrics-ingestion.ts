import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import type { Database } from "@/server/db";
import { submissionMetrics, submissions } from "@/server/db/schema";

type ApprovedSubmission = Pick<
  typeof submissions.$inferSelect,
  "id" | "campaignId" | "creatorId" | "platform" | "postUrl"
>;

type MetricSnapshot = {
  views: number;
  likes: number;
  comments: number;
};

export type MetricSource = (input: {
  submission: ApprovedSubmission;
  previousMetric: MetricSnapshot | null;
  capturedAt: string;
}) => Promise<MetricSnapshot>;

export type IngestionItemResult =
  | {
      status: "created";
      submissionId: string;
      capturedAt: string;
      views: number;
    }
  | {
      status: "skipped";
      submissionId: string;
      capturedAt: string;
      reason: "already_ingested";
    }
  | {
      status: "failed";
      submissionId: string;
      capturedAt: string;
      error: string;
    };

function validateMetric(snapshot: MetricSnapshot, previousViews: number) {
  for (const [field, value] of Object.entries(snapshot)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${field} must be a non-negative safe integer`);
    }
  }

  if (snapshot.views < previousViews) {
    throw new RangeError(
      `views cannot decrease from ${previousViews} to ${snapshot.views}`,
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const fakeMetricSource: MetricSource = async ({
  submission,
  previousMetric,
  capturedAt,
}) => {
  const digest = createHash("sha256")
    .update(`${submission.id}:${capturedAt}`)
    .digest();
  const viewGrowth = 500 + (digest.readUInt16BE(0) % 4_501);
  const likeGrowth = Math.floor(viewGrowth * 0.08);
  const commentGrowth = Math.max(1, Math.floor(viewGrowth * 0.004));

  return {
    views: (previousMetric?.views ?? 0) + viewGrowth,
    likes: (previousMetric?.likes ?? 0) + likeGrowth,
    comments: (previousMetric?.comments ?? 0) + commentGrowth,
  };
};

async function ingestSubmission(
  database: Database,
  submission: ApprovedSubmission,
  capturedAt: string,
  source: MetricSource,
): Promise<IngestionItemResult> {
  try {
    const existingMetric = await database.query.submissionMetrics.findFirst({
      columns: { id: true },
      where: and(
        eq(submissionMetrics.submissionId, submission.id),
        eq(submissionMetrics.capturedAt, capturedAt),
      ),
    });

    if (existingMetric) {
      return {
        status: "skipped",
        submissionId: submission.id,
        capturedAt,
        reason: "already_ingested",
      };
    }

    const previousMetric = await database.query.submissionMetrics.findFirst({
      columns: { views: true, likes: true, comments: true },
      where: eq(submissionMetrics.submissionId, submission.id),
      orderBy: [
        desc(submissionMetrics.capturedAt),
        desc(submissionMetrics.createdAt),
      ],
    });
    const snapshot = await source({
      submission,
      previousMetric: previousMetric ?? null,
      capturedAt,
    });

    validateMetric(snapshot, previousMetric?.views ?? 0);

    const inserted = await database
      .insert(submissionMetrics)
      .values({
        submissionId: submission.id,
        capturedAt,
        ...snapshot,
      })
      .onConflictDoNothing({
        target: [submissionMetrics.submissionId, submissionMetrics.capturedAt],
      })
      .returning({ id: submissionMetrics.id });

    if (inserted.length === 0) {
      return {
        status: "skipped",
        submissionId: submission.id,
        capturedAt,
        reason: "already_ingested",
      };
    }

    return {
      status: "created",
      submissionId: submission.id,
      capturedAt,
      views: snapshot.views,
    };
  } catch (error) {
    return {
      status: "failed",
      submissionId: submission.id,
      capturedAt,
      error: errorMessage(error),
    };
  }
}

export async function ingestDailyMetrics({
  database,
  capturedAt,
  source = fakeMetricSource,
}: {
  database: Database;
  capturedAt: string;
  source?: MetricSource;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) {
    throw new TypeError("capturedAt must use YYYY-MM-DD format");
  }

  const approvedSubmissions = await database
    .select({
      id: submissions.id,
      campaignId: submissions.campaignId,
      creatorId: submissions.creatorId,
      platform: submissions.platform,
      postUrl: submissions.postUrl,
    })
    .from(submissions)
    .where(eq(submissions.status, "approved"));

  const results: IngestionItemResult[] = [];

  for (const submission of approvedSubmissions) {
    results.push(
      await ingestSubmission(database, submission, capturedAt, source),
    );
  }

  return {
    capturedAt,
    created: results.filter((result) => result.status === "created").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}
