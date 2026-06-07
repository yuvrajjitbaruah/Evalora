const STORE_STATUS = "evalora.decisions.v2";
const STORE_NOTES = "evalora.notes.v2";
const STORE_DELETED = "evalora.deleted.v2";
const ANCHOR_DATE = "2026-06-01";

if (window.location.hash) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

const state = {
  candidates: [],
  report: null,
  filtered: [],
  visibleLimit: 10,
  selectedIds: new Set(),
  deletedIds: new Set(readList(STORE_DELETED)),
  view: "table",
  decisions: readStore(STORE_STATUS),
  notes: readStore(STORE_NOTES),
  sandboxRows: [],
  sandboxCsv: ""
};

const els = {
  count: document.querySelector("#metric-count"),
  time: document.querySelector("#metric-time"),
  top: document.querySelector("#metric-top"),
  cutoff: document.querySelector("#metric-cutoff"),
  decisions: document.querySelector("#metric-decisions"),
  decisionIntelGrid: document.querySelector("#decision-intel-grid"),
  filteredCount: document.querySelector("#filtered-count"),
  requirements: document.querySelector("#requirement-list"),
  components: document.querySelector("#component-bars"),
  roleMix: document.querySelector("#role-mix"),
  readiness: document.querySelector("#readiness-board"),
  table: document.querySelector("#candidate-table"),
  cardView: document.querySelector("#card-view"),
  tableView: document.querySelector("#table-view"),
  search: document.querySelector("#search-input"),
  score: document.querySelector("#score-filter"),
  scoreLabel: document.querySelector("#score-label"),
  persona: document.querySelector("#persona-filter"),
  location: document.querySelector("#location-filter"),
  readinessFilter: document.querySelector("#readiness-filter"),
  sort: document.querySelector("#sort-select"),
  activeFilters: document.querySelector("#active-filters"),
  listStatus: document.querySelector("#list-status"),
  listRange: document.querySelector("#list-range"),
  loadMore: document.querySelector("#load-more"),
  compareTitle: document.querySelector("#compare-title"),
  compareGrid: document.querySelector("#compare-grid"),
  clearCompare: document.querySelector("#clear-compare"),
  resetWorkflow: document.querySelector("#reset-workflow"),
  workflowShortlisted: document.querySelector("#workflow-shortlisted"),
  workflowReview: document.querySelector("#workflow-review"),
  workflowRejected: document.querySelector("#workflow-rejected"),
  upload: document.querySelector("#sample-upload"),
  loadSample: document.querySelector("#load-sample"),
  sandboxEmpty: document.querySelector("#sandbox-empty"),
  sandboxResults: document.querySelector("#sandbox-results"),
  sandboxDownload: document.querySelector("#download-sandbox"),
  atsFile: document.querySelector("#ats-file"),
  atsResume: document.querySelector("#ats-resume"),
  atsJob: document.querySelector("#ats-job"),
  atsProvider: document.querySelector("#ats-provider"),
  atsRun: document.querySelector("#ats-run"),
  atsStatus: document.querySelector("#ats-status"),
  atsScore: document.querySelector("#ats-score"),
  atsVerdict: document.querySelector("#ats-verdict"),
  atsProviderLabel: document.querySelector("#ats-provider-label"),
  atsStrengths: document.querySelector("#ats-strengths"),
  atsGaps: document.querySelector("#ats-gaps"),
  atsRisks: document.querySelector("#ats-risks"),
  atsQuestions: document.querySelector("#ats-questions"),
  atsSummary: document.querySelector("#ats-summary"),
  atsCompare: document.querySelector("#ats-compare"),
  atsProviderCompare: document.querySelector("#ats-provider-compare"),
  copyCommand: document.querySelector("#copy-command"),
  downloadFiltered: document.querySelector("#download-filtered"),
  deleteVisible: document.querySelector("#delete-visible"),
  deleteAll: document.querySelector("#delete-all"),
  restoreDeleted: document.querySelector("#restore-deleted"),
  smartFilterButtons: document.querySelectorAll("[data-smart-filter]"),
  aiProviderStatus: document.querySelector("#ai-provider-status"),
  aiCandidateSelect: document.querySelector("#ai-candidate-select"),
  aiProviderSelect: document.querySelector("#ai-provider-select"),
  aiTaskSelect: document.querySelector("#ai-task-select"),
  aiRun: document.querySelector("#ai-run"),
  aiOutputTitle: document.querySelector("#ai-output-title"),
  aiOutput: document.querySelector("#ai-output"),
  dialog: document.querySelector("#candidate-dialog"),
  dialogContent: document.querySelector("#dialog-content")
};

