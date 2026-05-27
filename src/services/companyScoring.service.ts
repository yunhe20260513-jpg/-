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
  "不動產",
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
  "資訊",
  "管理顧問",
  "建設",
  "室內裝修",
  "設計",
  "旅行社",
  "廣告",
  "行銷",
  "顧問"
];

const lowValueCompanyKeywords = ["工作室", "個人工作室", "接案", "家庭代工", "小吃", "攤販", "網拍"];
const priorityDistrictKeywords = ["桃園區", "中壢", "青埔", "蘆竹", "龜山", "南崁"];

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

  const sMatches = sGradeCompanyKeywords.filter((keyword) => text.includes(keyword));
  const aMatches = aGradeCompanyKeywords.filter((keyword) => text.includes(keyword));
  matchedKeywords.push(...sMatches, ...aMatches);

  const ageDays = input.setupDate ? Math.floor((Date.now() - input.setupDate.getTime()) / (24 * 60 * 60 * 1000)) : undefined;
  const isRecent90 = ageDays !== undefined && ageDays >= 0 && ageDays <= 90;
  const isRecent180 = ageDays !== undefined && ageDays >= 0 && ageDays <= 180;
  const isTaoyuan = isTaoyuanAddress(input.address);
  const hasSIndustry = sMatches.length > 0;
  const hasAIndustry = aMatches.length > 0;
  const isLowValue = lowValueCompanyKeywords.some((keyword) => text.includes(keyword));

  if (isTaoyuan) rawScore += 5;
  if (isRecent90) rawScore += 6;
  else if (isRecent180) rawScore += 3;

  if (hasSIndustry) rawScore += 10;
  else if (hasAIndustry) rawScore += 6;

  rawScore += capitalScore(input.capitalAmount);
  rawScore += organizationScore(input.organizationType);
  if (String(input.useInvoice ?? "").includes("Y") || String(input.useInvoice ?? "").includes("是")) rawScore += 2;
  if (priorityDistrictKeywords.some((keyword) => input.address.includes(keyword))) rawScore += 2;
  if (isLowValue) rawScore -= 6;

  const grade =
    isTaoyuan && isRecent90 && hasSIndustry && !isLowValue
      ? "S"
      : isTaoyuan && isRecent180 && !isLowValue && (hasSIndustry || hasAIndustry || rawScore >= 11)
        ? "A"
        : isTaoyuan && !isLowValue && rawScore >= 6
          ? "B"
          : "C";
  const score = grade === "S" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : 1;

  return {
    rawScore,
    score,
    grade,
    matchedKeywords: [...new Set(matchedKeywords)],
    reason: [
      "桃園營業登記資料",
      isRecent90 ? "最近 90 天內設立" : isRecent180 ? "最近 180 天內設立" : "設立時間較久",
      hasSIndustry ? "命中 S 級高價值行業" : hasAIndustry ? "命中 A 級辦公需求行業" : "行業需求不明確",
      input.capitalAmount ? `資本額 ${Number(input.capitalAmount).toLocaleString("zh-TW")} 元` : "",
      input.useInvoice ? `使用統一發票：${input.useInvoice}` : "",
      `分級：${grade}`
    ]
      .filter(Boolean)
      .join("；"),
    suggestedAction:
      grade === "S"
        ? "優先開發。先用 Google 與 Google Maps 確認是否已開業，再以辦公設備租賃、維修反應時間、耗材全包方案切入。"
        : grade === "A"
          ? "可列入追蹤。確認是否有實體辦公室與文件量，再評估是否主動開發。"
          : "先觀察，不建議投入太多人工時間。"
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
  const amount = Number(String(value ?? "").replace(/[^\d]/g, ""));
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
  if (text.includes("行號") || text.includes("商行") || text.includes("企業社")) return 1;
  return 0;
}
