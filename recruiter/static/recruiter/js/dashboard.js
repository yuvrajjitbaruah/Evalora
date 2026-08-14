// team.js
// Adds server-backed features on top of the original local-only dashboard:
//   - Analytics: pipeline funnel, score distribution, top skills/locations, risk flags
//   - Team Sync: push this browser's local decisions to the shared Django-backed board
//   - Talent Pools: named, reusable candidate shortlists
//   - Activity Log: audit trail of decisions, AI Copilot calls, ATS runs, and exports
//
// This module is intentionally independent from dashboard.js: it reads the same
// localStorage keys the local review board already uses, but never mutates
// dashboard.js's in-memory state directly, so the two boards can never race
// against each other. Instead, the shared/team board is rendered in its own
// panel under "Team Sync".

const STORE_STATUS = "evalora.decisions.v2";
const STORE_NOTES = "evalora.notes.v2";

const el = (id) => document.querySelector(`#${id}`);

const nodes = {
  funnel: el("analytics-funnel"),
  scoreDistribution: el("analytics-score-distribution"),
  topSkills: el("analytics-top-skills"),
  riskFlags: el("analytics-risk-flags"),
  topLocations: el("analytics-top-locations"),
  componentAverages: el("analytics-component-averages"),
  teamTable: el("team-decision-table"),
  poolsList: el("team-pools-list"),
  activityFeed: el("team-activity-feed"),
  pushButton: el("push-decisions"),
  refreshButton: el("refresh-team"),
  syncStatus: el("team-sync-status"),
  poolForm: el("pool-create-form"),
  poolNameInput: el("pool-name-input"),
  poolDescriptionInput: el("pool-description-input"),
};

document.addEventListener("DOMContentLoaded", () => {
  loadAnalytics();
  loadTeamBoard();
  loadPools();
  loadActivity();

  nodes.pushButton?.addEventListener("click", pushLocalDecisions);
  nodes.refreshButton?.addEventListener("click", () => {
    loadTeamBoard();
    loadPools();
    loadActivity();
    loadAnalytics();
  });
  nodes.poolForm?.addEventListener("submit", handleCreatePool);
});

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${url} failed (${response.status})`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

async function loadAnalytics() {
  try {
    const data = await fetchJson("/api/analytics/");
    renderFunnel(data.pipeline_funnel, data.total_candidates);
    renderBars(nodes.scoreDistribution, data.score_distribution, (row) => row.bucket, (row) => row.count);
    renderChips(nodes.topSkills, data.top_skills, (row) => `${row.skill} (${row.count})`);
    renderChips(nodes.riskFlags, data.risk_flags, (row) => `${row.flag} (${row.count})`, true);
    renderMiniList(nodes.topLocations, data.top_locations, (row) => row.location, (row) => row.count);
    renderComponentAverages(data.component_averages);
  } catch (error) {
    console.error("Analytics load failed:", error);
  }
}

function renderFunnel(funnel, total) {
  if (!nodes.funnel || !funnel) return;
  const stages = [
    ["new", "Not yet reviewed"],
    ["review", "Needs review"],
    ["shortlisted", "Shortlisted"],
    ["rejected", "Rejected"],
  ];
  nodes.funnel.innerHTML = stages
    .map(([key, label]) => {
      const count = funnel[key] || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="funnel-stage">
          <div class="funnel-stage-head"><span>${label}</span><strong>${count}</strong></div>
          <div class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderBars(container, rows, labelFn, valueFn) {
  if (!container) return;
  if (!rows || !rows.length) {
    container.innerHTML = `<p class="muted">No data yet.</p>`;
    return;
  }
  const max = Math.max(...rows.map(valueFn), 1);
  container.innerHTML = rows
    .map((row) => {
      const value = valueFn(row);
      const pct = Math.round((value / max) * 100);
      return `
        <div class="bar-row">
          <span>${escapeHtml(labelFn(row))} <strong>${value}</strong></span>
          <div class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderComponentAverages(averages) {
  if (!nodes.componentAverages) return;
  const entries = Object.entries(averages || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    nodes.componentAverages.innerHTML = `<p class="muted">No data yet.</p>`;
    return;
  }
  nodes.componentAverages.innerHTML = entries
    .map(([name, value]) => {
      const pct = Math.round(Math.min(value, 1) * 100);
      return `
        <div class="bar-row">
          <span>${escapeHtml(name)} <strong>${value.toFixed(3)}</strong></span>
          <div class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></div>
        </div>`;
    })
    .join("");
}

function renderChips(container, rows, labelFn, riskStyle = false) {
  if (!container) return;
  if (!rows || !rows.length) {
    container.innerHTML = `<p class="muted">None observed in this pool.</p>`;
    return;
  }
  container.innerHTML = rows
    .map((row) => `<span class="chip${riskStyle ? " chip-risk" : ""}">${escapeHtml(labelFn(row))}</span>`)
    .join("");
}

