CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('tiktok', 'instagram', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'creator');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(160) NOT NULL,
	"platforms" "platform"[] NOT NULL,
	"payout_per_1k_views" integer NOT NULL,
	"total_budget" integer NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_title_not_blank" CHECK (length(btrim("campaigns"."title")) > 0),
	CONSTRAINT "campaigns_platforms_not_empty" CHECK (cardinality("campaigns"."platforms") > 0),
	CONSTRAINT "campaigns_payout_per_1k_views_positive" CHECK ("campaigns"."payout_per_1k_views" > 0),
	CONSTRAINT "campaigns_total_budget_positive" CHECK ("campaigns"."total_budget" > 0),
	CONSTRAINT "campaigns_valid_period" CHECK ("campaigns"."starts_at" < "campaigns"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "submission_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"captured_at" date NOT NULL,
	"views" bigint NOT NULL,
	"likes" bigint NOT NULL,
	"comments" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_metrics_views_non_negative" CHECK ("submission_metrics"."views" >= 0),
	CONSTRAINT "submission_metrics_likes_non_negative" CHECK ("submission_metrics"."likes" >= 0),
	CONSTRAINT "submission_metrics_comments_non_negative" CHECK ("submission_metrics"."comments" >= 0)
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"post_url" text NOT NULL,
	"normalized_post_url" text NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"approved_payout_cents" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_post_url_not_blank" CHECK (length(btrim("submissions"."post_url")) > 0),
	CONSTRAINT "submissions_normalized_post_url_not_blank" CHECK (length(btrim("submissions"."normalized_post_url")) > 0),
	CONSTRAINT "submissions_rejection_reason_required" CHECK ("submissions"."status" <> 'rejected' OR length(btrim(coalesce("submissions"."rejection_reason", ''))) > 0),
	CONSTRAINT "submissions_approved_payout_non_negative" CHECK ("submissions"."approved_payout_cents" IS NULL OR "submissions"."approved_payout_cents" >= 0),
	CONSTRAINT "submissions_approved_payout_matches_status" CHECK (("submissions"."status" IN ('approved', 'paid') AND "submissions"."approved_payout_cents" IS NOT NULL) OR ("submissions"."status" IN ('pending', 'rejected') AND "submissions"."approved_payout_cents" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_metrics" ADD CONSTRAINT "submission_metrics_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_status_starts_at_idx" ON "campaigns" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "campaigns_title_idx" ON "campaigns" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_metrics_submission_day_unique" ON "submission_metrics" USING btree ("submission_id","captured_at");--> statement-breakpoint
CREATE INDEX "submission_metrics_captured_at_idx" ON "submission_metrics" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_campaign_url_unique" ON "submissions" USING btree ("campaign_id","normalized_post_url");--> statement-breakpoint
CREATE INDEX "submissions_campaign_status_idx" ON "submissions" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "submissions_creator_created_at_idx" ON "submissions" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");