import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);

export const platformEnum = pgEnum("platform", [
  "tiktok",
  "instagram",
  "youtube",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    platforms: platformEnum("platforms").array().notNull(),
    payoutPer1kViews: integer("payout_per_1k_views").notNull(),
    totalBudget: integer("total_budget").notNull(),
    status: campaignStatusEnum("status").default("draft").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("campaigns_status_starts_at_idx").on(table.status, table.startsAt),
    index("campaigns_title_idx").on(table.title),
    check("campaigns_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check(
      "campaigns_platforms_not_empty",
      sql`cardinality(${table.platforms}) > 0`,
    ),
    check(
      "campaigns_payout_per_1k_views_positive",
      sql`${table.payoutPer1kViews} > 0`,
    ),
    check(
      "campaigns_total_budget_positive",
      sql`${table.totalBudget} > 0`,
    ),
    check("campaigns_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    postUrl: text("post_url").notNull(),
    normalizedPostUrl: text("normalized_post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").default("pending").notNull(),
    rejectionReason: text("rejection_reason"),
    approvedPayoutCents: integer("approved_payout_cents"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("submissions_campaign_url_unique").on(
      table.campaignId,
      table.normalizedPostUrl,
    ),
    index("submissions_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("submissions_creator_created_at_idx").on(
      table.creatorId,
      table.createdAt,
    ),
    check("submissions_post_url_not_blank", sql`length(btrim(${table.postUrl})) > 0`),
    check(
      "submissions_normalized_post_url_not_blank",
      sql`length(btrim(${table.normalizedPostUrl})) > 0`,
    ),
    check(
      "submissions_rejection_reason_required",
      sql`${table.status} <> 'rejected' OR length(btrim(coalesce(${table.rejectionReason}, ''))) > 0`,
    ),
    check(
      "submissions_approved_payout_non_negative",
      sql`${table.approvedPayoutCents} IS NULL OR ${table.approvedPayoutCents} >= 0`,
    ),
    check(
      "submissions_approved_payout_matches_status",
      sql`(${table.status} IN ('approved', 'paid') AND ${table.approvedPayoutCents} IS NOT NULL) OR (${table.status} IN ('pending', 'rejected') AND ${table.approvedPayoutCents} IS NULL)`,
    ),
  ],
);

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    capturedAt: date("captured_at", { mode: "string" }).notNull(),
    views: bigint("views", { mode: "number" }).notNull(),
    likes: bigint("likes", { mode: "number" }).notNull(),
    comments: bigint("comments", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("submission_metrics_submission_day_unique").on(
      table.submissionId,
      table.capturedAt,
    ),
    index("submission_metrics_captured_at_idx").on(table.capturedAt),
    check("submission_metrics_views_non_negative", sql`${table.views} >= 0`),
    check("submission_metrics_likes_non_negative", sql`${table.likes} >= 0`),
    check(
      "submission_metrics_comments_non_negative",
      sql`${table.comments} >= 0`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionMetric = typeof submissionMetrics.$inferSelect;
