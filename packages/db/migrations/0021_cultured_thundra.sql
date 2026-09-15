CREATE TABLE "daily_article" (
	"day" integer PRIMARY KEY NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"topic" text,
	"source_url" text,
	"paragraphs" jsonb,
	"solution" jsonb,
	"total_fakes" integer,
	"generated_at" timestamp with time zone,
	CONSTRAINT "daily_article_filled_together" CHECK (("daily_article"."generated_at" is null) = ("daily_article"."paragraphs" is null
        and "daily_article"."solution" is null
        and "daily_article"."topic" is null
        and "daily_article"."source_url" is null
        and "daily_article"."total_fakes" is null)),
	CONSTRAINT "daily_article_fakes_positive" CHECK ("daily_article"."total_fakes" is null or "daily_article"."total_fakes" >= 1)
);
--> statement-breakpoint
CREATE INDEX "daily_article_open_claims_idx" ON "daily_article" USING btree ("generated_at","claimed_at");
