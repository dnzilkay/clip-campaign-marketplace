import { z } from "zod";

import { platformSchema } from "./campaign";

export const createSubmissionSchema = z.object({
  campaignId: z.uuid(),
  postUrl: z.url().max(2_000),
  platform: platformSchema,
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
