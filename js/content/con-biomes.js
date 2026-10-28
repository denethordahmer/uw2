window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-biomes.js : biome visuals + ward (floor-band) rules ──

 C.WARDS = [
  { id:1, name:"Upper Ruins", floors:[1,10], biome:0,
    // Organic patches (layer1 port): cellular-automaton GRASS blobs painted over
    // the floor after the doors are cut. type "grass"; seed = starting density,
    // nGen = smoothing passes, amount = max fraction of floor claimed.
    // Water is no longer a CA patch: it is wall-anchored puddles (js/puddles.js).
    patches:[],
    // Floor growth (js/growth/core.js placeGrowth): sporadic organic patches, rolled per
    // room. roomChance = odds a room grows any; largeArea/largeChance/bigChance
    // = a large room may instead grow one big patch or two normal ones;
    // cornerBias + wallBias = where the anchor lands (the remainder is open
    // floor); sizeMin..sizeMax / bigSizeMin..bigSizeMax = the low and high caps
    // each patch's radius rolls between. Shades scale with size (owner rule).
    growth:{ roomChance:0.80, largeArea:40, largeChance:0.55, bigChance:0.25,
           cornerBias:0.65, wallBias:0.32,
           sizeMin:0.45, sizeMax:0.95, bigSizeMin:1.15, bigSizeMax:1.9 },
    roomMin:6, roomMax:9,
    roomWMin:4, roomWMax:9, roomHMin:4, roomHMax:9,
    roomMaxDuplicateSize:2, roomSplitArea:80, dungeonSize:26,
    treasureChanceBase:0.14, treasureChanceLuck:0.018, treasureChanceCap:0.45,
    secretRoomChanceBase:0.20, secretRoomChanceLuck:0.04, secretRoomChanceCap:0.70,
    // Per-biome nudge to the rare + legendary weights (1 = neutral).
    lootRarityMult:1 },

  { id:2, name:"The Blackvein", floors:[11,20], biome:1,
    // Organic patches (layer1 port) — scraggly tufts; water comes from
    // wall-fed puddles now (js/puddles.js).
    patches:[
      { type:"grass", seed:0.45, nGen:3, amount:0.06 }
    ],
    // Floor growth (js/growth/core.js placeGrowth): an overgrown forest floor needs
    // more than the default — more rooms grow, bigger patches, biased toward
    // wall bases so the mycelium climbs the stone. BIOMES[1].growthVeinPal supplies
    // the IVORY gradient (not the yellow-green it used to); without this block
    // placeGrowth bails entirely.
    growth:{ roomChance:0.88, largeArea:36, largeChance:0.60, bigChance:0.30,
           cornerBias:0.55, wallBias:0.42,
           sizeMin:0.55, sizeMax:1.10, bigSizeMin:1.30, bigSizeMax:2.10 },
    roomMin:6, roomMax:10,
    roomWMin:4, roomWMax:10, roomHMin:4, roomHMax:10,
    roomMaxDuplicateSize:2, roomSplitArea:85, dungeonSize:28,
    treasureChanceBase:0.10, treasureChanceLuck:0.018, treasureChanceCap:0.35,
    secretRoomChanceBase:0.20, secretRoomChanceLuck:0.04, secretRoomChanceCap:0.70,
    // Per-biome nudge to the rare + legendary weights (1 = neutral).
    lootRarityMult:1,
    special:{
      // Ward-relative floor offsets (1 = the ward's first floor) and what happens
      // there: 2-3 clustered-loot floors, plus a 25%-per-remaining-floor chance
      // of a swarm chamber. Numbers here preserve Blackvein's original behaviour.
      floors:[1,9],          // floors 11-19
      clustered:[2,3],
      swarmChance:0.25,
      swarmKind:"spore_swarm",
      swarmMin:18, swarmMax:26
    } },

  { id:3, name:"The Frosted Vault", floors:[21,30], biome:2,
    // No grass-style patches: the old snow drifts stamped a rounded white tile +
    // little blades on whole tiles, which read as a repeated grid. The seamless
    // "ice" floor (BIOMES[2].floorStyle) carries the surface instead; pale ice
    // sheets come from wall-fed puddles (js/puddles.js), tinted by patchWater.
    patches:[],
    // Frost growth (js/growth/frost.js): hoarfrost ferns, angular ice dendrites
    // that leave the walls and creep across the floor. Same per-room roll and
    // linked-wall rule as the other wards' growth.
    growth:{ roomChance:0.82, largeArea:36, largeChance:0.55, bigChance:0.28,
           cornerBias:0.55, wallBias:0.42,
           sizeMin:0.50, sizeMax:1.00, bigSizeMin:1.20, bigSizeMax:1.90 },
    roomMin:6, roomMax:10,
    roomWMin:4, roomWMax:10, roomHMin:4, roomHMax:10,
    roomMaxDuplicateSize:2, roomSplitArea:85, dungeonSize:28,
    treasureChanceBase:0.10, treasureChanceLuck:0.018, treasureChanceCap:0.35,
    secretRoomChanceBase:0.20, secretRoomChanceLuck:0.04, secretRoomChanceCap:0.70,
    // Per-biome nudge to the rare + legendary weights (1 = neutral).
    lootRarityMult:1,
    special:{
      floors:[2,8],          // ward-relative: floors 22-29
      clustered:[2,3],       // 2-3 clustered-loot floors per run
      swarmChance:0.25,      // "Frozen Cache" swarms
      swarmKind:"icebound_swarm",
      swarmMin:18, swarmMax:26
    } },

  { id:4, name:"The Bone Ossuary", floors:[31,40], biome:3,
    // Organic patches (layer1 port) — bone-dust drifts; murky pools come from
    // wall-fed puddles (js/puddles.js), tinted by patchWater below.
    // No patch tiles any more: 22% of the floor was bone-dust GRASS, which read
    // as a grid of pale squares. The seamless "loam" floor carries the surface
    // now, and the dug zones below carry the bones.
    patches:[],
    // Dug zones (js/growth/disturbed.js): portions of the FLOOR look disturbed,
    // with bones poking through. Deliberately NOT wall-biased — cornerBias and
    // wallBias are 0, so zones open on plain floor — and the form returns no
    // wall climbs at all. sizeMin/Max are the zone radius in tiles;
    // bonesMin/Max are how many bones a zone may carry.
    growth:{ roomChance:0.80, largeArea:40, largeChance:0.55, bigChance:0.32,
           cornerBias:0, wallBias:0,
           sizeMin:0.60, sizeMax:1.05, bigSizeMin:1.20, bigSizeMax:1.80,
           bonesMin:3, bonesMax:7 },
    roomMin:6, roomMax:10,
    roomWMin:4, roomWMax:10, roomHMin:4, roomHMax:10,
    roomMaxDuplicateSize:2, roomSplitArea:85, dungeonSize:28,
    treasureChanceBase:0.10, treasureChanceLuck:0.018, treasureChanceCap:0.35,
    secretRoomChanceBase:0.20, secretRoomChanceLuck:0.04, secretRoomChanceCap:0.70,
    // Per-biome nudge to the rare + legendary weights (1 = neutral).
    lootRarityMult:1,
    special:{
      floors:[2,9],              // ward-relative: floors 32-39
      clustered:[2,3],           // 2-3 clustered-loot floors per run
      sarcophagusChance:0.25,    // "Sarcophagus Hall" replaces this ward's swarms
      sarcMin:6, sarcMax:10      // sealed tombs scattered across the floor
    } }
 ];

 // ── Arena dressing (Batch 8) ───────────────────────────────────
 // Which props dress each ward's boss arena, by role. The ENGINE owns *where*:
 // levels.js dressBossArena derives every position from G.bossArena. A ward only
 // chooses *what* art fills each role, so a new ward needs no new placement code.
 // Every key must exist in Delve.SPR.world (sprites.js, "ARENA PROPS"). Keys are
 // per-boss: each ward's six pieces are bespoke art in that boss's colours, so the
 // three arenas don't share a silhouette. Leave a role out and those slots are skipped.
 //   pillar  — big vertical prop, the chamber's four inner corners
 //   banner  — cloth hanging on the chamber's back wall
 //   wallBit — chain / root / icicle hanging on the side and corridor walls
 //   rubble  — stone debris strewn along the chamber walls
 //   bone    — remains, mixed in with the rubble
 //   cluster — a floor feature either side of the way in
 C.DRESSING = {
  1: { pillar:"prop_pillarWarden", banner:"prop_bannerWarden", wallBit:"prop_chainWarden", rubble:"prop_rubbleWarden", bone:"prop_bonesWarden", cluster:"prop_statueWarden" },
  2: { pillar:"prop_pillarThorn",  banner:"prop_bannerThorn",  wallBit:"prop_rootThorn",   rubble:"prop_rubbleThorn",  bone:"prop_huskThorn",    cluster:"prop_clusterThorn"  },
  3: { pillar:"prop_pillarFrost",  banner:"prop_bannerFrost",  wallBit:"prop_icicleFrost", rubble:"prop_rubbleFrost",  bone:"prop_bonesFrost",   cluster:"prop_clusterFrost"  },
  4: { pillar:"prop_pillarBone",   banner:"prop_shroudOssuary", wallBit:"prop_nicheOssuary", rubble:"prop_rubbleOssuary", bone:"prop_pileOssuary", cluster:"prop_tombOssuary" }
 };

 // ── Pixel-grain art data (Batch 22 heritage; moss now lives in js/growth/) ───────────
 // The old MOSS_DESIGNS chunk library was dead data — nothing read it — and
 // the moss it described was the flat green the owner hated. Deleted: moss
 // is now grown as real organic patches by js/growth/, shaped at 16 fine
 // pixels per tile and dressed in the biome's growthPal gradient (BIOMES[0]).
 // (the MOSS_DESIGNS array that used to sit here is gone — see above)

 // Wall moss growth: 4 hand-designed climbs, 16x16 fine pixels, drawn with the
 // BASE (thick, dark) on the row nearest the floor and a stem that meanders up
 // and branches 2-3 ways toward the top. D = dark, M = mid, L = light tip.
 // js/growth/core.js drawGrowthWalls recolours these from the biome's growthPal and turns
 // each to face the floor tile its patch grows from — walls only ever grow
 // moss where a floor patch sits against them (the owner's linked rule).
 C.WALL_MOSS = [
  [ "..L......L..L...", "..M.....LM.M....", "...M....M..M....", "...M...M..M.....",
    "....M.MM.M......", "....MMM.M.......", ".....MM.M.......", ".....MMM........",
    "......MM........", "......MD........", ".....MMD........", ".....MDD........",
    "....MMDD.M......", "...MMDDDMM......", "..MMDDDDDMM.....", ".MMDDDDDDDDMM..." ],
  [ ".......L....L...", "......LM...LM...", "......M....M....", ".....M....MM....",
    ".....MM..MM.....", "......MMMM......", "......MM........", ".....MM.........",
    ".....M..........", "....MM.....M....", "....MD....MM....", "....MDD..MMD....",
    "...MMDDDMMD.....", "..MMDDDDDD......", ".MMDDDDDDDMM....", "MMDDDDDDDDDMM..." ],
  [ "L...L...L...L...", "M...M...M...M...", ".M..M..M...M....", ".M..M..M..M.....",
    "..M.M.M..M......", "..MMMMM.M.......", "...MMM.M........", "....MMM.........",
    "....MM..........", ".....MM.........", ".....MD.........", "....MMD.........",
    "...MMDD.M.......", "..MMDDDMM.......", ".MMDDDDDMMM.....", "MMDDDDDDDDMMM..." ],
  [ "........L..L....", ".......LM..M....", ".......M..M.....", "......MM.MM.....",
    "......M.MM......", ".....MMMM.......", ".M...MM.........", ".MM..M..........",
    "..MMMM..........", "...MM...........", "....MD..........", "....MDD.........",
    "...MMDDD........", "..MMDDDDM.......", ".MMDDDDDDMMM....", "MMDDDDDDDDDMM..." ]
 ];

 // Wall mycelium (js/growth/mycelium.js): the Blackvein's own climb, so biome 2
 // does not borrow the Ruins' leafy stems. Thin threads leave the dark base and
 // meander up, each ending in a pale bracket cap; a second family splits into
 // two threads that rejoin. Same 16x16 grain and the same D/M/L letters, so the
 // shared wall pass recolours it from the biome's gradient.
 C.WALL_MYCELIUM = [
  [ ".......L........", "......L.........", "......M.........", ".....M..L.......",
    ".....M.L........", "....MM.M........", "....M..M........", "...MM..M........",
    "...M..MM........", "..MM..M.........", "..M..MM.........", "..M..M..........",
    ".MM.MM..........", ".M..M...........", ".MD.MD..........", "MMDDMDD........." ],
  [ "..L.........L...", "..M.........M...", "...M.......M....", "...M.......M....",
    "....M.....M.....", "....M....MM.....", ".....M...M......", ".....MM.MM......",
    "......MMM.......", ".......M........", ".......M........", "......MM........",
    "......M.........", ".....MM.........", ".....M..........", "....MMDD........" ],
  [ "....L...L...L...", "....M...M...M...", "...MM...M...M...", "...M...MM..M....",
    "...M...M..MM....", "..MM..MM..M.....", "..M...M..MM.....", "..M..MM..M......",
    ".MM..M..MM......", ".M..MM..M.......", ".M..M..MM.......", "MM..M..M........",
    "M..MM..M........", "MD.M..MM........", "MDDM..M.........", "MDDDMDD........." ]
 ];

 // Wall frost (js/growth/frost.js): the Frosted Vault's own climb, so biome 3
 // does not borrow the Ruins' leafy stems or the Blackvein's threads. Straight
 // crystalline struts leave the base and fork at sharp angles, each ending in a
 // pale point. Same 16x16 grain and D/M/L letters as C.WALL_MOSS, so the shared
 // wall pass recolours it from the biome's gradient.
 C.WALL_FROST = [
  [ ".......L........", ".......M........", "......LML.......", ".......M........",
    ".......M........", "......MMM.......", ".......M........", ".....M.M.M......",
    "......MMM.......", ".......M........", "......MMM.......", ".......M........",
    "......MMM.......", ".....MMDMM......", "......MDM.......", "....MMDDDMM....." ],
  [ "..L.....L.......", "..M.....M..L....", "...M...M...M....", "...M...M..MM....",
    "....M.M..M......", "....MMM.M.......", ".....MMM........", "......M.........",
    ".....MMM........", "....M.M.M.......", ".....MMM........", "......M.........",
    ".....MMM........", "....MMDMM.......", ".....MDM........", "...MMDDDMM......" ],
  [ "....L...L...L...", "....M...M...M...", "....M...M...M...", "...MM..MM..MM...",
    "....M...M...M...", "....MM.MM.MM....", ".....MMMMM......", "......MMM.......",
    ".......M........", "......MMM.......", ".....M.M.M......", "......MMM.......",
    ".......M........", "......MDM.......", ".....MMDMM......", "...MMDDDDDMM...." ]
 ];

 C.BIOMES = [
  { name:"Upper Ruins",
    wall:"#64707c", wallEdge:"#8d99a6", wallBrick:"#3a4248", mortar:"#0b0f14",
    floor:"#2e3842", floor2:"#283039", moss:"#4f8f63",
    water:"#1e3a4a", torch:"#ffb347", light:"rgba(70,140,255,0.06)",
    // Seamless floor (owner batch): "runningbond" switches this biome onto the
    // baked 3x3-tile torus masonry pattern in render.js — interlocking block
    // courses that repeat, but whose edges continue into the neighbouring
    // copy, so no tile grid is visible anywhere; every floor of the ward reads
    // as one continuous paved surface.
    floorStyle:"runningbond",
    // Linked wall growth: this biome's walls grow moss only where a floor patch
    // touches them (js/growth/core.js drawGrowthWalls), instead of the old flat trim.
    growthLinked:true,
    // The moss gradient, dark root → bright growing tip (the owner's
    // brighter-green pick). js/growth/ spreads a patch's shades across it:
    // small patches take a couple, big ones nearly all.
    growthPal:["#2b5340","#356d4a","#4f8f63","#74b584","#97d3a3"],
    // The form (js/growth/moss.js). A biome names its own; the shared rules
    // (anchor bias, per-room rolls, linked walls) live in js/growth/core.js.
    growthStyle:"moss",
    // Decoration family for floor tiles (render.js drawClutter/drawWeed):
    // "ruins" | "blackvein" | "frost". A ward must name one, or its floors
    // would fall back to the ruins look.
    // Ground cover: none in the ruins (the old mushroom clusters are gone —
    // they read as sprouting from the paved stone).
    clutter:"ruins" },
  { name:"The Blackvein",
    wall:"#2a3524", wallEdge:"#4d5c3e", wallBrick:"#141c10", mortar:"#080c06",
    floor:"#3b2f1d", floor2:"#2e2517", moss:"#7a9a3a",
    water:"#3a2048", torch:"#c8d84a", light:"rgba(120,180,60,0.06)",
    // Organic forest floor: smooth periodic soil with mycelium threads instead
    // of masonry. No lattice means no tile grid can read at all, and the brown
    // earth sits under the existing thorn/vine clutter and moss ground cover.
    floorStyle:"dirt",
    // Wall growth climbs from floor patches like ward 1's moss (js/growth/core.js).
    growthLinked:true,
    // Dark root → bright growing tip, in the Blackvein's yellow-green.
    growthPal:["#2a3a18","#3d5222","#5a7a2e","#7a9a3a","#9dbd52"],
    // Its own form (js/growth/mycelium.js): thin branching veins that creep out
    // of the soil, fork 2-3 deep and sometimes curl into a fairy ring — not the
    // Ruins' lobed patches. The owner asked for this by name.
    growthStyle:"mycelium",
    // Veins read paler than moss: damp white-green threads with dark roots, so
    // the strands separate from the brown soil instead of sinking into it.
    // IVORY, not green (owner: the first pass read as biome 1's moss). Real
    // mycelium is colourless cream under the soil, so the gradient runs from a
    // dark root in the dirt to near-white tips — no hue that overlaps the
    // Ruins' green moss or the Blackvein's yellow-green thorns.
    growthVeinPal:["#3a3227","#6f6449","#a89b75","#ddd2ae","#f6efd8"],
    // The dirt floor's own filaments (js/render/tiles.js dirtPixel) read this,
    // so the soil threads and the growth agree. They used to borrow b.moss and
    // were therefore green as well.
    growthThread:"#ece4c6",
    clutter:"blackvein",
    // Ground-cover sprite (js/ground.js): blood moss creeping over the floor.
    groundCover:"ground_moss" },
  { name:"The Frosted Vault",
    // DEEP VIOLET walls (owner's call). The pale ice floor and the old blue-grey
    // walls sat at nearly the same lightness, so the whole ward read as one
    // surface and the frost growth had nothing to stand against. Violet is a
    // different hue AND far darker (wall ~62 luminance vs floor ~143), so the
    // room's shape and the white frost climbs both read instantly.
    wall:"#3b2a55", wallEdge:"#9b7cd6", wallBrick:"#1d1233", mortar:"#0a0714",
    floor:"#2a3644", floor2:"#232e3c", moss:"#7ec8e0",
    water:"#1a3a5e", torch:"#a8e8ff", light:"rgba(180,220,255,0.07)",
    // Seamless floor (owner pick): "ice" bakes a continuous glacial-crystal
    // sheet — broad pale-blue pans, polygonal depth fractures and sparse
    // rune-light seams — across the 3x3-tile torus, so no tile grid reads.
    floorStyle:"ice",
    // Wall look: vertical fracture lines instead of the masonry brick course.
    wallStyle:"ice",
    // Its own growth form (js/growth/frost.js): hoarfrost ferns, not the Ruins'
    // moss nor the Blackvein's mycelium.
    growthStyle:"frost",
    // Dark frozen root → pale icy tip, in the Vault's blue-white.
    growthFrostPal:["#1e3448","#2f5266","#4a7a94","#7fc0d8","#d3eaf4"],
    clutter:"frost",
    // Ground-cover sprite (js/ground.js): frozen puddles in the vault.
    groundCover:"ground_ice",
    // Organic-patch colours (levels.js patches → render.js): pale ice sheets
    // and snow drifts instead of generic water/moss.
    patchWater:"#8fd0e8", patchGrass:"#dceefc" },
  { name:"The Bone Ossuary",
    wall:"#cfc0a0", wallEdge:"#e8dcc0", wallBrick:"#8a7658", mortar:"#1a140c",
    // DARK LOAM floor (owner pick): near-black-brown turned earth, so the pale
    // bone walls frame it instead of blending into it.
    floor:"#2b2117", floor2:"#1e1610", moss:"#7a2a24",
    water:"#4a1a18", torch:"#f0d888", light:"rgba(220,200,160,0.06)",
    // Seamless floor: "loam" bakes continuous turned earth with pale bone grit
    // into the 16-px/tile 3x3 torus — no lattice, no per-tile rectangle.
    floorStyle:"loam",
    // The grit uses the walls' own bone tone, so floor and stone belong together.
    gritColour:"#cfc0a0",
    // Its own growth form (js/growth/disturbed.js): dug earth + a bone kit,
    // floor only — it never climbs a wall.
    growthStyle:"disturbed",
    // Dark earth to pale bone: [earth dark, earth mid, bone shade, bone mid,
    // bone light]. The zone body and its bones share this one ladder.
    // Turned earth is LIGHTER than packed loam, so a dug zone reads on a
    // near-black floor; the bones sit above that again.
    growthDigPal:["#3a2d1e","#57432c","#7a6a50","#bda986","#efe4c8"],
    // Pale and bright on purpose: an ossuary lit by tallow, not a dark tomb.
    clutter:"ossuary",
    // Ground-cover sprite (js/ground.js): scattered bone fragments.
    groundCover:"ground_bone",
    // Organic-patch colours: bone-dust drifts and murky crimson pools.
    patchGrass:"#b0a080", patchWater:"#4a1a18" }
 ];
})();
