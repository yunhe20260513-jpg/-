import { Router } from "express";
import { prisma } from "../prisma/client";
import { markStaleRunningAdapters } from "../services/adapterStatus.service";

export const adapterStatusRouter = Router();

adapterStatusRouter.get("/", async (_req, res) => {
  await markStaleRunningAdapters();
  const statuses = await prisma.adapterStatus.findMany({ orderBy: { source: "asc" } });
  res.json(statuses);
});
