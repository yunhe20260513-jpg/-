import { Router } from "express";
import { getTodayStats } from "../services/stats.service";

export const statsRouter = Router();

statsRouter.get("/today", async (_req, res) => {
  res.json(await getTodayStats());
});
