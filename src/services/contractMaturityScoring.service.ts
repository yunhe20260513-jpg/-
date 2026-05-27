import { prisma } from "../prisma/client";

const HIGH_DOCUMENT_KEYWORDS = [
  "診所",
  "牙醫",
  "補習班",
  "安親班",
  "房仲",
  "保險",
  "會計師",
  "律師",
  "記帳士",
  "地政士",
  "工程",
  "設計",
  "貿易"
];

const PRIORITY_DISTRICTS = ["中壢", "桃園區", "蘆竹", "龜山", "青埔"];
const CORROBORATING_TYPES = ["competitor", "move", "hiring", "social", "contract"];

type CompanyForMaturity = {
  taxId: string;
  name: string;
  address: string;
  district: string | null;
  setupDate: Date | null;
  capitalAmount: string | null;
  organizationType: string | null;
  useInvoice: string | null;
  industryName: string | null;
  rawJson: string | null;
};

export async function scoreContractMaturity(company: CompanyForMaturity) {
  if (!company.setupDate) return null;
  const ageMonths = companyAgeMonths(company.setupDate);

  const text = [company.name, company.industryName, company.address, company.rawJson].filter(Boolean).join(" ");
  const matchedKeywords = HIGH_DOCUMENT_KEYWORDS.filter((keyword) => text.includes(keyword));

  let rawScore = 0;
  const reasons: string[] = [`公司成立約 ${formatAge(ageMonths)}，可能進入 OA/影印機租賃換約觀察期。`];

  if (ageMonths >= 30 && ageMonths <= 48) {
    rawScore += 5;
    reasons.push("成立時間落在 30-48 個月，高機率接近三年租約週期。");
  } else if (ageMonths >= 24 && ageMonths <= 60) {
    rawScore += 3;
    reasons.push("成立時間落在 24-60 個月，可列入換約觀察。");
  } else if (ageMonths >= 60 && ageMonths <= 72) {
    rawScore += 2;
    reasons.push("成立時間落在 60-72 個月，可能進入第二輪換約或設備汰換期。");
  } else {
    return null;
  }

  if (ageMonths >= 30 && ageMonths <= 42) {
    rawScore += 2;
    reasons.push("接近 36 個月核心換約區間。");
  }

  if (matchedKeywords.length) {
    rawScore += 5;
    reasons.push(`命中高文件需求產業：${matchedKeywords.join("、")}。`);
  }

  if (String(company.useInvoice ?? "").includes("Y") || String(company.useInvoice ?? "").includes("是")) {
    rawScore += 1;
    reasons.push("有使用統一發票。");
  }

  if (Number(company.capitalAmount ?? 0) > 1_000_000) {
    rawScore += 2;
    reasons.push("資本額超過 100 萬。");
  }

  if (PRIORITY_DISTRICTS.some((keyword) => company.address.includes(keyword))) {
    rawScore += 2;
    reasons.push("位於桃園核心服務區。");
  }

  const corroborating = await findCorroboratingSignals(company);
  if (corroborating.length) {
    rawScore += 10;
    reasons.push(`同時存在關聯訊號：${corroborating.join("、")}。`);
  }

  if (rawScore < 7) return null;

  const grade = rawScore >= 11 ? "S" : rawScore >= 8 ? "A" : "B";
  const score = grade === "S" ? 5 : grade === "A" ? 4 : 3;

  return {
    rawScore,
    score,
    grade,
    priorityScore: rawScore,
    ageMonths,
    matchedKeywords,
    corroboratingSignals: corroborating,
    reason: reasons.join(" "),
    suggestedAction: suggestedActionFor(text)
  };
}

function companyAgeMonths(setupDate: Date) {
  const now = new Date();
  return (now.getFullYear() - setupDate.getFullYear()) * 12 + (now.getMonth() - setupDate.getMonth());
}

function formatAge(ageMonths: number) {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months ? `${years} 年 ${months} 個月` : `${years} 年`;
}

async function findCorroboratingSignals(company: CompanyForMaturity) {
  const candidates = await prisma.signal.findMany({
    where: {
      type: { in: CORROBORATING_TYPES },
      OR: [
        { title: { contains: company.name } },
        { name: { contains: company.name } },
        { summary: { contains: company.name } },
        { rawJson: { contains: company.taxId } }
      ]
    },
    select: { type: true },
    take: 10
  });

  return [...new Set(candidates.map((signal) => labelCorroboratingType(signal.type)))];
}

function labelCorroboratingType(type: string) {
  if (type === "competitor") return "競品抱怨";
  if (type === "move") return "搬遷/擴編";
  if (type === "hiring") return "徵才";
  if (type === "social") return "辦公設備問題";
  if (type === "contract") return "租約到期";
  return type;
}

function suggestedActionFor(text: string) {
  if (text.includes("診所") || text.includes("牙醫")) {
    return "可詢問目前事務機是否即將到期，主打維修速度與掃描穩定性。";
  }
  if (text.includes("補習") || text.includes("安親")) {
    return "可主打大量列印與月租方案，詢問是否有舊機換約需求。";
  }
  if (text.includes("房仲") || text.includes("保險")) {
    return "可詢問目前合約是否即將到期，強調快速維修與低停機時間。";
  }
  return "可先確認目前設備品牌與租約狀態，再評估是否有換約需求。";
}
