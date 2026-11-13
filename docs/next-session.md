# Next session — handoff before context compaction

Read this first. It records owner decisions and measured facts so nothing has to be
re-discovered. `docs/architecture.md` remains the reference for how the code works.

## State (verified at handoff)

**Green gate:** `node test_items.js` → **PASSED 281/281** from `test_ui.js`, then
`loaded 46 scripts` and **PASSED 161/161** from `test_items.js` (it runs `test_ui.js`
first), exit 0. `node tools/check-order.js`
→ green (46 scripts, manifest = index.html). Every `.js` passes `node --check`.

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
   code moved, bakes pixel-identical), biome 2 = `mycelium` (IVORY webbing — fans, cross-links and a mat; never green, with
   `growthVeinPal` and `C.WALL_MYCELIUM` climb art). Biomes 3–4 name nothing yet, so
   they grow nothing — that is Procedure C's job, and it is now a new file each.
7. **Biome 3 overhauled (latest).** Owner picked *rune-lit glacial crystal* for the floor
   and *hoarfrost ferns* for the growth. `BOND_STYLES.ice` bakes a seamless pale sheet
   (panes + domain-warped fractures + rare rune seams) and, like dirt, skips the per-tile
   tone overlay; `wallStyle:"ice"` swaps the brick course for vertical fracture lines;
   ward 3's `patches` is empty so the repeated white snow tile is gone; `js/growth/frost.js`
   registers the "frost" form with `growthFrostPal` and `C.WALL_FROST`. Biomes 1–2 are
   untouched (masonry/dirt and moss/mycelium byte for byte).
8. **Biome 4 overhauled (latest).** Owner picked *dark loam* for the floor and a *large messy
   bone kit* for the growth. `BOND_STYLES.loam` bakes near-black-brown turned earth with pale
   grit (skips `floorTone` like dirt/ice); ward 4's bone-dust `patches` are gone;
   `js/growth/disturbed.js` registers the `disturbed` form — dug zones with 3–7 bones from a
   kit of 8 procedural shapes, each with a 90° rotation, and **no wall climbs at all**. All
   four biomes now have their own seamless floor, and biomes 1–3 are untouched by this pass.
9. **Background music** — four beds in `music/` (biome1-1 … biome4-1.mp3), played by
   `sfx.js` via `MUSIC_TRACKS` (one array per ward, ward from `getWard`: 1–10 → 1 …
   31–40 → 4). No HTML5 `loop`: 2s tail fade-out, then `ended` picks the next bed and
   fades in; 700 ms cross-fade on ward change. Mute and the music slider are mirrored
   onto the `<audio>` element (it sits outside the WebAudio graph).
10. **Pursuit (monsters step toward you)** — new file `js/pursuit.js`, loaded right
    after `combat.js`. `enemiesTurn()` tries `Delve.pursuitStep(m)` first; if the monster
    took a step it does not also attack that turn. A monster stays asleep until it has
    line of sight inside `CONFIG.PURSUIT.radius` (5) or the player hits it, and it will not
    stray more than `leash` (9) tiles from where it woke. Only FLOOR / GRASS / DOOR are
    steppable, so chests, gold, stairs and water are never blocked or covered.
    The step is one tile, but `render.js` eases the sprite across the gap over `MOVE_MS`
    (130 ms) with a small bob and forward lean — **no walk frames exist, and none are
    needed**; that easing is what keeps the square grid invisible. `mobEase()` +
    `animating()` keep repainting until the monster lands, so a step never shows as a jump.
11. **Loot was invisible, not missing (owner report: two floors, one potion each).**
    Measured against the real code: a cleared floor 1 drops **2.6 gear + 1.1 potions** on
    average, so the roll was never the problem. Two drawing faults hid the result:
    **(a)** `killMonster` puts the gold pile AND the item on the dead monster's tile, and
    `render.js` drew items *before* gold — the pile painted over most of every drop. Gold is
    now drawn first, and the item sits 0.10 / 0.16 of a tile up-left so the pile stays
    visible beside it. **(b)** A stepping monster could stand on a drop and hide it, because
    floor loot sets no tile — only `G.items` records it. `hasLoot()` in `pursuit.js` now
    refuses those tiles. Verified: 0 of 61 drops under a monster after 30 steps each.
    **There is still no fog of war** — `markVisited` only tracks the minimap. If a fog pass
    is wanted it has to be built; nothing was regressed.
