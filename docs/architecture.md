# underward — Project Hand-off & Architecture Reference

**What this file is for:** briefing a fresh model or developer so it can work on this
project immediately, without re-reading all 26 source files and without asking you
questions you've already answered.

**What to trust:** §3–§7 describe the code as last verified. Where a name or number
matters and you're unsure, open the file — this doc is a map, not the territory.
`test.html` is the machine-verified source of truth for anything it checks.

**Verified green:** 2026-10-12 (full `test.html` pass, all 12 sections).

---

## 0. First five minutes (for a fresh model)

1. Read **§1** (what the game is), **§2** (non-negotiable constraints), **§3** (file map).
2. Read **§4** (editing protocol) **before writing any code**. Violating it has
   caused real bugs in this project.
3. Skim **§5** (load order) and **§8** (known weak points).
4. **Never guess a file's contents.** If you need to change lines inside a file you
   haven't seen, ask the owner to paste it. Guessing a variable name already cost one
   debugging cycle here (see §8, "the `blocking` incident").
5. Before proposing a fix, check **§8** and **§9** — several of the obvious-looking
   problems are already documented as deliberate.

---

## 1. What the game is

A mobile-first, touch-driven dungeon crawler that runs from a single HTML page.
No build step, no dependencies, no bundler, no framework. Plain `<script>` tags and
one global namespace (`Delve`).

### Core loop
1. **Title screen → Hub** — the front door is the title screen (§6.11). Its main button reads
   `CONTINUE`, `BEGIN` on an empty save, or **`FLOOR n` when a run is in progress** (§6.12).
   `SETTINGS` opens the sound panel. `CONTINUE` leads to the hub, which is where you spend
   shards on permanent attribute levels and a shard-tree of nodes — **but only between runs**
   (§6.12.2: with a run parked, the hub is reachable and nothing in it can be bought).
2. **START RUN** — new run, floor 1, procedurally generated, one ward (10-floor band)
   at a time.
3. **Movement** — tap an adjacent tile to step; tap your own tile to rest; tap a
   distant tile to pathfind.
4. **Combat** — walking into a monster starts an auto-attack loop on a fixed tick
   (weapon speed vs monster speed). Tap elsewhere to flee, taking one hit.
5. **Trait choices** — XP from kills → level up → pick 1 of 3 cards. One is always an
   unlearned ability while any remain; abilities are **uncapped** and never expire.
6. **Boss floors (10, 20, 30)** — a bespoke arena: entry chamber → corridor → boss chamber.
   Nothing else on the floor. Beat the boss → victory screen → gold converts to shards,
   and every shard earned so far is banked (§6.10).
7. **Death or retreat** — run ends, gold converts, and the run's shards are banked into
   `localStorage`. Nothing is banked before the run ends.

### Content that exists
- Four wards: **Upper Ruins** (floors 1–10), **The Blackvein** (11–20),
  **The Frosted Vault** (21–30) and **The Bone Ossuary** (31–40).
- Nothing beyond floor 40 yet. The plan is ~10 wards / 100 floors; loot and
  difficulty scale with depth, with no ward count baked into the engine.
- ~100 items, a roster of monsters, 6 progression trees, **12 passive lines in 4 tags**
  (three ranks each, with set bonuses), 4 uniques and **16 abilities**.

---

## 2. Non-negotiable constraints

These shape every decision. Do not propose solutions that break them.

- **Authoring and testing happen on an Android phone.** The owner has no PC workflow.
- **Delivery is upload to GitHub → viewed via GitHub Pages.** No local server, no
  terminal, no CLI, no npm.
- Therefore: **no build step, no dependencies, no ES modules, no transpiling.** Plain
  scripts, plain globals, must work by opening a URL.
- **Files are often pasted to the assistant as `.txt`** for convenience; the repo
  copies are `.js`. Never assume the paste extension matches the repo.
- **Audio must be gesture-unlocked** — handled in `sfx.js`; don't move that.
- **Cache is aggressive on mobile.** Always test with a fresh `?v=N` on `index.html`.
  Home-screen / PWA installs have their own cache that `?v=` in a browser tab does
  not affect.

