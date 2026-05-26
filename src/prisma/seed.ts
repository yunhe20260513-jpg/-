import { PrismaClient } from "@prisma/client";
import { defaultKeywords } from "../config/keywords";

const prisma = new PrismaClient();

async function main() {
  for (const keyword of defaultKeywords) {
    await prisma.keyword.upsert({
      where: { value: keyword.value },
      update: { group: keyword.group, weight: keyword.weight, isActive: true },
      create: keyword
    });
  }

  console.log(`Seeded ${defaultKeywords.length} keywords`);

  for (const value of ["徵才廣告", "SEO", "網站製作", "APP設計", "程式開發"]) {
    await prisma.blacklistKeyword.upsert({
      where: { value },
      update: { isActive: true },
      create: { value }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
