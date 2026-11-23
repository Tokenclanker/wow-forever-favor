// One-off: find which Blizzard Profile API paths answer for a WoW Forever character (no realms; first-last
// name), and what they contain. Credentials from env (repo secrets in Actions). Prints status + a snippet.
const REGION = process.env.REGION || "us";
const NAME = (process.env.CHAR || "saphappy-papi").toLowerCase().trim().replace(/\s+/g, "-");
const GUILD = (process.env.GUILD || "out-of-network-healers").toLowerCase().trim().replace(/\s+/g, "-");
const HOST = `https://${REGION}.api.blizzard.com`;
const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
const tr = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const TOKEN = (await tr.json()).access_token;
const get = async (path, ns) => {
  const r = await fetch(`${HOST}${path}${path.includes("?") ? "&" : "?"}namespace=${ns}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  let body = ""; try { body = await r.text(); } catch {}
  return { status: r.status, body };
};
const [first, last] = NAME.split("-");
const NS = [`profile-forever-${REGION}`, `profile-classic1x-${REGION}`, `profile-classic-${REGION}`, `profile-${REGION}`];
const PATHS = [
  `/profile/wow/character/${NAME}`,
  `/profile/wow/character/forever/${NAME}`,
  `/profile/wow/character/${first}/${last}`,
  `/profile/wow/character/${last}/${first}`,
  `/profile/wow/character/normal/${NAME}`,
  `/profile/wow/character/pve/${NAME}`,
  `/profile/wow/character/2/${NAME}`,
  `/profile/wow/character/${REGION}/${NAME}`,
  `/profile/wow/forever/character/${NAME}`,
];
const hits = [];
for (const ns of NS) for (const p of PATHS) {
  const r = await get(p, ns);
  console.log(`${r.status}  ${ns.padEnd(22)} ${p}`);
  if (r.status === 200) hits.push([p, ns, r.body]);
}
for (const [p, ns, body] of hits) {
  console.log(`\n=== ${p} (${ns})\n${body.slice(0, 1500)}`);
  for (const sub of ["professions", "equipment", "specializations", "statistics", "reputations", "achievements", "quests/completed"]) {
    const r = await get(`${p}/${sub}`, ns);
    console.log(`\n--- /${sub}: ${r.status}\n${r.status === 200 ? r.body.slice(0, 1500) : ""}`);
  }
}
console.log("\n=== guild");
for (const ns of [`profile-forever-${REGION}`, `profile-classic1x-${REGION}`]) for (const p of [`/data/wow/guild/forever/${GUILD}/roster`, `/data/wow/guild/${GUILD}/roster`, `/data/wow/guild/normal/${GUILD}/roster`, `/data/wow/guild/2/${GUILD}/roster`]) {
  const r = await get(p, ns);
  console.log(`${r.status}  ${ns.padEnd(22)} ${p}${r.status === 200 ? "\n" + r.body.slice(0, 800) : ""}`);
}
