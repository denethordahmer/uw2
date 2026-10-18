window.Delve = window.Delve || {};
(function(){
 const U = Delve._spriteUtils;
 if(!U) return; // sprites.js must load first
 const mk = U.mk, gx = U.gx, R = U.R;
 const reg = Delve.registerWorldSprite;

 // ═══════════════════════════════════════════════════════════
 // content/con-worldart.js : world ART as content (data only).
 // Arena props (Batches 8/9) and the biome ground-cover sprites (Batch 16)
 // moved out of sprites.js on 16 Oct, so a new biome adds builders and a
 // registration here instead of growing the engine. The per-biome floor
 // clutter/growth families live here too, registered via Delve.registerClutter
 // and consumed by render.js at draw time.
 // ⚠ Load-order constraint: must load AFTER js/sprites.js — it needs
 //   _spriteUtils, registerWorldSprite, registerClutter and rebuildSprites.
 // ═══════════════════════════════════════════════════════════

 // ── THE UPPER RUINS (The Warden) ────────────────────────────
 // Floor props are one tile (24x24, art on the bottom of the canvas); hanging
 // props are 24x36 and are drawn from the top of a wall tile, spilling into the
 // tile below — that is what makes them read as "hanging".
 function buildPropPillar(){
  const c=mk(24,24),x=gx(c);
  R(x,6,20,12,4,"#4a525e");R(x,6,20,12,1,"#5a616c");
  R(x,8,6,8,15,"#56636f");R(x,8,6,2,15,"#6d7a88");R(x,14,6,2,15,"#3a4248");
  R(x,7,3,10,3,"#4a525e");R(x,7,3,10,1,"#6d7a88");
  R(x,10,1,4,2,"#56636f");
  R(x,9,11,6,1,"#3a4248");R(x,11,15,4,1,"#3a4248");
  R(x,3,21,5,3,"#4a525e");R(x,17,22,4,2,"#3a4248");
  return c;
 }
 // Bespoke banners: NOT one shape recoloured — each boss's standard has its own
 // silhouette and carries that boss's own colours. The Warden's is military.
 function buildBannerWarden(){
  const c=mk(24,36),x=gx(c);
  R(x,2,0,20,2,"#5a4a34");R(x,2,0,20,1,"#7a654a");             // brass rod
  R(x,4,2,16,24,"#23262d");                                    // steel cloth
  R(x,4,2,3,24,"#343a43");R(x,17,2,3,24,"#151920");            // folds
  R(x,4,26,16,3,"#343a43");                                    // hem
  R(x,6,6,12,2,"#4a525e");R(x,10,8,4,7,"#4a525e");R(x,8,13,8,2,"#4a525e");  // hammer crest
  R(x,10,9,4,1,"#7ee0ff");R(x,8,14,8,1,"#7ee0ff");             // his pale-blue eyes
  R(x,7,20,10,1,"rgba(255,74,61,0.35)");                       // a hint of his red gaze
  R(x,6,29,5,4,"#23262d");R(x,13,29,6,3,"#343a43");            // torn tails
  return c;
 }
 function buildPropChain(){
  const c=mk(24,36),x=gx(c);
  R(x,10,0,4,2,"#5a616c");
  for(let i=0;i<5;i++){ const y=2+i*6; R(x,9,y,6,2,"#57616d"); R(x,10,y+1,4,3,"#3a4248"); }
  R(x,8,32,8,2,"#4a525e");
  return c;
 }
 function buildPropRubble(){
  const c=mk(24,24),x=gx(c);
  R(x,4,18,6,4,"#4a525e");R(x,4,18,6,1,"#6d7a88");
  R(x,10,16,7,6,"#56636f");R(x,10,16,7,1,"#6d7a88");R(x,10,20,7,2,"#3a4248");
  R(x,17,19,4,3,"#4a525e");R(x,7,15,4,3,"#3a4248");R(x,13,13,3,3,"#4a525e");
  return c;
 }
 function buildPropBones(){
  const c=mk(24,24),x=gx(c);
  R(x,9,16,6,6,"#c9c2b0");
  R(x,10,18,1,2,"#2b2118");R(x,13,18,1,2,"#2b2118");R(x,11,21,2,1,"#2b2118");
  R(x,3,21,12,2,"#c9c2b0");R(x,3,20,3,4,"#a8a292");R(x,13,20,3,4,"#a8a292");
  R(x,17,17,1,6,"#c9c2b0");R(x,19,16,1,7,"#c9c2b0");R(x,17,17,3,1,"#c9c2b0");R(x,17,20,3,1,"#c9c2b0");
  return c;
 }
 // The Undercroft echoes its guardian: a toppled stone knight at the door, one
 // ember still lit in its visor.
 function buildStatueWarden(){
  const c=mk(24,24),x=gx(c);
  R(x,3,19,18,4,"#4a525e");R(x,3,19,18,1,"#6d7a88");           // fallen slab
  R(x,5,12,7,8,"#56636f");R(x,5,12,7,1,"#6d7a88");             // torso
  R(x,13,14,6,6,"#4a525e");                                    // helm, resting
  R(x,15,17,3,1,"#ff4a3d");                                    // a dull ember of an eye
  R(x,3,9,5,4,"#4a525e");R(x,8,8,4,4,"#3a4248");               // shield and gauntlet
  R(x,17,20,4,3,"#3a4248");R(x,2,21,4,2,"#3a4248");
  return c;
 }
 // ── THE BLACKVEIN (The Thorn Sovereign) ─────────────────────
 // The arena furniture: petrified, thorned, moss-lit.
 function buildPillarThorn(){
  const c=mk(24,24),x=gx(c);
  R(x,5,21,14,3,"#2a1a0e");R(x,5,21,14,1,"#3a2418");           // root base
  R(x,8,6,8,16,"#3a2418");R(x,8,6,2,16,"#5a3a24");R(x,14,6,2,16,"#20140a");
  R(x,6,3,12,3,"#2a1a0e");R(x,6,3,12,1,"#3a2418");             // splayed crown
  R(x,7,12,2,3,"#4a3a1e");R(x,15,9,2,3,"#4a3a1e");             // thorn nubs
  R(x,10,4,1,15,"#20140a");                                    // a deep groove
  R(x,9,18,6,1,"#a8e84a");R(x,12,10,3,1,"#c8d84a");            // seam-glow, his colour
  R(x,2,22,5,2,"#2a1a0e");R(x,17,21,5,2,"#2a1a0e");
  return c;
 }
 function buildBannerThorn(){
  const c=mk(24,36),x=gx(c);
  R(x,3,0,18,3,"#2a1a0e");R(x,3,0,18,1,"#3a2418");             // thick branch
  R(x,5,3,4,20,"#3d5a22");R(x,11,3,4,26,"#4a6a28");R(x,16,3,3,17,"#3d5a22");  // hanging vines
  R(x,4,7,5,4,"#5a7a2a");R(x,10,9,5,4,"#7a9a3a");R(x,15,6,5,4,"#5a7a2a");     // leaf clusters
  R(x,5,8,2,2,"#a8e84a");R(x,12,10,2,2,"#c8d84a");R(x,16,7,2,2,"#a8e84a");   // glowing veins
  R(x,6,25,5,6,"#4a6a28");R(x,12,30,5,4,"#5a7a2a");            // leaves low down
  R(x,7,27,2,2,"#c8d84a");R(x,13,31,2,2,"#a8e84a");
  return c;
 }
 function buildPropRootHang(){
  const c=mk(24,36),x=gx(c);
  R(x,4,0,16,3,"#2a1a0e");R(x,4,0,16,1,"#3a2418");
  const roots=[[6,14],[10,20],[14,16],[18,11]];
  for(let i=0;i<roots.length;i++){
   const bx=roots[i][0], hh=roots[i][1];
   R(x,bx,3,3,hh,"#3a2418");R(x,bx,3,1,hh,"#5a3a24");R(x,bx,3+hh,3,2,"#7a9a3a");
  }
  return c;
 }
 function buildRubbleThorn(){
  const c=mk(24,24),x=gx(c);
  R(x,4,18,8,5,"#3a2418");R(x,4,18,8,1,"#5a3a24");
  R(x,11,16,8,6,"#2a1a0e");R(x,11,16,8,1,"#4a3a1e");R(x,11,20,8,2,"#20140a");
  R(x,16,19,5,3,"#3a2418");R(x,7,14,4,4,"#3a2418");
  R(x,5,19,3,2,"#7a9a3a");R(x,13,17,3,2,"#7a9a3a");            // moss over the bark
  R(x,18,17,2,2,"#a8e84a");                                    // a spore, still glowing
  return c;
 }
 // The Blackvein's answer to bones: a hollow husk still gripped by its roots.
 function buildHuskThorn(){
  const c=mk(24,24),x=gx(c);
  R(x,8,15,8,7,"#3d5a22");R(x,9,16,6,1,"#5a7a2a");             // pod
  R(x,10,15,1,7,"#2a1a0e");R(x,14,15,1,7,"#2a1a0e");           // ribs
  R(x,11,18,2,3,"#20140a");                                    // hollow gash
  R(x,4,21,16,2,"#2a1a0e");R(x,5,20,3,2,"#3a2418");R(x,16,20,4,2,"#3a2418"); // roots gripping
  R(x,12,14,4,2,"#7a9a3a");R(x,13,14,2,1,"#eaffa8");           // glow where an eye was
  return c;
 }
 function buildPropThorns(){
  const c=mk(24,24),x=gx(c);
  R(x,4,20,16,4,"#2a1a0e");R(x,4,20,16,1,"#3a2418");
  const sp=[[6,6],[10,12],[15,9],[19,5]];
  for(let i=0;i<sp.length;i++){
   const bx=sp[i][0], hh=sp[i][1];
   R(x,bx,20-hh,2,hh,"#4a3a1e");R(x,bx,20-hh-2,2,2,"#c8d84a");
  }
  R(x,12,14,3,1,"#c8d84a");
  return c;
 }
 // ── THE FROSTED VAULT (The Pale Tempest) ────────────────────
 // Everything sheathed in ice or frosted stiff.
 function buildPillarIce(){
  const c=mk(24,24),x=gx(c);
  R(x,5,21,14,3,"#3a4a5e");R(x,5,21,14,1,"#5a7a8a");
  R(x,8,6,8,16,"#4a5a6e");R(x,8,6,2,16,"#a8e8ff");R(x,14,6,2,16,"#22303f");
  R(x,6,3,12,3,"#3a4a5e");R(x,6,3,12,1,"#7ec8e0");
  R(x,6,10,3,7,"#7ec8e0");R(x,15,8,3,8,"#a8e8ff");             // sheathing
  R(x,10,16,5,4,"#7ec8e0");R(x,11,17,3,2,"#eaffff");           // ice across the base
  R(x,3,22,5,2,"#4a5a6e");R(x,17,21,4,2,"#3a4a5e");
  return c;
 }
 function buildBannerFrost(){
  const c=mk(24,36),x=gx(c);
  R(x,2,0,20,2,"#6a86a8");R(x,2,0,20,1,"#a8e8ff");             // frosted rod
  R(x,4,2,16,20,"#2a4a6a");                                    // cloth, washed pale
  R(x,4,2,3,20,"#3a6a8a");R(x,17,2,3,20,"#1a2436");            // folds
  R(x,4,22,16,2,"#7ec8e0");                                    // frozen hem
  R(x,6,24,4,7,"#a8e8ff");R(x,11,24,3,9,"#eaffff");R(x,16,24,4,6,"#a8e8ff"); // icicle fringe
  R(x,8,6,8,9,"#a8e8ff");R(x,10,8,4,4,"#eaffff");              // the storm's own pale core
  return c;
 }
 function buildPropIcicle(){
  const c=mk(24,36),x=gx(c);
  R(x,2,0,20,2,"#7ec8e0");R(x,2,0,20,1,"#eaffff");
  const shards=[[4,16],[9,26],[14,20],[19,12]];
  for(let i=0;i<shards.length;i++){
   const bx=shards[i][0], hh=shards[i][1];
   R(x,bx,2,3,hh,"#a8e8ff");R(x,bx,2,1,hh,"#eaffff");R(x,bx,2+hh-2,3,2,"#7ec8e0");
  }
  return c;
 }
 function buildRubbleIce(){
  const c=mk(24,24),x=gx(c);
  R(x,4,18,7,5,"#3a4a5e");R(x,4,18,7,1,"#7ec8e0");
  R(x,11,16,8,6,"#4a5a6e");R(x,11,16,8,1,"#a8e8ff");R(x,11,20,8,2,"#22303f");
  R(x,17,19,4,3,"#3a4a5e");
  R(x,6,14,4,4,"#7ec8e0");R(x,7,15,2,2,"#eaffff");             // shards standing in it
  R(x,13,12,3,4,"#a8e8ff");
  return c;
 }
 function buildBonesIce(){
  const c=mk(24,24),x=gx(c);
  R(x,4,19,16,3,"#7ec8e0");R(x,4,19,16,1,"#eaffff");           // a slab of ice
  R(x,9,14,6,5,"#c9c2b0");                                     // skull, half sunk
  R(x,10,16,1,2,"#22303f");R(x,13,16,1,2,"#22303f");
  R(x,3,18,10,2,"#c9c2b0");R(x,17,15,1,6,"#c9c2b0");
  R(x,6,20,4,2,"#a8e8ff");R(x,14,12,3,3,"#a8e8ff");            // frost creeping over it
  return c;
 }
 function buildPropCrystals(){
  const c=mk(24,24),x=gx(c);
  R(x,3,20,18,4,"#5a7a8a");R(x,3,20,18,1,"#8fb6c8");
  const cr=[[5,9],[9,15],[13,11],[17,7]];
  for(let i=0;i<cr.length;i++){
   const bx=cr[i][0], hh=cr[i][1];
   R(x,bx-1,20-hh,3,hh,"#7ec8e0");R(x,bx-1,20-hh,1,hh,"#eaffff");R(x,bx+1,20-hh,1,hh-2,"#5aa8c8");R(x,bx-1,20-hh-1,3,1,"#eaffff");
  }
  R(x,7,14,2,2,"#eaffff");
  return c;
 }
 // ── BIOME GROUND COVER (Batch 16) ───────────────────────────
 // One self-contained drawing per tile; tiles in a cluster never need to line
 // up. Named by BIOMES[n].groundCover, placed by js/ground.js.
 // The Blackvein — blood moss: corruption creeping across the floor.
 function buildGroundMoss(){
  const c=mk(24,24),x=gx(c);
  // ── the spreading body ──
  // an irregular, blobby silhouette hugging the tile's lower half — the
  // corruption creeping along the ground, never a neat stain
  x.fillStyle="#7a2a24";
  x.beginPath();
  x.ellipse(11,17,8.5,4.2,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(17,18,5,3.4,0.2,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(6,18.5,4,2.8,-0.15,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(13,14.5,5.5,2.4,0.1,0,Math.PI*2); x.fill();
  // ── creeping tendrils reaching outward ──
  // tapered, rounded, some hooked slightly upward — it *reaches*
  x.strokeStyle="#7a2a24"; x.lineCap="round";
  x.lineWidth=2.4;
  x.beginPath(); x.moveTo(4,17); x.quadraticCurveTo(1.5,16,1,13.5); x.stroke();
  x.beginPath(); x.moveTo(19,16); x.quadraticCurveTo(22,14.5,22.5,11.5); x.stroke();
  x.lineWidth=1.6;
  x.beginPath(); x.moveTo(9,14); x.quadraticCurveTo(8.5,11.5,10,9.5); x.stroke();
  x.beginPath(); x.moveTo(15,13.5); x.quadraticCurveTo(16,11,15,9); x.stroke();
  // tendril tips, rounded droplets
  x.fillStyle="#7a2a24";
  x.beginPath(); x.arc(1,13.5,1.3,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(22.5,11.5,1.3,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(10,9.5,0.9,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(15,9,0.9,0,Math.PI*2); x.fill();
  // ── wet raised highlights on the body ──
  x.fillStyle="#a8353a";
  x.beginPath(); x.ellipse(9,15.5,4,1.6,-0.12,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(15,16.5,3.4,1.4,0.18,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(12,13.8,3,1.1,0.08,0,Math.PI*2); x.fill();
  // darker pits for depth
  x.fillStyle="#4a1410";
  x.beginPath(); x.ellipse(13.5,17.5,1.6,0.9,0.2,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(7,18,1.3,0.7,-0.2,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(17.5,15,0.8,0,Math.PI*2); x.fill();
  // tiny fungal speckles
  x.fillStyle="rgba(168,53,58,0.85)";
  x.beginPath(); x.arc(5.5,16.5,0.55,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(11,16.8,0.5,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(16,13.2,0.55,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(20,17.5,0.5,0,Math.PI*2); x.fill();
  // ── the sickly rim: brightest where the growth is newest ──
  x.strokeStyle="#c8a838"; x.lineCap="round";
  x.lineWidth=0.9; x.globalAlpha=0.85;
  x.beginPath(); x.moveTo(1.2,12.6); x.quadraticCurveTo(1.6,14.8,3,16); x.stroke();   // left tendril
  x.beginPath(); x.moveTo(22.4,10.6); x.quadraticCurveTo(22,13.4,20.6,14.6); x.stroke(); // right tendril
  x.beginPath(); x.moveTo(9.7,9.9); x.lineTo(9.3,11.6); x.stroke();                    // mid tendril
  x.globalAlpha=0.6;
  x.beginPath(); x.ellipse(11,13.3,5.6,1.6,0.1,Math.PI,0); x.stroke();                 // upper rim of the body
  x.globalAlpha=0.5;
  x.beginPath(); x.ellipse(17,15.6,4,1.4,0.2,Math.PI,0); x.stroke();                   // right lobe rim
  x.globalAlpha=1;
  // ── faint spores hanging above the patch ──
  x.fillStyle="rgba(200,168,56,0.4)";
  x.beginPath(); x.arc(7,8,0.5,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(13,6.5,0.4,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(18,9,0.5,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(10,11,0.4,0,Math.PI*2); x.fill();
  return c;
 }
 // The Frosted Vault — frozen puddles: water frozen so long it will never melt.
 function buildGroundIce(){
  const c=mk(24,24),x=gx(c);
  // ── the frozen sheet ──
  // an irregular, slightly squashed puddle hugging the tile's mid/lower area;
  // deeper blue toward its lower edge so it reads as a shallow pool
  x.fillStyle="#b8d8e8";
  x.beginPath();
  x.ellipse(11,15,8.5,4.6,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(17,16.5,5.2,3.4,0.15,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(6,16.5,4.4,3,-0.1,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(12,12.5,5.8,2.6,-0.05,0,Math.PI*2); x.fill();
  // the pool's depth: a cold wash toward the lower edge
  const deep=x.createLinearGradient(0,12,0,20);
  deep.addColorStop(0,"rgba(90,122,148,0)");
  deep.addColorStop(1,"rgba(90,122,148,0.30)");
  x.fillStyle=deep;
  x.beginPath(); x.ellipse(11,15,9.2,5,0,0,Math.PI); x.fill();
  // ── crisp pale rim on the upper/left lip ──
  x.strokeStyle="#eaffff"; x.lineCap="round"; x.lineWidth=1; x.globalAlpha=0.8;
  x.beginPath(); x.ellipse(11,13.4,7.4,2.8,-0.06,Math.PI*1.05,Math.PI*1.95); x.stroke();
  x.globalAlpha=0.55;
  x.beginPath(); x.ellipse(17,15.6,4.6,2.6,0.15,Math.PI*1.1,Math.PI*1.9); x.stroke();
  x.globalAlpha=1;
  // ── frozen veins: etched into the ice, branching ──
  x.strokeStyle="rgba(240,250,255,0.9)"; x.lineWidth=0.9;
  x.beginPath();
  x.moveTo(4,16.5);
  x.quadraticCurveTo(9,15,13,16.2);            // the main vein, wavering
  x.quadraticCurveTo(17,17.4,21,16.4);
  x.stroke();
  // hairline forks off the main vein
  x.strokeStyle="rgba(240,250,255,0.65)"; x.lineWidth=0.7;
  x.beginPath();
  x.moveTo(9,15.6); x.lineTo(8,12.8);           // fork up-left
  x.moveTo(13,16.2); x.lineTo(14.5,13.4);       // fork up-right
  x.moveTo(17.5,17.2); x.lineTo(19,19);         // fork down-right
  x.stroke();
  // a second, fainter vein lower in the sheet
  x.strokeStyle="rgba(240,250,255,0.4)"; x.lineWidth=0.7;
  x.beginPath(); x.moveTo(6,19); x.quadraticCurveTo(11,20,16,19.2); x.stroke();
  // ── faint reflections of the surrounding walls ──
  // soft vertical smudges in the wall-tone blue, very low alpha
  x.fillStyle="rgba(58,74,94,0.16)";
  x.beginPath(); x.ellipse(9,15,1.6,3.4,0,0,Math.PI*2); x.fill();
  x.beginPath(); x.ellipse(16,16,1.3,2.8,0.1,0,Math.PI*2); x.fill();
  x.fillStyle="rgba(122,154,192,0.14)";
  x.beginPath(); x.ellipse(12.5,17.5,1.8,2.4,0,0,Math.PI*2); x.fill();
  // ── a small frost bloom at the sheet's edge ──
  // three needle crystals fanning out from one point
  x.strokeStyle="#eaffff"; x.lineWidth=0.9; x.lineCap="round"; x.globalAlpha=0.9;
  x.beginPath();
  x.moveTo(20.5,12.5); x.lineTo(23,10);         // needle up-right
  x.moveTo(20.5,12.5); x.lineTo(23.4,12.8);     // needle right
  x.moveTo(20.5,12.5); x.lineTo(21.8,9.8);      // needle between
  x.stroke();
  x.globalAlpha=0.7;
  x.beginPath(); x.arc(23.2,9.9,0.8,0,Math.PI*2); x.stroke();  // a small hexagonal glint
  x.globalAlpha=1;
  // ── micro glitter on the surface ──
  x.fillStyle="rgba(255,255,255,0.5)";
  x.fillRect(7.5,14.5,0.8,0.8); x.fillRect(14,17,0.8,0.8);
  x.fillRect(18,14,0.7,0.7); x.fillRect(10,18.5,0.7,0.7);
  x.fillRect(5.5,17.5,0.6,0.6);
  return c;
 }
 // ── REGISTRATIONS ──────────────────────────────────────────
 // Arena props (which ward uses which is CONFIG.DRESSING in con-biomes.js;
 // where they go is levels.js dressBossArena; how they're drawn is render.js).
 reg("prop_pillarWarden", buildPropPillar);
 reg("prop_bannerWarden", buildBannerWarden);
 reg("prop_chainWarden", buildPropChain);
 reg("prop_rubbleWarden", buildPropRubble);
 reg("prop_bonesWarden", buildPropBones);
 reg("prop_statueWarden", buildStatueWarden);
 reg("prop_pillarThorn", buildPillarThorn);
 reg("prop_bannerThorn", buildBannerThorn);
 reg("prop_rootThorn", buildPropRootHang);
 reg("prop_rubbleThorn", buildRubbleThorn);
 reg("prop_huskThorn", buildHuskThorn);
 reg("prop_clusterThorn", buildPropThorns);
 reg("prop_pillarFrost", buildPillarIce);
 reg("prop_bannerFrost", buildBannerFrost);
 reg("prop_icicleFrost", buildPropIcicle);
 reg("prop_rubbleFrost", buildRubbleIce);
 reg("prop_bonesFrost", buildBonesIce);
 reg("prop_clusterFrost", buildPropCrystals);
 // Biome ground cover (named by BIOMES[n].groundCover in con-biomes.js).
 reg("ground_moss", buildGroundMoss);
 reg("ground_ice", buildGroundIce);

 // ── CLUTTER FAMILIES (moved from render.js, 16 Oct) ────────
 // Two painters per non-ruins biome, consumed by render.js drawClutter /
 // drawWeed at draw time. The ruins family stays inline there as the fallback.
 // hash3 resolves through state.js (Delve.hash3) at draw time.
 const hash3 = function(x, y, salt){ return Delve.hash3(x, y, salt); };

 Delve.registerClutter("frost", {
  clutter: function(ctx, sx, sy, ts, roll){
   ctx.save(); ctx.globalAlpha=0.55;
   if(roll < 0.012){
    // ice shards pushing through the slab
    ctx.fillStyle="#7ec8e0";
    [[0.40,0.62,1.0],[0.55,0.64,0.72],[0.30,0.63,0.55]].forEach(function(s){
     const bx=sx+ts*s[0], by=sy+ts*s[1], hh=ts*0.17*s[2];
     ctx.beginPath(); ctx.moveTo(bx,by-hh); ctx.lineTo(bx-ts*0.05*s[2],by); ctx.lineTo(bx+ts*0.05*s[2],by); ctx.closePath(); ctx.fill();
    });
   } else if(roll < 0.02){
    // a drift of snow
    ctx.fillStyle="#dff0ff";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.60,ts*0.26,ts*0.09,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.35; ctx.fillStyle="#ffffff";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.46,sy+ts*0.57,ts*0.15,ts*0.05,0,0,Math.PI*2); ctx.fill();
   } else {
    // frozen puddle: dark water under a skin of ice
    ctx.globalAlpha=0.45; ctx.fillStyle="#1a3a5e";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.58,ts*0.19,ts*0.10,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.5; ctx.strokeStyle="#cfeeff"; ctx.lineWidth=Math.max(1,ts*0.02);
    ctx.beginPath(); ctx.moveTo(sx+ts*0.37,sy+ts*0.56); ctx.lineTo(sx+ts*0.61,sy+ts*0.62); ctx.stroke();
   }
   ctx.restore();
  },
  weed: function(ctx, sx, sy, ts, gx, gy, b, type){
   ctx.save(); ctx.globalAlpha=0.75;
   const cx=sx+ts*(0.3+hash3(gx,gy,61)*0.4), cy=sy+ts*(0.4+hash3(gx,gy,67)*0.4), sc=ts/40;
   switch(type % 3){
    case 0:   // frost fern
     ctx.strokeStyle="#7ec8e0"; ctx.lineWidth=Math.max(1,sc*1.1); ctx.lineCap="round";
     ctx.beginPath();
     for(let i=-1;i<=1;i++){
      ctx.moveTo(cx,cy+sc*5);
      ctx.quadraticCurveTo(cx+i*sc*4, cy+sc*1, cx+i*sc*8, cy-sc*6);
     }
     ctx.stroke(); break;
    case 1:   // cluster of ice crystals
     ctx.fillStyle="#7ec8e0";
     [[-3.2,3,5.0],[0,3,8.0],[3.2,3,5.5]].forEach(function(s){
      const bx=cx+s[0]*sc, by=cy+sc*2;
      ctx.beginPath(); ctx.moveTo(bx,by-s[2]*sc); ctx.lineTo(bx-sc*1.5,by); ctx.lineTo(bx+sc*1.5,by); ctx.closePath(); ctx.fill();
     });
     ctx.globalAlpha=0.45; ctx.fillStyle="#eaffff";
     ctx.beginPath(); ctx.arc(cx,cy+sc*1,sc*2,0,Math.PI*2); ctx.fill();
     break;
    default:  // blades of grass, frozen stiff
     ctx.strokeStyle="#a8e8ff"; ctx.lineWidth=Math.max(1,sc*0.9); ctx.lineCap="round";
     ctx.beginPath();
     ctx.moveTo(cx-sc*4,cy+sc*5); ctx.lineTo(cx-sc*2,cy-sc*4);
     ctx.moveTo(cx,cy+sc*5); ctx.lineTo(cx+sc*1,cy-sc*6);
     ctx.moveTo(cx+sc*4,cy+sc*5); ctx.lineTo(cx+sc*6,cy-sc*3);
     ctx.stroke();
     ctx.globalAlpha=0.5; ctx.fillStyle="#eaffff";
     ctx.beginPath(); ctx.arc(cx+sc*1,cy-sc*6,sc*1.2,0,Math.PI*2); ctx.fill();
     break;
   }
   ctx.restore();
  }
 });
 Delve.registerClutter("blackvein", {
  clutter: function(ctx, sx, sy, ts, roll){
   ctx.save(); ctx.globalAlpha=0.62;
   if(roll < 0.012){
    // a thorn breaking the surface
    ctx.fillStyle="#4a3a1e";
    ctx.beginPath(); ctx.moveTo(sx+ts*0.50,sy+ts*0.44); ctx.lineTo(sx+ts*0.42,sy+ts*0.66); ctx.lineTo(sx+ts*0.58,sy+ts*0.66); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#c8d84a";
    ctx.beginPath(); ctx.arc(sx+ts*0.50,sy+ts*0.47,ts*0.04,0,Math.PI*2); ctx.fill();
   } else if(roll < 0.02){
    // a spore pod, pulsing faintly
    ctx.fillStyle="#3d5a22";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.58,ts*0.09,ts*0.12,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.4; ctx.fillStyle="#7a9a3a";
    ctx.beginPath(); ctx.arc(sx+ts*0.50,sy+ts*0.56,ts*0.12,0,Math.PI*2); ctx.fill();
   } else {
    // a patch of glowing seam-moss
    ctx.globalAlpha=0.35; ctx.fillStyle="#7a9a3a";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.58,ts*0.16,ts*0.07,0,0,Math.PI*2); ctx.fill();
   }
   ctx.restore();
  },
  weed: function(ctx, sx, sy, ts, gx, gy, b, type){
   ctx.save(); ctx.globalAlpha=0.8;
   const cx=sx+ts*(0.3+hash3(gx,gy,61)*0.4), cy=sy+ts*(0.4+hash3(gx,gy,67)*0.4), sc=ts/40;
   switch(type % 3){
    case 0:   // thorn tendril
     ctx.strokeStyle="#4a3a1e"; ctx.lineWidth=Math.max(1,sc*1.3); ctx.lineCap="round";
     ctx.beginPath(); ctx.moveTo(cx,cy+sc*6); ctx.quadraticCurveTo(cx-sc*6,cy+sc*2,cx-sc*2,cy-sc*6); ctx.stroke();
     ctx.strokeStyle="#c8d84a"; ctx.lineWidth=Math.max(1,sc*0.9);
     ctx.beginPath(); ctx.moveTo(cx-sc*3,cy+sc*1); ctx.lineTo(cx-sc*5,cy-sc*2);
     ctx.moveTo(cx-sc*2,cy-sc*2); ctx.lineTo(cx-sc*1,cy-sc*5); ctx.stroke();
     break;
    case 1:   // spore stalk with a glowing head
     ctx.strokeStyle="#6a7a2e"; ctx.lineWidth=Math.max(1,sc*1.1); ctx.lineCap="round";
     ctx.beginPath(); ctx.moveTo(cx,cy+sc*6); ctx.lineTo(cx+sc,cy-sc*3); ctx.stroke();
     ctx.globalAlpha=0.45; ctx.fillStyle="#7a9a3a";
     ctx.beginPath(); ctx.arc(cx+sc,cy-sc*4,sc*2.6,0,Math.PI*2); ctx.fill();
     ctx.globalAlpha=0.9; ctx.fillStyle="#eaffa8";
     ctx.beginPath(); ctx.arc(cx+sc,cy-sc*4,sc*1.1,0,Math.PI*2); ctx.fill();
     break;
    default:  // curled vine running across the slab
     ctx.strokeStyle="#3d5a22"; ctx.lineWidth=Math.max(1,sc*1.1); ctx.lineCap="round";
     ctx.beginPath(); ctx.moveTo(sx+ts*0.08,cy+sc*3); ctx.bezierCurveTo(cx-sc*5,cy-sc*4,cx+sc*5,cy+sc*5,cx+sc*9,cy-sc*2); ctx.stroke();
     ctx.globalAlpha=0.35; ctx.fillStyle="#7a9a3a";
     ctx.beginPath(); ctx.ellipse(cx+sc*2,cy-sc*3,sc*3,sc*1.4,-0.5,0,Math.PI*2); ctx.fill();
     break;
   }
   ctx.restore();
  }
 });

 // ═══════════ THE BONE OSSUARY (ward 4, The Bonefather) ═══════════
 // Pale bone over dusty brown; dried blood accents. The dead fused into the
 // walls themselves.
 function buildPillarBone(){
  const c=mk(24,24),x=gx(c);
  // a column of stacked skulls with a bone shaft between tiers
  R(x,5,21,14,3,"#8a7658");R(x,5,21,14,1,"#a89878");          // dusty base
  R(x,10,4,4,17,"#c9bfa2");R(x,10,4,1,17,"#e8dcc0");          // the shaft
  // skull tiers: two rows of three
  R(x,6,16,4,4,"#e8dcc0");R(x,11,16,4,4,"#d8d0b8");R(x,16,16,4,4,"#e8dcc0");
  R(x,6,11,4,4,"#d8d0b8");R(x,11,11,4,4,"#e8dcc0");R(x,16,11,4,4,"#d8d0b8");
  R(x,7,13,1.2,1.2,"#3a3122");R(x,12,13,1.2,1.2,"#3a3122");R(x,17,13,1.2,1.2,"#3a3122");
  R(x,8,18,1.2,1.2,"#3a3122");R(x,13,18,1.2,1.2,"#3a3122");R(x,18,18,1.2,1.2,"#3a3122");
  // a dried-blood streak down one flank
  x.globalAlpha=0.5; R(x,14,12,1,8,"#7a2a24"); x.globalAlpha=1;
  return c;
 }
 // Rotted burial shrouds drape the back wall instead of a banner.
 function buildShroudOssuary(){
  const c=mk(24,36),x=gx(c);
  R(x,2,0,20,2,"#8a7658");R(x,2,0,20,1,"#a89878");            // a bone rail
  R(x,4,2,16,22,"#b8ac8c");                                    // the shroud
  R(x,4,2,3,22,"#a89878");R(x,17,2,3,22,"#9a8a68");            // folds
  // rot: patches gone brown-green
  x.globalAlpha=0.5; R(x,6,6,4,3,"#6a5a40");R(x,13,10,3,4,"#6a5a40"); x.globalAlpha=1;
  R(x,6,22,5,7,"#b8ac8c");R(x,12,24,6,5,"#a89878");            // torn tails
  R(x,10,29,3,2,"#8a7658");                                    // the tear
  // a skull stitched into the cloth at its centre
  R(x,10,14,4,4,"#e8dcc0");R(x,11,16,1,1,"#3a3122");R(x,13,16,1,1,"#3a3122");
  return c;
 }
 // Tallow torch niches between vertebrae hang on the side walls.
 function buildNicheOssuary(){
  const c=mk(24,36),x=gx(c);
  // a stack of vertebrae, hollow-centred, housing the niche
  R(x,6,2,12,4,"#e8dcc0");R(x,6,2,12,1,"#f0e8d0");
  R(x,8,4,8,3,"#3a3122");                                     // the vertebral hollow
  R(x,6,26,12,4,"#e8dcc0");R(x,6,26,12,1,"#f0e8d0");
  R(x,8,26,8,2,"#3a3122");
  // the tallow torch in the niche: warm cream flame
  R(x,10,8,4,2,"#6a5a40");                                    // bracket
  R(x,10.5,10,3,8,"#8a7658");                                 // the stem
  R(x,10,18,4,3,"#f0d888");                                   // the flame pool
  R(x,11,16.5,2,2,"#f8ecc0");                                 // its core
  // drips of old tallow down the wall
  x.globalAlpha=0.4; R(x,10,21,1,5,"#e8dcc0");R(x,13,21,1,4,"#e8dcc0"); x.globalAlpha=1;
  return c;
 }
 function buildRubbleOssuary(){
  const c=mk(24,24),x=gx(c);
  R(x,4,18,6,4,"#a89878");R(x,4,18,6,1,"#c9bfa2");
  R(x,10,16,8,6,"#b8ac8c");R(x,10,16,8,1,"#d8d0b8");R(x,10,20,8,2,"#8a7658");
  R(x,17,19,4,3,"#a89878");R(x,7,15,4,3,"#8a7658");R(x,13,13,3,3,"#b8ac8c");
  // a stray skull among the debris
  R(x,14,20,3,3,"#e8dcc0");R(x,15,21,0.8,0.8,"#3a3122");
  return c;
 }
 function buildPileOssuary(){
  const c=mk(24,24),x=gx(c);
  // a heap of mixed bones: long bones crossed under smaller ones
  x.strokeStyle="#d8d0b8"; x.lineWidth=2.4; x.lineCap="round";
  x.beginPath();
  x.moveTo(4,20); x.lineTo(20,16);
  x.moveTo(5,16); x.lineTo(19,20);
  x.stroke();
  R(x,6,12,4,4,"#e8dcc0");                                    // a skull on top
  R(x,7,14,0.9,0.9,"#3a3122");R(x,9,14,0.9,0.9,"#3a3122");
  R(x,12,10,5,2.4,"#d8d0b8");R(x,12,10,5,0.8,"#f0e8d0");       // a shoulder blade
  R(x,2,21,4,2,"#8a7658");R(x,18,21,4,2,"#8a7658");            // dust at the edges
  // old blood pooled under the pile
  x.globalAlpha=0.4; x.fillStyle="#4a1a18";
  x.beginPath(); x.ellipse(12,21.5,8,1.6,0,0,Math.PI*2); x.fill(); x.globalAlpha=1;
  return c;
 }
 // Sealed stone tombs flank the way in — echoes of the Sarcophagus Hall.
 function buildTombOssuary(){
  const c=mk(24,24),x=gx(c);
  R(x,4,14,16,8,"#a89878");R(x,4,14,16,1,"#c9bfa2");          // the tomb body
  R(x,4,21,16,1,"#8a7658");                                    // its dusty foot
  R(x,3,11,18,4,"#c9bfa2");R(x,3,11,18,1,"#e8dcc0");           // the heavy lid
  R(x,8,12,8,2,"#8a7658");                                     // a grip carved in it
  // a dried-blood stain down the face of the stone
  x.globalAlpha=0.45; R(x,11,16,2,5,"#7a2a24"); x.globalAlpha=1;
  // small bones tucked at its base
  R(x,2,21,2,1.4,"#d8d0b8");R(x,20,21,2,1.4,"#d8d0b8");
  return c;
 }
 // Ground cover — scattered bone fragments, half sunk in the dusty floor.
 function buildGroundBone(){
  const c=mk(24,24),x=gx(c);
  // dust shadow pooling in the crevices
  x.globalAlpha=0.35; x.fillStyle="#3a2e22";
  x.beginPath(); x.ellipse(12,18,9,3.4,0,0,Math.PI*2); x.fill();
  x.globalAlpha=1;
  // long bones crossed, pale against the dust
  x.strokeStyle="#d8d0b8"; x.lineWidth=2.2; x.lineCap="round";
  x.beginPath();
  x.moveTo(5,19); x.lineTo(19,15);
  x.moveTo(6,15); x.lineTo(18,19);
  x.stroke();
  // joint knobs at the bone ends
  x.fillStyle="#e8dcc0";
  x.beginPath(); x.arc(5,19,1.2,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(19,15,1.2,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(6,15,1.1,0,Math.PI*2); x.fill();
  x.beginPath(); x.arc(18,19,1.1,0,Math.PI*2); x.fill();
  // a broken rib, shorter and thinner
  x.strokeStyle="#c9bfa2"; x.lineWidth=1.4;
  x.beginPath(); x.moveTo(9,12); x.quadraticCurveTo(13,10,16,11.5); x.stroke();
  // a tooth: tiny white shard
  x.fillStyle="#f0e8d0"; x.fillRect(15,17,1.2,1);
  // a skull shard, half sunk
  R(x,10,13,3.6,2.6,"#e8dcc0");
  R(x,10.8,14,0.8,0.8,"#3a3122");R(x,12.6,14,0.8,0.8,"#3a3122");
  // darker shadows in the crevices
  x.globalAlpha=0.5; x.fillStyle="#3a2e22";
  x.fillRect(8,17,2,1); x.fillRect(14,16,2,1);
  x.globalAlpha=1;
  return c;
 }

 // ── CLUTTER FAMILY — "ossuary" ─────────────────────────────
 // A dry hall: bone pebbles, a dark old-blood stain, a small skull half sunk.
 Delve.registerClutter("ossuary", {
  clutter: function(ctx, sx, sy, ts, roll){
   ctx.save(); ctx.globalAlpha=0.55;
   if(roll < 0.012){
    // a small skull, half sunk in the dust
    ctx.fillStyle="#e8dcc0";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.58,ts*0.11,ts*0.08,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a3122";
    ctx.beginPath(); ctx.arc(sx+ts*0.46,sy+ts*0.56,ts*0.025,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx+ts*0.54,sy+ts*0.56,ts*0.025,0,Math.PI*2); ctx.fill();
   } else if(roll < 0.02){
    // a stain of blood gone dark, never washed away
    ctx.globalAlpha=0.30; ctx.fillStyle="#4a1a18";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.50,sy+ts*0.58,ts*0.20,ts*0.10,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.45; ctx.fillStyle="#7a2a24";
    ctx.beginPath(); ctx.ellipse(sx+ts*0.48,sy+ts*0.57,ts*0.09,ts*0.05,0,0,Math.PI*2); ctx.fill();
   } else {
    // a pebble of bone
    ctx.fillStyle="#c9bfa2";
    ctx.beginPath(); ctx.arc(sx+ts*0.5,sy+ts*0.55,ts*0.06,0,Math.PI*2); ctx.fill();
   }
   ctx.restore();
  },
  weed: function(ctx, sx, sy, ts, gx, gy, b, type){
   // dry growth: bone shards and dust drifts, never green
   ctx.save(); ctx.globalAlpha=0.75;
   const cx=sx+ts*(0.3+Delve.hash3(gx,gy,61)*0.4), cy=sy+ts*(0.4+Delve.hash3(gx,gy,67)*0.4), sc=ts/40;
   switch(type % 3){
    case 0:   // a shard jutting from the floor
     ctx.fillStyle="#d8d0b8";
     ctx.beginPath(); ctx.moveTo(cx,cy-sc*7); ctx.lineTo(cx-sc*1.5,cy+sc*3); ctx.lineTo(cx+sc*1.5,cy+sc*3); ctx.closePath(); ctx.fill();
     ctx.globalAlpha=0.4; ctx.fillStyle="#3a2e22";
     ctx.fillRect(cx-sc*1.5,cy+sc*2,sc*3,sc*1);            // its dust base
     break;
    case 1:   // a splintered bone half buried
     ctx.strokeStyle="#c9bfa2"; ctx.lineWidth=Math.max(1,sc*1.2); ctx.lineCap="round";
     ctx.beginPath(); ctx.moveTo(cx-sc*4,cy+sc*5); ctx.quadraticCurveTo(cx,cy-sc*2,cx+sc*4,cy+sc*4); ctx.stroke();
     ctx.fillStyle="#e8dcc0";
     ctx.beginPath(); ctx.arc(cx-sc*4,cy+sc*5,sc*1.1,0,Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(cx+sc*4,cy+sc*4,sc*1,0,Math.PI*2); ctx.fill();
     break;
    default:  // a dust drift piled against the stone
     ctx.globalAlpha=0.5; ctx.fillStyle="#8a7658";
     ctx.beginPath(); ctx.ellipse(cx,cy+sc*3,sc*6,sc*2,0,0,Math.PI*2); ctx.fill();
     ctx.globalAlpha=0.3; ctx.fillStyle="#d8cbb0";
     ctx.beginPath(); ctx.ellipse(cx-sc*1.5,cy+sc*2,sc*3,sc*1,0,0,Math.PI*2); ctx.fill();
     break;
   }
   ctx.restore();
  }
 });

 // ── REGISTRATIONS ─────────────────────────────────────────
 reg("prop_pillarBone",    buildPillarBone);
 reg("prop_shroudOssuary", buildShroudOssuary);
 reg("prop_nicheOssuary",  buildNicheOssuary);
 reg("prop_rubbleOssuary", buildRubbleOssuary);
 reg("prop_pileOssuary",   buildPileOssuary);
 reg("prop_tombOssuary",   buildTombOssuary);
 reg("ground_bone",        buildGroundBone);

 // An opened tomb: lid shifted aside, the dark hollow showing.
 function buildTombOpen(){
  const c=mk(24,24),x=gx(c);
  R(x,4,14,16,8,"#a89878");R(x,4,14,16,1,"#c9bfa2");          // the tomb body
  R(x,4,21,16,1,"#8a7658");
  R(x,6,16,12,5,"#1a140c");                                    // the open hollow
  // the heavy lid, shoved half off to the side
  R(x,14,6,9,4,"#c9bfa2");R(x,14,6,9,1,"#e8dcc0");
  R(x,18,7,4,2,"#8a7658");                                    // its carved grip
  // dust spill where the lid ground across
  x.globalAlpha=0.5; R(x,5,19,10,1.2,"#8a7658"); x.globalAlpha=1;
  return c;
 }
 reg("tombSealed", buildTombOssuary);
 reg("tombOpen",   buildTombOpen);

 // The registration above must land in SPR: rebuild the sprite set. The boss
 // sprite file does the same thing — this mirrors it.
 Delve.rebuildSprites();
})();