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
  treant:       { name:"Corrupted Treant",   hp:48, hpPerFloor:5.5, atk:9, atkPerFloor:1.00, xp:9, gold:9, shards:4, kind:"treant",       speed:0.55, onHitEffect:"weaken" },

  // ── The Frosted Vault (ward 3, floors 21-30) ───────────────────
  frostling:      { name:"Frostling",           hp:12, hpPerFloor:1.8, atk:3, atkPerFloor:0.50, xp:4, gold:4, shards:2, kind:"frostling",       speed:1.40 },
  icebound_swarm: { name:"Icebound Swarm",      hp:14, hpPerFloor:2.2, atk:4, atkPerFloor:0.55, xp:4, gold:4, shards:2, kind:"icebound_swarm",  speed:1.40 },
  shatterling:    { name:"Shatterling",         hp:28, hpPerFloor:3.2, atk:6, atkPerFloor:0.70, xp:7, gold:7, shards:3, kind:"shatterling",     speed:1.25, deathBurst:6 },
  glacial_stalker:{ name:"Glacial Stalker",     hp:24, hpPerFloor:3.0, atk:6, atkPerFloor:0.75, xp:7, gold:7, shards:3, kind:"glacial_stalker", speed:1.30, onHitEffect:"bleed" },
  rimecaster:     { name:"Rimecaster",          hp:30, hpPerFloor:3.6, atk:7, atkPerFloor:0.80, xp:8, gold:8, shards:3, kind:"rimecaster",      speed:1.10, onHitEffect:"chill" },
  frostbound:     { name:"Frostbound Sentinel", hp:42, hpPerFloor:4.5, atk:9, atkPerFloor:0.95, xp:9, gold:9, shards:4, kind:"frostbound",      speed:0.75, onHitEffect:"chill" }
 };

 C.MONSTER_BANDS = [
  { floors:[1,2], boss:false, countMin:10, countMax:14, weights:{ rat:60, slime:40 } },
  { floors:[3,4], boss:false, countMin:10, countMax:14, weights:{ rat:35, slime:35, goblin:30 } },
  { floors:[5,6], boss:false, countMin:10, countMax:14, weights:{ rat:15, slime:25, goblin:40, brute:20 } },
  { floors:[7,9], boss:false, countMin:10, countMax:14, weights:{ rat:8, slime:15, goblin:30, brute:25, wraith:22 } },
  { floors:[11,11], boss:false, countMin:10, countMax:14, weights:{ goblin:10, brute:15, wraith:20, barkling:20, thornling:13, vine_stalker:12, spore_swarm:10 } },
  { floors:[12,12], boss:false, countMin:10, countMax:14, weights:{ brute:8, wraith:12, barkling:15, thornling:20, vine_stalker:20, spore_swarm:15, dryad:10 } },
  { floors:[13,19], boss:false, countMin:10, countMax:14, weights:{ barkling:12, thornling:22, vine_stalker:20, dryad:18, treant:15, spore_swarm:13 } },
  // Floors 21-30 — The Frosted Vault. Counts scale up with depth. No band covers
  // floor 30: it is a boss floor, and genBossFloor spawns nothing.
  { floors:[21,22], boss:false, countMin:12, countMax:15, weights:{ frostling:40, icebound_swarm:35, glacial_stalker:15, rimecaster:10 } },
  { floors:[23,25], boss:false, countMin:13, countMax:17, weights:{ frostling:20, icebound_swarm:20, glacial_stalker:20, rimecaster:20, shatterling:12, frostbound:8 } },
  { floors:[26,29], boss:false, countMin:14, countMax:18, weights:{ frostling:8, icebound_swarm:10, glacial_stalker:22, rimecaster:22, shatterling:18, frostbound:20 } },
  // Overflow fallback band — used by getMonsterBand for any floor past the last
  // defined ward. Kept deliberately: future wards override it by defining their
  // own bands above this entry. (Boss floors need no band: genBossFloor spawns
  // nothing.) Carries Frosted Vault weights, since that is the deepest content.
  { floors:[31,999], boss:false, countMin:14, countMax:18, weights:{ frostling:8, icebound_swarm:10, glacial_stalker:22, rimecaster:22, shatterling:18, frostbound:20 } }
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
   hp:100, atk:9, speed:0.65, chainHitEvery:3,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_warden",   // key registered in content/bosssprites.js
   accent:"#7ee0ff",       // boss intro tint — matches his pale-blue eyes
   size:{ w:2, h:2 }       // tiles his art covers (tile is the bottom-left of it)
  },
  2: {
   name:"The Thorn Sovereign",
   title:"Heart of the Blackvein",
   flavour:"It was ancient before the corruption found it.\nNow it walks, and it has been waiting.",
   hp:160, atk:14, speed:0.70, chainHitEvery:2,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_thorn",    // FIX #27: previously fell back to boss_warden
   accent:"#a8e84a",
   size:{ w:2, h:2 }
  },
  3: {
   name:"The Pale Tempest",
   title:"Heart of the Blizzard",
   flavour:"The storm did not arrive. It woke.",
   hp:220, atk:18, speed:0.72, chainHitEvery:2,
   // (no shardBonusPct — bosses pay a flat, depth-scaled amount; CONFIG.economy.bossShardsPerWard)
   sprite:"boss_tempest",  // registered in content/bosssprites.js
   accent:"#a8e8ff",       // the blizzard's own light
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
})();