12. **Fog of war (new, `js/fog.js`).** Owner's rule: a room is DARK until the player sets
    foot in it, then the whole room lights at once — no fade, no radius reveal. Entering is
    detected in `fogReveal()`, which marks the room whose interior holds the player's tile
    in `G.fogSeen` (an array indexed to `G.rooms`). A revealed room stays revealed for the
    floor; `genFloor` resets both `G.fogSeen` and `G.fogTrail` and clears `G.rooms` (a boss
    floor returns before rooms are rebuilt, so a stale list would light the wrong places).
    **No grid may show**, so the mask is one offscreen canvas: a full-screen dark sheet,
    then `destination-out` cut-outs — one rounded blob per revealed room (8 quadratic
    corners, blurred `FOG.soften` px), a round lantern pool at the player, and a corridor
    trail of overlapping circles. Nothing is ever punched as a per-tile square.
    `G.rooms` is exported from `levels.js` for this. The mask is cached and rebuilt only
    when the player tile, camera, tile size, revealed-room count or trail length changes —
    measured: 1 build per step, 0 on idle redraws. `lantern` (4) is deliberately equal to
    `PURSUIT.radius` (4, was 5) so you are never hit by something outside your light.
    Boss floors and `G.fogAll` skip fog entirely, and `CONFIG.FOG.enabled = false` turns it
    off. `Delve.tileLit(x, y)` answers "is this lit" for tests. **The minimap follows the
    same rule**: `markVisited` now skips any tile `tileLit` says is dark, so an unentered
    room is blank on the map as well as dark on screen.
    **Browser fix (owner reported fog "didn't work again"):** the first version
    feathered room edges with `ctx.filter = "blur(...)"`. Chromium on Android ignores
    `filter` together with `destination-out`, so every cut-out vanished and the screen
    went fully black. `filter` is now gone; the soft edge is three nested shapes at
    0.55 / 0.75 / 1.0 alpha, which is plain compositing and works everywhere. Verified
    by rendering a real frame with `@napi-rs/canvas`, not a stub.
13. **Opening floor is a teaching floor (`CONFIG.openingFloor`).** Floor 1 spawns 8
    monsters instead of 12–17, at 75% HP and 75% ATK, and drops one guaranteed
    **starter weapon and body armour** within 3 tiles of the spawn (`genFloor`, end of
    the function; skipped when `G.equip.weapon` already exists). `openScale()` applies
    the percentages and returns the value untouched on every other floor.
14. **Loot roughly doubled (`CONFIG.ITEMS.drop`).** Gear 15.5% → **30%** per kill
    (+3pp/Luck, cap 0.85), potions 7% → **14%**, and chests now appear on ~90% of
    floors (base 0.75, cap 0.95) instead of ~35%. Measured per cleared floor:
    **floor 1 ≈ 4.5 gear + 1.2 potions (was ~2.5 total)**; floor 15 ≈ 6.7 + 2.9.
    The old per-ward `treasureChance*` overrides in `con-biomes.js` were raised to match.
15. **Item pickup is now a decision.** Tapping a floor item (or a path arriving on it)
    opens the existing item card instead of auto-collecting; **Pick Up** moves you onto
    the tile and takes it, **Leave** walks away. Walking over loot no longer collects it
    silently. `Delve.itemAt(x, y)` (items.js) is the lookup, because floor loot sets no
    tile. The card leads with the **base name** on the floor ("Short Spear") and shows
    the full affixed name underneath ("Keen Short Spear of the Fox"); in the inventory
    the full name leads. New `#icNameSub` in `index.html`, `test.html` and `game.css`.
16. **Two dead item stats made live.** `dropBonus` ("Item Find") is now added to the
    kill drop chance in `rollKillDrop`; `shardBonus` ("Bonus Shards") multiplies a kill's
    shard payout in `killRewards`. Both used to roll on gear and be summed into
    `itemBuffs` with nothing reading the total.
17. **Equip straight from the floor card.** A wearable floor item now shows THREE
    buttons — **Pick Up / Equip / Leave** — via a new `#icTertiaryBtn` in `index.html`,
    `test.html` and `game.css`. Equip steps onto the tile, removes the item from the
    floor, calls `equipItem` (which returns the replaced piece to the bag, so an upgrade
    costs no inventory space), and takes a turn. The button is hidden for consumables
    and on every inventory card; `showItemCard` resets it on open so it cannot leak
    between cards. A refactor bug here (`x`/`y` referenced after being captured) was
    caught by the test before shipping.
