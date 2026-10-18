window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-biomes.js : biome visuals + ward (floor-band) rules ──

 C.WARDS = [
  { id:1, name:"Upper Ruins", floors:[1,10], biome:0,
    // Organic patches (layer1 port): cellular-automaton blobs painted over the
    // floor after the doors are cut. type "grass"|"water"; seed = starting
    // density, nGen = smoothing passes, amount = max fraction of floor claimed.
    // Grass-tile patches are gone from this ward: moss is now fine-grain decoration
    // (`moss` below). Water stays as it was until its own polish batch.
    patches:[
      { type:"water", seed:0.45, nGen:3, amount:0.10 }
    ],
    // Floor growth (js/growth.js placeGrowth): sporadic organic patches, rolled per
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
    // Organic patches (layer1 port) — dark pools dominate, scraggly tufts rare.
    patches:[
      { type:"water", seed:0.50, nGen:3, amount:0.26 },
      { type:"grass", seed:0.45, nGen:3, amount:0.06 }
    ],
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
    // Organic patches (layer1 port) — pale ice sheets with the odd snow drift.
    patches:[
      { type:"water", seed:0.50, nGen:3, amount:0.24 },
      { type:"grass", seed:0.45, nGen:3, amount:0.08 }
    ],
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
    // Organic patches (layer1 port) — bone-dust drifts with murky pools.
    patches:[
      { type:"grass", seed:0.50, nGen:3, amount:0.22 },
      { type:"water", seed:0.42, nGen:3, amount:0.06 }
    ],
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

 // ── Pixel-grain art data (Batch 22 heritage; moss now lives in js/growth.js) ───────────
 // The old MOSS_DESIGNS chunk library was dead data — nothing read it — and
 // the moss it described was the flat green the owner hated. Deleted: moss
 // is now grown as real organic patches by js/growth.js, shaped at 16 fine
 // pixels per tile and dressed in the biome's growthPal gradient (BIOMES[0]).
 // (the MOSS_DESIGNS array that used to sit here is gone — see above)

 // Wall moss growth: 4 hand-designed climbs, 16x16 fine pixels, drawn with the
 // BASE (thick, dark) on the row nearest the floor and a stem that meanders up
 // and branches 2-3 ways toward the top. D = dark, M = mid, L = light tip.
 // js/growth.js drawGrowthWalls recolours these from the biome's growthPal and turns
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
    // touches them (js/growth.js drawGrowthWalls), instead of the old flat trim.
    growthLinked:true,
    // The moss gradient, dark root → bright growing tip (the owner's
    // brighter-green pick). js/growth.js spreads a patch's shades across it:
    // small patches take a couple, big ones nearly all.
    growthPal:["#2b5340","#356d4a","#4f8f63","#74b584","#97d3a3"],
    // Decoration family for floor tiles (render.js drawClutter/drawWeed):
    // "ruins" | "blackvein" | "frost". A ward must name one, or its floors
    // would fall back to the ruins look.
    clutter:"ruins",
    // Ground cover: none in the ruins (the old mushroom clusters are gone —
    // they read as sprouting from the paved stone).
    // Drifting ambience (render.js drawAmbience). vy is tiles per second —
    // negative rises, positive falls. drift is the sideways sway in tiles.
    // type picks the particle look: "dust" | "ember" | "snow".
    ambient:{ type:"dust", count:14, col:"#c9c2b0", col2:"#8d99a6", size:0.055, vy:-0.04, drift:0.06, alpha:0.34 } },
  { name:"The Blackvein",
    wall:"#2a3524", wallEdge:"#4d5c3e", wallBrick:"#141c10", mortar:"#080c06",
    floor:"#2c3524", floor2:"#242c1e", moss:"#7a9a3a",
    water:"#3a2048", torch:"#c8d84a", light:"rgba(120,180,60,0.06)",
    clutter:"blackvein",
    // Ground-cover sprite (js/ground.js): blood moss creeping over the floor.
    groundCover:"ground_moss",
    // Embers drift upward out of the seam, with spore flecks among them.
    ambient:{ type:"ember", count:16, col:"#c8d84a", col2:"#ff9a3a", size:0.05, vy:-0.17, drift:0.10, alpha:0.5 } },
  { name:"The Frosted Vault",
    wall:"#3a4a5e", wallEdge:"#7a9ac0", wallBrick:"#1a2436", mortar:"#0a1018",
    floor:"#2a3644", floor2:"#232e3c", moss:"#7ec8e0",
    water:"#1a3a5e", torch:"#a8e8ff", light:"rgba(180,220,255,0.07)",
    clutter:"frost",
    // Ground-cover sprite (js/ground.js): frozen puddles in the vault.
    groundCover:"ground_ice",
    // Organic-patch colours (levels.js patches → render.js): pale ice sheets
    // and snow drifts instead of generic water/moss.
    patchWater:"#8fd0e8", patchGrass:"#dceefc",
    // Fine snow falls through the vault and slants sideways as it drops.
    ambient:{ type:"snow", count:22, col:"#eaffff", col2:"#a8e8ff", size:0.05, vy:0.22, drift:0.13, alpha:0.5 } },
  { name:"The Bone Ossuary",
    wall:"#cfc0a0", wallEdge:"#e8dcc0", wallBrick:"#8a7658", mortar:"#1a140c",
    floor:"#8a7455", floor2:"#786447", moss:"#7a2a24",
    water:"#4a1a18", torch:"#f0d888", light:"rgba(220,200,160,0.06)",
    // Pale and bright on purpose: an ossuary lit by tallow, not a dark tomb.
    clutter:"ossuary",
    // Ground-cover sprite (js/ground.js): scattered bone fragments.
    groundCover:"ground_bone",
    // Organic-patch colours: bone-dust drifts and murky crimson pools.
    patchGrass:"#b0a080", patchWater:"#4a1a18",
    // Dust hangs nearly still in the closed halls.
    ambient:{ type:"dust", count:12, col:"#d8cbb0", col2:"#8a7658", size:0.05, vy:-0.03, drift:0.05, alpha:0.30 } }
 ];
})();
