window.Delve = window.Delve || {};
Delve.CONFIG = {

 // ---------- ATTRIBUTES ----------
 costGrowth: 1.28,

 ATTRS: {
  con: { name:"Constitution", short:"CON", base:30, perLevel:5, costBase:20, desc:"+5 max HP and +1 max rest heal per level. 3+ levels unlocks Second Wind", kind:"hp" },
  str: { name:"Strength", short:"STR", base:6, perLevel:1, costBase:15, desc:"+1 attack per level. 2+ points also offset heavy armour's speed penalty", kind:"atk" },
  tou: { name:"Toughness", short:"TOU", base:4, perLevel:0.05, costBase:18, cap:0.50, desc:"+5% damage reduction per level (cap 50%). TOU 5 total unlocks Bulwark", kind:"pct" },
  luc: { name:"Luck", short:"LCK", base:1, perLevel:1, costBase:20, desc:"+1% crit, better loot, more gold, shop discount — luck touches everything", kind:"luck" },
  agi: { name:"Agility", short:"AGI", base:1, perLevel:1, costBase:18, desc:"+4% dodge and +0.05 attack speed per point. 3+ levels unlocks First Strike", kind:"agi" },
  eng: { name:"Energy", short:"ENG", base:10, perLevel:3, costBase:30, desc:"+3 starting Energy per level, and +3 to the Energy cap. Fuels abilities", kind:"energy" }
 },
 ATTR_ORDER: ["con","str","tou","luc","agi","eng"],

 secondaries: {
  secondWindUnlock: 3, secondWindTrigger: 0.20, secondWindHeal: 0.30,
  overkillUnlock: 3, overkillHealPct: 0.5,
  bulwarkTotal: 5, bulwarkHitCap: 0.60,
  critPerLuck: 0.01, critCap: 0.50, critMult: 1.5,
  dodgePerAgi: 0.04, dodgeCap: 0.40,
  firstStrikeUnlock: 3, firstStrikeDiv: 2,
  // Odds that an enrage-capable species spawns enraged. Rolled per INSTANCE in
  // js/levels.js, not granted to every copy: at 1.0 a deep floor carried enough
  // enraged bodies that the worst-case burst hit 85% of max HP, which is a
  // volume problem rather than a positioning one.
  enrageChance: 0.40,
  baseInterval: 600,
  speedPerAgi: 0.05
 },

 // ---------- MONSTER DAMAGE BY DEPTH ----------
 // Monster ATTACK used to grow linearly with the floor while the player's damage
 // reduction, dodge and health growth all had ceilings, so it never caught up:
 // measured, a floor-50 brute hit for 20 against 152 HP while the player killed it
 // in about a second. Fights got LONGER, never DANGEROUS.
 //
 // `enemyDmgPerWard` is a flat percentage added to every monster's attack, per
 // ward past the first: ward 1 ×1.00, ward 2 ×1.15, ward 3 ×1.30, ward 4 ×1.45,
 // ward 5 ×1.60. It applies to spawned monsters and bosses alike, and it is the
 // same curve in every ward so the difficulty ramp is legible.
 enemyDmgPerWard: 0.15,

 // ---------- RUN STRUCTURE ----------
 bossEvery: 10,
 // Health handed back for walking downstairs. This was 0.5 at every depth, which
 // meant a bad floor was erased by the next staircase: measured against a clean
 // run, the player finished all 50 floors without dying once. It now starts at
 // 30% and shrinks with depth, so sustain becomes something you manage (potions,
 // rests, the shop) rather than something the stairs hand you for free.
 // Floor 1 is still generous — see openingFloor below.
 healOnDescendPct: 0.30,
 healOnDescendFalloff: 0.45,   // ×(1 - falloff × wardProgress); ward 5 lands at 0.20

 // ---------- OPENING FLOOR ----------
 // The first floor is a teaching floor, not a test. Fewer, weaker monsters and a
 // bigger heal on the way down, so a new player meets the loop — walk, tap a
 // monster, watch it die, find gear — before anything can kill them.
 // `starterGear` drops one guaranteed weapon and one armour piece on floor 1.
 openingFloor: { monsters: 8, monsterHpPct: 0.75, monsterAtkPct: 0.75,
                 healOnDescendPct: 0.65, starterGear: true },

 // ---------- FOG OF WAR (js/fog.js) ----------
 // A room is dark until the player enters it, then that whole room stays lit for
 // the rest of the floor. `lantern` is the radius, in tiles, of the soft pool
 // around the player that keeps a corridor walkable; `soften` is the blur in
 // pixels on a room's edge, since a hard edge would draw the grid back in.
 // lantern (4) is set to match PURSUIT.radius below: anything that has noticed
 // you is inside your light, so you are never hit by something you cannot see.
 FOG: { enabled:true, darkness:0.95, lantern:4, soften:18, trail:true },

 // ---------- PURSUIT (js/pursuit.js) ---------- // A monster that noticed you takes one step per player action. radius is how
 // close it must be, with line of sight, to notice; leash caps how far it will
 // stray from where it woke, so nothing follows you across the floor or stands
 // on the stairs. wakeOnDamage: hitting one from across the room wakes it.
 PURSUIT: { radius:4, leash:9, wakeOnDamage:true },

 // ---------- REST MECHANIC ----------
 restHealPct: 0.06,
 restMinHeal: 1,
 restPerFloor: 3,
 
 // ---------- ECONOMY (sim-locked shard pacing) ----------
  economy: {
  goldCurveType: "log", goldCurveK: 1.0, goldLuckMult: 0.05,
  healCostA: 30, healCostB: 8,
  tierPrices: [12, 35, 90, 240],
  consumablePrices: { 1:10, 2:20, 3:40 },
  luckDiscountPerPoint: 0.02, maxLuckDiscount: 0.20, goldToShardRate: 10,
  floorClearBonus: 2, floorClearBonusPerFloor: 1,
  // BOSS REWARD — flat and depth-scaled, deliberately NOT a percentage. Boss n sits
  // on floor 10n and pays bossShardsPerWard × n, so it scales the same way the rest
  // of the economy does (floor-clear bonus is 2 + floor; gold is 2 + 0.5 × floor —
  // both linear in depth). 30 × n gives 30 at floor 10 rising to 300 at floor 100,
  // the planned ten wards. A single boss can override it with shardReward in BOSS_DEFS.
  bossShardsPerWard: 30
 },

 // ---------- GOLD ----------
 // goldKillPerFloor was 0.5, but the ACTUAL per-kill growth comes from
 // goldCurveK (3.0 × ln(floor+1)) in js/rewards.js, which dwarfs it. Measured,
 // a full 50-floor run paid out ~13,100 gold — enough to buy every shop's stock
 // and still finish rich. The log term is now 1.6, which keeps early floors
 // almost identical and cuts the deep floors, where the money piled up.
 goldKillBase: 2, goldKillPerFloor: 0.5, goldBossBase: 80,

 // ---------- BARRELS ----------
 barrel: { goldChance: 0.40, goldMin: 1, goldMax: 3 },

 // ---------- SHOP ----------
 // healPct 0.5 with no cap meant the shop was an unlimited heal station: any
 // amount of gold bought full health, five times a run. Every shop visit now
 // sells a limited number of heals (healStock), each restoring healPct, so gold
 // buys sustain but cannot buy immortality.
 shop: { offset: 5, stockConsumables: 4, stockGear: 1, healPct: 0.5, healStock: 2 },

 // ---------- STATUS EFFECTS ----------
 STATUS_EFFECTS: {
  poison: { name:"Poison", perTurn:3, turns:3, stackable:false, appliedBy:"weaponOrConsumable", color:"#a855f7" },
  bleed:  { name:"Bleed",  perTurn:3, turns:2, stackable:true,  appliedBy:"weapon", color:"#ef4444" },
  burn:   { name:"Burn",   perTurn:4, turns:2, stackable:false, appliedBy:"ability", color:"#f97316" },
  weaken: { name:"Weaken", pct:0.30, turns:2, stackable:false, appliedBy:"wraith", color:"#64748b" },
  // Chill: halves the player's attack speed while it lasts (read by
  // items.js playerSpeed). Turns tick down on the player's swings.
  chill:  { name:"Chill",  pct:0.50, turns:2, stackable:false, appliedBy:"enemy",  color:"#a8e8ff" }
 },

 // ---------- WEAPON ON-HIT STATUS CHANCES (by tier) ----------
 statusChance: {
  poison: { 1:0.10, 2:0.14, 3:0.18, 4:0.22 },
  bleed:  { 1:0.08, 2:0.11, 3:0.14, 4:0.17 },
  burn:   { 1:0.06, 2:0.09, 3:0.12, 4:0.15 }
 },

 // ---------- EQUIPMENT SLOTS ----------
 SLOTS: {
  weapon:  { label:"Weapon",  icon:"⚔", unlock:0 },
  offhand: { label:"Off-hand", icon:"🛡", unlock:80 },
  head:    { label:"Head",    icon:"⛑", unlock:0 },
  body:    { label:"Body",    icon:"🛡", unlock:0 },
  hands:   { label:"Hands",   icon:"🧤", unlock:0 },
  feet:    { label:"Feet",    icon:"👢", unlock:0 },
  cloak:   { label:"Cloak",   icon:"🧣", unlock:0 },
  amulet:  { label:"Amulet",  icon:"📿", unlock:0 },
  ring1:   { label:"Ring",    icon:"💍", unlock:0 },
  ring2:   { label:"Ring II", icon:"💍", unlock:120 }
 },
 SLOT_ORDER: ["weapon","offhand","head","body","hands","feet","cloak","amulet","ring1","ring2"],

 // ---------- ARMOUR WEIGHT (trade-offs) ----------
 WEIGHT: {
  light:  { name:"Light",  speed:0.05, dodge:0.04 },
  medium: { name:"Medium", speed:0.00, dodge:0.00 },
  heavy:  { name:"Heavy",  speed:-0.18, dodge:-0.06 }
 },
 weightMitigation: { strPerPoint:0.01, speedPenaltyFloor:-0.04 },

 // ---------- XP & LEVEL-UPS ----------
 XP_CURVE: [4, 9, 16, 25, 36, 50, 66],
 xpWardStep: 2,
 // Abilities are uncapped: 0 means "no limit". They are the long-term run
 // progression now, so addAbility appends and never drops the oldest.
 levelMaxAbilities: 0,
 // Energy per kill was 1, which made abilities nearly unusable: a 4-cost spell
 // needed four kills, and a plain attack is free. Measured against the original
 // numbers, ONE kill now funds most of a single ability instead of a quarter of
 // one. This is the single most important number in the ability economy.
 energyPerKill: 3,
 // Energy cap = starting pool + this. 10 + 90 = 100, the old hardcoded cap.
 energyCapOverStart: 90,

 // ---------- WEAPON SPEEDS ----------
 WEAPON_SPEEDS: { spear:0.95, sword:1.00, dagger:1.40, axe:0.85, hammer:0.70 },

 // ---------- INVENTORY ----------
 inventorySlots: 16,
 inventoryMax: 24,

 // ---------- LOOT ----------
 loot: {
  baseDrop: 0.22, luckDrop: 0.025, dropCap: 0.45,
  cacheBase: 0.08, cacheLuck: 0.015,

  // An elite already pays x3 gold/shards/XP and a potion. This is its missing
  // loot edge — before, the elite flag was only a label on the dropped item.
  eliteDropBonus: 0.25,

  // Rarity multipliers by source, applied to the rare + legendary weights only.
  // Special sources are where a legendary should actually come from.
  sourceRarityMult: { chest: 1.5, treasure: 3, elite: 2, boss: 3 },

  // Tier weights. Depth is the dominant factor, Luck a real second one:
  //   legendary = (base + perFloor * floor) * (1 + perLuck * luck)
  // Floor 1 with low Luck is a near-impossibility by design; the top floors of a
  // 10-biome run are where the odds become real. No ward count is baked in, so
  // adding biomes needs no change here — and each biome can tune its own
  // `lootRarityMult` in con-biomes.js.
  legendaryBase: 0.02, legendaryPerFloor: 0.02, legendaryPerLuck: 0.08,
  rareBase: 5, rarePerLuck: 3, rarePerWard: 1.5,

  weights: {
   common: () => 100,
   uncommon: luck => 40 + luck*6,
   rare: (luck, ward) => {
    const l = Delve.CONFIG.loot;
    return l.rareBase + luck*l.rarePerLuck + (ward || 1)*l.rarePerWard;
   },
   legendary: (luck, ward, floor) => {
    const l = Delve.CONFIG.loot;
    const f = Math.max(0, Number(floor) || 0);
    const L = Math.max(0, Number(luck) || 0);
    return (l.legendaryBase + l.legendaryPerFloor*f) * (1 + l.legendaryPerLuck*L);
   }
  }
 },

 // ---------- ITEMS OVERHAUL ----------
 // Every number here is sim-locked. Change it only with a new sim run.
 ITEMS: {
  // Quality: continuous 1-100. Floor is the dominant term, Luck a real second.
  //   Q = min(cap, floorScale*floor + luckScale*luck) + gaussian(0, sigma)
  //   sigma = noiseBase + noiseFloor*floor     points = Q * perPoint
  quality: { floorScale:2.5, luckScale:3.0, cap:100, noiseBase:5, noiseFloor:0.3, perPoint:0.2 },
  // Display bands only - never used for maths. Upper bound exclusive.
  bands: [20, 40, 60],

  // What one point buys. 1 ATK = 2 points is the validated anchor; every other
  // entry was swept against it (budget_validation.md).
  // Economy stats are priced off the same 1 ATK = 2 point anchor:
  // 5% gold = 0.8, 3% drop = 0.8, 2 boss damage = 1.0, 1 shard = 1.0,
  // 1 life-on-kill = 1.8 (it is a small permanent heal, worth more than HP).
  pointCost: { atk:2.0, str:1.0, hp:0.6, crit:0.4, red:3.8, dodge:0.7, speed:0.7, luck:1.2,
               goldBonus:0.16, dropBonus:0.2667, bossAtk:0.5, shardBonus:1.0, healOnKill:1.8 },

  // Gear and potions roll separately (L5).
  // Owner's call: gear drops are ONE THIRD of the previous 30% rate — 10% base
  // per kill, with the Luck step cut to match (0.03 -> 0.01) so depth cannot
  // claw the rate back.
  // Potions now TAPER with depth: 14% in the first two wards, 10% in the third,
  // 7% from the fourth on. A flat 14% across fifty floors meant sustain never
  // became scarce, so a bad floor was always patched by the next few kills.
  // Chests stay common (0.75) and the floor-1 starter gear is untouched, so a
  // run still opens with something in hand.
  drop: { gearBase:0.10, gearPerLuck:0.01,
         potionByWard: { 1:0.14, 2:0.14, 3:0.10, 4:0.07, 5:0.07 },
         potion:0.14, cap:0.85,
         chestChanceBase:0.75, chestChanceLuck:0.02, chestChanceCap:0.95 },

  // Slot weights (L6). Weapon drops less often than it used to, rings and
  // amulets are genuinely rare.
  slotWeights: { weapon:2.0, body:1.5, head:1.0, hands:1.0, feet:1.0, cloak:0.9, offhand:0.5, ring:0.4, amulet:0.35 },

  // price = points * (base + perWard * ward); sell = points * sellPerPoint.
  // Holds 28-34% of arrival gold at every shop (price_formula.md).
  price: { base:19, perWard:24, sellPerPoint:4 },

  // The weapon is the offence slot: it absorbs the kit's offence share, so its
  // budget is multiplied by this before it buys damage. Without it, six slots
  // of points leave the player at ~3.3s per kill on floor 15 (measured), about
  // half of today's pace - the defence points on armour do not kill anything.
  weaponShare: 2.0,

  // Character level growth (LOCKED). Applied in attrs.js.
  levelAtk: 1, levelHp: 2,

  // Affix counts per display band: Common none, Uncommon 1, Rare 2, Legendary 3.
  affixes: { 1:0, 2:1, 3:2, 4:3, maxPrefix:1, maxSuffix:2 },

  // Uniques never roll from a plain kill and never appear in shop stock.
  unique: { chestChance:0.10, secretChance:0.25, bossChance:1.0 }
 },

 // Family rhythm. Damage comes from quality, so these are shape/speed/cap only.
 // maxHit = min(itemMax + Strength, itemMax + strCeiling); minHit = shape*itemMax.
 // strCeiling caps how much Strength a family can absorb, and it was the HARD
 // CEILING on player damage: with sword strCeiling 16 and a best-roll itemMax of
 // ~25, the strongest possible sword swing was ~41 damage at every depth from
 // floor 25 onward. Monster attack, meanwhile, grows linearly (atkPerFloor ~1.0
 // for the deep species, reaching 41-49 by floor 40), so incoming damage passed
 // outgoing and each fight cost 59-123% of max HP by ward 4. Raising the
 // ceilings lets the deep game keep pace without touching any per-hit numbers
 // early: a floor-1 character cannot reach these values anyway, because they
 // are bounded by Strength, which is bought with gold.
 WEAPON_FAMILIES: {
  dagger: { shape:0.45, critBonus:0.05, strCeiling:20, speed:1.40, label:"Dagger" },
  sword:  { shape:0.65, critBonus:0.00, strCeiling:34, speed:1.00, label:"Sword" },
  spear:  { shape:0.75, critBonus:0.00, strCeiling:34, speed:0.95, label:"Spear" },
  axe:    { shape:0.55, critBonus:0.00, strCeiling:38, speed:0.85, label:"Axe" },
  hammer: { shape:0.70, critBonus:0.00, strCeiling:46, speed:0.70, label:"Hammer" }
 }
};