18. **Weapon damage was measured wrong twice over. Fixes:**
    **(a)** The weapon's `Damage` row was hardcoded `delta: 0`, so the one number that
    decides a weapon never coloured — equipping your first weapon showed white stats.
    It is now compared against the equipped weapon's real band, or against fists.
    **(b)** Bare fists dealt exactly `str` (6 at starting Strength), which made ~22% of
    tier-1 weapons and ~25% of tier-2 ones **worse than having nothing equipped**.
    `weaponBand()` fists are now `0.30·str .. 0.55·str` (≈2–3 at start), so any real
    weapon is an upgrade. **(c)** `makeGear` subtracted the Strength lift from the
    weapon's point budget, so a floor-1 weapon came out at `itemMax 0.1` — every early
    weapon was the same junk and its whole damage was the Strength term. That
    subtraction is removed; weapons now spread (floor 1 itemMax median 1.3, max 5.0,
    38 distinct values; floor 15 median 8.4, max 16.5). TTK stays inside the 0.55–3.6 s
    band the suite asserts at every checked floor.
19. **`Leave` now actually leaves.** Choosing Leave on a floor item closed the card without
    moving, and the item tile stayed intercepted, so a declined item became an impassable
    square — the player could not walk past it. Leave now performs the step (onto the tile,
    leaving the item where it lies) and takes a turn, so you simply walk over it. It only
    steps when the tile is adjacent, so a card opened from further away never teleports.
    **Root cause (owner report #2):** the intercept lived in the PATH-WALKER
    (`tryActOnStep`) as well, so walking along a corridor stopped dead on the loot
    tile and cleared the path. The intercept now exists only in `tryAct` (a tap),
    and it accepts the player's OWN tile as well as adjacent ones. Walking never
    stops for loot and never collects it (`tryActOnStep` and both step handlers
    had auto-pickup removed), so an item can never block passage and "Leave" means
    what it says. Tapping your own tile picks up loot you walked over.
20. **Ward 5 has its own music bed.** `MUSIC_TRACKS[5] = ["music/biome5-1.mp3"]` in
    `js/sfx.js`; `musicWardFor()` already returns 5 for floors 41–50, so no other code
    changed. `music/biome5-1.mp3` currently holds a **copy of the ward-1 track as a
    placeholder** so the suite and the workflow's "Music beds are present" step pass —
    the owner overwrites it with the real file. `test_ui.js` now also asserts floors
    41–50 map to ward 5 and that ward 5 has a bed.
21. **Three beds per ward, in order, with a written break between them.** `MUSIC_TRACKS`
    now lists `biomeN-1/2/3.mp3` for each of the five wards (15 files). The musician
    does not need to write an ending: `bgmTick` runs the last **2 s** as the fade-out,
    `bgmEnded` then holds **2 s** of silence via `queueNextTrack`/`BGM_GAP_MS`, and the
    next bed fades **in over 2 s** (`BGM_FADE_IN_MS`, was 1.2 s). Tracks rotate in
    playlist order and wrap 1→2→3→1 — deliberately **not** shuffled, because a ward is
    three movements of one piece. `nextTrackInWard()` is the single rotation rule, used
    by the gap timer, `sfxStartAmbience` and the autoplay-unlock retry. A ward change
    still short-circuits with a 700 ms cross-fade and starts that ward at movement 1;
    `stopBgm` clears any queued gap so a stopped game cannot restart the music. Timings
    are exported as `Delve.musicTimings()` and asserted in `test_ui.js`.
22. **Music silent in the Android WebView until the volume slider was touched.**
    The WebView can resolve `play()` while the element stays internally silent, so
    the fade ran to the correct volume on a track nobody could hear; touching the
    slider bypassed the fade and fixed it. `watchAudible(el)` now runs after every
    bed starts: if the element claims to be playing but its volume is still ~0
    after 1.8 s, the target volume is set directly. Works in a browser too (no-op).
23. **The shop is a real room now, and shows real stats.** Two changes from the
    owner's report ("just a list of names and prices").
    **(a) Shop chamber (`carveShopChamber` / `buildShopAt` in `levels.js`).** A shop
    floor no longer drops the merchant in a corner of a random room. It carves a
    **uniform 5x5 interior** (7x7 with the wall ring) into a leaf room away from the
    spawn and the stairs, opens **exactly one door**, and drives a short corridor from
    that door until it reaches floor that is genuinely **reachable from the spawn**
    (a BFS reachability map — "there is floor over there" was not enough, because BSP
    leaves glassy slivers that join nothing, which is what walled the merchant in). Up
    to 8 candidate centres are tried before falling back. If the carve fails entirely
    the old corner placement still runs. Barrels, chests and monsters are all excluded
    from the chamber, so nothing blocks the stall or attacks you while shopping. The
    room is registered with `G.rooms` as `type:"shop"` so fog of war treats it properly.
    Merchant stands at the **back wall** with always-open floor in front of him.
    **(b) Dressing.** Three new world sprites in `con-worldart.js`: `prop_shopCounter`
    (goods on the counter at the merchant's tile), `prop_shopCrate` (all four corners)
    and `prop_shopLantern` (hanging over the counter), plus the warden banner over the
    door. All painted decor — never tiles, never blocking.
    **(c) Shop UI (`buildShop` in `ui.js`).** Each row now shows the tier and slot, the
    base name under the affixed name, **every stat line with the same green/red deltas
    as the item card**, the flavour text, and a **Buy + Equip** pair (Equip equips
    straight from the shop, returning what it replaced to the bag). The sell list shows
    stats too. Rows reuse `Delve.itemStatLines()` so the shop can never drift from the
    card. New `Delve.SLOT_NAME()` maps slot keys to player-facing names.
24. **Stat-line formatting fixes (`itemStatLines`).** Deltas were printed in raw units
    next to formatted values — `"+3%"` beside `"+0.03"`, and `Damage Reduction 0.26`,
    `Maximum Health 2.93`, `Luck 1.11`. Each stat now declares how its delta renders
    (`pct` adds the % sign, whole stats round), and every row carries a `deltaText`
    string that both the card and the shop render verbatim. The separate "Affix" row was
    removed: it repeated the stat that already had its own row.
25. **Ability balance (owner: "abilities have been underwhelming").** Measured, not
    guessed. The problem was not the ability list, it was two numbers:
    **(a) Energy per kill was 1.** A 4-cost cast needed four kills, while a plain
    attack is free. Now **3** — one kill funds most of a cast.
    **(b) Twelve abilities scaled off attack power**, which is 3 at the start. Crushing
    Blow dealt `atk × 2` = 6 for 6 energy; Whirlwind dealt 2.5 per enemy for 8. Both
    were worse than hitting normally. Every damaging ability now uses **flat damage**
    from its `data.dmg` (plus `perRankDmg` per rank), so it stays meaningful as the
    weapon improves.
    Rebalanced to ~1.5–3.0 damage per energy: Cleave 8 + 5 splash for 4, Crushing Blow
    16 for 6, Cinderbolt 9 for 4 (ignores armour), Lunge 10 for 5, Whirlwind 7 to every
    adjacent for 6, Leech 10 for 5 healing half, Meteor 14 + 10 splash for 9.
    **Stone Skin** 6→5 energy and 2→3 turns; **Rally** heals 45% and now grants a turn
    of damage reduction. `test_ui.js` gained a balance floor: `energyPerKill >= 2`, and
    **no damaging ability may deal less than one free swing** — a trap-card guard.
    Touch range is unchanged, but the four new abilities sketched earlier are NOT built.

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

## Procedure C — DONE (all four biomes)

Every biome now has its own seamless floor, its own growth form and (where it needed one) its
own wall treatment:

| biome | floor | growth | walls |
|---|---|---|---|
| 1 Upper Ruins | `runningbond` masonry | `moss` lobed patches | linked moss climbs |
| 2 Blackvein | `dirt` + ivory threads | `mycelium` ivory webbing | linked thread climbs |
| 3 Frosted Vault | `ice` rune-lit crystal | `frost` hoarfrost ferns | `wallStyle:"ice"` + climbs |
| 4 Bone Ossuary | `loam` dark turned earth | `disturbed` dug zones + 8-shape bone kit | masonry, no growth climbs |

The recipe for a new biome is unchanged: pick the look with the owner first, then
`BOND_STYLES.<style>` in `js/render/tiles.js` (+ skip `floorTone` if the field is organic),
`floorStyle`/`wallStyle`/`growthStyle` on the biome, a `growth` block on the ward, and one
new file under `js/growth/` registering its form. **No edit to `js/growth/core.js` should be
needed** — if one is, the seam is wrong; fix the seam, not the form.

Rules bought in this pass, do not regress them: no per-tile corners on a floor, no per-tile
rectangle in a patch layer, walls must separate from the floor by lightness AND hue, and a
growth form that is not supposed to climb returns an empty wall list.

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
