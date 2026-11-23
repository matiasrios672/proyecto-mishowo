ALTER TABLE "users" ADD COLUMN "signup_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_nudge_at" timestamp with time zone;