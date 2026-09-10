DROP INDEX "leaderboard_mode_score_idx";--> statement-breakpoint
CREATE INDEX "leaderboard_mode_score_idx" ON "leaderboard_entry" USING btree ("mode","score" DESC NULLS LAST,"finished_at","participant_id") WHERE "leaderboard_entry"."user_id" is not null;