### The owner's working style
- The owner makes all creative decisions (what the game is). You make technical
  decisions (how it's built). Don't over-consult on implementation; do ask about feel,
  balance, and anything ambiguous.
- Keep answers short and direct. Give files that can be uploaded as-is.
- If a request is ambiguous, ask a few short questions rather than guessing.
- **If a genuinely better approach exists, say so plainly** — calmly, in simple terms,
  with the simpler phone-friendly alternative alongside it. Don't be a pushover about
  technical quality, but don't lecture either.

---

## 3. File map

42 scripts. This is the `index.html` load order (§5 has the constraints).

### 3.1 Content — data only, safe to edit blind

**`js/content/con-monsters.js`**
`CONFIG.MONSTER_ROSTER`, `MONSTER_BANDS`, `BOSS_DEFS`, `CONFIG.elite`, `CONFIG.xpKill`,
`CONFIG.spawnSafetyRadius`.
Notes: `xpKill` is a legacy duplicate of `MONSTER_ROSTER[k].xp` — prefer the roster
(its `boss` value is still read by `rewards.js` for boss XP).
There is deliberately **no band for a boss floor**: `genBossFloor` spawns nothing, so
`getMonsterBand` is never called for floors 10/20. The inert `boss:true` bands that used
to sit in this file were removed in the tidy-up pass.

**`js/content/con-items.js`**
`Delve.TIERS`, `Delve.SLOT_DEFS`, `Delve.itemDefs`, `Delve.potionDefs` (~100 items).
Built by an `L(id,name,slot,tier,stats,lore,extra)` helper — adding an item is one line.
**This is DATA. `js/items.js` is LOGIC.** Don't confuse them; the names are a trap.
Note: the tier-4 items carry a `keep:true` stat key that **nothing reads yet**. It's
reserved for a possible "you keep this when you die" rule; inert, harmless, deliberate.

**`js/content/con-biomes.js`**
`CONFIG.WARDS` (floor bands + generation tuning), `CONFIG.BIOMES` (palettes).
A ward may carry an optional **`bossArena`** block to shape its boss arena (§6.6).
A ward may also set **`lootRarityMult`** (default 1): a per-biome multiplier on the rare
+ legendary tier weights, so a new biome tunes its own loot as pure data (§7).
Each **`BIOMES`** entry must additionally declare **`clutter`**
(`"ruins" | "blackvein" | "frost"`) — which decoration family its floor tiles use.
`test.html` §4 fails if it is missing or unrecognised, so a new area can't silently render
with the ruins' weeds (§7).

**`js/content/con-traits.js`**
`CONFIG.TRAITS` — passives, uniques, and abilities with their `data` numbers.

**`js/content/con-progression.js`**
`CONFIG.PROGRESSION.TREES` (6 trees), `CONFIG.PROGRESSION.NODES` (5 trees have nodes).
Node `type` strings must match the vocabulary `progression.js` consumes (§7).

**`js/content/con-events.js`**
`CONFIG.FLOOR_EVENTS` — the floor-event kinds (shrine, wager, blood altar) with their
choices, plus the ambush odds. Every choice is data in the small effect vocabulary
`encounters.js` resolves (`healPct`, `maxHp`, `shards`, `gamble`, `hpForAbility`,
`hpForShards`, `nothing`). Adding a kind is one entry; a genuinely new effect needs a
`case` in `encounters.js`. `accent` tints the prop on the floor.

**`js/content/con-bosssprites.js`** — ⚠️ **ONLY content file with an ordering constraint.**
One canvas-drawing builder per boss, via `Delve.registerBossSprite(key, fn)`, plus an
optional `Delve.registerBossAttackSprite(key, fn)` for its attack frame (that builder
receives the idle canvas and returns `U.atkFrom(idle, [...])`).
Canvases are **24px per tile**, so a `size:{w:2,h:2}` boss is 48×48; `test.html` §5
fails if a canvas disagrees with the declared size.
**Must load AFTER `js/sprites.js`** — it needs `Delve._spriteUtils` and
`Delve.rebuildSprites`.

**`js/content/con-worldart.js`** — ⚠️ **shares that ordering constraint.**
World art as content: the boss-arena props (Batches 8/9) and the biome ground-cover
sprites (Batch 16) moved here from `sprites.js` on 16 Oct, plus the per-biome floor
clutter/growth families moved from `render.js`. Registers via
`Delve.registerWorldSprite(key, fn)` and `Delve.registerClutter(name, {clutter, weed})`,
then calls `rebuildSprites()`. **Must load AFTER `js/sprites.js`.** A new biome adds
builders and registrations here; the engine files never need editing for art.

**`js/content/con-monstersprites.js`** — ⚠️ **same ordering constraint.**
Monster art as content: one builder per roster kind, registered via
`Delve.registerMonsterSprite(kind, idleBuilder, atkRects)` — buildAll() then gives every
registered monster its hurt / elite / attack variants automatically. Introduced 16 Oct
with the Bone Ossuary's eight creatures. **Must load AFTER `js/sprites.js`.**

### 3.2 Engine — foundation

**`js/config.js`**
The `CONFIG` shell plus mechanics data that isn't content: `ATTRS`, `ATTR_ORDER`,
`secondaries`, `economy`, `loot`, `SLOTS`, `SLOT_ORDER`, `WEIGHT`, `STATUS_EFFECTS`,
`statusChance`, `WEAPON_SPEEDS`, `XP_CURVE` (the **base array** — the per-ward curve is
`Delve.xpCurveFor` in `traits.js`), `shop` (incl. `offset`), rest/shop/barrel numbers,
`bossEvery`, `healOnDescendPct`, `inventorySlots`, `inventoryMax`, `energyPerKill`,
**`energyCapOverStart`** (Energy cap = starting pool + this; 10 + 90 = the old hardcoded
100), `bossHpBase`, `bossAtkBase`, `bossSpeed`.
`loot` also carries the rarity knobs: `legendaryBase` / `legendaryPerFloor` /
`legendaryPerLuck` (the depth+Luck curve), `rareBase` / `rarePerLuck` / `rarePerWard`,
`eliteDropBonus`, and `sourceRarityMult` (chest / treasure / elite / boss).

**`js/save.js`**
`Delve.save` (the live object), plus the load/persist/reset/migrate functions.
**CRITICAL RULE:** a new persisted field must be added in **three** places —
the default-save builder, the migration function, and the write-to-storage whitelist.
Miss one and the field silently disappears on reload. `test.html` §6 catches this.
Notes: the load routine **mutates the existing object** rather than replacing it, so
modules holding a reference stay valid. That's deliberate — don't "fix" it.
⚠️ *Confirm the exact function names by opening the file; they're short.*

**`js/attrs.js`**
Derived player stats: `baseMaxHp`, `maxHp`, `baseAtk`, `atk`, `baseLuck`, `luckPts`,
`agiPts`, `touPts`, `strPts`, `dmgRed`, `flatRed`, `dodge`, `crit`, unlock predicates
(`hasSecondWind`, `hasOverkill`, `hasBulwark`), `firstStrikeBonus`, `hitCap`, `goldMult`,
`dropChance`, `bossBonus`, `traitHealPerFloor`, `luckDiscount`, `attrCost`, `attrLvl`,
`attrLevel`, `attrValue`.
**This file also owns every shard-tree node effect**, because the node numbers live in
`con-progression.js` and are read here: `nodeBonus`, `ownsNodeType`, `healMult`,
`consumableHealMult`, `cureHealPct`, `statusChanceBonus`, `energyPerKillBonus`,
`overkillPct`, `bossDamageMult`, `secondWindUpgradePct`, `secondWindTriggerPct`,
`hasLastStand`, `nodeDiscount`, `goodsDiscount`, `restsPerFloor`, `startEnergy`,
`energyCap`.
Notes: derived stats are split — `items.js` owns `playerSpeed` and `itemBuffs`.

**`js/items.js`** — RUNTIME
`rollTier`, `stampProvenance`, `rollKillDrop`, `dropPotion`, `dropUnique`, `itemPrice`,
`sellValue`, `sellItem`, `sellAll`, `inventoryCap`, `pickupItem`, `playerSpeed`,
`itemBuffs`, `equipItem`, `unequipItem`, `equipWeapon`, `equipArmour`, `weaponStatus`,
`useConsumable`, `itemStatLines`, `wardOf`, `itemsByTier`, `makeShopStock`,
`shopHealCost`, `isShopFloor`, `healCost`.
What happens to an item **once it exists**. Construction — the quality budget, stat
spending, affixes, `makeGear` / `makeItem` / `makeUnique` — is in `js/itemgen.js`.
`rollTier(floor, rarityMult)` — the optional second argument nudges the rare + legendary
weights for a special source (elite/boss kills in `rollKillDrop`, and the two chest paths
in `levels.js`).
Notes: the catalogue lives in `con-items.js`. **All shop-domain logic lives here** (stock,
pricing, shop-floor predicate, heal cost). Destructures `IT` and `FAM` back from
`Delve.itemGen`; those two are the only names that cross the seam.

**`js/itemgen.js`** — CONSTRUCTION
`qualityOf`, `bandOf`, `pointsOfQuality`, `statPoints`, `itemPoints`, `rollSlot`,
`rollAffixes`, `affixText`, `affixName`, `makeGear`, `makeItem`, `makeUnique`,
`rollUnique`, plus internal helpers (`IT`, `FAM`, `gauss`, `PCT_STATS`, `basesForSlot`,
`pickBase`, `STAT_LABEL`, `slotGroup`, `affixPool`, `applyAffix`, `addStat`).
The continuous-quality model (docs/results/items_overhaul.md): one budget of POINTS decides
an item's power. Quality sets the budget, the slot decides which stats spend it, affixes
carve a slice out of it, and nothing is added on top — so two items of equal quality are
worth the same whichever stats they carry.
**Public names are unchanged**: these still assign straight onto `Delve.*`, so no call site
moved. `IT()` and `FAM()` are exported on `Delve.itemGen` for `items.js`; nothing else
crosses back. Depends on data only — `CONFIG.ITEMS`, `CONFIG.WEAPON_FAMILIES`,
`CONFIG.SLOT_*`, `Delve.ITEM_UNIQUES` — all resolved at call time. No save, no DOM, no `G`.

**`js/sprites.js`**
`Delve.SPR`, `Delve._spriteUtils`, `Delve.registerBossSprite`, `Delve._bossSpriteBuilders`,
`Delve.registerWorldSprite`, `Delve._worldSpriteBuilders`, `Delve.registerClutter`,
`Delve._clutterFamilies`, `Delve.rebuildSprites`.
Runs a build-all at load; boss sprites and world art (arena props, ground cover) come from
registries, so `con-bosssprites.js` and `con-worldart.js` call `rebuildSprites()` after
registering. `test.html` §5 verifies every `BOSS_DEFS.sprite` is registered and built; §4
verifies `DRESSING` and `groundCover` keys resolve in `SPR.world`.

### 3.3 Engine — state & world

**`js/state.js`**
`Delve.T` (tile enum), `Delve.G` (run state), `rng`, `rngF`, `clamp`, `flash`, `mdist`,
`getWard`, `getMonsterBand`, `pickWeighted`, `recordStat`, `newRun`, and the run-checkpoint set
(§6.12): `captureRunSnapshot`, `setFloorCheckpoint`, `clearRunCheckpoint`, `hasSavedRun`,
`savedRunFloor`, `runInProgress`, `restoreRunFromCheckpoint`.
Notes: tile enum + RNG + math utils + ward/band lookup + run construction.
⚠️ **GOTCHA:** `Delve.T` is a **plain object**, but many files alias it as a
**function** (`const T = () => Delve.T`). Both styles exist and are not
interchangeable — mixing them caused a live bug (§8).

**`js/levels.js`**
`Delve.genFloor`, `Delve.openChest`, plus internal helpers (`placeRoom`, `spawnMonster`,
`spawnMonsterKind`, `applySwarmFloor`, `applyClusteredLootFloor`, `ensureWardPlan`,
`specialRooms`).
Single source of the **dungeon** generator. `genFloor` resets `G.floorData = {}` each floor —
needed so a secret room found on one floor can't leave a phantom false-wall on the next.
Boss floors branch out early (§6.6) into `js/gen/bossarena.js`.

**`js/gen/bossarena.js`**
`Delve.genBossFloor` — **public name unchanged, so no call site moved** — plus internal
`dressBossArena`, re-exported as `Delve.gen.dressBossArena` for `levels.js` to destructure
back, exactly as the BSP geometry already is. Builds the three-part vertical arena (entry
chamber → corridor → boss chamber) from the ward's optional `bossArena` tuning, then dresses
it from `CONFIG.DRESSING`.
`genFloor` resets `G.decor = []`; `genBossFloor` fills it via `dressBossArena`, which places
props from `G.bossArena` alone (§6.6). Props are **never written into the grid** — they
exist only in that array.
Depends only on `Delve.T`, `Delve.CONFIG` and the `placeGroundCover` / `placeGrowth` /
`logSystem` hooks, all resolved at call time — no save, no DOM. Because the layout and the
dressing are both position-derived, a boss floor is fully deterministic, which is what makes
a before/after snapshot comparison possible after any future edit here.

**`js/ground.js`**
`Delve.placeGroundCover`, `Delve.drawGroundCover`. Biome floor decoration (§6.14): a shared
10-shape library placed as 2–3 clusters per floor on valid, clear floor tiles, then drawn
flat by the renderer between the floor and the props. The shapes live here; each biome's art
is a `SPR.world["ground_*"]` sprite named by `BIOMES[n].groundCover`. `placeGroundCover` is
called from the end of both `genFloor` and `genBossFloor`. Everything is read at call time,
so the file has no load-order position of its own — it sits after `levels.js` only to group
generation code.

**`js/growth.js`**
`Delve.placeGrowth`, `Delve.drawGrowthFloor`, `Delve.drawGrowthWalls`. The wards' organic growth:
per-room sporadic spots rolled at the end of `genFloor`/`genBossFloor`, biased to corners and
wall bases and growing outward, each a random radius between the ward's low/high caps
(`growth` block on the ward in con-biomes.js — only ward 1 has one so far, so the other wards
grow none). Each spot bakes once per floor into a wobbled, multi-lobed fine-pixel blob
(16 px/tile) dressed in the biome's `growthPal` gradient — more shades the bigger the patch —
with a dithered dark→bright gradient root-to-fringe, a pixel-eroded rim (no straight edges,
even against walls) and a per-pixel FLOOR-tile clip, so growth never grows over water, doors,
stairs or furniture. Wall growth is LINKED: the `C.WALL_MOSS` climbs are recoloured from
`growthPal` and drawn, rotated to face the floor, only on the wall tiles a patch touches
(never over braziers). Floors roll fresh growth every generation — within one floor the baked
blobs are stable — and nothing enters the grid or the run snapshot; a resume re-rolls it
with the floor, like ground cover. render.js draws the floor blobs after `drawGroundCover`
and the climbs after the wall pass; a `floorStyle:"runningbond"` biome (ward 1)
additionally paints the seamless baked 3x3-tile torus masonry pattern instead of
per-tile slabs, which is what removed the tile grid from the Upper Ruins' floors.

**`js/puddles.js`**
`Delve.placePuddles`, `Delve.drawPuddleTile`. Wall-anchored puddles (§6.18). Every WATER tile
belongs to one lobed blob that sits against a wall. `placePuddles` runs at the end of `genFloor`
(normal floors only — the boss branch returns earlier), guarded + try/caught like growth so it
can never abort generation; `render.js` paints the water in the tile pass (where the old square
`drawWaterPatch` used to be). Everything is read at call time, so the file has no load-order
position of its own — it sits after `growth.js` only to group generation code.

### 3.4 Engine — progression, combat, movement, economy

**`js/traits.js`**
`xpCurveFor`, `addXP`, `addAbility`, `castAbility`, `injectHubAbilities`, `traitBuffs`,
`traits`, `hasUnbroken`, `secondWindHealOverride`.
Notes: **abilities are uncapped** — `CONFIG.levelMaxAbilities: 0` means "no limit", and
`addAbility` appends, refusing only a duplicate, so a player never loses one they learned.
Every level-up puts an unlearned ability on one of the three cards while any remain.
**A new ability id needs a new `case` in `castAbility`**; the bar wraps and scrolls, so the
UI needs no change as the list grows.

Passives are **ranked**. `effects` is what rank I gives and `perRank` is the step for each
rank after it, so a passive is stored as `{id, rank}` and `traitBuffs()` scales it. Picking a
line you already own offers its **next rank** (`Sharpened Edge II`) instead of a duplicate,
and a line at `maxRank` leaves the pool. Four tags — **Edge** (offence), **Iron**
(survival), **Blood** (sustain) and **Greed** (economy) — carry set bonuses at **3 and 6
total ranks** per tag (`CONFIG.TRAITS.sets`), counted in ranks rather than in lines, so
taking one line to rank III advances its set as far as three different lines would.

**`js/combat.js`**
- Combat loop: `startCombat`, `endCombat`, internal `playerSwing`, `monsterSwing`
- Ambient attacks: `enemiesTurn`, internal `ambientMob`
- Kill resolution: `killMonster`
- Run lifecycle: `endRun`, `retreat`, `saveAndExit`, `die`, `triggerVictory`
- Exported for other files: `Delve.rowFor`, `Delve.onHitEffectFor`
Notes: `enemiesTurn`/`ambientMob` stay here deliberately — they share
`ON_HIT_STATUS_CHANCE` and `onHitEffectFor` with `monsterSwing`. Boss-kill branch
restores the arena tile to `FLOOR` and cancels stairs (§6.6).

**`js/movement.js`**
`tryAct`, `tryActOnStep`, `smashBarrel`, `tryRest`, `collectGold`, `descend`,
`promptStairs`.
Handles tile interaction and traversal. Contains the shared shop-tap intercept at the
top of both `tryAct` and `tryActOnStep`. Every entry point guards `Delve.G` before use.
Never owns the combat loop or the economy. `test.html` §8 is the direct guard on this file.

**`js/rewards.js`**
`convertGold`, `bankRunShards`, `pendingRunShards`, `monsterStats`, `killRewards`,
`floorClearBonus`, `makeElite`.
**Shard rule:** run earnings live in `G.runShards` and are never in the save while the run
is in progress; only `bankRunShards()` writes them into the save (§6.10).
Consumes `Delve.rowFor` from `combat.js` at call time. `monsterStats` has no internal
caller — kept as public API.

**`js/encounters.js`**
`placeFloorEvent`, `eventAt`, `openFloorEvent`, `floorEventCost`, `floorEventCanUse`,
`resolveFloorEvent`, `maybeAmbush`, `spawnAmbush`.
Owns floor events and ambushes (§6.19). Content lives in `con-events.js`; this file owns
placement, affordability and effects. Spawns ambushers through `Delve.spawnMonsterAt`
(exported from `levels.js`) so they are ordinary monsters in every respect.

**`js/effects.js`**
`applyEffect`, `applyPlayerEffect`, `tickMonsterEffects`, `tickPlayerEffects`,
`playerWeakened`, `statusColor`.

### 3.5 Engine — presentation & plumbing

**`js/sfx.js`**
`Delve.sfx(name)`, `sfxToggleMute`, `sfxSetVolume`, `sfxGetVolume`.
Synthesizes all sound via Web Audio — **no audio files**. The `AudioContext` is created
on the first `pointerdown` (browser gesture requirement). Mute is deliberately **not**
persisted. Default volume `0.55` is hardcoded in two places (`sfx.js` and the `ui.js`
slider) — keep in sync if you change it.

**`js/log.js`**
`log`, `clearLog`, `flushLogWindow`, and all `logXxx` shorthands.
Two destinations: a rolling strip (`#combatLog`) and a modal (`#logWindowContent`).

**`js/render/tiles.js`**
`Delve.tiles` = `biome`, `tileAt`, `ensureCache`, `isTorchTile`, `blitTile`, `drawClutter`,
`drawWallTile`, `drawWallShadows`, `drawWallTorch`, `tickTorch`; internal `floorTone`,
`texHash`, `drawFloorTile`, `drawWeed`, `drawDoorTile`, `drawGrassPatch`, `drawStairs`,
`arenaTorches` and the seamless-floor texture bakers.
The tile atlas: the offscreen per-tile cache, every per-tile painter and the 48×48 torus
texture bakers (Phase 3). Split out of `render.js` by verbatim move — the moved body is
byte-identical to the lines it replaced, and `render.js` destructures it back into the same
local names, so no call site changed.
Depends only on `Delve.hash2`/`hash3`, `Delve.rgbOf`/`mixRGB`/`blendHex`, `Delve.getWard`,
`Delve.CONFIG.BIOMES` and `Delve._clutterFamilies`, all resolved at call time. Holds no
save state and touches no DOM.
`torchFrame` — the 3-frame flicker — is this module's state, advanced by
`Delve.tiles.tickTorch()` from `render.js`'s animation clock. That tick is the only write
that crosses the seam.

**`js/render.js`**
`Delve.draw`, `addFloater`, `addShake`, `addDeath`, `isTorchTile`, sprite drawing (idle /
hurt / elite / **attack** frames, plus the hurt-recoil and the attack-lunge offsets), the
biome ground-cover layer, corpse fades and the wall texture/shadow pass (§6.15).
Tile, floor, wall, torch and stair painting plus the offscreen tile cache are **not here** —
they are `js/render/tiles.js` (Phase 3), destructured into the same local names.
Per-biome clutter/growth painters are registered content (con-worldart.js) — only the ruins
fallback stays inline. Also owns the floaters, the attack lunges, the hurt recoils and the
corpse-fade records, all as render-local state deliberately kept off `G`.
`Delve.drawPaperDoll`, `Delve.markVisited`,
`Delve.renderMinimap`.
Draw order is: floored tiles (+ their biome clutter) → **biome ground cover** → **ward growth**
(floor blobs) → **floor props** → **wall drop shadows** → walls (+ torches and the secret-wall
shimmer) → **growth climbs** → **hanging props** → path highlight →
chests/items/gold/barrels/shop → monsters and boss (a boss gets a pool of torchlight
underneath it) → player → floaters → per-biome colour wash → vignette.
**The floor is one continuous surface.** Each tile is drawn as a rounded-corner, feathered
slab whose base colour comes from a smooth value-noise field (`floorTone`, knots every 4
tiles) instead of a two-tone `(gx+gy)%2` flip — so shade drifts gently across several tiles
and never steps at a square's edge. The faint joint left between slabs is rounded and only a
little darker than the slab itself (never the old near-black grout), so the floor reads as
worn flags rather than a grid. Cracks, puddles and rubble still break it up; the thin green
weed strokes were removed — the ruins registers no weed family. Walls are
textured stone (§6.15). The **four adjacency highlights** that used to ring the
player (blue for a walkable neighbour, orange for a monster) were removed by owner request,
16 Oct — nothing replaces them. The only movement aid left is the single
**path-destination square**.
`drawDecor(layer)` paints `G.decor`: floor props sit centred on their tile; wall props
hang from the top of theirs, and because their art is 1.5 tiles tall they spill into the
tile below — which is what makes them read as hanging.
A **150ms** `setInterval` animation clock lives here (`ANIM_MS`). It ticks the torch frame
through `Delve.tiles.tickTorch()` and redraws **only while something is genuinely animating**, and does nothing at
all while `document.hidden` — a phone in a pocket shouldn't be redrawing a dungeon.
**`draw()` sets `Delve.camX`/`Delve.camY`
each frame**, and `input.js` reads those for tap→tile conversion. Uses
`document.getElementById` directly rather than `ui.js`'s guarded `$`, because `ui.js`
doesn't exist yet at this file's load time.
Never owns screen orchestration or DOM wiring.

**`js/pathfind.js`**
`findPath` (A*), `stepPath`.

**`js/input.js`**
Canvas tap handling, `Delve.uiBlocked`, camera→tile conversion, duplicate-tap
suppression, fallback `touchstart`/`mousedown` listeners, the `?diag=1` overlay,
`Delve._lastBlockers`.
All tap handling is wrapped in try/catch with visible reasons. **`uiBlocked` lists 10
overlay ids** and tests for `style.display` of `"flex"` or `"block"`. If any listed
overlay is visible, **every canvas tap is swallowed** — the #1 suspect for "buttons
work, movement doesn't". `bossIntroOverlay` is deliberately **not** in the list (§8).
Secret-wall resolution happens **before** the Manhattan-1 check, so a false wall opens
on approach.

**`js/menu.js`**
The front end, and only the front end: `Delve.showTitle`, `Delve.hideTitle`, the title menu
(CONTINUE / BEGIN, SETTINGS) and the title's own settings panel (§6.11). It owns what happens
**before** a run starts; anything during or after a run belongs to `ui.js`.
Its settings ids are `title*`-prefixed **on purpose** — reusing `muteBtn` / `volumeSlider` /
`musicSlider` / `hapticsBtn` would make `ui.js`'s load-time lookups bind to this panel and leave
the in-run pause menu dead (§8). It defines no name another file defines, and overrides nothing.

**`js/ui.js`**
- HUD: `updateHUD`, `renderAbilityBar`, `openStats`, `closeStats`
  The top bar is deliberately **three bars only** — health, energy (against the cap, so it
  answers "can I afford this cast?"), and XP toward the next level — plus a status row of
  floor, rest dots, gold and shards. The four buttons (📊 character, 📍 map, ☰ menu,
  🎒 inventory) are **not** in that row: they live in `#hudActions`, fixed to the
  bottom-right at 44px. In the row they overflowed a 360px phone and pushed 🎒 past the
  right edge. `#hudActions` is a child of `#hud` so show/hide is automatic, and
  `position:fixed` is what anchors it to the bottom edge — which is why `#hud` itself
  carries no `filter`/`backdrop-filter` (that would become its containing block); the plate
  is painted by `#hud::before`. `Delve.setMinimapOpen(open)` owns the map panel and the
  📍 button's lit state. Every combat number (attack, weapon damage, crit,
  attack speed, damage reduction, dodge, luck, merchant discount) lives in the **character
  sheet** (`#statsOverlay`, opened with 📊), together with your passives, their ranks and
  set progress. It is read standing still, so it uses the full screen, and it is in
  `uiBlocked()` while open.
