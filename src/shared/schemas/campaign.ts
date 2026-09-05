import { z } from "zod";

export const platformSchema = z.enum(["tiktok", "instagram", "youtube"]);
export const campaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

export const campaignFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(160, "Title cannot exceed 160 characters"),
    platforms: z
      .array(platformSchema)
      .min(1, "Select at least one platform"),
    payoutPer1kViews: z
      .number({ error: "Enter a payout amount" })
      .int("Payout must use whole cents")
      .positive("Payout must be greater than zero"),
    totalBudget: z
      .number({ error: "Enter a total budget" })
      .int("Budget must use whole cents")
      .positive("Budget must be greater than zero"),
    status: campaignStatusSchema,
    startsAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid start date",
    }),
    endsAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid end date",
    }),
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export const campaignListInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(160).default(""),
  status: campaignStatusSchema.optional(),
});

export type CampaignFormInput = z.input<typeof campaignFormSchema>;
export type CampaignFormValues = z.output<typeof campaignFormSchema>;
