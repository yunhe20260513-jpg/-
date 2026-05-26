import cors from "cors";
import express from "express";
import path from "path";
import { leadsRouter } from "./routes/leads.routes";
import { keywordsRouter } from "./routes/keywords.routes";
import { scanLogsRouter } from "./routes/scanLogs.routes";
import { searchLinksRouter } from "./routes/searchLinks.routes";
import { sourcePostsRouter } from "./routes/sourcePosts.routes";
import { adapterStatusRouter } from "./routes/adapterStatus.routes";
import { blacklistRouter } from "./routes/blacklist.routes";
import { statsRouter } from "./routes/stats.routes";
import { tendersRouter } from "./routes/tenders.routes";
import { signalsRouter } from "./routes/signals.routes";
import { scanAllSources } from "./services/scanner.service";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), "src", "public")));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/leads", leadsRouter);
  app.use("/api/source-posts", sourcePostsRouter);
  app.use("/api/keywords", keywordsRouter);
  app.use("/api/blacklist", blacklistRouter);
  app.use("/api/scan-logs", scanLogsRouter);
  app.use("/api/adapter-status", adapterStatusRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/tenders", tendersRouter);
  app.use("/api/signals", signalsRouter);
  app.use("/api/search-links", searchLinksRouter);
  app.post("/api/scan-now", async (_req, res) => {
    const results = await scanAllSources();
    res.json({ ok: true, results });
  });

  return app;
}
