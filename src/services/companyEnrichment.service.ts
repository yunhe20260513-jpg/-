import { SignalInput } from "../adapters/signal.types";
import { env } from "../config/env";

type FiaBusinessRegistration = {
  ban?: string;
  businessAddress?: string;
  businessNm?: string;
  capitalAmount?: number | string;
  businessSetupDate?: string;
  businessType?: string;
  isUseInvoice?: string | boolean;
  industryCd?: string;
  industryNm?: string;
  industryCd1?: string;
  industryNm1?: string;
  industryCd2?: string;
  industryNm2?: string;
  industryCd3?: string;
  industryNm3?: string;
};

export async function enrichCompanySignal(candidate: SignalInput): Promise<SignalInput> {
  const taxId = extractTaxId(candidate);
  if (!taxId) return candidate;

  const detail = await fetchFiaBusinessRegistration(taxId).catch(() => null);
  if (!detail) return withEnrichmentStatus(candidate, taxId, "fia_failed");

  const setupDate = parseTaiwanDate(detail.businessSetupDate);
  const industryNm = detail.industryNm || detail.industryNm1 || detail.industryNm2 || detail.industryNm3;
  const summary = [
    detail.ban ? `統編：${detail.ban}` : `統編：${taxId}`,
    detail.businessAddress ? `營業地址：${detail.businessAddress}` : "",
    detail.businessSetupDate ? `設立日期：${formatTaiwanDate(detail.businessSetupDate)}` : "",
    detail.capitalAmount ? `資本額：${detail.capitalAmount}` : "",
    detail.businessType ? `組織型態：${detail.businessType}` : "",
    detail.isUseInvoice !== undefined ? `使用統一發票：${String(detail.isUseInvoice)}` : "",
    industryNm ? `行業：${industryNm}` : "",
    candidate.summary ?? ""
  ]
    .filter(Boolean)
    .join("；");

  return {
    ...candidate,
    title: detail.businessNm || candidate.title,
    name: detail.businessNm || candidate.name,
    summary,
    publishedAt: setupDate ?? candidate.publishedAt,
    rawJson: {
      ...asRecord(candidate.rawJson),
      taxId,
      fia: {
        status: "success",
        businessAddress: detail.businessAddress,
        businessNm: detail.businessNm,
        capitalAmount: detail.capitalAmount,
        businessSetupDate: detail.businessSetupDate,
        businessType: detail.businessType,
        isUseInvoice: detail.isUseInvoice,
        industryCd: detail.industryCd || detail.industryCd1 || detail.industryCd2 || detail.industryCd3,
        industryNm,
        raw: detail
      }
    }
  };
}

async function fetchFiaBusinessRegistration(taxId: string): Promise<FiaBusinessRegistration | null> {
  const base = env.FIA_BUSINESS_REGISTRATION_ENDPOINT.replace(/\/$/, "");
  const response = await fetch(`${base}/${encodeURIComponent(taxId)}`, {
    headers: {
      accept: "application/json",
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.6",
      "user-agent": "Mozilla/5.0 (compatible; YunheCompanyEnrichment/1.0)"
    }
  });

  if (!response.ok) return null;
  const parsed = await response.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") return null;
  return normalizeFiaPayload(parsed);
}

function normalizeFiaPayload(payload: object): FiaBusinessRegistration | null {
  if (Array.isArray(payload)) return payload[0] && typeof payload[0] === "object" ? (payload[0] as FiaBusinessRegistration) : null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    const first = record.data[0];
    return first && typeof first === "object" ? (first as FiaBusinessRegistration) : null;
  }
  if (Array.isArray(record.result)) {
    const first = record.result[0];
    return first && typeof first === "object" ? (first as FiaBusinessRegistration) : null;
  }
  return payload as FiaBusinessRegistration;
}

function extractTaxId(candidate: SignalInput) {
  const raw = asRecord(candidate.rawJson);
  const direct = raw.taxId || raw.ban || raw.Business_Accounting_NO;
  if (direct && /^\d{8}$/.test(String(direct))) return String(direct);
  const text = [candidate.title, candidate.name, candidate.summary, candidate.url].filter(Boolean).join(" ");
  return text.match(/\b\d{8}\b/)?.[0];
}

function withEnrichmentStatus(candidate: SignalInput, taxId: string, status: string): SignalInput {
  return {
    ...candidate,
    rawJson: {
      ...asRecord(candidate.rawJson),
      taxId,
      fia: { status }
    }
  };
}

function parseTaiwanDate(value: string | undefined) {
  if (!value) return undefined;
  const clean = value.trim();
  if (/^\d{7}$/.test(clean)) {
    return new Date(Number(clean.slice(0, 3)) + 1911, Number(clean.slice(3, 5)) - 1, Number(clean.slice(5, 7)));
  }
  if (/^\d{8}$/.test(clean)) {
    return new Date(Number(clean.slice(0, 4)), Number(clean.slice(4, 6)) - 1, Number(clean.slice(6, 8)));
  }
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatTaiwanDate(value: string) {
  const parsed = parseTaiwanDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
