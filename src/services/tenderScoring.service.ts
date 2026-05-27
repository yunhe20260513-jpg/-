export type TenderIntentType = "direct_need" | "pre_intent";

export type TenderInput = {
  source: string;
  tenderName: string;
  agencyName?: string;
  jobNumber: string;
  announceDate?: Date;
  deadlineDate?: Date;
  budgetAmount?: number;
  tenderMethod?: string;
  procurementType?: string;
  url: string;
  intentType?: TenderIntentType;
  rawJson?: unknown;
  fetchedAt?: Date;
};

export type TenderScoreResult = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
  intentType: TenderIntentType;
  matchedKeywords: string[];
  reason: string;
};

export const directTenderKeywords = [
  "影印機",
  "事務機",
  "多功能事務機",
  "複合機",
  "印表機",
  "雷射印表機",
  "掃描器",
  "OA設備",
  "辦公設備",
  "租賃",
  "維護",
  "保養",
  "碳粉",
  "耗材"
];

export const preIntentTenderKeywords = [
  "辦公室裝修",
  "辦公環境改善",
  "行政空間整修",
  "行政大樓整修",
  "教室設備",
  "資訊設備",
  "電腦設備",
  "網路設備",
  "系統整合",
  "櫃台設備",
  "櫃檯設備"
];

export const tenderKeywords = [...directTenderKeywords, ...preIntentTenderKeywords];

const sKeywords = ["影印機", "事務機", "多功能事務機", "複合機", "租賃", "維護", "保養"];
const aKeywords = ["印表機", "掃描器", "耗材", "碳粉", "資訊設備", "辦公設備", "OA設備"];

export function scoreTender(tender: TenderInput): TenderScoreResult {
  const text = [tender.tenderName, tender.agencyName, tender.tenderMethod, tender.procurementType].filter(Boolean).join(" ");
  const directMatches = directTenderKeywords.filter((keyword) => text.includes(keyword));
  const preIntentMatches = preIntentTenderKeywords.filter((keyword) => text.includes(keyword));
  const matchedKeywords = [...new Set([...directMatches, ...preIntentMatches])];

  if (!matchedKeywords.length) {
    return {
      rawScore: 0,
      score: 1,
      grade: "C",
      intentType: "pre_intent",
      matchedKeywords: [],
      reason: "未命中辦公設備或前置需求關鍵字。"
    };
  }

  const hasSKeyword = sKeywords.some((keyword) => text.includes(keyword));
  const hasAKeyword = aKeywords.some((keyword) => text.includes(keyword));
  const hasBudgetOrDeadline = Boolean(tender.budgetAmount || tender.deadlineDate);
  const intentType: TenderIntentType = directMatches.length ? "direct_need" : "pre_intent";

  let rawScore = directMatches.length * 3 + preIntentMatches.length;
  if (hasSKeyword) rawScore += 8;
  if (hasAKeyword) rawScore += 5;
  if (hasBudgetOrDeadline) rawScore += 2;
  if (tender.budgetAmount && tender.budgetAmount >= 300000) rawScore += 2;
  if (tender.deadlineDate && tender.deadlineDate.getTime() >= Date.now()) rawScore += 1;

  const grade = inferTenderGrade(intentType, hasSKeyword, hasAKeyword, hasBudgetOrDeadline, rawScore);
  const score = grade === "S" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : 1;
  const reasonParts = [
    `命中關鍵字：${matchedKeywords.join("、")}`,
    intentType === "direct_need" ? "直接 OA / 辦公設備需求" : "前置需求，可能衍生 OA 設備採購",
    hasBudgetOrDeadline ? "有預算或截止日期，可人工確認時程" : "尚未解析到預算或截止日期",
    tender.budgetAmount ? `預算 ${tender.budgetAmount.toLocaleString("zh-TW")} 元` : "預算未知"
  ];

  return { rawScore, score, grade, intentType, matchedKeywords, reason: reasonParts.join("；") };
}

function inferTenderGrade(
  intentType: TenderIntentType,
  hasSKeyword: boolean,
  hasAKeyword: boolean,
  hasBudgetOrDeadline: boolean,
  rawScore: number
): "S" | "A" | "B" | "C" {
  if (intentType === "pre_intent") return rawScore >= 1 ? "B" : "C";
  if (hasSKeyword && hasBudgetOrDeadline) return "S";
  if (hasSKeyword || hasAKeyword || rawScore >= 8) return "A";
  if (rawScore >= 4) return "B";
  return "C";
}
