import { Keyword } from "@prisma/client";
import { generateReply } from "./replyTemplate.service";

export type RuleScoreResult = {
  rawScore: number;
  score: number;
  grade: "S" | "A" | "B" | "C";
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

function toLeadScore(rawScore: number) {
  if (rawScore <= 1) return 1;
  if (rawScore <= 4) return 2;
  if (rawScore <= 8) return 3;
  if (rawScore <= 12) return 4;
  return 5;
}

function inferCustomerType(content: string) {
  if (content.includes("學生")) return "學生";
  if (content.includes("家用") || content.includes("家裡") || content.includes("個人用")) return "家用";
  if (content.includes("總務")) return "總務";
  if (content.includes("行政")) return "公司行政";
  if (content.includes("老闆")) return "老闆";
  if (content.includes("診所")) return "診所";
  if (content.includes("牙醫")) return "牙醫";
  if (content.includes("補習班")) return "補習班";
  if (content.includes("事務所")) return "專業事務所";
  if (content.includes("門市")) return "門市";
  if (content.includes("公司") || content.includes("辦公室")) return "公司";
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

export function scorePost(content: string, publishedAt: Date | null | undefined, keywords: Keyword[]): RuleScoreResult {
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

  if (content.includes("學生") || content.includes("作業") || content.includes("報告")) rawScore -= 5;
  if (content.includes("家用") || content.includes("個人用") || content.includes("家裡")) rawScore -= 5;
  if (content.includes("DIY") || content.includes("自己修")) rawScore -= 4;
  if (content.includes("超商列印") || content.includes("影印店")) rawScore -= 5;
  if (content.includes("二手") || content.includes("便宜印表機")) rawScore -= 3;

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
    matchedKeywords.length ? `命中 ${matchedKeywords.join("、")}` : "未命中主要需求訊號",
    signalTypes.length ? `訊號：${signalTypes.join("、")}` : "訊號不明",
    `時間：${recency.label}`,
    isLowValue ? "含低價值/非商用訊號" : "未見明顯低價值訊號",
    isBusinessNeed ? "像商業需求" : "商務需求不明"
  ];

  return {
    rawScore,
    score,
    grade,
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
    recommendedAction: shouldAct ? "人工回覆" : score >= 2 ? "觀察" : "忽略"
  };
}

function inferSignalTypes(groups: string[]) {
  const signals: string[] = [];
  if (groups.includes("pain_signal")) signals.push("痛點");
  if (groups.includes("switch_signal")) signals.push("更換");
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
