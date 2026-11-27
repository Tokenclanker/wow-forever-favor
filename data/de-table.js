// Disenchanting results for WoW Forever (fork-only; used by tools/scan-de.mjs and disenchant.js).
//
// Bands are by the item's REQUIRED level, as the WoW Forever disenchanting guide uses
// (wow-professions.com/forever/disenchanting-guide). Odds and quantities are Classic's, from
// warcraft.wiki.gg "Disenchanting tables", whose item-level bands are the same bands 5 levels higher
// (required 1-10 = item level 5-15, 11-15 = 16-20, ...). In Forever any Enchanting skill can disenchant any item.
// Quantities are spread evenly over their range, so the expected amount is the midpoint.

export const MAT = {
  strange: 10940, soul: 11083, vision: 11137, dream: 11176, illusion: 16204,
  lme: 10938, gme: 10939, lae: 10998, gae: 11082, lmy: 11134, gmy: 11135, lne: 11174, gne: 11175, lee: 16202, gee: 16203,
  sgs: 10978, lgs: 11084, sgw: 11138, lgw: 11139, srs: 11177, lrs: 11178, sbs: 14343, lbs: 14344, nexus: 20725,
};

// Uncommon (green): [max required level, dust, dust qty, essence, essence qty, shard,
//                    armor % [dust, essence, shard], weapon % [dust, essence, shard]]
const GREEN = [
  [10, "strange", [1, 2], "lme", [1, 2], null, [80, 20, 0], [20, 80, 0]],
  [15, "strange", [2, 3], "gme", [1, 2], "sgs", [75, 20, 5], [20, 75, 5]],
  [20, "strange", [4, 6], "lae", [1, 2], "sgs", [75, 15, 10], [15, 75, 10]],
  [25, "soul", [1, 2], "gae", [1, 2], "lgs", [75, 20, 5], [20, 75, 5]],
  [30, "soul", [2, 5], "lmy", [1, 2], "sgw", [75, 20, 5], [20, 75, 5]],
  [35, "vision", [1, 2], "gmy", [1, 2], "lgw", [75, 20, 5], [20, 75, 5]],
  [40, "vision", [2, 5], "lne", [1, 2], "srs", [75, 20, 5], [20, 75, 5]],
  [45, "dream", [1, 2], "gne", [1, 2], "lrs", [75, 20, 5], [20, 75, 5]],
  [50, "dream", [2, 5], "lee", [1, 2], "sbs", [75, 20, 5], [22, 75, 3]],
  [55, "illusion", [1, 2], "gee", [1, 2], "lbs", [75, 20, 5], [22, 75, 3]],
  [99, "illusion", [2, 5], "gee", [2, 3], "lbs", [75, 20, 5], [22, 75, 3]],
];

// Rare (blue): always one shard; from required level 51 a 0.5% chance of a Nexus Crystal instead.
const BLUE = [[20, "sgs"], [25, "lgs"], [30, "sgw"], [35, "lgw"], [40, "srs"], [45, "lrs"], [50, "sbs"], [99, "lbs"]];

// Epic (purple): [max required level, result, qty]. Below required level 35 the odds aren't documented.
const PURPLE = [[40, "srs", [2, 4]], [45, "lrs", [2, 4]], [50, "sbs", [2, 4]], [55, "nexus", [1, 1]], [99, "nexus", [1, 2]]];

const mid = ([a, b]) => (a + b) / 2;

/** Expected materials from disenchanting one item: [{id, qty, p}] (qty = expected amount, p = chance it drops),
 *  or null when unknown. q: "U" | "R" | "E", req: required level, weapon: true for weapons. */
export function deOutcome(q, req, weapon) {
  req = Math.max(1, req || 1);
  if (q === "U") {
    const b = GREEN.find(r => req <= r[0]);
    const [, dust, dq, ess, eq, shard, arm, wep] = b;
    const [pd, pe, ps] = weapon ? wep : arm;
    const out = [{ id: MAT[dust], qty: (pd / 100) * mid(dq), p: pd / 100 }, { id: MAT[ess], qty: (pe / 100) * mid(eq), p: pe / 100 }];
    if (shard && ps) out.push({ id: MAT[shard], qty: ps / 100, p: ps / 100 });
    return out;
  }
  if (q === "R") {
    const b = BLUE.find(r => req <= r[0]);
    if (req > 50) return [{ id: MAT[b[1]], qty: 0.995, p: 0.995 }, { id: MAT.nexus, qty: 0.005, p: 0.005 }];
    return [{ id: MAT[b[1]], qty: 1, p: 1 }];
  }
  if (q === "E") {
    if (req < 35) return null;
    const b = PURPLE.find(r => req <= r[0]);
    return [{ id: MAT[b[1]], qty: mid(b[2]), p: 1 }];
  }
  return null;
}

/** Expected value in copper of disenchanting one item, given a price (copper) per material id. */
export function deValue(q, req, weapon, priceOf) {
  const out = deOutcome(q, req, weapon);
  if (!out) return null;
  return out.reduce((s, o) => s + o.qty * (priceOf(o.id) || 0), 0);
}