- Inventory: `openInventory`, `showItemCard`, `isSlotUnlocked`, `equipSlots`
- Shop screen: `openShop`, `buildShop`
- Screen orchestration: `showHub`, `hideHub`, `startRun`, `showEndScreen`, `showVictory`,
  `showFloorCard`, `showBossIntro`, `showStairsPrompt`, `refreshHub`, `buildHub`
- Debug panel: `initDebug`
- **All DOM event wiring (41 listeners)**
Screens + DOM + wiring only. No canvas drawing, no item-pool or shop-economy logic.
Uses a **guarded `$()`** that returns an inert stub instead of `null` for missing ids,
recording misses in `Delve.missingEls` — so one missing element can't kill the rest of
the file.
⚠️ **A stub is truthy**, so `if(!el)` is *not* an existence test against `$()`. Use
`el.isStub`, or `document.getElementById` when the element is created on demand. Getting
this wrong is silent: the guard never fires, the element is never built, and the handler
throws before it reaches its `style.display` line — which is exactly how tapping an item
in the inventory came to do nothing (CHANGELOG, "Fixed — tapping an item in the inventory
did nothing"). `test_ui.js` now clicks through this path.

Every id that wiring asks for must exist in **both** `index.html` and
`test.html`'s `#fixtures` block, or `test.html` §9 reports it (and says which of the two
you are looking at). The largest file again (875 lines) now that `render.js` has been split
into `render.js` + `render/tiles.js` — and no longer multi-purpose.

**`js/progression.js`**
`hasProgression`, `markRunTrait`, `_hooks` registration, `renderTabs`, `renderTree`,
`renderPanels`, `injectRunStart`.
⚠️ **Reads `CONFIG.PROGRESSION` at IIFE time**, so it must load after
`con-progression.js` or it throws and the whole file dies.

**`js/main.js`**
`canvas`, `ctx`, `ts`, `W`, `H`, `viewW`, `viewH`, `camX`, `camY`, `resize`,
`computeView`, resize/orientation listeners.
Runs `resize()` then `showHub()` at load. Last script on the page.

### 3.6 Page shell & dev tooling

**`index.html`** — the page: structure and `<script>` tags only. Script tags must match §5
exactly. All styling was extracted into `css/game.css` (Phase 1), which is why the page
carries a single `<link>` and no `<style>` block.
**`css/game.css`** — the stylesheet. **Order matters**: it keeps the original cascade, so
the main sheet comes first, then the **shop layout fix** (§6.7), then the additive
**visual-pass layer** (rounding, soft shadows, spacing) that only overrides the selectors
it names. The map canvas and all tap geometry are untouched by it.
**`test.html`** — the browser suite, 12 sections (§10). Must be served over http, not
opened from disk — it uses synchronous XHR.
**`test_items.js`** — `node test_items.js` is the single pre-upload gate: load order, then
DOM wiring, then item maths. Nothing ships on a red result.
**`test_ui.js`** — builds a DOM from the real `index.html` and dispatches real clicks. The
only suite that can catch a handler which throws on an actual element; every other suite
stubs `document` down to one generic object and cannot see the difference.
**It covers all of `ui.js`, not just the inventory**: HUD (including the three bar fills),
the character sheet, ability bar, stairs prompt, floor
card, boss intro, hub (including the parked-run lock), shop (buy / sell / sell-all / heal),
victory and end screens, pause menu, the three audio controls, the log window, the minimap
toggle, all 16 debug buttons, start-vs-resume, slot unlocks, `hideAllScreens`, and a check
that all 21 `ui.js` entry points still exist (157 checks). Game-flow functions that need a
generated map or a real canvas are replaced by recorders, so a red check means broken
wiring rather than a stub limitation. Mutation-tested: breaking the sell-all arming, or
letting a parked run buy hub upgrades, each turns it red — a suite that cannot fail is
worth nothing.
**`ARCHITECTURE.md`** — this file.

---

## 4. Editing protocol (read before writing code)

This is the single most important section for being useful on this project. Every rule
here exists because breaking it caused a real problem.

### 4.1 How to hand over an edit

**Partial edit → give BEFORE and AFTER blocks.**
The owner edits on a phone. Locating code by description is painful and error-prone.
Every partial edit must include:

- A **BEFORE** block: the exact current lines, copied faithfully.
- An **AFTER** block: the exact replacement lines.
- **One or two unchanged anchor lines** inside each block, so the location is
  unambiguous.
- A **BEFORE/AFTER pair for *each* separate edit.** Never bundle two distant edits into
  one block with ellipses between them.
