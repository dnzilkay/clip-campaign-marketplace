import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/server/db";
import { campaigns, submissions, type Campaign } from "@/server/db/schema";

import { DomainError } from "./errors";

export type CampaignUpdateValues = {
  title: string;
  platforms: Campaign["platforms"];
  payoutPer1kViews: number;
  totalBudget: number;
  status: Campaign["status"];
  startsAt: Date;
  endsAt: Date;
};

export async function updateCampaignSafely(
  database: Database,
  campaignId: string,
  values: CampaignUpdateValues,
) {
  return database.transaction(async (transaction) => {
    const [existingCampaign] = await transaction
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .for("update")
      .limit(1);

    if (!existingCampaign) {
      throw new DomainError("CAMPAIGN_NOT_FOUND", "Campaign not found");
    }

    const [budget] = await transaction
      .select({
        committedCents: sql<number>`coalesce(sum(${submissions.approvedPayoutCents}), 0)::integer`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, campaignId),
          inArray(submissions.status, ["approved", "paid"]),
        ),
      );
    const committedCents = Number(budget?.committedCents ?? 0);

    if (values.totalBudget < committedCents) {
      throw new DomainError(
        "CAMPAIGN_BUDGET_BELOW_COMMITTED",
        `Budget cannot be lower than the already committed ${committedCents} cents`,
      );
    }

    const updatedAt = new Date();
    const [campaign] = await transaction
      .update(campaigns)
      .set({
        ...values,
        status:
          values.totalBudget === committedCents ? "completed" : values.status,
        updatedAt,
      })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return campaign;
  });
}
