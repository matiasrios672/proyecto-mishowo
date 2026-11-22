ALTER TABLE "businesses" ADD COLUMN "content_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_biz_client_idx" ON "categories" USING btree ("business_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_options_biz_client_idx" ON "product_options" USING btree ("business_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_biz_client_idx" ON "products" USING btree ("business_id","client_id");