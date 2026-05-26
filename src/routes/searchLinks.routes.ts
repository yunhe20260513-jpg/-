import { Router } from "express";
import { buildSearchLinks } from "../services/searchLinks.service";

export const searchLinksRouter = Router();

searchLinksRouter.get("/", (_req, res) => {
  res.json(buildSearchLinks());
});
