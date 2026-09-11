CREATE TYPE "public"."coin_source" AS ENUM('quest_reward', 'round_end', 'hint_purchase', 'cosmetic_purchase', 'adjustment');--> statement-breakpoint
CREATE TABLE "coin_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"source" "coin_source" NOT NULL,
	"reference" text,
	"idempotency_key" text NOT NULL,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_movement_key" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "coin_movement_amount_not_zero" CHECK ("coin_movement"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "coin_movement" ADD CONSTRAINT "coin_movement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_movement_user_idx" ON "coin_movement" USING btree ("user_id","created_at" DESC NULLS LAST);
