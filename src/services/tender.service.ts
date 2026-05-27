import { TenderAdapter } from "../adapters/tender.adapter";
import { prisma } from "../prisma/client";
import { scoreTender, TenderInput } from "./tenderScoring.service";
import { markAdapterFailed, markAdapterNoResult, markAdapterRunning, markAdapterSuccess } from "./adapterStatus.service";
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
          rawJson: JSON.stringify({ ...(typeof tender.rawJson === "object" && tender.rawJson ? tender.rawJson : {}), intentType: score.intentType }),
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

    const finalStatus = createdLeadCount > 0 ? "success" : "no_result";
    const noResultMessage = createdLeadCount > 0 ? undefined : "標案 API 可用，但沒有建立符合 OA 直接需求或前置需求的標案。";

    await prisma.scanLog.update({
      where: { id: scanLog.id },
      data: { status: finalStatus, fetchedCount: tenders.length, createdLeadCount, finishedAt: new Date(), errorMessage: noResultMessage }
    });
    if (createdLeadCount > 0) {
      await markAdapterSuccess(source);
    } else {
      await markAdapterNoResult(source, noResultMessage);
    }
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
