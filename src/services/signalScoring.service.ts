import { SignalInput, SignalType } from "../adapters/signal.types";

export type SignalScore = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
  matchedKeywords: string[];
  reason: string;
  suggestedAction: string;
};

const highValueIndustries = ["診所", "牙醫", "補習班", "安親班", "會計師", "律師", "事務所", "房仲", "保險", "設計公司", "工程公司", "貿易公司", "幼兒園", "托嬰中心", "工作室", "門市"];
const officeKeywords = ["影印機", "事務機", "複合機", "多功能事務機", "印表機", "掃描器", "辦公室設備", "OA設備", "租賃", "維護", "保養", "耗材", "碳粉"];
const hiringKeywords = ["行政", "總務", "辦公室助理", "採購", "新辦公室", "擴編", "新據點", "分店"];
const moveKeywords = ["搬辦公室", "新辦公室", "辦公室搬遷", "新據點", "新分店", "擴編", "開幕", "開店", "新門市"];
const competitorBrands = ["Ricoh", "Canon", "Fuji Xerox", "Fujifilm", "Konica Minolta", "Kyocera", "Sharp", "HP", "Epson", "Brother"];
const complaintKeywords = ["維修很慢", "報修沒人來", "一直壞", "很雷", "想換廠商", "租約到期", "合約快到", "卡紙", "掃描不能用", "廠商不處理"];
const contractKeywords = ["租約到期", "合約快到", "想換廠商", "換租賃商", "維修太慢", "廠商不處理", "影印機租賃推薦", "事務機租賃推薦", "哪家租影印機好"];
const taoyuanKeywords = ["桃園", "桃園市", "中壢", "平鎮", "八德", "龜山", "蘆竹", "大園", "楊梅", "龍潭", "觀音"];

export function scoreSignal(signal: SignalInput): SignalScore {
  const embedded = embeddedCompanyScore(signal);
  if (embedded) return embedded;

  const text = [signal.title, signal.name, signal.summary].filter(Boolean).join(" ");
  const matched = collectMatches(text, keywordsFor(signal.type));
  let rawScore = matched.length;

  if (signal.type === "company") rawScore += scoreCompany(text, signal.publishedAt);
  if (signal.type === "hiring") rawScore += scoreHiring(text);
  if (signal.type === "move") rawScore += scoreMove(text);
  if (signal.type === "competitor") rawScore += scoreCompetitor(text);
  if (signal.type === "contract") rawScore += scoreContract(text);
  if (signal.type === "tender") rawScore += scoreTenderSignal(text);

  const grade = inferGrade(signal.type, rawScore, text);
  const score = grade === "S" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : 1;
  return {
    rawScore,
    score,
    grade,
    matchedKeywords: matched,
    reason: buildReason(signal.type, matched, text, grade),
    suggestedAction: suggestedAction(signal.type, grade)
  };
}

function embeddedCompanyScore(signal: SignalInput): SignalScore | null {
  if (signal.type !== "company" || typeof signal.rawJson !== "object" || signal.rawJson === null) return null;
  const scoring = (signal.rawJson as Record<string, unknown>).scoring;
  if (typeof scoring !== "object" || scoring === null) return null;
  const record = scoring as Record<string, unknown>;
  if (typeof record.rawScore !== "number" || typeof record.score !== "number") return null;
  const grade = record.grade === "S" || record.grade === "A" || record.grade === "B" || record.grade === "C" ? record.grade : "C";
  return {
    rawScore: record.rawScore,
    score: record.score,
    grade,
    matchedKeywords: Array.isArray(record.matchedKeywords) ? record.matchedKeywords.map(String) : [],
    reason: typeof record.reason === "string" ? record.reason : "桃園新公司規則評分",
    suggestedAction: typeof record.suggestedAction === "string" ? record.suggestedAction : "人工確認公司與地址後再開發。"
  };
}

