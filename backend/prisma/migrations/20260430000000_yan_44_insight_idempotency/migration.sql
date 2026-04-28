-- Yan #44: insights cron idempotency.
-- dateKey holds the YYYY-MM-DD UTC bucket so saveInsights() can upsert
-- (cameraId, type, dateKey) and a 6h cron tick re-running on the same day
-- updates the existing row instead of duplicating it.
ALTER TABLE "insights" ADD COLUMN "dateKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "insights_cameraId_type_dateKey_key" ON "insights"("cameraId", "type", "dateKey");
