import { prisma } from "../prisma/client";

export async function getActiveBlacklistKeywords() {
  return prisma.blacklistKeyword.findMany({ where: { isActive: true }, orderBy: { value: "asc" } });
}

export async function isBlacklisted(content: string) {
  const keywords = await getActiveBlacklistKeywords();
  return keywords.some((keyword) => content.includes(keyword.value));
}
