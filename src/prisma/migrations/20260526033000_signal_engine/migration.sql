ALTER TABLE "Lead" ADD COLUMN "grade" TEXT NOT NULL DEFAULT 'B';
ALTER TABLE "Lead" ADD COLUMN "signalTypes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Lead" ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BlacklistKeyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "newLeadCount" INTEGER NOT NULL DEFAULT 0,
    "sGradeCount" INTEGER NOT NULL DEFAULT 0,
    "topKeywordsJson" TEXT NOT NULL DEFAULT '[]',
    "sourceCountsJson" TEXT NOT NULL DEFAULT '{}',
    "signalCountsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Lead_grade_idx" ON "Lead"("grade");
CREATE INDEX "Lead_isStarred_idx" ON "Lead"("isStarred");
CREATE UNIQUE INDEX "BlacklistKeyword_value_key" ON "BlacklistKeyword"("value");
CREATE INDEX "BlacklistKeyword_isActive_idx" ON "BlacklistKeyword"("isActive");
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");
