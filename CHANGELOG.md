# Changelog

All notable changes to underward. Format loosely follows Keep a Changelog.

Code comments used to carry this history inline ("Batch 17", "FIX #1", "REMOVED
on 16 Oct", "migrated from combat.js fallback", "owner batch B1"). Those notes
have been consolidated here so the source files describe *invariants* rather
than narrating their own past.

---

## [Unreleased]

### Changed — the Frosted Vault's walls are deep violet

- **The owner's report:** the walls sat at nearly the same shade as the floor, so the whole
  ward read as one surface and the new frost growth had nothing to stand against.
- **Violet, and much darker.** The Vault's wall palette moves from blue-grey to deep violet:
  `wall #3b2a55`, `wallEdge #9b7cd6` (the lit crest),
  `wallBrick #1d1233` (the fracture lines) and `mortar #0a0714`.
  Wall luminance is now ~62 against the ice floor's measured ~143 — an 80-level gap, plus a
  different hue (violet has red above green; the ice floor is blue). Room shape, the ice
  fractures in the walls, and the white `C.WALL_FROST` climbs all separate now.
- **Measured, not assumed:** the frost dendrites were checked against the ice floor's
  luminance — 43% of their painted pixels read darker, 57% lighter, and **0%** land within
  ±15 levels of the floor, so they show on their own without touching their palette.
- Two tests now pin the separation: the wall must be >40 luminance darker than the floor,
  and must be a different hue (violet walls over a blue floor).

### Fixed — the green square tiles on the Blackvein's floor (for good, every biome)

- **The owner's report:** *identical squares of green* on floors 11-20, on a floor that is
  supposed to be smooth. Exactly right, and it was not the puddles (those were still the
  smooth purple blobs): it was the ward's **patch layer**. A ward's `patches` block
  turns some floor into `GRASS` tiles, and `drawGrassPatch` painted a **rounded
  rectangle over 92% of every one of those tiles**, plus three blades in the middle. One
  visible square per patch tile — a literal grid, which is the one thing the seamless floors
  exist to prevent. It had been there all along in biome 2; I removed it for biome 3's snow
  and left it standing here.
- **The painter is now a world-space mask.** `drawGrassPatch` samples a new
  `worldNoise` in **world fine-pixel coordinates** (16 px/tile grain), so the patch
  boundary is one continuous noise field that wanders across tile edges. No per-tile
  rectangle, no inset, no blades stamped dead centre; the fringe fades through a gradient of
  alphas instead of ending on a line, and the tufts only appear where the mask is on.
- **It fixes every biome at once**, not just this one: the Bone Ossuary's bone-dust patches
  (22% of its floor) were square for the same reason.
- **Pinned by tests:** a GRASS tile must issue more than 40 paints (a per-tile rect is 1),
  no single paint may cover half a tile, and the patch must use more than one alpha — three
  checks that would each have failed on the old painter.

### Changed — the Blackvein's mycelium is ivory webbing, not green

- **The owner's note:** *it currently looks the same colour as moss from biome 1*.
  Correct, and there were two causes. The palette was olive/yellow-green
  (`#2b3520 … #dfe9a8`), a shade away from the Ruins' moss; and the shape was a
  handful of near-parallel strands, which is what a moss patch looks like.
- **Ivory palette.** `BIOMES[1].growthVeinPal` is now
  `#3a3227 → #6f6449 → #a89b75 → #ddd2ae → #f6efd8` — a dark root under the soil
  running to near-white tips, the way real mycelium is colourless cream. No shade is
  green-dominant, and a test now asserts exactly that so it cannot drift back.
- **The floor's own filaments were green too.** The dirt style's mycelium threads borrowed
  `b.moss`, so they were yellow-green by default. They now read
  `BIOMES[1].growthThread` (`#ece4c6`), so soil threads and growth agree.
- **Webbing instead of a spray.** A colony is now 3–5 primary filaments fanning out of the
  anchor, each forking 2–3 times, plus **cross-links** between filaments near the base —
  straight 1-px bridges at lower alpha. A soft dithered cream mat sits at the wall base
  (about 1.5 tiles across) and the fringes stay open threads, which is what makes it read
  as a cobweb colony rather than a stain. Measured: ~7% of the colony canvas painted, with
  roughly a third of that in the mat.

### Changed — the Frosted Vault: a seamless ice floor, ice walls, hoarfrost growth

- **The owner's report:** clearly segmented floor tiles, a white snow tile repeated over
  and over, and small white marks scattered on tiles. All three were real: biome 3 had no
  `floorStyle` (so every tile drew its own rounded slab), the snow was a
  grass-style patch stamped whole-tile with its blades, and the marks were the frost weed.
- **Seamless "ice" floor (owner's pick: rune-lit glacial crystal).** A new
  `BOND_STYLES.ice` bakes a continuous glacial sheet into the same 16-px/tile 3x3
  torus that biomes 1 and 2 use: large pale panes, a network of wandering dark fractures
  (domain-warped so they never run dead straight) with a pale refracted sheen, and rare
  blue rune-light seams. Like the dirt field it **skips** the per-tile `floorTone` overlay,
  which is the last thing that could have re-introduced a square per tile.
- **The repeated snow tile is gone.** Ward 3's `patches` is now empty, so no GRASS
  tiles (white rounded square + blades) are painted there at all; pale ice sheets still
  come from the wall-fed puddles.
- **Ice walls.** New `wallStyle:"ice"` replaces the masonry brick course with
  vertical fracture lines whose positions are smooth functions of the tile, so a wall mass
  reads as one cracked ice sheet instead of a stack of stones, with a hoar-frost highlight
  down the lit side of each crack. Any biome without `wallStyle` keeps its old walls
  byte for byte.
- **Hoarfrost growth (owner's pick: crystalline frost branches).** `js/growth/frost.js` is
  the Vault's own form: 2-3 fronds fan out of a wall base or corner as runs of straight
  1-px struts joined by discrete turns, forking at crystal angles up to three deep and
  ending in points. It has its own blue-white palette (`growthFrostPal`) and its own
  climb art (`C.WALL_FROST`). Biome 3 now names `growthStyle:"frost"` and ward 3
  carries a `growth` block, so floors 21-30 grow frost where they grew nothing before.
- **Checked, not guessed:** the baked floor is pale (mean brightness ~152, only ~14% of
  pixels dark enough to be a seam), a real generated floor 25 grows and bakes frost, and
  every growth form still paints only on plain floor.

### Changed — growth is one form per biome, and biome 2 finally has its own

- **The owner's report:** *biome 2 uses the same moss as biome 1*. It did — one
  hard-coded blob served every ward, with only the palette changed.
- **One file per form.** `js/growth.js` is now `js/growth/core.js` (the
  framework: rooms, anchor bias, bake cache, wall climbs, both draw seams) plus
  `js/growth/moss.js` and `js/growth/mycelium.js`. A biome names its
  form with `BIOMES[n].growthStyle` and the form registers itself through
  `Delve.registerGrowthStyle`, so a new biome's growth is a new file and one
  string — no branch inside the framework. A biome with no registered form grows
  nothing, and the browser suite now says so instead of letting it pass silently.
- **Ward 1 is untouched.** The moss form is the old code moved, not rewritten: the
  same anchors, the same seeds and pixel-identical bakes (verified by running the old
  file and the new one under one seeded RNG and comparing every image byte).
- **Biome 2 grows mycelium veins.** A colony is 1–9 thin strands that leave a wall or
  corner, wander, fork up to three deep and taper to single-pixel tips; roughly one in
  six curls into a fairy ring. Each colony rolls its heading, curl, branching rate,
  width and reach, so shapes vary deliberately. Strands are stamped pixel by pixel at
  16 px/tile, clip to plain floor, and the tiles they cross decide which walls get a
  climb. It has its own paler palette (`growthVeinPal`) and its own climb art
  (`C.WALL_MYCELIUM`) instead of the Ruins' leafy stems.
- **Same rules for every form:** only plain FLOOR takes paint, growth never enters the
  grid or the run snapshot, a floor re-rolls it on generation, and a wall only climbs
  where a floor colony touches it.

### Fixed — the bag badge counted loot on the floor, so it never went away

- **It was counting the wrong array.** `updateHUD()` built the badge from
  `G.items.length` — that is loot lying on the **floor**, not the bag
  (`G.inventory`). So a single drop anywhere on the level put a permanent
  "1" on the button, and equipping the item you had just picked up changed nothing.
  Exactly what the owner saw.
- **The badge now means "new in the bag".** Every path that puts an item in
  `G.inventory` sets `it.isNew = true` (`pickupItem`, the
  floor item card, the heirloom, the hub's Quartermaster and both Provisioner nodes).
  `updateHUD()` shows `Delve.unseenCount()`; opening the inventory
  calls `Delve.markBagSeen()`, and equipping an item clears its own flag, so
  the number cannot stick. 0 hides it (CSS, unchanged).
- **The title keeps the real bag.** The tooltip is now `Inventory 3/16 — 2 new`,
  so capacity is still one hover (long-press) away.
- **The flag is UI state, not data.** `save.js`'s `cleanItems` strips
  `isNew` on the way in and out, so a resumed run cannot come back with a
  stale dot.
- **A dead test is live again.** `test_items.js` guarded the v3 to v4 sanitise
  check behind `D.__testSanitizeRun`, which nothing ever defined — the two
  checks silently never ran. `save.js` now exposes the hook.

### Added — background music, one bed per ward

- **The music is real now.** `music/biome1-1.mp3` … `biome4-1.mp3` are in the repo (the
  four files the owner uploaded), and `sfx.js` plays them: floors 1–10 use biome 1, 11–20
  biome 2, 21–30 biome 3, 31–40 biome 4 — taken from `getWard`, so the mapping needs no
  floor list of its own.
- **Arrays, not a single file.** `MUSIC_TRACKS` holds an array per ward and each loop picks
  one at random, never repeating the track that just played. Dropping in
  `biome1-2.mp3` later is one string; the CI check (below) will then require that file too.
- **No HTML5 `loop`.** The element's `loop` is explicitly `false`. A `timeupdate` handler
  starts a **2-second fade-out** at the end of the track; on `ended` the next bed is picked
  and faded **in** from silence over 1.2 s. A ward change cross-fades over 700 ms.
- **Mute and the slider still work.** The element sits outside the WebAudio graph, so the
  music volume is mirrored from `prefs.music` and the global mute:
  `sfxToggleMute()` and `musicSetVolume()` both call `applyMusicVolume()`. Autoplay blocked
  before the first gesture is retried on the next `pointerdown`.
- **CI:** `music/**` now triggers the workflow, and a new "Music beds are present" step
  reads every `.mp3` path out of `MUSIC_TRACKS` and fails if one is missing or empty — a
  renamed upload would otherwise only show up as silence on the phone. The zip/unzip
  workflow needed no change (its `tar` copy has no file-type filter). Copies of both
  workflow files, with a short upload note, are in
  `/sdcard/underward-workflows/` for manual upload.
- **Verified:** `test_ui` 265 → 274 (a bed for every ward, every bed present and non-empty,
  the four floor→ward mappings, the three entry points, start/ward-change/stop safe with no
  audio implementation, and `.loop = false` + restart-on-`ended` pinned), `test_items`
  274/274 and 84/84.

### Added — floor events, ambushes, and an heirloom

- **Floor events.** Roughly 45% of non-boss floors now hide one prop on plain floor:
  a **Forgotten Shrine** (heal 35% / +4 max HP this run / +8 shards), a **Bone Wager**
  (pay `20 + 2×floor` gold for a 60% shot at an item two tiers up), or a **Blood Altar**
  (pay 25% max HP for an unlearned ability, or for 14 shards). Walk onto it to open the
  card; **Step away** leaves it there for later, and an option you cannot afford is shown
  disabled. It never lands on a boss floor, a shop floor, or within five tiles of the
  entrance, and it is placed after every tile and prop so it cannot displace anything.
  `js/content/con-events.js` holds the data; `js/encounters.js` holds the rules; the prop
  is primitives in `render.js`, tinted by the kind's `accent`.
- **Ambushes.** Resting has a 12% chance, and opening a chest 18%, that one enemy (two from
  floor 15, 35% of the time) arrives two or three tiles away. Capped at two per floor,
  never in combat, never on floor 1 or a boss floor. Chest contents resolve **before** the
  roll, so an ambush can never take what you just found. Ambushers are built by the same
  spawner the floor uses (`Delve.spawnMonsterAt`), so they level, drop and behave normally.
- **Heirloom.** Death now offers one carried or equipped non-consumable to keep. It is
  stored in `save.heirloom` and returned to the bag by a `runStart` hook at the start of
  the next run, then cleared — consumed on the way in, never duplicated. Retreating offers
  none. The picker lives inside the existing death screen, so no new overlay was added.
  `save.js` validates it with the same item-schema rule as the bag.
- **HUD/wiring.** `G.maxHpBonus` is run-only health from a shrine; `attrs.maxHp()` adds it
  and it is in `CHECKPOINT_FIELDS`, so a resumed floor keeps it. `eventScreen` joins
  `hideAll()` and `uiBlocked()`; all seven new ids exist in `index.html` and in
  `test.html`'s `#fixtures`.
- **Verified:** manifest and `index.html` at **42 scripts** (`tools/check-order.js` green).
  34 new checks in `test_ui.js`: placement distance and kind, boss/shop/floor-1 exclusion,
  open / step away / resolve / used-once, healing, +4 max HP, blood-altar HP→shards and
  HP→ability, disabled wager, ambush distance and per-floor budget, the heirloom runStart
  hook, and the whole heirloom cycle (offer on death, store, claim, consume, no offer on
  retreat). `test_ui` 220 → 254.

### Fixed — top-edge rooms, and an inventory that could not scroll

- **A room touching the map's top edge looked uncapped.** The grid was already sealed
  (`levels.js` forces the outer ring to wall and fills interior void holes), so the wall
  was there — it was behind the status strip. The camera clamps to row 0 at the top, which
  put the wall row *under* the HUD, and a room with no visible stone above it read as open
  sky. The board now owns only the space between the chrome: `#app` is padded by
  `--hud-h` (measured from the real HUD) and by `--ui-bottom-px` (measured from the bag row
  and the ability bar), the canvas is the only child in normal flow, and `Delve.resize()`
  measures the **canvas** instead of `window.inner*`. Two `ResizeObserver`s rewrite those
  two variables when the strip wraps or abilities appear, then re-fit the board.
- **The player could stand behind the new bottom-right buttons.** Same cause, same fix: the
  reserved bottom band is `max(52px, 58px + ability-bar height)`, so no control covers a
  tile — the last row of the map ends above them.
- **The inventory could not scroll.** It is the tallest screen (character figure, equipment
  rack, then every carried item), and it was a flex column with no `overflow` — the carried
  list ran off the bottom, so items could not be opened to consider equipping them. Now
  `overflow-y:auto` with a sticky header (✕ stays reachable). `#levelupScreen`,
  `#victoryScreen`, `#deathScreen` and `#eventScreen` got the same treatment, since each can
  outgrow a short phone.
- **Verified:** `test_ui` 262 → 265 (a finite, non-zero viewport after `resize()`, `#app`
  inset by both measured variables, `#inventoryScreen` scrolling), `test_items` 265/265 and
  84/84, `check-order` green.

### Fixed — the 🎒 was off the edge of the screen (HUD actions moved to the bottom)

- **The bug.** `#hudMeta` was a single non-wrapping flex row in which every child was
  `flex-shrink:0`; `.spacer` was the only flexible item. Once the FLOOR label and the 💤
  rest chip were added, the row measured roughly 450px of fixed content while a phone
  offers 344–396px, so the tail of the row — ⚙ and 🎒 — was painted past the right edge and
  clipped by `body{overflow:hidden}`. The inventory was unreachable.
- **The action cluster.** 📊 📍 ☰ 🎒 now sit in `#hudActions`, in the **bottom-right** at
  44×44px, where a thumb reaches without regripping. It is a sibling of `#hud` inside
  `#app`, positioned against the app box rather than the top strip. Because it is no longer
  a child, `Delve.setHudVisible(on)` now owns both elements and every screen change goes
  through it (`startRun`, `resumeRun`, `showHub`, `hideHub`, `showTitle`, `closeShop`, the
  victory continue) — otherwise the cluster could stay on the title screen.
- **Top row is status only** — FLOOR, rests, 💰, 💎 — and `#hudMeta` gained `flex-wrap`, so
  a narrow phone can never push a chip off-screen again. Approximate width: 450px → 302px.
- **The bottom edge is the visible viewport, not the layout viewport.** `#app` now sets
  `height:100dvh` (with a `100vh` fallback), `Delve.resize()` measures that box instead of
  `window.innerHeight`, and a `visualViewport` resize listener re-fits when a phone's URL
  bar collapses. Before this, the board and everything anchored to the bottom edge could
  sit under the toolbar.
- **Nothing floats over a control any more.** The minimap panel moved from a bottom-right
  float to just under the HUD (`top:calc(var(--hud-h) + 8px)`, where `--hud-h` is measured
  by a `ResizeObserver` on `#hud`), so a wide ability bar can never sit beneath it. The
  ability bar itself keeps wrapping and **scrolls** inside `max-height:34vh` — more
  abilities than fit are reachable by scrolling, as before.
- **The bag button shows its load** (`#invBtn::after`, `content:attr(data-bag)`, hidden at
  0) and its title carries `n/cap`, written in `updateHUD`.
- **`#statsBtn` was never styled.** It was left out of the `#invBtn, #minimapBtn, #gearBtn`
  selectors when the character sheet was added, so 📊 rendered as a raw UA button that
  matched nothing beside it. All four buttons now share one rule.
- **Safe-area was on the wrong edge.** `padding:6px 8px env(safe-area-inset-top,0px)` puts
  the *bottom* slot at the top inset, so on a notched display the bars began 6px from the
  glass and the notch padding was reserved at the bottom. Now
  `calc(4px + inset-top) / 8px+inset-right / 6px / 8px+inset-left`.
- **Bottom edge re-shuffled** so nothing overlaps: the 📜 pill moved to the bottom-left, the
  ability bar to `bottom:58px` (clear of both the pill and the 44px cluster).
- **The map button lights while its panel is up** (`#minimapBtn.active`), via a new
  `Delve.setMinimapOpen(open)` that both `showHub()` and `showTitle()` use, so the button's
  state cannot drift from the panel. A tap that opened a dark panel over a dark tile used to
  read as "the button did nothing".
- **Verified:** `test_ui` 254 → 262 (lit state on/off, no action button back in the status
  row, the four buttons inside `#hudActions`, the cluster hidden with the HUD, the bag
  count and its title), `test_items` 262/262 and 84/84, exit 0. The `test_items` DOM stub
  gained `classList.toggle` and `dataset`, without which `ui.js` no longer loaded.

### Changed — the HUD is three bars; the stats moved into a character sheet

- **The top bar is now health, energy and experience — nothing else.** It carried eight
  attribute chips (HP, ATK, TOU, AGI, LUC, floor, energy, gold, shards) across the top of the
  play area. Now each is a bar: **HP** (`hp/max`), **energy against the cap** — so the bar
  answers "can I afford this cast?" by itself — and **XP toward the next level**, with the
  level number beside it. Floor, rest dots, gold, shards and the buttons stay in a slim row
  underneath.
- **New character sheet (📊)** holds everything that left the bar: attack, weapon damage
  range, crit chance, attack speed, max HP, damage reduction, dodge, luck and merchant
  discount — plus your passives with their ranks and tag set progress (`Edge 2/6`). It is
  read while standing still, so it may use the whole screen. It blocks map taps while open
  (`uiBlocked()`), is closed by `hideAllScreens()`, and exists in both `index.html` and
  `test.html`'s fixtures.
- **`Delve.xpToNext()`** added in `traits.js`, so the XP bar uses the exact number the
  level-up loop uses rather than recomputing it.
- **The floor chip is labelled.** It used a 🗺️ emoji, sitting a few pixels from the 📍
  minimap button — the owner read it as a second, broken map button. It now reads
  **FLOOR 3**. The three bare rest pips beside it (7px dots, one per rest charge) are now
  inside a chip with 💤 and a `title`, because unlabelled dots read as punctuation and
  nothing about them said "tap your own tile to rest". Neither was ever a button; now
  neither looks like one.
- **A flaky check in the suite, fixed.** The passive rank-up test granted a fixed amount of
  XP per pass; once the level rose that stopped clearing the threshold, so the loop re-read
  the same stale cards and failed — intermittently, and only when the gate was run without
  piping. It now grants `xpToNext() + 5` each pass and passed 25 consecutive runs.
- **Verified:** 22 new checks — the three fills track HP/energy/XP, the sheet opens, lists
  every stat, shows passive ranks and set progress, blocks taps, the old attribute ids are
  gone from the markup, and the floor/rest chips are labelled. `test_ui` 198 → 220.

### Changed — passives: 12 ranked lines, 4 tags, set bonuses

- **Passives are ranked.** Each of the 12 lines has three ranks: picking a line you already
  own offers `Sharpened Edge II` instead of a duplicate, and a maxed line leaves the pool.
  `effects` is rank I, `perRank` is the step, and `traitBuffs()` scales by rank. That turns
  the same card into a build decision rather than a fresh flat number.
- **Four tags, with set bonuses.** Edge (offence), Iron (survival), Blood (sustain), Greed
  (economy). A bonus triggers at **3 and 6 total ranks** in a tag, counted in ranks rather
  than in lines — one line at rank III advances its set as far as three different lines.
  Edge 3: +1 attack · Edge 6: +10% crit · Iron 3: +2 flat reduction · Iron 6: +12 max HP ·
  Blood 3: +1 HP per kill · Blood 6: +2 energy per kill · Greed 3: +8% gold · Greed 6: +4%
  item find.
- **Two passives did nothing at all.** `traitBuffs()` aggregated `speedBonus` and
  `healOnKill`, but only *item* buffs were ever read for those keys — so **Swift Hands
  (+15% attack speed)** and **Bloodthirst (2 HP per kill)** were dead cards, which is part
  of why the list felt like it had no thought in it. Both are read now: `playerSpeed()` adds
  the trait's speed and `killMonster()` adds the trait's life-steal on top of the item's.
- **Four duplicate cards merged away.** Light Feet → Evasive, Hardened Bones → Thick Hide,
  Iron Will → the Unbroken unique (identical effect), Brute Force dropped.
- Cards show the **tag and rank** (`EDGE · RANK 2/3 · UPGRADE`), so the choice reads at a
  glance on a phone.
- **Verified:** 14 new checks in `test_ui.js` — rank scaling, every set tier, both dead keys
  reaching `playerSpeed`, an upgrade taken through the real level-up path, and a fully
  maxed pool offering only the ability card. Mutation-tested: ignoring rank scaling turns
  six checks red.

### Changed — abilities are uncapped, and there are 16 of them

- **The 3-ability cap is gone.** `CONFIG.levelMaxAbilities` is now `0` ("no limit") and
  `addAbility` appends instead of shifting the oldest away. The old behaviour silently
  deleted a choice the player had made — the item this changelog had been carrying as
  "UI surfacing deferred, not forgotten" for two tiers. It now refuses only a *duplicate*.
- **Nine new abilities, 7 → 16**, one per archetype, all built from primitives
  `castAbility` already had (`hurt`, `applyEffect`, healing, energy):
  **Crushing Blow** (2× attack on an adjacent enemy), **Rend** (strike + bleed),
  **Rupture** (heavy damage, doubled against a bleeding target), **Leech** (drain, healing
  half the damage dealt), **Venom Dart** (ranged + poison), **Siphon** (ranged + 3 energy
  refunded), **Meteor** (ranged, splashing onto the target's neighbours), **Tremor**
  (every enemy within 2 tiles) and **Brace** (heal 15%, clear poison and bleed).
- **Every level-up now offers an ability** while any remain unlearned. It used to be a 50%
  coin flip on one of three cards, so a deep run could roll nothing but passives. Card 1 is
  the ability; passives and (25% of the time) a unique fill the other two.
- **A level-up bug fixed on the way past.** The unique roll wrote a random slot *twice*, so
  it could overwrite the ability card or put the same unique on two cards. It now replaces
  exactly one of the two non-ability cards.
- **The ability bar wraps and scrolls.** Uncapped without that, it would have run off the
  right edge of a phone. `#abilityBar` is now `flex-wrap:wrap` inside a 34vh scroll area,
  with `align-content:flex-end` so the newest row sits where the thumb reaches; buttons are
  narrower and long names ellipsise.
- **Verified:** all nine new abilities are exercised in `test_ui.js` — cast, damage, status,
  splash radius, energy maths and the refused-cast path (18 new checks), alongside uncapped
  accumulation, the level-up guarantee and a 16-button bar. Mutation-tested: making
  Crushing Blow hit for 1× attack turns the suite red.

### Test coverage — the UI suite now covers all of ui.js

- **`test_ui.js` went from 18 checks to 157** and now exercises every screen and every
  binding `ui.js` owns, not just the inventory path: HUD, ability bar (cast, refuse, and
  arm/cancel targeting), stairs prompt, floor card (normal / shop / boss), boss intro, hub
  (attribute purchase, the parked-run lock, start-vs-resume), shop (buy, sell, the two-tap
  sell-all, heal, leave), victory and end screens (death / retreat / `kind=victory`), pause
  menu, mute + both volume sliders + haptics, the log window, the minimap toggle, all 16
  `?debug=1` buttons, slot unlocks, and `hideAllScreens`.
- **It also asserts its own API surface.** All 21 `ui.js` entry points must still be
  functions, so a refactor that drops `buildShop` or `resumeRun` fails here instead of in
  the player's hands.
- **Two harness-fidelity fixes were needed first, or those areas could not have been tested
  honestly.** `querySelector` now understands tag selectors, because `showEndScreen()` reads
  its own `<h1>`; and `getComputedStyle` returns the element's own `display` instead of a
  constant `"block"`, because the minimap toggle branches on it. The mock still registers
  ids without rebuilding nesting, so the one nesting the code depends on — the `<h1>` inside
  `#deathScreen` — is attached explicitly, and the markup is checked first so the test
  cannot quietly drift into a fiction.
- **Sensitivity proved, twice.** Setting the sell-all arming from `"1"` to `"0"` turned two
  checks red; letting a parked run buy hub upgrades turned one red. Both were restored and
  the suite went green again. A suite that cannot go red has not been shown to test
  anything.
- **The suite caught a bug in its own harness.** The resume check overrode
  `restoreRunFromCheckpoint` with a plain arrow: it answered `true` but never recorded the
  call, so the check failed for the wrong reason. The stub now records *and* returns.

### Fixed — tapping an item in the inventory did nothing

- **The item card never opened, so gear could not be equipped.** `showItemCard()`
  found its lazily-created sprite canvas with `$("icSprite")`. That helper
  returns a *truthy* stand-in when an id is missing — deliberately, so one
  absent element cannot crash the whole file — so the `if(!spr)` guard never
  fired, the canvas was never built, `getContext("2d")` returned `null`, and
  `sctx.clearRect(...)` threw. The handler died before reaching the
  `overlay.style.display = "flex"` line at the end, so a tap appeared to do
  nothing at all. The lookup now uses `document.getElementById`, and the 2d
  context is null-checked.
- **`nullEl()` stand-ins are marked `isStub: true`.** A stand-in is truthy, so
  `if(!el)` is not a valid existence test against `$()`. The marker lets a
  caller say what it means; `menu.js` was checked and has no such test.
- **`test_ui.js` added — the first suite that clicks anything.** It builds a DOM
  from the real `index.html` (every declared id becomes a live element with
  working `addEventListener`, `onclick`, `appendChild`, `insertBefore`, and
  `innerHTML` that clears children), loads all 37 scripts in page order, then
  opens the inventory, taps an item, equips it, re-reads the rack, and repeats
  the tap across 40 random items. Every other suite stubs `document` down to one
  generic object, which is exactly why this bug passed all of them.
  `test_items.js` now runs it as a second gate, so `node test_items.js` still
  remains the single pre-ship command.

### Fixed — the title screen lost its font

- **`css/game.css` pointed at `fonts/*.ttf`, which resolves to `css/fonts/*.ttf`
  and 404s.** Extracting the CSS out of `index.html` silently changed what every
  `url()` inside it means: inline styles resolve against the page, external
  stylesheets resolve against themselves. The three `@font-face` sources now use
  `../fonts/` and load. Nothing threw — a missing font is not an error, the
  browser substitutes a system face and carries on, which is why this looked
  like "the font changed" rather than "the font broke".
- **`@font-face` weight descriptors changed from `400 900` to `400`.** A weight
  *range* is variable-font syntax, and these three files are static TrueType
  (no `fvar` table), so the range invited the browser to synthesise weights the
  font does not contain.
- **`tools/check-order.js` now resolves referenced assets**: every `url()` in
  `css/game.css` (resolved from `css/`) and every `<link href>` in `index.html`
  (resolved from the page). Verified the new check fails on the old path and
  passes on the new one.
- **Font fallbacks are unchanged** — `"UwTitle", system-ui, sans-serif` — so if a
  font ever fails again the screen still reads, just in a system face.

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

### Restructure — Phase 2 (no behaviour change)

- **`js/gen/bsp.js` extracted from `js/levels.js`.** The floor-plan geometry —
  `splitRect`, `splitAt`, `intersectLine`, `edgeKey`, `graphPath`, `distFrom`,
  `dijkstraPath`, `paintRoom`, `tryMerge`, plus the `BSP_MIN`/`BSP_MAX`
  constants — moved out verbatim. Every body is a character-for-character copy,
  and `levels.js` destructures them back into local names, so **no call site
  changed**.

- **`js/gen/bossarena.js` extracted from `js/levels.js`.** `dressBossArena` (76
  lines) and `Delve.genBossFloor` (91) moved out verbatim — 184 lines counting
  their section comments, and `diff` confirms the copy is character-identical.
  `Delve.genBossFloor` keeps its public name, so **no call site moved**;
  `dressBossArena` is re-exported as `Delve.gen.dressBossArena` and destructured
  back, the same pattern the BSP geometry already uses. `levels.js` is now
  **838 lines**, down from 1155 when Phase 2 started.

- **A correction to the earlier estimate.** This changelog previously recorded
  `dressBossArena` as "~600 lines, called from exactly one place" and deferred it
  partly on that basis. It is 76 lines. The ~600 came from the span between two
  top-level `function` lines, which also contains `Delve.genBossFloor` **and**
  `genFloor` — and `genFloor` (443 lines) is the dungeon generator, which stays.
  The real arena seam is 167 lines, with no shared closure state at all.

- **Why these two seams were taken first.** Both are blocks with no shared
  closure state: the functions are pure, and read only `Delve.rng`, `Delve.T`
  and `Delve.CONFIG`, all resolved at call time.

- **Equivalence proved by diff, not by "tests pass".** A boss floor contains no
  randomness — the only random calls nearby are `placeGroundCover` and
  `placeGrowth`, reached through `Delve.*` and stubbed for this purpose — so the
  old and new code could be run side by side and compared. For floors
  10/20/30/40, the arena geometry, player spawn, every boss stat, all **108 decor
  props** and a hash of the grid are **identical**. Rendering was compared the
  same way against the pre-change code in a throwaway copy of the repo: floors 10
  and 11 give identical samples, luminance, colour counts and seam counts.
  This exists because the two silent regressions above ("tapping an item did
  nothing", "the title screen lost its font") both passed a green suite.

- **`test.html`'s `EXPECT_OWNER` updated** for `genBossFloor` →
  `js/gen/bossarena.js`. That map exists to catch a move that was reverted, or a
  definition duplicated into the wrong file — so moving the function meant
  changing the map deliberately. The value is that it can see the move at all.

- **`js/itemgen.js` extracted from `js/items.js`.** The whole construction model —
  `qualityOf`, `bandOf`, `pointsOfQuality`, `statPoints`, `itemPoints`, `rollSlot`,
  `rollAffixes`, `affixText`, `affixName`, `makeGear`, `makeItem`, `makeUnique`,
  `rollUnique` and their private helpers — moved out verbatim: 314 lines, and
  `diff` confirms the copy is character-identical. `items.js` keeps the *runtime* side of an item
  (pricing, selling, pickup, equipping, consumables, shop stock, stat lines) and is
  now **575 lines**, down from 890.

- **The seam was cleaner than this changelog predicted.** It warned that the
  item-rolling helpers "share module-level helpers" and so would need "an
  intermediate shared module". Measured, that was **two** names, not seven: the
  construction block uses *nothing* from the rest of `items.js`, and only `IT()` and
  `FAM()` are needed back — by the drop roll, both price functions, and the
  weapon-speed line on the item card. They are exported on `Delve.itemGen` and
  destructured. Public `Delve.*` names are unchanged, so no call site moved.

- **Equivalence proved with a seeded PRNG, because randomness hides drift.**
  Item generation is heavily random (`Math.random`, plus `gauss()` on top of it),
  so a plain before/after comparison means nothing. With `Math.random` replaced
  by a seeded generator, the old and new code run an identical call sequence and
  **all 715 results match** — items, affixes, points, prices, shop stock, drops.
  Because the sequence of random draws is identical too, a reordered modulo or a
  helper that lost a roll would show up immediately. 98 distinct items across all
  four tiers were compared, with zero exceptions on either side.

- **The harness was then shown to be sensitive, not vacuous.** A one-character
  mutation (`+ 1` on the quality roll) changed **167 of 715** results. Worth
  recording: the *first* mutation tried changed nothing at all, because it edited a
  `|| 0.2` fallback whose real value comes from `CONFIG`. Fallback edits are
  invisible.

- Verified after all three moves: 39-script manifest consistent, `test_items` 84/84,
  `test_ui` 18/18, 0 interior void gaps, 0 border leaks over 20 floors, all four
  boss floors (10/20/30/40) generate and render, dirt texture unchanged at 298
  colours.
  **Correction (Phase 3):** the void-gap and border-leak scanners were *not* actually
  re-run after the `itemgen.js` move. They still carried hardcoded file lists from
  before it, so they aborted on load, and the figures above were inherited from the
  earlier runs rather than re-measured. Both were repaired in Phase 3 and genuinely
  re-run: **0 interior void gaps over 40 runs, 0 border leaks over 20 floors** — so
  the claim is true, but it was not verified when this entry was written.

### Restructure — Phase 3 (no behaviour change)

- **`js/render/tiles.js` extracted from `js/render.js`.** The tile atlas — the offscreen
  per-tile cache (`tileCache`, `ensureCache`, the arena-torch set), every per-tile painter
  (`tileAt`, `isTorchTile`, `blitTile`, `drawFloorTile`, `drawWeed`, `drawClutter`,
  `drawWallTile`, `drawWallShadows`, `drawDoorTile`, `drawGrassPatch`, `drawWallTorch`,
  `drawStairs`), the seamless-floor texture bakers (`texHash`, `floorTone`, the 48×48 torus
  bakes and their `BOND_*` constants) and `biome()` — moved out verbatim: **646 lines,
  byte-identical** to the `render.js` lines they replaced, established by comparing the
  strings rather than by reading the diff. `render.js` is now **673 lines**, down from 1311
  (`wc -l`, both counted the same way).

- **The seam was chosen by measurement, not by eye.** A scanner listed every top-level
  function in `render.js` alongside the closure variables it touches. That is how per-frame
  state was separated from drawing: `recoils`, `lunges`, `floaters`, `deaths` and `shakeT`
  stay in `render.js` (they belong to entity drawing and the animation clock), while
  `tileCache`, `arenaSrc`, `bondKey`/`bondTex` and `torchFrame` all sit inside the tile block
  and travelled with it. Two facts came out that reading would not have given: `blendHex` is
  declared at line 1259, *after* the painters that call it (it works only because they run
  later), and `torchFrame` is read by the torch painter but incremented by the clock.

- **Exactly one write crosses the seam.** `torchFrame` is now tiles.js's own state, advanced
  by `Delve.tiles.tickTorch()` — a single call replacing `torchFrame=(torchFrame+1)%3` in the
  150ms clock. `biome()` moved as well (the painters were its only callers besides `draw()`),
  so `render.js` aliases it and its call sites are unchanged. Everything else is destructured
  into the same local names, so no caller line in `render.js` moved.

- **Equivalence proved operation-for-operation, not by spot-checking pixels.** A recording
  canvas logs every 2D call `draw()` makes — method, arguments, and every property set such
  as `fillStyle` — then hashes the log. With `Date.now` pinned and `Math.random` seeded, two
  runs of the *same* code already agree bit-for-bit (checked first: a comparison that cannot
  reproduce itself proves nothing). Across **floors 2, 5, 10, 11, 15, 20, 25, 30, 35 and 40**
  the before and after logs are **identical** — 6,000–12,500 operations per floor. The baked
  texture is unchanged too: floor 11 still reports **298 distinct colours** and the same
  near-zero wrap seams.

- **The harness was shown able to fail — which exposed a blind spot.** Changing one hash salt
  in `floorTone` changed the op hashes on floors 2 and 10 but **not floor 11**: that floor is
  the `dirt` style, which returns before it ever reaches `floorTone`. A single-floor check
  would have called the mutation harmless. So the comparison deliberately spans both a
  masonry ward and a dirt ward — the Phase 2 lesson (a mutation that changes nothing) in a
  subtler form.
  Related rot: the old `render_smoke.js` carried a **hardcoded file list** that predated
  Phase 2 and no longer ran at all, because it was missing `itemgen.js`. Anything listing
  files by hand goes stale; the new harness reads `js/manifest.js`.

- **Two more stale harnesses repaired.** `scan_void_gaps.js` and `verify_border.js` also
  carried hardcoded file lists from before Phase 2 and no longer loaded. Both now read
  `js/manifest.js`, so they cannot go stale again.

- Verified after the move: 40-script manifest consistent, `test_items` 84/84, `test_ui` 18/18,
  all 40 scripts run against the real markup, tile and floor paint identical on 10 floors,
  0 interior void gaps over 40 runs, 0 border leaks over 20 floors, all four boss floors
  (10/20/30/40) identical, dirt texture unchanged at 298 colours.

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
