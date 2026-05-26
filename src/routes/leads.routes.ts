import { Router } from "express";
import { prisma } from "../prisma/client";

export const leadsRouter = Router();

function parseMatchedKeywords(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function parseSignalTypes(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

leadsRouter.get("/", async (req, res) => {
  const { source, score, status, keyword, signal, grade, starred } = req.query;
  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        { post: { url: { not: null } } },
        { post: { url: { not: { contains: "mock" } } } },
        { post: { isMock: false } },
        { score: { gte: 3 } },
        { isLowValue: false }
      ],
      grade: typeof grade === "string" && grade ? grade : undefined,
      status: typeof status === "string" && status ? status : undefined,
      isStarred: starred === "true" ? true : undefined,
      score: typeof score === "string" && score ? { gte: Number(score) } : undefined,
      matchedKeywords: typeof keyword === "string" && keyword ? { contains: keyword } : undefined,
      signalTypes: typeof signal === "string" && signal ? { contains: signal } : undefined,
      post: typeof source === "string" && source ? { source } : undefined
    },
    include: { post: true },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }]
  });

  res.json(leads.map((lead) => ({
    ...lead,
    matchedKeywords: parseMatchedKeywords(lead.matchedKeywords),
    signalTypes: parseSignalTypes(lead.signalTypes)
  })));
});

leadsRouter.get("/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: { post: true } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  res.json({ ...lead, matchedKeywords: parseMatchedKeywords(lead.matchedKeywords), signalTypes: parseSignalTypes(lead.signalTypes) });
});

leadsRouter.patch("/:id/status", async (req, res) => {
  const allowed = ["new", "contacted", "ignored", "converted"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });

  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { status: req.body.status }
  });
  res.json(lead);
});

leadsRouter.patch("/:id/star", async (req, res) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { isStarred: Boolean(req.body.isStarred) }
  });
  res.json(lead);
});
