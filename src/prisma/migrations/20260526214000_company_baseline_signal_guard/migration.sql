ALTER TABLE "CompanyCache" ADD COLUMN "signalGeneratedAt" DATETIME;

CREATE INDEX "CompanyCache_signalGeneratedAt_idx" ON "CompanyCache"("signalGeneratedAt");
