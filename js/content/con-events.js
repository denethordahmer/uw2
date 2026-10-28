window.Delve = window.Delve || {};
(function(){
 const C = Delve.CONFIG;

 // ── content/con-events.js : floor events + ambush tuning (data only) ──
 //
 // A floor event is ONE optional encounter placed on a walkable tile. Walking
 // onto it opens a card with two or three choices. Every choice is expressed in
 // the small effect vocabulary js/encounters.js resolves:
 //
 //   healPct       restore value × max HP
 //   maxHp         value extra Maximum Health for the rest of the run
 //   shards        value shards, banked with the rest of the run
//   gamble        pay gold; `chance` odds of an item `tierBonus` tiers up
 //   hpForAbility  pay hpPct of max HP; learn an unlearned ability
 //   hpForShards   pay hpPct of max HP; gain value shards
 //   nothing       the polite way out
 //
 // Adding a kind is one entry here — the engine needs no new branch unless a
 // genuinely new effect is introduced. `accent` tints the prop on the floor.
 //
 // `chance` is per non-boss floor, and floors below minFloor get none: the
 // first floor should teach the loop, not interrupt it.
 C.FLOOR_EVENTS = {
  chance: 0.45,
  minFloor: 2,

  // Ambush (feature: rest and chest interruptions). Per-event odds, capped per
  // floor so an unlucky floor cannot chain them forever.
  ambush: {
   rest: 0.12,
   chest: 0.18,
   minFloor: 2,
   maxPerFloor: 2,
   secondAtFloor: 15,   // from here, a second enemy may join the ambush
   secondChance: 0.35
  },

  kinds: [
   {
    id:"shrine", name:"Forgotten Shrine", accent:"#7ee0ff",
    flavour:"A bowl of still water, warm to the touch. Something down here still listens.",
    options:[
     { id:"mend",   label:"Drink deep",              desc:"Restore 35% of your health.", effect:"healPct", value:0.35 },
     { id:"vigour", label:"Pour it over your wounds", desc:"+4 Maximum Health for the rest of this run.", effect:"maxHp", value:4 },
     { id:"tithe",  label:"Leave an offering",        desc:"+8 shards, banked when the run ends.", effect:"shards", value:8 }
    ]
   },

   {
    id:"wager", name:"Bone Wager", accent:"#ffd75e",
    flavour:"A skull with dice for eyes. It rattles when you come near.",
    options:[
     { id:"roll", label:"Roll the bones", desc:"Pay the stake for a good chance at a fine item.", effect:"gamble", gold:20, goldPerFloor:2, chance:0.60, tierBonus:2 },
     { id:"walk", label:"Walk away",      desc:"Nothing gained, nothing lost.", effect:"nothing" }
    ]
   },

   {
    id:"altar", name:"Blood Altar", accent:"#ef4444",
    flavour:"The stone is stained right up to the rim. It wants an answer.",
    options:[
     { id:"learn",  label:"Bleed for knowledge", desc:"Lose 25% of your health. Learn an ability you do not yet know.", effect:"hpForAbility", hpPct:0.25 },
     { id:"shards", label:"Bleed for coin",      desc:"Lose 25% of your health. Gain 14 shards at the end of the run.", effect:"hpForShards", hpPct:0.25, value:14 },
     { id:"leave",  label:"Leave it alone",      desc:"Some doors stay shut.", effect:"nothing" }
    ]
   }
  ]
 };

})();
