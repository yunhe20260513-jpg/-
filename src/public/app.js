const $ = (selector) => document.querySelector(selector);

const filters = {
  companyDays: $("#companyDaysFilter"),
  companyDistrict: $("#companyDistrictFilter"),
  companyIndustry: $("#companyIndustryFilter"),
  companyGrade: $("#companyGradeFilter"),
  companyStatus: $("#companyStatusFilter"),
  signalType: $("#signalTypeFilter"),
  signalGrade: $("#signalGradeFilter"),
  signalKeyword: $("#signalKeywordFilter"),
  leadSource: $("#leadSourceFilter"),
  leadGrade: $("#leadGradeFilter"),
  leadKeyword: $("#leadKeywordFilter"),
  tenderGrade: $("#tenderGradeFilter"),
  tenderKeyword: $("#tenderKeywordFilter"),
  tenderAgency: $("#tenderAgencyFilter")
};

$("#scanNow").addEventListener("click", async () => {
  await fetch("/api/scan-now", { method: "POST" });
  await refreshAll();
});

$("#scanCompanyNow").addEventListener("click", async () => {
  await fetch("/api/signals/scan-now", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "company" })
  });
  await refreshAll();
});

$("#scanTendersNow").addEventListener("click", async () => {
  await fetch("/api/tenders/scan-now", { method: "POST" });
  await refreshAll();
});

Object.values(filters).forEach((element) => element.addEventListener("input", refreshAll));

async function refreshAll() {
  await Promise.all([loadStats(), loadCompanies(), loadSignals(), loadLeads(), loadTenders(), loadAdapterStatus(), loadScanLogs()]);
}

async function loadStats() {
  const stats = await fetchJson("/api/stats/today");
  const tender = stats.tender || {};
  const center = stats.signalCenter || {};
  const company = center.company || {};
  $("#todayStats").innerHTML = `
    ${stat(stats.newLeadCount || 0, "今日社群商機")}
    ${stat(tender.newTenderCount || 0, "今日標案")}
    ${stat(center.todayCompanySignals || 0, "今日新公司")}
    ${stat(center.todaySGradeCount || 0, "今日 S 級訊號", "hot")}
    ${stat(center.todayContractSignals || 0, "租約到期/想換廠商")}
    ${stat(center.todayCompetitorSignals || 0, "競品抱怨")}
    ${stat(tender.closingSoonCount || 0, "即將截止標案", "hot")}
    ${stat(company.latestSetupDate ? formatDate(company.latestSetupDate) : "無資料", "最近成立日期")}
    ${stat(formatCounts(company.highValueIndustries), "高價值行業")}
    ${stat(formatCounts(company.regionCounts), "地區分布")}
  `;
}

async function loadCompanies() {
  const params = new URLSearchParams({ type: "company" });
  if (filters.companyDays.value) params.set("days", filters.companyDays.value);
  if (filters.companyDistrict.value.trim()) params.set("district", filters.companyDistrict.value.trim());
  if (filters.companyIndustry.value.trim()) params.set("industry", filters.companyIndustry.value.trim());
  if (filters.companyGrade.value) params.set("grade", filters.companyGrade.value);
  if (filters.companyStatus.value) params.set("status", filters.companyStatus.value);
  const companies = await fetchJson(`/api/signals?${params}`);
  $("#companyList").innerHTML = companies.length ? companies.map(renderCompany).join("") : empty("目前沒有桃園新成立公司資料。若 adapter 顯示 unavailable，代表 ZIP 下載或解析尚未成功。");
  bindSignalActions($("#companyList"));
}

async function loadSignals() {
  const params = new URLSearchParams();
  if (filters.signalType.value) params.set("type", filters.signalType.value);
  if (filters.signalGrade.value) params.set("grade", filters.signalGrade.value);
  if (filters.signalKeyword.value.trim()) params.set("keyword", filters.signalKeyword.value.trim());
  const signals = await fetchJson(`/api/signals?${params}`);
  $("#signalList").innerHTML = signals.length ? signals.map(renderSignal).join("") : empty("目前沒有符合條件的訊號。");
  bindSignalActions($("#signalList"));
}

