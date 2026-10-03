#!/usr/bin/env node
// dev-server.js -- OPTIONAL local web server that mirrors production Nginx.
//
// You do NOT need this: config.js now auto-detects local dev and talks to the
// backend on :3000 directly, so `python3 -m http.server 8080` works fine.
//
// Use this instead if you want the local setup to behave EXACTLY like the
// server: it serves these files AND proxies /api/* to http://localhost:3000,
// so the frontend and API share one origin (no CORS), and POST works.
//
//   node dev-server.js        # then open http://localhost:8080
//
// Override ports: PORT=9000 API_TARGET=http://localhost:3001 node dev-server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = Number(process.env.PORT || 8080);
const API_TARGET = process.env.API_TARGET || "http://localhost:3000";
const ROOT = __dirname;
const target = new URL(API_TARGET);
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml", ".ico":"image/x-icon", ".png":"image/png" };
http.createServer((req, res) => {
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    const upstreamPath = req.url.replace(/^\/api/, "") || "/";
    const proxyReq = http.request({ hostname: target.hostname, port: target.port || 80,
      method: req.method, path: upstreamPath, headers: { ...req.headers, host: target.host } },
      (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
    proxyReq.on("error", () => { res.writeHead(502, {"content-type":"application/json"});
      res.end(JSON.stringify({ error: "Backend not reachable on " + API_TARGET + " -- run `npm start` in ../backend." })); });
    req.pipe(proxyReq); return;
  }
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(ROOT, path.normalize(rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, {"content-type":"text/plain"}); res.end("not found"); return; }
    res.writeHead(200, {"content-type": TYPES[path.extname(filePath)] || "application/octet-stream"});
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("Paystream frontend  ->  http://localhost:" + PORT);
  console.log("  /api/*  proxied to  " + API_TARGET);
});
