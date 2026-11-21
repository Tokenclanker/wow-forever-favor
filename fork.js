// Fork-only add-on (Tokenclanker/wow-forever-favor): after every Wowhead item link, add a small ↗ link to
// that item's price history on wowauctions.net (NA Normal, for the faction picked in the header).
// Kept out of the original site's files so the daily sync with upstream (tools/sync-upstream.sh) never
// conflicts with it; the sync re-adds the <script> tag to the pages if an upstream change drops it.
const BASE = "https://www.wowauctions.net/auctionHouse/forever-us/pve-forever-us/";
const SEL = 'a[href*="wowhead.com/forever/item="]';

const css = document.createElement("link");
css.rel = "stylesheet";
css.href = "fork.css";
document.head.append(css);

// "Vendor flips" (flips.html, fork-only) in the header tabs and footer tool list of every page.
for (const nav of document.querySelectorAll("nav.tabs, .site-foot nav ul")) {
  if (nav.querySelector('a[href="flips.html"]')) continue;
  const a = Object.assign(document.createElement("a"), { href: "flips.html", textContent: "Vendor flips" });
  if (nav.tagName === "UL") { const li = document.createElement("li"); li.append(a); nav.append(li); } else nav.append(a);
}

const faction = () => (document.body.dataset.faction === "alliance" ? "alliance" : "horde");
const href = id => `${BASE}${faction()}/item-${id}`;

function addLinks() {
  for (const a of document.querySelectorAll(SEL)) {
    if (a.nextElementSibling?.classList.contains("ah-hist")) continue;
    const id = a.href.match(/item=(\d+)/)?.[1];
    if (!id) continue;
    const h = document.createElement("a");
    h.className = "ah-hist";
    h.dataset.id = id;
    h.href = href(id);
    h.target = "_blank";
    h.rel = "noopener";
    h.title = "Price history on wowauctions.net";
    h.setAttribute("aria-label", `${a.textContent} price history on wowauctions.net`);
    h.textContent = "↗";
    a.after(h);
  }
}

let queued = false;
new MutationObserver(muts => {
  if (muts.some(m => m.type === "attributes")) {
    document.querySelectorAll("a.ah-hist").forEach(h => { h.href = href(h.dataset.id); });
  }
  if (!queued && muts.some(m => m.type === "childList")) {
    queued = true;
    requestAnimationFrame(() => { queued = false; addLinks(); });
  }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-faction"] });

addLinks();
