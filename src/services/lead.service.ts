import { SourcePost } from "@prisma/client";
import { prisma } from "../prisma/client";
import { maybeAnalyzeWithAI } from "./aiAnalyzer.service";
import { RuleScoreResult, scorePost } from "./ruleScoring.service";
import { getActiveKeywords } from "./keyword.service";
import { logger } from "../utils/logger";

export async function analyzeAndCreateLead(post: SourcePost) {
  if (!isRealLeadPost(post)) return null;

  const keywords = await getActiveKeywords();
  const contentForScoring = [post.title, post.snippet, post.content].filter(Boolean).join("\n");
  const ruleResult = scorePost(contentForScoring, post.publishedAt, keywords);
  const aiResult = await maybeAnalyzeWithAI(contentForScoring, ruleResult).catch((error) => {
    logger.warn("AI analysis failed, keeping rule result", error);
    return null;
  });

  const result: RuleScoreResult = { ...ruleResult, ...aiResult };
  if (!shouldCreateLead(result)) return null;

  const reason = withSourceReason(result.reason, getVerificationStatus(post.rawJson));

  return prisma.lead.upsert({
    where: { postId: post.id },
    update: {
      rawScore: ruleResult.rawScore,
      score: result.score,
      grade: result.grade,
      signalTypes: JSON.stringify(result.signalTypes),
      urgency: result.urgency,
      isRelevant: result.isRelevant,
      isBusinessNeed: result.isBusinessNeed,
      isComplaint: result.isComplaint,
      hasBuyingIntent: result.hasBuyingIntent,
      isLowValue: result.isLowValue,
      customerType: result.customerType,
      matchedKeywords: JSON.stringify(result.matchedKeywords),
      reason,
      summary: result.summary,
      suggestedReply: result.suggestedReply,
      recommendedAction: result.recommendedAction
    },
    create: {
      postId: post.id,
      rawScore: ruleResult.rawScore,
      score: result.score,
      grade: result.grade,
      signalTypes: JSON.stringify(result.signalTypes),
      urgency: result.urgency,
      isRelevant: result.isRelevant,
      isBusinessNeed: result.isBusinessNeed,
      isComplaint: result.isComplaint,
      hasBuyingIntent: result.hasBuyingIntent,
      isLowValue: result.isLowValue,
      customerType: result.customerType,
      matchedKeywords: JSON.stringify(result.matchedKeywords),
      reason,
      summary: result.summary,
      suggestedReply: result.suggestedReply,
      recommendedAction: result.recommendedAction
    }
  });
}

function isRealLeadPost(post: SourcePost) {
  if (post.isMock) return false;
  if (!post.url || post.url.includes("mock")) return false;
  try {
    const parsed = new URL(post.url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function shouldCreateLead(result: RuleScoreResult) {
  if (result.category !== "office_equipment_need") return false;
  if (result.score < 3) return false;
  if (result.isLowValue) return false;
  if (result.grade === "C") return false;
  return true;
}

function getVerificationStatus(rawJson: string | null) {
  if (!rawJson) return "unknown";
  try {
    const parsed = JSON.parse(rawJson);
    return parsed?.pageVerification?.status ?? "unknown";
  } catch {
    return "unknown";
  }
}

function withSourceReason(reason: string, verificationStatus: string) {
  if (verificationStatus === "verified") return `原文頁面已驗證：${reason}`;
  if (verificationStatus === "unverified") return `搜尋結果 URL 為真實連結，但原文頁不可抓取：${reason}`;
  return reason;
}
