import { env } from "../config/env";
import { enrichCompanySignal } from "../services/companyEnrichment.service";
import { normalizePublicUrl, searchPublicWeb } from "../services/publicSearch.service";
import { CompanyTaxDataAdapter } from "./companyTaxData.adapter";
import { SignalAdapter, SignalInput } from "./signal.types";

type CompanyCandidateQuery = {
  source: string;
  site: string;
  terms: string[];
  note: string;
};

const allowedHosts: Record<string, string[]> = {
  "facebook.com": ["facebook.com", "www.facebook.com", "m.facebook.com"],
  "threads.net": ["threads.net", "www.threads.net"],
  "dcard.tw": ["dcard.tw", "www.dcard.tw"],
  "ptt.cc": ["ptt.cc", "www.ptt.cc"],
  "google.com/maps": ["www.google.com", "google.com", "maps.google.com"],
  "business.google.com": ["business.google.com", "www.business.google.com"]
};

const candidateQueries: CompanyCandidateQuery[] = [
  { source: "company_opening_search", site: "facebook.com", terms: ["桃園", "新診所", "開幕"], note: "開幕/新商家搜尋" },
  { source: "company_opening_search", site: "facebook.com", terms: ["桃園", "新牙醫", "開幕"], note: "開幕/新商家搜尋" },
  { source: "company_opening_search", site: "facebook.com", terms: ["桃園", "新補習班", "開幕"], note: "開幕/新商家搜尋" },
  { source: "company_opening_search", site: "facebook.com", terms: ["桃園", "新事務所", "開幕"], note: "開幕/新商家搜尋" },
  { source: "company_opening_search", site: "threads.net", terms: ["桃園", "新辦公室", "開幕"], note: "開幕/新辦公室搜尋" },
  { source: "company_opening_search", site: "threads.net", terms: ["桃園", "新門市", "開幕"], note: "開幕/新商家搜尋" },
  { source: "company_opening_search", site: "dcard.tw", terms: ["桃園", "新辦公室", "辦公室設備"], note: "新辦公室搜尋" },
  { source: "company_opening_search", site: "ptt.cc", terms: ["桃園", "新辦公室", "印表機"], note: "新辦公室搜尋" },
  { source: "google_maps_public_search", site: "google.com/maps", terms: ["桃園", "新診所"], note: "Google Maps 公開搜尋結果" },
  { source: "google_maps_public_search", site: "google.com/maps", terms: ["桃園", "新牙醫"], note: "Google Maps 公開搜尋結果" },
  { source: "google_maps_public_search", site: "google.com/maps", terms: ["桃園", "新補習班"], note: "Google Maps 公開搜尋結果" },
  { source: "company_tax_zip_candidate", site: "facebook.com", terms: ["統編", "桃園", "新公司", "診所"], note: "稅籍 ZIP 候選線索替代搜尋" }
];

export class CompanySignalAdapter implements SignalAdapter {
  type = "company" as const;
  source = "company_candidate_sources";

  async fetchLatest(): Promise<SignalInput[]> {
    if (env.COMPANY_OPEN_DATA_MODE === "tax_zip") {
      return new CompanyTaxDataAdapter().fetchLatest();
    }

    const signals = new Map<string, SignalInput>();

    for (const config of candidateQueries) {
      const query = `site:${config.site} ${config.terms.join(" ")}`;
      const results = await searchPublicWeb(query);

      for (const result of results) {
        const url = normalizePublicUrl(result.url);
        if (!url || !isAllowedHost(config.site, url)) continue;

        const baseSignal: SignalInput = {
          type: "company",
          source: config.source,
          title: result.title,
          name: inferCompanyName(result.title),
          url,
          summary: result.snippet,
          publishedAt: result.publishedAt,
          fetchedAt: new Date(),
          rawJson: {
            adapter: "company-candidate-sources",
            candidateStage: "candidate",
            candidateSource: config.note,
            query,
            provider: result.provider,
            terms: config.terms,
            taxId: extractTaxId([result.title, result.snippet, url].join(" ")),
            priorityHints: {
              taoyuan: hasAny([result.title, result.snippet].join(" "), ["桃園", "桃園市"]),
              highValueIndustry: hasAny([result.title, result.snippet].join(" "), highValueTerms),
              recentCandidate: hasAny([result.title, result.snippet].join(" "), ["新開幕", "開幕", "新成立", "新辦公室", "新門市"])
            },
            originalUrl: result.url
          }
        };

        const enriched = await enrichCompanySignal(baseSignal);
        signals.set(enriched.url, enriched);
        if (signals.size >= env.COMPANY_OPEN_DATA_LIMIT) return [...signals.values()];
      }

      await sleep(env.SEARCH_DELAY_MS);
    }

    if (!signals.size) {
      throw new Error("新公司候選來源目前沒有回傳可用真實 URL；不建立假資料。");
    }

    return [...signals.values()];
  }
}

const highValueTerms = [
  "診所",
  "牙醫",
  "補習班",
  "會計師",
  "律師",
  "事務所",
  "房仲",
  "保險",
  "設計公司",
  "工程公司",
  "貿易公司",
  "幼兒園",
  "托嬰中心",
  "工作室",
  "門市"
];

function isAllowedHost(site: string, url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (allowedHosts[site] ?? [site]).includes(host);
  } catch {
    return false;
  }
}

function inferCompanyName(title: string) {
  return title.split(/[｜|-]/)[0]?.trim() || undefined;
}

function extractTaxId(text: string) {
  return text.match(/\b\d{8}\b/)?.[0];
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
