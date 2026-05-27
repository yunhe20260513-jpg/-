import { SignalInput, SignalType } from "../adapters/signal.types";
import { directTenderKeywords, preIntentTenderKeywords, scoreTender } from "./tenderScoring.service";

export type SignalScore = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
  matchedKeywords: string[];
  reason: string;
  suggestedAction: string;
};

const highValueIndustries = ["診所", "牙醫", "醫美", "補習班", "安親班", "會計師", "律師", "地政士", "記帳士", "房仲", "保險", "工程", "設計", "貿易"];
const officeKeywords = ["影印機", "事務機", "複合機", "多功能事務機", "印表機", "掃描器", "OA設備", "辦公設備", "租賃", "維護", "保養", "碳粉", "耗材"];
const hiringKeywords = ["行政", "總務", "辦公室助理", "採購", "徵行政", "徵總務", "新辦公室", "擴編"];
const moveKeywords = ["搬辦公室", "新辦公室", "辦公室搬遷", "新據點", "新分店", "擴編", "開幕", "開店", "新門市"];
const competitorBrands = ["Ricoh", "Canon", "Fuji Xerox", "Fujifilm", "Konica Minolta", "Kyocera", "Sharp", "HP", "Epson", "Brother"];
const complaintKeywords = ["維修很慢", "報修沒人來", "一直壞", "很雷", "想換廠商", "租約到期", "合約快到", "卡紙", "掃描不能用"];
const contractKeywords = ["租約到期", "合約快到", "想換廠商", "換租賃商", "維修太慢", "廠商不處理", "影印機租賃推薦", "事務機租賃推薦", "哪家租影印機好"];
const taoyuanKeywords = ["桃園", "桃園區", "中壢", "平鎮", "八德", "蘆竹", "龜山", "青埔", "南崁"];

export function scoreSignal(signal: SignalInput): SignalScore {
  const embedded = embeddedSignalScore(signal);
  if (embedded) return embedded;

  const text = [signal.title, signal.name, signal.summary].filter(Boolean).join(" ");

  if (signal.type === "tender") {
    const tenderScore = scoreTender({
      source: signal.source,
      tenderName: signal.title,
      agencyName: signal.name,
      jobNumber: signal.url,
      url: signal.url,
      rawJson: signal.rawJson
    });
    return {
      rawScore: tenderScore.rawScore,
      score: tenderScore.score,
      grade: tenderScore.grade,
      matchedKeywords: tenderScore.matchedKeywords,
      reason: tenderScore.reason,
      suggestedAction:
        tenderScore.intentType === "pre_intent"
          ? "前置需求，先收藏觀察；可人工確認後續是否會衍生 OA / 辦公設備採購。"
          : "直接需求，優先確認標案資格、截止日期與投標文件。"
    };
  }

  const matched = collectMatches(text, keywordsFor(signal.type));
  let rawScore = matched.length;

  if (signal.type === "company") rawScore += scoreCompany(text, signal.publishedAt);
  if (signal.type === "hiring") rawScore += scoreHiring(text);
  if (signal.type === "move") rawScore += scoreMove(text);
  if (signal.type === "competitor") rawScore += scoreCompetitor(text);
  if (signal.type === "contract") rawScore += scoreContract(text);

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

function embeddedSignalScore(signal: SignalInput): SignalScore | null {
  if ((signal.type !== "company" && signal.type !== "contract_maturity") || typeof signal.rawJson !== "object" || signal.rawJson === null) return null;
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
    reason: typeof record.reason === "string" ? record.reason : "使用內嵌評分結果。",
    suggestedAction: typeof record.suggestedAction === "string" ? record.suggestedAction : "人工檢查公司資料與開發優先順序。"
  };
}

function keywordsFor(type: SignalType) {
  if (type === "hiring") return [...hiringKeywords, ...highValueIndustries, ...taoyuanKeywords];
  if (type === "move") return [...moveKeywords, ...officeKeywords, ...taoyuanKeywords];
  if (type === "competitor") return [...competitorBrands, ...complaintKeywords];
  if (type === "contract") return [...contractKeywords, ...officeKeywords, ...taoyuanKeywords];
  if (type === "company") return [...highValueIndustries, ...taoyuanKeywords, "公司", "辦公室", "新設立"];
  if (type === "tender") return [...directTenderKeywords, ...preIntentTenderKeywords];
  return officeKeywords;
}

function scoreCompany(text: string, publishedAt?: Date) {
  let score = 1;
  if (hasAny(text, highValueIndustries)) score += 8;
  if (publishedAt && Date.now() - publishedAt.getTime() <= 90 * 24 * 60 * 60 * 1000) score += 4;
  if (publishedAt && Date.now() - publishedAt.getTime() <= 30 * 24 * 60 * 60 * 1000) score += 1;
  if (hasAny(text, taoyuanKeywords)) score += 3;
  return score;
}

function scoreHiring(text: string) {
  let score = hasAny(text, hiringKeywords) ? 4 : 1;
  if (hasAny(text, highValueIndustries)) score += 5;
  if (hasAny(text, taoyuanKeywords)) score += 2;
  return score;
}

function scoreMove(text: string) {
  let score = hasAny(text, moveKeywords) ? 6 : 1;
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
  let score = hasAny(text, contractKeywords) ? 12 : 0;
  if (hasAny(text, taoyuanKeywords)) score += 3;
  if (hasAny(text, ["公司", "辦公室"])) score += 2;
  return score;
}

function inferGrade(type: SignalType, rawScore: number, text: string): "S" | "A" | "B" | "C" {
  if (type === "contract" && rawScore >= 12) return "S";
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
  const parts = [`訊號類型：${type}`, `分級：${grade}`];
  if (matched.length) parts.push(`命中：${matched.join("、")}`);
  if (hasAny(text, highValueIndustries)) parts.push("高文件需求產業");
  if (hasAny(text, taoyuanKeywords)) parts.push("桃園相關");
  if (hasAny(text, contractKeywords)) parts.push("高意圖租約/換廠商訊號");
  return parts.join("；");
}

function suggestedAction(type: SignalType, grade: string) {
  if (grade === "S") return type === "tender" ? "優先確認標案資格與投標期限。" : "優先人工查看來源，整理自然開發切入點。";
  if (grade === "A") return "加入追蹤清單，人工確認是否有明確辦公設備需求。";
  return "保留觀察，不要急著開發。";
}

function collectMatches(text: string, keywords: string[]) {
  return [...new Set(keywords.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase())))];
}

function hasAny(text: string, keywords: string[]) {
  return collectMatches(text, keywords).length > 0;
}
