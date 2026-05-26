CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "rawJson" TEXT,
    "rawScore" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "matchedKeywords" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Signal_type_url_key" ON "Signal"("type", "url");
CREATE INDEX "Signal_type_idx" ON "Signal"("type");
CREATE INDEX "Signal_source_idx" ON "Signal"("source");
CREATE INDEX "Signal_grade_idx" ON "Signal"("grade");
CREATE INDEX "Signal_status_idx" ON "Signal"("status");
CREATE INDEX "Signal_isStarred_idx" ON "Signal"("isStarred");
CREATE INDEX "Signal_publishedAt_idx" ON "Signal"("publishedAt");
