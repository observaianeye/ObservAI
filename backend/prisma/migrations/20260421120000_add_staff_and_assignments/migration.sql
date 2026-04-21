-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "telegramChatId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'server',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notifiedViaTelegram" BOOLEAN NOT NULL DEFAULT false,
    "notifiedViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" DATETIME,
    "acceptToken" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "staff_userId_branchId_idx" ON "staff"("userId", "branchId");

-- CreateIndex
CREATE INDEX "staff_branchId_isActive_idx" ON "staff"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignments_acceptToken_key" ON "staff_assignments"("acceptToken");

-- CreateIndex
CREATE INDEX "staff_assignments_staffId_date_idx" ON "staff_assignments"("staffId", "date");

-- CreateIndex
CREATE INDEX "staff_assignments_branchId_date_idx" ON "staff_assignments"("branchId", "date");
