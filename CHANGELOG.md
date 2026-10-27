# Changelog

All notable changes to underward. Format loosely follows Keep a Changelog.

Code comments used to carry this history inline ("Batch 17", "FIX #1", "REMOVED
on 16 Oct", "migrated from combat.js fallback", "owner batch B1"). Those notes
have been consolidated here so the source files describe *invariants* rather
than narrating their own past.

---

## [Unreleased]

### Restructure — Phase 1 (no behaviour change)

- **CSS extracted from `index.html` into `css/game.css`.** The page carried four
  separate `<style>` blocks totalling 660 lines; they are now one external
  stylesheet loaded with `<link>`, preserving original order so the cascade is
  identical. `index.html` went from 977 to ~316 lines.
- **`js/util.js` added** — one home for the pure numeric/colour helpers, which
  had drifted: `rgbOf`/`mixRGB`/`blendHex` lived only inside `render.js`,
  `prob`/`geq`/`leq` only inside `levels.js`, and the position hashes sat in
  `state.js`, which loads *after* the content files that need them (so
  `con-worldart.js` had to wrap them lazily). `util.js` now loads first.
- **`js/manifest.js` added** — the canonical script load order, declared once.
  `index.html` must still list its `<script>` tags physically (no build step),
  so `tools/check-order.js` asserts the two agree and that no file on disk is
  unlisted.
- **`test.html` no longer hard-codes its own 34-file `FILES[]`**; it reads the
  manifest instead, so the list can only drift in one place.
- **`node test_items.js` is now the single gate.** It runs `tools/check-order.js`
  first (load order + disk reconciliation) and exits non-zero before loading a
  single game script if the manifest and `index.html` disagree. One command
  catches both load-order drift and item-math regressions.
  CI wiring for `check-order.js` was deliberately skipped: this repo has no
  commits yet, so nothing has ever been pushed and no workflow has ever run.
  The local gate is both faster and harder to ignore.

### Changed — GitHub Actions

- **`unzip.yml` rewritten.** Three real bugs fixed:
  1. It extracted **in place** with `unzip -o`, so an archive containing a stale
     `.git/` would corrupt the checkout mid-job and the commit/push would fail.
     It now unpacks to a temp dir and copies selectively, excluding `.git` and
     `.github`.
  2. `cp -r underward/*` only worked if the archive's top folder was literally
     named `underward`. It now walks down to wherever `index.html` lives, so
     `underward/`, `underward-main/` or a flat archive all work — and it aborts
     without touching the repo if no `index.html` is found.
  3. Its own commit deletes `underward.zip`, and `paths: ['underward.zip']`
     matches deletions too, so the workflow could trigger itself. Added an
     `if: github.actor != 'github-actions[bot]'` guard.
  Also: `concurrency` so two uploads cannot race, `timeout-minutes`, and pushing
  with `HEAD:${GITHUB_REF_NAME}`.
- **`syntax-check.yml` widened into real CI** (kept the filename, so the zip flow
  cannot leave a stale workflow behind). It now also runs
  `tools/check-order.js` and `test_items.js`, checks that `css/game.css` is
  present and linked, triggers on `.html`/`css/`/`tools/` changes, cancels
  superseded runs, and fails cleanly with `::error` annotations.

### Restructure — Phase 2 (started, no behaviour change)

- **`js/gen/bsp.js` extracted from `js/levels.js`.** The floor-plan geometry —
  `splitRect`, `splitAt`, `intersectLine`, `edgeKey`, `graphPath`, `distFrom`,
  `dijkstraPath`, `paintRoom`, `tryMerge`, plus the `BSP_MIN`/`BSP_MAX`
  constants — moved out verbatim. Every body is a character-for-character copy,
  and `levels.js` destructures them back into local names, so **no call site
  changed**. `levels.js`: 1155 → 1017 lines.

- **Why this seam was taken first.** It is the one large block in `levels.js`
  with no shared closure state: the functions are pure and read only
  `Delve.rng` and `Delve.T`, both resolved at call time.

- **What was deliberately left alone.** `dressBossArena` (~600 lines, called
  from exactly one place) and the item-rolling helpers in `items.js` share
  module-level helpers (`IT`, `FAM`, `gauss`, `basesForSlot`, `pickBase`,
  `STAT_LABEL`). Splitting those needs an intermediate shared module and carries
  real risk, and the repo still has no commit history to fall back on.

- Verified after the move: 37-script manifest consistent, `test_items` 84/84,
  0 interior void gaps, 0 border leaks over 10 floors, all four boss floors
  (10/20/30/40) generate, dirt texture unchanged at 298 colours.

### Fixed — map generation

- **Floors could generate with no monsters (~10% of runs).** `spawnMonster` read
  `G.grid[y][x]` without bounds checks, so a scatter offset past the map edge
  threw and aborted `genFloor`. Bounded the read, inset the BSP by one tile,
  clamped scatter offsets, and added a guaranteed top-up sweep. Swarm floors now
  pick the largest chamber rather than any chamber (the old minimum was 3 tiles).
- **Rooms could run off the north/top edge, showing raw void.** The secret-room
  3x3 carve wrote `FLOOR` onto row 0 / column 0 (or one tile in, leaving no stone
  between the floor and the void ring). The carve now skips the outer ring, and a
  hard stone cap closes any ring cell whose inward neighbour is walkable.
- **Walls could be missing next to a room, showing a black gap.** Unconnected BSP
  leaves are intentionally left as `VOID`, but a merge, door or secret-room carve
  could open a painted room onto one, leaving a hole the renderer fills with pure
  black. A final pass now forces any `VOID` touching a walkable tile back to
  stone. Void that only touches stone stays void, preserving the ragged
  silhouette.

### Fixed — rendering

- **Dropped the flat per-tile tone rectangle on earth floors.** `floorTone` was
  sampled once per tile centre and stamped as a single flat `fillRect` over the
  whole tile, so each tile became a hard-edged rectangle of one alpha and the
  boundary between neighbours read as a square grid. Dirt floors now skip the
  overlay and let their own multi-octave noise shade the surface. Masonry keeps
  the overlay unchanged.
- **Fixed sub-pixel seams between tiles on fractional-DPR screens.** The
  offscreen tile bitmap was sized `Math.round(ts*dpr)` but scaled by raw `dpr`,
  so on Android's common 2.625/2.75 ratios the drawn tile never quite filled its
  own bitmap, leaving a gap at every tile edge. It now scales by the exact ratio
  `canvasWidth / ts`.
- **Replaced a precision-losing position hash for texture baking.** `Delve.hash3`
  multiplies floats past 2^53 and skews low for small integer inputs (measured:
  every value for one salt landed between 0 and 0.46). That flattened the earth
  texture and made the mycelium field match zero pixels. Texture baking now uses
  a local `texHash` built on `Math.imul`, which is exactly 32-bit. The global
  hash is untouched, so gameplay randomness did not shift.

### Changed — The Blackvein (ward 2) art

- Floor changed from stone/scree to **living forest floor**: brown earth with a
  seamless periodic-noise field, mycelium threads, dry-earth flecks and scattered
  fallen leaves and roots. No lattice, so no tile grid can read.
- Floor growth enabled (`growthPal` / `growthLinked`); previously biomes 1-3 had
  no growth at all because `placeGrowth` bails without a ward config.
- Clutter placement randomised per tile. The painter used to draw every
  decoration at `ts*0.50` — mechanically dead-centre on each tile.
- Moonlit purple water (`#3a2048`) deliberately left unchanged.

### Changed — items / economy

- Boss gold is no longer converted twice (removed from `triggerVictory`; it is
  converted only in `retreat()` and the victory-hub handler).
- Selling added: per-item `sellItem` and a two-tap "Sell all" in the carried list.
- Item tests: `test_items.js` extended to 84 checks.

---

## Notes on testing

Three verification stacks exist and are not yet consolidated:

| Stack | What it covers |
| --- | --- |
| `test.html` (browser) | load order, symbol ownership, duplicates, index.html parity, DOM ids, floor gen, movement |
| `test_items.js` (node) | item rolling, quality curve, pricing, sell, inventory (84 checks) |
| `underward-sim-tools/engine.py` | long-run balance simulation against the real JS (outside this repo) |

Both `test.html` and `test_items.js` must be run after touching generation,
rendering or item code.
