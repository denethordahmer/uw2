window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-traits.js : trait + ability definitions (data only) ──

 C.TRAITS = {
  // ── Passives: 12 lines, 3 ranks each, grouped under 4 tags ──
  // `effects` is what rank I gives; `perRank` is the step to rank II and III.
  // Picking a line you already own offers its next rank instead of a duplicate,
  // so the same card is both "more of this" and a real build decision.
  // (Merged: Light Feet → Evasive, Hardened Bones → Thick Hide, Iron Will →
  // the Unbroken unique, Brute Force dropped — four cards that only repeated
  // something another card already did.)
  passives: [
   // EDGE — raw offence
   { id:"sharpened_edge", name:"Sharpened Edge", tag:"Edge", maxRank:3, rarity:"common",
     desc:"+2 Attack Power per rank", effects:{ atk:2 }, perRank:{ atk:2 } },
   { id:"studied_reflexes", name:"Studied Reflexes", tag:"Edge", maxRank:3, rarity:"uncommon",
     desc:"+6% Critical Chance per rank", effects:{ crit:0.06 }, perRank:{ crit:0.06 } },
   { id:"swift_hands", name:"Swift Hands", tag:"Edge", maxRank:3, rarity:"uncommon",
     desc:"+8% Attack Speed per rank", effects:{ speedBonus:0.08 }, perRank:{ speedBonus:0.08 } },

   // IRON — survival
   { id:"thick_hide", name:"Thick Hide", tag:"Iron", maxRank:3, rarity:"common",
     desc:"+6 Maximum Health per rank", effects:{ maxHp:6 }, perRank:{ maxHp:6 } },
   { id:"bulwark_plate", name:"Bulwark Plate", tag:"Iron", maxRank:3, rarity:"uncommon",
     desc:"+1 flat Damage Reduction per rank", effects:{ flatRed:1 }, perRank:{ flatRed:1 } },
   { id:"evasive", name:"Evasive", tag:"Iron", maxRank:3, rarity:"uncommon",
     desc:"+4% Dodge per rank", effects:{ dodge:0.04 }, perRank:{ dodge:0.04 } },

   // BLOOD — sustain
   { id:"bloodthirst", name:"Bloodthirst", tag:"Blood", maxRank:3, rarity:"rare",
     desc:"Heal 2 HP per kill, per rank", effects:{ healOnKill:2 }, perRank:{ healOnKill:2 } },
   { id:"field_dressing", name:"Field Dressing", tag:"Blood", maxRank:3, rarity:"uncommon",
     desc:"Heal 3 HP per floor cleared, per rank", effects:{ healPerFloor:3 }, perRank:{ healPerFloor:3 } },
   { id:"ember_blood", name:"Ember Blood", tag:"Blood", maxRank:3, rarity:"rare",
     desc:"+1 Energy per kill, per rank", effects:{ extraEnergyPerKill:1 }, perRank:{ extraEnergyPerKill:1 } },

   // GREED — run economy
   { id:"coin_pusher", name:"Coin Pusher", tag:"Greed", maxRank:3, rarity:"common",
     desc:"+10% Gold Find per rank", effects:{ goldMult:0.10 }, perRank:{ goldMult:0.10 } },
   { id:"deep_sight", name:"Deep Sight", tag:"Greed", maxRank:3, rarity:"rare",
     desc:"+5% Item Find per rank", effects:{ dropBonus:0.05 }, perRank:{ dropBonus:0.05 } },
   { id:"fortunes_nod", name:"Fortune's Nod", tag:"Greed", maxRank:3, rarity:"common",
     desc:"+1 Luck per rank", effects:{ luck:1 }, perRank:{ luck:1 } }
  ],

  // Set bonuses, counted in total RANKS within a tag (not in passives owned),
  // with two tiers at 3 and 6. Rank II of one line counts twice, so a focused
  // build and a broad one both reach the first tier.
  sets: {
   Edge:  { tiers:[ { ranks:3, effects:{ atk:1 } },        { ranks:6, effects:{ crit:0.10 } } ] },
   Iron:  { tiers:[ { ranks:3, effects:{ flatRed:2 } },    { ranks:6, effects:{ maxHp:12 } } ] },
   Blood: { tiers:[ { ranks:3, effects:{ healOnKill:1 } }, { ranks:6, effects:{ extraEnergyPerKill:2 } } ] },
   Greed: { tiers:[ { ranks:3, effects:{ goldMult:0.08 } },{ ranks:6, effects:{ dropBonus:0.04 } } ] }
  },
  uniques: [
   { id:"vampiric_strike", name:"Vampiric Strike", desc:"Critical hits heal for half the damage dealt", unique:true, effects:{ vampiric:true } },
   { id:"wardens_oath", name:"Warden's Oath", desc:"Second Wind heals 50% instead of 30%", unique:true, effects:{ secondWindHealOverride:0.50 } },
   { id:"unbroken", name:"Unbroken", desc:"Survive one killing blow at 1 HP, once", unique:true, effects:{ unbroken:true } },
   { id:"deep_pockets", name:"Deep Pockets", desc:"+50% Gold Find for the rest of the run", unique:true, effects:{ goldMult:0.50 } }
  ],
   abilities: [
   // `data` carries the numbers castAbility uses; `perRank*` fields are per-rank
   // deltas that castAbility reads whenever the matching abilityRank shard-tree
   // node is owned (Cleave II, Lunge II, Stone Skin II, Rally II, Blink II,
   // Cinderbolt II).
   { id:"cleave", name:"Cleave", cost:4, target:"adjacent",
     desc:"Hit target and every enemy adjacent to it",
     data:{ bonusAtk:0, perRank:4 } },
   { id:"lunge", name:"Lunge", cost:5, target:"line4",
     desc:"Dash in a straight line up to 4 tiles and strike",
     data:{ range:4, bonusAtk:4, perRank:4 } },
   { id:"stone_skin", name:"Stone Skin", cost:6, target:"self",
     desc:"Take 60% less damage for 2 turns",
     data:{ turns:2, dmgMult:0.4, perRankTurns:1 } },
   { id:"cinderbolt", name:"Cinderbolt", cost:4, target:"range5",
     desc:"10 damage, ignores armour, no retaliation, applies Burn",
     data:{ range:5, dmg:10, burnTurns:2, perRankDmg:4, perRankBurn:1 } },
   { id:"rally", name:"Rally", cost:7, target:"self",
     desc:"Heal 35% max HP and clear bleed",
     data:{ healPct:0.35, perRankHeal:0.10 } },
   { id:"blink", name:"Blink", cost:5, target:"teleport4",
     desc:"Teleport to a visible empty tile within 4",
     data:{ range:4, perRankRange:1 } },
   { id:"whirlwind", name:"Whirlwind", cost:8, target:"self",
     desc:"Strike every adjacent enemy at once",
     data:{ bonusAtk:0, perRank:0 } },

   // ── Second wave (abilities are uncapped, so the pool has to be deep) ──
   // One entry per archetype, all built from primitives castAbility already
   // uses: hurt(), applyEffect(poison|bleed|burn), healing and energy.
   { id:"crushing_blow", name:"Crushing Blow", cost:6, target:"adjacent",
     desc:"A heavy overhead strike: double attack power on one adjacent enemy",
     data:{ mult:2.0, perRankMult:0.5 } },
   { id:"rend", name:"Rend", cost:5, target:"adjacent",
     desc:"Strike and leave the target bleeding",
     data:{ bonusAtk:2, perRank:3 } },
   { id:"rupture", name:"Rupture", cost:8, target:"adjacent",
     desc:"Tear an adjacent enemy for heavy damage — doubles against a bleeding one",
     data:{ dmg:10, bleedMult:2.0, perRankDmg:4 } },
   { id:"leech", name:"Leech", cost:6, target:"adjacent",
     desc:"Drain an adjacent enemy, healing half the damage dealt",
     data:{ bonusAtk:2, healPct:0.5, perRankHeal:0.15 } },
   { id:"venom_dart", name:"Venom Dart", cost:4, target:"range5",
     desc:"6 damage at range, and poisons the target",
     data:{ range:5, dmg:6, perRankDmg:3 } },
   { id:"siphon", name:"Siphon", cost:5, target:"range4",
     desc:"6 damage at range and refund 3 energy",
     data:{ range:4, dmg:6, refund:3, perRankDmg:3 } },
   { id:"meteor", name:"Meteor", cost:9, target:"range5",
     desc:"Smash a target and everything beside it",
     data:{ range:5, dmg:14, splash:10, perRankDmg:5 } },
   { id:"tremor", name:"Tremor", cost:7, target:"self",
     desc:"Shake the floor: damage every enemy within 2 tiles",
     data:{ radius:2, dmg:8, perRankDmg:4 } },
   { id:"brace", name:"Brace", cost:3, target:"self",
     desc:"Recover 15% HP and clear poison and bleed",
     data:{ healPct:0.15, perRankHeal:0.05 } }
  ]
 };
})();
