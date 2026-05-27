import { tenderKeywords, TenderInput } from "../services/tenderScoring.service";

type AnyRecord = Record<string, unknown>;

const API_BASE = "https://pcc.g0v.ronny.tw";
const PUBLIC_VIEWER_BASE = "https://ronnywang.github.io/pcc-viewer/tender.html";

export class TenderAdapter {
  source = "tender" as const;
  private reachable = false;

  async fetchLatest(): Promise<TenderInput[]> {
    const tenders = new Map<string, TenderInput>();

    for (const keyword of tenderKeywords) {
      const result = await fetchKeyword(keyword);
      if (result.reachable) this.reachable = true;
      for (const row of result.rows) {
        const tender = normalizeTender(row, keyword);
        if (!tender) continue;
        tenders.set(tender.jobNumber, tender);
      }
    }

    if (!this.reachable) {
      throw new Error("pcc.g0v.ronny.tw API unavailable or returned no parseable JSON");
    }

    return [...tenders.values()];
  }
}

async function fetchKeyword(keyword: string): Promise<{ reachable: boolean; rows: AnyRecord[] }> {
  const urls = buildCandidateUrls(keyword);
  let reachable = false;

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 (compatible; YunheTenderRadar/1.0)"
      }
    }).catch(() => null);

    if (!response || !response.ok) continue;
    reachable = true;
    const text = await response.text();
    const parsed = parseJson(text);
    const rows = extractRows(parsed);
    if (rows.length) return { reachable, rows };
  }

  return { reachable, rows: [] };
}

function buildCandidateUrls(keyword: string) {
  const query = encodeURIComponent(keyword);
  return [
    `${API_BASE}/api/tender?query=${query}`,
    `${API_BASE}/api/tender?keyword=${query}`,
    `${API_BASE}/api/tender?search=${query}`,
    `${API_BASE}/api/search?query=${query}`,
    `${API_BASE}/api/search?keyword=${query}`
  ];
}

function normalizeTender(row: AnyRecord, keyword: string): TenderInput | null {
  const tenderName = pickString(row, ["標案名稱", "tenderName", "name", "subject", "title", "標的名稱"]);
  const jobNumber = pickString(row, ["標案編號", "jobNumber", "job_number", "案號", "tenderId", "unit_id"]);
  const url = normalizeUrl(pickString(row, ["url", "標案URL", "detailUrl", "detail_url", "link", "公告URL"]), jobNumber);

  if (!tenderName || !jobNumber || !url) return null;

  return {
    source: "pcc.g0v.ronny.tw",
    tenderName,
    agencyName: pickString(row, ["機關名稱", "agencyName", "unit_name", "unitName", "機關"]),
    jobNumber,
    announceDate: parseTaiwanDate(pickString(row, ["公告日期", "announceDate", "date", "tenderDate", "招標公告日期"])),
    deadlineDate: parseTaiwanDate(pickString(row, ["截止投標日期", "deadlineDate", "截止日期", "投標截止日期", "endDate"])),
    budgetAmount: parseBudget(pickValue(row, ["預算金額", "budgetAmount", "budget", "預算", "採購金額"])),
    tenderMethod: pickString(row, ["招標方式", "tenderMethod", "method"]),
    procurementType: pickString(row, ["採購性質", "procurementType", "type", "標的分類"]),
    url,
    fetchedAt: new Date(),
    rawJson: { keyword, row }
  };
}

function extractRows(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ["records", "data", "items", "tenders", "rows", "result"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

function pickString(row: AnyRecord, keys: string[]) {
  const value = pickValue(row, keys);
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function pickValue(row: AnyRecord, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function normalizeUrl(value: string | undefined, jobNumber: string | undefined) {
  if (value && isHttpUrl(value)) return value;
  if (!jobNumber) return undefined;
  return `${PUBLIC_VIEWER_BASE}?job_number=${encodeURIComponent(jobNumber)}`;
}

function parseBudget(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseTaiwanDate(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim();
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = normalized.match(/(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (!match) return undefined;
  const year = Number(match[1]) + 1911;
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
