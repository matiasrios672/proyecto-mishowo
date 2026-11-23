ALTER TABLE "appointment_settings" ADD COLUMN "staff" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "staff_id" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "staff_name" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;