-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputOriginalName" TEXT,
    "inputSize" INTEGER,
    "inputMimeType" TEXT,
    "inputFilePath" TEXT,
    "inputSha256" TEXT,
    "inputUrl" TEXT,
    "summary" TEXT,
    "sha256" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'sentinelscan-v1',
    "finishedAt" DATETIME,
    "processingTime" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "userId" TEXT NOT NULL DEFAULT 'anonymous',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    CONSTRAINT "Finding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Report_userId_createdAt_idx" ON "Report"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "Finding_reportId_idx" ON "Finding"("reportId");
