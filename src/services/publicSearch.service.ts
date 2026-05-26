import { env } from "../config/env";

export type PublicSearchProvider = "bing" | "google";

export type PublicSearchResult = {
  title: string;
  url: string;
  snippet: string;
  query: string;
  provider: PublicSearchProvider;
  publishedAt?: Date;
};

export async function searchPublicWeb(query: string): Promise<PublicSearchResult[]> {
  const primary = env.SEARCH_PROVIDER;
  const secondary: PublicSearchProvider = primary === "bing" ? "google" : "bing";
  const first = await fetchAndParse(primary, query).catch(() => []);
  if (first.length > 0) return first;
  return fetchAndParse(secondary, query).catch(() => []);
}

export function normalizePublicUrl(url: string) {
  try {
    const parsed = new URL(decodeSearchUrl(url));
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igshid)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

async function fetchAndParse(provider: PublicSearchProvider, query: string) {
  const url =
    provider === "bing"
      ? `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}&count=${env.SEARCH_RESULTS_PER_QUERY}&setlang=zh-Hant`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${env.SEARCH_RESULTS_PER_QUERY}&hl=zh-TW`;

  const response = await fetch(url, {
    headers: {
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.6",
      "user-agent": "Mozilla/5.0 (compatible; YunheSignalRadar/1.0)"
    }
  });

  if (!response.ok) return [];
  const text = await response.text();
  return provider === "bing" ? parseBing(text, query) : parseGoogle(text, query);
}

function parseBing(xmlOrHtml: string, query: string): PublicSearchResult[] {
  const rssResults = parseBingRss(xmlOrHtml, query);
  if (rssResults.length) return rssResults;

  const results: PublicSearchResult[] = [];
  for (const rawBlock of xmlOrHtml.split('<li class="b_algo"').slice(1)) {
    const block = rawBlock.split("</li>")[0];
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const url = normalizePublicUrl(decodeHtml(linkMatch[1]));
    if (!isHttpUrl(url)) continue;
    results.push({
      title: cleanText(linkMatch[2]) || url,
      url,
      snippet: cleanText(block.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""),
      query,
      provider: "bing"
    });
  }
  return results;
}

function parseBingRss(xml: string, query: string): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  for (const rawItem of xml.split("<item>").slice(1)) {
    const item = rawItem.split("</item>")[0];
    const title = cleanText(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = normalizePublicUrl(decodeHtml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim());
    const snippet = cleanText(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
    const publishedAt = parseDate(cleanText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ""));
    if (title && isHttpUrl(url)) results.push({ title, url, snippet, query, provider: "bing", publishedAt });
  }
  return results;
}

function parseGoogle(html: string, query: string): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  for (const rawBlock of html.split("<a ").slice(1)) {
    const href = rawBlock.match(/href="([^"]+)"/)?.[1];
    if (!href) continue;
    const url = normalizePublicUrl(decodeHtml(href));
    if (!isHttpUrl(url)) continue;
    const title = cleanText(rawBlock.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "") || url;
    results.push({ title, url, snippet: title, query, provider: "google" });
  }
  return results;
}

function decodeSearchUrl(url: string) {
  if (url.startsWith("/url?")) {
    const parsed = new URL(`https://www.google.com${url}`);
    return parsed.searchParams.get("q") ?? url;
  }
  if (url.includes("bing.com/ck/a")) {
    try {
      const parsed = new URL(url);
      const encoded = parsed.searchParams.get("u");
      if (encoded?.startsWith("a1")) return Buffer.from(encoded.slice(2), "base64url").toString("utf8");
    } catch {
      return url;
    }
  }
  return url;
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function cleanText(html: string) {
  return decodeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
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

function parseDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
