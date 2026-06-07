import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const submissionPath = args.submission || "outputs/evalora_submission.csv";
  const candidatesPath = args.candidates || "data/raw/India_runs_data_and_ai_challenge/candidates.jsonl";
  const expectedRows = Number(args.rows || 100);

  const rows = parseCsv(fs.readFileSync(submissionPath, "utf8"));
  const errors = [];

  if (rows.header.join(",") !== "candidate_id,rank,score,reasoning") {
    errors.push(`Header must be candidate_id,rank,score,reasoning; got ${rows.header.join(",")}`);
  }
  if (rows.records.length !== expectedRows) {
    errors.push(`Expected ${expectedRows} data rows; got ${rows.records.length}`);
  }

  const ids = new Set();
  const ranks = new Set();
  let previousScore = Infinity;
  for (const record of rows.records) {
    const rank = Number(record.rank);
    const score = Number(record.score);
    if (!/^CAND_\d{7}$/.test(record.candidate_id)) errors.push(`Bad candidate_id: ${record.candidate_id}`);
    if (ids.has(record.candidate_id)) errors.push(`Duplicate candidate_id: ${record.candidate_id}`);
    ids.add(record.candidate_id);
    if (!Number.isInteger(rank) || rank < 1 || rank > expectedRows) errors.push(`Bad rank for ${record.candidate_id}: ${record.rank}`);
    if (ranks.has(rank)) errors.push(`Duplicate rank: ${rank}`);
    ranks.add(rank);
    if (!Number.isFinite(score) || score < 0 || score > 1) errors.push(`Score out of range for ${record.candidate_id}: ${record.score}`);
    if (score > previousScore + 1e-9) errors.push(`Scores increase at rank ${rank}`);
    previousScore = score;
    if (!record.reasoning || record.reasoning.trim().length < 20) errors.push(`Reasoning too short for ${record.candidate_id}`);
  }

  for (let rank = 1; rank <= expectedRows; rank += 1) {
    if (!ranks.has(rank)) errors.push(`Missing rank: ${rank}`);
  }

  const candidateIds = await loadCandidateIds(candidatesPath);
  for (const id of ids) {
    if (!candidateIds.has(id)) errors.push(`candidate_id not found in pool: ${id}`);
  }

  if (errors.length) {
    console.error(`Validation failed with ${errors.length} issue(s):`);
    for (const error of errors.slice(0, 40)) console.error(`- ${error}`);
    if (errors.length > 40) console.error(`- ...and ${errors.length - 40} more`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validation passed: ${submissionPath}`);
}

async function loadCandidateIds(candidatesPath) {
  const ids = new Set();
  if (path.extname(candidatesPath).toLowerCase() === ".json") {
    const parsed = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.candidates || [];
    for (const row of rows) ids.add(row.candidate_id);
    return ids;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(candidatesPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    ids.add(JSON.parse(line).candidate_id);
  }
  return ids;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length);
  const header = splitCsvLine(lines.shift() || "");
  const records = lines.map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""]));
  });
  return { header, records };
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
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