function renderMiniList(container, rows, labelFn, valueFn) {
  if (!container) return;
  if (!rows || !rows.length) {
    container.innerHTML = `<p class="muted">No data yet.</p>`;
    return;
  }
  container.innerHTML = rows
    .map(
      (row) => `
      <div class="mini-row">
        <span>${escapeHtml(labelFn(row))} <strong>${valueFn(row)}</strong></span>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Team decision board + sync
// ---------------------------------------------------------------------------

async function loadTeamBoard() {
  if (!nodes.teamTable) return;
  try {
    const data = await fetchJson("/api/decisions/");
    const rows = data.decisions || [];
    if (!rows.length) {
      nodes.teamTable.innerHTML = `<tr><td colspan="5" class="muted">No decisions pushed to the team board yet.</td></tr>`;
      return;
    }
    nodes.teamTable.innerHTML = rows
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.candidate_id)}</td>
          <td>${escapeHtml(statusLabel(row.status))}</td>
          <td>${row.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join(" ")}</td>
          <td>${escapeHtml(row.notes || "—")}</td>
          <td>${formatDate(row.updated_at)}</td>
        </tr>`
      )
      .join("");
  } catch (error) {
    nodes.teamTable.innerHTML = `<tr><td colspan="5" class="muted">Could not load the team board.</td></tr>`;
    console.error("Team board load failed:", error);
  }
}

async function pushLocalDecisions() {
  const decisions = readStore(STORE_STATUS);
  const notes = readStore(STORE_NOTES);
  const ids = Object.keys(decisions);

  if (!ids.length) {
    setSyncStatus("Nothing to push yet — make a decision in the workflow board first.");
    return;
  }

  setSyncStatus(`Pushing ${ids.length} decision${ids.length === 1 ? "" : "s"}…`);
  let succeeded = 0;
  for (const candidateId of ids) {
    try {
      await fetchJson("/api/decisions/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          status: decisions[candidateId],
          notes: notes[candidateId] || "",
        }),
      });
      succeeded += 1;
    } catch (error) {
      console.error(`Failed to push ${candidateId}:`, error);
    }
  }

  setSyncStatus(`Pushed ${succeeded} of ${ids.length} decisions to the team board.`);
  loadTeamBoard();
  loadAnalytics();
  loadActivity();
}

function setSyncStatus(message) {
  if (nodes.syncStatus) nodes.syncStatus.textContent = message;
}

// ---------------------------------------------------------------------------
// Talent pools
// ---------------------------------------------------------------------------

async function loadPools() {
  if (!nodes.poolsList) return;
  try {
    const data = await fetchJson("/api/pools/");
    const pools = data.pools || [];
    if (!pools.length) {
      nodes.poolsList.innerHTML = `<p class="muted">No talent pools yet. Create one above.</p>`;
      return;
    }
    nodes.poolsList.innerHTML = pools
      .map(
        (pool) => `
        <div class="mini-row">
          <span><strong>${escapeHtml(pool.name)}</strong> — ${pool.count} candidate${pool.count === 1 ? "" : "s"}</span>
          <span class="muted">${escapeHtml(pool.description || "")}</span>
        </div>`
      )
      .join("");
  } catch (error) {
    nodes.poolsList.innerHTML = `<p class="muted">Could not load talent pools.</p>`;
    console.error("Pools load failed:", error);
  }
}

async function handleCreatePool(event) {
  event.preventDefault();
  const name = nodes.poolNameInput?.value.trim();
  if (!name) return;
  try {
    await fetchJson("/api/pools/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: nodes.poolDescriptionInput?.value.trim() || "" }),
    });
    nodes.poolNameInput.value = "";
    if (nodes.poolDescriptionInput) nodes.poolDescriptionInput.value = "";
    loadPools();
    loadActivity();
  } catch (error) {
    console.error("Create pool failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

async function loadActivity() {
  if (!nodes.activityFeed) return;
  try {
    const data = await fetchJson("/api/activity/");
    const rows = data.activity || [];
    if (!rows.length) {
      nodes.activityFeed.innerHTML = `<li class="muted">No activity recorded yet.</li>`;
      return;
    }
    nodes.activityFeed.innerHTML = rows
      .map(
        (row) => `
        <li>
          <span class="activity-label">${escapeHtml(row.action_label)}</span>
          ${row.candidate_id ? `<span class="chip">${escapeHtml(row.candidate_id)}</span>` : ""}
          <span class="muted">${escapeHtml(row.detail || "")}</span>
          <time>${formatDate(row.created_at)}</time>
        </li>`
      )
      .join("");
  } catch (error) {
    nodes.activityFeed.innerHTML = `<li class="muted">Could not load activity.</li>`;
    console.error("Activity load failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status) {
  return { shortlisted: "Shortlisted", review: "Needs review", rejected: "Rejected" }[status] || status;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
