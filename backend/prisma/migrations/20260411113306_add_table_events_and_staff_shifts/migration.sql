-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "userId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "table_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "occupants" INTEGER NOT NULL DEFAULT 0,
    "duration" REAL,
    "cameraId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hour" INTEGER NOT NULL,
    "staffCount" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cameras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "branchId" TEXT,
    "config" TEXT,
    CONSTRAINT "cameras_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cameras_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cameras" ("config", "createdAt", "createdBy", "description", "id", "isActive", "name", "sourceType", "sourceValue", "updatedAt") SELECT "config", "createdAt", "createdBy", "description", "id", "isActive", "name", "sourceType", "sourceValue", "updatedAt" FROM "cameras";
DROP TABLE "cameras";
ALTER TABLE "new_cameras" RENAME TO "cameras";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "accountType" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialExpiresAt" DATETIME,
    "companyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME,
    "telegramChatId" TEXT,
    "telegramNotifications" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notifySeverity" TEXT NOT NULL DEFAULT 'high',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySummaryTime" TEXT
);
INSERT INTO "new_users" ("createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "table_events_zoneId_startTime_idx" ON "table_events"("zoneId", "startTime");

-- CreateIndex
CREATE INDEX "table_events_cameraId_createdAt_idx" ON "table_events"("cameraId", "createdAt");

-- CreateIndex
CREATE INDEX "staff_shifts_branchId_date_idx" ON "staff_shifts"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_branchId_date_hour_key" ON "staff_shifts"("branchId", "date", "hour");