- A note on **which file and which function** ("in `js/combat.js`, inside
  `Delve.killMonster`, in the `if(m.isBoss)` branch").

Example (real, used successfully):

> **`js/combat.js`** — in `killMonster`, the boss branch. Three indents deep.
>
> **BEFORE:**
> ```javascript
>    G.gold += Math.round(rewards.gold * mult);
>    Delve.recordStat("goldEarned", Math.round(rewards.gold * mult));
>    G.stairs = { x: m.x, y: m.y };
>    g[m.y][m.x] = T().STAIR;
>    const bossName = m.name || "The Warden";
> ```
> **AFTER:**
> ```javascript
>    G.gold += Math.round(rewards.gold * mult);
>    Delve.recordStat("goldEarned", Math.round(rewards.gold * mult));
>    // Boss floors no longer drop a staircase ... (comment explaining why)
>    if(G.floorType === "boss"){
>     G.stairs = null;
>     g[m.y][m.x] = T().FLOOR;
>    } else {
>     G.stairs = { x: m.x, y: m.y };
>     g[m.y][m.x] = T().STAIR;
>    }
>    const bossName = m.name || "The Warden";
> ```

`G.gold +=` and `const bossName` are **anchors** — unchanged, present only so the owner
can confirm they're in the right place. The AFTER block must include them too, or the
edit deletes them.

### 4.2 Full file rewrite → hand over the whole file

When a file changes in several places, or when the owner asks for a rewrite, give the
**entire file** in one code block, ready to paste over the old one. Say explicitly that
it's a full replacement and that **no BEFORE/AFTER is needed**.

Preserve everything you weren't asked to change **byte-for-byte**, including odd
whitespace and comments. If you notice something that looks wrong but is out of scope,
mention it in prose — don't silently fix it inside a rewrite, because that hides the
change.

### 4.3 When a function moves between files

**Both files ship in the same message.** Half a move is worse than no move: the caller
keeps working while the definition vanishes, and the error surfaces somewhere unrelated.
Tell the owner to upload both together.

### 4.4 When you haven't seen the file

**Ask for a paste. Do not reconstruct it from memory or from your own earlier message.**
The owner's copy may have drifted. A rewrite built from an assumed version can silently
roll back their edits.

If you must quote a line you haven't seen, say so plainly and give the owner a way to
verify it.

### 4.5 Watch for anchor collisions

Before writing a BEFORE block, check whether the anchor line appears more than once in
the file. If it does, add context until it's unique, and **say so** — e.g.:

> Searching for `T().STAIR` gives two hits. The one you want is in `combat.js`,
> immediately preceded by `G.stairs = { x: m.x, y: m.y };`.

### 4.6 Additive edits

If an edit only *adds* lines (a new `<style>` block, a new `<script>` tag) and doesn't
change existing ones, say so — "this is additive, there's nothing to replace" saves the
owner hunting for a block that doesn't exist:

> Paste between `</style>` and `</head>`. You're adding a **second** `<style>` block;
> nothing existing changes.

### 4.7 Never rename a variable in a replacement block

If a BEFORE block shows `const list = [...]` and the surrounding function references
`list`, your AFTER block must keep the name. Renaming it in the replacement silently
breaks every other reference — **this exact mistake caused the `blocking is not defined`
bug** (§8). When in doubt, replace the **entire function**, not a fragment of it.

### 4.8 Testing instructions go with the edit

Every hand-over ends with what to test. Include:

- The exact URL with a **new** `?v=N` (§9).
- A short numbered checklist of specific behaviours to try.
- What `test.html` should say, and which sections are relevant to the change.

### 4.9 Answering questions

- Keep it short and direct.
- If asked to confirm a swap, **say yes or no first**, then explain.
- If the owner's paste has a bug, point at the exact line and give the corrected block.
- If you don't know, say so.

---

## 5. Load order

Order in `index.html` is load-bearing, and `js/manifest.js` is its single declaration.
`tools/check-order.js` asserts that `index.html` matches the manifest exactly and that no
file on disk is unlisted; `test.html` loads from the manifest rather than keeping its own
copy of the list. **If you add, remove or reorder a script, edit the manifest and
`index.html` together, in the same order, then run `node test_items.js`.**

```
 1  js/manifest.js
 2  js/util.js
 3  js/config.js
 4  js/content/con-monsters.js
 5  js/content/con-items.js
 6  js/content/con-itemaffixes.js
 7  js/content/con-biomes.js
 8  js/content/con-traits.js
 9  js/content/con-progression.js
10  js/save.js
11  js/attrs.js
12  js/itemgen.js                      ← item construction: quality budget, stats, affixes
13  js/items.js                        ← item runtime: price, sell, pickup, equip, shop
14  js/sprites.js
15  js/content/con-bosssprites.js      ← ordering exception (needs sprites.js)
16  js/content/con-itemsprites.js      ← same constraint (needs sprites.js)
17  js/content/con-worldart.js         ← same constraint (needs sprites.js)
18  js/content/con-monstersprites.js   ← same constraint (needs sprites.js)
19  js/state.js
20  js/gen/bsp.js                      ← floor-plan geometry
21  js/gen/bossarena.js                ← boss floors: arena layout + dressing
22  js/levels.js
23  js/ground.js                       ← no load-dependency; grouped with generation
24  js/growth.js                       ← no load-dependency; grouped with generation
25  js/puddles.js                      ← no load-dependency; grouped with generation
26  js/traits.js
27  js/combat.js
28  js/movement.js                     ← follows combat.js
29  js/rewards.js                      ← follows combat.js (uses Delve.rowFor)
30  js/effects.js
31  js/sfx.js
32  js/log.js
33  js/render/tiles.js                 ← tile atlas; render.js destructures Delve.tiles
34  js/render.js
35  js/pathfind.js
36  js/input.js
37  js/ui.js
38  js/menu.js
39  js/progression.js
40  js/main.js
```

### Hard constraints (violate = silent breakage)
1. `config.js` **before** all `con-*` — they assign into `CONFIG`.
2. `sprites.js` **before** `con-bosssprites.js` — needs `_spriteUtils`,
   `registerBossSprite`, `rebuildSprites`.
3. `state.js` **before** anything using `Delve.T` or `Delve.G`: `levels`, `traits`,
   `combat`, `movement`, `rewards`, `effects`, `render`, `pathfind`, `input`, `ui`.
4. `save.js` **before** `ui`, `progression`, `main` — they read `Delve.save` at load.
5. `progression.js` **after** `ui.js`. `ui.js` calls `showHub()` at load; then
   `progression.js` registers hooks and calls `refreshHub()` again to render tabs.
   Reversed, tabs never appear until something else refreshes.
6. `menu.js` **after** `ui.js` (it calls `Delve.hideAllScreens`, exported from there) and
   **before** `main.js`, which calls `Delve.showTitle`.
7. `main.js` **last** — needs `Delve.showTitle` from `menu.js`.

### Soft orderings (call-time only, so a swap wouldn't crash at load)
7. `movement.js` after `combat.js` — calls `startCombat`/`enemiesTurn`.
8. `rewards.js` after `combat.js` — reads `Delve.rowFor`.
9. `items.js` before `state.js` — now true (9 vs 12), since `isShopFloor`/`healCost`
   moved into `items.js`. Still call-time.

### Load-time side effects, in order
1. `config.js` seeds `CONFIG`; `con-*` fill in content.
2. `save.js` loads from `localStorage`, migrates, adopts into `Delve.save`, writes back.
3. `sprites.js` builds every base sprite.
4. `con-bosssprites.js` registers builders, then rebuilds sprites including bosses.
5. `state.js` defines `Delve.T`, sets `Delve.G = null`.
6. `sfx.js` binds one document `pointerdown` listener to unlock audio.
7. `ui.js` wires ~25 listeners, then calls `Delve.showHub()`.
8. `progression.js` reads `CONFIG.PROGRESSION`, registers hooks, calls `refreshHub()`.
9. `menu.js` wires the title screen's buttons. **It shows nothing at load.** Then `main.js`
   calls `resize()` (sets `Delve.ts`, view size) and `showTitle()`. The hub was already built
   by `ui.js` and is simply covered — every script runs in one synchronous pass before the
   browser's first paint, so no flash of the hub is visible.
10. `render.js` starts its 400ms redraw interval — harmless in the hub, since `draw()`
    returns early when there's no `G`.

---

## 6. Architecture rules & runtime chains

### 6.1 Content vs Engine
**Content** = pure data in `js/content/con-*.js`, assigning into `Delve.CONFIG` or
registries. No logic. **Engine** = everything else. Engine reads content; it never
hardcodes game content.
Why: content stays safe to edit blind, on a phone, with no risk of breaking behaviour.

### 6.2 Single ownership
Every `Delve.*` symbol has exactly one home file. Verified by `test.html` §2, and the
ownership map in §3 is asserted by §3's `EXPECT_OWNER` check. **Never define
`Delve.foo` in two files** — the second wins silently and the loser's version vanishes.

### 6.3 Hooks, not overrides
Cross-module extension goes through `Delve._hooks`:
- `Delve._hooks.runStart[]` — fired inside `newRun()`
- `Delve._hooks.hubLoaded[]` — fired at the end of `refreshHub()`

**No file may override another file's function.** The last one (a monkey-patch of
`tryAct`/`tryActOnStep` for shop taps) was removed; the logic now lives inline in
`movement.js`.

### 6.4 Engine seams
Cross-file calls resolve at **call time**, never at load time, except where §5 says
otherwise. The intentional seams:
- `Delve.rowFor`, `Delve.onHitEffectFor` — defined in `combat.js`, consumed by
  `rewards.js`.
- `Delve.startCombat`, `Delve.enemiesTurn` (`combat.js`) and `Delve.openShop`
  (`ui.js`) — consumed by `movement.js`.
- `Delve.makeShopStock`, `Delve.shopHealCost`, `Delve.isShopFloor`, `Delve.healCost`
  — defined in `items.js`, consumed by `ui.js` and `levels.js`.
- `Delve.drawPaperDoll`, `Delve.markVisited`, `Delve.renderMinimap` — defined in
  `render.js`, consumed by `ui.js`.
- `Delve.camX`/`Delve.camY` — written by `render.js`, read by `input.js`.

### 6.5 A tap (the movement chain)
`canvas` `pointerdown` → `handleTap` (`input.js`):
1. Error-wrapped. Any throw is caught, flashed, and logged to the `?diag=1` panel.
2. Bail if `!G || G.dead`.
3. Bail if `uiBlocked()` — any of the 10 overlay ids visible (records
   `Delve._lastBlockers`).
4. Bail if `ts` is invalid or the tap is out of grid bounds, flashing a reason.
5. If targeting an ability → `castAbility`.
6. If tapping your own tile → `tryRest()` *(movement.js)*.
7. If in combat and tapping elsewhere → `endCombat(true)` (flee, take one hit), and
   clear the vignette.
8. If a wall → false-wall / secret-room check.
9. If Manhattan distance 1 → `tryAct(tx,ty)` *(movement.js)*.
10. Else → `findPath`, `stepPath`, then a 110ms interval to keep walking.

`tryAct` then dispatches on the target tile: shopkeeper → `openShop`; monster/boss — or
any tile of a boss's body, see `bossBodyAt` — → `startCombat`; chest → `openChest`;
stair → `promptStairs`; barrel → `smashBarrel` then move; otherwise move, `collectGold`,
pick up an item, and `enemiesTurn()`.

### 6.6 Boss floors — bespoke arena
Boss floors are **not** room-generated. `genFloor` branches on `G.floor % 10 === 0`,
calls `Delve.genBossFloor(G, ward)`, then returns — before rooms, corridors, monsters,
barrels or chests are ever considered. So a boss floor contains **nothing but the arena**.

Geometry is three connected pieces, south to north:
1. **Entry chamber** — small, centred horizontally, near the bottom. The player spawns
   at its centre with `lastDir = "up"`, so the corridor is the first thing they see.
2. **Corridor** — narrow (3 tiles by default), centred, connecting entry to arena.
3. **Boss chamber** — large (62% × 40% of the grid by default), at the top, with the
   boss at its centre.

Defaults derive from `ward.dungeonSize`, so they work for any ward unmodified. To
customise, add a block to a `WARDS` entry in `con-biomes.js`:
```javascript
bossArena: { bossW, bossH, entryW, entryH, corridorW, pad }
```
Any omitted value falls back to the proportional default.

Other facts:
- `G.stairs = null`, `G.shop = { x:-1, y:-1 }`, `G.floorType = "boss"`.
- `G.boss.size` (`{w,h}` from `BOSS_DEFS`) is what its **art** covers; only its own tile
  blocks movement. `bossBodyAt` (movement.js) makes every tile of that body tappable, so
  either front tile of a 2-wide boss starts the fight.
- `Delve.showBossIntro(G.floor)` fires at the end of generation. The intro does **not**
  block input (§8).
- **`G.bossArena`** exposes the derived geometry (`bossX/Y/W/H`, `entryX/Y/W/H`,
  `corrX/corrTop/corrW/corrH`, `bossCx/Cy`) so ward-specific dressing — banners, props —
  can be positioned without re-deriving anything.
