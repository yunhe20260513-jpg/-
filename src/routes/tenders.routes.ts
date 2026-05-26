import { Router } from "express";
import { prisma } from "../prisma/client";
import { scanTenders } from "../services/tender.service";

export const tendersRouter = Router();

function parseKeywords(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

tendersRouter.get("/", async (req, res) => {
  const { keyword, agency, grade, status, starred, closingSoon, highBudget } = req.query;
  const deadlineTo = closingSoon === "true" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined;

  const tenders = await prisma.tenderLead.findMany({
    where: {
      grade: typeof grade === "string" && grade ? grade : undefined,
      status: typeof status === "string" && status ? status : undefined,
      isStarred: starred === "true" ? true : undefined,
      tenderName: typeof keyword === "string" && keyword ? { contains: keyword } : undefined,
      agencyName: typeof agency === "string" && agency ? { contains: agency } : undefined,
      deadlineDate: deadlineTo ? { gte: new Date(), lte: deadlineTo } : undefined,
      budgetAmount: highBudget === "true" ? { gte: 300000 } : undefined
    },
    orderBy: [{ grade: "asc" }, { deadlineDate: "asc" }, { createdAt: "desc" }],
    take: 100
  });

  res.json(tenders.map((tender) => ({ ...tender, matchedKeywords: parseKeywords(tender.matchedKeywords) })));
});

tendersRouter.get("/:id", async (req, res) => {
  const tender = await prisma.tenderLead.findUnique({ where: { id: req.params.id } });
  if (!tender) return res.status(404).json({ error: "Tender not found" });
  res.json({ ...tender, matchedKeywords: parseKeywords(tender.matchedKeywords) });
});

tendersRouter.patch("/:id/status", async (req, res) => {
  const allowed = ["new", "reviewed", "interested", "ignored", "submitted"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
  const tender = await prisma.tenderLead.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(tender);
});

tendersRouter.patch("/:id/star", async (req, res) => {
  const tender = await prisma.tenderLead.update({
    where: { id: req.params.id },
    data: { isStarred: Boolean(req.body.isStarred) }
  });
  res.json(tender);
});

tendersRouter.post("/scan-now", async (_req, res) => {
  res.json({ ok: true, result: await scanTenders() });
});
