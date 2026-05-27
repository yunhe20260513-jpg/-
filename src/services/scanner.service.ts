import { PrismaClient } from "@prisma/client";
import { SearchEngineAdapter } from "../adapters/searchEngine.adapter";
import { PttAdapter } from "../adapters/ptt.adapter";
import { PlatformAdapter, SourcePostInput } from "../adapters/types";
import { env } from "../config/env";
import { prisma } from "../prisma/client";
import { createPost, findDuplicate } from "./dedupe.service";
import { analyzeAndCreateLead } from "./lead.service";
import { ensureKeywordSeeded } from "./keyword.service";
import { isBlacklisted } from "./blacklist.service";
import { markAdapterFailed, markAdapterNoResult, markAdapterRunning, markAdapterSuccess } from "./adapterStatus.service";
import { verifyPublicPage } from "./pageVerifier.service";
import { RateLimiter } from "../utils/rateLimit";
import { logger } from "../utils/logger";
import { scanTenders } from "./tender.service";
import { scanSignals } from "./signal.service";

const adapters: PlatformAdapter[] = [new PttAdapter(), new SearchEngineAdapter()];
const limiters = new Map(adapters.map((adapter) => [adapter.source, new RateLimiter(1500)]));
let scanInProgress = false;

async function scanAdapter(adapter: PlatformAdapter, db: PrismaClient = prisma) {
  await markAdapterRunning(adapter.source);
  const scanLog = await db.scanLog.create({
    data: { source: adapter.source, status: "running", startedAt: new Date() }
  });

  try {
    await limiters.get(adapter.source)?.wait();
    const inputs = await adapter.fetchLatest();
    let createdLeadCount = 0;

    for (const input of inputs) {
      if (!isEligibleInput(input)) continue;
      if (isTooOld(input.publishedAt)) continue;
      if (await isBlacklisted([input.title, input.snippet, input.content].filter(Boolean).join("\n"))) continue;

      const verified = await verifyPublicPage(input).catch(() => null);
      const postInput = verified ?? markUnverified(input);
      if (await isBlacklisted([postInput.title, postInput.snippet, postInput.content].filter(Boolean).join("\n"))) continue;

      const duplicate = await findDuplicate(postInput);
      if (duplicate) continue;

      const post = await createPost(postInput);
      const lead = await analyzeAndCreateLead(post);
      if (lead) createdLeadCount += 1;
    }

    const finalStatus = createdLeadCount > 0 ? "success" : "no_result";
    const noResultMessage =
      createdLeadCount > 0 ? undefined : "掃描成功，但沒有符合 OA 產品/租賃條件的有效商機。";

    await db.scanLog.update({
      where: { id: scanLog.id },
      data: {
        status: finalStatus,
        fetchedCount: inputs.length,
        createdLeadCount,
        finishedAt: new Date(),
        errorMessage: noResultMessage
      }
    });
    if (createdLeadCount > 0) {
      await markAdapterSuccess(adapter.source);
    } else {
      await markAdapterNoResult(adapter.source, noResultMessage);
    }

    return { source: adapter.source, fetched: inputs.length, createdLeadCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.scanLog.update({
      where: { id: scanLog.id },
      data: { status: "failed", errorMessage: message, finishedAt: new Date() }
    });
    await markAdapterFailed(adapter.source, message);
    logger.error(`Scan failed for ${adapter.source}`, message);
    return { source: adapter.source, fetched: 0, createdLeadCount: 0, error: message };
  }
}

export async function scanAllSources() {
  if (scanInProgress) {
    logger.warn("Scan skipped because previous scan is still running");
    return [{ source: "all", fetched: 0, createdLeadCount: 0, skipped: "scan_in_progress" }];
  }

  scanInProgress = true;
  await ensureKeywordSeeded();
  try {
    const results = [];
    for (const adapter of adapters) {
      results.push(await scanAdapter(adapter));
    }
    results.push(await scanTenders());
    results.push(...(await scanSignals()));
    return results;
  } finally {
    scanInProgress = false;
  }
}

function isEligibleInput(input: SourcePostInput) {
  if (input.isMock && !env.ALLOW_MOCK_DATA) return false;
  if (!isRealUrl(input.url)) return false;
  return true;
}

function isRealUrl(url: string | undefined) {
  if (!url || url.includes("mock")) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isTooOld(publishedAt: Date | undefined) {
  if (!publishedAt || env.MAX_RESULT_AGE_DAYS <= 0) return false;
  const maxAgeMs = env.MAX_RESULT_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - publishedAt.getTime() > maxAgeMs;
}

function markUnverified(input: SourcePostInput): SourcePostInput {
  return {
    ...input,
    rawJson: {
      ...(typeof input.rawJson === "object" && input.rawJson ? input.rawJson : {}),
      pageVerification: {
        status: "unverified",
        reason: "original_page_not_fetchable_but_search_result_url_is_real",
        checkedAt: new Date().toISOString()
      }
    }
  };
}
