CREATE TYPE "public"."flag_recommendation" AS ENUM('approve_for_review', 'needs_more_info', 'reject');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('ai_reviewed', 'pending_human_review', 'rejected_by_ai');--> statement-breakpoint
CREATE TYPE "public"."flag_verdict" AS ENUM('likely_valid', 'uncertain', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."item_id" AS ENUM('HINT_LOCK', 'FREEZE_TIME', 'SCORE_STEAL', 'SCANNER', 'EARTHQUAKE', 'BLACKOUT', 'BLUR', 'RICKROLL', 'MIRROR', 'TINY', 'SPIN', 'CONFETTI', 'INVERT');--> statement-breakpoint
CREATE TABLE "flag_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"reporter_id" text,
	"article_title" text NOT NULL,
	"article_url" text DEFAULT '' NOT NULL,
	"flagged_claim" text NOT NULL,
	"proposed_correction" text NOT NULL,
	"quick_note" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "flag_status" NOT NULL,
	"verdict" "flag_verdict" NOT NULL,
	"confidence" integer NOT NULL,
	"reasoning" text NOT NULL,
	"sources_found" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation" "flag_recommendation" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_report_confidence_range" CHECK ("flag_report"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "hint_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"false_info_number" integer NOT NULL,
	"level" integer NOT NULL,
	"charged" integer NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hint_purchase_once_per_level" UNIQUE("participant_id","false_info_number","level"),
	CONSTRAINT "hint_purchase_level_range" CHECK ("hint_purchase"."level" in (1, 2)),
	CONSTRAINT "hint_purchase_number_1_based" CHECK ("hint_purchase"."false_info_number" >= 1),
	CONSTRAINT "hint_purchase_was_charged" CHECK ("hint_purchase"."charged" > 0)
);
--> statement-breakpoint
CREATE TABLE "item_use" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"caster_id" uuid NOT NULL,
	"target_id" uuid,
	"item_id" "item_id" NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_use_no_self_target" CHECK ("item_use"."target_id" is null or "item_use"."target_id" != "item_use"."caster_id")
);
--> statement-breakpoint
ALTER TABLE "flag_report" ADD CONSTRAINT "flag_report_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_report" ADD CONSTRAINT "flag_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_purchase" ADD CONSTRAINT "hint_purchase_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_caster_id_participant_id_fk" FOREIGN KEY ("caster_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_target_id_participant_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flag_report_status_idx" ON "flag_report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "hint_purchase_participant_idx" ON "hint_purchase" USING btree ("participant_id","purchased_at");--> statement-breakpoint
CREATE INDEX "item_use_game_idx" ON "item_use" USING btree ("game_id","used_at");
