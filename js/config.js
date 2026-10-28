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
  baseInterval: 600,
  speedPerAgi: 0.05
 },

 // ---------- RUN STRUCTURE ----------
 bossEvery: 10,
 healOnDescendPct: 0.5,

 // ---------- REST MECHANIC ----------
 restHealPct: 0.06,
 restMinHeal: 1,
 restPerFloor: 3,
 
 // ---------- ECONOMY (sim-locked shard pacing) ----------
  economy: {
  goldCurveType: "log", goldCurveK: 3.0, goldLuckMult: 0.05,
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
 goldKillBase: 2, goldKillPerFloor: 0.5, goldBossBase: 80,

 // ---------- BARRELS ----------
 barrel: { goldChance: 0.40, goldMin: 1, goldMax: 3 },

 // ---------- SHOP ----------
 shop: { offset: 5, stockConsumables: 4, stockGear: 1, healPct: 0.5 },

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
 energyPerKill: 1,
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

 // ---------- ITEMS OVERHAUL (docs/results/items_overhaul.md) ----------
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

  // Gear and potions roll separately (L5). Gear: 15.5% + 2.5pp per Luck = 18%
  // at Luck 1. Potions: flat 7%.
  drop: { gearBase:0.155, gearPerLuck:0.025, potion:0.07, cap:0.60 },

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
 WEAPON_FAMILIES: {
  dagger: { shape:0.45, critBonus:0.05, strCeiling:10, speed:1.40, label:"Dagger" },
  sword:  { shape:0.65, critBonus:0.00, strCeiling:16, speed:1.00, label:"Sword" },
  spear:  { shape:0.75, critBonus:0.00, strCeiling:16, speed:0.95, label:"Spear" },
  axe:    { shape:0.55, critBonus:0.00, strCeiling:18, speed:0.85, label:"Axe" },
  hammer: { shape:0.70, critBonus:0.00, strCeiling:22, speed:0.70, label:"Hammer" }
 }
};
