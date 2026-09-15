ALTER TABLE "game" ADD COLUMN "daily_day" integer;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_daily_day_daily_article_day_fk" FOREIGN KEY ("daily_day") REFERENCES "public"."daily_article"("day") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_daily_day_idx" ON "game" USING btree ("daily_day");
