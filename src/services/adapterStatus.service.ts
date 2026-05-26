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
      errorMessage: "掃描程序超過 15 分鐘未完成，可能是 server 重啟、程序中斷或外部來源卡住；未建立假資料。"
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
      errorMessage: "掃描程序超過 15 分鐘未完成，已標示為 stale。"
    }
  });
}
