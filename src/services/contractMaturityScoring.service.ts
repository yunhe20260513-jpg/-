import { prisma } from "../prisma/client";

const HIGH_DOCUMENT_KEYWORDS = [
  "診所",
  "牙醫",
  "補習班",
  "安親班",
  "房仲",
  "不動產",
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
  if (ageMonths < 30 || ageMonths > 48) return null;

  const text = [company.name, company.industryName, company.address, company.rawJson].filter(Boolean).join(" ");
  const matchedKeywords = HIGH_DOCUMENT_KEYWORDS.filter((keyword) => text.includes(keyword));
  if (!matchedKeywords.length) return null;

  let priorityScore = 50;
  const reasons = [`公司成立約 ${formatAge(ageMonths)}，可能進入第一輪 OA/影印機租賃換約期。`];

  if (ageMonths >= 30 && ageMonths <= 42) {
    priorityScore += 5;
    reasons.push("成立時間落在 36 個月正負 6 個月的高機率換約帶。");
  }

  if (String(company.useInvoice ?? "").includes("Y") || String(company.useInvoice ?? "").includes("是")) {
    priorityScore += 2;
    reasons.push("使用統一發票，較可能有正式營運與文件需求。");
  }

  if (Number(company.capitalAmount ?? 0) > 1_000_000) {
    priorityScore += 2;
    reasons.push("資本額超過 100 萬。");
  }

  if (PRIORITY_DISTRICTS.some((keyword) => company.address.includes(keyword))) {
    priorityScore += 2;
    reasons.push("位於桃園優先開發區域。");
  }

  const corroborating = await findCorroboratingSignals(company);
  if (corroborating.length) {
    priorityScore += 10;
    reasons.push(`同時存在其他需求訊號：${corroborating.join("、")}。`);
  }

  const grade = priorityScore >= 65 ? "S" : priorityScore >= 58 ? "A" : "B";
  const score = grade === "S" ? 5 : grade === "A" ? 4 : 3;

  return {
    rawScore: priorityScore,
    score,
    grade,
    priorityScore,
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
  if (type === "social") return "設備問題";
  if (type === "contract") return "租約到期";
  return type;
}

function suggestedActionFor(text: string) {
  if (text.includes("診所") || text.includes("牙醫")) {
    return "可詢問目前事務機是否即將到期，主打維修速度與掃描穩定性。";
  }
  if (text.includes("補習班") || text.includes("安親班")) {
    return "可主打大量列印與月租方案，詢問是否有舊機換約需求。";
  }
  if (text.includes("房仲") || text.includes("不動產")) {
    return "可詢問目前合約是否即將到期，強調快速維修與低停機時間。";
  }
  return "可先確認目前設備品牌與租約狀態，再評估是否有換約需求。";
}
