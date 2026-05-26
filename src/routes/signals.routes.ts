import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { scanSignals, scanSignalsByType } from "../services/signal.service";

export const signalsRouter = Router();

function parseKeywords(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

signalsRouter.get("/", async (req, res) => {
  const { type, source, grade, status, keyword, starred, days, district, industry } = req.query;
  const createdAfter =
    typeof days === "string" && days && Number.isFinite(Number(days))
      ? new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)
      : undefined;
  const keywordFilters: Prisma.SignalWhereInput[] =
    typeof keyword === "string" && keyword
      ? [{ title: { contains: keyword } }, { name: { contains: keyword } }, { summary: { contains: keyword } }, { matchedKeywords: { contains: keyword } }]
      : [];
  const companyFilters: Prisma.SignalWhereInput[] = [];
  if (typeof district === "string" && district) companyFilters.push({ summary: { contains: district } });
  if (typeof industry === "string" && industry) companyFilters.push({ summary: { contains: industry } });
  if (createdAfter) companyFilters.push({ publishedAt: { gte: createdAfter } });
  const signals = await prisma.signal.findMany({
    where: {
      type: typeof type === "string" && type ? type : undefined,
      source: typeof source === "string" && source ? source : undefined,
      grade: typeof grade === "string" && grade ? grade : undefined,
      status: typeof status === "string" && status ? status : undefined,
      isStarred: starred === "true" ? true : undefined,
      AND: companyFilters.length ? companyFilters : undefined,
      OR: keywordFilters.length ? keywordFilters : undefined
    },
    orderBy: [{ grade: "asc" }, { createdAt: "desc" }],
    take: 150
  });

  res.json(signals.map((signal) => ({ ...signal, matchedKeywords: parseKeywords(signal.matchedKeywords) })));
});

signalsRouter.get("/:id", async (req, res) => {
  const signal = await prisma.signal.findUnique({ where: { id: req.params.id } });
  if (!signal) return res.status(404).json({ error: "Signal not found" });
  res.json({ ...signal, matchedKeywords: parseKeywords(signal.matchedKeywords) });
});

signalsRouter.patch("/:id/status", async (req, res) => {
  const allowed = ["new", "reviewed", "contacted", "ignored", "converted"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
  const signal = await prisma.signal.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(signal);
});

signalsRouter.patch("/:id/star", async (req, res) => {
  const signal = await prisma.signal.update({
    where: { id: req.params.id },
    data: { isStarred: Boolean(req.body.isStarred) }
  });
  res.json(signal);
});

signalsRouter.post("/scan-now", async (req, res) => {
  const type = typeof req.body?.type === "string" ? req.body.type : undefined;
  const result = type ? await scanSignalsByType(type) : await scanSignals();
  res.json({ ok: true, result });
});
