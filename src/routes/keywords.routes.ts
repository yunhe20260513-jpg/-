import { Router } from "express";
import { prisma } from "../prisma/client";

export const keywordsRouter = Router();

keywordsRouter.get("/", async (_req, res) => {
  const keywords = await prisma.keyword.findMany({ orderBy: [{ group: "asc" }, { value: "asc" }] });
  res.json(keywords);
});

keywordsRouter.post("/", async (req, res) => {
  const { group, value, weight } = req.body;
  if (!group || !value || typeof weight !== "number") {
    return res.status(400).json({ error: "group, value and numeric weight are required" });
  }

  const keyword = await prisma.keyword.create({ data: { group, value, weight } });
  res.status(201).json(keyword);
});

keywordsRouter.patch("/:id", async (req, res) => {
  const data: { group?: string; value?: string; weight?: number; isActive?: boolean } = {};
  if (typeof req.body.group === "string") data.group = req.body.group;
  if (typeof req.body.value === "string") data.value = req.body.value;
  if (typeof req.body.weight === "number") data.weight = req.body.weight;
  if (typeof req.body.isActive === "boolean") data.isActive = req.body.isActive;

  const keyword = await prisma.keyword.update({ where: { id: req.params.id }, data });
  res.json(keyword);
});