async function loadLeads() {
  const params = new URLSearchParams();
  if (filters.leadSource.value) params.set("source", filters.leadSource.value);
  if (filters.leadGrade.value) params.set("grade", filters.leadGrade.value);
  if (filters.leadKeyword.value.trim()) params.set("keyword", filters.leadKeyword.value.trim());
  const leads = await fetchJson(`/api/leads?${params}`);
  $("#leadList").innerHTML = leads.length ? leads.map(renderLead).join("") : empty("目前沒有真實社群商機。");
}

async function loadTenders() {
  const params = new URLSearchParams();
  if (filters.tenderGrade.value) params.set("grade", filters.tenderGrade.value);
  if (filters.tenderKeyword.value.trim()) params.set("keyword", filters.tenderKeyword.value.trim());
  if (filters.tenderAgency.value.trim()) params.set("agency", filters.tenderAgency.value.trim());
  const tenders = await fetchJson(`/api/tenders?${params}`);
  $("#tenderList").innerHTML = tenders.length ? tenders.map(renderTender).join("") : empty("目前沒有真實標案資料。");
}

async function loadAdapterStatus() {
  const rows = await fetchJson("/api/adapter-status");
  $("#adapterStatus").innerHTML = rows.length
    ? rows.map((row) => `<div class="row"><b>${escapeHtml(adapterLabel(row.source))}</b><span>${escapeHtml(statusLabel(row.status))}</span><small>${formatDate(row.lastSuccessAt || row.lastRunAt)}</small>${row.errorMessage ? `<em>${escapeHtml(row.errorMessage)}</em>` : ""}</div>`).join("")
    : empty("目前沒有 adapter 狀態。");
}

async function loadScanLogs() {
  const logs = await fetchJson("/api/scan-logs");
  $("#scanLogs").innerHTML = logs.length
    ? logs.slice(0, 12).map((log) => `<div class="row"><b>${escapeHtml(log.source)}</b><span>${escapeHtml(log.status)}</span><span>抓取 ${log.fetchedCount}，建立 ${log.createdLeadCount || 0}</span><small>${formatDate(log.startedAt)}</small>${log.errorMessage ? `<em>${escapeHtml(log.errorMessage)}</em>` : ""}</div>`).join("")
    : empty("目前沒有掃描紀錄。");
}

function renderCompany(signal) {
  const raw = parseJson(signal.rawJson || "{}");
  const mapsUrl = raw.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(signal.summary || signal.title)}`;
  const googleUrl = raw.googleCompanyUrl || `https://www.google.com/search?q=${encodeURIComponent(signal.title)}`;
  return card(signal, `
    <a href="${escapeAttr(googleUrl)}" target="_blank" rel="noopener noreferrer">Google 搜尋公司</a>
    <a href="${escapeAttr(mapsUrl)}" target="_blank" rel="noopener noreferrer">Google Maps 搜尋地址</a>
    <button data-signal-star-id="${signal.id}" data-star="${signal.isStarred}">${signal.isStarred ? "取消收藏" : "收藏"}</button>
    ${statusSelect(signal)}
  `);
}

function renderSignal(signal) {
  return card(signal, `
    <a href="${escapeAttr(signal.url)}" target="_blank" rel="noopener noreferrer">開啟來源</a>
    <button data-signal-star-id="${signal.id}" data-star="${signal.isStarred}">${signal.isStarred ? "取消收藏" : "收藏"}</button>
    ${statusSelect(signal)}
  `);
}

function renderLead(lead) {
  const post = lead.post || {};
  return `
    <article class="lead-card grade-${lead.grade}">
      <div class="lead-head"><span class="grade">${lead.grade}</span><span>${escapeHtml(post.source || "")}</span><span>分數 ${lead.score}</span><span>${escapeHtml(lead.status)}</span></div>
      <h3>${escapeHtml(post.title || firstLine(post.content) || "未命名")}</h3>
      <p>${escapeHtml(lead.summary || post.snippet || "")}</p>
      <div class="keywords">${(lead.matchedKeywords || []).map((word) => `<span>${escapeHtml(word)}</span>`).join("")}</div>
      <div class="reason">${escapeHtml(lead.reason)}</div>
      <blockquote>${escapeHtml(lead.suggestedReply || "")}</blockquote>
      <div class="actions"><a href="${escapeAttr(post.url)}" target="_blank" rel="noopener noreferrer">開啟原文</a></div>
    </article>
  `;
}

