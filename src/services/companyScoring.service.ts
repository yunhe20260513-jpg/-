export const sGradeCompanyKeywords = [
  "診所",
  "牙醫",
  "醫美",
  "藥局",
  "復健",
  "物理治療",
  "補習班",
  "安親班",
  "幼兒園",
  "托嬰中心",
  "會計師",
  "記帳士",
  "律師",
  "地政士",
  "代書",
  "房仲",
  "不動產仲介",
  "保險",
  "人力仲介",
  "報關",
  "物流",
  "倉儲"
];

export const aGradeCompanyKeywords = [
  "工程",
  "貿易",
  "科技",
  "管理顧問",
  "建設",
  "室內裝修",
  "資訊",
  "顧問"
];

const lowValueCompanyKeywords = ["工作室", "個人工作室", "接案", "家庭代工"];
const priorityDistrictKeywords = ["桃園區", "中壢", "青埔", "蘆竹", "龜山"];

export function scoreCompanyCache(input: {
  name: string;
  industryName?: string | null;
  address: string;
  setupDate?: Date | null;
  capitalAmount?: string | null;
  organizationType?: string | null;
  useInvoice?: string | null;
}) {
  const text = [input.name, input.industryName, input.address, input.organizationType].filter(Boolean).join(" ");
  let rawScore = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of sGradeCompanyKeywords) {
    if (text.includes(keyword)) matchedKeywords.push(keyword);
  }
  const aMatches = aGradeCompanyKeywords.filter((keyword) => text.includes(keyword));
  matchedKeywords.push(...aMatches);

  const ageDays = input.setupDate ? Math.floor((Date.now() - input.setupDate.getTime()) / (24 * 60 * 60 * 1000)) : undefined;
  const isRecent90 = ageDays !== undefined && ageDays <= 90;
  const isRecent180 = ageDays !== undefined && ageDays <= 180;
  const isTaoyuan = isTaoyuanAddress(input.address);
  const hasSIndustry = sGradeCompanyKeywords.some((keyword) => text.includes(keyword));
  const hasAIndustry = aMatches.length > 0;

  if (isTaoyuan) rawScore += 5;
  if (isRecent90) rawScore += 6;
  else if (isRecent180) rawScore += 3;

  if (hasSIndustry) rawScore += 10;
  else if (hasAIndustry) rawScore += 6;

  rawScore += capitalScore(input.capitalAmount);
  rawScore += organizationScore(input.organizationType);
  if (String(input.useInvoice ?? "").toUpperCase() === "Y") rawScore += 2;
  if (priorityDistrictKeywords.some((keyword) => input.address.includes(keyword))) rawScore += 2;
  if (lowValueCompanyKeywords.some((keyword) => text.includes(keyword))) rawScore -= 4;

  const grade =
    isTaoyuan && isRecent90 && hasSIndustry
      ? "S"
      : isTaoyuan && isRecent180 && (hasSIndustry || hasAIndustry || rawScore >= 11)
        ? "A"
        : isTaoyuan && rawScore >= 6
          ? "B"
          : "C";
  const score = grade === "S" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : 1;

  return {
    rawScore,
    score,
    grade,
    matchedKeywords: [...new Set(matchedKeywords)],
    reason: [
      "桃園新成立公司",
      isRecent90 ? "最近 90 天內設立" : isRecent180 ? "最近 180 天內設立" : "設立時間較久",
      hasSIndustry ? "命中 S 級高價值行業" : hasAIndustry ? "命中 A 級行業" : "行業價值待確認",
      input.capitalAmount ? `資本額 ${Number(input.capitalAmount).toLocaleString("zh-TW")}` : "",
      input.useInvoice ? `統一發票 ${input.useInvoice}` : "",
      `分級 ${grade}`
    ]
      .filter(Boolean)
      .join("；"),
    suggestedAction:
      grade === "S"
        ? "優先 Google 搜尋公司與 Google Maps 地址，確認是否已開業，適合人工開發影印機/事務機租賃或維護需求。"
        : grade === "A"
          ? "可加入觀察名單，確認是否有辦公室、櫃台或文件處理需求。"
          : "先觀察，不急著聯繫。"
  };
}

export function isTaoyuanAddress(address: string) {
  return [
    "桃園市",
    "桃園區",
    "中壢區",
    "平鎮區",
    "八德區",
    "蘆竹區",
    "龜山區",
    "楊梅區",
    "龍潭區",
    "大溪區",
    "大園區",
    "觀音區",
    "新屋區",
    "復興區",
    "中壢",
    "內壢",
    "南崁",
    "青埔"
  ].some((keyword) => address.includes(keyword));
}

function capitalScore(value?: string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  if (amount >= 5_000_000) return 5;
  if (amount >= 1_000_000) return 3;
  if (amount >= 500_000) return 1;
  return 0;
}

function organizationScore(value?: string | null) {
  const text = value ?? "";
  if (text.includes("股份有限公司")) return 3;
  if (text.includes("有限公司")) return 2;
  if (text.includes("行號") || text.includes("獨資") || text.includes("合夥")) return 1;
  return 0;
}
