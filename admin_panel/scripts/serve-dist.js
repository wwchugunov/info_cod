import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = (() => {
  const raw = process.env.DIST_DIR;
  if (!raw) {
    return path.resolve(__dirname, "..", "dist");
  }
  return path.isAbsolute(raw) ? raw : path.resolve(__dirname, "..", raw);
})();
const basePath = (() => {
  const raw = (process.env.BASE_PATH || "/admin").trim() || "/admin";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, "");
})();
const port = Number(process.env.PORT) || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, "Server error");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    send(res, 200, data, { "Content-Type": contentType });
  });
}

const server = http.createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (rawPath === "/" || rawPath === "") {
    res.writeHead(302, { Location: `${basePath}/` });
    res.end();
    return;
  }

  if (!rawPath.startsWith(basePath)) {
    send(res, 404, "Not found");
    return;
  }

  let relPath = rawPath.slice(basePath.length);
  if (relPath === "" || relPath === "/") {
    relPath = "/index.html";
  }

  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(distDir, normalized);

  if (filePath.startsWith(distDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }

  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    serveFile(res, indexPath);
    return;
  }

  send(res, 404, "Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`admin_panel dist server listening on ${port}`);
});
