import { env } from "../config/env";
import { normalizePublicUrl, searchPublicWeb } from "../services/publicSearch.service";
import { SignalAdapter, SignalInput, SignalType } from "./signal.types";

type SearchSignalQuery = {
  source: string;
  site: string;
  terms: string[];
};

const allowedHosts: Record<string, string[]> = {
  "104.com.tw": ["104.com.tw", "www.104.com.tw"],
  "1111.com.tw": ["1111.com.tw", "www.1111.com.tw"],
  "cakeresume.com": ["cakeresume.com", "www.cakeresume.com"],
  "facebook.com": ["facebook.com", "www.facebook.com", "m.facebook.com"],
  "threads.net": ["threads.net", "www.threads.net"],
  "dcard.tw": ["dcard.tw", "www.dcard.tw"],
  "ptt.cc": ["ptt.cc", "www.ptt.cc"],
  "mobile01.com": ["mobile01.com", "www.mobile01.com"]
};

export class SearchSignalAdapter implements SignalAdapter {
  constructor(
    public type: SignalType,
    public source: string,
    private queries: SearchSignalQuery[]
  ) {}

  async fetchLatest(): Promise<SignalInput[]> {
    const signals = new Map<string, SignalInput>();

    for (const config of this.queries) {
      const query = `site:${config.site} ${config.terms.join(" ")}`;
      const results = await searchPublicWeb(query);
      for (const result of results) {
        const url = normalizePublicUrl(result.url);
        if (!url || !isAllowedHost(config.site, url)) continue;
        signals.set(url, {
          type: this.type,
          source: config.source,
          title: result.title,
          name: inferName(result.title),
          url,
          summary: result.snippet,
          publishedAt: result.publishedAt,
          fetchedAt: new Date(),
          rawJson: {
            adapter: "search-signal",
            query,
            provider: result.provider,
            terms: config.terms,
            originalUrl: result.url
          }
        });
      }
      await sleep(env.SEARCH_DELAY_MS);
    }

    if (!signals.size) {
      throw new Error(`${this.source} 沒有回傳可用真實 URL；不顯示 fake success。`);
    }

    return [...signals.values()];
  }
}

export const hiringSignalQueries: SearchSignalQuery[] = [
  { source: "104", site: "104.com.tw", terms: ["行政", "總務", "新辦公室"] },
  { source: "104", site: "104.com.tw", terms: ["辦公室助理", "採購"] },
  { source: "1111", site: "1111.com.tw", terms: ["行政", "總務"] },
  { source: "CakeResume", site: "cakeresume.com", terms: ["行政", "總務"] }
];

export const moveSignalQueries: SearchSignalQuery[] = [
  { source: "facebook", site: "facebook.com", terms: ["搬辦公室", "新辦公室"] },
  { source: "threads", site: "threads.net", terms: ["新辦公室", "辦公室設備"] },
  { source: "dcard", site: "dcard.tw", terms: ["搬辦公室", "印表機"] },
  { source: "ptt", site: "ptt.cc", terms: ["新辦公室", "事務機"] },
  { source: "facebook", site: "facebook.com", terms: ["新據點", "新分店"] }
];

export const competitorSignalQueries: SearchSignalQuery[] = [
  { source: "threads", site: "threads.net", terms: ["Ricoh", "想換廠商"] },
  { source: "threads", site: "threads.net", terms: ["Canon", "維修很慢"] },
  { source: "dcard", site: "dcard.tw", terms: ["Fuji Xerox", "很雷"] },
  { source: "mobile01", site: "mobile01.com", terms: ["Epson", "掃描不能用"] },
  { source: "facebook", site: "facebook.com", terms: ["Brother", "報修沒人來"] }
];

export const contractSignalQueries: SearchSignalQuery[] = [
  { source: "threads", site: "threads.net", terms: ["租約到期", "影印機"] },
  { source: "dcard", site: "dcard.tw", terms: ["合約快到", "事務機"] },
  { source: "facebook", site: "facebook.com", terms: ["想換廠商", "影印機"] },
  { source: "ptt", site: "ptt.cc", terms: ["影印機租賃推薦"] },
  { source: "mobile01", site: "mobile01.com", terms: ["哪家租影印機好"] }
];

function isAllowedHost(site: string, url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (allowedHosts[site] ?? [site]).includes(host);
  } catch {
    return false;
  }
}

function inferName(title: string) {
  return title.split(/[｜|-]/)[0]?.trim() || undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
