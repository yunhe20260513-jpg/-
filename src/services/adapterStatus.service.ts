import { prisma } from "../prisma/client";

const STALE_RUNNING_MS = 15 * 60 * 1000;

export async function markAdapterRunning(source: string) {
  return prisma.adapterStatus.upsert({
    where: { source },
    update: { status: "running", lastRunAt: new Date(), errorMessage: null },
    create: { source, status: "running", lastRunAt: new Date() }
  });
}

export async function markAdapterSuccess(source: string) {
  const now = new Date();
  return prisma.adapterStatus.upsert({
    where: { source },
    update: { status: "success", lastSuccessAt: now, errorMessage: null },
    create: { source, status: "success", lastRunAt: now, lastSuccessAt: now }
  });
}

export async function markAdapterNoResult(source: string, message = "掃描成功，但沒有找到符合條件的有效資料。") {
  const now = new Date();
  return prisma.adapterStatus.upsert({
    where: { source },
    update: { status: "no_result", lastSuccessAt: now, errorMessage: message },
    create: { source, status: "no_result", lastRunAt: now, lastSuccessAt: now, errorMessage: message }
  });
}

export async function markAdapterFailed(source: string, errorMessage: string) {
  return prisma.adapterStatus.upsert({
    where: { source },
    update: { status: "failed", errorMessage },
    create: { source, status: "failed", lastRunAt: new Date(), errorMessage }
  });
}

export async function markStaleRunningAdapters() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS);
  await prisma.adapterStatus.updateMany({
    where: {
      status: "running",
      lastRunAt: { lt: cutoff }
    },
    data: {
      status: "stale",
      errorMessage: "掃描程序超過 15 分鐘未完成，已標示為逾時；未建立假資料。"
    }
  });

  await prisma.scanLog.updateMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
      finishedAt: null
    },
    data: {
      status: "stale",
      finishedAt: new Date(),
      errorMessage: "掃描程序超過 15 分鐘未完成，已標示為逾時。"
    }
  });
}