- **A boss arena is always lit.** `render.js` derives a deterministic brazier set from that
  geometry (`arenaTorches`): across the chamber's back wall, down both of its side walls,
  along both corridor walls and on the entry chamber's walls. Wild torches are a 4% roll on
  wall tiles that have floor below; arena braziers deliberately skip that test, because a
  chamber's *side* wall has wall below it. Same floor ⇒ same braziers, so a boss room is
  somewhere you can learn. `test.html` §7 fails if an arena comes out dark, or if its
  lighting differs between two generations of the same floor.
- **Arenas are dressed by data.** `CONFIG.DRESSING[ward.id]` names the art for each role
  (pillar / banner / wallBit / rubble / bone / cluster); `dressBossArena` decides *where*
  each goes, purely from `G.bossArena`: pillars at the chamber's four inner corners,
  banners and a hanging piece across its back wall, hanging pieces on the side and
  corridor walls, debris along the walls, a feature either side of the entrance, and
  something in the entry chamber. Those columns and rows are deliberately chosen to fall
  between the derived braziers, so a prop never covers a torch. Props are painted from
  `G.decor` and never written as tiles — they cannot block movement, be tapped, or show
  on the minimap. `test.html` §7 checks all of that on every boss floor, including that
  the same floor is dressed identically every time.
- **Each boss has its own furniture.** The props are not one shape recoloured three ways:
  every role has bespoke art per ward, carrying that boss's own palette and accent — the
  Warden's steel banner with a pale-blue hammer crest and a toppled stone knight, the
  Sovereign's living leaf canopy and petrified root-pillars seamed with acid green, the
  Tempest's ice-sheathed pillars, frozen standard and remains locked in ice. §4 checks
  every key resolves to real art and that no ward is missing a role.
- On boss death, `combat.js` restores the arena-centre tile to `FLOOR` and leaves
  `G.stairs` null. Without the restore the tile stays `T.BOSS` and `tryAct` refuses to
  walk onto it — an invisible one-tile hole mid-arena.
- The run continues or ends from the victory screen, not from a staircase.
- `canContinue` on the victory screen is hardcoded true only for ward 1.

### 6.7 Shop layout
`index.html` carries a second `<style>` block making `#shopScreen` a scrollable flex
column (`height:100dvh`, `overflow-y:auto`), sizing `#shopHealBtn`/`#shopLeaveBtn` to a
48px minimum, and adding `env(safe-area-inset-bottom)` padding to the leave button.
Without it the shop was taller than the viewport with no scroll, so the footer buttons
were unreachable.

### 6.8 Combat tick
`startCombat(m)` sets `G.combatTarget`, `G.inCombat`, and an 80ms interval. Intervals
derive from `secondaries.baseInterval / playerSpeed()` and `/ monster.speed`, so a fast
dagger genuinely gets more hits. The **player's** interval is recomputed at each swing
rather than captured once, so mid-fight speed changes (Chill, speed potions) land
immediately.
- `playerSwing`: weaken check → `tickPlayerEffects` → damage (base + boss bonus + first
  strike) → crit roll → floater + sfx → weapon status roll → vampiric on crit →
  `killMonster` + `endCombat` if dead.
- `monsterSwing`: `tickMonsterEffects` (a DOT can kill) → boss chain-hit check → dodge
  roll → damage (armour, stone skin, bulwark cap) → on-hit status → Second Wind →
  Unbroken → death.
- `enemiesTurn()` (non-combat): ticks player effects and `stoneSkin`, then every
  adjacent monster gets one `ambientMob` attack.

### 6.9 Level up
`killMonster` → `addXP` → level-up loop → 3 choices → pick → `applyTrait` → repeat while
`pendingLevelUps > 0`. Card 1 is always an unlearned ability while any remain; the other two
are passive lines you have not maxed, each offering its **next rank**, and a 25% chance
swaps one of them for an unused unique.

### 6.10 End of run
- Run-earned shards live in `G.runShards` and are **not** in the save while the run is in
  progress. A **commit point** is what moves them into `Delve.save.shards`, and there are
  exactly three: **dying, retreating, and beating a ward boss**. So a mid-run refresh loses
  the run's earnings, exactly as it loses the run itself.
- `Delve.bankRunShards()` (`rewards.js`) banks the *difference* since the last commit,
  tracked in `G.shardsBanked` — an amount, not a flag, so calling it at every commit point
  is safe. Victory banks, the run continues deeper, later earnings accrue from zero, and a
  later death banks only the remainder. `Delve.pendingRunShards()` reports what is unbanked.
- `die()` → `endRun("death")` → banks → `showEndScreen` → `#deathScreen`.
- Boss dies → boss branch of `killMonster` → guaranteed boss drop (**flat, depth-scaled
  boss shards** — see the next bullet) → `triggerVictory(wardIdx)` → `convertGold()`
  (gold→shards at 10:1) → `bankRunShards()` → `showVictory`.
- **Boss reward (Batch 13):** a boss pays a flat `CONFIG.economy.bossShardsPerWard × ward` —
  30 for boss 1, +30 per boss, so 300 by floor 100 (the planned ten wards). The old system
  was a constant 40 **plus** a percentage of run shards (`BOSS_DEFS[n].shardBonusPct`), which
  meant boss 3 paid the same flat 40 as boss 1; the percentage was removed by the owner's
  call on 16 Oct. A single boss can still override the formula with `shardReward` in
  `BOSS_DEFS`. Linear in ward **on purpose**: the floor-clear bonus (`2 + floor`) and gold
  (`2 + 0.5 × floor`) are both linear in depth, so a boss stays "slightly better than an
  ordinary floor" at every depth instead of being re-tuned each time a ward is added.
- Victory screen offers **Descend deeper** (ward 1 only) or **Return to Hub**.
- `retreat()` → gold converts, banks, counts as a success.
- During a run the HUD's 💎 shows `save.shards + pendingRunShards()` — banked plus what this
  run has earned so far, i.e. what the player would hold if they banked right now. That keeps
  the counting-up feedback while the save stays untouched until a commit point.

