CREATE INDEX "activity_actor_idx" ON "activity" USING btree ("product_id","actor_id","at");--> statement-breakpoint
CREATE INDEX "bugs_release_idx" ON "bugs" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "bugs_assignee_idx" ON "bugs" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "features_module_idx" ON "features" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "tickets_product_status_idx" ON "tickets" USING btree ("product_id","status");