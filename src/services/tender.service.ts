import { TenderAdapter } from "../adapters/tender.adapter";
import { prisma } from "../prisma/client";
import { scoreTender, TenderInput } from "./tenderScoring.service";
import { markAdapterFailed, markAdapterRunning, markAdapterSuccess } from "./adapterStatus.service";
import { logger } from "../utils/logger";

let tenderScanInProgress = false;

export async function scanTenders() {
  if (tenderScanInProgress) {
    return { source: "tender", fetched: 0, createdLeadCount: 0, skipped: "scan_in_progress" };
  }

  tenderScanInProgress = true;
  const source = "tender";
  await markAdapterRunning(source);
  const scanLog = await prisma.scanLog.create({ data: { source, status: "running", startedAt: new Date() } });

  try {
    const adapter = new TenderAdapter();
    const tenders = await adapter.fetchLatest();
    let createdLeadCount = 0;

    for (const tender of tenders) {
      if (!isValidTender(tender)) continue;
      const score = scoreTender(tender);
      if (score.score < 3 || score.grade === "C") continue;

      const existing = await prisma.tenderLead.findUnique({ where: { jobNumber: tender.jobNumber } });
      if (existing) continue;

      await prisma.tenderLead.create({
        data: {
          source: tender.source,
          tenderName: tender.tenderName,
          agencyName: tender.agencyName,
          jobNumber: tender.jobNumber,
          announceDate: tender.announceDate,
          deadlineDate: tender.deadlineDate,
          budgetAmount: tender.budgetAmount,
          tenderMethod: tender.tenderMethod,
          procurementType: tender.procurementType,
          url: tender.url,
          rawJson: tender.rawJson ? JSON.stringify(tender.rawJson) : undefined,
          rawScore: score.rawScore,
          score: score.score,
          grade: score.grade,
          matchedKeywords: JSON.stringify(score.matchedKeywords),
          reason: score.reason,
          fetchedAt: tender.fetchedAt ?? new Date()
        }
      });
      createdLeadCount += 1;
    }

    await prisma.scanLog.update({
      where: { id: scanLog.id },
      data: { status: "success", fetchedCount: tenders.length, createdLeadCount, finishedAt: new Date() }
    });
    await markAdapterSuccess(source);
    return { source, fetched: tenders.length, createdLeadCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.scanLog.update({
      where: { id: scanLog.id },
      data: { status: "unavailable", errorMessage: message, finishedAt: new Date() }
    });
    await markAdapterFailed(source, message);
    logger.warn("Tender adapter unavailable", message);
    return { source, fetched: 0, createdLeadCount: 0, error: message };
  } finally {
    tenderScanInProgress = false;
  }
}

function isValidTender(tender: TenderInput) {
  if (!tender.tenderName || !tender.jobNumber || !tender.url) return false;
  try {
    const parsed = new URL(tender.url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
