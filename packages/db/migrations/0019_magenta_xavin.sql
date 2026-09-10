CREATE INDEX "player_stats_last_seen_idx" ON "player_stats" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "player_stats_finished_idx" ON "player_stats" USING btree ("games_finished" DESC NULLS LAST);
