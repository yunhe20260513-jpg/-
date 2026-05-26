import { SourcePostInput } from "../adapters/types";

export type VerifiedPost = SourcePostInput & {
  verification: {
    status: "verified";
    fetchedAt: string;
    title?: string;
    detectedPublishedAt?: string;
    contentLength: number;
  };
};

export async function verifyPublicPage(input: SourcePostInput): Promise<VerifiedPost | null> {
  if (!input.url) return null;

  const response = await fetch(input.url, {
    headers: {
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.6",
      cookie: input.source === "ptt" ? "over18=1" : "",
      "user-agent": "Mozilla/5.0 YunheOfficeLeadRadar/0.1"
    },
    redirect: "follow"
  }).catch(() => null);

  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;

  const html = await response.text();
  const title = extractTitle(html);
  const description = extractMeta(html, ["description", "og:description", "twitter:description"]);
  const detectedPublishedAt = extractPublishedAt(html);
  const articleText = extractReadableText(html);
  const mergedContent = [
    title ? `Title: ${title}` : "",
    description ? `Description: ${description}` : "",
    articleText || input.content
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3000);

  if (mergedContent.length < 20) return null;

  return {
    ...input,
    title: input.title ?? title,
    snippet: input.snippet ?? description,
    content: mergedContent,
    publishedAt: input.publishedAt ?? detectedPublishedAt,
    rawJson: {
      ...(typeof input.rawJson === "object" && input.rawJson ? input.rawJson : {}),
      pageVerification: {
        status: "verified",
        fetchedAt: new Date().toISOString(),
        title,
        detectedPublishedAt: detectedPublishedAt?.toISOString(),
        contentLength: mergedContent.length
      }
    },
    verification: {
      status: "verified",
      fetchedAt: new Date().toISOString(),
      title,
      detectedPublishedAt: detectedPublishedAt?.toISOString(),
      contentLength: mergedContent.length
    }
  };
}

function extractTitle(html: string) {
  return cleanText(
    extractMeta(html, ["og:title", "twitter:title"]) ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      ""
  );
}

function extractMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return cleanText(match[1]);
    }
  }
  return undefined;
}

function extractPublishedAt(html: string) {
  const metaDate = extractMeta(html, [
    "article:published_time",
    "pubdate",
    "publishdate",
    "date",
    "dc.date",
    "dc.date.issued"
  ]);
  const timeDate = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i)?.[1];
  const parsed = parseDate(metaDate || timeDate || "");
  if (parsed) return parsed;

  const pttDate = cleanText(
    html.match(/<span class="article-meta-tag">[^<]*<\/span>\s*<span class="article-meta-value">([^<]*(?:20\d{2}|19\d{2})[^<]*)<\/span>/i)?.[1] ??
      ""
  );
  return parseDate(pttDate);
}

function extractReadableText(html: string) {
  const mainContent = html.match(/<div id="main-content"[^>]*>([\s\S]*?)(?:<div id="article-polling"|<script|<\/body>)/i)?.[1];
  const source = mainContent || html;
  return cleanText(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<div class="push">[\s\S]*?<\/div>/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--") && line.charCodeAt(0) !== 8251)
    .join("\n")
    .slice(0, 2500);
}

function parseDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
