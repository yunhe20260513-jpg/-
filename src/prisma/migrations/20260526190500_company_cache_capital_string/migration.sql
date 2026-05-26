CREATE TABLE "new_CompanyCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT,
    "capitalAmount" TEXT,
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

INSERT INTO "new_CompanyCache" (
    "id",
    "taxId",
    "name",
    "address",
    "district",
    "capitalAmount",
    "setupDate",
    "organizationType",
    "useInvoice",
    "industryCode",
    "industryName",
    "sourceUrl",
    "rawJson",
    "importedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "taxId",
    "name",
    "address",
    "district",
    CAST("capitalAmount" AS TEXT),
    "setupDate",
    "organizationType",
    "useInvoice",
    "industryCode",
    "industryName",
    "sourceUrl",
    "rawJson",
    "importedAt",
    "createdAt",
    "updatedAt"
FROM "CompanyCache";

DROP TABLE "CompanyCache";
ALTER TABLE "new_CompanyCache" RENAME TO "CompanyCache";

CREATE UNIQUE INDEX "CompanyCache_taxId_key" ON "CompanyCache"("taxId");
CREATE INDEX "CompanyCache_district_idx" ON "CompanyCache"("district");
CREATE INDEX "CompanyCache_setupDate_idx" ON "CompanyCache"("setupDate");
CREATE INDEX "CompanyCache_industryName_idx" ON "CompanyCache"("industryName");
CREATE INDEX "CompanyCache_importedAt_idx" ON "CompanyCache"("importedAt");
