import { prisma } from "../prisma/client";
import { SourcePostInput } from "../adapters/types";
import { contentHash, sha256 } from "../utils/hash";

function effectiveExternalId(input: SourcePostInput) {
  return input.externalId || (input.url ? `url:${sha256(input.url)}` : undefined);
}

export async function findDuplicate(input: SourcePostInput) {
  const externalId = effectiveExternalId(input);
  if (input.isMock) return { id: "mock-data-blocked" };

  if (input.url) {
    const byUrl = await prisma.sourcePost.findFirst({ where: { url: input.url } });
    if (byUrl) return byUrl;
  }

  if (externalId) {
    const byExternalId = await prisma.sourcePost.findUnique({
      where: { source_externalId: { source: input.source, externalId } }
    });
    if (byExternalId) return byExternalId;
  }

  const hash = contentHash(input.content);
  const byContent = await prisma.sourcePost.findFirst({
    where: { source: input.source, contentHash: hash }
  });
  if (byContent) return byContent;

  if (input.url) {
    const urlHash = sha256(input.url);
    return prisma.sourcePost.findFirst({ where: { source: input.source, contentHash: urlHash } });
  }

  return null;
}

export async function createPost(input: SourcePostInput) {
  return prisma.sourcePost.create({
    data: {
      source: input.source,
      externalId: effectiveExternalId(input),
      url: input.url,
      title: input.title,
      authorName: input.authorName,
      content: input.content,
      snippet: input.snippet,
      publishedAt: input.publishedAt,
      rawJson: input.rawJson ? JSON.stringify(input.rawJson) : undefined,
      contentHash: input.content ? contentHash(input.content) : sha256(input.url ?? ""),
      isMock: input.isMock ?? false
    }
  });
}
