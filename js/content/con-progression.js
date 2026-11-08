window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-progression.js : shard-tree definitions (data only) ──
 // Adding a node: one entry in NODES.<tree>, same rules as the rest.
 // `type` must be a type the engine consumes — see the Source of Truth
 // vocabulary list before inventing a new one.

 C.PROGRESSION = {
  TREES: [
   { id:"attrs", name:"Attributes" },
   { id:"kit", name:"Kit" },
   { id:"martial", name:"Martial" },
   { id:"instinct", name:"Instinct" },
   { id:"survival", name:"Survival" },
   { id:"fortune", name:"Fortune" }
  ],

  NODES: {
   kit: [
    // ── SHARD-BOUGHT STARTING GEAR ───────────────────────────────
    // Items bought permanently with shards and equipped at the start of every
    // run. They exist because the permanent tree was all utility: a player could
    // own 25 nodes and still start floor 1 with a tier-1 sword. These are the
    // "I got stronger between runs" items — each one visibly upgrades what you
    // walk in with, and each is gated behind the previous so the ladder reads as
    // a ladder.
    //
    // `tier` is the ITEM tier handed to makeGear; `gearSlot` is where it goes.
    // Prices climb steeply because these are permanent power, not consumables.
    { id:"kit_blade", tier:1, name:"Whetted Blade",
      desc:"Start every run with an Uncommon sword.", cost:120,
      type:"startGear", gearSlot:"weapon", gearTier:2, gearStyle:"sword" },
    { id:"kit_armour", tier:1, name:"Boiled Leather",
      desc:"Start every run with an Uncommon body armour.", cost:120,
      type:"startGear", gearSlot:"body", gearTier:2 },
    { id:"kit_blade_ii", tier:2, name:"Forged Blade",
      desc:"Upgrade the starting sword to Rare.", cost:280,
      type:"startGear", gearSlot:"weapon", gearTier:3, gearStyle:"sword", req:"kit_blade" },
    { id:"kit_armour_ii", tier:2, name:"Riveted Plate",
      desc:"Upgrade the starting armour to Rare.", cost:280,
      type:"startGear", gearSlot:"body", gearTier:3, req:"kit_armour" },
    { id:"kit_ring", tier:2, name:"Inherited Ring",
      desc:"Start every run with an Uncommon ring.", cost:220,
      type:"startGear", gearSlot:"ring1", gearTier:2 },
    { id:"kit_amulet", tier:3, name:"Founder's Charm",
      desc:"Start every run with a Rare amulet.", cost:360,
      type:"startGear", gearSlot:"amulet", gearTier:3 },
    { id:"kit_blade_iii", tier:3, name:"Masterwork Blade",
      desc:"Upgrade the starting sword to Legendary.", cost:600,
      type:"startGear", gearSlot:"weapon", gearTier:4, gearStyle:"sword", req:"kit_blade_ii" },
    { id:"kit_armour_iii", tier:4, name:"Warden's Plate",
      desc:"Upgrade the starting armour to Legendary.", cost:600,
      type:"startGear", gearSlot:"body", gearTier:4, req:"kit_armour_ii" },

    { id:"offhand", tier:1, name:"Off-hand Training", desc:"Unlock the Off-hand equipment slot.", cost:80, type:"slotUnlock", slot:"offhand" },
    { id:"field_pack", tier:1, name:"Field Pack", desc:"Increase bag capacity to 20.", cost:50, type:"inventory", cap:20 },
    { id:"quartermaster", tier:1, name:"Quartermaster", desc:"Start every run with one random Common armour.", cost:60, type:"startItem" },
    { id:"second_ring", tier:2, name:"Second Ring", desc:"Unlock the second Ring slot.", cost:120, type:"slotUnlock", slot:"ring2" },
    { id:"deep_pack", tier:2, name:"Deep Pack", desc:"Increase bag capacity to 24. Requires Field Pack.", cost:130, type:"inventory", cap:24, req:"field_pack" },
    { id:"provisioner", tier:2, name:"Provisioner", desc:"Start every run with one random consumable.", cost:100, type:"startConsumable" },
    { id:"field_kit", tier:3, name:"Field Kit", desc:"Consumables heal 15% more while you have this.", cost:110, type:"consumableHeal", healBonus:0.15 },
    { id:"alchemist", tier:3, name:"Alchemist", desc:"Cures also restore 15% Health.", cost:90, type:"cureHeal", healBonus:0.15 },
    { id:"sealed_cache", tier:3, name:"Sealed Cache", desc:"Every floor contains one guaranteed chest.", cost:180, type:"chestGuarantee" },
    { id:"master_provisioner", tier:4, name:"Master Provisioner", desc:"Start with two consumables and 25 gold.", cost:200, type:"startKit", req:"provisioner" }
   ],
   martial: [
    { id:"weapon_drill_1", tier:1, name:"Weapon Drill I", desc:"+1 permanent Attack Power.", cost:25, type:"flatAtk", atk:1 },
    { id:"footwork", tier:1, name:"Footwork", desc:"+2% permanent Dodge.", cost:25, type:"flatDodge", dodge:0.02 },
    { id:"cleave", tier:1, name:"Cleave", desc:"Learn the Cleave ability.", cost:50, type:"ability", ability:"cleave" },
    { id:"weapon_drill_2", tier:2, name:"Weapon Drill II", desc:"+2 permanent Attack Power. Requires Weapon Drill I.", cost:60, type:"flatAtk", atk:2, req:"weapon_drill_1" },

    // ── DEPTH-SCALED POWER ───────────────────────────────────────
    // The tree used to top out at +3 Attack, +6 Health and +1 flat Damage
    // Reduction across all 49 nodes and 5,030 shards, while monster attack grows
    // by about 1 per floor (9 at floor 9 → 50 at floor 49). Between-run progress
    // is the point of the game, so the deepest martial/survival nodes now scale
    // with the ward you are in. They are gated behind the flat nodes, so a new
    // save cannot buy them and the early game is untouched.
    { id:"steel_discipline", tier:3, name:"Steel Discipline",
      desc:"+2 Attack Power per ward reached (up to +10).",
      cost:280, type:"atkWard", perWard:2, max:10, req:"weapon_drill_2" },
    { id:"iron_constitution", tier:4, name:"Iron Constitution",
      desc:"+12 Maximum Health per ward reached (up to +60).",
      cost:320, type:"hpWard", perWard:12, max:60, req:"hardened_bones" },
    { id:"mastery", tier:4, name:"Mastery",
      desc:"+3 Attack Power per ward reached (up to +15). Requires Steel Discipline.",
      cost:420, type:"atkWard", perWard:3, max:15, req:"steel_discipline" },
    { id:"lunge", tier:2, name:"Lunge", desc:"Learn the Lunge ability.", cost:45, type:"ability", ability:"lunge" },
    { id:"cleave_ii", tier:2, name:"Cleave II", desc:"Cleave deals +4 damage. Requires Cleave.", cost:110, type:"abilityRank", ability:"cleave", req:"cleave" },
    { id:"overkill_mastery", tier:2, name:"Overkill Mastery", desc:"Overkill heals 75% of excess damage instead of 50%.", cost:120, type:"overkillPct", healPct:0.75 },
    { id:"wardens_bane", tier:3, name:"Warden's Bane", desc:"+10% damage against Ward bosses.", cost:140, type:"bossDamage", bossAtkPct:0.10 },
    { id:"lunge_ii", tier:3, name:"Lunge II", desc:"Lunge deals +4 damage. Requires Lunge.", cost:130, type:"abilityRank", ability:"lunge", req:"lunge" },
    { id:"cleave_iii", tier:3, name:"Cleave III", desc:"Cleave deals +4 more damage. Requires Cleave II and Bloodthirst.", cost:200, type:"abilityRank", ability:"cleave", req:"cleave_ii", traitReq:"bloodthirst" },
    { id:"executioner", tier:4, name:"Executioner", desc:"All weapon status chances +5% (poison, bleed, burn).", cost:220, type:"statusUp", statusPct:0.05 }
   ],
   instinct: [
    { id:"energy_well", tier:1, name:"Energy Well", desc:"+10 starting Energy.", cost:40, type:"startEnergy", energy:10 },
    { id:"stone_skin", tier:1, name:"Stone Skin", desc:"Learn the Stone Skin ability.", cost:45, type:"ability", ability:"stone_skin" },
    { id:"rally", tier:1, name:"Rally", desc:"Learn the Rally ability.", cost:55, type:"ability", ability:"rally" },
    { id:"blink", tier:2, name:"Blink", desc:"Learn the Blink ability.", cost:50, type:"ability", ability:"blink" },
    { id:"cinderbolt", tier:2, name:"Cinderbolt", desc:"Learn the Cinderbolt ability.", cost:60, type:"ability", ability:"cinderbolt" },
    { id:"stone_skin_ii", tier:2, name:"Stone Skin II", desc:"Stone Skin lasts 3 turns. Requires Stone Skin.", cost:110, type:"abilityRank", ability:"stone_skin", req:"stone_skin" },
    { id:"rally_ii", tier:2, name:"Rally II", desc:"Rally heals 45% instead of 35%. Requires Rally.", cost:120, type:"abilityRank", ability:"rally", req:"rally" },
    { id:"emberblood", tier:3, name:"Emberblood", desc:"+1 Energy per kill.", cost:80, type:"killEnergy", energyPerKill:1 },
    { id:"blink_ii", tier:3, name:"Blink II", desc:"Blink range increases to 5. Requires Blink.", cost:130, type:"abilityRank", ability:"blink", req:"blink" },
    { id:"cinderbolt_ii", tier:3, name:"Cinderbolt II", desc:"Cinderbolt deals 14 damage and Burns 3 turns. Requires Cinderbolt.", cost:130, type:"abilityRank", ability:"cinderbolt", req:"cinderbolt" },
    { id:"second_nature", tier:4, name:"Second Nature", desc:"All abilities cost 20% less Energy.", cost:240, type:"energyCostPct" }
   ],
   survival: [
    { id:"tough_hide", tier:1, name:"Tough Hide", desc:"+6 permanent Maximum Health.", cost:35, type:"flatHp", hp:6 },
    { id:"hardened_bones", tier:1, name:"Hardened Bones", desc:"+1 permanent Toughness.", cost:50, type:"flatStat", stat:"tou", amount:1 },
    { id:"salve_lore", tier:1, name:"Salve Lore", desc:"All healing +10%.", cost:40, type:"healPct", healBonus:0.10 },
    { id:"warding_charm", tier:2, name:"Warding Charm", desc:"+1 permanent flat Damage Reduction.", cost:80, type:"flatRed", red:1 },
    { id:"deep_lungs", tier:2, name:"Deep Lungs", desc:"+1 rest per floor.", cost:110, type:"restPlus", rests:1 },
    { id:"second_wind_upgrade", tier:2, name:"Second Wind Upgrade", desc:"Second Wind heals 40% instead of 30%.", cost:130, type:"secondWindPct", healPct:0.40 },
    { id:"iron_will", tier:3, name:"Last Stand", desc:"Survive one killing blow at 1 HP. Refreshes each floor.", cost:150, type:"ironWill" },
    { id:"veteran", tier:3, name:"Veteran", desc:"Start every run at Level 2 (one free trait).", cost:160, type:"startLevel" },
    { id:"wardens_oath", tier:4, name:"Oathbound", desc:"Second Wind triggers at 35% Health instead of 20%. Requires Second Wind Upgrade.", cost:220, type:"secondWindTriggerPct", trigger:0.35, req:"second_wind_upgrade" }
   ],
   fortune: [
    { id:"coinpurse", tier:1, name:"Coinpurse", desc:"Start every run with 25 gold.", cost:40, type:"startGold" },
    { id:"haggler", tier:1, name:"Haggler", desc:"+5% merchant discount.", cost:60, type:"discount", discount:0.05 },
    { id:"scavenger", tier:2, name:"Scavenger", desc:"+5% item drop chance.", cost:70, type:"dropPlus", dropPct:0.05 },
    { id:"coin_chest", tier:2, name:"Coin Chest", desc:"Start with 50 gold.", cost:90, type:"startGold", req:"coinpurse" },
    { id:"fortunes_favour", tier:2, name:"Fortune's Favour", desc:"+1 permanent Luck.", cost:90, type:"flatStat", stat:"luc", amount:1 },
    { id:"gilded_eye", tier:3, name:"Gilded Eye", desc:"+15% gold from all sources.", cost:100, type:"goldPlus", goldPct:0.15 },
    { id:"silver_tongue", tier:3, name:"Silver Tongue", desc:"+10% merchant discount. Requires Haggler.", cost:140, type:"discount", discount:0.10, req:"haggler" },
    { id:"lucky_find", tier:4, name:"Lucky Find", desc:"Chests roll one rarity tier higher.", cost:160, type:"chestTierUp" }
   ]
  }
 };
})();
