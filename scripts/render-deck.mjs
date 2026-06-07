import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "render_deck_pdf.py");
const bundledPython = "C:\\Users\\lenovo\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const candidates = [
  process.env.PYTHON,
  fs.existsSync(bundledPython) ? bundledPython : null,
  "python",
  "py"
].filter(Boolean);

let last;
for (const python of candidates) {
  const result = spawnSync(python, [script], {
    cwd: root,
    stdio: "inherit",
    shell: false
  });
  last = result;
  if (result.status === 0) process.exit(0);
}

process.exitCode = last?.status || 1;
