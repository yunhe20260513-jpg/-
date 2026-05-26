import AdmZip from "adm-zip";
import axios from "axios";
import { createWriteStream } from "fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import https from "https";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { env } from "../config/env";
import { prisma } from "../prisma/client";
import { isTaoyuanAddress } from "./companyScoring.service";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ZIP_BYTES = 1_000_000;
const LOCAL_ZIP_PATH = path.join(process.cwd(), "data", "company", "BGMOPEN1.zip");

type CompanyCsvRow = Record<string, string>;

export async function ensureCompanyCacheFresh() {
  const latest = await prisma.companyCache.findFirst({ orderBy: { importedAt: "desc" } });
  if (latest && Date.now() - latest.importedAt.getTime() < ONE_DAY_MS) {
    return {
      skipped: true,
      reason: "今天已更新過 CompanyCache，略過下載。",
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
  const csvBuffers = readCsvBuffersFromZip(zipPath);
  if (!csvBuffers.length) throw new Error("公司 ZIP 中找不到 CSV/TXT 檔。");

  const rows: NormalizedCompany[] = [];
  for (const buffer of csvBuffers) {
    for (const row of parseCsvBuffer(buffer)) {
      const normalized = normalizeCompanyRow(row);
      if (!normalized || !isTaoyuanAddress(normalized.address)) continue;
      rows.push(normalized);
    }
  }

  if (!rows.length) throw new Error("公司 ZIP 已解析，但沒有找到桃園公司資料；保留舊 cache。");

  await replaceCompanyCache(rows);

  return {
    skipped: false,
    imported: rows.length,
    totalTaoyuan: await prisma.companyCache.count(),
    lastImportedAt: new Date(),
    zipPath
  };
}

export async function importLocalCompanyCache() {
  await assertValidZip(LOCAL_ZIP_PATH);
  return refreshCompanyCache({ preferLocal: true });
}

export async function getRecentTaoyuanCompanies(days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.companyCache.findMany({
    where: {
      setupDate: { gte: since }
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

  throw new Error(`公司 ZIP 下載失敗：${errors.join("；")}`);
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
  if (!info) throw new Error(`ZIP 不存在：${zipPath}`);
  if (info.size < MIN_ZIP_BYTES) throw new Error(`ZIP 檔案過小：${info.size} bytes`);

  const header = await readFile(zipPath, { encoding: null }).then((buffer) => buffer.subarray(0, 4));
  if (!(header[0] === 0x50 && header[1] === 0x4b)) throw new Error("ZIP header 不正確。");
}

function readCsvBuffersFromZip(zipPath: string) {
  const zip = new AdmZip(zipPath);
  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && /\.(csv|txt)$/i.test(entry.entryName))
    .map((entry) => entry.getData());
}

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

async function replaceCompanyCache(rows: NormalizedCompany[]) {
  const importedAt = new Date();
  const uniqueRows = [...new Map(rows.map((row) => [row.taxId, row])).values()];
  await prisma.companyCache.deleteMany({});

  for (let index = 0; index < uniqueRows.length; index += 1000) {
    const batch = uniqueRows.slice(index, index + 1000).map((row) => ({ ...row, importedAt }));
    await prisma.companyCache.createMany({ data: batch });
  }
}

function parseCsvBuffer(buffer: Buffer): CompanyCsvRow[] {
  const utf8 = buffer.toString("utf8");
  const text = looksLikeCompanyCsv(utf8) ? utf8 : new TextDecoder("big5").decode(buffer);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  });
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

function normalizeCompanyRow(row: CompanyCsvRow): NormalizedCompany | null {
  const taxId = pick(row, ["統一編號", "營業人統編", "稅籍編號", "Business_Accounting_NO", "BAN"]);
  const name = pick(row, ["營業人名稱", "公司名稱", "商業名稱", "Business_Name", "Company_Name"]);
  const address = pick(row, ["營業地址", "公司所在地", "地址", "Business_Address", "Company_Location"]);
  if (!taxId || !/^\d{8}$/.test(taxId) || !name || !address) return null;

  return {
    taxId,
    name,
    address,
    city: "桃園市",
    district: inferDistrict(address),
    capitalAmount: parseMoneyText(pick(row, ["資本額", "資本總額", "Capital_Stock_Amount", "Capital"])),
    setupDate: parseTaiwanDate(pick(row, ["設立日期", "核准設立日期", "開業日期", "Company_Setup_Date", "Business_Setup_Date"])),
    organizationType: pick(row, ["組織別名稱", "組織別", "組織種類", "Organization_Type", "Business_Type"]),
    useInvoice: pick(row, ["使用統一發票", "是否使用統一發票", "Use_Invoice", "isUseInvoice"]),
    industryCode: pick(row, ["行業代號", "行業代碼", "Industry_Code", "industryCd"]),
    industryName: pick(row, ["名稱", "行業名稱", "營業項目", "Industry_Name", "industryNm"]),
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

function inferDistrict(address: string) {
  return address.match(/桃園市([\u4e00-\u9fa5]{1,3}區)/)?.[1];
}

function parseMoneyText(value: string | undefined) {
  if (!value) return undefined;
  const text = value.replace(/[^\d]/g, "");
  return text || undefined;
}

function parseTaiwanDate(value: string | undefined) {
  if (!value) return undefined;
  const clean = value.trim().replace(/[^\d]/g, "");
  if (/^\d{7}$/.test(clean)) return new Date(Number(clean.slice(0, 3)) + 1911, Number(clean.slice(3, 5)) - 1, Number(clean.slice(5, 7)));
  if (/^\d{8}$/.test(clean)) return new Date(Number(clean.slice(0, 4)), Number(clean.slice(4, 6)) - 1, Number(clean.slice(6, 8)));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function looksLikeCompanyCsv(text: string) {
  const header = text.slice(0, 300);
  return header.includes("營業地址") && header.includes("統一編號") && header.includes("營業人名稱");
}

async function fileExists(filePath: string) {
  return access(filePath).then(() => true).catch(() => false);
}