const REQUIREMENTS = [
  {
    label: "Production retrieval and ranking",
    detail: "Search, recommendations, embeddings, vector infrastructure, and ranking shipped to users.",
    weight: 22
  },
  {
    label: "Evidence over keyword density",
    detail: "Career descriptions and ownership signals matter more than a long AI-skills list.",
    weight: 17
  },
  {
    label: "Senior applied ML judgment",
    detail: "5-9 year senior IC fit, production code, product-company experience, and evaluation literacy.",
    weight: 25
  },
  {
    label: "Recruiter readiness",
    detail: "Recent activity, response rate, notice period, verification, GitHub, and interview reliability.",
    weight: 13
  },
  {
    label: "Fit-risk suppression",
    detail: "Down-weights services-only histories, inconsistent timelines, CV-heavy profiles, and keyword stuffing.",
    weight: 23
  }
];

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="load-error">Evalora could not load the Django ranking API. Confirm the generated ranking data exists, then restart the Django server.</div>`
  );
});
window.addEventListener("load", alignInitialHash);

async function init() {
  const [ranking, report] = await Promise.all([
    fetchJson("/api/candidates/"),
    fetchJson("/api/report/")
  ]);

  state.candidates = ranking.candidates || [];
  state.report = report;
  renderMetrics(report);
  renderRequirements();
  renderComponents(report);
  renderRoleMix(report);
  renderReadinessBoard();
  renderDecisionIntel();
  renderAiCandidateOptions();
  loadAiStatus();
  bindEvents();
  applyFilters();
  renderWorkflow();
  alignInitialHash();
}

function bindEvents() {
  [els.search, els.score, els.persona, els.location, els.readinessFilter, els.sort].forEach((control) => {
    const resetAndApply = () => {
      state.visibleLimit = 10;
      applyFilters();
    };
    control.addEventListener("input", resetAndApply);
    control.addEventListener("change", resetAndApply);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderListViews();
    });
  });

  document.querySelectorAll(".segmented-control[data-provider-target]").forEach((control) => {
    const select = document.querySelector(`#${control.dataset.providerTarget}`);
    control.addEventListener("click", (event) => {
      const button = event.target.closest("[data-provider-value]");
      if (!button || !select) return;
      select.value = button.dataset.providerValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      control.querySelectorAll("[data-provider-value]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
  });

  els.table.addEventListener("click", handleListAction);
  els.cardView.addEventListener("click", handleListAction);
  els.table.addEventListener("change", handleCompareChange);
  els.cardView.addEventListener("change", handleCompareChange);
  els.clearCompare.addEventListener("click", clearCompare);
  els.resetWorkflow.addEventListener("click", resetWorkflow);
  els.upload.addEventListener("change", handleUpload);
  els.loadSample.addEventListener("click", loadBundledSample);
  els.sandboxDownload.addEventListener("click", downloadSandboxCsv);
  els.atsFile.addEventListener("change", handleAtsFileChange);
  els.atsRun.addEventListener("click", runAtsAnalysis);
  els.atsCompare.addEventListener("click", compareAtsProviders);
  els.copyCommand.addEventListener("click", copyReproduceCommand);
  els.downloadFiltered.addEventListener("click", downloadFilteredCsv);
  els.deleteVisible.addEventListener("click", deleteVisibleCandidates);
  els.deleteAll.addEventListener("click", deleteAllCandidates);
  els.restoreDeleted.addEventListener("click", restoreDeletedCandidates);
  els.smartFilterButtons.forEach((button) => {
    button.addEventListener("click", () => applySmartFilter(button.dataset.smartFilter));
  });
  els.aiRun.addEventListener("click", runAiAction);
  els.loadMore.addEventListener("click", loadMoreCandidates);
}

function alignInitialHash() {
  if (!window.location.hash) return;
  window.setTimeout(() => {
    const target = document.querySelector(window.location.hash);
    if (!target) return;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 18);
    window.scrollTo({ top, behavior: "auto" });
  }, 80);
}

function renderMetrics(report) {
  els.count.textContent = formatNumber(report.input.candidates_scored);
  els.time.textContent = `${(report.input.elapsed_ms / 1000).toFixed(1)}s`;
  els.top.textContent = report.shortlist.max_score.toFixed(3);
  els.cutoff.textContent = report.shortlist.min_score.toFixed(3);
  updateDecisionMetric();
}

function renderRequirements() {
  els.requirements.innerHTML = REQUIREMENTS.map(
    (item) => `
      <div class="requirement">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </div>
        <span class="weight-pill">${item.weight}%</span>
      </div>
    `
  ).join("");
}

