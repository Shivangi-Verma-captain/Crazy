// Minimal local dev server (no dependencies).
// Serves static files + POST /api/decide by reusing api/decide.js.
// On Vercel, api/decide.js runs as a serverless function — this file is ignored there.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import decide from "./api/decide.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env loader (no dependency). Real key should come from env var.
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile) && !process.env.AI_GATEWAY_API_KEY) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*AI_GATEWAY_API_KEY\s*=\s*(.*)\s*$/);
    if (m) process.env.AI_GATEWAY_API_KEY = m[1].replace(/^["']|["']$/g, "");
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/decide") {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Method not allowed. Use POST /api/decide." }));
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Request body must be valid JSON." }));
      }
      const mockReq = { method: "POST", body };
      const mockRes = {
        statusCode: 200,
        setHeader() {},
        status(c) { this.statusCode = c; return this; },
        json(o) {
          res.writeHead(this.statusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(o));
        },
      };
      try {
        await decide(mockReq, mockRes);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Local server error." }));
      }
    });
    return;
  }

  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const full = path.join(__dirname, decodeURIComponent(file));
  if (!full.startsWith(__dirname) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CHAOS BUTTON running at http://localhost:${PORT}`);
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log("WARNING: AI_GATEWAY_API_KEY is not set. /api/decide will return a setup error.");
    console.log("Get a key and run: $env:AI_GATEWAY_API_KEY='...' (PowerShell) or export AI_GATEWAY_API_KEY=...");
  }
});
