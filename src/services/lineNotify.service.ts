type NotifyLead = {
  platform: string;
  score: number;
  urgency: number;
  verificationStatus?: string;
  customerType: string;
  matchedKeywords: string[];
  reason: string;
  summary: string;
  url?: string | null;
  suggestedReply: string;
  recommendedAction: string;
};

export async function sendLineNotification(_lead: NotifyLead) {
  return { sent: false, reason: "LINE notification is disabled in this MVP" };
}