function renderComponents(report) {
  const components = report.shortlist.component_means || {};
  const labels = [
    ["semantic", "Semantic proof"],
    ["career", "Career trajectory"],
    ["experience", "Experience window"],
    ["behavior", "Behavior readiness"],
    ["skills", "Skill depth"],
    ["location", "Location fit"],
    ["integrity", "Integrity checks"]
  ];

  els.components.innerHTML = labels.map(([key, label]) => {
    const value = Number(components[key] || 0);
    return `
      <div class="bar-row">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${Math.round(value * 100)} average strength</span>
        </div>
        <div class="bar-track" aria-hidden="true">
          <span class="bar-fill" style="width:${Math.round(value * 100)}%"></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderRoleMix(report) {
  const rows = (report.shortlist.top_titles || []).slice(0, 6);
  const max = Math.max(...rows.map((item) => item.count), 1);
  els.roleMix.innerHTML = rows.map((item) => `
    <div class="mini-row">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.count} candidates</span>
      </div>
      <div class="mini-track"><span style="width:${Math.round(item.count / max * 100)}%"></span></div>
    </div>
  `).join("");
}

function renderReadinessBoard() {
  const rows = state.candidates;
  const open = rows.filter((row) => row.candidate.signals.open_to_work_flag).length;
  const shortNotice = rows.filter((row) => row.candidate.signals.notice_period_days <= 30).length;
  const highResponse = rows.filter((row) => row.candidate.signals.recruiter_response_rate >= 0.7).length;
  const watch = rows.filter((row) => isWatch(row)).length;
  const target = rows.filter((row) => isTargetCity(row.candidate.location)).length;
  const items = [
    ["Open to work", open, "good"],
    ["Short notice", shortNotice, "good"],
    ["High response", highResponse, "good"],
    ["Target city", target, "neutral"],
    ["Watch flags", watch, "watch"]
  ];

  els.readiness.innerHTML = items.map(([label, count, tone]) => `
    <div class="readiness-card ${tone}">
      <strong>${count}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function renderDecisionIntel() {
  if (!els.decisionIntelGrid) return;
  const rows = state.candidates.filter((row) => !state.deletedIds.has(row.candidate_id));
  const fastTrack = rows
    .filter((row) => row.score >= 0.82 && !isWatch(row) && row.candidate.signals.notice_period_days <= 45)
    .slice(0, 4);
  const outreach = rows
    .filter((row) => row.candidate.signals.open_to_work_flag && row.candidate.signals.recruiter_response_rate >= 0.62)
    .sort((a, b) => b.candidate.signals.recruiter_response_rate - a.candidate.signals.recruiter_response_rate)
    .slice(0, 4);
  const followUp = rows
    .filter((row) => isWatch(row) || row.candidate.signals.notice_period_days >= 90 || row.candidate.signals.recruiter_response_rate < 0.35)
    .slice(0, 4);
  const retrieval = rows
    .filter((row) => row.evidence.concepts.includes("retrievalRanking"))
    .slice(0, 4);

  const cards = [
    {
      label: "Fast-track shortlist",
      value: fastTrack.length,
      detail: "High fit, low risk, short notice",
      rows: fastTrack,
      tone: "good"
    },
    {
      label: "Warm outreach queue",
      value: outreach.length,
      detail: "Open to work with recruiter response signal",
      rows: outreach,
      tone: "good"
    },
    {
      label: "Follow-up watchlist",
      value: followUp.length,
      detail: "Risk flags, slower response, or long notice",
      rows: followUp,
      tone: "watch"
    },
    {
      label: "Retrieval proof pool",
      value: retrieval.length,
      detail: "Search, ranking, embeddings, or vector systems",
      rows: retrieval,
      tone: "neutral"
    }
  ];

  els.decisionIntelGrid.innerHTML = cards.map((card) => `
    <article class="intel-card ${card.tone}">
      <div class="intel-card-head">
        <span>${escapeHtml(card.label)}</span>
        <strong>${card.value}</strong>
      </div>
      <p>${escapeHtml(card.detail)}</p>
      <div class="intel-candidates">
        ${card.rows.length ? card.rows.map((row) => `
          <button type="button" data-intel-open="${escapeAttr(row.candidate_id)}">
            <strong>#${row.rank} ${escapeHtml(row.candidate.name)}</strong>
            <span>${escapeHtml(row.candidate.title)} / ${row.score.toFixed(3)}</span>
          </button>
        `).join("") : `<span class="empty-column">No candidates in this lane</span>`}
      </div>
    </article>
  `).join("");

  els.decisionIntelGrid.querySelectorAll("[data-intel-open]").forEach((button) => {
    button.addEventListener("click", () => openCandidate(button.dataset.intelOpen));
  });
}

function applySmartFilter(mode) {
  state.visibleLimit = 10;
  if (mode === "fast-track") {
    els.persona.value = "founding";
    els.readinessFilter.value = "now";
    els.location.value = "all";
    els.sort.value = "score";
    els.score.value = "0.78";
  } else if (mode === "retrieval") {
    els.persona.value = "retrieval";
    els.readinessFilter.value = "all";
    els.location.value = "all";
    els.sort.value = "score";
    els.score.value = "0.70";
  } else if (mode === "follow-up") {
    els.persona.value = "watch";
    els.readinessFilter.value = "risk";
    els.location.value = "all";
    els.sort.value = "rank";
    els.score.value = "0";
  } else {
    els.search.value = "";
    els.score.value = "0";
    els.persona.value = "all";
    els.location.value = "all";
    els.readinessFilter.value = "all";
    els.sort.value = "rank";
  }
  applyFilters();
  document.querySelector("#shortlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadAiStatus() {
  try {
    const status = await fetchJson("/api/ai/status/");
    const providers = [
      ["Gemini", status.google_configured, status.gemini_model],
      ["Sarvam", status.sarvam_configured, status.sarvam_model],
      ["Local engine", true, "always on"]
    ];
    els.aiProviderStatus.innerHTML = providers
      .map(([label, configured, model]) => `<span class="provider-chip ${configured ? "good" : "watch"}">${label}: ${configured ? escapeHtml(model) : "env missing"}</span>`)
      .join("");
  } catch {
    els.aiProviderStatus.innerHTML = `<span class="provider-chip watch">AI status unavailable</span>`;
  }
}

function renderAiCandidateOptions() {
  const rows = (state.filtered.length ? state.filtered : state.candidates.filter((row) => !state.deletedIds.has(row.candidate_id))).slice(0, 100);
  els.aiCandidateSelect.innerHTML = rows.map((row) => `
    <option value="${escapeAttr(row.candidate_id)}">#${row.rank} ${escapeHtml(row.candidate.name)} - ${escapeHtml(row.candidate.title)}</option>
  `).join("");
}

async function runAiAction() {
  const candidateId = els.aiCandidateSelect.value;
  const provider = els.aiProviderSelect.value;
  const task = els.aiTaskSelect.value;
  if (!candidateId) return;

  const selected = state.candidates.find((row) => row.candidate_id === candidateId);
  els.aiRun.disabled = true;
  els.aiOutputTitle.textContent = selected ? `${selected.candidate.name} / ${taskLabel(task)}` : "Generating";
  els.aiOutput.textContent = "Generating recruiter-ready output...";

  try {
    const response = await fetch("/api/ai/candidate-action/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId, provider, task })
    });
    if (!response.ok) throw new Error(await readableError(response));
    const payload = await response.json();
    els.aiOutputTitle.textContent = `${payload.provider_label} / ${taskLabel(task)}`;
    els.aiOutput.innerHTML = `
      ${payload.provider_warning ? `<p class="provider-warning">${escapeHtml(payload.provider_warning)}</p>` : ""}
      ${formatAiText(payload.text)}
    `;
  } catch (error) {
    els.aiOutputTitle.textContent = "AI action failed";
    els.aiOutput.textContent = error.message || "The AI request failed.";
  } finally {
    els.aiRun.disabled = false;
  }
}

async function handleAtsFileChange() {
  const file = els.atsFile.files?.[0];
  if (!file) {
    els.atsStatus.innerHTML = `<span class="provider-chip muted-chip">Ready for resume text</span>`;
    return;
  }
  const fileType = /\.(pdf|docx)$/i.test(file.name) ? "Server will extract readable text" : "Text loaded for review";
  els.atsStatus.innerHTML = `<span class="provider-chip good">${escapeHtml(file.name)} selected</span><span class="provider-chip muted-chip">${fileType}</span>`;
  if (/\.(txt|md|json|jsonl)$/i.test(file.name)) {
    els.atsResume.value = await file.text();
  } else {
    els.atsResume.value = "";
  }
}

async function runAtsAnalysis() {
  const file = els.atsFile.files?.[0];
  const resumeText = els.atsResume.value.trim();
  if (!file && !resumeText) {
    els.atsStatus.innerHTML = `<span class="provider-chip watch">Add a resume or CV first</span>`;
    return;
  }

  els.atsRun.disabled = true;
  els.atsCompare.disabled = true;
  els.atsStatus.innerHTML = `<span class="provider-chip watch">Analyzing resume</span>`;
  els.atsScore.textContent = "--";
  els.atsVerdict.textContent = "Analyzing";
  els.atsProviderLabel.textContent = "Working";
  els.atsSummary.textContent = "Evalora is checking skills, role evidence, risk flags, and interview signals...";
  els.atsProviderCompare.hidden = true;
  els.atsProviderCompare.innerHTML = "";
  clearAtsLists();

  try {
    renderAtsResult(await requestAtsAnalysis(els.atsProvider.value));
  } catch (error) {
    els.atsStatus.innerHTML = `<span class="provider-chip watch">ATS analysis failed</span>`;
    els.atsVerdict.textContent = "Needs retry";
    els.atsSummary.textContent = error.message || "The ATS analyzer could not process this resume.";
  } finally {
    els.atsRun.disabled = false;
    els.atsCompare.disabled = false;
  }
}

async function requestAtsAnalysis(provider) {
  const file = els.atsFile.files?.[0];
  const resumeText = els.atsResume.value.trim();
  let response;
  if (file) {
    const form = new FormData();
    form.append("resume_file", file);
    form.append("job_description", els.atsJob.value.trim());
    form.append("provider", provider);
    response = await fetch("/api/ats/analyze/", { method: "POST", body: form });
  } else {
    response = await fetch("/api/ats/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: els.atsJob.value.trim(),
        provider
      })
    });
  }
  if (!response.ok) throw new Error(await readableError(response));
  return response.json();
}

