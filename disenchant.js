// Disenchanting (fork-only page): green / blue / purple gear on the AH worth more disenchanted than it costs.
// Gear listings come from data/de-listings.json (tools/scan-de.mjs, hourly); material prices from
// data/prices.json (cheapest listing on the same house); odds from data/de-table.js.
import { $, store, esc, gold, loadPrices, loadJson, ago, bindFaction, wh } from "./common.js";
import { deOutcome } from "./data/de-table.js";

const AH_CUT = 0.95;
const MAX_ROWS = 300;
const state = {
  faction: store.get("faction", "horde"),
  neutral: store.get("neutral", false),
  q: store.get("de:q", { U: true, R: true, E: true }),
  val: store.get("de:val", "sell"),
  min: store.get("de:min", 100),
  open: new Set(),
};
let PRICES, DE, ITEMS;

const QNAME = { U: "Green", R: "Blue", E: "Purple" };
const plus = c => `<span class="${c >= 0 ? "pos" : "neg"}">${c >= 0 ? "+" : "−"}${gold(Math.abs(c))}</span>`;
const where = h => (h === "neutral" ? "Blackwater" : h === "alliance" ? "Alliance" : "Horde");
const matName = id => ITEMS[id]?.n || `Item ${id}`;

// Material price on the player's faction house: what you'd get selling it (cut taken) or what it costs to buy.
function matPrice(id) {
  const c = PRICES.factions[state.faction]?.items?.[id]?.[0]?.[0];
  if (!c) return null;
  return state.val === "sell" ? c * AH_CUT : c;
}

function rows() {
  const houses = [state.faction, ...(state.neutral ? ["neutral"] : [])];
  const out = [], seen = new Map();
  for (const h of houses) {
    for (const [iid, price, tl] of DE.houses[h]?.listings || []) {
      const it = DE.items[iid];
      if (!it || !state.q[it[1]]) continue;
      const mats = deOutcome(it[1], it[2], it[4] === "W");
      if (!mats) continue;
      let ev = 0, missing = false;
      const parts = mats.map(m => {
        const p = matPrice(m.id);
        if (p == null) missing = true;
        ev += m.qty * (p || 0);
        return { ...m, price: p };
      });
      const key = `${h}:${iid}:${price}`;
      if (seen.has(key)) { seen.get(key).n++; continue; }   // same item at the same price: one row with a count
      const row = { key, h, iid, it, price, tl, ev, parts, missing, profit: ev - price, n: 1 };
      seen.set(key, row); out.push(row);
    }
  }
  return out.filter(r => r.profit > 0 && r.profit >= state.min).sort((a, b) => b.profit - a.profit);
}

function detail(r) {
  const lines = r.parts.map(m => {
    const pct = m.p >= 0.995 ? "" : `${+(m.p * 100).toFixed(1)}% · `;
    const avg = m.p ? m.qty / m.p : 0;
    const amt = avg % 1 ? `${+avg.toFixed(1)} avg` : `${avg}`;
    const val = m.price == null ? `<span class="muted">no listing</span>` : `${gold(Math.round(m.price))} each → ${gold(Math.round(m.qty * m.price))} expected`;
    return `<li>${pct}${amt} × ${wh(m.id, matName(m.id))}: ${val}</li>`;
  }).join("");
  return `<tr class="detail"><td colspan="6">
    <p>${QNAME[r.it[1]]} ${r.it[4] === "W" ? "weapon" : "armor"}, requires level ${r.it[2] || "—"} (item level ${r.it[3]}). Disenchants into:</p>
    <ul>${lines}</ul>
    ${r.missing ? `<p class="muted">A material isn't listed on your auction house right now, so it's counted as 0.</p>` : ""}
  </td></tr>`;
}

