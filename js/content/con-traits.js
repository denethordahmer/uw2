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
   // 24 lines, 5 ranks each, four tags. Steps are deliberately SMALL: a full run
   // levels 10-14 times and sees five cards each time, so a card is one increment
   // of a long climb, not a jackpot. Rank V of a line lands near where the old
   // rank III did, so the totals are unchanged while the granularity is finer.
   // `rank` on a card is the rank it GRANTS, and a card may grant 2 or 3 ranks
   // (see `potency` in traits.js) — that is what "quality" means on the card.
   // EDGE — raw offence
   { id:"sharpened_edge", name:"Sharpened Edge", tag:"Edge", maxRank:5, rarity:"common",
     desc:"+1 Attack Power per rank", effects:{ atk:1 }, perRank:{ atk:1 } },
   { id:"studied_reflexes", name:"Studied Reflexes", tag:"Edge", maxRank:5, rarity:"uncommon",
     desc:"+3% Critical Chance per rank", effects:{ crit:0.03 }, perRank:{ crit:0.03 } },
   { id:"swift_hands", name:"Swift Hands", tag:"Edge", maxRank:5, rarity:"uncommon",
     desc:"+4% Attack Speed per rank", effects:{ speedBonus:0.04 }, perRank:{ speedBonus:0.04 } },
   { id:"executioner", name:"Executioner", tag:"Edge", maxRank:5, rarity:"rare",
     desc:"+4% damage to enemies below 30% health, per rank",
     effects:{ executeBonus:0.04 }, perRank:{ executeBonus:0.04 } },
   { id:"piercing", name:"Piercing", tag:"Edge", maxRank:5, rarity:"rare",
     desc:"Attacks ignore 0.5 enemy Damage Reduction per rank",
     effects:{ pierce:0.5 }, perRank:{ pierce:0.5 } },
   { id:"momentum", name:"Momentum", tag:"Edge", maxRank:5, rarity:"uncommon",
     desc:"+3% damage for each consecutive hit on the same enemy, per rank",
     effects:{ momentum:0.03 }, perRank:{ momentum:0.03 } },

   // IRON — survival
   { id:"thick_hide", name:"Thick Hide", tag:"Iron", maxRank:5, rarity:"common",
     desc:"+4 Maximum Health per rank", effects:{ maxHp:4 }, perRank:{ maxHp:4 } },
   { id:"bulwark_plate", name:"Bulwark Plate", tag:"Iron", maxRank:5, rarity:"uncommon",
     desc:"+0.6 flat Damage Reduction per rank", effects:{ flatRed:0.6 }, perRank:{ flatRed:0.6 } },
   { id:"evasive", name:"Evasive", tag:"Iron", maxRank:5, rarity:"uncommon",
     desc:"+2.5% Dodge per rank", effects:{ dodge:0.025 }, perRank:{ dodge:0.025 } },
   { id:"second_skin", name:"Second Skin", tag:"Iron", maxRank:5, rarity:"rare",
     desc:"+0.5 flat Damage Reduction and +1 Maximum Health per rank",
     effects:{ flatRed:0.5, maxHp:1 }, perRank:{ flatRed:0.5, maxHp:1 } },
   { id:"steadfast", name:"Steadfast", tag:"Iron", maxRank:5, rarity:"uncommon",
     desc:"+3% Damage Reduction while below half health, per rank",
     effects:{ lowHpRed:0.03 }, perRank:{ lowHpRed:0.03 } },
   { id:"sturdy", name:"Sturdy", tag:"Iron", maxRank:5, rarity:"common",
     desc:"+2 Maximum Health per rank and immunity to knockback",
     effects:{ maxHp:2, knockbackImmune:true }, perRank:{ maxHp:2 } },

   // BLOOD — sustain
   { id:"bloodthirst", name:"Bloodthirst", tag:"Blood", maxRank:5, rarity:"rare",
     desc:"Heal 1.5 HP per kill, per rank", effects:{ healOnKill:1.5 }, perRank:{ healOnKill:1.5 } },
   { id:"field_dressing", name:"Field Dressing", tag:"Blood", maxRank:5, rarity:"uncommon",
     desc:"Heal 2 HP per floor cleared, per rank", effects:{ healPerFloor:2 }, perRank:{ healPerFloor:2 } },
   { id:"ember_blood", name:"Ember Blood", tag:"Blood", maxRank:5, rarity:"rare",
     desc:"+0.6 Energy per kill, per rank", effects:{ extraEnergyPerKill:0.6 }, perRank:{ extraEnergyPerKill:0.6 } },
   { id:"bloodletter", name:"Bloodletter", tag:"Blood", maxRank:5, rarity:"uncommon",
     desc:"Bleed you inflict lasts 1 extra turn per rank",
     effects:{ bleedExtra:1 }, perRank:{ bleedExtra:1 } },
   { id:"last_gasp", name:"Last Gasp", tag:"Blood", maxRank:5, rarity:"rare",
     desc:"+5% damage while below 25% health, per rank",
     effects:{ lowHpDmg:0.05 }, perRank:{ lowHpDmg:0.05 } },
   { id:"reaver", name:"Reaver", tag:"Blood", maxRank:5, rarity:"uncommon",
     desc:"Heal 1 HP on a critical hit, per rank",
     effects:{ healOnCrit:1 }, perRank:{ healOnCrit:1 } },

   // GREED — run economy
   { id:"coin_pusher", name:"Coin Pusher", tag:"Greed", maxRank:5, rarity:"common",
     desc:"+6% Gold Find per rank", effects:{ goldMult:0.06 }, perRank:{ goldMult:0.06 } },
   { id:"deep_sight", name:"Deep Sight", tag:"Greed", maxRank:5, rarity:"rare",
     desc:"+3% Item Find per rank", effects:{ dropBonus:0.03 }, perRank:{ dropBonus:0.03 } },
   { id:"fortunes_nod", name:"Fortune's Nod", tag:"Greed", maxRank:5, rarity:"common",
     desc:"+0.6 Luck per rank", effects:{ luck:0.6 }, perRank:{ luck:0.6 } },
   { id:"prospector", name:"Prospector", tag:"Greed", maxRank:5, rarity:"uncommon",
     desc:"+8% chance a chest holds an extra item, per rank",
     effects:{ chestExtra:0.08 }, perRank:{ chestExtra:0.08 } },
   { id:"pawnbroker", name:"Pawnbroker", tag:"Greed", maxRank:5, rarity:"common",
     desc:"+12% sell value per rank", effects:{ sellBonus:0.12 }, perRank:{ sellBonus:0.12 } },
   { id:"scavenger", name:"Scavenger", tag:"Greed", maxRank:5, rarity:"common",
     desc:"+2 gold per kill, per rank", effects:{ goldPerKill:2 }, perRank:{ goldPerKill:2 } }
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
   { id:"deep_pockets", name:"Deep Pockets", desc:"+50% Gold Find for the rest of the run", unique:true, effects:{ goldMult:0.50 } },
   { id:"blood_price", name:"Blood Price", desc:"An ability you cannot afford costs 3 HP instead of energy", unique:true, effects:{ bloodPrice:true } },
   { id:"twin_fang", name:"Twin Fang", desc:"Every third attack strikes twice", unique:true, effects:{ twinFang:true } },
   { id:"grave_ward", name:"Grave Ward", desc:"Bleed, poison and burn you suffer last half as long", unique:true, effects:{ statusResist:0.5 } },
   { id:"ironclad_oath", name:"Ironclad Oath", desc:"You can no longer dodge, but Damage Reduction is doubled", unique:true, effects:{ noDodge:true, redMult:2.0 } }
  ],
   abilities: [
   // `data` carries the numbers castAbility uses; `perRank*` fields are per-rank
   // deltas that castAbility reads whenever the matching abilityRank shard-tree
   // node is owned (Cleave II, Lunge II, Stone Skin II, Rally II, Blink II,
   // Cinderbolt II).
   { id:"cleave", name:"Cleave", cost:4, target:"adjacent",
     desc:"8 damage to a target and 5 to every enemy beside it",
     data:{ dmg:8, splash:5, perRankDmg:3 } },
   { id:"lunge", name:"Lunge", cost:5, target:"line4",
     desc:"Dash up to 4 tiles and strike for 10",
     data:{ range:4, dmg:10, perRankDmg:4 } },
   { id:"stone_skin", name:"Stone Skin", cost:5, target:"self",
     desc:"Take 60% less damage for 3 turns",
     data:{ turns:3, dmgMult:0.4, perRankTurns:1 } },
   { id:"cinderbolt", name:"Cinderbolt", cost:4, target:"range5",
     desc:"9 damage at range, ignores armour, applies Burn",
     data:{ range:5, dmg:9, burnTurns:2, perRankDmg:3, perRankBurn:1 } },
   { id:"rally", name:"Rally", cost:7, target:"self",
     desc:"Heal 45% max HP, clear bleed, and gain 20% damage reduction for a turn",
     data:{ healPct:0.45, perRankHeal:0.08, drTurns:1 } },
   { id:"blink", name:"Blink", cost:5, target:"teleport4",
     desc:"Teleport to a visible empty tile within 4",
     data:{ range:4, perRankRange:1 } },
   { id:"whirlwind", name:"Whirlwind", cost:6, target:"self",
     desc:"7 damage to every adjacent enemy at once",
     data:{ dmg:7, perRankDmg:3 } },

   // ── Second wave (abilities are uncapped, so the pool has to be deep) ──
   // One entry per archetype, all built from primitives castAbility already
   // uses: hurt(), applyEffect(poison|bleed|burn), healing and energy.
   { id:"crushing_blow", name:"Crushing Blow", cost:6, target:"adjacent",
     desc:"A heavy overhead strike: 16 damage to one adjacent enemy",
     data:{ dmg:16, perRankDmg:6 } },
   { id:"rend", name:"Rend", cost:5, target:"adjacent",
     desc:"9 damage and the target bleeds for longer",
     data:{ dmg:9, perRankDmg:3 } },
   { id:"rupture", name:"Rupture", cost:8, target:"adjacent",
     desc:"Tear an adjacent enemy for heavy damage — doubles against a bleeding one",
     data:{ dmg:10, bleedMult:2.0, perRankDmg:4 } },
   { id:"leech", name:"Leech", cost:5, target:"adjacent",
     desc:"Drain 10 from an adjacent enemy, healing half of it",
     data:{ dmg:10, healPct:0.5, perRankDmg:3, perRankHeal:0.1 } },
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