async function compareAtsProviders() {
  const file = els.atsFile.files?.[0];
  const resumeText = els.atsResume.value.trim();
  if (!file && !resumeText) {
    els.atsStatus.innerHTML = `<span class="provider-chip watch">Add a resume or CV first</span>`;
    return;
  }

  els.atsRun.disabled = true;
  els.atsCompare.disabled = true;
  els.atsStatus.innerHTML = `<span class="provider-chip watch">Comparing Gemini and Sarvam</span>`;
  els.atsProviderCompare.hidden = false;
  els.atsProviderCompare.innerHTML = `
    <article>
      <strong>Provider comparison running</strong>
      <span>Evalora is asking Gemini and Sarvam for separate recruiter reads.</span>
    </article>
  `;

  const providers = ["gemini", "sarvam"];
  const results = await Promise.allSettled(providers.map((provider) => requestAtsAnalysis(provider)));
  els.atsProviderCompare.innerHTML = results.map((result, index) => {
    const provider = providers[index] === "gemini" ? "Gemini" : "Sarvam";
    if (result.status === "rejected") {
      return `
        <article class="compare-error">
          <strong>${provider}</strong>
          <span>${escapeHtml(result.reason?.message || "Provider request failed.")}</span>
        </article>
      `;
    }
    const payload = result.value;
    return `
      <article>
        <strong>${escapeHtml(payload.provider_label || provider)}</strong>
        <span>${Math.round(Number(payload.score || 0))}/100 - ${escapeHtml(payload.verdict || "Review")}</span>
        <p>${escapeHtml(payload.summary || payload.ai_note || "No summary returned.")}</p>
      </article>
    `;
  }).join("");

  const firstSuccess = results.find((result) => result.status === "fulfilled");
  if (firstSuccess) {
    renderAtsResult(firstSuccess.value);
    els.atsProviderCompare.hidden = false;
  } else {
    els.atsStatus.innerHTML = `<span class="provider-chip watch">Provider comparison failed</span>`;
  }
  els.atsRun.disabled = false;
  els.atsCompare.disabled = false;
}

function renderAtsResult(result) {
  els.atsScore.textContent = `${Math.round(Number(result.score || 0))}/100`;
  els.atsVerdict.textContent = result.verdict || "Review";
  els.atsProviderLabel.textContent = result.provider_label || "Local ATS engine";
  els.atsStatus.innerHTML = `
    <span class="provider-chip good">${escapeHtml(result.provider_label || "Analysis complete")}</span>
    ${result.provider_warning ? `<span class="provider-chip watch">${escapeHtml(result.provider_warning)}</span>` : ""}
  `;
  renderBulletList(els.atsStrengths, result.strengths);
  renderBulletList(els.atsGaps, result.gaps);
  renderBulletList(els.atsRisks, result.risks);
  renderBulletList(els.atsQuestions, result.questions);
  const chips = [
    result.profile_type,
    result.source_quality,
    Array.isArray(result.matched_keywords) && result.matched_keywords.length
      ? `Matched: ${result.matched_keywords.join(", ")}`
      : "No direct AI-role keywords matched"
  ].filter(Boolean);
  els.atsSummary.innerHTML = `
    ${formatAiText(result.ai_note || result.summary || "Analysis complete.")}
    <div class="ats-meta">${chips.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    ${result.parsed_preview ? `<details class="ats-preview"><summary>Parsed resume preview</summary><p>${escapeHtml(result.parsed_preview)}</p></details>` : ""}
  `;
}

function clearAtsLists() {
  [els.atsStrengths, els.atsGaps, els.atsRisks, els.atsQuestions].forEach((list) => {
    list.innerHTML = "";
  });
}

function renderBulletList(container, items) {
  const rows = Array.isArray(items) && items.length ? items : ["No direct evidence found for this category."];
  container.innerHTML = rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function readableError(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    return payload.error || text;
  } catch {
    return text;
  }
}

function taskLabel(task) {
  return {
    brief: "Recruiter brief",
    questions: "Interview questions",
    risk: "Risk audit",
    scorecard: "Structured scorecard",
    boolean_search: "Boolean sourcing query",
    calibration: "Recruiter calibration note",
    outreach: "Personalized outreach",
    hindi_outreach: "Hindi outreach draft"
  }[task] || task;
}

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  const minScore = Number(els.score.value);
  const persona = els.persona.value;
  const location = els.location.value;
  const readiness = els.readinessFilter.value;
  const sort = els.sort.value;

  state.filtered = state.candidates.filter((row) => {
    if (state.deletedIds.has(row.candidate_id)) return false;
    if (row.score < minScore) return false;
    if (!matchesPersona(row, persona)) return false;
    if (!matchesLocation(row, location)) return false;
    if (!matchesReadiness(row, readiness)) return false;
    if (!matchesQuery(row, query)) return false;
    return true;
  });

  state.filtered.sort(sortRows(sort));
  els.scoreLabel.textContent = minScore.toFixed(2);
  els.filteredCount.textContent = `${state.filtered.length} candidates`;
  renderActiveFilters({ query, minScore, persona, location, readiness, sort });
  renderListStatus();
  renderDecisionIntel();
  renderAiCandidateOptions();
  renderListViews();
}

