CREATE TABLE "TenderLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "tenderName" TEXT NOT NULL,
    "agencyName" TEXT,
    "jobNumber" TEXT NOT NULL,
    "announceDate" DATETIME,
    "deadlineDate" DATETIME,
    "budgetAmount" INTEGER,
    "tenderMethod" TEXT,
    "procurementType" TEXT,
    "url" TEXT NOT NULL,
    "rawJson" TEXT,
    "rawScore" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "matchedKeywords" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "TenderLead_jobNumber_key" ON "TenderLead"("jobNumber");
CREATE INDEX "TenderLead_source_idx" ON "TenderLead"("source");
CREATE INDEX "TenderLead_grade_idx" ON "TenderLead"("grade");
CREATE INDEX "TenderLead_status_idx" ON "TenderLead"("status");
CREATE INDEX "TenderLead_deadlineDate_idx" ON "TenderLead"("deadlineDate");
CREATE INDEX "TenderLead_budgetAmount_idx" ON "TenderLead"("budgetAmount");
CREATE INDEX "TenderLead_isStarred_idx" ON "TenderLead"("isStarred");
