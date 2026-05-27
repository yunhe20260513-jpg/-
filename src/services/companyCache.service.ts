import AdmZip from "adm-zip";
import axios from "axios";
import crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import https from "https";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { env } from "../config/env";
import { prisma } from "../prisma/client";
import { markAdapterFailed, markAdapterRunning, markAdapterSuccess } from "./adapterStatus.service";
import { isTaoyuanAddress } from "./companyScoring.service";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ZIP_BYTES = 1_000_000;
const LOCAL_ZIP_PATH = path.join(process.cwd(), "data", "company", "BGMOPEN1.zip");

const ZH = {
  taxId: "\u7d71\u4e00\u7de8\u865f",
  taxIdShort: "\u7d71\u7de8",
  businessName: "\u71df\u696d\u4eba\u540d\u7a31",
  name: "\u540d\u7a31",
  companyName: "\u516c\u53f8\u540d\u7a31",
  address: "\u5730\u5740",
  businessAddress: "\u71df\u696d\u5730\u5740",
  businessPlaceAddress: "\u71df\u696d\u5834\u6240\u5730\u5740",
  capital: "\u8cc7\u672c\u984d",
  setupDate: "\u8a2d\u7acb\u65e5\u671f",
  registerDate: "\u767b\u8a18\u65e5\u671f",
  organizationTypeName: "\u7d44\u7e54\u5225\u540d\u7a31",
  organizationType: "\u7d44\u7e54\u5225",
  useInvoice: "\u4f7f\u7528\u7d71\u4e00\u767c\u7968",
  useInvoiceShort: "\u4f7f\u7528\u767c\u7968",
  industryCode: "\u884c\u696d\u4ee3\u865f",
  industryCode1: "\u884c\u696d\u4ee3\u865f1",
  industryName: "\u884c\u696d\u540d\u7a31",
  industryName1: "\u884c\u696d\u540d\u7a311",
  industryType: "\u884c\u696d\u5225",
  taoyuanCity: "\u6843\u5712\u5e02"
};

const COLUMN_ALIASES = {
  taxId: [ZH.taxId, ZH.taxIdShort, "Business_Accounting_NO", "BAN"],
  name: [ZH.businessName, ZH.name, ZH.companyName, "Business_Name", "Company_Name"],
  address: [ZH.businessAddress, ZH.address, ZH.businessPlaceAddress, "Business_Address", "Company_Location"],
  capitalAmount: [ZH.capital, "Capital_Stock_Amount", "Capital"],
  setupDate: [ZH.setupDate, ZH.registerDate, "Company_Setup_Date", "Business_Setup_Date"],
  organizationType: [ZH.organizationTypeName, ZH.organizationType, "Organization_Type", "Business_Type"],
  useInvoice: [ZH.useInvoice, ZH.useInvoiceShort, "Use_Invoice", "isUseInvoice"],
  industryCode: [ZH.industryCode, ZH.industryCode1, "Industry_Code", "industryCd"],
  industryName: [ZH.industryName1, ZH.industryName, ZH.name, ZH.industryType, "Industry_Name", "industryNm"]
};

const DISTRICTS = [
  "\u6843\u5712\u5340",
  "\u4e2d\u58e2\u5340",
  "\u5e73\u93ae\u5340",
  "\u516b\u5fb7\u5340",
  "\u8606\u7af9\u5340",
  "\u9f9c\u5c71\u5340",
  "\u694a\u6885\u5340",
  "\u9f8d\u6f6d\u5340",
  "\u5927\u6eaa\u5340",
  "\u5927\u5712\u5340",
  "\u89c0\u97f3\u5340",
  "\u65b0\u5c4b\u5340",
  "\u5fa9\u8208\u5340",
  "\u9752\u57d4",
  "\u5167\u58e2",
  "\u5357\u5d01"
];

type CompanyCsvRow = Record<string, string>;

type NormalizedCompany = {
  taxId: string;
  name: string;
  address: string;
  city?: string;
  district?: string;
  capitalAmount?: string;
  setupDate?: Date;
  organizationType?: string;
  useInvoice?: string;
  industryCode?: string;
  industryName?: string;
  source: string;
  sourceUrl: string;
  rawJson: string;
};

type ImportStats = {
  zipHash: string;
  zipSize: number;
  csvColumns: string[];
  totalRows: number;
  totalTaoyuanRows: number;
  totalImported: number;
  excludeStats: {
    notTaoyuan: number;
    noTaxId: number;
    noName: number;
    shortAddress: number;
    invalidSetupDate: number;
  };
  executionTime: number;
};

