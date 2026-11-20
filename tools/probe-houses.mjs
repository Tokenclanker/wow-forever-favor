// One-off: print cheapest price and total units of a few commodities in every Forever auction house,
// to match your in-game AH to a house id. Credentials come from env (repo secrets in Actions).
const REGION = process.env.REGION || "us";
const HOST = `https://${REGION}.api.blizzard.com`, NS = `dynamic-forever-${REGION}`;
const ITEMS = { 2770: "Copper Ore", 2589: "Linen Cloth", 2592: "Wool Cloth" };
const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
const tr = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const TOKEN = (await tr.json()).access_token;
const get = async p => {
  const r = await fetch(`${HOST}${p}${p.includes("?") ? "&" : "?"}namespace=${NS}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return r.ok ? { json: await r.json(), lm: r.headers.get("last-modified") } : { status: r.status };
};
const g = c => `${Math.floor(c / 10000) ? Math.floor(c / 10000) + "g " : ""}${Math.floor(c / 100) % 100}s ${c % 100}c`;
const idx = await get("/data/wow/ruleset/1/auctions/");
const houses = idx.json.auctions.map(h => ({ id: h.id, name: h.name?.en_US || h.name }));
console.log(`${REGION.toUpperCase()} houses: ${houses.length}\n`);
for (const h of houses) {
  const r = await get(`/data/wow/ruleset/1/auctions/${h.id}/commodities`);
  if (!r.json) { console.log(`${h.id} ${h.name}: HTTP ${r.status}`); continue; }
  const parts = Object.entries(ITEMS).map(([iid, n]) => {
    const ls = (r.json.auctions || []).filter(a => a.item.id === Number(iid));
    if (!ls.length) return `${n}: none`;
    const min = Math.min(...ls.map(a => a.unit_price)), units = ls.reduce((s, a) => s + a.quantity, 0);
    return `${n}: ${g(min)} / ${units} units`;
  });
  console.log(`${h.id} ${h.name} [${r.lm}]\n   ${parts.join("   |   ")}`);
}
