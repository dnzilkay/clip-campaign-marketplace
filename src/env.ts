import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_COOKIE_SECRET: z.string().min(32),
  DEV_AUTH_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET,
  DEV_AUTH_ENABLED: process.env.DEV_AUTH_ENABLED,
});
