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
  rawJson?: unknown;
  fetchedAt?: Date;
};

export type TenderScoreResult = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
  matchedKeywords: string[];
  reason: string;
};

export const tenderKeywords = [
  "影印機",
  "事務機",
  "複合機",
  "多功能事務機",
  "印表機",
  "雷射印表機",
  "彩色印表機",
  "掃描器",
  "掃描設備",
  "辦公室設備",
  "OA設備",
  "影印機租賃",
  "事務機租賃",
  "印表機租賃",
  "維護",
  "保養",
  "耗材",
  "碳粉"
];

const sKeywords = ["租賃", "維護", "保養", "多功能事務機", "影印機租賃", "事務機租賃"];
const aKeywords = ["印表機", "掃描器", "辦公室設備", "OA設備", "耗材", "碳粉"];

export function scoreTender(tender: TenderInput): TenderScoreResult {
  const text = [tender.tenderName, tender.agencyName, tender.tenderMethod, tender.procurementType].filter(Boolean).join(" ");
  const matchedKeywords = tenderKeywords.filter((keyword) => text.includes(keyword));
  if (!matchedKeywords.length) {
    return { rawScore: 0, score: 1, grade: "C", matchedKeywords: [], reason: "未命中辦公室設備標案關鍵字" };
  }

  let rawScore = matchedKeywords.length;
  const hasSKeyword = sKeywords.some((keyword) => text.includes(keyword));
  const hasAKeyword = aKeywords.some((keyword) => text.includes(keyword));
  const hasBudgetOrDeadline = Boolean(tender.budgetAmount || tender.deadlineDate);

  if (hasSKeyword) rawScore += 8;
  if (hasAKeyword) rawScore += 5;
  if (hasBudgetOrDeadline) rawScore += 2;
  if (tender.budgetAmount && tender.budgetAmount >= 300000) rawScore += 2;
  if (tender.deadlineDate && tender.deadlineDate.getTime() >= Date.now()) rawScore += 1;

  const grade = inferTenderGrade(hasSKeyword, hasAKeyword, hasBudgetOrDeadline, rawScore);
  const score = grade === "S" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : 1;
  const reasonParts = [
    `命中 ${matchedKeywords.join("、")}`,
    hasSKeyword ? "符合租賃/維護/保養等高意圖標案" : "未命中高意圖標案詞",
    hasBudgetOrDeadline ? "有預算金額或截止日期" : "未提供預算或截止日期",
    tender.budgetAmount ? `預算 ${tender.budgetAmount.toLocaleString("zh-TW")}` : "預算未知"
  ];

  return { rawScore, score, grade, matchedKeywords, reason: reasonParts.join("；") };
}

function inferTenderGrade(hasSKeyword: boolean, hasAKeyword: boolean, hasBudgetOrDeadline: boolean, rawScore: number): "S" | "A" | "B" | "C" {
  if (hasSKeyword && hasBudgetOrDeadline) return "S";
  if (hasAKeyword) return "A";
  if (rawScore >= 3) return "B";
  return "C";
}
