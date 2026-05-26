import OpenAI from "openai";
import { env } from "../config/env";
import { RuleScoreResult } from "./ruleScoring.service";

export async function maybeAnalyzeWithAI(content: string, current: RuleScoreResult): Promise<Partial<RuleScoreResult> | null> {
  if (!env.USE_AI_ANALYSIS || !env.OPENAI_API_KEY) return null;
  if (env.AI_ONLY_WHEN_UNCERTAIN && ![2, 3].includes(current.score)) return null;

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "你是商機判斷助手。只輸出 JSON，不要自動留言，不要鼓勵 spam。判斷辦公室設備維修、租賃、換廠商相關需求。"
      },
      {
        role: "user",
        content: `請分析這段公開網頁內容是否有商業需求、抱怨、購買或換廠商意圖，分數 1-5，並給自然留言建議：\n\n${content}`
      }
    ]
  });

  const text = completion.choices[0]?.message.content;
  if (!text) return null;
  const parsed = JSON.parse(text);
  return {
    isRelevant: Boolean(parsed.is_relevant),
    isBusinessNeed: Boolean(parsed.is_business_need),
    isComplaint: Boolean(parsed.is_complaint),
    hasBuyingIntent: Boolean(parsed.has_buying_intent),
    isLowValue: Boolean(parsed.is_low_value),
    score: Number(parsed.lead_score ?? current.score),
    urgency: Number(parsed.urgency ?? current.urgency),
    reason: parsed.reason ?? current.reason,
    summary: parsed.summary ?? current.summary,
    suggestedReply: parsed.suggested_reply ?? current.suggestedReply,
    customerType: parsed.customer_type ?? current.customerType,
    recommendedAction: parsed.recommended_action ?? current.recommendedAction
  };
}
