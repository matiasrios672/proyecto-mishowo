CREATE TABLE "business_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_notes" ADD CONSTRAINT "business_notes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_notes" ADD CONSTRAINT "business_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_notes_biz_idx" ON "business_notes" USING btree ("business_id","created_at");
--> statement-breakpoint
INSERT INTO "business_notes" ("business_id", "body") SELECT "id", "internal_note" FROM "businesses" WHERE "internal_note" IS NOT NULL AND btrim("internal_note") <> '';