function keywordsFor(type: SignalType) {
  if (type === "hiring") return [...hiringKeywords, ...highValueIndustries, ...taoyuanKeywords];
  if (type === "move") return [...moveKeywords, ...officeKeywords, ...taoyuanKeywords];
  if (type === "competitor") return [...competitorBrands, ...complaintKeywords];
  if (type === "contract") return [...contractKeywords, ...officeKeywords];
  if (type === "company") return [...highValueIndustries, ...taoyuanKeywords, "辦公室", "櫃台", "文件", "開幕", "新成立"];
  if (type === "tender") return officeKeywords;
  return officeKeywords;
}

function scoreCompany(text: string, publishedAt?: Date) {
  let score = 1;
  if (hasAny(text, highValueIndustries)) score += 8;
  if (publishedAt && Date.now() - publishedAt.getTime() <= 90 * 24 * 60 * 60 * 1000) score += 4;
  if (publishedAt && Date.now() - publishedAt.getTime() <= 30 * 24 * 60 * 60 * 1000) score += 1;
  if (hasAny(text, taoyuanKeywords)) score += 3;
  if (hasAny(text, ["辦公室", "櫃台", "文件"])) score += 2;
  if (hasAny(text, ["新開幕", "開幕", "新成立", "新辦公室", "新門市"])) score += 2;
  return score;
}

function scoreHiring(text: string) {
  let score = hasAny(text, hiringKeywords) ? 6 : 1;
  if (hasAny(text, highValueIndustries)) score += 5;
  if (hasAny(text, taoyuanKeywords)) score += 2;
  return score;
}

function scoreMove(text: string) {
  let score = hasAny(text, moveKeywords) ? 7 : 1;
  if (hasAny(text, officeKeywords)) score += 4;
  if (hasAny(text, taoyuanKeywords)) score += 2;
  return score;
}

function scoreCompetitor(text: string) {
  let score = hasAny(text, competitorBrands) ? 4 : 0;
  if (hasAny(text, ["想換廠商", "租約到期", "求推薦"])) score += 8;
  if (hasAny(text, complaintKeywords)) score += 5;
  return score;
}

function scoreContract(text: string) {
  return hasAny(text, contractKeywords) ? 15 : 0;
}

function scoreTenderSignal(text: string) {
  let score = hasAny(text, ["租賃", "維護", "保養", "多功能事務機", "事務機租賃"]) ? 10 : 0;
  if (hasAny(text, officeKeywords)) score += 4;
  return score;
}

function inferGrade(type: SignalType, rawScore: number, text: string): "S" | "A" | "B" | "C" {
  if (type === "contract" && hasAny(text, contractKeywords)) return "S";
  if (type === "competitor" && hasAny(text, competitorBrands) && hasAny(text, ["想換廠商", "租約到期", "求推薦"])) return "S";
  if (type === "company" && hasAny(text, highValueIndustries) && rawScore >= 12) return "S";
  if (type === "company" && rawScore >= 8) return "A";
  if (type === "company" && rawScore >= 5) return "B";
  if (rawScore >= 13) return "S";
  if (rawScore >= 8) return "A";
  if (rawScore >= 4) return "B";
  return "C";
}

function buildReason(type: SignalType, matched: string[], text: string, grade: string) {
  const parts = [`訊號類型 ${type}`, `分級 ${grade}`];
  if (matched.length) parts.push(`命中 ${matched.join("、")}`);
  if (hasAny(text, highValueIndustries)) parts.push("高價值行業");
  if (hasAny(text, taoyuanKeywords)) parts.push("桃園優先區域");
  if (hasAny(text, contractKeywords)) parts.push("接近換約或換廠商需求");
  return parts.join("；");
}

function suggestedAction(type: SignalType, grade: string) {
  if (grade === "S") return type === "tender" ? "優先確認標案資格與投標期限" : "優先人工查看原文，整理可自然回覆的專業建議";
  if (grade === "A") return "加入觀察清單，確認是否適合主動留言";
  return "先觀察，不急著互動";
}

function collectMatches(text: string, keywords: string[]) {
  return [...new Set(keywords.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase())))];
}

function hasAny(text: string, keywords: string[]) {
  return collectMatches(text, keywords).length > 0;
}
