import { Keyword } from "@prisma/client";
import { generateReply, hasOfficeEquipmentSignal } from "./replyTemplate.service";

export type PostCategory = "office_equipment_need" | "general_business" | "hiring" | "outsourcing" | "unrelated";

export type RuleScoreResult = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
  category: PostCategory;
  signalTypes: string[];
  urgency: number;
  isRelevant: boolean;
  isBusinessNeed: boolean;
  isComplaint: boolean;
  hasBuyingIntent: boolean;
  isLowValue: boolean;
  customerType: string;
  matchedKeywords: string[];
  matchedGroups: string[];
  reason: string;
  summary: string;
  suggestedReply: string;
  recommendedAction: string;
};

const productWords = ["影印機", "事務機", "複合機", "印表機", "雷射印表機", "掃描器", "列印", "掃描", "OA"];
const rentalWords = ["租影印機", "影印機租賃", "事務機租賃", "印表機租賃", "租約到期", "合約快到", "想換廠商", "換租賃商"];
const hiringWords = ["徵人", "徵才", "職缺", "薪資", "面試", "小編", "行政助理", "外包人員"];
const outsourcingWords = ["外包", "接案", "短影音", "社群小編", "剪輯", "設計外包"];

function toLeadScore(rawScore: number) {
  if (rawScore <= 1) return 1;
  if (rawScore <= 4) return 2;
  if (rawScore <= 8) return 3;
  if (rawScore <= 12) return 4;
  return 5;
}

function inferCustomerType(content: string) {
  if (hasAny(content, ["診所", "牙醫", "醫美", "藥局"])) return "醫療/診所";
  if (hasAny(content, ["補習班", "安親班", "幼兒園", "托嬰"])) return "教育機構";
  if (hasAny(content, ["會計師", "律師", "地政士", "記帳士", "事務所"])) return "專業事務所";
  if (hasAny(content, ["公司", "辦公室", "總務", "行政", "採購"])) return "公司行政/總務";
  if (hasAny(content, ["學生", "作業", "報告"])) return "學生";
  if (hasAny(content, ["家用", "家裡", "個人用"])) return "家用";
  return "未知";
}

function recencyBonus(publishedAt: Date | null | undefined) {
  if (!publishedAt) return { bonus: 0, label: "時間未知" };
  const ageDays = (Date.now() - publishedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays <= 1) return { bonus: 1, label: "24 小時內" };
  if (ageDays <= 7) return { bonus: 0, label: "7 天內" };
  if (ageDays <= 30) return { bonus: 0, label: "30 天內" };
  if (ageDays <= 90) return { bonus: -1, label: "90 天內" };
  return { bonus: -5, label: "超過 90 天" };
}

export function classifyPost(content: string): PostCategory {
  const hasProductOrRental = hasOfficeEquipmentSignal(content) || hasAny(content, rentalWords);
  if (hasProductOrRental) return "office_equipment_need";
  if (hasAny(content, outsourcingWords)) return "outsourcing";
  if (hasAny(content, hiringWords)) return "hiring";
  if (hasAny(content, ["公司", "辦公室", "創業", "開店", "新辦公室"])) return "general_business";
  return "unrelated";
}

