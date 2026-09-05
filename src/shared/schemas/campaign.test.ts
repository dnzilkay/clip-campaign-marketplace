import { describe, expect, it } from "vitest";

import { campaignFormSchema } from "./campaign";

const validCampaign = {
  title: "Creator launch",
  platforms: ["youtube" as const],
  payoutPer1kViews: 250,
  totalBudget: 50_000,
  status: "active" as const,
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-09-30T00:00:00.000Z",
};

describe("campaign form validation", () => {
  it("returns a user-facing message when no platform is selected", () => {
    const result = campaignFormSchema.safeParse({
      ...validCampaign,
      platforms: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Select at least one platform",
    );
  });
});
