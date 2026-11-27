// Compare the vendor sell price in data/recipes.json with Blizzard's current WoW Forever item data
// for the given ids (IDS), or every tracked item with IDS=all.
import { readFileSync, writeFileSync } from "node:fs";
const REGION = process.env.REGION || "us";
const HOST = `https://${REGION}.api.blizzard.com`, NS = `static-forever-${REGION}`;
const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
const tr = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const TOKEN = (await tr.json()).access_token;
const ITEMS = JSON.parse(readFileSync("data/recipes.json", "utf8")).items;
const ALL = process.env.IDS?.trim() === "all";
const ids = new Set(ALL ? Object.keys(ITEMS) : (process.env.IDS || "").split(/[ ,]+/).filter(Boolean));
console.log(`Checking ${ids.size} items against ${NS}\n`);
let diff = 0;
const fix = {};
let prevFix = {};
try { prevFix = JSON.parse(readFileSync("data/vendor-fix.json", "utf8")).items || {}; } catch {}
for (const iid of ids) {
  const r = await fetch(`${HOST}/data/wow/item/${iid}?namespace=${NS}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = r.ok ? await r.json() : null;
  const api = j?.sell_price, ours = ITEMS[iid]?.s;
  const flag = api == null ? `HTTP ${r.status}` : api !== ours ? "DIFFERENT" : "same";
  if (flag !== "same") diff++;
  if (api != null && (api !== ours || prevFix[iid] != null)) fix[iid] = api;
  if (ALL && flag === "same") continue;
  console.log(`${iid.padStart(6)} ${(ITEMS[iid]?.n || j?.name || "?").padEnd(32)} ours ${String(ours).padStart(6)}  api ${String(api).padStart(6)}  buy ${j?.purchase_price ?? "-"}  ${flag}`);
}
console.log(`\n${diff} of ${ids.size} differ`);
// WRITE=1 (with IDS=all): save the corrections (fork-only data/vendor-fix.json); tools/apply-vendor-fix.mjs patches them into recipes.json.
if (process.env.WRITE === "1" && ALL) {
  const items = Object.fromEntries(Object.entries(fix).sort((a, b) => a[0] - b[0]));
  const path = "data/vendor-fix.json";
  let prev = null; try { prev = JSON.parse(readFileSync(path, "utf8")); } catch {}
  if (JSON.stringify(prev?.items) === JSON.stringify(items)) { console.log("data/vendor-fix.json unchanged"); process.exit(0); }
  writeFileSync(path, JSON.stringify({ _note: "Vendor sell prices (copper) where Blizzard's WoW Forever item data differs from the original author's data/recipes.json. Written by tools/check-vendor.mjs; patched into recipes.json by tools/apply-vendor-fix.mjs.", checked: new Date().toISOString(), items }, null, 1) + "\n");
  console.log(`wrote ${path} (${Object.keys(items).length} items)`);
}
