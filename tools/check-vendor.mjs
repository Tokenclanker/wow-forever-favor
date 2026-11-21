// One-off: compare the vendor sell price in data/recipes.json with Blizzard's current WoW Forever item data
// for every item now listed below that price (the Vendor flips candidates), plus any ids passed in IDS.
import { readFileSync } from "node:fs";
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
const P = JSON.parse(readFileSync("data/prices.json", "utf8"));
const ALL = process.env.IDS?.trim() === "all";
const ids = new Set(ALL ? Object.keys(ITEMS) : (process.env.IDS || "").split(/[ ,]+/).filter(Boolean));
for (const h of Object.values(P.factions)) for (const [iid, book] of Object.entries(h.items || {}))
  if (ITEMS[iid]?.s && book?.[0]?.[0] < ITEMS[iid].s) ids.add(iid);
console.log(`Checking ${ids.size} items against ${NS}\n`);
let diff = 0;
for (const iid of ids) {
  const r = await fetch(`${HOST}/data/wow/item/${iid}?namespace=${NS}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = r.ok ? await r.json() : null;
  const api = j?.sell_price, ours = ITEMS[iid]?.s;
  const flag = api == null ? `HTTP ${r.status}` : api !== ours ? "DIFFERENT" : "same";
  if (flag !== "same") diff++;
  if (ALL && flag === "same") continue;
  console.log(`${iid.padStart(6)} ${(ITEMS[iid]?.n || j?.name || "?").padEnd(32)} ours ${String(ours).padStart(6)}  api ${String(api).padStart(6)}  buy ${j?.purchase_price ?? "-"}  ${flag}`);
}
console.log(`\n${diff} of ${ids.size} differ`);
