import { TenderAdapter } from "./tender.adapter";
import { SignalAdapter, SignalInput } from "./signal.types";

export class TenderSignalAdapter implements SignalAdapter {
  type = "tender" as const;
  source = "pcc.g0v.ronny.tw";

  async fetchLatest(): Promise<SignalInput[]> {
    const tenders = await new TenderAdapter().fetchLatest();
    return tenders.map((tender) => ({
      type: "tender",
      source: tender.source,
      title: tender.tenderName,
      name: tender.agencyName,
      url: tender.url,
      summary: [
        tender.agencyName ? `機關：${tender.agencyName}` : "",
        tender.jobNumber ? `標案編號：${tender.jobNumber}` : "",
        tender.budgetAmount ? `預算：${tender.budgetAmount}` : "",
        tender.deadlineDate ? `截止：${tender.deadlineDate.toISOString()}` : ""
      ]
        .filter(Boolean)
        .join("；"),
      publishedAt: tender.announceDate,
      fetchedAt: tender.fetchedAt,
      rawJson: tender.rawJson
    }));
  }
}
