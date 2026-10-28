# Next session — handoff before context compaction

Read this first. It records owner decisions and measured facts so nothing has to be
re-discovered. `docs/architecture.md` remains the reference for how the code works.

## State

- HEAD was `e3d5baf`. Working tree has the **events / ambushes / heirloom** build
  (uncommitted): 2 new files (`js/content/con-events.js`, `js/encounters.js`) and 16
  modified files.
- `node test_items.js` → **PASSED 254/254**, `loaded 42 scripts`, **PASSED 84/84**, exit 0.
  `node tools/check-order.js` is green (42 scripts, manifest = index.html).
- `test.html` is the browser suite and has not been run since the change; the owner is
  testing the build on the phone now.

## Owner decisions (do not drift from these)

1. **Combat stays automatic.** Attack speed (weapon vs monster) decides the pace. The
   player's decision is made *before* engaging: is my health worth this fight? **No manual
   input during a fight** — no combo meter, no timed strike, no dodge window, no
   wind-up reaction. Those options (1, 2, 3, 4, 5 in `entertainment-plan.md`) are dropped.
2. **Monsters moving once they see the player** (Pixel Dungeon style) is the **last**
   stage of polish. Everything below ships first. Do not start it early; it touches
   `enemiesTurn`, `ambientMob`, pathing and the checkpoint.
3. **Priorities, in owner's order:** (a) item drops, (b) background music, (c) finish the
   seamless floor/wall look for **biomes 3 and 4** (Frosted Vault, Bone Ossuary) — the
   owner believes 1 and 2 are done.
4. Selling gear must stay **not especially lucrative**. The goal is that the player *sees
   enough equipment to have choices*, not that hoarding is a money strategy.

## Measured facts (verified this session)

**Drops** (20k kills per floor, luck 0):
- Kill drop chance is **18%/kill** (not 15.5%: `luckPts()` adds ~1 luck), i.e. **~2.5
  items per 14 kills**, flat from floor 1 to 40.
- Potions: 7%/kill. Elites: +25% chance and x3 rewards. Chests ~14% of floors (up to 45%).
  Boss: guaranteed tier-3 item + one unique.
- So the *raw* rate is not low. The felt problem is **usefulness/visibility**, not volume:
  most drops are common and/or a slot the player already has, and the bag is 16 (up to 24).
- Sell value = `itemPoints × 4`. Shop price = `itemPoints × (19 + 24×ward)`.
- Where: `CONFIG.ITEMS.drop` (`gearBase`, `cap`, `potion`), `CONFIG.ITEMS.price`
  (`sellPerPoint`), `items.js` `rollKillDrop` / `sellValue`, `config.js` shop stock
  (`stockGear:1`), `combat.js` kill/boss branches.

**Floor / wall grid** (`js/render/tiles.js`):
- Biome 0 `floorStyle:"runningbond"` and biome 1 `floorStyle:"dirt"`. Both are baked as a
  3×3-tile torus (`bondTexture` / `drawBondFloor`), so tile edges continue into the next
  copy and **no grid reads**. `BOND_STYLES = { runningbond:true, dirt:true }` at ~line 185.
- **Biomes 2 and 3 have no `floorStyle`**, so they fall back to `drawFloorTile`'s per-tile
  rounded slab + joint (~line 329). That is the visible square grid the owner means.
- Walls (`drawWallTile`, ~line 447) already merge contiguous wall masses via neighbour
  exposure, insets and rounded corners (Batch 20). What remains is the **per-tile brick
  course** painted inside each tile, which gives a square rhythm. There is no per-biome
  wall style flag yet; add one (e.g. `wallStyle:"ice"|"bone"`).

**Music** (`js/sfx.js`):
- `sfxStartAmbience`, `sfxStopAmbience`, `sfxSetWard` are **empty stubs** (lines ~557–559).
  `prefs.music`, `musicBus`, both sliders and `sfxSetWard` call sites already exist.
  Audio is gesture-unlocked; no audio files are used anywhere (all WebAudio synthesis).

## Procedure A — item drops (first task)

Do not simply double the number. In order:

