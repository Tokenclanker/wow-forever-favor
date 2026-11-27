#!/usr/bin/env bash
# Merge the original site (AidVir/wow-forever-favor) into this fork, keeping this fork's NA PvE setup:
#   - price data and the house mapping are always kept from this fork,
#   - the NA wording on the pages, the "Normal" label and REGION=us are re-applied after the merge,
#   - any other conflict stops the sync without changing anything.
# Run by .github/workflows/sync-upstream.yml (daily), or by hand: bash tools/sync-upstream.sh
# GITHUB_TOKEN cannot push workflow files, so in Actions (ALLOW_WORKFLOWS unset) upstream changes to
# .github/workflows are skipped and the run is marked failed at the end so someone merges them by hand.
set -euo pipefail

UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/AidVir/wow-forever-favor.git}
KEEP_OURS="data/prices.json data/sales.json data/trends.json data/crate-ids.json data/houses.json"
RETEXT="index.html favor.html writs.html money.html scripts/fetch-prices.mjs data/recipes.json"

git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git fetch -q upstream main
if git merge-base --is-ancestor upstream/main HEAD; then echo "Already up to date with upstream."; exit 0; fi
UP=$(git rev-parse --short upstream/main)
echo "Upstream changes since last sync:"; git log --oneline --no-merges HEAD..upstream/main | grep -v "Update AH prices" || true

git merge --no-ff --no-commit upstream/main >/dev/null 2>&1 || true

# 1. Price data and house ids: always this fork's.
for f in $KEEP_OURS; do
  if git cat-file -e "HEAD:$f" 2>/dev/null; then git checkout HEAD -- "$f"; else git rm -q -f --ignore-unmatch -- "$f"; fi
done

# 2. Files where this fork only changed wording or vendor prices: take upstream's version, then re-apply below.
for f in $RETEXT; do
  if git ls-files -u -- "$f" | grep -q .; then git checkout --theirs -- "$f"; git add -- "$f"; fi
done

# 3. Workflow files.
skipped_wf=""
for f in $(git diff --name-only HEAD...upstream/main -- .github/workflows); do
  case "$f" in .github/workflows/sync-upstream.yml|.github/workflows/probe-houses.yml) continue;; esac
  if [ "${ALLOW_WORKFLOWS:-0}" = 1 ]; then
    if git ls-files -u -- "$f" | grep -q .; then git checkout --theirs -- "$f"; git add -- "$f"; fi
  else
    skipped_wf="$skipped_wf $f"
    if git cat-file -e "HEAD:$f" 2>/dev/null; then git checkout HEAD -- "$f"; else git rm -q -f --ignore-unmatch -- "$f"; fi
  fi
done

# Re-apply this fork's NA edits (no-ops when already present).
sed -i 's/EU PvP auction house/NA PvE (Normal) auction house/g; s/Live EU PvP auction house prices/Live NA PvE (Normal) auction house prices/g; s/EU · PvP/US · Normal/g' \
  index.html favor.html writs.html money.html
sed -i 's/name: "PvP" }/name: "Normal" }/' scripts/fetch-prices.mjs
sed -i 's/Not affiliated with Blizzard Entertainment\./World of Warcraft® and Blizzard Entertainment® are trademarks of Blizzard Entertainment, Inc. This fan site is not affiliated with or endorsed by Blizzard. Auction and item data from the Blizzard Battle.net API./' \
  index.html favor.html writs.html money.html   # trademark notice and data credit in the footer
for f in index.html favor.html writs.html money.html; do   # fork.js: wowauctions.net history links
  grep -q 'src="fork.js"' "$f" || sed -i 's|^</body>|<script type="module" src="fork.js"></script>\n</body>|' "$f"
done
wf=.github/workflows/update-prices.yml
if ! grep -q '^ *REGION: us$' "$wf"; then
  sed -i 's/^\( *\)BLIZZARD_CLIENT_SECRET: \(.*\)$/\1BLIZZARD_CLIENT_SECRET: \2\n\1REGION: us/' "$wf"
fi
node tools/apply-vendor-fix.mjs   # Blizzard's current vendor prices (data/vendor-fix.json) into recipes.json
git add -- index.html favor.html writs.html money.html scripts/fetch-prices.mjs data/recipes.json "$wf"

# Anything still conflicted is a real clash with this fork's changes: stop and leave the fork as it was.
if git ls-files -u | grep -q .; then
  echo "::error::Conflicts the sync can't resolve on its own:"; git diff --name-only --diff-filter=U
  git merge --abort; exit 1
fi
grep -q '^ *REGION: us$' "$wf" || { echo "::error::Could not re-apply REGION: us"; git merge --abort; exit 1; }
grep -q '"us"' data/houses.json || { echo "::error::data/houses.json lost the us houses"; git merge --abort; exit 1; }

# Syntax check every script before committing.
for f in $(git ls-files '*.js' '*.mjs'); do node --check "$f" || { echo "::error::$f fails node --check"; git merge --abort; exit 1; }; done

git commit -q -m "Sync with AidVir/wow-forever-favor ($UP)" -m "Keeps this fork's NA PvE prices, houses and wording." -m "${SYNC_TRAILER:-}"
for i in 1 2 3; do
  git push -q origin HEAD:main && break
  [ "$i" = 3 ] && { echo "::error::Push failed three times"; exit 1; }
  git pull -q --no-rebase --no-edit origin main   # the price bot pushed meanwhile; its commits only touch price data
done
echo "Synced to upstream $UP."

if [ -n "$skipped_wf" ]; then
  echo "::error::Upstream changed workflow files, which this run can't push:$skipped_wf. Everything else is synced; merge these by hand."
  exit 1
fi
