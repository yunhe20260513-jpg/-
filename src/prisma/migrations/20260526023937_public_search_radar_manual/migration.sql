/*
  Warnings:

  - You are about to drop the column `notifiedAt` on the `Lead` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SourcePost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("createdAt", "customerType", "hasBuyingIntent", "id", "isBusinessNeed", "isComplaint", "isLowValue", "isRelevant", "matchedKeywords", "postId", "rawScore", "reason", "recommendedAction", "score", "status", "suggestedReply", "summary", "updatedAt", "urgency") SELECT "createdAt", "customerType", "hasBuyingIntent", "id", "isBusinessNeed", "isComplaint", "isLowValue", "isRelevant", "matchedKeywords", "postId", "rawScore", "reason", "recommendedAction", "score", "status", "suggestedReply", "summary", "updatedAt", "urgency" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_postId_key" ON "Lead"("postId");
CREATE INDEX "Lead_score_idx" ON "Lead"("score");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
