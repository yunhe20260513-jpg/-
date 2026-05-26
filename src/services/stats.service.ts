import { prisma } from "../prisma/client";

export async function getTodayStats() {
  const date = todayKey();
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { post: true }
  });

  const keywordCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const signalCounts = new Map<string, number>();

  for (const lead of leads) {
    sourceCounts.set(lead.post.source, (sourceCounts.get(lead.post.source) ?? 0) + 1);
    for (const keyword of parseJson<string[]>(lead.matchedKeywords, [])) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
    for (const signal of parseJson<string[]>(lead.signalTypes, [])) {
      signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
    }
  }

  const data = {
    date,
    newLeadCount: leads.length,
    sGradeCount: leads.filter((lead) => lead.grade === "S").length,
    topKeywordsJson: JSON.stringify(topEntries(keywordCounts, 10)),
    sourceCountsJson: JSON.stringify(Object.fromEntries(sourceCounts)),
    signalCountsJson: JSON.stringify(Object.fromEntries(signalCounts))
  };

  const saved = await prisma.dailyStats.upsert({
    where: { date },
    update: data,
    create: data
  });

  const tenderStats = await getTenderTodayStats(start, end);
  const signalStats = await getSignalTodayStats(start, end);

  return {
    ...saved,
    topKeywords: parseJson(saved.topKeywordsJson, []),
    sourceCounts: parseJson(saved.sourceCountsJson, {}),
    signalCounts: parseJson(saved.signalCountsJson, {}),
    tender: tenderStats,
    signalCenter: signalStats
  };
}

async function getTenderTodayStats(start: Date, end: Date) {
  const todayTenders = await prisma.tenderLead.findMany({
    where: { createdAt: { gte: start, lt: end } }
  });
  const closingSoon = await prisma.tenderLead.count({
    where: {
      deadlineDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      },
      status: { not: "ignored" }
    }
  });
  return {
    newTenderCount: todayTenders.length,
    sGradeTenderCount: todayTenders.filter((tender) => tender.grade === "S").length,
    closingSoonCount: closingSoon
  };
}

async function getSignalTodayStats(start: Date, end: Date) {
  const signals = await prisma.signal.findMany({ where: { createdAt: { gte: start, lt: end } } });
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weeklySignals = await prisma.signal.findMany({ where: { createdAt: { gte: weekStart } } });
  const typeCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();

  for (const signal of signals) {
    typeCounts.set(signal.type, (typeCounts.get(signal.type) ?? 0) + 1);
    sourceCounts.set(signal.source, (sourceCounts.get(signal.source) ?? 0) + 1);
    for (const keyword of parseJson<string[]>(signal.matchedKeywords, [])) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }

  return {
    todaySGradeCount: signals.filter((signal) => signal.grade === "S").length,
    todayTenderSignals: signals.filter((signal) => signal.type === "tender").length,
    todayCompanySignals: signals.filter((signal) => signal.type === "company").length,
    todayContractSignals: signals.filter((signal) => signal.type === "contract").length,
    todayCompetitorSignals: signals.filter((signal) => signal.type === "competitor").length,
    topKeywords: topEntries(keywordCounts, 10),
    sourceCounts: Object.fromEntries(sourceCounts),
    typeCounts: Object.fromEntries(typeCounts),
    weeklyTrend: buildWeeklyTrend(weeklySignals),
    company: companySignalStats(signals.filter((signal) => signal.type === "company"))
  };
}

function companySignalStats(signals: { publishedAt: Date | null; summary: string | null; rawJson: string | null }[]) {
  const latestDate = signals
    .map((signal) => signal.publishedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const industries = new Map<string, number>();
  const regions = new Map<string, number>();

  for (const signal of signals) {
    const parsed = parseJson<Record<string, unknown>>(signal.rawJson ?? "{}", {});
    const fia = typeof parsed.fia === "object" && parsed.fia !== null ? (parsed.fia as Record<string, unknown>) : {};
    const industry =
      typeof parsed.industryName === "string"
        ? parsed.industryName
        : typeof fia.industryNm === "string"
          ? fia.industryNm
          : undefined;
    const address =
      typeof parsed.address === "string"
        ? parsed.address
        : typeof fia.businessAddress === "string"
          ? fia.businessAddress
          : signal.summary ?? "";

    if (industry) industries.set(industry, (industries.get(industry) ?? 0) + 1);
    const region = inferRegion(address);
    if (region) regions.set(region, (regions.get(region) ?? 0) + 1);
  }

  return {
    latestSetupDate: latestDate?.toISOString() ?? null,
    highValueIndustries: Object.fromEntries(industries),
    regionCounts: Object.fromEntries(regions)
  };
}

function inferRegion(text: string) {
  const match = text.match(/(台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/);
  return match?.[1]?.replace("臺", "台");
}

function buildWeeklyTrend(signals: { createdAt: Date }[]) {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    const key = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" }).format(signal.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

function todayKey() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
