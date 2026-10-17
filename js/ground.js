window.Delve = window.Delve || {};
(function(){
 // ── js/ground.js : biome ground cover ─────────────────────────
 // Decoration scattered on the floor during generation and painted flat by the
 // renderer. Pure presentation: never written into the grid, never blocks
 // movement, never tappable, never on the minimap, never in the run snapshot.
 // A shared shape library is dressed by each biome's own art — a biome only
 // names a sprite (BIOMES[n].groundCover in con-biomes.js), so a new biome adds
 // art and nothing else. The art lives in sprites.js (SPR.world["ground_*"]).
 //
 // Two public seams, mirroring G.decor (arena props):
 //   Delve.placeGroundCover(G)   — called at the end of genFloor/genBossFloor
 //   Delve.drawGroundCover(...)  — called by render.js between floor and props

 const T = function(){ return Delve.T; };

 // The ten shapes. Coords are relative to the cluster's origin tile (0,0),
 // which is always present. At placement each shape gets a random rotation
 // (0/90/180/270) and a coin-flip mirror, so ten become eighty placements.
 const SHAPES = [
  [[0,0],[1,0],[0,1]],               // 1  small L
  [[0,0],[1,0],[1,1]],               // 2  opposite L
  [[0,0],[1,0],[2,0]],               // 3  3 straight
  [[0,0],[1,0],[2,0],[1,1]],         // 4  T with one leg
  [[0,0],[1,0],[0,1],[1,1]],         // 5  2x2 block
  [[0,0],[1,0],[2,0],[2,1]],         // 6  3 then a step
  [[0,0],[1,0],[1,1],[2,1]],         // 7  zigzag
  [[0,0],[1,0],[0,1],[1,1],[1,2]],   // 8  small plus
  [[0,0],[1,0],[2,0],[0,1]],         // 9  3 with one behind
  [[0,0],[1,0],[1,1],[2,1],[2,2]]    // 10 long diagonal
 ];

 // Mirror (flip x) first, then rotate by rot * 90° around the origin tile.
 // (0,0) stays put, so the cluster lands exactly where placement says it does.
 function transformShape(shape, rot, mirror){
  const out = [];
  for(let i = 0; i < shape.length; i++){
   let dx = shape[i][0], dy = shape[i][1];
   if(mirror) dx = -dx;
   if(rot === 1){ const t = dx; dx = -dy; dy = t; }
   else if(rot === 2){ dx = -dx; dy = -dy; }
   else if(rot === 3){ const t = dx; dx = dy; dy = -t; }
   out.push([dx, dy]);
  }
  return out;
 }

 // Which sprite this floor's biome draws its cover with, or null when the biome
 // has none (or none is built yet) — then the floor simply has no cover.
 function groundKey(G){
  const ward = Delve.getWard(G.floor);
  const biomes = Delve.CONFIG.BIOMES || [];
  const biome = biomes[(ward && ward.biome !== undefined) ? ward.biome : 0] || {};
  return biome.groundCover || null;
 }

 // Every tile a boss's art covers (see movement.js bossBodyAt), so cover never
 // pokes out from underneath a wide boss sprite.
 function bossTiles(G){
  const out = {};
  const b = G.boss;
  if(!b) return out;
  const s = b.size || { w:1, h:1 };
  for(let dx = 0; dx < s.w; dx++){
   for(let dy = 0; dy < s.h; dy++) out[(b.x + dx) + "," + (b.y - dy)] = 1;
  }
  return out;
 }

 Delve.placeGroundCover = function(G){
  if(!G || !G.grid || !G.grid.length) return;
  const key = groundKey(G);
  if(!key || !(Delve.SPR && Delve.SPR.world && Delve.SPR.world[key])){
   G.groundCover = [];
   return;
  }
  const shop = (G.shop && G.shop.x >= 0) ? G.shop : null;
  const bt = bossTiles(G);

  // Candidate origin tiles: plain floor, clear of spawn, shop and boss body.
  // Everything else that matters (stairs, chests, monsters, barrels, gold) is
  // already a non-FLOOR grid cell, so it is excluded for free below.
  const floorTiles = [];
  for(let y = 1; y < G.gridH - 1; y++){
   for(let x = 1; x < G.gridW - 1; x++){
    if(G.grid[y][x] !== T().FLOOR) continue;
    if(x === G.px && y === G.py) continue;
    if(shop && x === shop.x && y === shop.y) continue;
    if(bt[x + "," + y]) continue;
    floorTiles.push([x, y]);
   }
  }

  const targets = Delve.rng(2, 3);
  const occ = {};   // tiles already covered by a placed cluster
  const out = [];

  for(let c = 0; c < targets; c++){
   let placed = false;
   for(let attempt = 0; attempt < 10 && !placed; attempt++){
    if(!floorTiles.length) break;
    const shapeId = Delve.rng(0, SHAPES.length - 1);
    const rot = Delve.rng(0, 3);
    const mirror = (Delve.rng(0, 1) === 1);
    const offsets = transformShape(SHAPES[shapeId], rot, mirror);
    const ori = floorTiles[Delve.rng(0, floorTiles.length - 1)];
    const ox = ori[0], oy = ori[1];

    let ok = true;
    for(let i = 0; i < offsets.length; i++){
     const x = ox + offsets[i][0], y = oy + offsets[i][1];
     if(x < 0 || y < 0 || x >= G.gridW || y >= G.gridH){ ok = false; break; }
     if(!G.grid[y] || G.grid[y][x] !== T().FLOOR){ ok = false; break; }
     if(x === G.px && y === G.py){ ok = false; break; }
     if(shop && x === shop.x && y === shop.y){ ok = false; break; }
     if(bt[x + "," + y]){ ok = false; break; }
     if(occ[x + "," + y]){ ok = false; break; }
    }
    if(!ok) continue;

    for(let i = 0; i < offsets.length; i++) occ[(ox + offsets[i][0]) + "," + (oy + offsets[i][1])] = 1;
    out.push({ shapeId: shapeId, x: ox, y: oy, rotation: rot, mirror: mirror });
    placed = true;
   }
  }

  G.groundCover = out;
 };

 Delve.drawGroundCover = function(ctx, camX, camY, vw, vh, ts){
  const G = Delve.G;
  const list = G && G.groundCover;
  if(!list || !list.length) return;
  const key = groundKey(G);
  if(!key) return;
  const img = Delve.SPR && Delve.SPR.world && Delve.SPR.world[key];
  if(!img) return;

  const size = ts * 0.9;
  for(let i = 0; i < list.length; i++){
   const cl = list[i];
   const shape = SHAPES[cl.shapeId];
   if(!shape) continue;
   const offsets = transformShape(shape, cl.rotation, cl.mirror);
   for(let j = 0; j < offsets.length; j++){
    const x = cl.x + offsets[j][0], y = cl.y + offsets[j][1];
    if(x < camX || y < camY || x >= camX + vw || y >= camY + vh) continue;
    const cx = (x - camX) * ts + ts / 2, cy = (y - camY) * ts + ts / 2;
    // Deterministic per-tile mirror so a cluster isn't N identical stamps.
    const flip = (((x * 31) ^ (y * 17)) & 1) === 1;
    if(flip){
     ctx.save(); ctx.translate(cx, cy); ctx.scale(-1, 1);
     ctx.drawImage(img, -size / 2, -size / 2, size, size);
     ctx.restore();
    } else {
     ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    }
   }
  }
 };
})();