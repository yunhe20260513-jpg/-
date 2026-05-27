import { env } from "../config/env";
import { ensureCompanyCacheFresh, getRecentTaoyuanCompanies } from "../services/companyCache.service";
import { scoreCompanyCache } from "../services/companyScoring.service";
import { SignalInput } from "./signal.types";

const GCIS_RULE_URL = "https://data.gcis.nat.gov.tw/od/rule";

export class CompanyTaxDataAdapter {
  source = "company_tax_zip";

  async fetchLatest(): Promise<SignalInput[]> {
    if (env.COMPANY_BASELINE_IMPORT) {
      throw new Error("COMPANY_BASELINE_IMPORT=true; company baseline cache import is protected from Signal generation.");
    }

    await ensureCompanyCacheFresh();
    const companies = await getRecentTaoyuanCompanies(180);

    if (!companies.length) {
      throw new Error("CompanyCache has no Taoyuan companies within the last 180 days.");
    }

    const scoredSignals: Array<{ signal: SignalInput; rawScore: number; score: number }> = [];
    for (const company of companies) {
      const industryName = company.industryName || inferIndustryName(company.rawJson);
      const scoring = scoreCompanyCache({ ...company, industryName });
      if (scoring.score < 3 || scoring.grade === "C") continue;

      const googleCompanyUrl = `https://www.google.com/search?q=${encodeURIComponent(company.name)}`;
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`;

      scoredSignals.push({
        rawScore: scoring.rawScore,
        score: scoring.score,
        signal: {
          type: "company",
          source: this.source,
          title: company.name,
          name: company.name,
          url: googleCompanyUrl,
          summary: [
            `\u7d71\u7de8\uff1a${company.taxId}`,
            `\u5730\u5740\uff1a${company.address}`,
            company.district ? `\u884c\u653f\u5340\uff1a${company.district}` : "",
            company.setupDate ? `\u8a2d\u7acb\u65e5\u671f\uff1a${company.setupDate.toISOString().slice(0, 10)}` : "",
            industryName ? `\u884c\u696d\uff1a${industryName}` : "",
            company.capitalAmount ? `\u8cc7\u672c\u984d\uff1a${Number(company.capitalAmount).toLocaleString("zh-TW")}` : "",
            company.organizationType ? `\u7d44\u7e54\uff1a${company.organizationType}` : "",
            company.useInvoice ? `\u7d71\u4e00\u767c\u7968\uff1a${company.useInvoice}` : ""
          ]
            .filter(Boolean)
            .join("\uff1b"),
          publishedAt: company.setupDate ?? undefined,
          fetchedAt: new Date(),
          rawJson: {
            adapter: "company-tax-data",
            taxId: company.taxId,
            address: company.address,
            city: company.city,
            district: company.district,
            setupDate: company.setupDate?.toISOString(),
            organizationType: company.organizationType,
            useInvoice: company.useInvoice,
            industryCode: company.industryCode,
            industryName,
            capitalAmount: company.capitalAmount,
            source: company.source,
            sourceUrl: company.sourceUrl,
            companySourcePage: `${GCIS_RULE_URL}?q=${encodeURIComponent(company.taxId)}`,
            googleCompanyUrl,
            googleMapsUrl,
            scoring
          }
        }
      });
    }

    if (!scoredSignals.length) {
      throw new Error("CompanyCache has no score >= 3 Taoyuan company signals.");
    }

    return scoredSignals
      .sort((a, b) => b.score - a.score || b.rawScore - a.rawScore)
      .slice(0, env.COMPANY_OPEN_DATA_LIMIT)
      .map((item) => item.signal);
  }
}

function inferIndustryName(rawJson: string | null) {
  if (!rawJson) return undefined;
  try {
    const row = JSON.parse(rawJson) as Record<string, unknown>;
    const industryName = row["\u884c\u696d\u540d\u7a31"] ?? row["\u884c\u696d\u540d\u7a311"];
    return typeof industryName === "string" ? industryName : undefined;
  } catch {
    return undefined;
  }
}
