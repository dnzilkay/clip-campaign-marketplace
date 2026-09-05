import { z } from "zod";

import { platformSchema } from "./campaign";

export const createSubmissionSchema = z.object({
  campaignId: z.uuid(),
  postUrl: z
    .url({ error: "Enter a valid post URL" })
    .max(2_000, "Post URL is too long"),
  platform: platformSchema,
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