function render() {
  if (!PRICES || !DE) return;
  const house = PRICES.factions[state.faction].house.name;
  $("#market").textContent = `${PRICES.region} · ${PRICES.ruleset.name} · ${house}${state.neutral ? " + Blackwater" : ""}`;
  const all = rows();
  const total = all.reduce((a, r) => a + r.n * r.profit, 0), cost = all.reduce((a, r) => a + r.n * r.price, 0);
  const count = all.reduce((a, r) => a + r.n, 0);
  const best = all[0];

  $("#hero").innerHTML = best
    ? `<div class="hero-main"><div class="eyebrow">Gear worth disenchanting on your auction house</div>
        <div class="hero-val">${gold(Math.round(total))} <span>expected profit across ${count} item${count > 1 ? "s" : ""}, for ${gold(cost)}</span></div>
        <div class="hero-what">Best: <span class="q-${best.it[1]}">${wh(best.iid, best.it[0])}</span> for ${gold(best.price)}, disenchants for about ${gold(Math.round(best.ev))}: ${plus(Math.round(best.profit))}</div></div>
       <div class="hero-alt"><div class="eyebrow">Next best</div>${all.slice(1, 5).map(r =>
        `<div class="alt"><span><span class="q-${r.it[1]}">${r.n > 1 ? `${r.n} × ` : ""}${esc(r.it[0])}</span><small>${gold(r.price)}${r.n > 1 ? " each" : ""} · disenchants for ~${gold(Math.round(r.ev))} · ${where(r.h)}</small></span><b>${plus(Math.round(r.profit))}</b></div>`).join("") || `<div class="alt"><span>No others above your filter</span></div>`}</div>`
    : `<div class="hero-main"><div class="eyebrow">Gear worth disenchanting on your auction house</div>
        <div class="hero-val">None <span>right now</span></div>
        <div class="hero-what">Nothing listed is worth more disenchanted than its buyout with these settings. Try "Show all" or valuing materials at what they cost.</div></div>`;

  $("#rows").innerHTML = all.slice(0, MAX_ROWS).map(r => {
    const open = state.open.has(r.key);
    return `<tr class="row${open ? " open" : ""}" data-key="${r.key}" tabindex="0" aria-expanded="${open}">
      <td><span class="caret" aria-hidden="true">▸</span> <b class="q-${r.it[1]}">${wh(r.iid, r.it[0])}</b>${r.n > 1 ? ` <span class="muted">× ${r.n} listed</span>` : ""}</td>
      <td class="muted">${where(r.h)}</td>
      <td class="num">${r.it[2] || "—"}</td>
      <td class="num">${gold(r.price)}</td>
      <td class="num">${gold(Math.round(r.ev))}</td>
      <td class="num pf">${plus(Math.round(r.profit))}</td>
    </tr>${open ? detail(r) : ""}`;
  }).join("")
    + (all.length > MAX_ROWS ? `<tr><td colspan="6" class="empty">Showing the best ${MAX_ROWS} of ${all.length}. Raise "Hide items with profit under" to narrow it down.</td></tr>` : "")
    || `<tr><td colspan="6" class="empty">Nothing is worth disenchanting with these settings right now.</td></tr>`;
}

function bind() {
  bindFaction(state, render);
  for (const q of ["U", "R", "E"]) {
    const c = $(`#q${q}`); c.checked = !!state.q[q];
    c.onchange = () => { state.q = { ...state.q, [q]: c.checked }; store.set("de:q", state.q); render(); };
  }
  const val = $("#val"); val.value = state.val;
  val.onchange = () => { state.val = val.value; store.set("de:val", state.val); render(); };
  const min = $("#min"); min.value = String(state.min);
  if (min.value !== String(state.min)) { state.min = 100; min.value = "100"; }
  min.onchange = () => { state.min = Number(min.value); store.set("de:min", state.min); render(); };
  const nt = $("#neutral"); nt.checked = state.neutral;
  nt.onchange = () => { state.neutral = nt.checked; store.set("neutral", state.neutral); render(); };
  const toggle = tr => { const k = tr.dataset.key; state.open.has(k) ? state.open.delete(k) : state.open.add(k); render(); };
  $("#rows").onclick = e => { const tr = e.target.closest("tr.row"); if (tr && !e.target.closest("a")) toggle(tr); };
  $("#rows").onkeydown = e => { const tr = e.target.closest("tr.row"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(tr); } };
}

const status = () => { $("#status").innerHTML = `Prices updated <b>${ago(PRICES.updated)}</b> · gear scanned <b>${ago(DE.updated)}</b>`; };

async function refresh() {
  try {
    const [p, d] = await Promise.all([loadPrices(), loadJson("data/de-listings.json")]);
    if (p.updated !== PRICES?.updated || d.updated !== DE?.updated) { PRICES = p; DE = d; render(); }
  } catch { /* keep what we have */ }
  if (PRICES && DE) status();
}

async function load() {
  try {
    const [p, d, rec] = await Promise.all([loadPrices(), loadJson("data/de-listings.json"), loadJson("data/recipes.json")]);
    PRICES = p; DE = d; ITEMS = rec.items;
    status();
    bind(); render();
    setInterval(refresh, 10 * 60 * 1000);
  } catch (e) {
    console.error(e);
    $("#status").textContent = "Could not load data. Try again shortly.";
    $("#status").classList.add("err");
  }
}
load();
