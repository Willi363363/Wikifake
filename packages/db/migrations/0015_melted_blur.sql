ALTER TABLE "coin_movement" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "coin_movement_balance_idx" ON "coin_movement" USING btree ("user_id","seq" DESC NULLS LAST);
