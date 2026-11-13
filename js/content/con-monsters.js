window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-monsters.js : monster roster, bands, bosses, elites, xp ──

 C.MONSTER_ROSTER = {
  rat: { name:"Rotten Rat", hp:8, hpPerFloor:1.2, atk:2, atkPerFloor:0.4, xp:1, gold:1, shards:1, kind:"rat", speed:1.5 },
  slime: { name:"Slime", hp:18, hpPerFloor:2.0, atk:2, atkPerFloor:0.3, xp:2, gold:2, shards:2, kind:"slime", speed:0.7 },
  goblin: { name:"Goblin", hp:12, hpPerFloor:2.5, atk:4, atkPerFloor:0.6, xp:3, gold:3, shards:2, kind:"goblin", speed:1.0 },
  brute: { name:"Brute", hp:18, hpPerFloor:4.0, atk:7, atkPerFloor:0.8, xp:5, gold:5, shards:3, kind:"brute", speed:0.75 },
  wraith: { name:"Wraith", hp:16, hpPerFloor:3.0, atk:4, atkPerFloor:0.7, xp:6, gold:6, shards:3, kind:"wraith", speed:1.2, onHitEffect:"weaken" },  // migrated from combat.js fallback

  barkling:     { name:"Barkling",           hp:16, hpPerFloor:2.2, atk:4, atkPerFloor:0.55, xp:4, gold:4, shards:2, kind:"barkling",     speed:1.30 },
  spore_swarm:  { name:"Spore Swarm",        hp:14, hpPerFloor:2.2, atk:4, atkPerFloor:0.60, xp:4, gold:4, shards:2, kind:"spore_swarm",  speed:1.40 },
  thornling:    { name:"Thornling",          hp:24, hpPerFloor:3.2, atk:5, atkPerFloor:0.80, xp:7, gold:7, shards:3, kind:"thornling",    speed:1.35, onHitEffect:"bleed"  },
  vine_stalker: { name:"Vine Stalker",       hp:28, hpPerFloor:3.8, atk:7, atkPerFloor:0.85, xp:8, gold:8, shards:3, kind:"vine_stalker", speed:1.15, onHitEffect:"poison" },
  dryad:        { name:"Hollow Dryad",       hp:34, hpPerFloor:4.0, atk:8, atkPerFloor:0.90, xp:8, gold:8, shards:4, kind:"dryad",        speed:0.95, onHitEffect:"weaken" },
  treant:       { name:"Corrupted Treant",   hp:48, hpPerFloor:5.5, atk:9, atkPerFloor:1.00, xp:9, gold:9, shards:4, kind:"treant",       speed:0.55, onHitEffect:"weaken", armour:2, enrageAt:0 },

  // ── The Frosted Vault (ward 3, floors 21-30) ───────────────────
  frostling:      { name:"Frostling",           hp:12, hpPerFloor:1.8, atk:3, atkPerFloor:0.50, xp:4, gold:4, shards:2, kind:"frostling",       speed:1.40 },
  icebound_swarm: { name:"Icebound Swarm",      hp:14, hpPerFloor:2.2, atk:4, atkPerFloor:0.55, xp:4, gold:4, shards:2, kind:"icebound_swarm",  speed:1.40 },
  shatterling:    { name:"Shatterling",         hp:28, hpPerFloor:3.2, atk:6, atkPerFloor:0.70, xp:7, gold:7, shards:3, kind:"shatterling",     speed:1.25, deathBurst:6 },
  glacial_stalker:{ name:"Glacial Stalker",     hp:24, hpPerFloor:3.0, atk:6, atkPerFloor:0.75, xp:7, gold:7, shards:3, kind:"glacial_stalker", speed:1.30, onHitEffect:"bleed", enrageAt:0.40 },
  rimecaster:     { name:"Rimecaster",          hp:30, hpPerFloor:3.6, atk:7, atkPerFloor:0.80, xp:8, gold:8, shards:3, kind:"rimecaster",      speed:1.10, onHitEffect:"chill" },
  frostbound:     { name:"Frostbound Sentinel", hp:42, hpPerFloor:4.5, atk:9, atkPerFloor:0.95, xp:9, gold:9, shards:4, kind:"frostbound",      speed:0.75, onHitEffect:"chill", armour:3, enrageAt:0 },

  // ── The Bone Ossuary (ward 4, floors 31-40) ────────────────────
  // dried blood #7a2a24 as the bleed accent; Socket-numbers follow the ward doc.
  bone_rat:        { name:"Bone Rat",        hp:12, hpPerFloor:1.8, atk:3,  atkPerFloor:0.50, xp:4, gold:4, shards:2, kind:"bone_rat",        speed:1.40 },
  grave_skitter:   { name:"Grave Skitter",   hp:14, hpPerFloor:2.0, atk:4,  atkPerFloor:0.55, xp:4, gold:4, shards:2, kind:"grave_skitter",   speed:1.40 },
  marrow_hound:    { name:"Marrow Hound",    hp:24, hpPerFloor:3.0, atk:6,  atkPerFloor:0.75, xp:7, gold:7, shards:3, kind:"marrow_hound",    speed:1.30, onHitEffect:"bleed", enrageAt:0.35 },
  bonecaller:      { name:"Bonecaller",      hp:30, hpPerFloor:3.6, atk:7,  atkPerFloor:0.80, xp:8, gold:8, shards:3, kind:"bonecaller",      speed:1.10, onHitEffect:"weaken" },
  ossuary_sentry:  { name:"Ossuary Sentry",  hp:36, hpPerFloor:4.0, atk:8,  atkPerFloor:0.85, xp:8, gold:8, shards:3, kind:"ossuary_sentry",  speed:0.90, onHitEffect:"weaken", armour:2, enrageAt:0 },
  ribcage_brute:   { name:"Ribcage Brute",   hp:46, hpPerFloor:4.8, atk:10, atkPerFloor:1.00, xp:9, gold:9, shards:4, kind:"ribcage_brute",   speed:0.70, armour:3, enrageAt:0 },
  skull_warden:    { name:"Skull Warden",    hp:40, hpPerFloor:4.4, atk:11, atkPerFloor:1.05, xp:9, gold:9, shards:4, kind:"skull_warden",    speed:0.80, onHitEffect:"bleed"  },
  reassembled:     { name:"The Reassembled", hp:30, hpPerFloor:3.6, atk:8,  atkPerFloor:0.85, xp:9, gold:9, shards:4, kind:"reassembled",     speed:1.00,
                    // The gimmick: on death it reassembles once at half HP.
                    // Fight it twice; the base HP is deliberately low.
                    reassembleOnce:true },

  // ── The Ashen Forge (ward 5, floors 41-50) ─────────────────────
  // A foundry's population: things that live in heat. Burn is the ward's
  // signature status (themed as a deep burn), with bleed and poison in support.
  ash_tick:      { name:"Ash Tick",        hp:14, hpPerFloor:1.8, atk:4,  atkPerFloor:0.50, xp:4, gold:4, shards:2, kind:"ash_tick",      speed:1.40 },
  slag_hound:    { name:"Slag Hound",      hp:16, hpPerFloor:2.2, atk:5,  atkPerFloor:0.60, xp:4, gold:4, shards:2, kind:"slag_hound",    speed:1.35, onHitEffect:"bleed", enrageAt:0.35 },
  cinder_wretch: { name:"Cinder Wretch",   hp:28, hpPerFloor:3.0, atk:7,  atkPerFloor:0.75, xp:7, gold:7, shards:3, kind:"cinder_wretch", speed:1.20, onHitEffect:"burn", enrageAt:0.40 },
  furnace_guard: { name:"Furnace Guard",   hp:42, hpPerFloor:4.2, atk:9,  atkPerFloor:0.90, xp:8, gold:8, shards:3, kind:"furnace_guard", speed:0.80, onHitEffect:"weaken", armour:4, enrageAt:0 },
  emberfiend:    { name:"Emberfiend",      hp:34, hpPerFloor:3.8, atk:8,  atkPerFloor:0.85, xp:8, gold:8, shards:3, kind:"emberfiend",    speed:1.10, onHitEffect:"burn" },
  molten_brute:  { name:"Molten Brute",    hp:55, hpPerFloor:5.0, atk:12, atkPerFloor:1.10, xp:9, gold:9, shards:4, kind:"molten_brute",  speed:0.65, armour:5, enrageAt:0 },
  smog_stalker:  { name:"Smog Stalker",    hp:44, hpPerFloor:4.5, atk:13, atkPerFloor:1.00, xp:9, gold:9, shards:4, kind:"smog_stalker",  speed:1.00, onHitEffect:"poison" },
  // The Forge's gimmick enemy: on death it splits, and you fight both halves.
  // `splitOnDeath` is read by combat.js (it had to be added there — the old
  // reassembleOnce was a different, single-monster trick).
  reforged:      { name:"The Reforged",    hp:32, hpPerFloor:3.6, atk:9,  atkPerFloor:0.80, xp:9, gold:9, shards:4, kind:"reforged",      speed:1.00,
                   // On death it splits into two smaller halves at 25% HP / ATK.
                   splitOnDeath:{ into:"reforged_shard", count:2, hpPct:0.25, atkPct:0.25 } },
  // The split halves. A real roster row so stats, rewards and the sprite lookup
  // all resolve; never placed by a band, so it only ever exists via the split.
  reforged_shard:{ name:"Reforged Shard",   hp:8,  hpPerFloor:0.9, atk:2,  atkPerFloor:0.20, xp:2, gold:2, shards:1, kind:"reforged_shard", speed:1.15,
                   isFragment:true }
 };

 C.MONSTER_BANDS = [
  { floors:[1,2], boss:false, countMin:12, countMax:17, weights:{ rat:60, slime:40 } },
  { floors:[3,4], boss:false, countMin:13, countMax:18, weights:{ rat:35, slime:35, goblin:30 } },
  // Brute used to arrive at full weight on floor 5, where it is atk 7 + 0.8*5 =
  // 11 against a player with ~40 HP and 20% DR — a 53% jump in floor-average
  // attack in a single step. It now enters as a RARE at floor 5 and reaches full
  // weight at 7, so the ramp is spread over three floors instead of one.
  { floors:[5,6], boss:false, countMin:13, countMax:18, weights:{ rat:22, slime:30, goblin:40, brute:8 } },
  { floors:[7,9], boss:false, countMin:13, countMax:18, weights:{ rat:10, slime:18, goblin:34, brute:20, wraith:18 } },
  { floors:[11,11], boss:false, countMin:13, countMax:18, weights:{ goblin:10, brute:15, wraith:20, barkling:20, thornling:13, vine_stalker:12, spore_swarm:10 } },
  { floors:[12,12], boss:false, countMin:14, countMax:19, weights:{ brute:8, wraith:12, barkling:15, thornling:20, vine_stalker:20, spore_swarm:15, dryad:10 } },
  { floors:[13,19], boss:false, countMin:15, countMax:21, weights:{ barkling:12, thornling:22, vine_stalker:20, dryad:18, treant:15, spore_swarm:13 } },
  // Floors 21-30 — The Frosted Vault. Counts scale up with depth. No band covers
  // floor 30: it is a boss floor, and genBossFloor spawns nothing.
  { floors:[21,22], boss:false, countMin:15, countMax:20, weights:{ frostling:40, icebound_swarm:35, glacial_stalker:15, rimecaster:10 } },
  { floors:[23,25], boss:false, countMin:16, countMax:22, weights:{ frostling:20, icebound_swarm:20, glacial_stalker:20, rimecaster:20, shatterling:12, frostbound:8 } },
  { floors:[26,29], boss:false, countMin:17, countMax:23, weights:{ frostling:8, icebound_swarm:10, glacial_stalker:22, rimecaster:22, shatterling:18, frostbound:20 } },
  // Floors 31-40 — The Bone Ossuary. Counts follow the ward-3 ramp. Floor 40
  // has no band: it is a boss floor, and genBossFloor spawns nothing.
  { floors:[31,32], boss:false, countMin:15, countMax:20, weights:{ bone_rat:40, grave_skitter:35, marrow_hound:15, bonecaller:10 } },
  { floors:[33,35], boss:false, countMin:17, countMax:23, weights:{ bone_rat:20, grave_skitter:20, marrow_hound:20, bonecaller:20, ossuary_sentry:12, ribcage_brute:8 } },
  { floors:[36,39], boss:false, countMin:18, countMax:24, weights:{ bone_rat:8, grave_skitter:10, marrow_hound:22, bonecaller:22, ossuary_sentry:18, ribcage_brute:20, skull_warden:0, reassembled:0 } },
  // Floors 41-50 — The Ashen Forge. Ordering rule: getMonsterBand scans FIRST
  // MATCH and returns the first band whose range contains the floor, so a band
  // whose range OVERLAPS another must come first. These three do not overlap the
  // [51,999] overflow, so they are safe here — but if a future ward's overflow
  // range is ever widened (or one of these is widened), the deeper band has to
  // stay above it or it will silently never fire. Pinned by a test that asserts
  // floor 41 resolves to its OWN band rather than the catch-all.
  // Floor 50 has no band: it is a boss floor and genBossFloor spawns nothing.
  { floors:[41,42], boss:false, countMin:16, countMax:22, weights:{ ash_tick:40, slag_hound:35, cinder_wretch:15, furnace_guard:10 } },
  { floors:[43,45], boss:false, countMin:18, countMax:24, weights:{ ash_tick:20, slag_hound:20, cinder_wretch:20, furnace_guard:15, emberfiend:15, molten_brute:10 } },
  // "reforged" appears only in the deepest band, on purpose: its split doubles
  // the bodies on the floor mid-fight, and one roaming splitter is a set piece
  // while four would be a slog. `reforged_shard` is NEVER listed here — it only
  // exists as the product of the split.
  { floors:[46,49], boss:false, countMin:19, countMax:26, weights:{ ash_tick:10, slag_hound:10, cinder_wretch:15, furnace_guard:20, emberfiend:15, molten_brute:15, smog_stalker:15, reforged:8 } },
  // Overflow fallback band — used by getMonsterBand for any floor past the last
  // defined ward. Kept deliberately: a future ward overrides it by defining its
  // own bands ABOVE this entry. (Boss floors need no band: genBossFloor spawns
  // nothing.) Carries Ashen Forge weights, since that is now the deepest content.
  { floors:[51,999], boss:false, countMin:19, countMax:26, weights:{ ash_tick:10, slag_hound:10, cinder_wretch:15, furnace_guard:20, emberfiend:15, molten_brute:15, smog_stalker:15 } }
 ];

 C.spawnSafetyRadius = 4;

 // Fallback boss scaling — levels.js uses these ONLY when a BOSS_DEFS entry
 // omits a stat. Future wards may omit fields and inherit these defaults.
 C.monsterHpBase = 5; C.monsterHpPerFloor = 1.5;
 C.monsterAtkBase = 1; C.monsterAtkPerFloor = 0.5;
 C.bossHpBase = 100; C.bossHpPerFloor = 0;
 C.bossAtkBase = 9; C.bossAtkPerFloor = 0;
 C.bossSpeed = 0.65;

 C.BOSS_DEFS = {
  1: {
   name:"The Warden",
   title:"Guardian of the Undercroft",
   flavour:"He has watched these stones since before your grandfather was born.\nHe will not step aside.",
   hp:100, atk:11, speed:0.65, chainHitEvery:3,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_warden",   // key registered in content/bosssprites.js
   accent:"#7ee0ff",       // boss intro tint — matches his pale-blue eyes
   size:{ w:2, h:2 }       // tiles his art covers (tile is the bottom-left of it)
  },
  2: {
   name:"The Thorn Sovereign",
   title:"Heart of the Blackvein",
   flavour:"It was ancient before the corruption found it.\nNow it walks, and it has been waiting.",
   hp:160, atk:20, speed:0.70, chainHitEvery:2,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_thorn",    // FIX #27: previously fell back to boss_warden
   accent:"#a8e84a",
   size:{ w:2, h:2 }
  },
  3: {
   name:"The Pale Tempest",
   title:"Heart of the Blizzard",
   flavour:"The storm did not arrive. It woke.",
   hp:220, atk:30, speed:0.72, chainHitEvery:2,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_tempest",  // registered in content/bosssprites.js
   accent:"#a8e8ff",       // the blizzard's own light
   size:{ w:2, h:2 }
  },
  4: {
   name:"The Bonefather",
   title:"Lord of the Marrow",
   flavour:"Every rib was once a promise.\nHe kept them all.",
   hp:280, atk:40, speed:0.72, chainHitEvery:2,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_bonefather",            // Act 1: the ribs sealed
   spriteOpen:"boss_bonefather_open",   // Act 2: ribs shattered, heart exposed
   shieldHp:120,                        // the ribs soak ~120 damage, then break
   accent:"#e8dcc0",                    // bleached bone
   size:{ w:2, h:2 }
  },
  5: {
   name:"The Forge Titan",
   title:"Master of the Molten Core",
   flavour:"The fire has burned for a thousand years.\nIt will not stop for you.",
   hp:340, atk:50, speed:0.65, chainHitEvery:3,
   sprite:"boss_titan",                 // registered in content/con-bosssprites.js
   accent:"#ff6a00",                    // the molten core
   size:{ w:2, h:2 }
  }
 };

 C.elite = {
  chance:0.10, minFloor:3, maxFloor:99999,
  hpMult:1.6, atkMult:1.3, rewardMult:3,
  guaranteedPotion:true, glow:"#ffd75e"
 };

 // Kill XP — single source of truth is the roster row's `xp`.
 // This table exists for legacy readers; kept in sync. Prefer MONSTER_ROSTER[k].xp.
 C.xpKill = { rat:1, slime:2, goblin:3, brute:5, wraith:6, barkling:4, spore_swarm:4, thornling:7, vine_stalker:8, dryad:8, treant:9, frostling:4, icebound_swarm:4, shatterling:7, glacial_stalker:7, rimecaster:8, frostbound:9, boss:30 };
 C.xpKill.bone_rat = 4; C.xpKill.grave_skitter = 4; C.xpKill.marrow_hound = 7;
 C.xpKill.bonecaller = 8; C.xpKill.ossuary_sentry = 8; C.xpKill.ribcage_brute = 9;
 C.xpKill.skull_warden = 9; C.xpKill.reassembled = 9;
 C.xpKill.ash_tick = 4; C.xpKill.slag_hound = 4; C.xpKill.cinder_wretch = 7;
 C.xpKill.furnace_guard = 8; C.xpKill.emberfiend = 8; C.xpKill.molten_brute = 9;
 C.xpKill.smog_stalker = 9; C.xpKill.reforged = 9;
})();
