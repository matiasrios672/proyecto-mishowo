CREATE TABLE "site_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"day" date NOT NULL,
	"type" text NOT NULL,
	"product_id" uuid,
	"source" text,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_events_biz_day_idx" ON "site_events" USING btree ("business_id","day","type");