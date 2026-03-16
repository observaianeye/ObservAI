-- CreateTable: AI Insights
CREATE TABLE IF NOT EXISTS "insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraId" TEXT NOT NULL,
    "zoneId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "insights_cameraId_createdAt_idx" ON "insights"("cameraId", "createdAt");
CREATE INDEX IF NOT EXISTS "insights_type_severity_idx" ON "insights"("type", "severity");
