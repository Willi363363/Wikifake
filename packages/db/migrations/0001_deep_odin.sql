CREATE TYPE "public"."game_mode" AS ENUM('solo', 'multiplayer');--> statement-breakpoint
CREATE TYPE "public"."room_phase" AS ENUM('lobby', 'voting', 'generating', 'round');--> statement-breakpoint
CREATE TABLE "answer" (
	"participant_id" uuid NOT NULL,
	"paragraph_index" integer NOT NULL,
	CONSTRAINT "answer_participant_paragraph_key" UNIQUE("participant_id","paragraph_index"),
	CONSTRAINT "answer_paragraph_1_based" CHECK ("answer"."paragraph_index" >= 1)
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text,
	"mode" "game_mode" NOT NULL,
	"topic" text NOT NULL,
	"source_url" text NOT NULL,
	"paragraphs" jsonb NOT NULL,
	"total_fakes" integer NOT NULL,
	"time_limit" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "game_total_fakes_positive" CHECK ("game"."total_fakes" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"paragraph_index" integer NOT NULL,
	"false_info_number" integer NOT NULL,
	"false_statement" text NOT NULL,
	"original_text" text NOT NULL,
	"explanation" text NOT NULL,
	"hint" text NOT NULL,
	CONSTRAINT "game_position_game_paragraph_key" UNIQUE("game_id","paragraph_index"),
	CONSTRAINT "game_position_game_number_key" UNIQUE("game_id","false_info_number"),
	CONSTRAINT "game_position_paragraph_1_based" CHECK ("game_position"."paragraph_index" >= 1),
	CONSTRAINT "game_position_number_1_based" CHECK ("game_position"."false_info_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" text,
	"guest_name" text,
	"colour" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" integer,
	"true_positives" integer,
	"false_positives" integer,
	"hints_used" integer,
	"hint_penalty" integer,
	"score_stolen" integer,
	"time_bonus" integer,
	CONSTRAINT "participant_account_or_guest" CHECK (("participant"."user_id" is null) != ("participant"."guest_name" is null)),
	CONSTRAINT "participant_score_with_submission" CHECK (("participant"."submitted_at" is null) = ("participant"."score" is null))
);
--> statement-breakpoint
CREATE TABLE "room" (
	"code" text PRIMARY KEY NOT NULL,
	"host_name" text,
	"phase" "room_phase" DEFAULT 'lobby' NOT NULL,
	"with_items" boolean DEFAULT true NOT NULL,
	"time_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer" ADD CONSTRAINT "answer_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_room_code_room_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_position" ADD CONSTRAINT "game_position_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_room_code_idx" ON "game" USING btree ("room_code");--> statement-breakpoint
CREATE INDEX "participant_game_id_idx" ON "participant" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "participant_user_id_idx" ON "participant" USING btree ("user_id");
