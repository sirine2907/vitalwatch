CREATE TYPE "public"."alert_metric" AS ENUM('score', 'lcp', 'inp', 'cls');--> statement-breakpoint
CREATE TYPE "public"."alert_source" AS ENUM('lab', 'field');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('score_drop', 'vital_poor');--> statement-breakpoint
CREATE TYPE "public"."schedule" AS ENUM('off', 'hourly', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."url_role" AS ENUM('monitored', 'competitor');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url_id" uuid NOT NULL,
	"trigger_run_id" uuid,
	"type" "alert_type" NOT NULL,
	"metric" "alert_metric" NOT NULL,
	"source" "alert_source" NOT NULL,
	"strategy" "strategy" NOT NULL,
	"baseline_value" real NOT NULL,
	"current_value" real NOT NULL,
	"threshold" real NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_urls" ADD COLUMN "role" "url_role" DEFAULT 'monitored' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "schedule" "schedule" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "score_drop_threshold" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "baseline_size" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "email_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "slot" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_url_id_project_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."project_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_trigger_run_id_test_runs_id_fk" FOREIGN KEY ("trigger_run_id") REFERENCES "public"."test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_one_open_idx" ON "alerts" USING btree ("url_id","strategy","type","metric") WHERE "alerts"."status" = 'open';--> statement-breakpoint
CREATE INDEX "alerts_project_idx" ON "alerts" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "projects_due_idx" ON "projects" USING btree ("next_run_at") WHERE "projects"."schedule" <> 'off';--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_slot_unique" UNIQUE("url_id","strategy","slot","trigger");