// Disenchanting scan (fork-only; runs hourly in .github/workflows/scan-de.yml).
// Reads every non-commodity auction in this fork's three NA houses (data/houses.json), keeps green / blue /
// purple armor and weapons, and writes the cheap ones to data/de-listings.json for disenchant.html.
// Item details (quality, required level, armor or weapon) come from Blizzard's item data once per item and
// are cached in data/de-items.json. Credentials from env (repo secrets in Actions).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { deValue } from "../data/de-table.js";

const REGION = process.env.REGION || "us", RULESET = process.env.RULESET_ID || "1";
const HOST = `https://${REGION}.api.blizzard.com`, DYN = `dynamic-forever-${REGION}`, STATIC = `static-forever-${REGION}`;
const MAX_LOOKUPS = Number(process.env.MAX_LOOKUPS || 6000);   // new items looked up per run (rest next run)
const KEEP_RATIO = 1.25;   // keep listings up to 25% above the item's disenchant value at material buy prices
const QUALITY = { UNCOMMON: "U", RARE: "R", EPIC: "E" };

const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
const tr = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const TOKEN = (await tr.json()).access_token;
async function api(path, ns) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${HOST}${path}?namespace=${ns}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1000 * (i + 1))); continue; }
    return r.ok ? { json: await r.json(), lastModified: r.headers.get("last-modified") } : { status: r.status };
  }
  return { status: 429 };
}

const houses = JSON.parse(readFileSync("data/houses.json", "utf8"))[REGION][RULESET];
const prices = JSON.parse(readFileSync("data/prices.json", "utf8"));
const cachePath = "data/de-items.json";
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : { items: {}, skip: [] };
const skip = new Set(cache.skip);

// 1. Every non-commodity auction per house: itemId -> [[buyout per item, timeLeft], ...]
const TL = { SHORT: 0, MEDIUM: 1, LONG: 2, VERY_LONG: 3 };
const byHouse = {}, lastModified = {};
for (const [fac, hid] of Object.entries(houses)) {
  const r = await api(`/data/wow/ruleset/${RULESET}/auctions/${hid}`, DYN);
  if (!r.json) throw new Error(`house ${hid}: HTTP ${r.status}`);
  lastModified[fac] = r.lastModified;
  const m = {};
  for (const a of r.json.auctions || []) {
    if (!a.buyout || !a.item?.id) continue;
    (m[a.item.id] ||= []).push([Math.round(a.buyout / (a.quantity || 1)), TL[a.time_left] ?? 0]);
  }
  byHouse[fac] = m;
  console.log(`${fac} (${hid}): ${r.json.auctions?.length || 0} auctions, ${Object.keys(m).length} items`);
}

// 2. Look up items not seen before (green+ armor and weapons are kept, everything else skipped for good).
const unknown = [...new Set(Object.values(byHouse).flatMap(m => Object.keys(m)))].filter(i => !cache.items[i] && !skip.has(Number(i)));
const todo = unknown.slice(0, MAX_LOOKUPS);
console.log(`${unknown.length} new items, looking up ${todo.length}`);
let done = 0;
async function worker() {
  while (todo.length) {
    const iid = todo.pop();
    const r = await api(`/data/wow/item/${iid}`, STATIC);
    done++;
    if (!r.json) { if (r.status === 404) skip.add(Number(iid)); continue; }
    const j = r.json, q = QUALITY[j.quality?.type], cls = j.item_class?.id;
    if (q && (cls === 2 || cls === 4)) cache.items[iid] = [j.name, q, j.required_level || 0, j.level || 0, cls === 2 ? "W" : "A"];
    else skip.add(Number(iid));
  }
}
await Promise.all(Array.from({ length: 20 }, worker));
console.log(`looked up ${done}; cache: ${Object.keys(cache.items).length} disenchantable, ${skip.size} skipped`);
cache.skip = [...skip].sort((a, b) => a - b);
cache.updated = new Date().toISOString();
writeFileSync(cachePath, JSON.stringify(cache) + "\n");

// 3. Keep listings priced near or below what they disenchant into (the page does the exact maths).
const out = { updated: new Date().toISOString(), region: REGION.toUpperCase(), lastModified, houses: {}, items: {} };
for (const [fac, m] of Object.entries(byHouse)) {
  const book = prices.factions?.[fac]?.items || {};
  const buyPrice = mid => book[mid]?.[0]?.[0] || 0;   // cheapest listing of that material on this house
  const keep = [];
  for (const [iid, ls] of Object.entries(m)) {
    const it = cache.items[iid];
    if (!it) continue;
    const ev = deValue(it[1], it[2], it[4] === "W", buyPrice);
    if (!ev) continue;
    for (const [price, tl] of ls) if (price <= ev * KEEP_RATIO) { keep.push([Number(iid), price, tl]); out.items[iid] = it; }
  }
  keep.sort((a, b) => a[1] - b[1]);
  out.houses[fac] = { house: houses[fac], listings: keep };
  console.log(`${fac}: ${keep.length} listings near or below disenchant value`);
}
writeFileSync("data/de-listings.json", JSON.stringify(out) + "\n");
