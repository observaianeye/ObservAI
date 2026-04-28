-- Yan #57: insights soft-dismiss UX. dismissedAt records the moment the
-- user clicked "dismiss" so the list endpoint can hide it without losing
-- the row. Default list filter is dismissedAt IS NULL.
ALTER TABLE "insights" ADD COLUMN "dismissedAt" DATETIME;
