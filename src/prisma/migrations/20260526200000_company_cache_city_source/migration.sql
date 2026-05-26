ALTER TABLE "CompanyCache" ADD COLUMN "city" TEXT;
ALTER TABLE "CompanyCache" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'fia_tax_zip';

UPDATE "CompanyCache"
SET "city" = '桃園市'
WHERE "address" LIKE '%桃園市%';