### 6.11 Title screen (front end)
`js/menu.js` owns it, and `main.js` shows it on **every** load (owner's decision, 16 Oct).
- **CONTINUE** → `Delve.showHub()`. On a save with nothing in it the button reads **BEGIN**
  instead, so a new player never meets a CONTINUE that leads nowhere.
- **Forward-compatible seam.** `continuePressed()` first asks for `Delve.hasSavedRun()` /
  `Delve.resumeRun()` if those exist. Nothing saves an in-progress run yet, so today it always
  falls through to the hub. When run-resume is built, CONTINUE starts resuming with **no change
  to `menu.js`** — and the button will then read the floor number instead of CONTINUE (§6.12).
- **SETTINGS** → the same four sound settings as the in-run pause menu, through the same
  `sfx.js` functions (`sfxSetVolume` / `musicSetVolume` / `sfxSetHaptics` / `sfxToggleMute`).
  Prefs live under `sfx.js`'s own key, so this panel is a *view* of them, never a second copy.
- The wordmark is **CSS only**: black fill, thick acid-green stroke, a slow pulsing glow, and a
  second drifting stroke for the "moving outline". No canvas, so the map and all tap maths are
  untouched and the visuals can be replaced by swapping one `<style>` block. True jagged
  letterforms need a font file, which this project deliberately doesn't ship; the jagged feel is
  approximated with weight, tight tracking and the doubled stroke.
- `titleScreen` is registered in **both** `ui.js`'s `hideAllScreens()` and `input.js`'s
  `uiBlocked()`. Miss either one and the screen either won't close or will leak taps to the map.

#### 6.11.1 Fonts (Batch 12)
Three files the owner uploaded into `fonts/`: `title.ttf` (the wordmark), `sub.ttf` (the tagline), `buttons.ttf` (the title's buttons). `title.ttf` is *Isometra* and `buttons.ttf` is *Jacquard 12*, both SIL Open Font Licence. Each is registered with `@font-face` under a
neutral internal name — `UwTitle` / `UwSub` / `UwBtn` — so a font already installed on the
phone can never shadow it, and with `font-weight:400 900` declared so the browser uses the
font's **real glyphs** at any weight instead of synthesising a fake bold, which goes muddy
behind a text-stroke. `font-display:swap` shows the fallback immediately rather than invisible
text while a font loads. Swapping a font later = replace the file and bump `?v=`; fonts are
cached as hard as anything else on a phone.

   **Batch 21 — supersedes the `font-display:swap` sentence above:** it is now `block`, and the
   three TTFs are preloaded in `<head>`. `swap` painted the title in the system fallback for a
   beat on every fresh load — and that fallback look *is* the old pre-Batch-12 title, which is
   why it read as the old version flashing before the real one. `block` holds the text
   invisible while the font arrives (near-instant with the preloads) and still falls back
   after ~3s if a load genuinely fails.

#### 6.11.2 The pulse and the layout (Batch 12)
- The pulse runs at **2.2s** (was 3.6s), much stronger at its peak, with a **permanent** glow
  underneath so the letters always look lit rather than only during the beat. `titleBreathe`
  scales the whole word 1 → 1.035.
- The `prefers-reduced-motion` guard is **kept**: with the phone's reduce-animations setting on,
  both animations stop and the static `text-shadow` on `#titleWord` is what remains. The owner
  has that setting off, which is why the pulse is visible at all — the original "no pulse" was
  this guard doing its job, not a bug.
- Layout: `#titleScreen` no longer vertically centres (`justify-content:flex-start` plus
  `padding-top:13vh`), so the wordmark sits in the **upper half**; the tagline follows it.
  `#titleInner` grows to fill the screen (`flex:1`) and `#titleButtons` is anchored to the
  bottom of it with `margin-top:auto` above a 5vh bottom pad — so the buttons sit **low**,
  rather than tucked under the tagline on a guessed gap. Still centred side-to-side.
- The wordmark is **one line**, sized `clamp(36px,13vw,80px)`. It started at 16vw, which ran off
  the left and right edges of a narrow phone — nine letters is a lot of width — so 13vw it is.
  Pushing it much larger needs two lines (`under` / `ward`), which the owner declined for now.

#### 6.11.3 RESET — wiping the save (Batch 12)
In the settings panel: **RESET** → an inline `ARE YOU SURE?` block (`#titleResetConfirm`) that
names what dies → **YES, WIPE IT** / **CANCEL**. Nothing is deleted until the second tap. It
calls the existing `Delve.resetSave({silent:true})`, nulls `Delve.G` so no half-finished run
lingers in memory, prints a confirmation, and re-labels the main button via
`refreshTitleButton()` so it reads BEGIN. **Sound prefs survive** — they live under `sfx.js`'s
own storage key, and losing your volume because you reset your game would be absurd. Built
**inline rather than as a new overlay** on purpose: no new screen to register in the two id
lists, and nothing new that can leak taps.
New ids (present in both `index.html` and `test.html`'s `#fixtures`): `titleResetBtn`,
`titleResetConfirm`, `titleResetNote`, `titleResetYes`, `titleResetNo`, `titleResetDone`.

### 6.12 Resume after the app closes (BUILT — Batch 14)
The owner's decision, 16 Oct. This **supersedes** the "recreate the identical floor" idea
sketched earlier. The design bullets below are the agreed behaviour; the implementation notes
are at the end.
- **Entering a floor sets the run's checkpoint.** Resuming rewinds gold, items, XP, level,
  traits **and health** to how they were when that floor was entered — **full health on entry**,
  deliberately, so someone who quit at 3 HP isn't made to re-clear the floor while nearly dead.
- **The floor is rebuilt fresh**, not reproduced. Rewinding is what stops a resumed floor being
  farmed for chests and kills; rebuilding fresh is what means **no map ever has to be stored**,
  which makes this far cheaper than the identical-floor version.
- The title's main button then reads **"FLOOR 24"** instead of CONTINUE, and tapping it puts the
  player at the start of that floor.
- Retreating still ends the run properly, so the button returns to CONTINUE.
- **Accepted cost:** quitting before the killing blow is an escape from death. The price is that
  floor's loot and XP, which are discarded.
**Implementation (Batch 14).**
- `save.js` carries the snapshot in a new field, `save.run` — `null` when there is no run. Added
  in all three required places (`makeDefaultSave`, `migrateSave`, the write-out whitelist), and
  validated by `sanitizeRun()`: it must survive a JSON round-trip and name a floor ≥ 1, or it is
  dropped as "nothing to resume".
- `state.js` owns the checkpoint set. `captureRunSnapshot` copies a fixed list (the const
  `CHECKPOINT_FIELDS`) **deep-copied through JSON**, so it freezes rather than aliasing the live
  run's nested items and arrays.
- **Written** at the end of `newRun()` (floor 1), at the end of `descend()` (`movement.js`), on a
  debug floor-jump, and again at the end of `restoreRunFromCheckpoint`. That last one is not
  optional: `newRun()` stamps a floor-1 snapshot on the way through, so without re-taking it,
  quitting straight after a resume would send the player back to floor 1.
- **Cleared** in `showEndScreen` (death and retreat both route through it) and in the
  `victoryHub` handler. **Deliberately NOT in `showHub`** — `ui.js` calls `showHub()` at load,
  before `main.js` shows the title, so clearing there would destroy the saved run on every page
  load. That was the trap most likely to have shipped.
- `restoreRunFromCheckpoint` calls `newRun()` and then overwrites the snapshot's fields. That
  reuses the one definition of the run's shape and fires the `runStart` hooks (hub abilities
  included, which is idempotent), at the cost of generating floor 1 and discarding it — cheaper
  than a second copy of the run shape that could drift.
- `ui.js`'s `resumeRun()` mirrors `startRun()` for the screen. `menu.js`'s `refreshTitleButton()`
  reads `FLOOR n`, and `continuePressed()` calls `Delve.resumeRun()` — the name the title screen
  was already looking for.
- **Shards are unaffected.** The snapshot records `runShards`/`shardsBanked` so a resumed run
  still banks its pre-floor earnings at a commit point (§6.10), but nothing here ever writes
  `save.shards`.
- **Two accepted consequences:** (a) quitting before the killing blow escapes death, paid for with
  that floor's loot and XP; (b) re-fighting the boss of the floor you resume on pays its flat
  reward again, because the floor genuinely is fresh — bounded by having to win the fight from the
  floor-entry loadout each time.
- **Test-page note:** `test.html` sets `Delve._suppressCheckpoint = true`, because it generates 50
  floors and would otherwise stamp over the live save's run slot. Worth knowing: `test.html`
  already writes to the real save, so running it can clobber a run in progress.
- **The hub is reachable, but its wallet is shut while a run is unfinished** (owner's rule,
  16 Oct — this **replaces** the earlier "hub is unreachable during a run" decision, which left a
  player with a parked run and no way to reach the hub at all). See §6.12.2.

#### 6.12.1 Save floor & exit — leaving a run ALIVE (BUILT — Batch 16)
The in-run pause menu used to offer only *Flee to surface*, which ends the run. It now also
offers **Save floor n & exit**, because a player who simply wanted to stop playing had no way
to leave a run alive except killing the tab — the mechanism existed (Batch 14) but had no button.
- It sets `G.runEnded` — which the tick loop, movement, XP gain, the gear button and the debug
  panel all already guard on — then lands on the title screen, whose main button reads `FLOOR n`.
  **Nothing is banked and nothing is cleared:** this is leaving the game, not ending the run.
- **It deliberately does NOT re-take the checkpoint**, and that is the whole trick. Re-taking it
  at save time would snapshot the player's current gold, XP, items and health — everything this
  floor has already paid out — while a resume rebuilds the floor fresh, chests and monsters
  included. Half-clearing a floor and saving would then be repeatable for profit. The checkpoint
  therefore stays at **floor entry**, where a resumed floor is worth exactly what it was worth the
  first time. A checkpoint is created here only when none exists at all, which cannot be farmed
  because there is nothing to reset.
- **It does NOT bank shards** (§6.10). Leaving the game is not a commit point, and banking here
  would double-count: the resumed run restores the same pending amount, so the later death or
  retreat would bank it a second time.
- **Allowed mid-fight, unlike Flee.** Flee is blocked mid-fight because it both banks and ends the
  run, which would make fleeing a losing fight profitable. Save & exit does neither, so it is the
  same escape a killed tab already gives, at the same accepted price.
- Lives in `combat.js` as `Delve.saveAndExit()`, a run-lifecycle sibling of `retreat`/`die`, wired
  from `ui.js`. The button names its floor (`💾 Save floor 12 & exit`) and the label is refreshed
  every time the menu opens, so it can never name the wrong floor.
- **Open question, deliberately left open:** with a run parked on the title screen the hub is still
  unreachable — the main button resumes and nothing else leads there, so reaching the hub means
  resuming and retreating, or RESET, which erases everything. That is the same rule as "no hub
  during an active run", but a *saved* run is a new shade of it. **Answered by the owner on
  16 Oct — see §6.12.2**, which opens the hub and shuts its wallet. Do not re-litigate it.

**Touched by this batch:** `js/combat.js` (the function), `js/ui.js` (the pause-menu wiring),
`index.html` (the button, its styles and its note). Note for anyone reading the pause card: the
save button's label is rewritten on every open, so the string in `index.html` is a fallback.

#### 6.12.2 The hub is open, the wallet is shut (BUILT — Batch 17)
The owner's rule, 16 Oct: **shards are spendable only once the run they were earned in has
ended** — dying, retreating or winning the ward. So the hub became reachable with a run parked,
and rather than hiding it, everything in it is **visible and unbuyable**.
- The title screen grows a **HUB** button, shown **only when a run is parked**. With no run saved
  the main button already leads to the hub, so a second door would be clutter.
- In the hub with a run parked: a banner reads *"Your run is still going — floor n. Upgrades
  unlock when it ends."*, the attribute buttons are disabled, and shard-tree cards render locked
  **with no click handler attached at all**.
- **Both purchase points re-ask at click time** via `Delve.runInProgress()` (`state.js`) rather
  than trusting what was true when the screen was drawn — the hub can sit open for minutes and the
  gate has to hold regardless. `runInProgress()` is true for a parked run *or* a live unfinished
  one, so the two states cannot drift apart.
- The hub's footer button becomes **`RESUME FLOOR n`** rather than `START RUN`, because starting a
  fresh run from there would overwrite the parked checkpoint without a word. A **TITLE SCREEN**
  button appears beside it, since the hub otherwise has no way back out.
- Only two places in the game spend shards — `ui.js`'s attribute rows and `progression.js`'s tree
  nodes. **If a third is ever added it must call `runInProgress()` too**, or this rule leaks.
- **Why this is safe rather than an exploit:** a run's earnings live in `G.runShards` and do not
  reach `save.shards` until a commit point (§6.10), so a mid-run player has nothing extra to spend
  even though the door is now open. That is precisely what makes opening it affordable.

**Touched by this batch:** `js/state.js` (the predicate), `js/ui.js` (the hub banner, the locked
attribute buttons, the two footer buttons), `js/progression.js` (the locked tree), `js/menu.js`
(the title's HUB button), `index.html` (both buttons and the banner style).

### 6.13 Impact feedback (Batch 15)
Three additions, all presentational — none touch the grid, pathfinding, the combat maths or the
save.
- **Corpse fades.** `killMonster` calls `Delve.addDeath(m)`; render.js keeps up to 14 records for
  `DEATH_LIFE` (460ms) and draws each as the ordinary sprite shrinking to ~65% while sinking
  ~0.22 tiles and fading out. The animation clock runs at 150ms, so that is roughly **three
  frames** — if it reads as steppy rather than smooth, the knob is `DEATH_LIFE` or `ANIM_MS`,
  not the drawing code. The records are **render.js's own state, deliberately not on `G`** —
  so they stay out of the run state, out of the checkpoint snapshot (§6.12), and out of the floor
  checks in `test.html` §7. Each carries its floor number and is skipped when the floor no longer
  matches, which is why nothing has to clear the list on descend.
- **Hit-stop.** `hitStop(ms)` in `combat.js` sets `G.hitStopUntil`, and the swing loop returns early
  while it holds — **without advancing `playerTimer`/`monsterTimer`**, so the pause is a real freeze
  rather than a skipped swing. 90ms on a crit, 70ms on an ordinary kill, 170ms on a boss.
  `animating()` reports true during a stop so the frozen frame is actually drawn.
- **Crit feedback.** `addFloater` gained an optional 5th argument (a size multiplier); crits use 1.5×,
  a crit now shakes the screen by 2, and the crit sound (`sounds.crit`, already wired) still plays.
  A crit should be felt, not only read.

### 6.14 Biome ground cover (Batch 16)
Each biome sprinkles small decorative clusters on the floor — blood moss in the Blackvein,
frozen puddles in the Frosted Vault (the Upper Ruins has none; its old mushrooms read as
growing out of the paving and were removed). Two or three clusters per
floor, on every floor (boss arenas included). Pure decoration: painted flat, never written
into the grid, so they cannot block movement, be tapped, or show on the minimap, and they
stay out of the run snapshot.
- A shared library of ten shapes (`SHAPES` in `js/ground.js`) is rotated and mirrored at
  placement, so ten become eighty layouts. The chosen clusters land in `G.groundCover` as
  `{shapeId, x, y, rotation, mirror}`.
- Placement validates every tile of the shape against the grid — plain `FLOOR`, clear of the
  spawn, stairs, shop, chests, monsters, other clusters and the boss's body. Failing all ten
  retries just skips that cluster, so generation can't loop forever.
- `js/render.js` calls `Delve.drawGroundCover` after the floor tiles and clutter, before the
  floor props; each occupied tile draws its own little sprite (with a per-tile mirror to
  break up repetition). Art is `SPR.world["ground_*"]`, named per biome by
  `BIOMES[n].groundCover`; a biome without one simply has no cover.

### 6.15 Wall look — textured stone + drop shadows (Batch 17, silhouette Batch 20)
Owner's choice from a four-option menu (soft top-down light, rounded caps, textured stone,
drop shadows — stone + shadows taken, 16 Oct). All of it lives in `render.js`:
- **`drawWallTile`** — each tile is its own shade of the biome's stone (`blendHex` against
  near-black by a hash, a few tiles lighter), a soft top-down light gradient tinted by
  `wallEdge` at the crest, low-contrast **running-bond** course lines (the sag and head-joint
  offsets are smooth functions of position, and the joint halves alternate by row, so
  neighbouring tiles continue the same courses instead of looking turned or flipped), the
  biome's `moss` colour creeping over the top edge (moss / lichen / frost, ~45% of tiles,
  plus the occasional drip), chips and dents, and a warm `torch`-tinted sheen on or beside a
  brazier tile.
- **Visibility rule.** A wall is drawn when **any of its eight neighbours** is open (a corner
  tile only touches the room diagonally), and walls on the map's outer ring are always drawn.
  This keeps deep buried stone invisible while guaranteeing that a room touching the map edge
  is closed in stone — no black gaps at corners or along the top side. `genFloor` backs this
  up by sealing every painted room's one-tile border and the map's outermost ring to `WALL`.
- **Batch 20 — organic silhouette.** The tile is no longer a full square: it checks its
  four neighbours, and an edge facing open floor is **exposed** — inset a couple of pixels
  over the dark `mortar` base, bowed slightly off straight by a hash, with corners rounded
  (`ts*0.18`) only where two exposed edges meet. Edges facing another wall stay full-bleed,
  so a run of walls merges into one continuous mass with no internal seams. The old hard
  top/bottom strips are gone; the grounding shade applies only along an exposed bottom
  edge, which kills the horizontal banding. Everything (light, growth, chips, sheen) is
  clipped inside the stone shape.
