import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  APP_PORT: z.coerce.number().default(3000),
  SCAN_INTERVAL_SECONDS: z.coerce.number().default(300),
  USE_AI_ANALYSIS: z.coerce.boolean().default(false),
  OPENAI_API_KEY: z.string().optional().default(""),
  AI_ONLY_WHEN_UNCERTAIN: z.coerce.boolean().default(true),
  ALLOW_MOCK_DATA: z.coerce.boolean().default(false),
  ALLOW_AUTO_REPLY: z.coerce.boolean().default(false),
  ALLOW_AUTO_DM: z.coerce.boolean().default(false),
  COMPANY_OPEN_DATA_ENDPOINT: z.string().default("https://eip.fia.gov.tw/data/BGMOPEN1.zip"),
  COMPANY_OPEN_DATA_MODE: z.enum(["candidate_sources", "tax_zip"]).default("candidate_sources"),
  COMPANY_OPEN_DATA_LIMIT: z.coerce.number().default(200),
  COMPANY_BASELINE_IMPORT: z.coerce.boolean().default(false),
  FIA_BUSINESS_REGISTRATION_ENDPOINT: z.string().default("https://eip.fia.gov.tw/OAI/api/businessRegistration"),
  SEARCH_PROVIDER: z.enum(["bing", "google"]).default("bing"),
  SEARCH_RESULTS_PER_QUERY: z.coerce.number().default(8),
  MAX_RESULT_AGE_DAYS: z.coerce.number().default(90),
  SEARCH_DELAY_MS: z.coerce.number().default(800)
});

export const env = schema.parse(process.env);
