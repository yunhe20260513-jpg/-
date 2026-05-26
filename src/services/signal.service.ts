import { CompanySignalAdapter } from "../adapters/companySignal.adapter";
import { SearchSignalAdapter, competitorSignalQueries, contractSignalQueries, hiringSignalQueries, moveSignalQueries } from "../adapters/searchSignal.adapter";
import { SignalAdapter, SignalInput } from "../adapters/signal.types";
import { TenderSignalAdapter } from "../adapters/tenderSignal.adapter";
import { prisma } from "../prisma/client";
import { markAdapterFailed, markAdapterRunning, markAdapterSuccess } from "./adapterStatus.service";
import { isBlacklisted } from "./blacklist.service";
import { scoreSignal } from "./signalScoring.service";

const signalAdapters: SignalAdapter[] = [
  new TenderSignalAdapter(),
  new CompanySignalAdapter(),
  new SearchSignalAdapter("hiring", "public_hiring_search", hiringSignalQueries),
  new SearchSignalAdapter("move", "public_move_search", moveSignalQueries),
  new SearchSignalAdapter("competitor", "public_competitor_search", competitorSignalQueries),
  new SearchSignalAdapter("contract", "public_contract_search", contractSignalQueries)
];

let signalScanInProgress = false;

export async function scanSignals() {
  if (signalScanInProgress) {
    return [{ source: "signals", fetched: 0, createdLeadCount: 0, skipped: "scan_in_progress" }];
  }

  signalScanInProgress = true;
  try {
    const results = [];
    for (const adapter of signalAdapters) {
      results.push(await scanSignalAdapter(adapter));
    }
    return results;
  } finally {
    signalScanInProgress = false;
  }
}

export async function scanSignalsByType(type: string) {
  const adapter = signalAdapters.find((item) => item.type === type);
  if (!adapter) throw new Error(`Unknown signal type: ${type}`);
  return scanSignalAdapter(adapter);
}

async function scanSignalAdapter(adapter: SignalAdapter) {
  const source = `signal_${adapter.type}`;
  await markAdapterRunning(source);
  const scanLog = await prisma.scanLog.create({ data: { source, status: "running", startedAt: new Date() } });

  try {
    const inputs = await adapter.fetchLatest();
    let createdLeadCount = 0;
    for (const input of inputs) {
      if (!isValidSignal(input)) continue;
      if (await isBlacklisted([input.title, input.name, input.summary].filter(Boolean).join("\n"))) continue;
      const scoring = scoreSignal(input);
      if (scoring.score < 3 || scoring.grade === "C") continue;

      const existing = await prisma.signal.findUnique({ where: { type_url: { type: input.type, url: input.url } } });
      if (existing) continue;

      await prisma.signal.create({
        data: {
          type: input.type,
          source: input.source,
          title: input.title,
          name: input.name,
          url: input.url,
          summary: input.summary,
          rawJson: input.rawJson ? JSON.stringify(input.rawJson) : undefined,
          rawScore: scoring.rawScore,
          score: scoring.score,
          grade: scoring.grade,
          matchedKeywords: JSON.stringify(scoring.matchedKeywords),
          reason: scoring.reason,
          suggestedAction: scoring.suggestedAction,
          publishedAt: input.publishedAt,
          fetchedAt: input.fetchedAt ?? new Date()
        }
      });
      createdLeadCount += 1;
    }

    await prisma.scanLog.update({
      where: { id: scanLog.id },
      data: { status: "success", fetchedCount: inputs.length, createdLeadCount, finishedAt: new Date() }
    });
    await markAdapterSuccess(source);
    return { source, fetched: inputs.length, createdLeadCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.scanLog.update({
      where: { id: scanLog.id },
      data: { status: "unavailable", errorMessage: message, finishedAt: new Date() }
    });
    await markAdapterFailed(source, message);
    return { source, fetched: 0, createdLeadCount: 0, error: message };
  }
}

function isValidSignal(input: SignalInput) {
  if (!input.title || !input.url) return false;
  if (input.url.includes("mock")) return false;
  try {
    const parsed = new URL(input.url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
