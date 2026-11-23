CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'novedades' NOT NULL,
	"segment" text DEFAULT 'todos' NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipients" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_requests" ADD COLUMN "handled_by" uuid;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD COLUMN "internal_note" text;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD COLUMN "replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "newsletter_optout_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns" USING btree ("status","scheduled_at");--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;