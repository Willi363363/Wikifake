ALTER TABLE "profile" ADD COLUMN "worn_marker" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "worn_mark_style" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "worn_frame" text;--> statement-breakpoint
CREATE INDEX "coin_movement_owned_idx" ON "coin_movement" USING btree ("user_id","reference") WHERE "coin_movement"."source" = 'cosmetic_purchase';
