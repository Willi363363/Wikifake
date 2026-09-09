ALTER TABLE "profile" ADD COLUMN "display_name_key" text;--> statement-breakpoint
UPDATE "profile" SET "display_name_key" = lower(regexp_replace(btrim("display_name"), '\s+', ' ', 'g')) WHERE "display_name_key" IS NULL;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "display_name_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_display_name_key_key" UNIQUE("display_name_key");
