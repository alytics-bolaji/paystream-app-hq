// server.js -- Paystream wallet API (the backend tier).
//
// Four-tier app: this backend talks to PostgreSQL (the record of truth) and
// Redis (a 60-second cache). The frontend (served by Nginx) calls this API.
//
// The teaching star of the show is GET /wallet/:id : the first read comes
// from the database (source: "database"), and reads within the next 60s come
// straight from Redis (source: "cache"). Students can SEE caching working.

const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");
const { quote } = require("./lib/money");

// ----------------------------------------------------------------- config
const PORT = parseInt(process.env.PORT || "3000", 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "60", 10); // seconds
const DATABASE_URL = process.env.DATABASE_URL ||
  "postgres://paystream:paystream@localhost:5432/paystream";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ----------------------------------------------------------------- clients
const pool = new Pool({ connectionString: DATABASE_URL });

const cache = redis.createClient({ url: REDIS_URL });
let cacheReady = false;
cache.on("ready", () => { cacheReady = true; });
cache.on("error", () => { cacheReady = false; }); // never crash on cache errors
cache.connect().catch(() => { cacheReady = false; });

// best-effort cache helpers: if Redis is down, the app still works (slower)
async function cacheGet(key) {
  if (!cacheReady) return null;
  try { const v = await cache.get(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
async function cacheSet(key, value) {
  if (!cacheReady) return;
  try { await cache.set(key, JSON.stringify(value), { EX: CACHE_TTL }); }
  catch { /* ignore */ }
}
async function cacheDel(...keys) {
  if (!cacheReady) return;
  try { await cache.del(keys); } catch { /* ignore */ }
}

// ----------------------------------------------------------------- app
const app = express();
app.use(express.json());

// simple CORS so the frontend can call the API during local development
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- health & readiness (used by the deploy script and by monitoring) ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "wallet-api" });
});

app.get("/ready", async (_req, res) => {
  const out = { db: "down", cache: "down" };
  try { await pool.query("SELECT 1"); out.db = "up"; } catch { /* db down */ }
  if (cacheReady) { try { await cache.ping(); out.cache = "up"; } catch { /* */ } }
  const ok = out.db === "up"; // the DB is required; cache is best-effort
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not-ready", ...out });
});