function renderActiveFilters(filters) {
  const chips = [];
  if (filters.query) chips.push(["Search", filters.query]);
  if (filters.minScore > 0) chips.push(["Score", filters.minScore.toFixed(2)]);
  if (filters.persona !== "all") chips.push(["Persona", labelForSelect(els.persona)]);
  if (filters.location !== "all") chips.push(["Location", labelForSelect(els.location)]);
  if (filters.readiness !== "all") chips.push(["Readiness", labelForSelect(els.readinessFilter)]);
  if (filters.sort !== "rank") chips.push(["Sort", labelForSelect(els.sort)]);
  if (state.deletedIds.size) chips.push(["Hidden", `${state.deletedIds.size} removed`]);

  els.activeFilters.innerHTML = chips.length
    ? chips.map(([key, value]) => `<span class="filter-chip"><strong>${escapeHtml(key)}</strong>${escapeHtml(value)}</span>`).join("")
    : `<span class="filter-chip muted-chip">No active filters</span>`;
}

function renderListStatus() {
  const deleted = state.deletedIds.size;
  const shown = shownRows().length;
  els.listStatus.innerHTML = `
    <span>${shown} shown</span>
    <span>${state.filtered.length} matching</span>
    <span>${deleted} deleted locally</span>
    <span>${state.candidates.length} loaded from Django API</span>
  `;
  els.deleteVisible.disabled = shown === 0;
  els.deleteAll.disabled = state.deletedIds.size >= state.candidates.length;
  els.restoreDeleted.disabled = deleted === 0;
  els.downloadFiltered.disabled = shown === 0;
}

function renderListViews() {
  renderTable();
  renderCards();
  renderCompare();
  renderListFooter();
  els.tableView.hidden = state.view !== "table";
  els.cardView.hidden = state.view !== "cards";
}

