CREATE TABLE "CompanyCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT,
    "capitalAmount" INTEGER,
    "setupDate" DATETIME,
    "organizationType" TEXT,
    "useInvoice" TEXT,
    "industryCode" TEXT,
    "industryName" TEXT,
    "sourceUrl" TEXT,
    "rawJson" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "CompanyCache_taxId_key" ON "CompanyCache"("taxId");
CREATE INDEX "CompanyCache_district_idx" ON "CompanyCache"("district");
CREATE INDEX "CompanyCache_setupDate_idx" ON "CompanyCache"("setupDate");
CREATE INDEX "CompanyCache_industryName_idx" ON "CompanyCache"("industryName");
CREATE INDEX "CompanyCache_importedAt_idx" ON "CompanyCache"("importedAt");
