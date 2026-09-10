CREATE TABLE "leaderboard_entry" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text,
	"mode" "game_mode" NOT NULL,
	"score" integer NOT NULL,
	"finished_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leaderboard_entry" ADD CONSTRAINT "leaderboard_entry_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entry" ADD CONSTRAINT "leaderboard_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leaderboard_mode_finished_idx" ON "leaderboard_entry" USING btree ("mode","finished_at","score");--> statement-breakpoint
CREATE INDEX "leaderboard_user_idx" ON "leaderboard_entry" USING btree ("user_id");
