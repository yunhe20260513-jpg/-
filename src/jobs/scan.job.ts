import { scanAllSources } from "../services/scanner.service";
import { prisma } from "../prisma/client";

scanAllSources()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