1. **Instrument first.** Add per-run counters (`runStats.gearSeen`, `gearEquipped`, slots
   seen) and a `?debug=1` readout. One floor should tell you whether drops are rare or just
   useless.
2. **Smart slot bias.** When rolling the slot, weight it toward slots where the player's
   equipped item is missing or weakest (compare `itemPoints`). This is the single biggest
   "I have options" lever and costs no extra items. Keep ~30% fully random so it does not
   feel scripted.
3. **A floor guarantee.** If a floor has produced no gear by the time the last ~4 enemies
   are left, guarantee one drop (the next kill or the chest). Guarantees are felt;
   percentages are not.
4. **Shop stock.** `stockGear:1` → **2**, and make one of them favour an unfilled slot.
   Shops are on floors 5/15/25/35, so this is a real option stop.
5. **Only then raise the raw rate**, modestly: `gearBase 0.155 → ~0.20`. That is about
   +0.7 items/floor on top of ~2.5 — enough to feel, not enough to flood a 16-slot bag.
6. **Keep selling flat or lower it.** If observed gold from sales rises, drop
   `sellPerPoint 4 → 3`. The owner wants choices, not a gold farm. Do not raise bag
   capacity in the same pass.
7. **Verify:** simulate 10 floors per ward (items seen, bag-full events, sell total), then
   a phone run counting *useful upgrades* per floor, not raw drops.

## Procedure B — music

- Keep it file-free: one procedural loop per ward on `musicBus`, built from the existing
  oscillator/noise helpers in `sfx.js`.
- `sfxSetWard(id)` is already called on descend; use it to cross-fade the ward's loop.
- Suggested palette: ward 1 low drone + slow drips; ward 2 breathy noise + low pulse;
  ward 3 high glassy pad + wind; ward 4 dry bone clicks + deep toll. 8–16 bars, slow.
- Respect `prefs.music` (the slider already writes it), mute, and the gesture unlock.
- No new ids are needed; both sliders exist.

## Procedure C — biomes 3 and 4, seamless floor and wall

1. Add two baked torus styles to `bondTexture`'s dispatch: **"ice"** (large cracked ice
   sheets, no lattice, pale seams that wander) and **"bone"** (packed bone-dust / rubble
   flagging with no square joints). Reuse the existing 3×3 torus so edges continue.
2. Set `floorStyle:"ice"` on `BIOMES[2]` and `floorStyle:"bone"` on `BIOMES[3]`, and add
   both to `BOND_STYLES`. Verify at 2× zoom on floors 21 and 31 that no tile edge reads.
3. **Walls:** add a per-biome `wallStyle` flag. Replace the per-tile brick course with a
   continuous course texture for these two biomes (ice: vertical fracture lines that cross
   tile edges; bone: stacked long bones / banded dust). Keep the existing exposure, inset,
   wobble, rounded corners, torch sheen and drop shadows — only the interior pattern
   changes.
4. Do not touch biomes 1–2: ward 1's floor is explicitly locked ("byte for byte") and
   ward 2's dirt field is deliberate.
5. Check `test.html` §4/§5 still pass (clutter family and boss sprite checks).

## Deferred — monsters that move on sight (last)

Design notes for later: aggro radius (~5 tiles, line of sight), one step per player action
scaled by monster speed, no stacking on occupied tiles, and they stop adjacent to the
player and hand over to the existing auto-combat. Needs care with `ambientMob`,
out-of-combat attacks, pathfinding, the checkpoint rebuild, and floor-clear (a wandering
monster must not soft-lock the stairs).

## Hard rules (unchanged)

- Every `.js` in both `js/manifest.js` and `index.html`, same order.
- Every id the code looks up exists in `index.html` **and** `test.html`'s `#fixtures`.
- Guarded `$()` returns a truthy stub, so `if(!el)` is not an existence test.
- A new ability needs a `case` in `castAbility`; a new `traitBuffs()` key needs a consumer.
- Overlays go in `uiBlocked()` and `hideAll()`.
- Do not re-cap abilities, and do not remove passive ranks, without asking.
- No manual-input combat mechanics.
