import { Router } from "express";
import { prisma } from "../prisma/client";

export const blacklistRouter = Router();

blacklistRouter.get("/", async (_req, res) => {
  const keywords = await prisma.blacklistKeyword.findMany({ orderBy: { value: "asc" } });
  res.json(keywords);
});

blacklistRouter.post("/", async (req, res) => {
  const { value } = req.body;
  if (!value || typeof value !== "string") return res.status(400).json({ error: "value is required" });
  const keyword = await prisma.blacklistKeyword.upsert({
    where: { value },
    update: { isActive: true },
    create: { value }
  });
  res.status(201).json(keyword);
});

blacklistRouter.patch("/:id", async (req, res) => {
  const data: { value?: string; isActive?: boolean } = {};
  if (typeof req.body.value === "string") data.value = req.body.value;
  if (typeof req.body.isActive === "boolean") data.isActive = req.body.isActive;
  const keyword = await prisma.blacklistKeyword.update({ where: { id: req.params.id }, data });
  res.json(keyword);
});
