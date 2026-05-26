import { Router } from "express";
import { prisma } from "../prisma/client";
import { scanAllSources } from "../services/scanner.service";
import { markStaleRunningAdapters } from "../services/adapterStatus.service";

export const scanLogsRouter = Router();

scanLogsRouter.get("/", async (_req, res) => {
  await markStaleRunningAdapters();
  const logs = await prisma.scanLog.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
  res.json(logs);
});

scanLogsRouter.post("/scan-now", async (_req, res) => {
  const results = await scanAllSources();
  res.json({ ok: true, results });
});
