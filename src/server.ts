import { createApp } from "./app";
import { env } from "./config/env";
import { scanAllSources } from "./services/scanner.service";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(env.APP_PORT, () => {
  logger.info(`允禾桃園辦公室設備需求情報系統 running at http://localhost:${env.APP_PORT}`);
});

setInterval(() => {
  scanAllSources().catch((error) => logger.error("Scheduled scan failed", error));
}, env.SCAN_INTERVAL_SECONDS * 1000);
