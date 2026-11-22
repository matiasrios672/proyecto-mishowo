CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan_reminder_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "internal_note" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "admin_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;