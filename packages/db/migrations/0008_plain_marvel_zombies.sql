CREATE TYPE "public"."quest_period" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TABLE "quest_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"period" "quest_period" NOT NULL,
	"period_index" integer NOT NULL,
	"rule_id" text NOT NULL,
	"target" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "quest_assignment_key" UNIQUE("user_id","period","period_index","rule_id"),
	CONSTRAINT "quest_assignment_target_positive" CHECK ("quest_assignment"."target" > 0)
);
--> statement-breakpoint
ALTER TABLE "quest_assignment" ADD CONSTRAINT "quest_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_assignment_set_idx" ON "quest_assignment" USING btree ("user_id","period","period_index");
