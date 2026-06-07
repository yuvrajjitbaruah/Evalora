import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".pdf", "application/pdf"]
]);

const args = parseArgs(process.argv.slice(2));
const requestedPort = Number(args.port || 4173);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");

start(requestedPort);

function start(port) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const safePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    let filePath;

    if (url.pathname === "/") {
      filePath = path.join(publicRoot, "index.html");
    } else if (safePath.startsWith("src/") || safePath.startsWith("outputs/") || safePath.startsWith("docs/")) {
      filePath = path.join(root, safePath);
    } else {
      filePath = path.join(publicRoot, safePath);
    }

    if (!isInside(filePath, root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": MIME.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < requestedPort + 20) {
      start(port + 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Evalora is running at http://127.0.0.1:${port}`);
  });
}

function isInside(filePath, parent) {
  const relative = path.relative(parent, filePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
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
