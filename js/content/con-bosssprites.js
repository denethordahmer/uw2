window.Delve = window.Delve || {};
(function(){
 const U = Delve._spriteUtils;
 if(!U) return; // sprites.js must load first
 const mk = U.mk, gx = U.gx, R = U.R;

 // ═══════════════════════════════════════════════════════════
 // content/con-bosssprites.js : one builder per boss (data only).
 // Add new ones below; sprites.js never needs editing again.
 // BOSS_DEFS[n].sprite names the key (see con-monsters.js).
 // ⚠ Load-order constraint: must load AFTER js/sprites.js.
 // ═══════════════════════════════════════════════════════════

 function buildBossWarden(){
  const c=mk(48,48),x=gx(c);
  // cape behind him
  R(x,10,20,28,20,"#151920");
  // boots + greaves
  R(x,15,42,7,5,"#171a20");R(x,26,42,7,5,"#171a20");
  R(x,14,45,9,2,"#2c313a");R(x,25,45,9,2,"#2c313a");
  // legs with knee plates
  R(x,16,31,6,12,"#1f2329");R(x,26,31,6,12,"#1f2329");
  R(x,16,33,6,3,"#343a43");R(x,26,33,6,3,"#343a43");
  // tasset skirt
  R(x,12,29,24,6,"#23262d");
  R(x,12,29,24,1,"#343a43");
  // torso plate
  R(x,14,17,20,13,"#1f2329");
  R(x,14,17,20,2,"#343a43");
  R(x,14,17,3,13,"#2c313a");R(x,31,17,3,13,"#2c313a");
  R(x,22,20,4,10,"#171a20");R(x,20,22,8,1,"#343a43");
  // collar
  R(x,19,14,10,4,"#23262d");R(x,19,14,10,1,"#4a525e");
  // pauldrons
  R(x,5,15,11,9,"#23262d");R(x,32,15,11,9,"#23262d");
  R(x,5,15,11,2,"#4a525e");R(x,32,15,11,2,"#4a525e");
  R(x,6,17,3,5,"#343a43");R(x,33,17,3,5,"#343a43");
  // arms + gauntlets
  R(x,8,24,7,11,"#1f2329");R(x,33,24,7,11,"#1f2329");
  R(x,7,34,9,6,"#23262d");R(x,32,34,9,6,"#23262d");
  R(x,7,34,9,1,"#4a525e");R(x,32,34,9,1,"#4a525e");
  // helm
  R(x,17,3,14,12,"#23262d");
  R(x,17,3,14,2,"#343a43");
  R(x,19,9,10,5,"#0d0f13");
  R(x,20,10,3,3,"#ff4a3d");R(x,25,10,3,3,"#ff4a3d");
  x.globalAlpha=0.5;R(x,20,10,3,3,"#ff6a5a");R(x,25,10,3,3,"#ff6a5a");x.globalAlpha=1;
  R(x,15,6,2,6,"#2c313a");R(x,31,6,2,6,"#2c313a");
  // crest
  R(x,22,0,4,5,"#7ee0ff");R(x,23,0,2,5,"#c9f5ff");
  // war-hammer, resting head-down at his side
  R(x,3,10,3,30,"#23262d");
  R(x,0,4,11,10,"#343a43");R(x,0,4,11,2,"#5a616c");
  R(x,2,6,3,6,"#4a525e");
  return c;
 }

 function buildBossThorn(){
  const c=mk(48,48),x=gx(c);
  // ground roots
  R(x,6,42,36,5,"#1a0e08");
  R(x,0,44,10,3,"#2a1a0e");R(x,38,44,10,3,"#2a1a0e");
  // root legs
  R(x,12,34,8,9,"#2a1a0e");R(x,28,34,8,9,"#2a1a0e");
  R(x,12,40,8,2,"#1a0e08");R(x,28,40,8,2,"#1a0e08");
  // trunk
  R(x,17,14,14,22,"#3a2418");
  R(x,17,14,3,22,"#5a3a24");
  R(x,28,14,3,22,"#20140a");
  R(x,17,14,14,2,"#5a3a24");
  // bark grooves
  R(x,21,18,2,20,"#20140a");
  R(x,25,16,2,22,"#20140a");
  R(x,23,26,2,12,"#20140a");
  // chest knot
  R(x,19,30,10,4,"#2a1a0e");
  R(x,23,30,3,4,"#1a0e08");
  // branch arms
  R(x,2,21,16,5,"#3a2418");R(x,2,21,16,1,"#5a3a24");
  R(x,30,21,16,5,"#3a2418");R(x,30,21,16,1,"#5a3a24");
  R(x,0,17,3,6,"#2a1a0e");R(x,6,15,3,8,"#2a1a0e");
  R(x,45,17,3,6,"#2a1a0e");R(x,39,15,3,8,"#2a1a0e");
  R(x,1,14,5,3,"#c8d84a");R(x,6,12,5,3,"#5a7a2a");
  R(x,42,14,5,3,"#c8d84a");R(x,37,12,5,3,"#5a7a2a");
  // canopy / head block
  R(x,15,2,18,13,"#1a0e08");
  R(x,15,2,18,2,"#3a2418");
  R(x,13,4,2,10,"#2a1a0e");R(x,33,4,2,10,"#2a1a0e");
  // hollow eye cavity + glowing eyes
  R(x,17,5,14,8,"#0a0604");
  R(x,17,5,14,1,"#20140a");
  R(x,20,7,4,4,"#a8e84a");R(x,26,7,4,4,"#a8e84a");
  R(x,21,8,2,2,"#eaffa8");R(x,27,8,2,2,"#eaffa8");
  x.globalAlpha=0.35;R(x,19,6,6,6,"#a8e84a");R(x,25,6,6,6,"#a8e84a");x.globalAlpha=1;
  // bark-crack mouth
  R(x,22,12,5,2,"#a8e84a");
  // crown branches
  R(x,19,0,3,4,"#2a1a0e");R(x,26,0,3,4,"#2a1a0e");R(x,22,0,4,2,"#3a2418");
  return c;
 }

 // The Pale Tempest — a blizzard given a body: the storm is the boss, the figure
 // is only a shape it wears. Swirling snow bands, an indistinct silhouette, a
 // crown of ice shards.
 function buildBossTempest(){
  const c=mk(48,48),x=gx(c);
  // swirling snow across the whole box, brightest at the edges
  x.globalAlpha=0.35;
  R(x,0,6,48,3,"#7a9ac0");R(x,0,16,48,3,"#a8e8ff");R(x,0,26,48,3,"#7a9ac0");R(x,0,36,48,3,"#a8e8ff");
  x.globalAlpha=0.55;
  R(x,0,2,16,1,"#a8e8ff");R(x,32,2,16,1,"#a8e8ff");
  R(x,0,11,12,1,"#eaffff");R(x,36,11,12,1,"#eaffff");
  R(x,0,21,14,1,"#eaffff");R(x,34,21,14,1,"#eaffff");
  R(x,0,31,10,1,"#a8e8ff");R(x,38,31,10,1,"#a8e8ff");
  R(x,0,42,20,1,"#7ec8e0");R(x,28,42,20,1,"#7ec8e0");
  x.globalAlpha=1;
  // the shape the storm wears — indistinct, darker than the snow
  R(x,17,20,16,5,"#1a2436");
  R(x,20,22,10,18,"#22303f");
  R(x,14,24,5,13,"#1a2436");R(x,31,24,5,13,"#1a2436");
  R(x,20,13,10,9,"#1a2436");
  R(x,21,41,3,6,"#0a1018");R(x,26,41,3,6,"#0a1018");
  // core glow inside the chest
  x.globalAlpha=0.7;R(x,23,26,6,9,"#3a4a5e");x.globalAlpha=1;
  R(x,24,28,4,5,"#6a86a8");
  // eyes
  R(x,22,16,1,1,"#a8e8ff");R(x,27,16,1,1,"#a8e8ff");
  // ice-shard crown
  R(x,18,0,3,12,"#a8e8ff");R(x,23,0,4,16,"#eaffff");R(x,28,0,3,12,"#a8e8ff");
  R(x,15,4,2,8,"#7ec8e0");R(x,32,4,2,8,"#7ec8e0");
  R(x,21,2,1,4,"#eaffff");R(x,27,2,1,4,"#eaffff");
  return c;
 }

 // ── Registering every builder under the key named in BOSS_DEFS ──
 Delve.registerBossSprite("boss_warden", buildBossWarden);
 Delve.registerBossSprite("boss_thorn",  buildBossThorn);
 Delve.registerBossSprite("boss_tempest", buildBossTempest);

 // Attack frames: the idle canvas plus a strike overdraw (U.atkFrom), same idea
 // as the monsters in sprites.js. registerBossAttackSprite's builder receives
 // the idle canvas so the pose can't drift from the boss it belongs to.
 Delve.registerBossAttackSprite("boss_warden", function(idle){
  return U.atkFrom(idle, [[0,0,13,10,"#343a43"],[0,0,13,2,"#5a616c"],[2,2,4,7,"#4a525e"],
   [20,10,3,3,"#ff8a7a"],[25,10,3,3,"#ff8a7a"],[5,18,11,7,"#2c313a"]]);
 });
 Delve.registerBossAttackSprite("boss_thorn", function(idle){
  return U.atkFrom(idle, [[0,20,20,6,"#3a2418"],[28,20,20,6,"#3a2418"],
   [0,15,3,8,"#2a1a0e"],[45,15,3,8,"#2a1a0e"],
   [20,7,4,5,"#eaffa8"],[26,7,4,5,"#eaffa8"],[22,12,5,3,"#eaffa8"]]);
 });
 Delve.registerBossAttackSprite("boss_tempest", function(idle){
  return U.atkFrom(idle, [[14,22,7,5,"#22303f"],[29,22,7,5,"#22303f"],
   [0,6,48,3,"#eaffff"],[0,36,48,3,"#eaffff"],
   [18,0,3,14,"#eaffff"],[28,0,3,14,"#eaffff"],
   [22,15,1,2,"#eaffff"],[27,15,1,2,"#eaffff"]]);
 });

 // sprites.js already ran buildAll() once without these; rebuild now.
 Delve.rebuildSprites();
})();
