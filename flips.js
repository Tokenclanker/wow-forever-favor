// Vendor flips (fork-only page): items listed on the AH for less than a vendor pays for them.
// Uses data/prices.json (cheapest listings per house, price per item) and the vendor sell price `s`
// in data/recipes.json items (Blizzard's WoW Forever item data).
import { $, store, esc, gold, loadPrices, loadJson, ago, bindFaction, wh } from "./common.js";

const state = {
  faction: store.get("faction", "horde"),
  neutral: store.get("neutral", false),
  min: store.get("fl:min", 100),
};
let PRICES, ITEMS;

const plus = c => `<span class="pos">+${gold(c)}</span>`;

// One row per item and house with listings below the vendor price.
function flips() {
  const houses = [state.faction, ...(state.neutral ? ["neutral"] : [])];
  const out = [];
  for (const h of houses) {
    const items = PRICES.factions[h]?.items || {};
    for (const [id, book] of Object.entries(items)) {
      const vendor = ITEMS[id]?.s;
      if (!vendor || !book?.length || book[0][0] >= vendor) continue;
      let units = 0, cost = 0;
      for (const [p, q] of book) { if (p >= vendor) break; units += q; cost += p * q; }
      out.push({ id, h, cheapest: book[0][0], vendor, units, cost, profit: vendor * units - cost });
    }
  }
  return out.sort((a, b) => b.profit - a.profit);
}

function render() {
  if (!PRICES) return;
  const house = PRICES.factions[state.faction].house.name;
  $("#market").textContent = `${PRICES.region} · ${PRICES.ruleset.name} · ${house}${state.neutral ? " + Blackwater" : ""}`;
  const all = flips();
  const shown = all.filter(x => x.profit >= state.min);
  const total = shown.reduce((a, x) => a + x.profit, 0);
  const where = h => h === "neutral" ? "Blackwater" : h === "alliance" ? "Alliance" : "Horde";

  const best = shown[0];
  $("#hero").innerHTML = best
    ? `<div class="hero-main"><div class="eyebrow">Vendor flips on your auction house right now</div>
        <div class="hero-val">${gold(total)} <span>profit across ${shown.length} item${shown.length > 1 ? "s" : ""}</span></div>
        <div class="hero-what">Biggest: ${best.units} × ${wh(best.id, ITEMS[best.id]?.n || best.id)} at ${gold(best.cheapest)}${best.units > 1 ? " and up" : ""}, vendor pays ${gold(best.vendor)} each: ${plus(best.profit)}</div></div>
       <div class="hero-alt"><div class="eyebrow">Next biggest</div>${shown.slice(1, 5).map(x =>
        `<div class="alt"><span>${esc(ITEMS[x.id]?.n || x.id)}<small>${x.units} × from ${gold(x.cheapest)} · vendor ${gold(x.vendor)} · ${where(x.h)}</small></span><b>${plus(x.profit)}</b></div>`).join("") || `<div class="alt"><span>No others above your filter</span></div>`}</div>`
    : `<div class="hero-main"><div class="eyebrow">Vendor flips on your auction house right now</div>
        <div class="hero-val">None <span>above your filter</span></div>
        <div class="hero-what">${all.length ? `${all.length} smaller flip${all.length > 1 ? "s" : ""} hidden: lower "Hide flips worth less than" to see them.` : "Nothing is listed below its vendor price in this snapshot."}</div></div>`;

  $("#rows").innerHTML = shown.map(x => `<tr>
      <td><b>${wh(x.id, ITEMS[x.id]?.n || x.id)}</b></td>
      <td class="muted">${where(x.h)}</td>
      <td class="num">${gold(x.cheapest)}</td>
      <td class="num">${gold(x.vendor)}</td>
      <td class="num">${plus(x.vendor - x.cheapest)}</td>
      <td class="num">${x.units.toLocaleString("en-US")}</td>
      <td class="num">${gold(x.cost)}</td>
      <td class="num pf">${plus(x.profit)}</td>
    </tr>`).join("")
    || `<tr><td colspan="8" class="empty">${all.length ? "Every flip right now is below your filter." : "Nothing is listed below its vendor price in this snapshot."}</td></tr>`;
}

function bind() {
  bindFaction(state, render);
  const min = $("#min"); min.value = String(state.min);
  if (min.value !== String(state.min)) { state.min = 100; min.value = "100"; }
  min.onchange = () => { state.min = Number(min.value); store.set("fl:min", state.min); render(); };
  const nt = $("#neutral"); nt.checked = state.neutral;
  nt.onchange = () => { state.neutral = nt.checked; store.set("neutral", state.neutral); render(); };
}

async function refresh() {
  try {
    const p = await loadPrices();
    if (p.updated !== PRICES?.updated) { PRICES = p; render(); }
  } catch { /* keep the prices we have */ }
  if (PRICES) $("#status").innerHTML = `Prices updated <b>${ago(PRICES.updated)}</b>`;
}

async function load() {
  try {
    const [p, rec] = await Promise.all([loadPrices(), loadJson("data/recipes.json")]);
    PRICES = p; ITEMS = rec.items;
    $("#status").innerHTML = `Prices updated <b>${ago(PRICES.updated)}</b>`;
    const u = $("#updated"); if (u) u.textContent = `Prices from ${new Date(PRICES.updated).toLocaleString()}.`;
    bind(); render();
    setInterval(refresh, 10 * 60 * 1000);
  } catch (e) {
    console.error(e);
    $("#status").textContent = "Could not load data. Try again shortly.";
    $("#status").classList.add("err");
  }
}
load();
