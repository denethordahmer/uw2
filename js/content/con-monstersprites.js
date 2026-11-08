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

 // ═══════════ THE ASHEN FORGE (ward 5, The Forge Titan) ═══════════
 // Palette anchors, so all eight read as one population: charred iron #241f1e /
 // #171313, clinker #3a3230, ash #6a615c, hot metal #ff6a00, ember #ffb347,
 // white heat #ffe9b0. Silhouettes stay chunky and low so they read at 24px.
 // CONTRAST RULE. The ash floor is dark (measured mean luminance ~50), so a
 // near-black monster vanishes into it — the first pass used char #241f1e and
 // measured meanL 48 against a 50-luminance floor, i.e. literally invisible.
 // Every Forge body therefore sits two steps LIGHTER than the floor: weathered
 // iron and pale ash-grey plating (meanL 95-120) carrying dark shading, with the
 // ember colours as the accent. Dark stays available, but as SHADOW ON a light
 // form rather than as the form itself.
 // The names below describe the ROLE, and every builder draws its body in
 // `char`. So `char` is the LIGHT plate tone and `charD` is the shade — the
 // other way round would turn every monster into a silhouette. (First pass had
 // char = #241f1e; measured meanL 48 on a 50-luminance floor: invisible.)
 const FORGE = {
  char:"#8a8078", charD:"#5a524c", clink:"#b3a89f",
  ash:"#b3a89f", ashL:"#cfc5bb", iron:"#6b625b",
  hot:"#ff6a00", ember:"#ffb347", white:"#ffe9b0"
 };

 // ── Ash Tick (frail, fast; scuttles) ─────────────────────────
 // A low, flattened body like a woodlouse with a glowing seam down its back.
 function buildAshTick(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // legs: six thin, splayed
  x.strokeStyle=F.charD; x.lineWidth=1.2; x.lineCap="round";
  for(let i=0;i<3;i++){
   const ly=13+i*2.6;
   x.beginPath(); x.moveTo(8,ly); x.lineTo(4,ly+2.4); x.stroke();
   x.beginPath(); x.moveTo(16,ly); x.lineTo(20,ly+2.4); x.stroke();
  }
  // carapace: overlapping plates
  R(x,6,10,12,6,F.char);
  R(x,6,10,12,1.4,F.clink);
  R(x,7,13.6,10,1,F.charD);
  R(x,7,16.4,10,1,F.charD);
  // the seam: heat escaping between the plates
  R(x,7,12.4,10,1.2,F.hot);
  R(x,9,12.5,3,0.7,F.white);
  // head, small and forward
  R(x,17,11.5,4,4,F.char);
  R(x,18,12.6,1,1,F.ember); R(x,20.6,12.6,1,1,F.ember);
  // antennae
  x.strokeStyle=F.clink; x.lineWidth=0.8;
  x.beginPath(); x.moveTo(20,11.5); x.lineTo(23,9.5); x.stroke();
  x.beginPath(); x.moveTo(20,14); x.lineTo(23.4,14.6); x.stroke();
  return c;
 }

 // ── Slag Hound (fast, bleeds) ────────────────────────────────
 // Four-legged, head low, a crusted slag ridge along its spine.
 function buildSlagHound(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // legs
  R(x,5,17,2.6,5,F.charD); R(x,9.4,18,2.4,4,F.charD);
  R(x,14,18,2.4,4,F.charD); R(x,18,17,2.6,5,F.charD);
  // body
  R(x,4,11,16,7,F.char);
  R(x,4,11,16,1.3,F.clink);
  R(x,4,17,16,1,F.charD);
  // slag ridge: jagged teeth of cooled rock along the spine
  x.fillStyle=F.clink;
  for(let i=0;i<5;i++){
   const bx=6+i*3;
   x.beginPath(); x.moveTo(bx,11); x.lineTo(bx+1.4,7.6); x.lineTo(bx+2.8,11); x.closePath(); x.fill();
  }
  // a hot seam under the ridge
  R(x,6,12.4,12,0.9,F.hot);
  R(x,9,12.5,4,0.5,F.white);
  // head, thrust forward and down
  R(x,17.5,12,5.5,5,F.char);
  R(x,17.5,12,5.5,1,F.clink);
  R(x,20,14,1.4,1.4,F.ember);       // eye
  // jaw with glinting teeth
  R(x,19,16.4,4,1.2,F.charD);
  x.fillStyle=F.white;
  for(let i=0;i<3;i++) x.fillRect(19.4+i*1.2,16.4,0.5,1.1);
  // tail, whipping up
  x.strokeStyle=F.char; x.lineWidth=2; x.lineCap="round";
  x.beginPath(); x.moveTo(4,13); x.quadraticCurveTo(1,11,1.6,7.6); x.stroke();
  x.fillStyle=F.hot; x.fillRect(1.2,7.2,1.4,1.4);
  return c;
 }

 // ── Cinder Wretch (burns you) ────────────────────────────────
 // A stooped humanoid, ribs cracked open with fire inside.
 function buildCinderWretch(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // legs, thin and bent
  R(x,8,17,2.4,6,F.charD); R(x,13.5,17,2.4,6,F.charD);
  // hunched torso
  R(x,7,8,10,10,F.char);
  R(x,7,8,10,1.2,F.clink);
  // the cracked-open chest: bright core behind blackened ribs
  R(x,9,10,6,6,F.hot);
  R(x,10,11,4,4,F.white);
  R(x,9,10,6,0.8,F.charD); R(x,9,12,6,0.8,F.charD); R(x,9,14,6,0.8,F.charD);
  // arms: one dragging, one raised; both too long
  R(x,3,9,4,3,F.char); R(x,3,11.5,2.6,7,F.char);
  R(x,17,9,4,3,F.char); R(x,18.4,11.5,2.6,7,F.char);
  x.fillStyle=F.ember; x.fillRect(3,18,2.6,1.6); x.fillRect(18.4,18,2.6,1.6);
  // head: a lump above the fire, mostly jaw
  R(x,9,3,6,5,F.char);
  R(x,9,3,6,1,F.clink);
  R(x,10,5.4,1.2,1.2,F.ember); R(x,12.8,5.4,1.2,1.2,F.ember);
  R(x,10,7,4,1.4,F.charD);
  // ash drifting off it
  x.globalAlpha=0.5; x.fillStyle=F.ash;
  x.fillRect(6,4,0.8,0.8); x.fillRect(17,3,0.7,0.7); x.fillRect(15,7,0.6,0.6);
  x.globalAlpha=1;
  return c;
 }

 // ── Furnace Guard (slow, weakens) ────────────────────────────
 // A squat iron-plated thing with a furnace grate for a face.
 function buildFurnaceGuard(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // heavy legs
  R(x,6,18,5,5,F.charD); R(x,13,18,5,5,F.charD);
  R(x,6,21.5,5,1.5,F.clink); R(x,13,21.5,5,1.5,F.clink);
  // barrel torso
  R(x,4,7,16,12,F.char);
  R(x,4,7,16,1.4,F.clink);
  R(x,4,7,1.6,12,F.charD); R(x,18.4,7,1.6,12,F.charD);
  // riveted bands
  R(x,4,11,16,0.9,F.charD); R(x,4,15.4,16,0.9,F.charD);
  x.fillStyle=F.clink;
  for(let i=0;i<5;i++){ x.fillRect(5+i*3.4,10.2,0.9,0.9); x.fillRect(5+i*3.4,14.6,0.9,0.9); }
  // the grate face: vertical bars with fire behind
  R(x,8,8.4,8,5.4,F.charD);
  R(x,8.6,9,6.8,4.2,F.hot);
  R(x,9.4,9.6,2.4,3,F.white);
  R(x,8,8.4,8,0.6,F.clink);
  for(let i=0;i<4;i++) R(x,8.6+i*1.8,9,0.7,4.2,F.charD);
  // arms and fists
  R(x,1,9,3,4,F.char); R(x,20,9,3,4,F.char);
  R(x,0.6,12,3.4,3,F.clink); R(x,20,12,3.4,3,F.clink);
  return c;
 }

 // ── Emberfiend (burns) ───────────────────────────────────────
 // A floating cinder wraith: a hood of ash with two burning eyes.
 function buildEmberfiend(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // trailing robe, ragged at the bottom
  x.fillStyle=F.char;
  x.beginPath();
  x.moveTo(12,3); x.lineTo(18,8); x.lineTo(19.5,18); x.lineTo(16,16);
  x.lineTo(14,20); x.lineTo(11,16.6); x.lineTo(8.5,20); x.lineTo(6,16);
  x.lineTo(4.5,18); x.lineTo(6,8); x.closePath(); x.fill();
  // hood interior: darker
  R(x,8,5,8,7,F.charD);
  // eyes: two hot points, the whole read at a glance
  R(x,9,8,2.2,1.8,F.hot); R(x,13,8,2.2,1.8,F.hot);
  R(x,9.6,8.5,1,0.9,F.white); R(x,13.6,8.5,1,0.9,F.white);
  // ember motes rising
  x.fillStyle=F.ember;
  x.fillRect(10,2,0.9,0.9); x.fillRect(14,1,0.7,0.7); x.fillRect(17,4,0.8,0.8);
  x.fillRect(6,3,0.7,0.7);
  // glowing hem
  R(x,7,15.4,10,0.8,F.hot);
  R(x,9,15.5,4,0.5,F.white);
  return c;
 }

 // ── Molten Brute (slow, hits hard) ───────────────────────────
 // A hulking mass of slag with cracks of liquid rock running through it.
 function buildMoltenBrute(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // thick legs
  R(x,5,18,5,5,F.char); R(x,14,18,5,5,F.char);
  R(x,5,21.6,5,1.4,F.charD); R(x,14,21.6,5,1.4,F.charD);
  // enormous shoulders and torso
  R(x,2,6,20,13,F.char);
  R(x,2,6,20,1.6,F.clink);
  // the cracks: bright forks down the body
  x.strokeStyle=F.hot; x.lineWidth=1.4; x.lineCap="round";
  x.beginPath();
  x.moveTo(9,7); x.lineTo(10.6,11); x.lineTo(8.6,14); x.lineTo(10,18);
  x.moveTo(10.6,11); x.lineTo(14,9.6);
  x.moveTo(17,7.6); x.lineTo(15.4,12); x.lineTo(17.6,15);
  x.stroke();
  x.strokeStyle=F.white; x.lineWidth=0.6;
  x.beginPath(); x.moveTo(9.4,7.6); x.lineTo(10.4,10.6); x.stroke();
  // head: a small sunken thing between the shoulders
  R(x,9,2,6,5,F.char);
  R(x,9,2,6,1,F.clink);
  R(x,10,4,1.4,1.4,F.ember); R(x,12.8,4,1.4,1.4,F.ember);
  // arms: boulder fists
  R(x,0.4,8,3.4,9,F.char); R(x,20.2,8,3.4,9,F.char);
  R(x,0,15,4,5,F.clink); R(x,20,15,4,5,F.clink);
  // heat shimmer at the knuckles
  x.globalAlpha=0.5; x.fillStyle=F.ember;
  x.fillRect(1,14,2,1); x.fillRect(21,14,2,1); x.globalAlpha=1;
  return c;
 }

 // ── Smog Stalker (poisons) ───────────────────────────────────
 // Tall and thin, wrapped in fume, face hidden.
 function buildSmogStalker(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // long legs
  R(x,9,15,2.4,8,F.charD); R(x,13,15,2.4,8,F.charD);
  // narrow torso
  R(x,8,6,8,10,F.char);
  R(x,8,6,8,1,F.clink);
  // fume wrap: bands of haze across the body
  x.globalAlpha=0.55; x.fillStyle=F.ash;
  x.beginPath(); x.ellipse(12,9,7,2.2,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(12,13,6,1.8,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(12,17,5.4,1.6,0,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  // hood: no face, one sickly green-yellow glow
  R(x,8.6,2,6.8,5.4,F.charD);
  R(x,10.4,4,1.4,1.4,"#b8d84a"); R(x,13,4,1.4,1.4,"#b8d84a");
  // long arms hanging
  R(x,4.6,7,3,10,F.charD); R(x,16.4,7,3,10,F.charD);
  // fume trails
  x.globalAlpha=0.35; x.fillStyle="#9aa84a";
  x.beginPath(); x.ellipse(4,18,2.6,1.2,0.3,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(20,17,2.4,1.1,-0.3,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  return c;
 }

 // ── The Reforged (splits on death) ───────────────────────────
 // Humanoid, seamless, with a bright seam where it will break in half.
 function buildReforged(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // legs
  R(x,8,17,3,6,F.char); R(x,13,17,3,6,F.char);
  // torso, broad, smooth — forged rather than scavenged
  R(x,6,5,12,13,F.char);
  R(x,6,5,12,1.3,F.clink);
  // the split seam: a vertical line of heat down the exact middle
  R(x,11.4,6,1.2,11,F.hot);
  R(x,11.6,8,0.7,3,F.white);
  // horizontal segment lines, like a casting
  R(x,6,9,12,0.7,F.charD); R(x,6,13,12,0.7,F.charD);
  // head: smooth wedge, no face but a visor slit
  R(x,8,1.4,8,4.4,F.char);
  R(x,8,1.4,8,1,F.clink);
  R(x,9,3.4,6,1.2,F.hot);
  R(x,10,3.6,2,0.7,F.white);
  // arms
  R(x,3,6,3,9,F.char); R(x,18,6,3,9,F.char);
  R(x,2.6,14,3.4,3,F.clink); R(x,18,14,3.4,3,F.clink);
  return c;
 }

 // ── Reforged Shard (the split half; smaller, same language) ──
 function buildReforgedShard(){
  const c=mk(24,24),x=gx(c),F=FORGE;
  // a chopped-off half: one leg, one arm, a broken edge along one side
  R(x,10,15,2.6,8,F.char);
  R(x,11,6,7,10,F.char);
  R(x,11,6,7,1,F.clink);
  // the broken edge, still molten
  R(x,10.6,6,0.9,10,F.hot);
  R(x,10.8,9,0.5,3,F.white);
  // the remaining arm
  R(x,18,7,2.6,8,F.char);
  R(x,18,13.6,2.8,2.6,F.clink);
  // broken head
  R(x,12,2,5,4,F.char);
  R(x,13,3.2,2.6,1,F.ember);
  return c;
 }

 // ── REGISTRATIONS (kind = the roster's `kind` / sprite key) ──
 reg("ash_tick",        buildAshTick,        [[19,10,4,2,"#ffb347"],[6,10,5,2,"#3a3230"]]);
 reg("slag_hound",      buildSlagHound,      [[18,12,6,2,"#ffb347"],[2,6,3,3,"#ff6a00"]]);
 reg("cinder_wretch",   buildCinderWretch,   [[2,9,5,3,"#ff6a00"],[17,9,5,3,"#ff6a00"],[9,10,6,5,"#ffe9b0"]]);
 reg("furnace_guard",   buildFurnaceGuard,   [[0,11,4,4,"#ffb347"],[20,11,4,4,"#ffb347"],[8,8,8,6,"#ffe9b0"]]);
 reg("emberfiend",      buildEmberfiend,     [[8,5,9,8,"#ff6a00"],[6,16,12,3,"#ffb347"]]);
 reg("molten_brute",    buildMoltenBrute,    [[0,14,5,6,"#ff6a00"],[19,14,5,6,"#ff6a00"],[8,6,8,3,"#ffe9b0"]]);
 reg("smog_stalker",    buildSmogStalker,    [[4,7,4,10,"#9aa84a"],[16,7,4,10,"#9aa84a"],[8,2,8,5,"#b8d84a"]]);
 reg("reforged",        buildReforged,       [[11,5,2,13,"#ffe9b0"],[3,6,3,9,"#ff6a00"],[18,6,3,9,"#ff6a00"]]);
 reg("reforged_shard",  buildReforgedShard,  [[10,6,1,10,"#ffe9b0"],[18,7,3,8,"#ff6a00"]]);

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