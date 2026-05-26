import { Router } from "express";
import { prisma } from "../prisma/client";

export const sourcePostsRouter = Router();

sourcePostsRouter.get("/", async (req, res) => {
  const { source, keyword } = req.query;
  const posts = await prisma.sourcePost.findMany({
    where: {
      AND: [
        { url: { not: null } },
        { url: { not: { contains: "mock" } } },
        { isMock: false }
      ],
      source: typeof source === "string" && source ? source : undefined,
      content: typeof keyword === "string" && keyword ? { contains: keyword } : undefined
    },
    include: { leads: true },
    orderBy: { fetchedAt: "desc" },
    take: 80
  });

  res.json(posts);
});
