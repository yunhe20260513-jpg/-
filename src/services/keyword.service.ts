import { prisma } from "../prisma/client";

export async function getActiveKeywords() {
  return prisma.keyword.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { value: "asc" }]
  });
}

export async function ensureKeywordSeeded() {
  const count = await prisma.keyword.count();
  if (count > 0) return;
  const { defaultKeywords } = await import("../config/keywords");
  for (const keyword of defaultKeywords) {
    await prisma.keyword.upsert({
      where: { value: keyword.value },
      update: keyword,
      create: keyword
    });
  }
}
