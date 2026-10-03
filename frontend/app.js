// app.js -- the Paystream wallet frontend.
// Talks to the Node API (PAYSTREAM_API, see config.js). Plain fetch + DOM,
// no framework, so students can read every line.

const API = window.PAYSTREAM_API;
document.getElementById("apiBase").textContent = API;

const $ = (id) => document.getElementById(id);
const CCY = { NGN: "₦", GHS: "₵", KES: "KSh" };

// --- small helpers ---
async function api(path, opts) {
  const res = await fetch(API + path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}
const money = (minor) =>
  (minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sym = (ccy) => CCY[ccy] || ccy + " ";
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

// --- state ---
let wallets = [];
let ratesByPair = {};
let current = null; // selected wallet id

// --- load the list of wallets into both dropdowns ---
async function loadWallets() {
  wallets = await api("/wallets");
  const sel = $("walletSelect"), toSel = $("toSelect");
  sel.innerHTML = wallets.map((w) => `<option value="${w.id}">${w.owner} — ${w.currency}</option>`).join("");
  current = current || wallets[0].id;
  sel.value = current;
  refreshToOptions();
}
function refreshToOptions() {
  const toSel = $("toSelect");
  toSel.innerHTML = wallets.filter((w) => w.id !== Number(current))
    .map((w) => `<option value="${w.id}">${w.owner} — ${w.currency}</option>`).join("");
  updateQuote();
}

// --- the balance hero, with the DATABASE/CACHE source badge ---
async function loadBalance() {
  const w = await api(`/wallet/${current}`);
  $("heroOwner").textContent = w.owner + "  ·  " + w.country;
  $("heroCurrency").textContent = w.currency;
  $("heroAmount").textContent = money(w.balance_minor);
  $("heroLabel").textContent = w.label;
  $("fromCurrency").textContent = sym(w.currency);
  const badge = $("sourceBadge");
  if (w.source === "cache") {
    badge.textContent = "served from cache";
    badge.className = "badge badge-cache";
  } else {
    badge.textContent = "served from database";
    badge.className = "badge badge-db";
  }
  updateQuote();
}

// --- transfer history table ---
async function loadHistory() {
  const rows = await api(`/transfers?wallet=${current}`);
  const body = $("historyBody");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="7" class="muted">No transfers yet.</td></tr>`; return; }
  body.innerHTML = rows.map((t) => {
    const when = new Date(t.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<tr>
      <td>${when}</td>
      <td>${t.from_name}</td>
      <td>${t.to_name}</td>
      <td class="num">${sym(t.from_currency)}${money(t.sent_minor)}</td>
      <td class="num">${sym(t.from_currency)}${money(t.fee_minor)}</td>
      <td class="num">${sym(t.to_currency)}${money(t.credited_minor)}</td>
      <td><span class="pill">${t.status}</span></td>
    </tr>`;
  }).join("");
}

// --- FX rates panel ---
async function loadRates() {
  const { rates, source } = await api("/rates");
  ratesByPair = {};
  rates.forEach((r) => { ratesByPair[r.base + r.quote] = r.rate; });
  $("ratesList").innerHTML = rates.map((r) => `<li><span>${r.base} → ${r.quote}</span><b>${r.rate}</b></li>`).join("");
  const badge = $("ratesSource");
  badge.textContent = source;
  badge.className = "badge small " + (source === "cache" ? "badge-cache" : "badge-db");
}

// --- platform metrics ---
async function loadMetrics() {
  const m = await api("/metrics");
  $("mWallets").textContent = m.wallets;
  $("mTransfers").textContent = m.transfers;
  $("mVolume").textContent = money(m.volume_minor);
  $("mFees").textContent = money(m.fees_minor);
}

// --- live fee / recipient preview on the send form ---
function updateQuote() {
  const fromW = wallets.find((w) => w.id === Number(current));
  const toW = wallets.find((w) => w.id === Number($("toSelect").value));
  const major = parseFloat($("amountInput").value);
  if (!fromW || !toW || !major || major <= 0) {
    $("quoteFee").textContent = "—"; $("quoteCredited").textContent = "—"; return;
  }
  const amountMinor = Math.round(major * 100);
  const fee = Math.round(amountMinor * 0.014);
  const rate = fromW.currency === toW.currency ? 1 : (ratesByPair[fromW.currency + toW.currency] || 1);
  const credited = Math.round((amountMinor - fee) * rate);
  $("quoteFee").textContent = sym(fromW.currency) + money(fee);
  $("quoteCredited").textContent = sym(toW.currency) + money(credited);
}

// --- send a transfer ---
async function sendTransfer(e) {
  e.preventDefault();
  const msg = $("sendMsg"); msg.textContent = ""; msg.className = "form-msg";
  const major = parseFloat($("amountInput").value);
  if (!major || major <= 0) { msg.textContent = "Enter an amount."; msg.className = "form-msg err"; return; }
  $("sendBtn").disabled = true;
  try {
    const res = await api("/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: Number(current), to: Number($("toSelect").value), amount_minor: Math.round(major * 100) }),
    });
    msg.textContent = `Sent! Transfer #${res.id}.`; msg.className = "form-msg ok";
    $("amountInput").value = "";
    toast("Transfer sent ✓");
    await Promise.all([loadBalance(), loadHistory(), loadMetrics()]); // balance read now comes from the DB again
  } catch (err) {
    msg.textContent = err.message; msg.className = "form-msg err";
  } finally {
    $("sendBtn").disabled = false;
  }
}

// --- system status pill (health + ready) ---
async function pollStatus() {
  const pill = $("sysStatus"), txt = $("sysStatusText");
  try {
    const r = await api("/ready");
    pill.className = "status-pill status-ok";
    txt.textContent = `API up · db ${r.db} · cache ${r.cache}`;
  } catch {
    pill.className = "status-pill status-bad";
    txt.textContent = "API unreachable";
  }
}

// --- wiring ---
$("walletSelect").addEventListener("change", (e) => {
  current = Number(e.target.value);
  refreshToOptions();
  loadBalance(); loadHistory();
});
$("toSelect").addEventListener("change", updateQuote);
$("amountInput").addEventListener("input", updateQuote);
$("refreshBtn").addEventListener("click", loadBalance); // click twice to see cache!
$("sendForm").addEventListener("submit", sendTransfer);

// --- boot ---
(async function init() {
  await pollStatus();
  try {
    await loadWallets();
  } catch (err) {
    // the API (or the DB behind it) is unreachable -- say so plainly instead
    // of firing /wallet/null and friends into the void.
    $("sysStatus").className = "status-pill status-bad";
    $("sysStatusText").textContent = "API unreachable";
    $("historyBody").innerHTML =
      '<tr><td colspan="7" class="err">Can\'t reach the API at <code>' + API + '</code>. ' +
      'Is the backend running on port 3000 (and Postgres up)?</td></tr>';
    toast("API unreachable \u2014 is the backend running?");
    setInterval(pollStatus, 10000);
    return;
  }
  await Promise.all([loadBalance(), loadHistory(), loadRates(), loadMetrics()]);
  setInterval(pollStatus, 10000);
})();
