ALTER TABLE "hint_purchase" DROP CONSTRAINT "hint_purchase_was_charged";--> statement-breakpoint
ALTER TABLE "hint_purchase" ADD COLUMN "paid_with" text DEFAULT 'score' NOT NULL;--> statement-breakpoint
ALTER TABLE "hint_purchase" ADD CONSTRAINT "hint_purchase_currency" CHECK ("hint_purchase"."paid_with" in ('score', 'coins'));--> statement-breakpoint
ALTER TABLE "hint_purchase" ADD CONSTRAINT "hint_purchase_was_charged" CHECK ("hint_purchase"."charged" > 0 or "hint_purchase"."paid_with" = 'coins');
