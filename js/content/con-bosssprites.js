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

 // ═══ THE BONEFATHER — ward 4, The Bone Ossuary ═══
 // A colossal walking ribcage: arms hang from the sides, ribs curve down
 // around him like a cage, and inside — suspended in the dark — a heart of
 // black bone. Act 1 art keeps the ribs sealed over the heart; Act 2
 // (boss_bonefather_open) draws them shattered and splayed, the heart fully
 // exposed. The shield mechanic in combat.js swaps between the two forms.
 function buildBossBonefather(){
  const c=mk(48,48),x=gx(c);
  // feet: broad bone platforms
  R(x,8,43,12,3,"#d8d0b8");R(x,28,43,12,3,"#d8d0b8");
  R(x,8,43,12,1,"#f0e8d0");R(x,28,43,12,1,"#f0e8d0");
  R(x,10,46,8,2,"#8a7658");R(x,30,46,8,2,"#8a7658");       // dust at the base
  // leg bones: femur pairs rising to the pelvis
  R(x,10,33,4,10,"#e8dcc0");R(x,34,33,4,10,"#e8dcc0");
  R(x,11,33,1.4,10,"#f0e8d0");                              // shaft highlight
  // pelvis: a wide vertebra bar
  R(x,10,31,28,3,"#b8ac8c");
  for(let i=0;i<7;i++) R(x,11+i*4,31.6,1.6,1.6,"#8a7658");  // vertebra nubs
  // spine column up the middle
  R(x,22,9,4,24,"#e8dcc0");
  R(x,22,9,1.2,24,"#f0e8d0");
  for(let i=0;i<8;i++) R(x,21,11+i*2.6,1.6,1.6,"#d8d0b8");  // spinous processes
  // the dark interior between the ribs
  x.globalAlpha=0.9; x.fillStyle="#1a140c";
  x.beginPath(); x.ellipse(24,23,8,10,0,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  // the heart of black bone, suspended in the dark
  x.globalAlpha=0.85; x.fillStyle="#0d0604";
  x.beginPath(); x.ellipse(24,22,4.5,5.5,0,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  R(x,22,19,2,3,"#1a0a08");R(x,25,20,2,4,"#1a0a08");        // the heart's lobes
  x.globalAlpha=0.55; R(x,23,23,1.4,1.4,"#7a2a24");R(x,25.5,25,1,1,"#7a2a24"); x.globalAlpha=1;
  // ── the sealed ribcage ──
  // five rib pairs curving down and in, cage-like over the heart
  x.strokeStyle="#e8dcc0"; x.lineWidth=3.4; x.lineCap="round";
  x.beginPath();
  x.moveTo(23,11); x.quadraticCurveTo(4,13,8,27);           // rib 1 left
  x.moveTo(25,11); x.quadraticCurveTo(44,13,40,27);         // rib 1 right
  x.moveTo(23,16); x.quadraticCurveTo(7,18,10,30);          // rib 2 left
  x.moveTo(25,16); x.quadraticCurveTo(41,18,38,30);         // rib 2 right
  x.moveTo(23,21); x.quadraticCurveTo(10,23,13,34);         // rib 3 left
  x.moveTo(25,21); x.quadraticCurveTo(38,23,35,34);         // rib 3 right
  x.moveTo(23,26); x.quadraticCurveTo(13,28,15,38);         // rib 4 left
  x.moveTo(25,26); x.quadraticCurveTo(35,28,33,38);         // rib 4 right
  x.stroke();
  // rib inner shading (a darker pass, offset inward)
  x.strokeStyle="#8a7658"; x.lineWidth=1.2;
  x.beginPath();
  x.moveTo(23,12); x.quadraticCurveTo(6,14,9,27);
  x.moveTo(25,12); x.quadraticCurveTo(42,14,39,27);
  x.moveTo(23,17); x.quadraticCurveTo(9,19,11,30);
  x.moveTo(25,17); x.quadraticCurveTo(39,19,37,30);
  x.stroke();
  // clavicle bar
  R(x,8,10,32,3,"#e8dcc0");R(x,8,10,32,1,"#f0e8d0");
  // arms: humerus + forearm, hanging idle at his sides
  R(x,3,13,5,12,"#e8dcc0");R(x,3,25,4,10,"#d8d0b8");
  R(x,40,13,5,12,"#e8dcc0");R(x,41,25,4,10,"#d8d0b8");
  R(x,3,13,1.6,12,"#f0e8d0");R(x,40,13,1.6,12,"#f0e8d0");   // shaft highlights
  // claw hands: three bony fingers each
  R(x,2,35,6,3,"#e8dcc0");
  R(x,1,38,2,5,"#c9bfa2");R(x,4,38,2,6,"#c9bfa2");R(x,7,38,1.6,4,"#c9bfa2");
  R(x,40,35,6,3,"#e8dcc0");
  R(x,41,38,2,5,"#c9bfa2");R(x,44,38,2,6,"#c9bfa2");R(x,38,38,1.6,4,"#c9bfa2");
  // the skull: small against the cage
  R(x,17,1,14,8,"#e8dcc0");
  R(x,17,1,14,1.4,"#f0e8d0");
  R(x,18.5,3,3,3,"#2a2216");R(x,26.5,3,3,3,"#2a2216");      // sockets
  x.globalAlpha=0.5; R(x,19.3,3.8,1.4,1.4,"#7a2a24");R(x,27.3,3.8,1.4,1.4,"#7a2a24"); x.globalAlpha=1;
  R(x,20,7.4,8,1.6,"#8a7658");                              // upper teeth band
  for(let i=0;i<4;i++) R(x,20.6+i*2,7.4,0.8,1.6,"#e8dcc0"); // teeth
  // vertebra crest rising from the crown
  R(x,19,0,2,2,"#e8dcc0");R(x,22,0,4,2,"#e8dcc0");R(x,27,0,2,2,"#e8dcc0");
  return c;
 }

 // Act 2: the ribs shattered. The cage is splayed open with jagged broken
 // ends, and the black heart hangs fully exposed, pulsing faint red.
 function buildBossBonefatherOpen(){
  const c=mk(48,48),x=gx(c);
  // feet, legs, pelvis, spine — unchanged skeleton
  R(x,8,43,12,3,"#d8d0b8");R(x,28,43,12,3,"#d8d0b8");
  R(x,8,43,12,1,"#f0e8d0");R(x,28,43,12,1,"#f0e8d0");
  R(x,10,46,8,2,"#8a7658");R(x,30,46,8,2,"#8a7658");
  R(x,10,33,4,10,"#e8dcc0");R(x,34,33,4,10,"#e8dcc0");
  R(x,11,33,1.4,10,"#f0e8d0");
  R(x,10,31,28,3,"#b8ac8c");
  for(let i=0;i<7;i++) R(x,11+i*4,31.6,1.6,1.6,"#8a7658");
  R(x,22,9,4,24,"#e8dcc0");
  R(x,22,9,1.2,24,"#f0e8d0");
  for(let i=0;i<8;i++) R(x,21,11+i*2.6,1.6,1.6,"#d8d0b8");
  // the open interior: wider, darker
  x.globalAlpha=0.95; x.fillStyle="#100a06";
  x.beginPath(); x.ellipse(24,23,10,11,0,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  // ── the black heart, fully exposed ──
  x.fillStyle="#0d0604";
  x.beginPath(); x.ellipse(24,22,6,8,0,0,Math.PI*2); x.fill();
  R(x,21,17,3,5,"#1a0a08");R(x,26,18,3,6,"#1a0a08");        // lobes
  R(x,23.4,20,2.4,6,"#000000");                              // the cleft
  // the faint pulse: dried-blood glints and a dim red aura
  x.globalAlpha=0.35; x.fillStyle="#7a2a24";
  x.beginPath(); x.ellipse(24,22,8,9.5,0,0,Math.PI*2); x.fill();
  x.globalAlpha=0.8; R(x,22,19,1.6,1.6,"#a8353a");R(x,26,24,1.2,1.2,"#a8353a");
  x.globalAlpha=1;
  // ── the shattered ribs ──
  // fewer, splayed outward, ending in jagged snapped tips
  x.strokeStyle="#e8dcc0"; x.lineWidth=3.2; x.lineCap="round";
  x.beginPath();
  x.moveTo(23,12); x.quadraticCurveTo(6,14,5,24);           // left upper, flared wide
  x.moveTo(25,12); x.quadraticCurveTo(42,14,43,24);         // right upper
  x.moveTo(23,17); x.quadraticCurveTo(9,20,9,32);           // left mid
  x.moveTo(25,17); x.quadraticCurveTo(39,20,39,32);         // right mid
  x.moveTo(23,27); x.quadraticCurveTo(14,30,16,38);         // left low, shorter
  x.moveTo(25,27); x.quadraticCurveTo(34,30,32,38);         // right low
  x.stroke();
  // jagged break-tips: small dark stubs where bone snapped
  x.strokeStyle="#8a7658"; x.lineWidth=1.4;
  x.beginPath();
  x.moveTo(5,24); x.lineTo(3,27); x.moveTo(5,24); x.lineTo(7,27);
  x.moveTo(43,24); x.lineTo(45,27); x.moveTo(43,24); x.lineTo(41,27);
  x.moveTo(9,32); x.lineTo(8,35); x.moveTo(39,32); x.lineTo(40,35);
  x.stroke();
  // bone shards fallen into the dust below
  R(x,14,45,3,1.6,"#c9bfa2");R(x,30,44.5,4,1.6,"#c9bfa2");R(x,23,46,2.4,1.2,"#b8ac8c");
  // clavicle bar, cracked at its middle
  R(x,8,10,32,3,"#e8dcc0");R(x,8,10,32,1,"#f0e8d0");
  R(x,23,10,2.4,3,"#1a140c");                               // the crack
  // arms — the cage broken open
  R(x,3,13,5,12,"#e8dcc0");R(x,3,25,4,10,"#d8d0b8");
  R(x,40,13,5,12,"#e8dcc0");R(x,41,25,4,10,"#d8d0b8");
  R(x,3,13,1.6,12,"#f0e8d0");R(x,40,13,1.6,12,"#f0e8d0");
  R(x,2,35,6,3,"#e8dcc0");
  R(x,1,38,2,5,"#c9bfa2");R(x,4,38,2,6,"#c9bfa2");R(x,7,38,1.6,4,"#c9bfa2");
  R(x,40,35,6,3,"#e8dcc0");
  R(x,41,38,2,5,"#c9bfa2");R(x,44,38,2,6,"#c9bfa2");R(x,38,38,1.6,4,"#c9bfa2");
  // the skull, jaw now hanging open
  R(x,17,1,14,8,"#e8dcc0");
  R(x,17,1,14,1.4,"#f0e8d0");
  R(x,18.5,3,3,3,"#2a2216");R(x,26.5,3,3,3,"#2a2216");
  x.globalAlpha=0.5; R(x,19.3,3.8,1.4,1.4,"#7a2a24");R(x,27.3,3.8,1.4,1.4,"#7a2a24"); x.globalAlpha=1;
  R(x,19,7.4,10,2,"#2a2216");                               // the gaping dark
  R(x,19,7.4,10,0.8,"#8a7658");R(x,19,9,10,0.6,"#8a7658");   // jaw, hanging
  for(let i=0;i<4;i++) R(x,20+i*2.2,7.6,0.8,1.4,"#e8dcc0"); // upper teeth
  R(x,19,0,2,2,"#e8dcc0");R(x,22,0,4,2,"#e8dcc0");R(x,27,0,2,2,"#e8dcc0");
  return c;
 }

 // Registrations + attack frames. Both forms carry their own strike so the
 // telegraph never shows the wrong body.
 Delve.registerBossSprite("boss_bonefather", buildBossBonefather);
 Delve.registerBossSprite("boss_bonefather_open", buildBossBonefatherOpen);
 Delve.registerBossAttackSprite("boss_bonefather", function(idle){
  return U.atkFrom(idle, [[0,13,6,6,"#e8dcc0"],[42,13,6,6,"#e8dcc0"],   // arms swing wide
   [22,16,4,12,"#8a7658"],[20,30,8,3,"#e8dcc0"],                        // ribs flex in
   [18.5,3,3,3,"#7a2a24"],[26.5,3,3,3,"#7a2a24"]]);                     // sockets flare red
 });
 Delve.registerBossAttackSprite("boss_bonefather_open", function(idle){
  return U.atkFrom(idle, [[0,13,6,6,"#e8dcc0"],[42,13,6,6,"#e8dcc0"],
   [20,18,8,10,"#a8353a"],[23,21,2.4,5,"#c84838"],                      // the heart flares on the swing
   [2,34,5,3,"#e8dcc0"],[41,34,5,3,"#e8dcc0"]]);
 });

 // sprites.js already ran buildAll() once without these; rebuild now.
 Delve.rebuildSprites();
})();