function renderTable() {
  els.table.innerHTML = shownRows().map((row) => {
    const candidate = row.candidate;
    const selected = state.selectedIds.has(row.candidate_id);
    const skills = candidate.skills.slice(0, 4).map((skill) => `<span class="chip">${escapeHtml(skill.name)}</span>`).join("");
    const signals = buildSignalChips(candidate, row).join("");
    const risk = row.evidence.riskFlags
      .slice(0, 2)
      .map((flag) => `<span class="chip watch">${escapeHtml(flag)}</span>`)
      .join("");

    return `
      <tr data-id="${escapeAttr(row.candidate_id)}" class="${selected ? "selected-row" : ""}">
        <td>
          <input class="compare-check" type="checkbox" data-compare="${escapeAttr(row.candidate_id)}" ${selected ? "checked" : ""} aria-label="Compare ${escapeAttr(row.candidate_id)}" />
        </td>
        <td class="rank-cell">#${row.rank}</td>
        <td>
          <button class="text-link candidate-main" type="button" data-action="open" data-id="${escapeAttr(row.candidate_id)}">
            <strong>${escapeHtml(candidate.name)}</strong>
            <span>${escapeHtml(candidate.title)} / ${escapeHtml(candidate.years)} yrs / ${escapeHtml(candidate.location)}</span>
          </button>
        </td>
        <td>
          <div class="score-block">
            <span class="score-value">${row.score.toFixed(4)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${Math.round(row.score * 100)}%"></span></span>
          </div>
        </td>
        <td><div class="chips">${signals}${risk}</div></td>
        <td>${decisionButtons(row)}</td>
        <td>
          <div class="chips">${skills}</div>
          <p class="reasoning">${escapeHtml(row.reasoning)}</p>
          <button class="text-danger" type="button" data-action="delete" data-id="${escapeAttr(row.candidate_id)}">Delete candidate</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderCards() {
  els.cardView.innerHTML = shownRows().map((row) => {
    const candidate = row.candidate;
    const selected = state.selectedIds.has(row.candidate_id);
    const skills = candidate.skills.slice(0, 5).map((skill) => `<span class="chip">${escapeHtml(skill.name)}</span>`).join("");
    return `
      <article class="candidate-card ${selected ? "selected-card" : ""}">
        <div class="card-topline">
          <label class="compare-label">
            <input type="checkbox" data-compare="${escapeAttr(row.candidate_id)}" ${selected ? "checked" : ""} />
            Compare
          </label>
          <span>#${row.rank}</span>
        </div>
        <button class="text-link card-title" type="button" data-action="open" data-id="${escapeAttr(row.candidate_id)}">
          <strong>${escapeHtml(candidate.name)}</strong>
          <span>${escapeHtml(candidate.title)} / ${escapeHtml(candidate.location)}</span>
        </button>
        <div class="score-card-line">
          <strong>${row.score.toFixed(4)}</strong>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round(row.score * 100)}%"></span></span>
        </div>
        <p>${escapeHtml(row.reasoning)}</p>
        <div class="chips">${skills}</div>
        <div class="card-actions">${decisionButtons(row)}</div>
        <button class="text-danger" type="button" data-action="delete" data-id="${escapeAttr(row.candidate_id)}">Delete candidate</button>
      </article>
    `;
  }).join("");
}

function renderCompare() {
  const rows = [...state.selectedIds]
    .map((id) => state.candidates.find((row) => row.candidate_id === id))
    .filter((row) => row && !state.deletedIds.has(row.candidate_id));

  els.compareTitle.textContent = rows.length
    ? `${rows.length} candidate${rows.length > 1 ? "s" : ""} selected`
    : "Select up to 3 candidates";

  els.compareGrid.innerHTML = rows.length
    ? rows.map((row) => compareCard(row)).join("")
    : `<div class="empty-compare">Use the compare checkbox on any row to build a side-by-side recruiter view.</div>`;
}

function compareCard(row) {
  const c = row.candidate;
  return `
    <article class="compare-card">
      <button type="button" class="remove-compare" data-action="remove-compare" data-id="${escapeAttr(row.candidate_id)}">Remove</button>
      <strong>${escapeHtml(c.name)}</strong>
      <span>${escapeHtml(c.title)} / ${escapeHtml(c.location)}</span>
      <dl>
        <div><dt>Score</dt><dd>${row.score.toFixed(4)}</dd></div>
        <div><dt>Response</dt><dd>${c.signals.recruiter_response_rate.toFixed(2)}</dd></div>
        <div><dt>Notice</dt><dd>${c.signals.notice_period_days}d</dd></div>
        <div><dt>GitHub</dt><dd>${c.signals.github_activity_score < 0 ? "Not linked" : Math.round(c.signals.github_activity_score)}</dd></div>
      </dl>
      <div class="component-stack">${componentBars(row.components)}</div>
    </article>
  `;
}

function handleListAction(event) {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const id = action.dataset.id;
  if (action.dataset.action === "open") openCandidate(id);
  if (action.dataset.action === "remove-compare") {
    state.selectedIds.delete(id);
    renderListViews();
  }
  if (["shortlisted", "review", "rejected", "new"].includes(action.dataset.action)) {
    setDecision(id, action.dataset.action);
  }
  if (action.dataset.action === "delete") deleteCandidate(id);
}

function handleCompareChange(event) {
  const input = event.target.closest("[data-compare]");
  if (!input) return;
  const id = input.dataset.compare;
  if (input.checked && state.selectedIds.size >= 3 && !state.selectedIds.has(id)) {
    input.checked = false;
    els.compareTitle.textContent = "Compare tray is full";
    return;
  }
  if (input.checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  renderListViews();
}

function clearCompare() {
  state.selectedIds.clear();
  renderListViews();
}

function deleteCandidate(id) {
  const row = state.candidates.find((item) => item.candidate_id === id);
  if (!row) return;
  const confirmed = window.confirm(`Delete ${row.candidate.name} from this local shortlist view? You can restore deleted candidates later.`);
  if (!confirmed) return;
  state.deletedIds.add(id);
  state.selectedIds.delete(id);
  delete state.decisions[id];
  delete state.notes[id];
  persistCandidateState();
  applyFilters();
  renderWorkflow();
  renderDecisionIntel();
  if (els.dialog.open) els.dialog.close();
}

function deleteVisibleCandidates() {
  const rows = shownRows();
  if (!rows.length) return;
  const confirmed = window.confirm(`Delete all ${rows.length} currently shown candidates from this local shortlist view?`);
  if (!confirmed) return;
  rows.forEach((row) => {
    state.deletedIds.add(row.candidate_id);
    state.selectedIds.delete(row.candidate_id);
    delete state.decisions[row.candidate_id];
    delete state.notes[row.candidate_id];
  });
  persistCandidateState();
  applyFilters();
  renderWorkflow();
  renderDecisionIntel();
}

function deleteAllCandidates() {
  const remaining = state.candidates.filter((row) => !state.deletedIds.has(row.candidate_id));
  if (!remaining.length) return;
  const confirmed = window.confirm(`Delete all ${remaining.length} loaded candidates from this local shortlist view?`);
  if (!confirmed) return;
  state.candidates.forEach((row) => {
    state.deletedIds.add(row.candidate_id);
    state.selectedIds.delete(row.candidate_id);
    delete state.decisions[row.candidate_id];
    delete state.notes[row.candidate_id];
  });
  persistCandidateState();
  applyFilters();
  renderWorkflow();
  renderDecisionIntel();
}

function restoreDeletedCandidates() {
  if (!state.deletedIds.size) return;
  state.deletedIds.clear();
  writeStore(STORE_DELETED, []);
  applyFilters();
  renderWorkflow();
  renderDecisionIntel();
}

function loadMoreCandidates() {
  state.visibleLimit += 10;
  renderListViews();
  renderListStatus();
}

function persistCandidateState() {
  writeStore(STORE_DELETED, [...state.deletedIds]);
  writeStore(STORE_STATUS, state.decisions);
  writeStore(STORE_NOTES, state.notes);
  updateDecisionMetric();
}

function setDecision(id, status) {
  if (!id) return;
  if (status === "new") delete state.decisions[id];
  else state.decisions[id] = status;
  writeStore(STORE_STATUS, state.decisions);
  updateDecisionMetric();
  renderListViews();
  renderWorkflow();
  renderDecisionIntel();
}

function resetWorkflow() {
  state.decisions = {};
  writeStore(STORE_STATUS, state.decisions);
  updateDecisionMetric();
  renderListViews();
  renderWorkflow();
  renderDecisionIntel();
}

function renderWorkflow() {
  renderWorkflowColumn(els.workflowShortlisted, "shortlisted");
  renderWorkflowColumn(els.workflowReview, "review");
  renderWorkflowColumn(els.workflowRejected, "rejected");
}

function renderWorkflowColumn(container, status) {
  const rows = Object.entries(state.decisions)
    .filter(([, value]) => value === status)
    .map(([id]) => state.candidates.find((row) => row.candidate_id === id))
    .filter((row) => row && !state.deletedIds.has(row.candidate_id))
    .slice(0, 8);

  container.innerHTML = rows.length
    ? rows.map((row) => `
      <button class="workflow-item" type="button" data-action="open" data-id="${escapeAttr(row.candidate_id)}">
        <strong>#${row.rank} ${escapeHtml(row.candidate.name)}</strong>
        <span>${escapeHtml(row.candidate.title)} / ${row.score.toFixed(4)}</span>
      </button>
    `).join("")
    : `<span class="empty-column">No candidates yet</span>`;

  container.querySelectorAll("[data-action='open']").forEach((button) => {
    button.addEventListener("click", () => openCandidate(button.dataset.id));
  });
}

function openCandidate(candidateId) {
  const row = state.candidates.find((item) => item.candidate_id === candidateId);
  if (!row) return;
  const candidate = row.candidate;
  const topSkills = candidate.skills.map((skill) => `<span class="chip">${escapeHtml(skill.name)}</span>`).join("");
  const career = candidate.career.map((role) => `
    <li>
      <strong>${escapeHtml(role.title)} / ${escapeHtml(role.company)}</strong>
      <p>${escapeHtml(role.description || "")}</p>
    </li>
  `).join("");
  const currentStatus = state.decisions[row.candidate_id] || "new";
  const note = state.notes[row.candidate_id] || "";

  els.dialogContent.innerHTML = `
    <p class="eyebrow">Rank #${row.rank} / ${row.score.toFixed(4)} fit score</p>
    <h2>${escapeHtml(candidate.name)} - ${escapeHtml(candidate.title)}</h2>
    <p class="reasoning">${escapeHtml(row.reasoning)}</p>
    <div class="dialog-actions">
      ${decisionButtons(row)}
      <button class="button secondary compact-button" type="button" data-modal-action="compare" data-id="${escapeAttr(row.candidate_id)}">Add to compare</button>
      <button class="button danger compact-button" type="button" data-modal-action="delete" data-id="${escapeAttr(row.candidate_id)}">Delete candidate</button>
    </div>
    <div class="dialog-grid">
      <div>
        <h3>Evidence Summary</h3>
        <p>${escapeHtml(candidate.summary)}</p>
        <div class="chips">${topSkills}</div>
        <h3 class="spaced-title">Career History</h3>
        <ul class="career-list">${career}</ul>
      </div>
      <aside>
        <dl class="detail-list">
          <div><dt>Decision</dt><dd>${escapeHtml(statusLabel(currentStatus))}</dd></div>
          <div><dt>Location</dt><dd>${escapeHtml(candidate.location)} / ${escapeHtml(row.evidence.locationSignal)}</dd></div>
          <div><dt>Current Company</dt><dd>${escapeHtml(candidate.company)} / ${escapeHtml(candidate.industry)}</dd></div>
          <div><dt>Behavior</dt><dd>${behaviorSummary(candidate.signals)}</dd></div>
          <div><dt>Watch Flags</dt><dd>${row.evidence.riskFlags.length ? escapeHtml(row.evidence.riskFlags.join(", ")) : "None"}</dd></div>
        </dl>
        <div class="modal-bars">${componentBars(row.components)}</div>
        <label class="note-field">
          <span>Recruiter note</span>
          <textarea id="candidate-note" data-id="${escapeAttr(row.candidate_id)}" placeholder="Add interview questions, concerns, or follow-up notes">${escapeHtml(note)}</textarea>
        </label>
      </aside>
    </div>
  `;

  els.dialogContent.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => setDecision(button.dataset.id, button.dataset.action));
  });
  els.dialogContent.querySelector("[data-modal-action='compare']").addEventListener("click", () => {
    if (state.selectedIds.size < 3 || state.selectedIds.has(row.candidate_id)) {
      state.selectedIds.add(row.candidate_id);
      renderListViews();
    }
  });
  els.dialogContent.querySelector("[data-modal-action='delete']").addEventListener("click", () => deleteCandidate(row.candidate_id));
  els.dialogContent.querySelector("#candidate-note").addEventListener("input", (event) => {
    state.notes[event.target.dataset.id] = event.target.value;
    writeStore(STORE_NOTES, state.notes);
  });
  els.dialog.showModal();
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const candidates = parseCandidateUpload(text);
  await runSandbox(candidates);
}

async function loadBundledSample() {
  const sample = await fetchJson("/api/sample/");
  await runSandbox(Array.isArray(sample) ? sample : sample.candidates || []);
}

async function runSandbox(candidates) {
  if (!candidates.length) {
    state.sandboxRows = [];
    state.sandboxCsv = "";
    renderSandbox([]);
    return;
  }

  els.sandboxEmpty.hidden = false;
  els.sandboxEmpty.textContent = "Ranking sample through the Django backend...";
  els.sandboxResults.innerHTML = "";
  els.sandboxDownload.disabled = true;

  const response = await fetch("/api/rank-sample/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidates })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Sandbox ranking failed: ${message}`);
  }

  const payload = await response.json();
  const ranked = payload.candidates || [];
  state.sandboxRows = ranked;
  state.sandboxCsv = toCsv(ranked);
  renderSandbox(ranked);
}

