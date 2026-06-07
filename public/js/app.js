import { rankCandidates } from "./ranker-core.js";

const STORE_STATUS = "evalora.decisions.v2";
const STORE_NOTES = "evalora.notes.v2";
const ANCHOR_DATE = "2026-06-01";

const state = {
  candidates: [],
  report: null,
  filtered: [],
  selectedIds: new Set(),
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
  copyCommand: document.querySelector("#copy-command"),
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
    `<div class="load-error">Evalora could not load generated ranking data. Run <strong>npm run rank</strong> first.</div>`
  );
});

async function init() {
  const [ranking, report] = await Promise.all([
    fetchJson("/data/top_candidates.json"),
    fetchJson("/data/score_report.json")
  ]);

  state.candidates = ranking.candidates || [];
  state.report = report;
  renderMetrics(report);
  renderRequirements();
  renderComponents(report);
  renderRoleMix(report);
  renderReadinessBoard();
  bindEvents();
  applyFilters();
  renderWorkflow();
}

function bindEvents() {
  [els.search, els.score, els.persona, els.location, els.readinessFilter, els.sort].forEach((control) => {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderListViews();
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
  els.copyCommand.addEventListener("click", copyReproduceCommand);
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

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  const minScore = Number(els.score.value);
  const persona = els.persona.value;
  const location = els.location.value;
  const readiness = els.readinessFilter.value;
  const sort = els.sort.value;

  state.filtered = state.candidates.filter((row) => {
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

  els.activeFilters.innerHTML = chips.length
    ? chips.map(([key, value]) => `<span class="filter-chip"><strong>${escapeHtml(key)}</strong>${escapeHtml(value)}</span>`).join("")
    : `<span class="filter-chip muted-chip">No active filters</span>`;
}

function renderListViews() {
  renderTable();
  renderCards();
  renderCompare();
  els.tableView.hidden = state.view !== "table";
  els.cardView.hidden = state.view !== "cards";
}

function renderTable() {
  els.table.innerHTML = state.filtered.map((row) => {
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
        </td>
      </tr>
    `;
  }).join("");
}

function renderCards() {
  els.cardView.innerHTML = state.filtered.map((row) => {
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
      </article>
    `;
  }).join("");
}

function renderCompare() {
  const rows = [...state.selectedIds]
    .map((id) => state.candidates.find((row) => row.candidate_id === id))
    .filter(Boolean);

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

function setDecision(id, status) {
  if (!id) return;
  if (status === "new") delete state.decisions[id];
  else state.decisions[id] = status;
  writeStore(STORE_STATUS, state.decisions);
  updateDecisionMetric();
  renderListViews();
  renderWorkflow();
}

function resetWorkflow() {
  state.decisions = {};
  writeStore(STORE_STATUS, state.decisions);
  updateDecisionMetric();
  renderListViews();
  renderWorkflow();
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
    .filter(Boolean)
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
  runSandbox(candidates);
}

async function loadBundledSample() {
  const sample = await fetchJson("/data/sample_candidates.json");
  runSandbox(Array.isArray(sample) ? sample : sample.candidates || []);
}

function runSandbox(candidates) {
  const ranked = rankCandidates(candidates, Math.min(25, candidates.length));
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

async function copyReproduceCommand() {
  const command = "npm run rank && npm run validate";
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

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
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
