import { Router } from "express";
import { lookupCompanyContact } from "../services/contactLookup.service";

export const contactLookupRouter = Router();

contactLookupRouter.get("/", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name : "";
  const address = typeof req.query.address === "string" ? req.query.address : undefined;
  const taxId = typeof req.query.taxId === "string" ? req.query.taxId : undefined;

  if (!name.trim()) return res.status(400).json({ error: "name is required" });

  const result = await lookupCompanyContact({ name, address, taxId });
  res.json(result);
});
