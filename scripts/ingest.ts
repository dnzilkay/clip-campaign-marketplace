import "dotenv/config";

import { db, postgresClient } from "../src/server/db";
import { ingestDailyMetrics } from "../src/server/domain/metrics-ingestion";

async function main() {
  const capturedAt = new Date().toISOString().slice(0, 10);
  const report = await ingestDailyMetrics({ database: db, capturedAt });

  for (const result of report.results) {
    if (result.status === "failed") {
      console.error("Metric ingestion failed", result);
    }
  }

  console.info("Metric ingestion completed", {
    capturedAt: report.capturedAt,
    created: report.created,
    skipped: report.skipped,
    failed: report.failed,
  });

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("Metric ingestion could not start", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgresClient.end();
  });
