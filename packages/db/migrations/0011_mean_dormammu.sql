ALTER TABLE "profile" ADD COLUMN "effective_region" text GENERATED ALWAYS AS (coalesce("chosen_region", "derived_region", 'other')) STORED;--> statement-breakpoint
CREATE INDEX "profile_region_idx" ON "profile" USING btree ("effective_region","user_id");