export class CompanyCacheService {
  static isImporting = false;

  static async importTaoyuanCompanies(zipPath: string) {
    return importTaoyuanCompanies(zipPath);
  }
}

export async function importTaoyuanCompanies(zipPath: string) {
  if (CompanyCacheService.isImporting) {
    throw new Error("CompanyCache import is already running.");
  }

  const startedAt = Date.now();
  CompanyCacheService.isImporting = true;
  await markAdapterRunning("company_cache");

  try {
    await assertValidZip(zipPath);
    const zipHash = await hashFileStream(zipPath);
    const zipInfo = await stat(zipPath);
    const { rows, stats } = parseCompanyRowsFromZip(zipPath, {
      zipHash,
      zipSize: zipInfo.size
    });

    if (!rows.length) throw new Error("Company ZIP parsed, but no Taoyuan company rows were found.");

    await replaceCompanyCache(rows, env.COMPANY_BASELINE_IMPORT);
    await writeImportReport({ ...stats, totalImported: rows.length, executionTime: Date.now() - startedAt });
    await markAdapterSuccess("company_cache");

    return {
      skipped: false,
      baselineImport: env.COMPANY_BASELINE_IMPORT,
      imported: rows.length,
      totalTaoyuan: await prisma.companyCache.count(),
      lastImportedAt: new Date(),
      zipPath,
      zipHash
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markAdapterFailed("company_cache", message);
    throw error;
  } finally {
    CompanyCacheService.isImporting = false;
  }
}

export async function ensureCompanyCacheFresh() {
  const latest = await prisma.companyCache.findFirst({ orderBy: { importedAt: "desc" } });
  if (latest && Date.now() - latest.importedAt.getTime() < ONE_DAY_MS) {
    return {
      skipped: true,
      reason: "CompanyCache was updated today; skipped duplicate import.",
      imported: 0,
      totalTaoyuan: await prisma.companyCache.count(),
      lastImportedAt: latest.importedAt
    };
  }

  try {
    return await refreshCompanyCache();
  } catch (error) {
    const totalTaoyuan = await prisma.companyCache.count();
    if (totalTaoyuan > 0) {
      return {
        skipped: true,
        stale: true,
        imported: 0,
        totalTaoyuan,
        lastImportedAt: latest?.importedAt,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
    throw error;
  }
}

export async function refreshCompanyCache(options: { preferLocal?: boolean; forceDownload?: boolean } = {}) {
  const zipPath = await resolveCompanyZip(options);
  return importTaoyuanCompanies(zipPath);
}

export async function importLocalCompanyCache() {
  await assertValidZip(LOCAL_ZIP_PATH);
  return refreshCompanyCache({ preferLocal: true });
}

export async function getRecentTaoyuanCompanies(days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.companyCache.findMany({
    where: {
      setupDate: { gte: since },
      signalGeneratedAt: null
    },
    orderBy: [{ setupDate: "desc" }, { importedAt: "desc" }],
    take: Math.max(env.COMPANY_OPEN_DATA_LIMIT * 5, 1000)
  });
}

async function resolveCompanyZip(options: { preferLocal?: boolean; forceDownload?: boolean }) {
  await mkdir(path.dirname(LOCAL_ZIP_PATH), { recursive: true });
  if (!options.forceDownload && (await fileExists(LOCAL_ZIP_PATH))) {
    await assertValidZip(LOCAL_ZIP_PATH);
    return LOCAL_ZIP_PATH;
  }

  const tempRoot = path.join(os.tmpdir(), `yunhe-company-download-${Date.now()}`);
  const tempZip = path.join(tempRoot, "BGMOPEN1.zip");
  await mkdir(tempRoot, { recursive: true });

  try {
    await downloadZip(env.COMPANY_OPEN_DATA_ENDPOINT, tempZip);
    await assertValidZip(tempZip);
    await writeFile(LOCAL_ZIP_PATH, await readFile(tempZip));
    return LOCAL_ZIP_PATH;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function downloadZip(endpoint: string, zipPath: string) {
  const errors: string[] = [];

  for (const downloader of [downloadWithFetch, downloadWithAxios, downloadWithHttpsStream]) {
    try {
      await downloader(endpoint, zipPath);
      await assertValidZip(zipPath);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Company ZIP download failed: ${errors.join("; ")}`);
}

async function downloadWithFetch(endpoint: string, zipPath: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "application/zip,application/octet-stream,*/*",
        "user-agent": "Mozilla/5.0"
      }
    });
    if (!response.ok) throw new Error(`fetch HTTP ${response.status}`);
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  } finally {
    clearTimeout(timer);
  }
}

async function downloadWithAxios(endpoint: string, zipPath: string) {
  const response = await axios.get(endpoint, {
    responseType: "arraybuffer",
    timeout: 120_000,
    maxRedirects: 5,
    headers: {
      accept: "application/zip,application/octet-stream,*/*",
      "user-agent": "Mozilla/5.0"
    }
  });
  await writeFile(zipPath, Buffer.from(response.data));
}

async function downloadWithHttpsStream(endpoint: string, zipPath: string) {
  await new Promise<void>((resolve, reject) => {
    const request = https.get(
      endpoint,
      {
        timeout: 120_000,
        headers: {
          accept: "application/zip,application/octet-stream,*/*",
          "user-agent": "Mozilla/5.0"
        }
      },
      async (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
          try {
            await downloadWithHttpsStream(new URL(response.headers.location, endpoint).toString(), zipPath);
            resolve();
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`https stream HTTP ${response.statusCode}`));
          return;
        }
        pipeline(response, createWriteStream(zipPath)).then(resolve).catch(reject);
      }
    );
    request.on("timeout", () => request.destroy(new Error("https stream timeout")));
    request.on("error", reject);
  });
}

async function assertValidZip(zipPath: string) {
  const info = await stat(zipPath).catch(() => null);
  if (!info) throw new Error(`ZIP not found: ${zipPath}`);
  if (info.size < MIN_ZIP_BYTES) throw new Error(`ZIP too small: ${info.size} bytes`);

  const header = await readFile(zipPath, { encoding: null }).then((buffer) => buffer.subarray(0, 4));
  if (!(header[0] === 0x50 && header[1] === 0x4b)) throw new Error("Invalid ZIP header.");
}

function parseCompanyRowsFromZip(zipPath: string, meta: { zipHash: string; zipSize: number }) {
  const zip = new AdmZip(zipPath);
  const csvEntries = zip.getEntries().filter((entry) => !entry.isDirectory && /\.(csv|txt)$/i.test(entry.entryName));
  if (!csvEntries.length) throw new Error("No CSV/TXT files found in company ZIP.");

  const rows: NormalizedCompany[] = [];
  const stats: ImportStats = {
    zipHash: meta.zipHash,
    zipSize: meta.zipSize,
    csvColumns: [],
    totalRows: 0,
    totalTaoyuanRows: 0,
    totalImported: 0,
    excludeStats: {
      notTaoyuan: 0,
      noTaxId: 0,
      noName: 0,
      shortAddress: 0,
      invalidSetupDate: 0
    },
    executionTime: 0
  };

  for (const entry of csvEntries) {
    const parsed = parseCsvBuffer(entry.getData());
    if (!stats.csvColumns.length) stats.csvColumns = parsed.headers;
    for (const row of parsed.rows) {
      stats.totalRows += 1;
      const normalized = normalizeCompanyRow(row, stats);
      if (!normalized) continue;
      rows.push(normalized);
      stats.totalTaoyuanRows += 1;
    }
  }

  return { rows, stats };
}

async function replaceCompanyCache(rows: NormalizedCompany[], isBaselineImport: boolean) {
  const importedAt = new Date();
  const signalGeneratedAt = isBaselineImport ? importedAt : undefined;
  const uniqueRows = dedupeCompaniesByTaxId(rows);
  await prisma.companyCache.deleteMany({});

  for (let index = 0; index < uniqueRows.length; index += 1000) {
    const batch = dedupeCompaniesByTaxId(uniqueRows.slice(index, index + 1000)).map((row) => ({
      ...row,
      importedAt,
      signalGeneratedAt
    }));
    await prisma.companyCache.createMany({ data: batch });
  }
}

function dedupeCompaniesByTaxId(rows: NormalizedCompany[]) {
  return [...new Map(rows.map((row) => [row.taxId, row])).values()];
}

function parseCsvBuffer(buffer: Buffer): { headers: string[]; rows: CompanyCsvRow[] } {
  const utf8 = buffer.toString("utf8");
  const text = looksLikeCompanyCsv(utf8) ? utf8 : new TextDecoder("big5").decode(buffer);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().replace(/^\uFEFF/, ""));
  return {
    headers,
    rows: lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
    })
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeCompanyRow(row: CompanyCsvRow, stats: ImportStats): NormalizedCompany | null {
  const taxId = pick(row, COLUMN_ALIASES.taxId);
  const name = pick(row, COLUMN_ALIASES.name);
  const address = pick(row, COLUMN_ALIASES.address);

  if (!taxId || !/^\d{8}$/.test(taxId)) {
    stats.excludeStats.noTaxId += 1;
    return null;
  }
  if (!name || name.length < 2) {
    stats.excludeStats.noName += 1;
    return null;
  }
  if (!address || address.length < 8) {
    stats.excludeStats.shortAddress += 1;
    return null;
  }
  if (!isTaoyuanAddress(address)) {
    stats.excludeStats.notTaoyuan += 1;
    return null;
  }
  const setupDate = parseTaiwanDate(pick(row, COLUMN_ALIASES.setupDate));
  if (!setupDate) {
    stats.excludeStats.invalidSetupDate += 1;
    return null;
  }

  return {
    taxId,
    name,
    address,
    city: ZH.taoyuanCity,
    district: inferDistrict(address),
    capitalAmount: parseMoneyText(pick(row, COLUMN_ALIASES.capitalAmount)),
    setupDate,
    organizationType: pick(row, COLUMN_ALIASES.organizationType),
    useInvoice: pick(row, COLUMN_ALIASES.useInvoice),
    industryCode: pick(row, COLUMN_ALIASES.industryCode),
    industryName: inferIndustryName(row),
    source: "fia_tax_zip",
    sourceUrl: env.COMPANY_OPEN_DATA_ENDPOINT,
    rawJson: JSON.stringify(row)
  };
}

function pick(row: CompanyCsvRow, keys: string[]) {
  for (const key of keys) {
    const direct = row[key]?.trim();
    if (direct) return direct;
  }

  for (const [key, value] of Object.entries(row)) {
    const compact = key.replace(/\s/g, "");
    if (keys.some((candidate) => compact.includes(candidate.replace(/\s/g, "")))) {
      const text = value.trim();
      if (text) return text;
    }
  }
  return undefined;
}

function inferIndustryName(row: CompanyCsvRow) {
  const explicit = pick(row, COLUMN_ALIASES.industryName);
  const businessName = pick(row, COLUMN_ALIASES.name);
  return explicit && explicit !== businessName ? explicit : undefined;
}

function inferDistrict(address: string) {
  return DISTRICTS.find((district) => address.includes(district)) ?? "\u6843\u5712\u5176\u4ed6";
}

function parseMoneyText(value: string | undefined) {
  if (!value) return undefined;
  const text = value.replace(/[^\d]/g, "");
  return text || undefined;
}

function parseTaiwanDate(value: string | undefined) {
  if (!value) return null;
  const clean = value.trim().replace(/[^\d]/g, "");
  if (clean.length < 5) return null;

  let year: number;
  let month: number;
  let day: number;

  if (/^\d{8}$/.test(clean)) {
    year = Number(clean.slice(0, 4));
    month = Number(clean.slice(4, 6));
    day = Number(clean.slice(6, 8));
  } else if (/^\d{6,7}$/.test(clean)) {
    year = Number(clean.slice(0, -4)) + 1911;
    month = Number(clean.slice(-4, -2));
    day = Number(clean.slice(-2));
  } else {
    return null;
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > new Date().getFullYear() + 1) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function looksLikeCompanyCsv(text: string) {
  const header = text.slice(0, 500);
  return [ZH.businessAddress, ZH.taxId, ZH.businessName].some((keyword) => header.includes(keyword));
}

async function hashFileStream(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function writeImportReport(stats: ImportStats) {
  const report = `# Yunhe Company Import Report

- Run at: ${new Date().toISOString()}
- ZIP SHA256: ${stats.zipHash}
- ZIP size: ${(stats.zipSize / 1024 / 1024).toFixed(2)} MB
- CSV columns: ${stats.csvColumns.join(", ")}
- CSV rows parsed: ${stats.totalRows}
- Taoyuan rows: ${stats.totalTaoyuanRows}
- CompanyCache rows written: ${stats.totalImported}
- Excluded non-Taoyuan: ${stats.excludeStats.notTaoyuan}
- Excluded missing taxId: ${stats.excludeStats.noTaxId}
- Excluded missing name: ${stats.excludeStats.noName}
- Excluded short address: ${stats.excludeStats.shortAddress}
- Excluded invalid setup date: ${stats.excludeStats.invalidSetupDate}
- Execution seconds: ${(stats.executionTime / 1000).toFixed(2)}

Note: this report is generated only from the real tax ZIP import. No mock leads are created.
`;
  return writeFile(path.join(process.cwd(), "IMPORT_REPORT.md"), report, "utf8");
}

async function fileExists(filePath: string) {
  return access(filePath).then(() => true).catch(() => false);
}