// --- list wallets (for the frontend's wallet picker) ---
app.get("/wallets", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.id, w.label, w.currency, u.name AS owner, u.country
         FROM wallets w JOIN users u ON u.id = w.user_id
        ORDER BY w.id`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- THE caching demo: one wallet, with its source (database vs cache) ---
app.get("/wallet/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  const key = `wallet:${id}`;

  const cached = await cacheGet(key);
  if (cached) {
    return res.json({ ...cached, source: "cache" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT w.id, w.label, w.currency, w.balance_minor, u.name AS owner, u.country
         FROM wallets w JOIN users u ON u.id = w.user_id
        WHERE w.id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "wallet not found" });
    const wallet = { ...rows[0], balance_minor: Number(rows[0].balance_minor) };
    await cacheSet(key, wallet);           // cache for CACHE_TTL seconds
    res.json({ ...wallet, source: "database" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- transfer history (optionally filtered to one wallet) ---
app.get("/transfers", async (req, res) => {
  const wallet = req.query.wallet ? parseInt(req.query.wallet, 10) : null;
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.from_wallet, t.to_wallet, t.sent_minor, t.fee_minor,
              t.fx_rate, t.credited_minor, t.status, t.created_at,
              fw.currency AS from_currency, tw.currency AS to_currency,
              fu.name AS from_name, tu.name AS to_name
         FROM transfers t
         JOIN wallets fw ON fw.id = t.from_wallet
         JOIN wallets tw ON tw.id = t.to_wallet
         JOIN users   fu ON fu.id = fw.user_id
         JOIN users   tu ON tu.id = tw.user_id
        ${wallet ? "WHERE t.from_wallet = $1 OR t.to_wallet = $1" : ""}
        ORDER BY t.created_at DESC
        LIMIT 25`, wallet ? [wallet] : []);
    res.json(rows.map((r) => ({
      ...r,
      sent_minor: Number(r.sent_minor),
      fee_minor: Number(r.fee_minor),
      credited_minor: Number(r.credited_minor),
      fx_rate: Number(r.fx_rate),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- send money: the write path (and it invalidates the cache) ---
app.post("/transfers", async (req, res) => {
  const from = parseInt(req.body.from, 10);
  const to = parseInt(req.body.to, 10);
  const amount = parseInt(req.body.amount_minor, 10);
  if (!Number.isInteger(from) || !Number.isInteger(to) || !Number.isInteger(amount)) {
    return res.status(400).json({ error: "from, to and amount_minor must be integers" });
  }
  if (from === to) return res.status(400).json({ error: "cannot transfer to the same wallet" });
  if (amount <= 0) return res.status(400).json({ error: "amount must be positive" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // lock both wallet rows so two transfers can't race
    const { rows: ws } = await client.query(
      "SELECT id, currency, balance_minor FROM wallets WHERE id IN ($1,$2) FOR UPDATE",
      [from, to]);
    const fromW = ws.find((w) => w.id === from);
    const toW = ws.find((w) => w.id === to);
    if (!fromW || !toW) { await client.query("ROLLBACK"); return res.status(404).json({ error: "wallet not found" }); }

    // look up the FX rate for this currency pair
    const { rows: fx } = await client.query(
      "SELECT rate FROM fx_rates WHERE base = $1 AND quote = $2",
      [fromW.currency, toW.currency]);
    const rate = fx.length ? Number(fx[0].rate) : (fromW.currency === toW.currency ? 1 : null);
    if (rate === null) { await client.query("ROLLBACK"); return res.status(400).json({ error: `no FX rate for ${fromW.currency}->${toW.currency}` }); }

    const q = quote(amount, rate);
    if (Number(fromW.balance_minor) < q.sentMinor) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "insufficient balance" });
    }

    await client.query("UPDATE wallets SET balance_minor = balance_minor - $1 WHERE id = $2", [q.sentMinor, from]);
    await client.query("UPDATE wallets SET balance_minor = balance_minor + $1 WHERE id = $2", [q.creditedMinor, to]);
    const { rows: tr } = await client.query(
      `INSERT INTO transfers (from_wallet, to_wallet, sent_minor, fee_minor, fx_rate, credited_minor, status)
       VALUES ($1,$2,$3,$4,$5,$6,'settled') RETURNING id, created_at`,
      [from, to, q.sentMinor, q.feeMinor, rate, q.creditedMinor]);
    await client.query("COMMIT");

    // the write changed both balances, so their cached copies are now stale
    await cacheDel(`wallet:${from}`, `wallet:${to}`);

    res.status(201).json({
      id: tr[0].id, from, to, rate,
      sent_minor: q.sentMinor, fee_minor: q.feeMinor, credited_minor: q.creditedMinor,
      status: "settled", created_at: tr[0].created_at,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// --- FX rates (also cached, also reports its source) ---
app.get("/rates", async (_req, res) => {
  const cached = await cacheGet("rates");
  if (cached) return res.json({ rates: cached, source: "cache" });
  try {
    const { rows } = await pool.query(
      "SELECT base, quote, rate FROM fx_rates WHERE base <> quote ORDER BY base, quote");
    const rates = rows.map((r) => ({ ...r, rate: Number(r.rate) }));
    await cacheSet("rates", rates);
    res.json({ rates, source: "database" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- simple metrics (for a dashboard / the monitoring week) ---
app.get("/metrics", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT (SELECT count(*) FROM wallets)                   AS wallets,
             (SELECT count(*) FROM transfers)                 AS transfers,
             (SELECT COALESCE(sum(sent_minor),0) FROM transfers) AS volume_minor,
             (SELECT COALESCE(sum(fee_minor),0)  FROM transfers) AS fees_minor`);
    const m = rows[0];
    res.json({
      wallets: Number(m.wallets),
      transfers: Number(m.transfers),
      volume_minor: Number(m.volume_minor),
      fees_minor: Number(m.fees_minor),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// start only when run directly (so tests can require this file if needed)
if (require.main === module) {
  app.listen(PORT, () => console.log(`paystream wallet-api listening on :${PORT}`));
}

module.exports = app;
