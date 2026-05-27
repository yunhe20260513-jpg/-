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

if (filters.signalType && ![...filters.signalType.options].some((option) => option.value === "contract_maturity")) {
  filters.signalType.add(new Option("\u79df\u7d04\u6210\u719f\u5ea6\u96f7\u9054", "contract_maturity"));
}

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

Object.values(filters).filter(Boolean).forEach((element) => element.addEventListener("input", refreshAll));

async function refreshAll() {
  await Promise.all([loadStats(), loadCompanies(), loadSignals(), loadLeads(), loadTenders(), loadAdapterStatus(), loadScanLogs()]);
}

async function loadStats() {
  document.querySelectorAll(".top-contract-strip").forEach((element) => element.remove());
  const stats = await fetchJson("/api/stats/today");
  const tender = stats.tender || {};
  const center = stats.signalCenter || {};
  const company = center.company || {};
  const topContract = center.topContractMaturity || [];

  $("#todayStats").innerHTML = [
    stat(center.todayCompanySignals || 0, "\u4eca\u65e5\u65b0\u6210\u7acb\u516c\u53f8", "\u5bb6"),
    stat(center.todaySGradeCount || 0, "\u4eca\u65e5 S \u7d1a\u8a0a\u865f", "\u7b46", "hot"),
    stat(tender.newTenderCount || 0, "\u4eca\u65e5\u6a19\u6848", "\u4ef6"),
    stat(center.monthContractMaturityCount || 0, "\u672c\u6708\u53ef\u80fd\u63db\u7d04\u516c\u53f8", "\u5bb6", "hot"),
    stat(tender.closingSoonCount || 0, "\u5373\u5c07\u622a\u6b62\u6a19\u6848", "\u4ef6"),
    stat(company.latestSetupDate ? formatDateOnly(company.latestSetupDate) : 0, "\u6700\u8fd1\u6210\u7acb\u65e5\u671f"),
    stat(formatCounts(company.regionCounts), "\u5730\u5340\u5206\u5e03"),
    stat(formatCounts(company.highValueIndustries), "\u5e38\u898b\u884c\u696d")
  ].join("");

  if (topContract.length) {
    $("#todayStats").insertAdjacentHTML(
      "afterend",
      `<section class="top-contract-panel">
        <div class="mini-section-title"><b>\u9ad8\u50f9\u503c\u63db\u7d04\u540d\u55ae TOP 5</b><span>\u6578\u5b57\u70ba priorityScore\uff0c\u9ede\u64ca\u5f8c\u7528 Google \u67e5\u8a62\u516c\u53f8</span></div>
        <div class="top-contract-strip">${topContract
          .slice(0, 5)
          .map((item) => `<a href="${escapeAttr(companySearchUrl(item.title))}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(item.title)}</span><b>${item.priorityScore}</b></a>`)
          .join("")}</div>
      </section>`
    );
  }
}

async function loadCompanies() {
  const params = new URLSearchParams({ type: "company" });
  if (filters.companyDays.value) params.set("days", filters.companyDays.value);
  if (filters.companyDistrict.value.trim()) params.set("district", filters.companyDistrict.value.trim());
  if (filters.companyIndustry.value.trim()) params.set("industry", filters.companyIndustry.value.trim());
  if (filters.companyGrade.value) params.set("grade", filters.companyGrade.value);
  if (filters.companyStatus.value) params.set("status", filters.companyStatus.value);
  const companies = await fetchJson(`/api/signals?${params}`);
  $("#companyList").innerHTML = companies.length ? companies.map(renderCompany).join("") : empty("\u76ee\u524d\u6c92\u6709\u7b26\u5408\u689d\u4ef6\u7684\u6843\u5712\u516c\u53f8\u8a0a\u865f");
  bindSignalActions($("#companyList"));
}

async function loadSignals() {
  const params = new URLSearchParams();
  if (filters.signalType.value) params.set("type", filters.signalType.value);
  if (filters.signalGrade.value) params.set("grade", filters.signalGrade.value);
  if (filters.signalKeyword.value.trim()) params.set("keyword", filters.signalKeyword.value.trim());
  const signals = await fetchJson(`/api/signals?${params}`);
  $("#signalList").innerHTML = signals.length ? signals.map(renderSignal).join("") : empty("\u76ee\u524d\u6c92\u6709\u7b26\u5408\u689d\u4ef6\u7684\u9700\u6c42\u8a0a\u865f");
  bindSignalActions($("#signalList"));
}

async function loadLeads() {
  const params = new URLSearchParams();
  if (filters.leadSource.value) params.set("source", filters.leadSource.value);
  if (filters.leadGrade.value) params.set("grade", filters.leadGrade.value);
  if (filters.leadKeyword.value.trim()) params.set("keyword", filters.leadKeyword.value.trim());
  const leads = await fetchJson(`/api/leads?${params}`);
  $("#leadList").innerHTML = leads.length ? leads.map(renderLead).join("") : empty("\u76ee\u524d\u6c92\u6709\u793e\u7fa4\u5546\u6a5f");
}

async function loadTenders() {
  const params = new URLSearchParams();
  if (filters.tenderGrade.value) params.set("grade", filters.tenderGrade.value);
  if (filters.tenderKeyword.value.trim()) params.set("keyword", filters.tenderKeyword.value.trim());
  if (filters.tenderAgency.value.trim()) params.set("agency", filters.tenderAgency.value.trim());
  const tenders = await fetchJson(`/api/tenders?${params}`);
  $("#tenderList").innerHTML = tenders.length ? tenders.map(renderTender).join("") : empty("\u76ee\u524d\u6c92\u6709\u6a19\u6848\u8cc7\u6599");
}

async function loadAdapterStatus() {
  const rows = await fetchJson("/api/adapter-status");
  $("#adapterStatus").innerHTML = rows.length
    ? rows.map((row) => `<div class="row"><b>${escapeHtml(adapterLabel(row.source))}</b><span>${escapeHtml(statusLabel(row.status))}</span><small>${formatDate(row.lastSuccessAt || row.lastRunAt)}</small>${row.errorMessage ? `<em>${escapeHtml(row.errorMessage)}</em>` : ""}</div>`).join("")
    : empty("\u76ee\u524d\u6c92\u6709 adapter \u72c0\u614b");
}

async function loadScanLogs() {
  const logs = await fetchJson("/api/scan-logs");
  $("#scanLogs").innerHTML = logs.length
    ? logs.slice(0, 12).map((log) => `<div class="row"><b>${escapeHtml(log.source)}</b><span>${escapeHtml(log.status)}</span><span>\u6293\u5230 ${log.fetchedCount}\uff0c\u65b0\u589e ${log.createdLeadCount || 0}</span><small>${formatDate(log.startedAt)}</small>${log.errorMessage ? `<em>${escapeHtml(log.errorMessage)}</em>` : ""}</div>`).join("")
    : empty("\u76ee\u524d\u6c92\u6709\u6383\u63cf\u7d00\u9304");
}

function renderCompany(signal) {
  const raw = parseJson(signal.rawJson || "{}");
  const mapsUrl = raw.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw.address || signal.summary || signal.title)}`;
  const googleUrl = raw.googleCompanyUrl || `https://www.google.com/search?q=${encodeURIComponent(signal.title)}`;
  return companyCard(signal, raw, `
    <a class="btn ghost" href="${escapeAttr(googleUrl)}" target="_blank" rel="noopener noreferrer">Google \u641c\u5c0b\u516c\u53f8</a>
    <a class="btn ghost" href="${escapeAttr(mapsUrl)}" target="_blank" rel="noopener noreferrer">Google Maps \u641c\u5c0b\u5730\u5740</a>
    <button class="btn ghost" data-signal-star-id="${signal.id}" data-star="${signal.isStarred}">${signal.isStarred ? "\u5df2\u6536\u85cf" : "\u6536\u85cf"}</button>
    ${statusSelect(signal)}
  `);
}

function renderSignal(signal) {
  const raw = parseJson(signal.rawJson || "{}");
  return companyCard(signal, raw, `
    <a class="btn ghost" href="${escapeAttr(signal.url)}" target="_blank" rel="noopener noreferrer">\u958b\u555f\u4f86\u6e90</a>
    <button class="btn ghost" data-signal-star-id="${signal.id}" data-star="${signal.isStarred}">${signal.isStarred ? "\u5df2\u6536\u85cf" : "\u6536\u85cf"}</button>
    ${statusSelect(signal)}
  `);
}

function companyCard(signal, raw, actions) {
  const taxId = raw.taxId || extractSummaryValue(signal.summary, "\u7d71\u7de8");
  const capital = raw.capitalAmount || extractSummaryValue(signal.summary, "\u8cc7\u672c\u984d");
  const district = raw.district || extractSummaryValue(signal.summary, "\u884c\u653f\u5340");
  const setupDate = raw.setupDate || signal.publishedAt;
  const industry = raw.industryName || extractSummaryValue(signal.summary, "\u884c\u696d");
  const address = raw.address || extractAddress(signal.summary);
  const ageMonths = raw.ageMonths;
  const correlated = Array.isArray(raw.corroboratingSignals) && raw.corroboratingSignals.length ? raw.corroboratingSignals.join("\u3001") : "\u5c1a\u672a\u767c\u73fe";

  return `
    <article class="company-card grade-${signal.grade}">
      <div class="company-card-head">
        <h3>${highlight(signal.title, signal.matchedKeywords)}</h3>
        <div class="badge-row">
          <span class="grade-badge grade-${signal.grade}">${signal.grade} \u7d1a</span>
          <span class="status-badge status-${signal.status}"><i></i>${escapeHtml(signal.status)}</span>
        </div>
      </div>
      <div class="company-grid">
        ${field("\u7d71\u7de8", taxId || "-")}
        ${field("\u8cc7\u672c\u984d", formatMoney(capital))}
        ${field("\u884c\u653f\u5340", district || "-")}
        ${field("\u8a2d\u7acb\u65e5\u671f", formatDateOnly(setupDate))}
        ${field("\u5206\u6578", signal.score || "-")}
        ${field("Priority", signal.priorityScore || raw.priorityScore || "-")}
      </div>
      ${industry ? `<div class="industry-row"><span>\u547d\u4e2d\u884c\u696d</span><mark>${escapeHtml(industry)}</mark></div>` : ""}
      ${signal.type === "contract_maturity" ? `<div class="maturity-row">\u63a8\u6e2c\u5408\u7d04\u5e74\u9f61\uff1a\u7d04 ${escapeHtml(ageMonths || "?")} \u500b\u6708\u3000\u95dc\u806f\u8a0a\u865f\uff1a${escapeHtml(correlated)}</div>` : ""}
      <div class="address-row"><span>\u5730\u5740</span><p>${escapeHtml(address || signal.summary || "-")}</p></div>
      <div class="reason">${escapeHtml(signal.reason || "")}</div>
      <blockquote>${escapeHtml(signal.suggestedAction || "")}</blockquote>
      <div class="card-footer">
        <small>${signalTypeLabel(signal.type)} \u00b7 ${escapeHtml(signal.source)} \u00b7 \u6293\u53d6 ${formatDate(signal.fetchedAt)}</small>
        <div class="actions">${actions}</div>
      </div>
    </article>
  `;
}

function renderLead(lead) {
  const post = lead.post || {};
  return `
    <article class="company-card grade-${lead.grade}">
      <div class="company-card-head"><h3>${escapeHtml(post.title || firstLine(post.content) || "\u672a\u547d\u540d")}</h3><span class="grade-badge grade-${lead.grade}">${lead.grade} \u7d1a</span></div>
      <p>${escapeHtml(lead.summary || post.snippet || "")}</p>
      <div class="reason">${escapeHtml(lead.reason)}</div>
      <blockquote>${escapeHtml(lead.suggestedReply || "")}</blockquote>
      <div class="card-footer"><small>${escapeHtml(post.source || "")}</small><div class="actions"><a class="btn ghost" href="${escapeAttr(post.url)}" target="_blank" rel="noopener noreferrer">\u67e5\u770b\u539f\u6587</a></div></div>
    </article>
  `;
}

function renderTender(tender) {
  const raw = parseJson(tender.rawJson || "{}");
  const intentLabel = raw.intentType === "pre_intent" ? "\u524d\u7f6e\u9700\u6c42" : "\u76f4\u63a5\u9700\u6c42";
  return `
    <article class="company-card grade-${tender.grade}">
      <div class="company-card-head"><h3>${escapeHtml(tender.tenderName)}</h3><div class="badge-row"><span class="grade-badge grade-${tender.grade}">${tender.grade} \u7d1a</span><span class="intent-badge">${intentLabel}</span></div></div>
      <div class="company-grid">${field("\u6a5f\u95dc", tender.agencyName || "-")}${field("\u6a19\u6848\u7de8\u865f", tender.jobNumber)}${field("\u516c\u544a", formatDateOnly(tender.announceDate))}${field("\u622a\u6b62", formatDateOnly(tender.deadlineDate))}${field("\u9810\u7b97", formatBudget(tender.budgetAmount))}</div>
      <div class="reason">${escapeHtml(tender.reason)}</div>
      <div class="card-footer"><small>\u6a19\u6848\u96f7\u9054</small><div class="actions"><a class="btn ghost" href="${escapeAttr(tender.url)}" target="_blank" rel="noopener noreferrer">\u958b\u555f\u6a19\u6848</a></div></div>
    </article>
  `;
}

function field(label, value) {
  return `<div class="info-field"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function statusSelect(signal) {
  return `<select data-signal-status="${signal.id}">${["new", "reviewed", "contacted", "ignored", "converted"].map((status) => `<option value="${status}" ${signal.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>`;
}

function bindSignalActions(root) {
  root.querySelectorAll("[data-signal-status]").forEach((select) =>
    select.addEventListener("change", async () => {
      await fetch(`/api/signals/${select.dataset.signalStatus}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) });
      await refreshAll();
    })
  );
  root.querySelectorAll("[data-signal-star-id]").forEach((button) =>
    button.addEventListener("click", async () => {
      await fetch(`/api/signals/${button.dataset.signalStarId}/star`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isStarred: button.dataset.star !== "true" }) });
      await refreshAll();
    })
  );
}

function stat(value, label, suffix = "", className = "") {
  const emptyValue = value === 0 || value === "0" || value === "" || value == null;
  const compact = String(value ?? "").length > 12 ? "compact-value" : "";
  return `<div class="stat-card ${className}"><span>${escapeHtml(label)}</span><b class="${emptyValue ? "muted-value" : ""} ${compact}">${emptyValue ? "-" : escapeHtml(value)}${!emptyValue && suffix ? `<small>${escapeHtml(suffix)}</small>` : ""}</b></div>`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function signalTypeLabel(type) {
  return {
    social: "\u793e\u7fa4\u5546\u6a5f",
    tender: "\u6a19\u6848\u96f7\u9054",
    company: "\u6843\u5712\u65b0\u516c\u53f8",
    hiring: "\u5fb5\u624d\u96f7\u9054",
    move: "\u642c\u9077/\u64f4\u7de8",
    competitor: "\u7af6\u54c1\u62b1\u6028",
    contract: "\u79df\u7d04\u5230\u671f",
    contract_maturity: "\u79df\u7d04\u6210\u719f\u5ea6\u96f7\u9054"
  }[type] || type;
}

function adapterLabel(source) {
  return {
    company: "\u6843\u5712\u65b0\u516c\u53f8\u96f7\u9054",
    signal_company: "\u6843\u5712\u65b0\u516c\u53f8\u96f7\u9054",
    signal_contract_maturity: "\u79df\u7d04\u6210\u719f\u5ea6\u96f7\u9054",
    tender: "\u6a19\u6848\u96f7\u9054",
    signal_tender: "\u6a19\u6848\u96f7\u9054",
    signal_contract: "\u79df\u7d04\u5230\u671f\u96f7\u9054",
    signal_competitor: "\u7af6\u54c1\u62b1\u6028\u96f7\u9054",
    signal_move: "\u642c\u9077/\u64f4\u7de8\u96f7\u9054",
    signal_hiring: "\u5fb5\u624d\u96f7\u9054",
    ptt: "PTT",
    search_engine: "\u641c\u5c0b\u5f15\u64ce"
  }[source] || source;
}

function statusLabel(status) {
  return { success: "\u6210\u529f", running: "\u57f7\u884c\u4e2d", unavailable: "\u4e0d\u53ef\u7528", failed: "\u5931\u6557", error: "\u932f\u8aa4", skipped: "\u5df2\u7565\u904e", no_result: "\u7121\u6709\u6548\u8cc7\u6599", no_results: "\u7121\u65b0\u8cc7\u6599", stale: "\u903e\u6642" }[status] || status;
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  return entries.length ? entries.slice(0, 2).map(([key, value]) => `${key} ${value}`).join("\u3001") : "-";
}

function companySearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name || ""} 桃園 統一編號`)}`;
}

function formatMoney(value) {
  const num = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(num) && num > 0 ? `$${num.toLocaleString("zh-TW")}` : "-";
}

function firstLine(text) {
  return String(text || "").split("\n").find(Boolean);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-TW");
}

function formatDateOnly(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("zh-TW");
}

function formatBudget(value) {
  if (!value) return "-";
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

function extractSummaryValue(summary, label) {
  const match = String(summary || "").match(new RegExp(`${label}\uff1a([^；;]+)`));
  return match?.[1]?.trim();
}

function extractAddress(summary) {
  return extractSummaryValue(summary, "\u5730\u5740");
}

function parseJson(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || {};
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
