window.Delve = window.Delve || {};
(function(){
 const U = Delve._spriteUtils;
 if(!U) return; // sprites.js must load first
 const mk = U.mk, gx = U.gx, R = U.R;
 const reg = Delve.registerMonsterSprite;

 // ═══════════════════════════════════════════════════════════
 // content/con-monstersprites.js : monster art as content.
 // One builder per roster kind, registered via Delve.registerMonsterSprite —
 // hurt / elite / attack variants are built automatically. Fresh-drawn for
 // The Bone Ossuary (ward 4): bleached bone over dusty brown, dried blood
 // accents. Palette anchors: bone #d8d0b8 / #e8dcc0, shade #8a7658, dark
 // sockets #3a3122 / #2a2216, dried blood #7a2a24.
 // ⚠ Load-order constraint: must load AFTER js/sprites.js.
 // ═══════════════════════════════════════════════════════════

 // ── Bone Rat (floors 31+; fast, frail scavenger) ─────────────
 // A rat gone to bone: pale ribs visible through a tattered hide.
 function buildBoneRat(){
  const c=mk(24,24),x=gx(c);
  // tail, bone-thin with vertebra nubs
  x.strokeStyle="#c9bfa2"; x.lineWidth=1.4; x.lineCap="round";
  x.beginPath(); x.moveTo(5,17); x.quadraticCurveTo(1,16,1,13); x.stroke();
  x.fillStyle="#e8dcc0"; x.fillRect(2,12.4,1,1); x.fillRect(1.4,14.2,1,1);
  // hind leg + haunch, hide gone to bone at the flank
  R(x,6,17,3,4,"#d8d0b8"); R(x,6,20,4,2,"#b8ac8c");
  // body: arched spine of small vertebrae
  R(x,8,13,10,5,"#d8d0b8");
  R(x,9,12.6,1.6,1.2,"#e8dcc0"); R(x,12,12.4,1.6,1.2,"#e8dcc0"); R(x,15,12.6,1.6,1.2,"#e8dcc0");
  // exposed rib lines under the hide
  R(x,9,15,1,2,"#8a7658"); R(x,11,15,1,2,"#8a7658"); R(x,13,15,1,2,"#8a7658"); R(x,15,15,1,2,"#8a7658");
  // a patch of dried blood where the hide tore
  x.globalAlpha=0.6; R(x,10,14,3,2,"#7a2a24"); x.globalAlpha=1;
  // front leg
  R(x,15,17,2,4,"#d8d0b8"); R(x,15,20,3,2,"#b8ac8c");
  // skull: pale, long-snouted, one socket dark
  R(x,17,10,6,5,"#e8dcc0");
  R(x,17.5,11,1.6,1.6,"#3a3122"); R(x,20.5,11,1.6,1.6,"#3a3122");
  R(x,21,12.5,2.4,1.6,"#e8dcc0");                 // snout
  R(x,22.6,12.8,0.7,0.7,"#2a2216");               // nasal sliver
  R(x,17,9,6,0.8,"#f0e8d0");                      // brow highlight
  return c;
 }
 // ── Grave Skitter (floors 31+; a spider that carries its dead) ──
 // Long-legged bone spider, a small skull clutched under its front pair.
 function buildGraveSkitter(){
  const c=mk(24,24),x=gx(c);
  // legs: four visible, jointed, bone-pale — raised on either side
  x.strokeStyle="#d8d0b8"; x.lineCap="round";
  x.lineWidth=1.3;
  x.beginPath();
  x.moveTo(9,14); x.lineTo(4,10); x.lineTo(2,6);          // back-left, raised
  x.moveTo(15,14); x.lineTo(20,10); x.lineTo(22,6);       // back-right, raised
  x.moveTo(8,16); x.lineTo(3,17); x.lineTo(1,20);         // front-left
  x.moveTo(16,16); x.lineTo(21,17); x.lineTo(23,20);      // front-right
  x.stroke();
  // joint nubs
  x.fillStyle="#e8dcc0";
  x.fillRect(3.4,9.4,1.2,1.2); x.fillRect(19.4,9.4,1.2,1.2);
  x.fillRect(2.4,16.4,1.2,1.2); x.fillRect(20.4,16.4,1.2,1.2);
  // abdomen: an empty ribcage dome (it *is* the carried dead)
  R(x,8,10,8,7,"#d8d0b8");
  R(x,8,10,8,1,"#e8dcc0");
  R(x,9,11.5,1,4,"#8a7658"); R(x,11,11.5,1,4,"#8a7658"); R(x,13,11.5,1,4,"#8a7658"); R(x,15,11.5,1,4,"#8a7658");
  // a dried-blood smear where something burst out
  x.globalAlpha=0.55; R(x,11,12,2.5,2,"#7a2a24"); x.globalAlpha=1;
  // head: small skull with pincers
  R(x,9,17,6,5,"#e8dcc0");
  R(x,10,18,1.4,1.4,"#3a3122"); R(x,13,18,1.4,1.4,"#3a3122");
  // pincers, reaching forward
  x.strokeStyle="#c9bfa2"; x.lineWidth=1.1;
  x.beginPath(); x.moveTo(9,21); x.quadraticCurveTo(8,23,10,23.4); x.stroke();
  x.beginPath(); x.moveTo(15,21); x.quadraticCurveTo(16,23,14,23.4); x.stroke();
  return c;
 }
 // ── Marrow Hound (floors 33+; fast, bleeds you) ──────────────
 // A lean wolf of bone, mid-stride, ribs blazing through its torn hide.
 function buildMarrowHound(){
  const c=mk(24,24),x=gx(c);
  // tail: whip-thin, streaming back
  x.strokeStyle="#c9bfa2"; x.lineWidth=1.2; x.lineCap="round";
  x.beginPath(); x.moveTo(3,12); x.quadraticCurveTo(0,11,0.5,8.5); x.stroke();
  // hind leg driving forward, front leg reaching
  R(x,5,15,3,6,"#d8d0b8"); R(x,5,20,4,2,"#b8ac8c");
  R(x,16,16,3,5,"#d8d0b8"); R(x,16,20,4,2,"#b8ac8c");
  // body: lean, ribs exposed along the flank
  R(x,5,11,14,5,"#d8d0b8");
  R(x,7,11,1,3,"#8a7658"); R(x,9,11,1,3,"#8a7658"); R(x,11,11,1,3,"#8a7658"); R(x,13,11,1,3,"#8a7658");
  R(x,5,10.6,14,1,"#e8dcc0");                        // spine highlight
  // torn hide trailing blood where the ribs broke through
  x.globalAlpha=0.7; R(x,8,14.5,6,1.5,"#7a2a24"); x.globalAlpha=1;
  // neck + lowered skull, jaw open
  R(x,17,9,5,4,"#e8dcc0");
  R(x,17.5,10,1.4,1.4,"#3a3122"); R(x,20,10,1.4,1.4,"#3a3122");
  // jaw: upper + lower, open in a snarl
  R(x,21,11.5,3,1.6,"#e8dcc0");
  R(x,21,14,3,1.2,"#b8ac8c");
  R(x,21.2,13,2.4,1.2,"#2a2216");                    // the dark between jaws
  // teeth, two tiny white slivers
  R(x,22,13.2,0.6,0.8,"#f4f0e6"); R(x,23,13.2,0.6,0.8,"#f4f0e6");
  return c;
 }
 // ── Bonecaller (floors 33+; weakens you) ────────────────────
 // A robed conjurer of bone: a floating skull over a shroud of ribs and dust.
 function buildBonecaller(){
  const c=mk(24,24),x=gx(c);
  // the shroud: a hooded robe of stitched bone-plates, wide at the base
  R(x,7,10,10,9,"#b8ac8c");
  R(x,7,10,2,9,"#d8d0b8"); R(x,15,10,2,9,"#8a7658");
  R(x,5,19,14,3,"#b8ac8c");                          // the hem pooling wide
  R(x,5,19,14,0.8,"#e8dcc0");
  // rib-lacing down the front of the robe
  R(x,10,11,1,2,"#8a7658"); R(x,12,11,1,2,"#8a7658"); R(x,11,13,2,1,"#8a7658");
  R(x,10,15,1,2,"#8a7658"); R(x,12,15,1,2,"#8a7658"); R(x,11,17,2,1,"#8a7658");
  // a dried-blood stain low on the shroud, long gone dark
  x.globalAlpha=0.5; R(x,8,17,3,2,"#7a2a24"); x.globalAlpha=1;
  // the skull, floating clear of the hood
  R(x,9,3,6,6,"#e8dcc0");
  R(x,9,3,6,1,"#f0e8d0");                            // crown highlight
  R(x,10,5,1.6,1.6,"#3a3122"); R(x,13,5,1.6,1.6,"#3a3122");
  R(x,10.5,7.2,3.6,1.4,"#2a2216");                   // nasal cavity, hollow
  R(x,10.6,7.4,0.8,0.8,"#7a2a24");                   // dried blood in the teeth
  // a bone talisman held before it, faintly warm
  R(x,11,20,2.4,2.4,"#e8dcc0"); R(x,12,20.6,0.8,1.2,"#3a3122");
  // dust motes it stirs, pale against the gloom
  x.fillStyle="rgba(232,220,192,0.5)";
  x.fillRect(4,7,0.8,0.8); x.fillRect(19,6,0.8,0.8); x.fillRect(17,3,0.7,0.7);
  return c;
 }
 // ── Ossuary Sentry (floors 36+; slow, weakens you) ───────────
 // A standing suit of armour built from bones, pike planted, on guard.
 function buildOssuarySentry(){
  const c=mk(24,24),x=gx(c);
  // planted pike: a long bone shaft, blade at the top
  R(x,20,2,1.4,18,"#d8d0b8");
  R(x,19,1,3,3,"#e8dcc0"); R(x,19.6,1.6,1.6,1.6,"#f0e8d0");   // blade
  R(x,20,18,1.4,3,"#8a7658");                                  // buried in dust
  // legs: two bone pillars, broad feet planted
  R(x,8,18,2.6,4,"#d8d0b8"); R(x,13,18,2.6,4,"#d8d0b8");
  R(x,7,21.6,4,2,"#e8dcc0"); R(x,12.6,21.6,4,2,"#e8dcc0");
  // pelvis: a horizontal bar of vertebrae
  R(x,7,16.5,10,2,"#b8ac8c"); R(x,8,17,1,1,"#8a7658"); R(x,11,17,1,1,"#8a7658"); R(x,14,17,1,1,"#8a7658");
  // spine + ribcage torso, armour-plate look
  R(x,10.5,7,3,10,"#e8dcc0");                        // spine column
  R(x,7,8,3,1.6,"#d8d0b8"); R(x,14,8,3,1.6,"#d8d0b8");   // rib pairs
  R(x,7,10.5,3,1.6,"#d8d0b8"); R(x,14,10.5,3,1.6,"#d8d0b8");
  R(x,7,13,3,1.6,"#d8d0b8"); R(x,14,13,3,1.6,"#d8d0b8");
  // shoulders: broad bone pauldrons
  R(x,5,6,5,3,"#e8dcc0"); R(x,14,6,5,3,"#e8dcc0");
  R(x,5,6,5,0.8,"#f0e8d0"); R(x,14,6,5,0.8,"#f0e8d0");
  // arms hanging at rest, one hand gripping the pike shaft
  R(x,6,9,2,7,"#d8d0b8"); R(x,16.5,9,2,7,"#d8d0b8");
  R(x,18.6,14,3,2,"#e8dcc0");                        // grip on the shaft
  // helm: a skull in a bone cage, embers of attention inside
  R(x,9,2,6,5,"#e8dcc0"); R(x,9,2,6,0.8,"#f0e8d0");
  R(x,10,4,1.5,1.5,"#3a3122"); R(x,13,4,1.5,1.5,"#3a3122");
  R(x,10.4,4.4,0.7,0.7,"#7a2a24"); R(x,13.4,4.4,0.7,0.7,"#7a2a24");  // dried-blood glints
  return c;
 }
 // ── Ribcage Brute (floors 36+; slow, heavy) ──────────────────
 // A giant ribcage walking on its own, hollow inside — dust and old blood.
 function buildRibcageBrute(){
  const c=mk(24,24),x=gx(c);
  // legs: massive bone pillars under the cage
  R(x,6,19,4,3.5,"#d8d0b8"); R(x,14,19,4,3.5,"#d8d0b8");
  R(x,5,22,6,1.6,"#e8dcc0"); R(x,13,22,6,1.6,"#e8dcc0");
  // the ribcage body: an open cage of huge ribs
  R(x,7,6,2,13,"#e8dcc0"); R(x,15,6,2,13,"#e8dcc0");   // the spine bars
  x.strokeStyle="#e8dcc0"; x.lineWidth=1.8; x.lineCap="round";
  x.beginPath();
  x.moveTo(7,8);  x.quadraticCurveTo(12,5.5,17,8);      // rib 1
  x.moveTo(7,11.5); x.quadraticCurveTo(12,9,17,11.5);   // rib 2
  x.moveTo(7,15); x.quadraticCurveTo(12,12.5,17,15);    // rib 3
  x.moveTo(7,18.5); x.quadraticCurveTo(12,16,17,18.5);  // rib 4
  x.stroke();
  // inside the cage: darkness and old pooled blood
  x.globalAlpha=0.85; x.fillStyle="#2a2216";
  x.fillRect(9.5,9,5,9); x.globalAlpha=0.5;
  x.fillStyle="#7a2a24"; x.fillRect(10,15.5,4,2.4); x.globalAlpha=1;
  // spine crest along the top
  R(x,7,5,10,1.4,"#f0e8d0");
  R(x,8.5,4,1.6,1.2,"#e8dcc0"); R(x,11,3.8,1.6,1.2,"#e8dcc0"); R(x,13.5,4,1.6,1.2,"#e8dcc0");
  // shoulders: the cage's own joints, arm bones dangling
  R(x,4,7,3,2,"#e8dcc0"); R(x,17.4,7,3,2,"#e8dcc0");
  R(x,4,9,2,6,"#d8d0b8"); R(x,18.4,9,2,6,"#d8d0b8");   // arms, hanging idle
  // a skull wedged at the top as its "head"
  R(x,10,1.5,5,4,"#e8dcc0");
  R(x,10.8,3,1.3,1.3,"#3a3122"); R(x,13,3,1.3,1.3,"#3a3122");
  return c;
 }
 // ── Skull Warden (floors 36+; bleeds you) ────────────────────
 // A disembodied giant skull with armour fused to it, sword-arm raised.
 function buildSkullWarden(){
  const c=mk(24,24),x=gx(c);
  // the great skull: broad cranium, heavy jaw
  R(x,6,3,12,9,"#e8dcc0");
  R(x,6,3,12,1.2,"#f0e8d0");                          // crown highlight
  R(x,6,4,1.8,8,"#d8d0b8"); R(x,16.2,4,1.8,8,"#8a7658");   // side shading
  // eye sockets: deep, one lid drooping lower
  R(x,8,6,3,3,"#3a3122"); R(x,13.5,6.5,3,3,"#3a3122");
  R(x,8.8,6.8,1.2,1.2,"#7a2a24"); R(x,14.3,7.3,1.2,1.2,"#7a2a24");   // dried glints
  // nasal cavity + jaw teeth
  R(x,11,9.5,2.4,2,"#2a2216");
  R(x,7,13,10,3,"#d8d0b8");                           // jawbone
  for(let i=0;i<4;i++) R(x,8+i*2.4,13,0.8,1.2,"#2a2216");   // tooth gaps
  R(x,7,12.6,10,0.7,"#f0e8d0");
  // fused armour: a gorget plate bolted under the jaw
  R(x,8,16,8,2,"#b8ac8c"); R(x,8,16,8,0.6,"#e8dcc0");
  R(x,9.4,16.6,0.7,0.7,"#3a3122"); R(x,14,16.6,0.7,0.7,"#3a3122");   // rivets
  // pauldron + sword-arm, raised to strike
  R(x,4,15,4,3,"#e8dcc0"); R(x,4,15,4,0.8,"#f0e8d0");
  R(x,5,18,2,4,"#d8d0b8");                            // arm
  R(x,6.5,20,2.4,2,"#b8ac8c");                        // gauntlet grip
  // the sword: pale blade up and back
  x.strokeStyle="#d8d0b8"; x.lineWidth=1.6; x.lineCap="round";
  x.beginPath(); x.moveTo(7,20); x.lineTo(2,12); x.stroke();
  R(x,1,10.5,2.6,3,"#f0e8d0");                        // blade tip flare
  R(x,4.5,17.5,3,1.4,"#8a7658");                      // crossguard
  // a pauldron on the far side, for symmetry's sake
  R(x,16,15,4,3,"#e8dcc0"); R(x,16,15,4,0.8,"#f0e8d0");
  // old blood down one cheek of the cranium
  x.globalAlpha=0.55; R(x,15,7,1.2,4,"#7a2a24"); x.globalAlpha=1;
  return c;
 }
 // ── The Reassembled (floors 36+; gimmick: reassembles at half HP once) ──
 // A figure stitched together from mismatched parts, visibly wrong.
 function buildReassembled(){
  const c=mk(24,24),x=gx(c);
  // legs: one thick, one thin — stolen from two owners
  R(x,7,18,3.5,4,"#d8d0b8"); R(x,7,21.4,4.5,1.6,"#e8dcc0");
  R(x,13,18,1.8,4,"#c9bfa2"); R(x,12.8,21.4,3,1.6,"#e8dcc0");
  // pelvis: a mismatched vertebra bar, crooked
  R(x,6.5,16.5,11,2,"#b8ac8c");
  R(x,7,17,1,1,"#8a7658"); R(x,10,17.2,1,1,"#8a7658"); R(x,13,16.8,1,1,"#8a7658");
  // torso: plates from different bodies, seams visible
  R(x,7,9,10,8,"#d8d0b8");
  R(x,7,9,10,0.8,"#e8dcc0");
  R(x,9,10,1,6,"#8a7658"); R(x,12,10,1,6,"#8a7658");   // rib-lacing
  // the seams: darker lines where two bodies were joined
  x.strokeStyle="#6a5a40"; x.lineWidth=0.8;
  x.beginPath(); x.moveTo(7,13); x.lineTo(17,13); x.stroke();
  // dried blood at the joins
  x.globalAlpha=0.5; R(x,10,13,4,1.2,"#7a2a24"); x.globalAlpha=1;
  // arms: the left reaches out, the right hangs wrong
  R(x,4,10,3,2,"#e8dcc0"); R(x,3,12,2,6,"#d8d0b8");   // left arm reaching
  R(x,17,10,3,2,"#e8dcc0"); R(x,18,12,2,5,"#c9bfa2"); R(x,18.4,17,1.4,2,"#b8ac8c");
  // the head: a small skull, tilted, bolted on
  R(x,9.5,4.5,5,4.5,"#e8dcc0");
  R(x,10.2,6,1.3,1.3,"#3a3122"); R(x,13,6,1.3,1.3,"#3a3122");
  R(x,10.8,8.2,2.4,0.8,"#2a2216");
  // a bone pin holding the head straight
  R(x,11.6,3.4,0.9,1.2,"#8a7658");
  return c;
 }

 // ── REGISTRATIONS (kind = the roster's `kind` / sprite key) ──
 reg("bone_rat",        buildBoneRat,        [[16,12,4,2,"#e8dcc0"],[15,10,2,2,"#e8dcc0"],[21,12,3,2,"#2a2216"]]);
 reg("grave_skitter",   buildGraveSkitter,   [[0,6,2,2,"#e8dcc0"],[22,6,2,2,"#e8dcc0"],[8,22,2,2,"#e8dcc0"],[14,22,2,2,"#e8dcc0"]]);
 reg("marrow_hound",    buildMarrowHound,    [[21,10,3,2,"#e8dcc0"],[20,8,2,2,"#e8dcc0"],[17,12,4,2,"#2a2216"]]);
 reg("bonecaller",     buildBonecaller,     [[3,10,3,3,"#e8dcc0"],[19,10,3,3,"#e8dcc0"],[10,2,4,2,"#f0e8d0"],[11,20,2,3,"#e8dcc0"]]);
 reg("ossuary_sentry",  buildOssuarySentry,  [[17,8,4,2,"#e8dcc0"],[17,4,2,6,"#d8d0b8"],[4,9,2,6,"#d8d0b8"]]);
 reg("ribcage_brute",   buildRibcageBrute,   [[0,8,4,4,"#e8dcc0"],[20,8,4,4,"#e8dcc0"],[9,3,6,2,"#f0e8d0"]]);
 reg("skull_warden",    buildSkullWarden,    [[0,10,4,4,"#f0e8d0"],[5,18,3,3,"#d8d0b8"],[7,6,2,2,"#ff5c5c"]]);
 reg("reassembled",     buildReassembled,    [[2,11,3,4,"#d8d0b8"],[18,11,3,4,"#d8d0b8"],[10,4,4,2,"#e8dcc0"],[9,9,6,1,"#7a2a24"]]);

 // The registrations above must land in SPR: rebuild the sprite set. This
 // mirrors what con-worldart.js and con-bosssprites.js already do.
 Delve.rebuildSprites();
})();