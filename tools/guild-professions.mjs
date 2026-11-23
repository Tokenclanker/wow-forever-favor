// Print every guild member's level, class and profession skills from Blizzard's WoW Forever Profile API
// as one JSON object (between ===JSON=== markers), for updating the guild's crafting tracker.
const REGION = process.env.REGION || "us", NS = `profile-forever-${REGION}`;
const GUILD = (process.env.GUILD || "out-of-network-healers").toLowerCase().trim().replace(/\s+/g, "-");
const HOST = `https://${REGION}.api.blizzard.com`;
const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
const tr = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const TOKEN = (await tr.json()).access_token;
const get = async path => {
  const r = await fetch(`${HOST}${path}${path.includes("?") ? "&" : "?"}namespace=${NS}&locale=en_US`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return r.ok ? r.json() : { _status: r.status };
};
const CLASSES = { 1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid" };
const roster = await get(`/data/wow/guild/${GUILD}/roster`);
const out = { guild: roster.guild?.name, fetched: new Date().toISOString(), members: [] };
for (const m of roster.members || []) {
  const c = m.character;
  const slug = c.key.href.match(/character\/([^?]+)/)[1];
  const p = await get(`/profile/wow/character/${slug}/professions`);
  const prof = x => ({ name: x.profession?.name, skill: x.tiers?.[0]?.skill_points ?? x.skill_points ?? null, max: x.tiers?.[0]?.max_skill_points ?? x.max_skill_points ?? null, recipes: x.tiers?.[0]?.known_recipes?.length ?? 0 });
  out.members.push({
    slug, name: slug.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join(" "),
    level: c.level, class: CLASSES[c.playable_class?.id] || c.playable_class?.id, rank: m.rank,
    status: p._status || 200,
    primaries: (p.primaries || []).map(prof), secondaries: (p.secondaries || []).map(prof),
  });
}
console.log("===JSON===\n" + JSON.stringify(out) + "\n===JSON===");
console.log(`${out.members.length} members, ${out.members.filter(m => m.status !== 200).length} without profession data`);
