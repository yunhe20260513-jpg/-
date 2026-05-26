import { PlatformAdapter, SourcePostInput } from "./types";

type PttListItem = {
  title: string;
  url: string;
  authorName?: string;
  dateText?: string;
};

const PTT_BASE_URL = "https://www.ptt.cc";
const BOARDS = ["Printer_scan", "Office", "SOHO"];
const MAX_ARTICLES_PER_BOARD = 12;

export class PttAdapter implements PlatformAdapter {
  source = "ptt" as const;

  async fetchLatest(): Promise<SourcePostInput[]> {
    const posts: SourcePostInput[] = [];
    let reachableBoards = 0;

    for (const board of BOARDS) {
      const listHtml = await fetchPttText(`${PTT_BASE_URL}/bbs/${board}/index.html`).catch(() => "");
      if (!listHtml) continue;
      reachableBoards += 1;

      const listItems = parseListItems(listHtml).slice(0, MAX_ARTICLES_PER_BOARD);
      for (const item of listItems) {
        const article = await fetchArticle(item).catch(() => null);
        if (article) posts.push(article);
      }
    }

    if (!reachableBoards) throw new Error("PTT 看板無法連線或被擋，未取得真實文章。");
    if (!posts.length) throw new Error("PTT 看板可連線，但沒有解析到真實文章。");

    return posts;
  }
}

async function fetchPttText(url: string) {
  const response = await fetch(url, {
    headers: {
      cookie: "over18=1",
      "user-agent": "Mozilla/5.0 YunheOfficeLeadRadar/0.1"
    }
  });

  if (!response.ok) return "";
  return response.text();
}

function parseListItems(html: string): PttListItem[] {
  const items: PttListItem[] = [];
  const blocks = html.split('<div class="r-ent">').slice(1);

  for (const rawBlock of blocks) {
    const block = rawBlock.split('<div class="r-list-sep">')[0];
    const linkMatch = block.match(/<div class="title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const title = cleanText(linkMatch[2]);
    if (!href || !title || !href.startsWith("/bbs/")) continue;

    const authorName = cleanText(block.match(/<div class="author">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const dateText = cleanText(block.match(/<div class="date">([\s\S]*?)<\/div>/)?.[1] ?? "");

    items.push({
      title,
      url: `${PTT_BASE_URL}${href}`,
      authorName: authorName || undefined,
      dateText: dateText || undefined
    });
  }

  return items;
}

async function fetchArticle(item: PttListItem): Promise<SourcePostInput | null> {
  if (!item.url.startsWith(`${PTT_BASE_URL}/bbs/`)) return null;

  const html = await fetchPttText(item.url);
  if (!html) return null;

  const mainContentHtml = getMainContentHtml(html);
  if (!mainContentHtml) return null;

  const metaValues = [...mainContentHtml.matchAll(/<span class="article-meta-value">([\s\S]*?)<\/span>/g)].map((match) =>
    cleanText(match[1])
  );

  const authorName = metaValues[0] || item.authorName;
  const title = metaValues[2] || item.title;
  const dateRaw = metaValues[3] || item.dateText || "";
  const content = extractArticleText(mainContentHtml);
  const summary = content.length > 500 ? `${content.slice(0, 500)}...` : content;
  const externalId = new URL(item.url).pathname.replace("/bbs/", "").replace(".html", "");

  return {
    source: "ptt",
    externalId,
    url: item.url,
    authorName,
    title,
    snippet: summary.slice(0, 240),
    content: [`標題：${title}`, summary].filter(Boolean).join("\n\n"),
    publishedAt: parsePttDate(dateRaw, item.dateText),
    isMock: false,
    rawJson: {
      url: item.url,
      title,
      dateRaw,
      adapter: "ptt-real"
    }
  };
}

function getMainContentHtml(html: string) {
  const start = html.indexOf('<div id="main-content"');
  if (start < 0) return "";

  const contentStart = html.indexOf(">", start);
  if (contentStart < 0) return "";

  const pollingStart = html.indexOf('<div id="article-polling"', contentStart);
  const scriptStart = html.indexOf("<script", contentStart);
  const endCandidates = [pollingStart, scriptStart].filter((index) => index > contentStart);
  const end = endCandidates.length ? Math.min(...endCandidates) : html.length;

  return html.slice(contentStart + 1, end);
}

function extractArticleText(mainContentHtml: string) {
  const withoutMeta = mainContentHtml
    .replace(/<div class="article-metaline[^>]*>[\s\S]*?<\/div>/g, "")
    .replace(/<div class="article-metaline-right[^>]*>[\s\S]*?<\/div>/g, "")
    .replace(/<div class="push">[\s\S]*?<\/div>/g, "");

  return cleanText(withoutMeta)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--") && line.charCodeAt(0) !== 8251)
    .join("\n")
    .slice(0, 2000);
}

function parsePttDate(dateRaw?: string, fallbackDateText?: string) {
  if (dateRaw) {
    const parsed = new Date(dateRaw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (fallbackDateText) {
    const match = fallbackDateText.match(/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const now = new Date();
      const parsed = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]));
      if (parsed.getTime() > now.getTime()) parsed.setFullYear(now.getFullYear() - 1);
      return parsed;
    }
  }

  return undefined;
}

function cleanText(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
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
