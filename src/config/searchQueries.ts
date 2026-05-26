import { SourceName } from "../adapters/types";

export type SignalType = "pain" | "switch" | "growth" | "new_business";

export type SearchQueryConfig = {
  source: Exclude<SourceName, "search_engine">;
  site: string;
  terms: string[];
  signalType: SignalType;
};

export const searchQueries: SearchQueryConfig[] = [
  { source: "ptt", site: "ptt.cc", terms: ["桃園", "影印機", "租賃", "推薦"], signalType: "switch" },
  { source: "ptt", site: "ptt.cc", terms: ["桃園", "事務機", "推薦"], signalType: "switch" },
  { source: "ptt", site: "ptt.cc", terms: ["公司", "印表機", "卡紙"], signalType: "pain" },
  { source: "ptt", site: "ptt.cc", terms: ["辦公室", "掃描不能用"], signalType: "pain" },

  { source: "threads", site: "threads.net", terms: ["桃園", "影印機", "租約到期"], signalType: "switch" },
  { source: "threads", site: "threads.net", terms: ["桃園", "想換廠商", "影印機"], signalType: "switch" },
  { source: "threads", site: "threads.net", terms: ["公司", "印表機", "維修太慢"], signalType: "pain" },
  { source: "threads", site: "threads.net", terms: ["診所", "掃描不能用"], signalType: "pain" },

  { source: "dcard", site: "dcard.tw", terms: ["公司", "印表機", "壞掉"], signalType: "pain" },
  { source: "dcard", site: "dcard.tw", terms: ["影印機", "租賃", "推薦"], signalType: "switch" },
  { source: "dcard", site: "dcard.tw", terms: ["補習班", "印表機", "推薦"], signalType: "switch" },

  { source: "mobile01", site: "mobile01.com", terms: ["影印機", "租賃", "桃園"], signalType: "switch" },
  { source: "mobile01", site: "mobile01.com", terms: ["印表機", "列印很慢", "公司"], signalType: "pain" },
  { source: "mobile01", site: "mobile01.com", terms: ["事務機", "維修", "推薦"], signalType: "switch" },

  { source: "facebook", site: "facebook.com", terms: ["桃園", "影印機", "租賃"], signalType: "switch" },
  { source: "facebook", site: "facebook.com", terms: ["桃園", "新診所", "印表機"], signalType: "new_business" },
  { source: "facebook", site: "facebook.com", terms: ["桃園", "新補習班", "辦公室設備"], signalType: "new_business" },
  { source: "facebook", site: "facebook.com", terms: ["搬辦公室", "印表機", "桃園"], signalType: "growth" }
];

export function toSearchQuery(config: SearchQueryConfig) {
  return `site:${config.site} ${config.terms.join(" ")}`;
}
