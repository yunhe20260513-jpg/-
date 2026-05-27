import { prisma } from "../prisma/client";
import { scoreContractMaturity } from "../services/contractMaturityScoring.service";
import { SignalAdapter, SignalInput } from "./signal.types";

const SOURCE = "contract_maturity_radar";

export class ContractMaturityAdapter implements SignalAdapter {
  type = "contract_maturity" as const;
  source = SOURCE;

  async fetchLatest(): Promise<SignalInput[]> {
    const now = new Date();
    const oldest = new Date(now);
    oldest.setMonth(oldest.getMonth() - 48);
    const newest = new Date(now);
    newest.setMonth(newest.getMonth() - 30);

    const companies = await prisma.companyCache.findMany({
      where: {
        setupDate: { gte: oldest, lte: newest },
        OR: [
          { address: { contains: "桃園" } },
          { address: { contains: "中壢" } },
          { address: { contains: "青埔" } },
          { address: { contains: "南崁" } }
        ]
      },
      orderBy: [{ setupDate: "desc" }],
      take: 1500
    });

    const signals: SignalInput[] = [];
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    for (const company of companies) {
      const existing = await prisma.signal.findFirst({
        where: {
          type: "contract_maturity",
          rawJson: { contains: company.taxId },
          createdAt: { gte: oneYearAgo }
        },
        select: { id: true }
      });
      if (existing) continue;

      const scoring = await scoreContractMaturity(company);
      if (!scoring || scoring.score < 3) continue;

      const url = `https://findbiz.nat.gov.tw/fts/query/QuerySimpleList/QuerySimpleList.xhtml?queryText=${encodeURIComponent(company.taxId)}`;
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`;

      signals.push({
        type: "contract_maturity",
        source: SOURCE,
        title: company.name,
        name: company.name,
        url,
        summary: [
          `成立時間：${company.setupDate?.toISOString().slice(0, 10)}`,
          `推測合約年齡：約 ${scoring.ageMonths} 個月`,
          company.industryName ? `行業：${company.industryName}` : "",
          company.district ? `行政區：${company.district}` : "",
          `priorityScore：${scoring.priorityScore}`,
          scoring.corroboratingSignals.length ? `關聯訊號：${scoring.corroboratingSignals.join("、")}` : "關聯訊號：尚未發現"
        ]
          .filter(Boolean)
          .join("；"),
        publishedAt: company.setupDate ?? undefined,
        fetchedAt: new Date(),
        rawJson: {
          adapter: SOURCE,
          taxId: company.taxId,
          address: company.address,
          district: company.district,
          setupDate: company.setupDate?.toISOString(),
          ageMonths: scoring.ageMonths,
          industryName: company.industryName,
          organizationType: company.organizationType,
          useInvoice: company.useInvoice,
          capitalAmount: company.capitalAmount,
          googleMapsUrl,
          priorityScore: scoring.priorityScore,
          corroboratingSignals: scoring.corroboratingSignals,
          scoring
        }
      });
    }

    if (!signals.length) {
      throw new Error("No Taoyuan contract maturity signals matched the 30-48 month and high-document-industry rules.");
    }

    return signals.sort((a, b) => {
      const aScore = Number((a.rawJson as { priorityScore?: number }).priorityScore ?? 0);
      const bScore = Number((b.rawJson as { priorityScore?: number }).priorityScore ?? 0);
      return bScore - aScore;
    });
  }
}
