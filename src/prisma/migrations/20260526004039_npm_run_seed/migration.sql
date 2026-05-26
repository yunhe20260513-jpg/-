-- CreateTable
CREATE TABLE "SourcePost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" TEXT,
    "contentHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "urgency" INTEGER NOT NULL DEFAULT 1,
    "isRelevant" BOOLEAN NOT NULL DEFAULT true,
    "isBusinessNeed" BOOLEAN NOT NULL DEFAULT false,
    "isComplaint" BOOLEAN NOT NULL DEFAULT false,
    "hasBuyingIntent" BOOLEAN NOT NULL DEFAULT false,
    "isLowValue" BOOLEAN NOT NULL DEFAULT false,
    "customerType" TEXT NOT NULL DEFAULT '未知',
    "matchedKeywords" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "suggestedReply" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SourcePost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE INDEX "SourcePost_source_idx" ON "SourcePost"("source");

-- CreateIndex
CREATE INDEX "SourcePost_contentHash_idx" ON "SourcePost"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePost_source_externalId_key" ON "SourcePost"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_postId_key" ON "Lead"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_value_key" ON "Keyword"("value");

-- CreateIndex
CREATE INDEX "Keyword_group_idx" ON "Keyword"("group");
