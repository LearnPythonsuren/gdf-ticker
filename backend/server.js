// ---------------------------------------------------------------------------
// Server: serves the frontend, exposes admin key-creation + token auth,
// runs the upstream GdfClient, and fans out live ticks to TV clients over WS.
// ---------------------------------------------------------------------------

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { CONFIG } from "./config.js";
import { tokenStore } from "./tokenStore.js";
import { GdfClient } from "./gdfClient.js";
import { logger } from "./logger.js";
import { instrumentCache } from "./instrumentCache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

const gdf = new GdfClient();
let feedStarted = false;

const fullStats = () => ({ ...gdf.stats(), log: logger.stats() });

// --- Admin auth middleware (protects key creation) --------------------------
function requireAdmin(req, res, next) {
  const pw = req.header("x-admin-password");
  if (pw !== CONFIG.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// --- Key creation tab: register apikey+username, get opaque session token ----
app.post("/api/admin/keys", requireAdmin, (req, res) => {
  const { apikey, username } = req.body || {};
  try {
    const { token, reused } = tokenStore.create(apikey, username);
    // We return ONLY the opaque token. The apikey never leaves the backend.
    res.json({ token, reused });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/admin/keys", requireAdmin, (req, res) => {
  res.json(tokenStore.listSafe());
});

app.delete("/api/admin/keys/:token", requireAdmin, (req, res) => {
  res.json({ revoked: tokenStore.revoke(req.params.token) });
});

// --- Auth tab: client submits opaque token; backend starts the feed ----------
// The apikey is resolved server-side and never returned to the client.
app.post("/api/auth", (req, res) => {
  const { token } = req.body || {};
  const apikey = tokenStore.resolveApiKey(token);
  if (!apikey) return res.status(401).json({ error: "invalid token" });

  if (!feedStarted) {
    feedStarted = true;
    gdf.start(apikey); // apikey used here, never sent to frontend
  }
  res.json({ ok: true, status: gdf.status });
});

// --- Status / stats ----------------------------------------------------------
app.get("/api/stats", (req, res) =>
  res.json(fullStats())
);

// --- Your logs: list, download (admin-protected) -----------------------------
app.get("/api/admin/logs", requireAdmin, (req, res) => {
  res.json(logger.listFiles());
});

app.get("/api/admin/logs/:name", requireAdmin, (req, res) => {
  const p = logger.filePath(req.params.name);
  if (!p) return res.status(404).json({ error: "not found" });
  res.download(p);
});

// --- Cached instrument files: list + download (admin) ------------------------
app.get("/api/admin/instruments", requireAdmin, (req, res) => {
  res.json(instrumentCache.listFiles());
});

app.get("/api/admin/instruments/:name", requireAdmin, (req, res) => {
  const p = instrumentCache.filePath(req.params.name);
  if (!p) return res.status(404).json({ error: "not found" });
  res.download(p);
});

// --- One-time download tickets ----------------------------------------------
// Large live-growing files (e.g. a multi-hundred-MB ticks JSONL) must NOT be
// pulled into the browser as a blob. Instead the admin requests a short-lived
// ticket, then the browser opens a plain URL that streams the file natively.
const downloadTickets = new Map(); // ticket -> { kind, name, expires }

app.post("/api/admin/download-ticket", requireAdmin, (req, res) => {
  const { kind, name } = req.body || {};
  if (!["logs", "instruments"].includes(kind) || !name) {
    return res.status(400).json({ error: "kind (logs|instruments) and name required" });
  }
  const p = kind === "logs" ? logger.filePath(name) : instrumentCache.filePath(name);
  if (!p) return res.status(404).json({ error: "not found" });
  const ticket = crypto.randomBytes(18).toString("hex");
  downloadTickets.set(ticket, { kind, name, expires: Date.now() + 60000 });
  res.json({ url: `/api/download?ticket=${ticket}` });
});

app.get("/api/download", (req, res) => {
  const t = downloadTickets.get(req.query.ticket);
  if (!t || t.expires < Date.now()) {
    downloadTickets.delete(req.query.ticket);
    return res.status(403).send("invalid or expired ticket");
  }
  downloadTickets.delete(req.query.ticket); // one-time use
  const p = t.kind === "logs" ? logger.filePath(t.name) : instrumentCache.filePath(t.name);
  if (!p) return res.status(404).send("not found");
  res.download(p); // streams the file; no full-memory buffering
});

// prune expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of downloadTickets) if (v.expires < now) downloadTickets.delete(k);
}, 30000);

// --- HTTP + WS server --------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

// Track per-client last-broadcast timestamp for delta pushes.
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws._lastSent = 0;
  console.log("[ws] TV client connected, total:", clients.size);

  // Send full snapshot immediately so the board fills.
  ws.send(
    JSON.stringify({ type: "snapshot", rows: gdf.snapshot(), stats: fullStats() })
  );
  ws._lastSent = Date.now();

  ws.on("close", () => {
    clients.delete(ws);
    console.log("[ws] TV client left, total:", clients.size);
  });
});

// Periodic delta broadcast + stale re-evaluation.
setInterval(() => {
  if (clients.size === 0) return;
  const now = Date.now();
  const stats = fullStats();
  for (const ws of clients) {
    if (ws.readyState !== ws.OPEN) continue;
    // Send rows changed since this client's last push. We also re-send the
    // whole board's staleness by letting the client recompute red/green from
    // the `stale` flag we include per row, but to catch symbols going stale
    // with no new tick, we periodically resend a light staleness sweep.
    const rows = gdf.delta(ws._lastSent);
    ws._lastSent = now;
    ws.send(JSON.stringify({ type: "delta", rows, stats }));
  }
}, CONFIG.BROADCAST_INTERVAL_MS);

// Separate, slower full-staleness sweep so rows that stopped ticking flip red
// even though they produced no delta.
setInterval(() => {
  if (clients.size === 0) return;
  const snap = gdf.snapshot(); // includes fresh `stale` flags
  const stalePayload = JSON.stringify({
    type: "staleness",
    rows: snap.map((r) => ({ k: r.k, stale: r.stale })),
    stats: fullStats(),
  });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(stalePayload);
  }
}, 1000);

server.listen(CONFIG.PORT, () => {
  console.log(`[server] listening on :${CONFIG.PORT}`);
  console.log(`[server] exchanges: ${CONFIG.EXCHANGES.join(", ")}`);
  console.log(`[server] max subs: ${CONFIG.MAX_SUBSCRIPTIONS}`);
});