- **`drawWallShadows`** — a pass after the floor props and before the walls: every wall
  throws a soft gradient shadow onto the floor below it and to its right. Direction is fixed
  everywhere, so the whole dungeon reads as lit the same way. Shadows land on whatever is
  there (ground cover and props included), which is the point.
  Still deterministic per tile and still cached per floor — no per-frame cost beyond the
  shadow pass itself.

### 6.16 Boss shield — the two-act fight (Batch 18)
A boss may declare `shieldHp` in its `BOSS_DEFS` entry (and `spriteOpen`, the Act-2 art).
Damage from **any** source — weapon swings and abilities alike — soaks into the shield
first; only the remainder reaches HP. `Delve.absorbBossShield` (`combat.js`) owns it:
floaters read `ribs -N` while it holds, and when it breaks it flashes, shakes, logs
"the black heart is exposed", sets `m.shieldBroken`, and **never regrows** — Act 2, once
begun, stays begun. `render.js` swaps the drawn sprite to `spriteOpen` while
`shieldBroken` is set, so the player can see exactly why the damage changed. The shield
lives on the boss object, which is rebuilt fresh every floor — nothing to save.
The Bonefather (ward 4) is the first user: 280 HP behind 120 ribs.

### 6.17 The Sarcophagus Hall (Batch 19 — ward 4's special floor)
Replaces the swarm floors in the Bone Ossuary: a ward's `special` block may declare
`sarcophagusChance` (+ `sarcMin`/`sarcMax`) and `ensureWardPlan` rolls it per eligible
floor exactly like swarm chance. `applySarcophagusFloor` (`levels.js`) scatters 6–10
sealed tombs on clear floor tiles — clear of spawn, stairs, shop.
- A tomb rides the **CHEST tile** flagged `sarcophagus:true`, so taps reach `openChest`
  with no new input path; `drawChest` (`render.js`) paints it with `tombSealed`/`tombOpen`
  instead of the chest art.
- Opening one rolls the agreed table: item 30% / gold 25% / **a monster bursts out** 20%
  (spawned on the tomb's own tile via `spawnMonsterKind`, with the ward's band) /
  potion 15% / already empty 10%. How many tombs the player opens is their choice.
- Provenance stamps `kind:"sarcophagus"`, so a legendary from a tomb is traceable in the
  run stats like any other source.

### 6.18 Wall-anchored puddles (Batch 21)
Water is no longer a cellular-automaton patch — `applyPatch` ignores any water def, and the
`patches` water entries are gone from con-biomes.js. Every WATER tile now belongs to a puddle
that sits against a wall. All of it lives in `js/puddles.js`.
- **2–4 puddles per floor**, each a compact lobed blob anchored at a wall — the outline is
  harmonics plus value-noise wobble and never runs straight, so no plus-shapes and no squares.
  The water is painted from the same shape field at 16 px/tile, so neighbouring tiles continue
  one shoreline with no seam.
- **Placement keeps the spawn dry** (mdist ≤ 2), stays off the shop and the tile around it,
  never covers a chest/barrel/stair/door/gold pile/monster (a blocked placement shrinks twice,
  then that anchor gives up), and leaves one dry tile between puddles so two pools can never
  merge. A blob that pokes through a thin wall is trimmed to the room it opens into — and
  always touches that wall. Nothing is ever anchored at a brazier or at the secret room's
  false wall.
- **Colour is unchanged** — `patchWater`, falling back to `water` — painted translucent so
  the masonry ghosts through, with a shallow lighter lip at the edge, a sunken contact rim,
  and glints that stay off the shore. A WATER tile with no puddle behind it (legacy fixture,
  manual grid edit) paints a plain rounded pool rather than invisible water.
- **Nothing enters the grid but the WATER tiles**, and nothing enters the run snapshot —
  movement, taps, the minimap and the checkpoint are untouched. A resume re-rolls puddles
  with the floor, exactly like growth and ground cover. A ward can set `puddles:false` to
  opt out; ward 5's lava inherits automatically through its `water` colour.

### 6.19 Floor events, ambushes and the heirloom (entertainment pass)

Three additions that put decisions and risk back into a floor without touching the
combat loop.

**Floor events** — `placeFloorEvent()` runs at the **end** of `genFloor()`, after every
prop, puddle and growth patch. It only ever picks a plain `FLOOR`/`GRASS` tile at least 5
tiles from the entrance, and never on a boss floor (`floor % 10 === 0`) or a shop floor.
The tile stays walkable and becomes `G.floorEvent = {x, y, kind, used}`; nothing is written
to the grid, so pathfinding, the minimap and the checkpoint are untouched.
`movement.js` checks `eventAt(tx, ty)` after the player steps and opens the card instead of
running `enemiesTurn()`. Resolving marks `used = true`; **stepping away leaves it
available**, so a shrine is a decision the player may walk back to, not a one-shot popup.
Costs are checked by `floorEventCanUse()` and rendered disabled when unaffordable — an
option can never kill the player (`hp <= cost` disables it). `maxHp` uses `G.maxHpBonus`,
which `attrs.maxHp()` adds and which is in `CHECKPOINT_FIELDS` so a resumed floor keeps it.
The prop is drawn as primitives in `render.js`, tinted by the kind's `accent`.

**Ambushes** — `maybeAmbush("rest"|"chest")` is called from `tryRest()` and
`openChest()`. Chance is per source (`CONFIG.FLOOR_EVENTS.ambush`), capped at
`maxPerFloor`, never in combat, never on a boss floor, and never on floor 1. Ambushers
spawn **2–3 tiles away** (never adjacent, so they never get a free hit on the same turn),
using the same monster shape as the floor generator. A chest's contents are resolved
*before* the ambush check, so an ambush can never cost the player what they just found.
The counter (`G.ambushCount`) is per-floor and reset by `genFloor()`.

**Heirloom** — on **death only**, `showEndScreen` fills `#heirloomBox` with up to ten
carried/equipped non-consumables sorted by item value. `Delve.setHeirloom(item)` stores one
in `save.heirloom`; a `runStart` hook (`Delve.claimHeirloom`) puts it in the bag and clears
the field, so it is consumed on the way in and can never be duplicated. Retreating does not
offer one — the bag comes out with you. `save.js` validates it with the same item-schema
rule as the bag and drops consumables. The picker lives **inside** `#deathScreen` (already
in `hideAll()` and `uiBlocked()`), so there is no new overlay to register.

**Rules for extending**
- A new event kind is data in `con-events.js`; a new *effect* needs a `case` in
  `resolveFloorEvent`.
- Every event id it looks up must exist in `index.html` **and** `test.html`'s `#fixtures`:
  `eventScreen`, `eventTitle`, `eventFlavour`, `eventOptions`, `eventLeaveBtn`,
  `heirloomBox`, `heirloomList`.
- `eventScreen` is in both `hideAll()` and `uiBlocked()`.
- Do not place events on boss or shop floors, and do not let an ambush spawn on the event
  tile or adjacent to the player.

---

## 7. Extension recipes

**Add a monster**
1. `con-monsters.js`: add a `MONSTER_ROSTER` row (`kind` must match a sprite key).
2. Add weights to the relevant `MONSTER_BANDS` entries. A weight naming a missing row
   silently spawns goblins — `test.html` §4 catches this.
3. Sprite: add a builder in `sprites.js`, or accept the pink placeholder circle.
   Also give it an `attack` frame in `buildAll` via `atkFrom(idle, [strike rects])` —
   `test.html` §5 fails if any roster kind has no attack frame. The lunge motion and
   the `ATTACK_MS` timing live in `render.js`.

**Add an item**
`con-items.js`: one `L("id","Name","slot",tier,{stats},"lore")` line. Slots come from
`SLOT_DEFS`. Status-on-hit needs `{status:"poison"|"bleed"|"burn"}`; chances come from
`CONFIG.statusChance` by tier.

**Add a ward (10-floor band)**
1. `con-biomes.js`: a `WARDS` entry (floor band + generation tuning), a `BIOMES`
   palette, which must also declare `clutter` (§3 — `test.html` §4 enforces it)
   and `groundCover` (§6.14 — the `SPR.world["ground_*"]` sprite, built in `sprites.js`),
   and a `DRESSING[wardId]` entry naming that ward's arena props (§6.6 — omit it and
   the arena is simply bare). Optionally a `bossArena: {...}` block, and a `special: {...}`
   block for swarm / clustered-loot floors (offsets are ward-relative; Blackvein's and the
   Frosted Vault's are both spelled out there as examples).
    Water is automatic: the wall-fed puddles (§6.18) tint themselves from the palette's
    `water` (or `patchWater`). Set `puddles:false` on the ward entry to keep it dry.
2. `con-monsters.js`: bands covering the new floors for **normal floors only** — a boss
   floor needs no band, since `genBossFloor` spawns nothing.
3. `con-monsters.js`: `BOSS_DEFS[n]` with `sprite:"boss_xxx"`, `accent` and `size`
   (`{w:2,h:2}` = the tile footprint its art covers; its own tile is the bottom-left).
4. `con-bosssprites.js`: `Delve.registerBossSprite("boss_xxx", builder)` — draw on a
   **24px-per-tile** canvas (so 2×2 = 48×48) — plus
   `Delve.registerBossAttackSprite("boss_xxx", function(idle){ return U.atkFrom(idle, [...]) })`.
5. `combat.js`: `canContinue` in `triggerVictory` — **now data-driven** (it asks
   whether any ward has a higher id), so adding a ward needs no edit here.

**Add a trait / unique / ability**
`con-traits.js` only: one entry in `passives` / `uniques` / `abilities`. A passive needs
`tag`, `maxRank`, `effects` (rank I) and `perRank` (the step per rank); its numbers must use
a key `traitBuffs()` already aggregates **and** something must read that key — `SpeedBonus`
and `HealOnKill` were aggregated for months with no reader, so two passives did nothing.
Ability `data` fields must match what `castAbility` reads. **A new ability id needs a new `case` in
`castAbility`** (`traits.js`). Abilities are uncapped, so a new one needs no slot change;
`target` is only compared against `"self"` (cast-now vs tap-a-target), so any other string
works provided the `case` validates its own range and shape.

**Add a shard-tree node**
`con-progression.js`: one `NODES.<tree>` entry, **plus the numbers it promises** as its
own data fields (`atk`, `hp`, `healBonus`, `discount`, …). The engine reads those fields
— all of them in `attrs.js`, except the combat-timing ones (`combat.js`) and the loot ones
(`items.js`) — so a card's wording and its actual effect cannot drift apart.

Every type below is live, and `test.html` §4 fails the suite if a node's type is not on
this list:

```
slotUnlock  inventory  ability  abilityRank
flatAtk  flatHp  flatRed  flatStat  flatDodge
startGold  startLevel  startItem  startConsumable  startKit  startEnergy
healPct  restPlus  dropPlus  goldPlus  discount  consumableHeal  cureHeal
chestGuarantee  chestTierUp  killEnergy  energyCostPct
bossDamage  statusUp  overkillPct  secondWindPct  secondWindTriggerPct  ironWill
```

An unknown `type` is **silently inert** — no error, the node just costs shards and changes
nothing. That is how ~23 nodes shipped dead. §4's check is what catches it, so a new type
means wiring the engine **and** adding it to that list.

**Add a persisted save field**
`save.js`, in **three** places: the default-save builder, the migration function, and
the write-to-storage whitelist.

---

## 8. Known weak points & deliberate decisions

### Deliberate — do not "fix" these
- **`save.js` mutates the existing save object** rather than replacing it, so modules
  holding a reference stay valid.
- **`enemiesTurn`/`ambientMob` live in `combat.js`**, not `movement.js` — they share
  `ON_HIT_STATUS_CHANCE` and `onHitEffectFor` with `monsterSwing`.
- **`bossIntroOverlay` is not in `uiBlocked()`.** Removing it was a decision: the intro
  draws over the map while the player is meant to be walking up the corridor. The card
  still shows and fades.
- **The floors 10/20 `boss:true` bands were removed** from `con-monsters.js` in the
  tidy-up pass (§3.1). If you ever see one, it's a leftover — nothing reads it.
- **Abilities are uncapped** (`levelMaxAbilities: 0`). They were capped at 3 with the
  oldest silently dropped; that was removed at the owner's request, because a learned
  ability is a choice the player made. `addAbility` now only refuses a duplicate, and the
  bar wraps and scrolls (34vh) instead of overflowing. Do not reintroduce a cap without
  asking.
- **Passives are ranked, and the same card is meant to reappear.** A line you own is offered
  again as rank II/III, and a maxed line drops out of the pool. That repetition *is* the
  upgrade path — do not "fix" it by filtering owned ids out of the passive pool.
- **`ui.js`'s guarded `$()`** returns an inert stub for missing ids on purpose.
- **The level-up screen is absent from `hideAll()`'s sweep** (`ui.js`) but *is* in
  `uiBlocked()` (`input.js`), and is hidden explicitly in `showHub`, `hideHub` and
  `showEndScreen`. **Owner's decision, 16 Oct: leave it.** It cannot cause the
  two-screens-at-once problem the sweep guards against, because the popup blocks taps for
  as long as it is open. Untidiness, not a defect — do not "fix" it without being asked.
- **The title screen's settings ids are `title*`-prefixed** (`titleMuteBtn`, `titleVolumeSlider`,
  `titleMusicSlider`, `titleHapticsBtn`) rather than reusing the pause menu's. `ui.js` looks those
  ids up **by name at load**, so a duplicate id in the title markup would silently bind `ui.js` to
  the wrong element and leave the in-run pause menu dead with no error anywhere. Deliberate — do
  not "tidy" them to match the pause menu's.
