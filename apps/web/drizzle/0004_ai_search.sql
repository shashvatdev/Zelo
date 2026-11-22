-- Full-text search for Ask Zelo. Generated columns stay in sync on every write; GIN indexes keep
-- search fast on very large boards. 'simple' config: no stemming, works for English and Hinglish.
-- These columns are deliberately not in the Drizzle schema, so normal selects never fetch them.
ALTER TABLE "tickets" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("key", '') || ' ' || coalesce("title", ''))) STORED;
--> statement-breakpoint
ALTER TABLE "bugs" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("key", '') || ' ' || coalesce("title", ''))) STORED;
--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("key", '') || ' ' || coalesce("name", '')), 'A') || setweight(to_tsvector('simple', left(coalesce("spec", ''), 20000)), 'B')) STORED;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', left(coalesce("body", ''), 10000))) STORED;
--> statement-breakpoint
CREATE INDEX "tickets_search_idx" ON "tickets" USING gin ("search");
--> statement-breakpoint
CREATE INDEX "bugs_search_idx" ON "bugs" USING gin ("search");
--> statement-breakpoint
CREATE INDEX "features_search_idx" ON "features" USING gin ("search");
--> statement-breakpoint
CREATE INDEX "comments_search_idx" ON "comments" USING gin ("search");
