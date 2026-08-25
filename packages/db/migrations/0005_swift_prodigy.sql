ALTER TABLE "item_use" ADD COLUMN "paragraph_index" integer;--> statement-breakpoint
CREATE INDEX "item_use_caster_idx" ON "item_use" USING btree ("caster_id","item_id");--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_designated_once" UNIQUE("caster_id","item_id","paragraph_index");--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_paragraph_1_based" CHECK ("item_use"."paragraph_index" is null or "item_use"."paragraph_index" >= 1);
