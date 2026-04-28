-- Yan #3: server-side session invalidation via revokedAt timestamp.
-- SQLite ALTER TABLE ADD COLUMN is idempotent only via prisma migrate state.
ALTER TABLE "sessions" ADD COLUMN "revokedAt" DATETIME;
