# Next session — handoff before context compaction

Read this first. It records owner decisions and measured facts so nothing has to be
re-discovered. `docs/architecture.md` remains the reference for how the code works.

## State (verified at handoff)

**Green gate:** `node test_items.js` → **PASSED 281/281** from `test_ui.js`, then
`loaded 44 scripts` and **PASSED 116/116** from `test_items.js` (it runs `test_ui.js`
first), exit 0. `node tools/check-order.js`
→ green (42 scripts, manifest = index.html). Every `.js` passes `node --check`.

**Working tree is uncommitted.** HEAD is `e3d5baf`. Built since then, all tested:

1. **Floor events, ambushes, heirloom** — new files `js/content/con-events.js` (data)
   and `js/encounters.js` (rules); `eventScreen` overlay in `uiBlocked()` + `hideAll()`.
2. **HUD actions moved** — 📊 📍 ☰ 🎒 live in `#hudActions`, a sibling of `#hud` inside
   `#app`, absolute bottom-right at 44px. `Delve.setHudVisible(on)` owns the HUD **and**
   the cluster; never toggle `#hud` directly. Top strip is status only (FLOOR, rests,
   💰, 💎). 🎒 carries an unseen-items badge (see 5); 📍 lights while the map is open
   (`Delve.setMinimapOpen`).
3. **Board inset** — `#app` is padded by `--hud-h` (top) and `--ui-bottom-px` (bottom),
   measured in `main.js` (`syncHudHeight`, `syncBottomInset`) and kept live by two
   `ResizeObserver`s; `Delve.resize()` measures the **canvas**, not `window.inner*`.
   This stops a top-edge room's wall row hiding behind the status strip, and stops the
   bottom buttons covering the last row. Do not hard-code either inset.
4. **Scrolling screens** — `#inventoryScreen` (plus level-up, victory, death, event)
   have `overflow-y:auto`; the inventory header is sticky so ✕ stays reachable.
5. **🎒 badge fixed (owner's phone report).** It counted `G.items` — loot on the
   **floor** — so one drop anywhere left a "1" on the button all floor and equipping
   the drop changed nothing. Now `it.isNew` is set on every bag insert and `updateHUD()`
   shows `Delve.unseenCount()`; `openInventory` calls `markBagSeen()`, `equipItem`
   clears its own item, `save.js`'s `cleanItems` strips the flag. Title = `carried/cap
   — N new`. `__testSanitizeRun` is now actually exported, so two checks that had never
   run do.
6. **Growth is one form per biome (latest).** `js/growth.js` became
   `js/growth/{core,moss,mycelium}.js`: core owns rooms/anchors/bake cache/wall
   climbs and the two draw seams, and a biome NAMES its form with
   `BIOMES[n].growthStyle` (`Delve.registerGrowthStyle`). Biome 1 = `moss` (the old
   code moved, bakes pixel-identical), biome 2 = `mycelium` (thin branching veins with
   `growthVeinPal` and `C.WALL_MYCELIUM` climb art). Biomes 3–4 name nothing yet, so
   they grow nothing — that is Procedure C's job, and it is now a new file each.
7. **Background music** — four beds in `music/` (biome1-1 … biome4-1.mp3), played by
   `sfx.js` via `MUSIC_TRACKS` (one array per ward, ward from `getWard`: 1–10 → 1 …
   31–40 → 4). No HTML5 `loop`: 2s tail fade-out, then `ended` picks the next bed and
   fades in; 700 ms cross-fade on ward change. Mute and the music slider are mirrored
   onto the `<audio>` element (it sits outside the WebAudio graph).

**To ship, the owner must upload:** the whole tree, **plus `music/`** (currently
untracked), and the updated `.github/workflows/syntax-check.yml` (copies in
`/sdcard/underward-workflows/`, with a README explaining the two changes: `music/**`
path trigger + a "Music beds are present" step). `unzip.yml` needed no change.

**`test.html` (browser suite) has not been run** since these changes — the phone run is
the outstanding confirmation, together with whatever the owner reports back.

## Owner decisions (do not drift from these)

1. **Combat stays automatic — except abilities.** Once you tap into a fight, the exchange
   runs on its own: the player's swing clock is `baseInterval / playerSpeed()` (weapon
   family speed + armour weight + AGI `speedPerAgi` + Chill/speed effects), the monster's
   is `baseInterval / m.speed`, both driven by an 80 ms `setInterval` in
   `Delve.startCombat` (`js/combat.js:109-149`), with hit-stop freezing both timers.
   **Abilities remain player-triggered**: tap the bar → `activateAbility` (`js/ui.js`) →
   `Delve.castAbility` (`js/traits.js:334`), which spends Energy and hands the monsters a
   turn (`enemiesTurn()`); targeted abilities arm `G.targetingAbility` and wait for a tap.
   So the player still *acts* — just not with the basic attack. The decision the design
   leans on is made *before* engaging: is this fight worth my health and Energy?
   **Dropped:** combo meter, timed strike, dodge window, wind-up reaction (options 1, 2, 3,
   4, 5 in `entertainment-plan.md`).
2. **Monsters moving once they see the player** (Pixel Dungeon style) is the **last**
   stage of polish. Everything below ships first. Do not start it early; it touches
   `enemiesTurn`, `ambientMob`, pathing and the checkpoint.
3. **Priorities, in owner's order:** (a) item drops — **next task**, (b) ~~music~~ (done,
   see State), (c) finish the seamless floor/wall look for **biomes 3 and 4** (Frosted
   Vault, Bone Ossuary) — the owner believes 1 and 2 are done. Monsters-on-sight comes
   after all of that.
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

**Music** (`js/sfx.js`) — implemented, so this is reference not a to-do:
- `MUSIC_TRACKS` = one array per ward; `musicWardFor(floor)` maps floors to wards through
  `getWard`. One reused `<audio>` element, `loop` explicitly false, 2s `BGM_TAIL_MS`
  fade-out on `timeupdate`, restart + fade-in on `ended`, `BGM_SWITCH_MS` = 700 cross-fade
  on ward change, `BGM_FADE_IN_MS` = 1200.
- The element is **outside** the WebAudio graph: `sfxToggleMute()` and
  `musicSetVolume()` call `applyMusicVolume()`. A blocked autoplay sets `bgmPending` and
  is retried in `unlock()`.
- Effects are still fully synthesised (no files). Adding a second bed is one string in
  the ward's array; the CI step will then require that file.

## Procedure A — item drops (NEXT TASK)

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

## Procedure C — biomes 3 and 4, seamless floor and wall

**Growth half is ready:** `js/growth/frost.js` and `js/growth/bone.js` each register a
form (`frost`: creeping ice ferns; `bone`: dry cracks and dust fans), add the name to
`BIOMES[2].growthStyle` / `BIOMES[3].growthStyle` plus a `growth` block on wards 3–4,
and register them in `js/manifest.js` + `index.html`. No edit to `core.js` should be
needed — if one is, the seam is wrong; fix the seam, not the form.

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