- **`render.js` uses `document.getElementById` directly** instead of `$`, because
  `ui.js` isn't loaded yet.
- **No `?v=` needed on `test.html`** — it appends its own timestamp to every script
  request.
- **The `T` / `T()` duality.** `Delve.T` is a plain object; some files alias it as a
  function. Both styles are in use and are correct in their own files. Don't normalise
  without checking every call site in that file.
- **The floor has no hard tile edges, and the four adjacency highlights are gone.**
  Owner's request, 16 Oct. Floor shade comes from `floorTone` (a smooth, deterministic
  value-noise field) rather than a two-colour checkerboard, and each slab is rounded with a
  feathered edge over a low-contrast base — deliberately a worn-flagstone look, not the old
  near-black mortar lines. `draw()` no longer rings the player's four neighbours with a
  highlight square — nothing replaces them. Re-adding hard tile outlines or the highlight
  squares is a change of look to ask about, not a bug fix. The single path-destination square
  is the one movement aid that deliberately stays.

### Real risks, ranked
- **MEDIUM — flat namespace, ~180 `Delve.*` symbols.** A one-line math helper sits at
  the same level as `triggerVictory`. Discoverability comes from `test.html` §12.
  A `Delve.util` namespace was drafted and **rejected** — the churn outweighed benefit.
  Accepted cost.
- **MEDIUM — derived stats are split** between `attrs.js` and `items.js`.
- **MEDIUM — load order is unenforced by the runtime.** Documented and auto-checked,
  but nothing prevents it. Nine files have meaningful load-time side effects.
- **LOW — `combat.js` does three jobs**: loop + swings, kill resolution, run lifecycle.
  Down from five, and now a coherent "everything that happens when a fight resolves"
  file. Lifecycle could move to a `lifecycle.js` later.
- **LOW — `rowFor`/`onHitEffectFor` live in `combat.js` but are consumed by
  `rewards.js`.** Intentional seam; a neutral home in `state.js` would be tidier.
- **LOW — style drift.** Mixed `var`/`const`/arrow, and stale `FIX #n` comments in the
  source. Cosmetic. **Not worth a sweep** — normalising `var`→`const` across 26 files is
  churn with no behavioural payoff and real regression risk.

### A cautionary incident (why §4 rules exist)
During the project, a replacement block renamed a local array from `blocking` to `list`
without updating the two references below it. `Delve.uiBlocked()` then threw
`blocking is not defined` on every call. Because `input.js` wraps taps in try/catch, the
game kept *appearing* to work — but the overlay gate was dead, so taps passed through
open menus. `test.html` §8 caught it by aborting.

Two lessons: **replace whole functions rather than fragments when a name is involved**
(§4.7), and **be suspicious of "it still works"** when the failing code is inside a
try/catch.

---

## 9. Known bugs & open questions

**No known live defects.** Everything previously found has been fixed and is covered by
`test.html`:
- `smashBarrel` wrote `undefined` to the grid, leaving an invisible walkable hole.
- `tryAct`/`tryActOnStep` dereferenced `G` before null-checking it.
- `uiBlocked` threw `blocking is not defined` (see §8).
- **Shards were banked mid-run** (found 16 Oct, played by the owner): `killMonster`, the
  floor-clear bonus, `convertGold` and the boss bonus (then `_applyBossBonus`, removed in
  Batch 13) each wrote `Delve.save.shards`
  directly and persisted immediately, so refreshing (or the phone killing the tab) mid-run
  kept every shard earned without finishing the run — and dying cost the player nothing.
  All four now add to `G.runShards` only; `bankRunShards()` commits at a commit point (§6.10).
- **Rests never refilled** (found 16 Oct while building the run checkpoint): `G.restCount` was
  set to 0 on `newRun` and **never reset again** — `descend()` and `genFloor()` both left it alone
  — so `tryRest` refused every rest after the first `restPerFloor` of a *run*, while the HUD dots
  and the "No more rest available this floor" message both promised per-floor. `descend()` now
  resets it alongside `secondWindUsed` / `lastStandUsed` / `floorCleared`. **This is also a
  difficulty change** — 3 rests per floor instead of 3 per run — which is what the UI already
  claimed. If per-run rests were the real intent for balance, the honest alternative is to rename
  `restPerFloor` and change both messages, rather than leave the interface lying.
- The boss intro swallowed input for 3 seconds.
- A secret room could leave a phantom false-wall pulse on the next floor — `genFloor`
  now resets `G.floorData`.
- Several entry points (`smashBarrel`, `tryRest`, `collectGold`, `descend`,
  `killMonster`, `openChest`) read `G` unguarded; all now bail on a null `G`.

**Open question — never root-caused:** the historical "can't move" bug. Candidates were
a stale cached script on the phone, or `pointerdown` not reaching the canvas on that
browser. Mitigations now in place: all tap errors caught and flashed, fallback
`touchstart`/`mousedown` listeners, the `?diag=1` overlay, `Delve._lastBlockers`, and
`test.html` §8 as a standing regression test. If it recurs, `?diag=1` names the culprit.

---

## 10. Debugging, verification & workflow

### Tools

| Tool | Purpose |
|---|---|
| `test.html` | The test suite. 12 sections. **Must be served over http** — it uses synchronous XHR and fails from `file://`. |
| `?debug=1` | In-game debug panel: floor jump, gold/shards, status effects, elite, XP, shop, victory, death, re-render, dump stats, reset save. |
| `?diag=1` | Tap-diagnostic overlay: finger coords, resolved tile, player tile, `ts`, camera, `G` state, which overlay is blocking, combat/targeting state, and the element under the finger. |
| `?v=N` | Cache-buster for `index.html`. **Always use a new N after an upload.** |
| `Delve.missingEls` | Ids `ui.js` looked for and didn't find. |
| `Delve._lastBlockers` | Which overlays blocked the most recent tap. |

**Flag syntax:** the first flag uses `?`, every one after uses `&`.
`index.html?v=16&debug=1` — **not** `?v=16?debug=1`.

**URLs:**
```
Game:  https://<user>.github.io/underward/index.html?v=16
Tests: https://<user>.github.io/underward/test.html
```

### Test suite sections

| § | Checks |
|---|---|
| 0 | Every file loads, per-file new-symbol count |
| 1 | `FILES[]` matches `index.html` scripts **in order**; flags duplicates and comment false positives |
| 2 | No duplicate `Delve.*` definitions (single ownership) |
| 3 | Required functions and objects present, **plus an ownership assertion** for symbols that moved |
| 4 | All content registries; every band weight maps to a real roster row; every ability has `data`; **every shard-tree node type is one the engine consumes** |
| 5 | Every `BOSS_DEFS.sprite` is registered and actually built |
| 6 | Save schema complete; a persist() round-trip preserves node purchases |
| 7 | 50 floor generations across all built wards; spawn safety; boss floors contain nothing but the arena |
| 8 | Movement regression: `tryAct`, `tryRest`, `findPath`, `stepPath`, `uiBlocked` gating, **and null-`G` safety across 9 entry points** |
| 9 | DOM integrity via `missingEls`, split into **real** dead references (an id no page has) versus the **test fixture** lagging `index.html` (the game page has the element, this page's `#fixtures` block doesn't) |
| 10 | Tier rolls return 1–4 and stay mostly common/uncommon, **plus** the legendary weight curve is positive on floor 1 and rises with depth and with Luck |
| 11 | Summary (green/red counts) |
| 12 | Live ownership registry (key → first defining file) |

### Two failure signatures worth memorising
- *World draws, HUD works, taps do nothing* → check `Delve._lastBlockers` and
  `Delve.missingEls`. It's an overlay or a dead file.
- *A whole file's features are missing* → an unguarded load-time throw killed the rest
  of that file. Check the console for the first red line.

### Workflow after any edit
1. Upload the changed file(s). **If a function moved, upload both files together.**
2. Open the game with a **new** `?v=N`.
3. Run `test.html`. All 12 sections should be green.
4. Check **§12** to confirm a moved function's owner actually changed. §3's ownership
   check also covers the move-prone symbols.
5. If a section goes red, paste it — the failing section names the file.

---

## 11. Open work

**Content — the main remaining work:**
- **Arena dressing (done).** Braziers are derived from `G.bossArena`, and props now come
  from `CONFIG.DRESSING` by way of `G.decor` — banners, pillars, chains / roots / icicles,
  rubble, bones and an entrance feature. Never tiles, never blocking, never tappable, so
  movement, pathfinding and the tap chain are untouched. Any remaining work here is
  purely more art: further prop kinds, or per-ward silhouettes.
- **Per-ward arena geometry.** No ward sets a `bossArena` block yet, so all three wards use
  the same proportional chamber. Varying it per ward is a data-only change (§6.6).
- Small tidy-up (done): `bossArenaPadding` sat on all three `WARDS` entries and was read by
  nothing — the generator uses `ward.bossArena.pad` — so it is gone. The earlier tidy-up
  pass did the same to the inert floors 10/20 boss bands and the dead decor loop.
- **More biomes.** The plan is ~10 wards / 100 floors, each with its own look and boss.
  Loot already scales by depth with no ward count baked in (§7), and `con-biomes.js` holds
  the per-biome knobs (`treasureChance*`, `secretRoomChance*`, `lootRarityMult`,
  `special`). **Ward 3, The Frosted Vault (21–30), is built** — palette, six monsters,
  boss `boss_tempest`, Chill, and its own special-floor plan. Ward 4+ is new content
  only: follow §7's "Add a ward" recipe.
- **Trait pool.** 16 passives is thin — a run offers ~7–9 level-ups, so most of the pool
  appears in every run. Planned: ~8–10 more passives, make the `rarity` labels actually
  weight the draw (they're decorative today), and fix the "offer a unique" block in
  `traits.js` (it writes a random slot twice).

**Confirmed correct but worth noting:**
- `test.html` §3's `EXPECT_OWNER` map is a **maintenance cost**: every future function
  move needs a matching line, or §3 goes red and looks like a regression. That's
  deliberate — it's the check that catches a misfiled function — but if the friction
  outweighs the value, trim it to the move-prone keys only.

**Optional, low priority:**
- Move `rowFor`/`onHitEffectFor` from `combat.js` to `state.js`.
- Extract run lifecycle (`endRun`, `retreat`, `die`, `triggerVictory`) into a
  `lifecycle.js`.
- Root-cause the historical "can't move" bug (§9) if it ever recurs.

**Ideas discussed but not built:**
- Ability overflow UI — `addAbility` currently drops the oldest silently.
- More wards beyond floor 20.
