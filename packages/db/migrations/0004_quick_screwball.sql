ALTER TABLE "participant" DROP CONSTRAINT "participant_account_or_guest";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_account_or_guest" CHECK ("participant"."user_id" is not null or "participant"."guest_name" is not null);
