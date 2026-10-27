window.Delve = window.Delve || {};
(function(){

 // con-itemaffixes.js : CONTENT for the hybrid item system.
 // Base items (names, lore, styles) stay in con-items.js. This file owns the
 // affix pool, the slot stat affinities and the hand-written uniques.
 // Depends on: nothing at load time (items.js reads it at call time).

 // ── Slot -> stat affinity ──────────────────────────────────────
 // Each slot spends its BASE points (quality budget minus affixes) down one of
 // these weight tables. This is the creative contract from the design doc 3.2:
 // Strength lives on weapons, defence on armour, magic/utility on accessories.
 Delve.SLOT_AFFINITY = {
  offhand: { red:0.50, hp:0.30, dodge:0.20 },
  head:    { hp:0.45, red:0.25, dodge:0.20, crit:0.10 },
  body:    { hp:0.50, red:0.35, dodge:0.15 },
  hands:   { atk:0.45, speed:0.30, red:0.25 },
  feet:    { dodge:0.55, speed:0.45 },
  cloak:   { dodge:0.40, luck:0.35, speed:0.25 },
  amulet:  { luck:0.35, crit:0.20, goldBonus:0.20, dropBonus:0.15, bossAtk:0.10 },
  ring:    { luck:0.30, crit:0.25, atk:0.25, goldBonus:0.20 }
 };

 // ── Affix pool ─────────────────────────────────────────────────
 // `pts` is the point cost (design doc 3.4). Affixes are carved OUT of the
 // item's budget, never added on top, so power stays flat across the curve.
 // `group` limits which slots can roll it. `kind` is "pct" (fraction) or "flat".
 // Affix values are fixed: an affix is worth its points, never more.
 function A(id, name, group, stat, per, pts, kind){
  return { id:id, name:name, group:group, stat:stat, per:per, pts:pts, kind:kind||"flat" };
 }

 Delve.ITEM_AFFIXES = {
  prefixes: [
   A("heavy","Heavy",["armour"],"atk",1,2.0),
   A("strong","Strong",["weapon"],"str",1,1.0),
   A("keen","Keen",["weapon","accessory"],"crit",0.01,0.4,"pct"),
   A("warded","Warded",["armour","offhand"],"red",1,3.8),
   A("bear","Bear's",["armour"],"hp",5,3.0),
   A("nimble","Nimble",["armour","cloak","feet"],"dodge",0.01,0.7,"pct"),
   A("fleet","Fleet",["weapon","hands","feet"],"speed",0.01,0.7,"pct"),
   A("lucky","Lucky",["accessory","cloak"],"luck",1,1.2),
   A("gilded","Gilded",["accessory"],"goldBonus",0.05,0.8,"pct"),
   A("scavenger","Scavenger's",["accessory"],"dropBonus",0.03,0.8,"pct"),
   A("warden","Warden's",["amulet","weapon"],"bossAtk",2,1.0),
   A("soulbound","Soulbound",["amulet","weapon"],"shardBonus",1,1.0),
   A("leeching","Leeching",["weapon","ring"],"healOnKill",1,1.8),
   A("cruel","Cruel",["weapon"],"status:bleed",0.04,0.8,"pct"),
   A("venomous","Venomous",["weapon"],"status:poison",0.04,0.8,"pct"),
   A("ember","Ember",["weapon"],"status:burn",0.03,0.8,"pct")
  ],
  suffixes: [
   A("of_the_fox","of the Fox",["armour","accessory"],"dodge",0.01,0.7,"pct"),
   A("of_the_bear","of the Bear",["armour"],"hp",5,3.0),
   A("of_warding","of Warding",["armour","offhand"],"red",1,3.8),
   A("of_haste","of Haste",["weapon","hands","feet"],"speed",0.01,0.7,"pct"),
   A("of_fortune","of Fortune",["accessory"],"goldBonus",0.05,0.8,"pct"),
   A("of_plunder","of Plunder",["accessory"],"dropBonus",0.03,0.8,"pct"),
   A("of_the_magpie","of the Magpie",["accessory","cloak"],"luck",1,1.2),
   A("of_ruin","of Ruin",["weapon"],"crit",0.01,0.4,"pct"),
   A("of_the_warden","of the Warden",["amulet","weapon"],"bossAtk",2,1.0),
   A("of_echoes","of Echoes",["amulet"],"shardBonus",1,1.0),
   A("of_thirst","of Thirst",["weapon","ring"],"healOnKill",1,1.8),
   A("of_the_viper","of the Viper",["weapon"],"status:poison",0.04,0.8,"pct")
  ]
 };

 // ── Uniques ────────────────────────────────────────────────────
 // Hand-written, fixed stats (NOT budget-scaled), one bespoke line each.
 // They never roll on a plain kill and never appear in shop stock: chests,
 // secrets and ward bosses only. `proc` is read by combat.js.
 Delve.ITEM_UNIQUES = [
  { id:"thornbite", name:"Thornbite", slot:"weapon", style:"dagger", tier:4,
    itemMax:9.5, crit:0.10, status:"poison", luck:1,
    lore:"The thorn remembers the hand that pulled it.",
    flavour:"Poison on every cut. It has never needed to be quick." },

  { id:"sunsplinter", name:"Sunsplinter", slot:"weapon", style:"sword", tier:4,
    itemMax:12.0, speedBonus:0.08, bossAtk:3,
    lore:"A shard of something that used to be a morning.",
    flavour:"Fast for a sword, and cruel to wardens." },

  { id:"gravemaker", name:"Gravemaker", slot:"weapon", style:"hammer", tier:4,
    itemMax:17.0, proc:"execute",
    lore:"It does not break bones. It persuades them.",
    flavour:"+30% damage to anything below 30% Health." },

  { id:"bastion_of_ash", name:"Bastion of Ash", slot:"offhand", tier:4,
    red:2, hp:12, dodge:0.02,
    lore:"Held up in a burning hall. Still warm.",
    flavour:"The fire took the shield's owner, not the shield." },

  { id:"cartographers_eye", name:"The Cartographer's Eye", slot:"head", tier:4,
    hp:8, luck:2, dropBonus:0.05,
    lore:"It only ever looked down.",
    flavour:"You find more, because you notice more." },

  { id:"shroud_of_the_deep", name:"Shroud of the Deep", slot:"body", tier:4,
    hp:20, red:2, dodge:0.04,
    lore:"Cut from the dark between two floors.",
    flavour:"Armour that behaves like a held breath." },

  { id:"gravewrights_grips", name:"Gravewright's Grips", slot:"hands", tier:4,
    atk:2, speedBonus:0.06, red:1,
    lore:"Dirt under the nails that will not wash out.",
    flavour:"Quick hands, and the strength to use them." },

  { id:"silent_step", name:"Silent Step", slot:"feet", tier:4,
    speedBonus:0.04, dodge:0.07,
    lore:"Whoever wore these last is still not heard.",
    flavour:"Nothing follows you that you did not invite." },

  { id:"mothlight_mantle", name:"Mothlight Mantle", slot:"cloak", tier:4,
    luck:2, goldBonus:0.08, dodge:0.02,
    lore:"Woven from the dust of a very old lamp.",
    flavour:"Fortune likes a patient silhouette." },

  { id:"ninth_coin", name:"The Ninth Coin", slot:"amulet", tier:4,
    luck:3, goldBonus:0.06, dropBonus:0.04,
    lore:"The tenth coin was the payment. This is the change.",
    flavour:"Luck, and the money luck brings." },

  { id:"small_mercies", name:"Loop of Small Mercies", slot:"ring", tier:4,
    luck:1, healOnKill:2,
    lore:"A plain band, worn thin at the inside.",
    flavour:"Every kill gives a little back." },

  { id:"ledger_band", name:"Band of the Ledger", slot:"ring", tier:4,
    goldBonus:0.10, shardBonus:1,
    lore:"Somebody balanced a whole life in this ring.",
    flavour:"Gold and shards, counted twice." }
 ];

 Delve.uniqueById = function(id){
  const list = Delve.ITEM_UNIQUES || [];
  for(let i = 0; i < list.length; i++) if(list[i].id === id) return list[i];
  return null;
 };

})();
