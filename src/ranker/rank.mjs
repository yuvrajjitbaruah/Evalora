import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  compareRanked,
  ROLE_PROFILE,
  scoreCandidate,
  summarizeCandidate
} from "../../public/js/ranker-core.js";

const DEFAULT_CANDIDATES = "data/raw/India_runs_data_and_ai_challenge/candidates.jsonl";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const candidatesPath = args.candidates || DEFAULT_CANDIDATES;
  const outPath = args.out || "outputs/evalora_submission.csv";
  const jsonPath = args.json || "public/data/top_candidates.json";
  const reportPath = args.report || "public/data/score_report.json";
  const topN = Number(args.top || 100);
  const limit = args.limit ? Number(args.limit) : Infinity;

  const started = performance.now();
  const ranked = [];
  const stats = createStats();
  let seen = 0;

  for await (const candidate of readCandidates(candidatesPath)) {
    seen += 1;
    if (seen > limit) break;

    const result = scoreCandidate(candidate);
    updateStats(stats, candidate, result);
    ranked.push({ candidate, result });

    if (ranked.length > topN * 16) {
      ranked.sort(compareRanked);
      ranked.length = topN * 8;
    }
  }

  ranked.sort(compareRanked);
  const selected = ranked.slice(0, topN).map((entry, index) => ({
    ...entry.result,
    rank: index + 1,
    candidate: summarizeCandidate(entry.candidate, entry.result)
  }));

  ensureDir(outPath);
  ensureDir(jsonPath);
  ensureDir(reportPath);

  fs.writeFileSync(outPath, toCsv(selected), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify({ role: ROLE_PROFILE, generated_at: new Date().toISOString(), candidates: selected }, null, 2), "utf8");

  const elapsedMs = Math.round(performance.now() - started);
  const report = buildReport(stats, selected, {
    candidatesPath,
    outPath,
    jsonPath,
    topN,
    seen,
    elapsedMs
  });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Evalora ranked ${seen.toLocaleString()} candidates in ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`CSV: ${path.resolve(outPath)}`);
  console.log(`JSON: ${path.resolve(jsonPath)}`);
  console.log(`Report: ${path.resolve(reportPath)}`);
  console.log(`Top candidate: ${selected[0]?.candidate_id || "none"} (${selected[0]?.score.toFixed(4) || "n/a"})`);
}

async function* readCandidates(candidatesPath) {
  const ext = path.extname(candidatesPath).toLowerCase();
  if (ext === ".json") {
    const parsed = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.candidates || [];
    for (const row of rows) yield row;
    return;
  }

  const stream = fs.createReadStream(candidatesPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield JSON.parse(line);
  }
}

function toCsv(rows) {
  const lines = ["candidate_id,rank,score,reasoning"];
  for (const row of rows) {
    lines.push([
      row.candidate_id,
      row.rank,
      row.score.toFixed(4),
      csvEscape(row.reasoning)
    ].join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function createStats() {
  return {
    count: 0,
    scoreSum: 0,
    components: new Map(),
    titles: new Map(),
    cities: new Map(),
    riskFlags: new Map(),
    conceptHits: new Map()
  };
}

function updateStats(stats, candidate, result) {
  stats.count += 1;
  stats.scoreSum += result.score;
  bump(stats.titles, candidate.profile?.current_title || "Unknown");
  bump(stats.cities, candidate.profile?.location || "Unknown");
  for (const [name, value] of Object.entries(result.components)) {
    stats.components.set(name, (stats.components.get(name) || 0) + value);
  }
  for (const flag of result.evidence.riskFlags) bump(stats.riskFlags, flag);
  for (const concept of result.evidence.concepts) bump(stats.conceptHits, concept);
}

function buildReport(stats, selected, meta) {
  return {
    project: "Evalora",
    role: ROLE_PROFILE,
    generated_at: new Date().toISOString(),
    input: {
      candidates_path: meta.candidatesPath,
      candidates_scored: meta.seen,
      elapsed_ms: meta.elapsedMs,
      output_csv: meta.outPath
    },
    aggregate: {
      mean_score: round(stats.scoreSum / Math.max(stats.count, 1)),
      component_means: Object.fromEntries(
        [...stats.components.entries()].map(([name, total]) => [name, round(total / Math.max(stats.count, 1))])
      ),
      concept_hits: topEntries(stats.conceptHits, 8),
      risk_flags: topEntries(stats.riskFlags, 8)
    },
    shortlist: {
      count: selected.length,
      min_score: selected.length ? round(selected.at(-1).score) : 0,
      max_score: selected.length ? round(selected[0].score) : 0,
      top_titles: topEntriesFromRows(selected, (row) => row.candidate.title, 10),
      top_locations: topEntriesFromRows(selected, (row) => row.candidate.location, 10),
      component_means: averageComponents(selected)
    }
  };
}

function averageComponents(rows) {
  const totals = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.components || {})) {
      totals[key] = (totals[key] || 0) + value;
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value / Math.max(rows.length, 1))]));
}

function topEntriesFromRows(rows, getKey, limit) {
  const map = new Map();
  for (const row of rows) bump(map, getKey(row) || "Unknown");
  return topEntries(map, limit);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function round(value, digits = 4) {
  return Number(Number(value || 0).toFixed(digits));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
