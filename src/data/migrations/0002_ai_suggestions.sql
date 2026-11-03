CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"content" jsonb NOT NULL,
	"stack" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_suggestions_run_prompt_unique" UNIQUE("run_id","prompt_version")
);
--> statement-breakpoint
CREATE TABLE "stack_detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_id" uuid NOT NULL,
	"detected" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_detections" ADD CONSTRAINT "stack_detections_url_id_project_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."project_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_suggestions_user_idx" ON "ai_suggestions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "stack_detections_url_idx" ON "stack_detections" USING btree ("url_id","created_at" DESC NULLS LAST);