function parseCandidateUpload(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : parsed.candidates || [parsed];
  }
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function renderSandbox(rows) {
  els.sandboxEmpty.hidden = rows.length > 0;
  if (!rows.length) els.sandboxEmpty.textContent = "No sample ranked yet.";
  els.sandboxResults.innerHTML = rows.map((row) => `
    <li>
      <strong>#${row.rank} ${escapeHtml(row.candidate_id)}</strong>
      <span>${escapeHtml(row.candidate.title)} / ${row.score.toFixed(4)}</span>
      <p class="reasoning">${escapeHtml(row.reasoning)}</p>
    </li>
  `).join("");
  els.sandboxDownload.disabled = rows.length === 0;
}

function downloadSandboxCsv() {
  if (!state.sandboxCsv) return;
  const blob = new Blob([state.sandboxCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evalora_sandbox_submission.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadFilteredCsv() {
  const rows = shownRows();
  if (!rows.length) return;
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evalora_visible_candidates.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function shownRows() {
  return state.filtered.slice(0, state.visibleLimit);
}

function renderListFooter() {
  const shown = shownRows().length;
  const total = state.filtered.length;
  els.listRange.textContent = total
    ? `Showing ${shown} of ${total} matching candidates`
    : "No matching candidates";
  els.loadMore.hidden = shown >= total;
}

async function copyReproduceCommand() {
  const command = ".venv/Scripts/python.exe manage.py check && .venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000";
  try {
    await navigator.clipboard.writeText(command);
    els.copyCommand.textContent = "Copied command";
  } catch {
    els.copyCommand.textContent = command;
  }
  window.setTimeout(() => {
    els.copyCommand.textContent = "Copy reproduce command";
  }, 1800);
}

function decisionButtons(row) {
  const current = state.decisions[row.candidate_id] || "new";
  const buttons = [
    ["shortlisted", "Shortlist"],
    ["review", "Review"],
    ["rejected", "Reject"]
  ];
  return `
    <div class="decision-group" aria-label="Decision controls for ${escapeAttr(row.candidate_id)}">
      ${buttons.map(([status, label]) => `
        <button
          type="button"
          class="decision-button ${current === status ? "active" : ""}"
          data-action="${status}"
          data-id="${escapeAttr(row.candidate_id)}"
        >${label}</button>
      `).join("")}
      ${current !== "new" ? `<button type="button" class="decision-button" data-action="new" data-id="${escapeAttr(row.candidate_id)}">Clear</button>` : ""}
    </div>
  `;
}

function buildSignalChips(candidate, row) {
  const signals = candidate.signals;
  const chips = [];
  if (signals.open_to_work_flag) chips.push(`<span class="chip good">Open to work</span>`);
  if (row.evidence.locationSignal) chips.push(`<span class="chip">${escapeHtml(row.evidence.locationSignal)}</span>`);
  if (signals.notice_period_days <= 30) chips.push(`<span class="chip good">${signals.notice_period_days}d notice</span>`);
  else if (signals.notice_period_days >= 120) chips.push(`<span class="chip watch">${signals.notice_period_days}d notice</span>`);
  if (signals.recruiter_response_rate >= 0.7) chips.push(`<span class="chip good">${signals.recruiter_response_rate.toFixed(2)} response</span>`);
  if (signals.github_activity_score >= 70) chips.push(`<span class="chip good">GitHub ${Math.round(signals.github_activity_score)}</span>`);
  return chips;
}

function componentBars(components) {
  return Object.entries(components || {})
    .filter(([key]) => !["penalty"].includes(key))
    .slice(0, 7)
    .map(([key, value]) => `
      <div class="tiny-bar">
        <span>${escapeHtml(key)}</span>
        <strong>${Math.round(value * 100)}</strong>
        <i><b style="width:${Math.round(value * 100)}%"></b></i>
      </div>
    `).join("");
}

function matchesPersona(row, value) {
  if (value === "all") return true;
  if (value === "retrieval") return row.evidence.concepts.includes("retrievalRanking") || row.evidence.skillHighlights.some((skill) => /Search|Retrieval|Ranking|FAISS|Pinecone|Qdrant|Weaviate|Milvus/i.test(skill));
  if (value === "founding") return row.components.career >= 0.8 && row.components.behavior >= 0.62 && row.candidate.years >= 5 && row.candidate.years <= 9;
  if (value === "available") return row.candidate.signals.open_to_work_flag && row.candidate.signals.notice_period_days <= 30;
  if (value === "product") return row.evidence.productCompanyRatio >= 0.6;
  if (value === "watch") return isWatch(row);
  return true;
}

function matchesLocation(row, value) {
  if (value === "all") return true;
  if (value === "target") return isTargetCity(row.candidate.location);
  if (value === "india") return row.candidate.country.toLowerCase() === "india";
  if (value === "relocate") return row.candidate.signals.willing_to_relocate;
  if (value === "risk") return row.evidence.locationSignal === "location risk";
  return true;
}

function matchesReadiness(row, value) {
  const signals = row.candidate.signals;
  const active = daysSince(signals.last_active_date) <= 30;
  if (value === "all") return true;
  if (value === "now") return signals.open_to_work_flag && signals.notice_period_days <= 30 && active;
  if (value === "warm") return signals.open_to_work_flag && (signals.notice_period_days <= 60 || signals.recruiter_response_rate >= 0.7);
  if (value === "risk") return isWatch(row) || signals.notice_period_days >= 120 || !active;
  return true;
}

function matchesQuery(row, query) {
  if (!query) return true;
  const candidate = row.candidate;
  const haystack = [
    row.candidate_id,
    row.reasoning,
    candidate.name,
    candidate.title,
    candidate.location,
    candidate.company,
    candidate.industry,
    candidate.skills.map((skill) => skill.name).join(" ")
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function sortRows(sort) {
  return (a, b) => {
    if (sort === "score") return b.score - a.score || a.rank - b.rank;
    if (sort === "response") return b.candidate.signals.recruiter_response_rate - a.candidate.signals.recruiter_response_rate || a.rank - b.rank;
    if (sort === "notice") return a.candidate.signals.notice_period_days - b.candidate.signals.notice_period_days || a.rank - b.rank;
    if (sort === "experience") return experienceDistance(a) - experienceDistance(b) || a.rank - b.rank;
    if (sort === "github") return b.candidate.signals.github_activity_score - a.candidate.signals.github_activity_score || a.rank - b.rank;
    return a.rank - b.rank;
  };
}

function isWatch(row) {
  return row.evidence.riskFlags.length > 0 || row.candidate.signals.notice_period_days >= 120 || row.components.penalty > 0;
}

function isTargetCity(location) {
  return /pune|noida|delhi|gurgaon|hyderabad|mumbai|bangalore|bengaluru/i.test(location || "");
}

function experienceDistance(row) {
  const years = Number(row.candidate.years || 0);
  if (years >= 5 && years <= 9) return 0;
  return Math.min(Math.abs(years - 5), Math.abs(years - 9));
}

function daysSince(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const anchor = new Date(`${ANCHOR_DATE}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.max(0, Math.round((anchor.getTime() - date.getTime()) / 86400000));
}

function updateDecisionMetric() {
  els.decisions.textContent = Object.keys(state.decisions).length;
}

function statusLabel(status) {
  return {
    new: "Not reviewed",
    shortlisted: "Shortlisted",
    review: "Needs review",
    rejected: "Rejected"
  }[status] || "Not reviewed";
}

function behaviorSummary(signals) {
  return [
    `${signals.recruiter_response_rate.toFixed(2)} response`,
    `${signals.notice_period_days}d notice`,
    signals.open_to_work_flag ? "open to work" : "not marked open",
    `GitHub ${signals.github_activity_score < 0 ? "not linked" : Math.round(signals.github_activity_score)}`
  ].join(" / ");
}

function labelForSelect(select) {
  return select.options[select.selectedIndex]?.textContent || select.value;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

function toCsv(rows) {
  const lines = ["candidate_id,rank,score,reasoning"];
  for (const row of rows) {
    lines.push([row.candidate_id, row.rank, row.score.toFixed(4), csvEscape(row.reasoning)].join(","));
  }
  return `${lines.join("\n")}\n`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatAiText(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
