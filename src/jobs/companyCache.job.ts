import { prisma } from "../prisma/client";
import { importLocalCompanyCache, refreshCompanyCache } from "../services/companyCache.service";

const useLocal = process.argv.includes("--local");

(useLocal ? importLocalCompanyCache() : refreshCompanyCache())
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