function renderTender(tender) {
  return `
    <article class="lead-card grade-${tender.grade}">
      <div class="lead-head"><span class="grade">${tender.grade}</span><span>標案</span><span>分數 ${tender.score}</span><span>${escapeHtml(tender.status)}</span></div>
      <h3>${escapeHtml(tender.tenderName)}</h3>
      <p>${escapeHtml(tender.agencyName || "機關未知")}；標案編號：${escapeHtml(tender.jobNumber)}</p>
      <div class="reason">${escapeHtml(tender.reason)}</div>
      <div class="meta">公告：${formatDate(tender.announceDate)}；截止：${formatDate(tender.deadlineDate)}；預算：${formatBudget(tender.budgetAmount)}</div>
      <div class="actions"><a href="${escapeAttr(tender.url)}" target="_blank" rel="noopener noreferrer">開啟標案</a></div>
    </article>
  `;
}

function card(signal, actions) {
  return `
    <article class="lead-card grade-${signal.grade}">
      <div class="lead-head"><span class="grade">${signal.grade}</span><span>${signalTypeLabel(signal.type)}</span><span>分數 ${signal.score}</span><span>${escapeHtml(signal.status)}</span></div>
      <h3>${highlight(signal.title, signal.matchedKeywords)}</h3>
      <p>${highlight(signal.summary || signal.name || "", signal.matchedKeywords)}</p>
      <div class="keywords">${(signal.matchedKeywords || []).map((word) => `<span>${escapeHtml(word)}</span>`).join("")}</div>
      <div class="reason">${escapeHtml(signal.reason)}</div>
      <blockquote>${escapeHtml(signal.suggestedAction || "")}</blockquote>
      <div class="meta">來源：${escapeHtml(signal.source)}；發生時間：${formatDate(signal.publishedAt)}；抓取：${formatDate(signal.fetchedAt)}</div>
      <div class="actions">${actions}</div>
    </article>
  `;
}

function statusSelect(signal) {
  return `<select data-signal-status="${signal.id}">${["new", "reviewed", "contacted", "ignored", "converted"].map((status) => `<option value="${status}" ${signal.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>`;
}

function bindSignalActions(root) {
  root.querySelectorAll("[data-signal-status]").forEach((select) => select.addEventListener("change", async () => {
    await fetch(`/api/signals/${select.dataset.signalStatus}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) });
    await refreshAll();
  }));
  root.querySelectorAll("[data-signal-star-id]").forEach((button) => button.addEventListener("click", async () => {
    await fetch(`/api/signals/${button.dataset.signalStarId}/star`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isStarred: button.dataset.star !== "true" }) });
    await refreshAll();
  }));
}

function stat(value, label, className = "") {
  return `<div class="stat-card ${className}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function signalTypeLabel(type) {
  return { social: "社群", tender: "標案", company: "新公司", hiring: "徵才", move: "搬遷/擴編", competitor: "競品抱怨", contract: "租約到期" }[type] || type;
}

function adapterLabel(source) {
  return {
    company: "桃園新公司雷達",
    signal_company: "桃園新公司雷達",
    tender: "標案雷達",
    signal_tender: "標案雷達",
    contract: "租約到期雷達",
    signal_contract: "租約到期雷達",
    competitor: "競品抱怨雷達",
    signal_competitor: "競品抱怨雷達",
    ptt: "PTT",
    search_engine: "搜尋引擎",
    signal_move: "搬遷/擴編雷達",
    signal_hiring: "徵才雷達"
  }[source] || source;
}

function statusLabel(status) {
  return {
    success: "成功",
    running: "執行中",
    unavailable: "不可用",
    failed: "錯誤",
    error: "錯誤",
    skipped: "已略過",
    no_results: "無新資料",
    stale: "逾時未完成"
  }[status] || status;
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join("、") : "無資料";
}

function firstLine(text) {
  return String(text || "").split("\n").find(Boolean);
}

function formatDate(value) {
  if (!value) return "未知";
  return new Date(value).toLocaleString("zh-TW");
}

function formatBudget(value) {
  if (!value) return "未知";
  return Number(value).toLocaleString("zh-TW");
}

function highlight(value, keywords) {
  let text = escapeHtml(value || "");
  for (const keyword of keywords || []) {
    if (!keyword) continue;
    text = text.replaceAll(escapeHtml(keyword), `<mark>${escapeHtml(keyword)}</mark>`);
  }
  return text;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value || "#");
}

refreshAll();
setInterval(refreshAll, 60000);
