import { ensureCompanyCacheFresh, getRecentTaoyuanCompanies } from "../services/companyCache.service";
import { scoreCompanyCache } from "../services/companyScoring.service";
import { env } from "../config/env";
import { SignalInput } from "./signal.types";

const GCIS_RULE_URL = "https://data.gcis.nat.gov.tw/od/rule";

export class CompanyTaxDataAdapter {
  source = "company_tax_zip";

  async fetchLatest(): Promise<SignalInput[]> {
    await ensureCompanyCacheFresh();
    const companies = await getRecentTaoyuanCompanies(180);

    if (!companies.length) {
      throw new Error("CompanyCache 沒有桃園最近 180 天新成立公司；不建立假資料。");
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
          `統編：${company.taxId}`,
          `地址：${company.address}`,
          company.district ? `行政區：${company.district}` : "",
          company.setupDate ? `設立日期：${company.setupDate.toISOString().slice(0, 10)}` : "",
          industryName ? `行業：${industryName}` : "",
          company.capitalAmount ? `資本額：${Number(company.capitalAmount).toLocaleString("zh-TW")}` : "",
          company.organizationType ? `組織：${company.organizationType}` : "",
          company.useInvoice ? `統一發票：${company.useInvoice}` : ""
        ]
          .filter(Boolean)
          .join("；"),
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

    if (!scoredSignals.length) throw new Error("CompanyCache 有資料，但沒有符合 B 級以上的桃園新公司；不建立低分垃圾資料。");
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
    const industryName = row["名稱"];
    return typeof industryName === "string" ? industryName : undefined;
  } catch {
    return undefined;
  }
}
