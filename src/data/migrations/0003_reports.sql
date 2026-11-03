CREATE TABLE "shared_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_reports_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "shared_reports" ADD CONSTRAINT "shared_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_reports_project_idx" ON "shared_reports" USING btree ("project_id");