export function scorePost(content: string, publishedAt: Date | null | undefined, keywords: Keyword[]): RuleScoreResult {
  const category = classifyPost(content);
  if (category !== "office_equipment_need") {
    return nonOfficeResult(content, category);
  }

  const matched = keywords.filter((keyword) => content.includes(keyword.value));
  const matchedKeywords = [...new Set(matched.map((keyword) => keyword.value))];
  const matchedGroups = [...new Set(matched.map((keyword) => keyword.group))];
  const hasGroup = (group: string) => matchedGroups.includes(group);

  let rawScore = matched.reduce((sum, keyword) => sum + keyword.weight, 0);
  const recency = recencyBonus(publishedAt);
  rawScore += recency.bonus;

  if (hasGroup("business_context") && hasGroup("pain_signal")) rawScore += 2;
  if (hasGroup("business_context") && hasGroup("switch_signal")) rawScore += 4;
  if (hasGroup("high_value_industry") && hasGroup("pain_signal")) rawScore += 3;
  if (hasGroup("growth_signal") && hasGroup("product_core")) rawScore += 3;
  if (hasGroup("switch_signal") && hasGroup("high_value_industry")) rawScore += 4;
  if (hasGroup("new_business_signal") && hasGroup("product_core")) rawScore += 3;

  if (hasAny(content, ["學生", "作業", "報告"])) rawScore -= 5;
  if (hasAny(content, ["家用", "個人用", "家裡", "宿舍"])) rawScore -= 5;
  if (hasAny(content, ["DIY", "自己修"])) rawScore -= 4;
  if (hasAny(content, ["超商列印", "7-11列印", "全家列印", "影印店"])) rawScore -= 5;
  if (hasAny(content, ["二手", "便宜印表機"])) rawScore -= 3;

  const signalTypes = inferSignalTypes(matchedGroups);
  const score = toLeadScore(rawScore);
  const isLowValue = hasGroup("low_value_exclusion");
  const isBusinessNeed =
    hasGroup("business_context") ||
    hasGroup("high_value_industry") ||
    hasGroup("switch_signal") ||
    hasGroup("growth_signal") ||
    hasGroup("new_business_signal");
  const isComplaint = hasGroup("pain_signal");
  const hasBuyingIntent = hasGroup("switch_signal");
  const grade = inferGrade(score, matchedGroups, isBusinessNeed);
  const urgency = Math.min(5, Math.max(1, score + (hasBuyingIntent ? 1 : 0) + (isComplaint ? 1 : 0) - (isLowValue ? 2 : 0)));
  const shouldAct = grade === "S" || grade === "A" || (grade === "B" && !isLowValue);

  const reasonParts = [
    "分類：office_equipment_need",
    matchedKeywords.length ? `命中關鍵字：${matchedKeywords.join("、")}` : "未命中明確關鍵字",
    signalTypes.length ? `訊號類型：${signalTypes.join("、")}` : "訊號類型不明確",
    `時間：${recency.label}`,
    isLowValue ? "含低價值訊號" : "未命中明顯低價值排除詞",
    isBusinessNeed ? "具商業需求線索" : "商業需求較弱"
  ];

  return {
    rawScore,
    score,
    grade,
    category,
    signalTypes,
    urgency,
    isRelevant: score >= 2,
    isBusinessNeed,
    isComplaint,
    hasBuyingIntent,
    isLowValue,
    customerType: inferCustomerType(content),
    matchedKeywords,
    matchedGroups,
    reason: reasonParts.join("；"),
    summary: content.length > 180 ? `${content.slice(0, 180)}...` : content,
    suggestedReply: generateReply(matchedKeywords, content),
    recommendedAction: shouldAct ? "人工查看原文並評估是否自然回覆" : score >= 2 ? "觀察" : "忽略"
  };
}

function nonOfficeResult(content: string, category: PostCategory): RuleScoreResult {
  return {
    rawScore: 0,
    score: 1,
    grade: "C",
    category,
    signalTypes: [],
    urgency: 1,
    isRelevant: false,
    isBusinessNeed: false,
    isComplaint: false,
    hasBuyingIntent: false,
    isLowValue: true,
    customerType: inferCustomerType(content),
    matchedKeywords: [],
    matchedGroups: [],
    reason: `分類：${category}；未命中 OA/影印機/印表機/掃描/租賃等必要產品或租賃詞，不建立商機。`,
    summary: content.length > 180 ? `${content.slice(0, 180)}...` : content,
    suggestedReply: "",
    recommendedAction: "忽略"
  };
}

function inferSignalTypes(groups: string[]) {
  const signals: string[] = [];
  if (groups.includes("pain_signal")) signals.push("痛點");
  if (groups.includes("switch_signal")) signals.push("更換/租賃");
  if (groups.includes("growth_signal")) signals.push("成長");
  if (groups.includes("new_business_signal")) signals.push("新商家");
  return signals;
}

function inferGrade(score: number, groups: string[], isBusinessNeed: boolean): "S" | "A" | "B" | "C" {
  if (score === 5 && groups.includes("switch_signal") && (groups.includes("business_context") || groups.includes("high_value_industry"))) {
    return "S";
  }
  if (score >= 4 && isBusinessNeed && (groups.includes("pain_signal") || groups.includes("growth_signal") || groups.includes("switch_signal"))) {
    return "A";
  }
  if (score >= 3) return "B";
  return "C";
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}
