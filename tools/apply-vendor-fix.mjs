// Patch Blizzard's current vendor sell prices (data/vendor-fix.json) into data/recipes.json, which the
// leveling planner and Money making page read (items[id].s). Fork-only: the original author's recipes.json
// still has stale values for some items. Run by the weekly "Refresh vendor prices" job and by
// tools/sync-upstream.sh after every merge, so an upstream rebuild of recipes.json keeps the fixes.
// recipes.json is one minified line; parse + stringify round-trips it exactly, so only the patched values change.
import { readFileSync, writeFileSync } from "node:fs";

const path = "data/recipes.json";
const text = readFileSync(path, "utf8");
const recipes = JSON.parse(text);
const fix = JSON.parse(readFileSync("data/vendor-fix.json", "utf8")).items;
let changed = 0;
for (const [id, s] of Object.entries(fix)) {
  const it = recipes.items[id];
  if (it && it.s !== s) { it.s = s; changed++; }
}
const out = JSON.stringify(recipes) + (text.endsWith("\n") ? "\n" : "");
if (out !== text) writeFileSync(path, out);
console.log(`vendor prices: ${changed} item${changed === 1 ? "" : "s"} patched in ${path} (${Object.keys(fix).length} corrections on file)`);
