ALTER TABLE "SourcePost" ADD COLUMN "title" TEXT;
ALTER TABLE "SourcePost" ADD COLUMN "snippet" TEXT;
ALTER TABLE "SourcePost" ADD COLUMN "isMock" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ScanLog" ADD COLUMN "createdLeadCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AdapterStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "errorMessage" TEXT,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "SourcePost_url_idx" ON "SourcePost"("url");
CREATE INDEX "SourcePost_isMock_idx" ON "SourcePost"("isMock");
CREATE INDEX "Lead_score_idx" ON "Lead"("score");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Keyword_isActive_idx" ON "Keyword"("isActive");
CREATE UNIQUE INDEX "AdapterStatus_source_key" ON "AdapterStatus"("source");
