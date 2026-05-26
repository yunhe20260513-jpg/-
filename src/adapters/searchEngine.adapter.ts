import { searchQueries, toSearchQuery } from "../config/searchQueries";
import { env } from "../config/env";
import { sha256 } from "../utils/hash";
import { PlatformAdapter, SourceName, SourcePostInput } from "./types";

type SearchProvider = "bing" | "google";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  query: string;
  provider: SearchProvider;
  publishedAt?: Date;
};

const ALLOWED_HOSTS: Record<Exclude<SourceName, "search_engine">, string[]> = {
  threads: ["threads.net", "www.threads.net"],
  dcard: ["dcard.tw", "www.dcard.tw"],
  ptt: ["ptt.cc", "www.ptt.cc"],
  mobile01: ["mobile01.com", "www.mobile01.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"]
};

export class SearchEngineAdapter implements PlatformAdapter {
  source = "search_engine" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    const results = new Map<string, SourcePostInput>();

    for (const config of searchQueries) {
      const query = toSearchQuery(config);
      const found = await search(query);

      for (const result of found) {
        const url = normalizeUrl(result.url);
        if (!url || !isAllowedSourceUrl(config.source, url)) continue;

        results.set(`${config.source}:${url}`, {
          source: config.source,
          externalId: url,
          url,
          title: result.title,
          snippet: result.snippet,
          content: [`標題：${result.title}`, `摘要：${result.snippet}`].filter(Boolean).join("\n\n"),
          publishedAt: result.publishedAt,
          isMock: false,
          rawJson: {
            adapter: "search-engine",
            provider: result.provider,
            query: result.query,
            signalType: config.signalType,
            title: result.title,
            snippet: result.snippet,
            originalUrl: result.url
          }
        });
      }

      await sleep(env.SEARCH_DELAY_MS);
    }

    if (!results.size) {
      throw new Error("公開搜尋結果沒有回傳任何符合平台與 URL 條件的資料；不顯示 fake success。");
    }

    return [...results.values()];
  }
}

async function search(query: string) {
  const primary = env.SEARCH_PROVIDER;
  const secondary: SearchProvider = primary === "bing" ? "google" : "bing";
  const first = await fetchAndParse(primary, query).catch(() => []);
  if (first.length > 0) return first;
  return fetchAndParse(secondary, query).catch(() => []);
}

async function fetchAndParse(provider: SearchProvider, query: string) {
  const url =
    provider === "bing"
      ? `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}&count=${env.SEARCH_RESULTS_PER_QUERY}&setlang=zh-Hant`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${env.SEARCH_RESULTS_PER_QUERY}&hl=zh-TW`;

  const response = await fetch(url, {
    headers: {
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.6",
      "user-agent": "Mozilla/5.0 (compatible; YunheOfficeLeadRadar/1.0)"
    }
  });

  if (!response.ok) return [];
  const text = await response.text();
  return provider === "bing" ? parseBing(text, query) : parseGoogle(text, query);
}

function parseBing(xmlOrHtml: string, query: string): SearchResult[] {
  const rssResults = parseBingRss(xmlOrHtml, query);
  if (rssResults.length) return rssResults;

  const results: SearchResult[] = [];
  for (const rawBlock of xmlOrHtml.split('<li class="b_algo"').slice(1)) {
    const block = rawBlock.split("</li>")[0];
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const url = decodeSearchUrl(decodeHtml(linkMatch[1]));
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

function parseBingRss(xml: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const rawItem of xml.split("<item>").slice(1)) {
    const item = rawItem.split("</item>")[0];
    const title = cleanText(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = decodeSearchUrl(decodeHtml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim());
    const snippet = cleanText(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
    const publishedAt = parseDate(cleanText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ""));
    if (title && isHttpUrl(url)) results.push({ title, url, snippet, query, provider: "bing", publishedAt });
  }
  return results;
}

function parseGoogle(html: string, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const rawBlock of html.split("<a ").slice(1)) {
    const href = rawBlock.match(/href="([^"]+)"/)?.[1];
    if (!href) continue;
    const url = decodeSearchUrl(decodeHtml(href));
    if (!isHttpUrl(url)) continue;
    const title = cleanText(rawBlock.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "") || url;
    results.push({ title, url, snippet: title, query, provider: "google" });
  }
  return results;
}

function isAllowedSourceUrl(source: Exclude<SourceName, "search_engine">, url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS[source].includes(host);
  } catch {
    return false;
  }
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igshid)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return "";
  }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
