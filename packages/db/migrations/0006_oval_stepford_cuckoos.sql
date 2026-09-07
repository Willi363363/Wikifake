CREATE TABLE "player_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_finished" integer DEFAULT 0 NOT NULL,
	"falsifications_found" integer DEFAULT 0 NOT NULL,
	"falsifications_missed" integer DEFAULT 0 NOT NULL,
	"paragraphs_wrongly_marked" integer DEFAULT 0 NOT NULL,
	"best_score" integer,
	"total_score" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
