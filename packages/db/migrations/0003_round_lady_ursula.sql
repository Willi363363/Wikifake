CREATE TYPE "public"."llm_call_kind" AS ENUM('topic_choice', 'falsification', 'flag_verification');--> statement-breakpoint
CREATE TABLE "llm_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"model" text NOT NULL,
	"kind" "llm_call_kind" NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"prompt_chars" integer NOT NULL,
	"output_chars" integer NOT NULL,
	"failed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_call_tokens_not_negative" CHECK (
      ("llm_call"."input_tokens" is null or "llm_call"."input_tokens" >= 0)
      and ("llm_call"."output_tokens" is null or "llm_call"."output_tokens" >= 0)
    )
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "from_cache" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_call" ADD CONSTRAINT "llm_call_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_call_kind_idx" ON "llm_call" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "llm_call_game_idx" ON "llm_call" USING btree ("game_id");
