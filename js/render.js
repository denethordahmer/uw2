window.Delve = window.Delve || {};
(function(){

 // ── render.js ────────────────────────────────────────────────
 // Owns all canvas drawing: tiles, sprites, entities, floaters, camera,
 // plus the two figure-drawing routines that used to live in ui.js —
 // the inventory paper doll and the minimap.
 // Depends on: Delve.SPR (sprites.js), Delve.T / Delve.G (state.js),
 //             Delve.TIERS (con-items.js), Delve.CONFIG.BIOMES (con-biomes.js).
 // Loads BEFORE ui.js and input.js.
 // Uses document.getElementById directly (not ui.js's guarded $), because
 // ui.js does not exist yet at this file's load time.

 let shakeT = 0, shakeMag = 0;
 let floaters = [];
 const FLOAT_LIFE = 1200;
 const floaterDepth = new Map();

// Corpse fades (§Batch 15). A monster that dies leaves a record here for a moment so the
// renderer can shrink and fade it away instead of blinking it out of existence. Owned by
// render.js rather than by G: it is pure presentation, so it stays out of the run state, out
// of the checkpoint snapshot (§6.12) and out of the test page's floor checks.
let deaths = [];
const DEATH_LIFE = 460;

 const recoils = new Map();
 function dirAway(fx, fy, tx, ty){
  let dx = fx - tx, dy = fy - ty;
  const len = Math.hypot(dx, dy);
  if(len < 0.001) return { x: 0, y: -1 };
  return { x: dx/len, y: dy/len };
 }
 function ensureRecoil(key, flashTime, dx, dy){
  const r = recoils.get(key);
  if(!r || r.flash < flashTime) recoils.set(key, { flash: flashTime, dx, dy });
 }
 function recoilOffset(key, ts){
  const r = recoils.get(key);
  if(!r) return { x: 0, y: 0 };
  const t = (Date.now() - r.flash) / 200;
  if(t >= 1){ recoils.delete(key); return { x: 0, y: 0 }; }
  const disp = Math.sin(t * Math.PI) * ts * 0.13;
  return { x: r.dx * disp, y: r.dy * disp };
 }
 // Attack telegraph: a short lunge TOWARD the target, mirroring the recoil
 // system above. This is what tells you a monster is swinging at you.
 const lunges = new Map();
 const ATTACK_MS = 260;
 function ensureLunge(key, flashTime, dx, dy){
  const l = lunges.get(key);
  if(!l || l.flash < flashTime) lunges.set(key, { flash: flashTime, dx, dy });
 }
 function lungeOffset(key, ts){
  const l = lunges.get(key);
  if(!l) return { x: 0, y: 0 };
  const t = (Date.now() - l.flash) / ATTACK_MS;
  if(t >= 1){ lunges.delete(key); return { x: 0, y: 0 }; }
  const disp = Math.sin(t * Math.PI) * ts * 0.30;
  return { x: l.dx * disp, y: l.dy * disp };
 }
 function attacking(m){
  return !!(m && m.attackFlash && Date.now() - m.attackFlash < ATTACK_MS);
 }

 function nearestThreat(x, y){
  let best = null, bd = Infinity;
  const list = (Delve.G && Delve.G.monsters) || [];
  for(const m of list){
   const d = Math.hypot(m.x - x, m.y - y);
   if(d < bd){ bd = d; best = m; }
  }
  const b = Delve.G && Delve.G.boss;
  if(b){
   const d = Math.hypot(b.x - x, b.y - y);
   if(d < bd){ bd = d; best = b; }
  }
  return best;
 }

 // Deterministic hashes now live in state.js (Delve.hash2 / Delve.hash3) so
 // content files can use them too. These aliases keep every call site in this
 // file unchanged.
 function hash2(x, y){ return Delve.hash2(x, y); }
 function hash3(x, y, salt){ return Delve.hash3(x, y, salt); }

 function biome(){
  const G = Delve.G;
  const ward = G ? Delve.getWard(G.floor) : null;
  const idx = (ward && ward.biome !== undefined) ? ward.biome : 0;
  const b = (Delve.CONFIG.BIOMES && Delve.CONFIG.BIOMES[idx]) || Delve.CONFIG.BIOMES[0] || {};
  return {
   wall: b.wall || "#64707c", wallEdge: b.wallEdge || "#8d99a6", wallBrick: b.wallBrick || "#3a4248",
   mortar: b.mortar || "#0b0f14", floor: b.floor || "#2e3842", floor2: b.floor2 || "#283039",
   moss: b.moss || "#3f6d55", water: b.water || "#1e3a4a", torch: b.torch || "#ffb347",
   light: b.light || "rgba(70,140,255,0.06)",
   clutter: b.clutter || "ruins",     // decoration family for floor tiles
   // organic-patch colours (levels.js patches): a ward can restyle its grass
   // and water overlays as pure data — snow instead of moss, ice instead of water
   patchGrass: b.patchGrass || b.moss || "#3f6d55",
   patchWater: b.patchWater || b.water || "#1e3a4a",
   // Seamless floor + linked growth (js/growth.js). floorStyle "runningbond" = the
   // baked 3x3 torus masonry pattern instead of per-tile slabs; growthLinked = the
   // walls grow growth only where a floor patch touches them; growthPal = the
   // biome's locked green gradient (dark root → bright tip).
   floorStyle: b.floorStyle || null,
   wallStyle: b.wallStyle || null,
   growthLinked: !!b.growthLinked,
   growthPal: b.growthPal || null
  };
 }

 function tileAt(gx, gy){
  const g = Delve.G.grid;
  return (g[gy] && g[gy][gx] !== undefined) ? g[gy][gx] : null;
 }

 // ── OFFSCREEN TILE CACHE ─────────────────────────────────────
 let tileCache = {}, cacheFloor = -1, cacheTs = 0, cachePuddles = null;
 function ensureCache(G){
  // Also keyed on the puddles array identity (js/puddles.js): puddle art varies
  // per generation, so regenerating the SAME floor (debug re-render, a fresh
  // floor-1 run) must drop the cached water tiles too — a floor/ts change alone
  // would leave the previous generation's pools painted on the new grid.
  if(cacheFloor !== G.floor || cacheTs !== Delve.ts || cachePuddles !== G.puddles){
   cacheFloor = G.floor; cacheTs = Delve.ts; cachePuddles = G.puddles; tileCache = {};
  }
 }
 // Braziers. Everywhere else a torch is a 4% roll; a boss arena instead gets a
 // guaranteed, deterministic set derived from its geometry (G.bossArena), so the
 // chamber you fight in is always lit — and always lit the same way, so a boss
 // room is somewhere you can learn. Rebuilt only when the floor or the arena
 // object changes, never per tile.
 let arenaSrc = null, arenaTorchSet = null, arenaTorchFloor = -1;
 function arenaTorches(){
  const G = Delve.G, A = G && G.bossArena;
  if(!A){ arenaSrc = null; arenaTorchSet = null; return null; }
  if(arenaSrc === A && arenaTorchFloor === G.floor) return arenaTorchSet;
  const set = {};
  const add = function(x, y){ set[x + "," + y] = 1; };
  const spread = function(a, z, n){
   const out = [];
   for(let i = 1; i <= n; i++) out.push(Math.round(a + (z - a) * i / (n + 1)));
   return out;
  };
  // the back wall of the chamber
  spread(A.bossX, A.bossX + A.bossW - 1, Math.max(3, Math.min(5, Math.floor(A.bossW / 3))))
   .forEach(function(x){ add(x, A.bossY - 1); });
  // both side walls, a third and two thirds down (never the last row: its
  // neighbour below may not be floor)
  spread(A.bossY, A.bossY + A.bossH - 2, 2).forEach(function(y){
   add(A.bossX - 1, y); add(A.bossX + A.bossW, y);
  });
  // the approach: both walls of the corridor
  spread(A.corrTop, A.corrTop + A.corrH - 1, Math.max(2, Math.min(4, Math.floor(A.corrH / 4))))
   .forEach(function(y){ add(A.corrX - 1, y); add(A.corrX + A.corrW, y); });
  // and the walls you walk in past, so the entry chamber isn't black either
  const ey = A.entryY + Math.floor(A.entryH / 2) - 1;
  add(A.entryX - 1, ey); add(A.entryX + A.entryW, ey);
  arenaSrc = A; arenaTorchFloor = G.floor; arenaTorchSet = set;
  return set;
 }
 function isTorchTile(gx, gy){
  if(tileAt(gx, gy) !== Delve.T.WALL) return false;
  // Arena braziers are chosen from the arena's own boundary, so they don't need
  // the "something to light underneath" test the random roll uses for wild
  // torches (a side wall of a chamber has wall below it, not floor).
  const arena = arenaTorches();
  if(arena && arena[gx + "," + gy]) return true;
  const below = tileAt(gx, gy+1);
  if(below === null || below === Delve.T.WALL || below === Delve.T.VOID) return false;
  return hash3(gx, gy, 137) < 0.04;
 }
 function blitTile(ctx, gx, gy, sx, sy, ts, b, t){
  const key = gx + "," + gy;
  const entry = tileCache[key];
  if(entry && entry.v === t){ ctx.drawImage(entry.c, sx, sy, ts, ts); return; }
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  c.width = Math.round(ts*dpr); c.height = Math.round(ts*dpr);
  const cx = c.getContext("2d"); cx.scale(dpr, dpr);
  if(t !== Delve.T.WALL){
   drawFloorTile(cx, 0, 0, ts, gx, gy, b);
   if(t === Delve.T.STAIR) drawStairs(cx, 0, 0, ts, b);
   if(t === Delve.T.DOOR) drawDoorTile(cx, 0, 0, ts, b);
   if(t === Delve.T.WATER && Delve.drawPuddleTile) Delve.drawPuddleTile(cx, 0, 0, ts, gx, gy, b);
   if(t === Delve.T.GRASS) drawGrassPatch(cx, 0, 0, ts, gx, gy, b);
  } else {
   drawWallTile(cx, 0, 0, ts, gx, gy, b);
  }
  tileCache[key] = { v:t, c:c };
  ctx.drawImage(c, sx, sy, ts, ts);
 }

 // ── FLOOR ────────────────────────────────────────────────────
 // Smooth, continuous tone field for the floor. Values are bilinearly smoothed
 // from knots placed every FLOOR_TONE_K tiles, so neighbouring tiles always land
 // on nearly the same shade: no hard checkerboard step, and the light/dark
 // patches drift across several tiles at once. Deterministic — same coords, same
 // tone, computed purely from the position hash; nothing changes per frame.
 const FLOOR_TONE_K = 4;
 function floorTone(gx, gy){
  const px = (gx + 0.5) / FLOOR_TONE_K, py = (gy + 0.5) / FLOOR_TONE_K;
  const xi = Math.floor(px), yi = Math.floor(py);
  let fx = px - xi, fy = py - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, 7703), b = hash3(xi + 1, yi, 7703);
  const c = hash3(xi, yi + 1, 7703), d = hash3(xi + 1, yi + 1, 7703);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
 }

  // ── SEAMLESS RUNNING-BOND FLOOR ───────────────────────────────
  // The ward's stone floor (owner batch B1, modelled on the reference room):
  // interlocking masonry in 8-fine-pixel columns — each column carries an 11px
  // tall block over a 3px short block, and every second column is shifted 8px
  // down so the courses stagger into one another the way the reference does.
  // The lattice is baked on a TORUS (48x48 fine pixels = 3x3 tiles), so every
  // seam and block that crosses a tile edge continues on the opposite edge: a
  // copy placed beside itself meshes with no seam, the room floor reads as one
  // continuous paved surface, and no tile grid is ever visible. Per tile,
  // blitTile paints the 16x16 cell chosen by (gx mod 3, gy mod 3). The
  // continuous tone overlay on top drifts over several tiles, so even the 3x3
  // repeat is hard to spot.
  const BOND_PX = 16, BOND_N = 3;
  let bondKey = null, bondTex = null;
  function rgbOf(hex){ return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }
  function mixRGB(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  function bondTexture(b){
   const key = b.floor + "|" + b.floor2;
   if(bondKey === key && bondTex) return bondTex;
   const S = BOND_PX * BOND_N;             // 48x48 fine pixels = 3x3 tiles
   const c = document.createElement("canvas");
   c.width = S; c.height = S;
   const cc = c.getContext("2d");
   const img = cc.createImageData(S, S);
   const d = img.data;
   const floorA = rgbOf(b.floor), floorB = rgbOf(b.floor2);
   const mortar = mixRGB(mixRGB(floorB, [8, 11, 15], 0.72), [0, 0, 0], 0.12);
   const lit = [214, 226, 236], shade = [5, 7, 10];
   // The masonry lattice: 8px columns, a 16px course period inside each, and
   // every second column shifted down 8px so neighbouring courses interlock.
   // 8 divides 48 and 16 divides 48, so the lattice wraps the torus exactly.
   const COL_W = 8, ROW_H = 16;
   for(let py = 0; py < S; py++){
    for(let px = 0; px < S; px++){
     const col = (px / COL_W) | 0;              // 0..5 across the torus
     const lx = px % COL_W;
     const shift = (col & 1) ? 8 : 0;           // stagger every other column
     const yy = (py + shift) % ROW_H;           // position in this column's course
     const period = ((py + shift) / ROW_H) | 0;
     let col3;
     // the mortar grid: a seam every 8px across, and two seams per course, so
     // no seam ever runs unbroken from column to column
     if(lx === 0 || yy === 0 || yy === 12){
      col3 = mortar;
     } else {
      // which block owns this pixel: the tall one (course rows 1-11) or the
      // short one (course rows 13-15). Tone is hashed per block, so every
      // block in the 3x3 repeat carries its own subtle shade — no two match.
      const tall = yy <= 11;
      const slot = tall ? 0 : 1;
      const tone = hash3(col * 16 + slot, period * 4 + 1, 1201);
      const base = mixRGB(floorA, floorB, 0.12 + tone * 0.72);
      if((tall ? yy === 1 : yy === 13) || lx === 1){
       col3 = mixRGB(base, lit, 0.24);          // lit top / left edge
      } else if((tall ? yy === 11 : yy === 15) || lx === COL_W - 1){
       col3 = mixRGB(base, shade, 0.30);        // shadowed bottom / right edge
      } else {
       col3 = mixRGB(base, shade, 0.05);        // block body
      }
     }
     // fine weathered grain over everything, a few units of brightness either way
     const g = (hash3(px, py, 1223) - 0.5) * 8;
     const o = (py * S + px) * 4;
     d[o]   = Math.max(0, Math.min(255, col3[0] + g));
     d[o+1] = Math.max(0, Math.min(255, col3[1] + g));
     d[o+2] = Math.max(0, Math.min(255, col3[2] + g));
     d[o+3] = 255;
    }
   }
   cc.putImageData(img, 0, 0);
   bondKey = key; bondTex = c;
   return c;
  }
  function drawBondFloor(ctx, sx, sy, ts, gx, gy, b){
   const tex = bondTexture(b);
   const cx = (((gx % BOND_N) + BOND_N) % BOND_N) * BOND_PX;
   const cy = (((gy % BOND_N) + BOND_N) % BOND_N) * BOND_PX;
   ctx.save();
   ctx.imageSmoothingEnabled = false;
   ctx.drawImage(tex, cx, cy, BOND_PX, BOND_PX, sx, sy, ts, ts);
   ctx.restore();
   // continuous large-scale tone — bilinear per position, so it drifts across
   // tiles without a step; this is what hides the 3x3 repeat from casual view
   const t = floorTone(gx, gy);
   ctx.save();
   ctx.globalAlpha = 0.05 + Math.abs(t - 0.5) * 0.22;
   ctx.fillStyle = t < 0.5 ? "#060a0e" : "#9fb2c4";
   ctx.fillRect(sx, sy, ts, ts);
   ctx.restore();
  }
 function soilTone(x, y){
  const k = 0.72;
  const px = x / k, py = y / k;
  const xi = Math.floor(px), yi = Math.floor(py);
  let fx = px - xi, fy = py - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, 9011), b = hash3(xi + 1, yi, 9011);
  const c = hash3(xi, yi + 1, 9011), d = hash3(xi + 1, yi + 1, 9011);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
 }
 function drawSoilFloor(ctx, sx, sy, ts, gx, gy, b){
  // Continuous mottled loam: two octaves of smooth, world-space noise blended
  // across each tile's cells. No slab, no gap, no outline — neighbouring tiles
  // carry the same field, so the room is one surface, never a grid of squares.
  const N = 6, cw = ts / N;
  for(let cy = 0; cy < N; cy++){
   for(let cx = 0; cx < N; cx++){
    const wx = gx + (cx + 0.5) / N, wy = gy + (cy + 0.5) / N;
    const t = floorTone(wx, wy) * 0.55 + soilTone(wx, wy) * 0.45;
    ctx.fillStyle = blendHex(b.floor, b.floor2, t);
    const px0 = Math.round(cx * cw), py0 = Math.round(cy * cw);
    const px1 = Math.round((cx + 1) * cw), py1 = Math.round((cy + 1) * cw);
    ctx.fillRect(sx + px0, sy + py0, Math.max(1, px1 - px0), Math.max(1, py1 - py0));
   }
  }
  // sparse dark peat mottles so it never reads as one flat loam
  ctx.globalAlpha = 0.22;
  for(let i = 0; i < 3; i++){
   const mx = sx + ts * (0.15 + hash3(gx, gy, 301 + i) * 0.7);
   const my = sy + ts * (0.15 + hash3(gx, gy, 311 + i) * 0.7);
   const mr = ts * (0.07 + hash3(gx, gy, 321 + i) * 0.10);
   ctx.fillStyle = blendHex(b.floor2, "#0a0e12", 0.4);
   ctx.beginPath(); ctx.ellipse(mx, my, mr, mr * 0.7, hash3(gx, gy, 331 + i) * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
 }
 function drawVeins(ctx, camX, camY, vw, vh, ts){
  // Thin silver mycelium threads on about 20% of plain floor tiles, drawn over
  // the loam and under every prop. Per-tile and deterministic; alpha stays low
  // so the web reads as a hint, not a highlight.
  const G = Delve.G, T = Delve.T;
  if(!G || !G.grid) return;
  for(let y = 0; y < vh + 1; y++) for(let x = 0; x < vw + 1; x++){
   const gx = camX + x, gy = camY + y;
   if(tileAt(gx, gy) !== T.FLOOR) continue;
   if(hash3(gx, gy, 691) >= 0.20) continue;
   const sx = x * ts, sy = y * ts;
   const segs = 3 + Math.floor(hash3(gx, gy, 701) * 4);
   ctx.save();
   ctx.strokeStyle = "#e8f2f5"; ctx.lineCap = "round";
   for(let i = 0; i < segs; i++){
    ctx.globalAlpha = 0.26 + hash3(gx, gy, 771 + i) * 0.26;
    ctx.lineWidth = Math.max(0.7, ts * 0.012);
    let px = sx + ts * (0.15 + hash3(gx, gy, 711 + i) * 0.7);
    let py = sy + ts * (0.15 + hash3(gx, gy, 731 + i) * 0.7);
    ctx.beginPath(); ctx.moveTo(px, py);
    const n = 2 + Math.floor(hash3(gx, gy, 791 + i) * 2);
    for(let s = 0; s < n; s++){
     px += (hash3(gx, gy, 801 + i * 8 + s) - 0.5) * ts * 0.45;
     py += (hash3(gx, gy, 811 + i * 8 + s) - 0.5) * ts * 0.45;
     px = Math.min(sx + ts - 1, Math.max(sx + 1, px));
     py = Math.min(sy + ts - 1, Math.max(sy + 1, py));
     ctx.lineTo(px, py);
    }
    ctx.stroke();
   }
   ctx.restore();
  }
 }
 function drawFloorTile(ctx, sx, sy, ts, gx, gy, b){
  const n = hash2(gx,gy), n3 = hash3(gx,gy,31), n4 = hash3(gx,gy,53);
  if(b.floorStyle === "runningbond"){
   // B2) Seamless running bond — the baked 3x3-tile torus masonry above. No
   //     slab, no joint frame, no per-tile outline: the pattern's edges
   //     continue into the neighbouring copies, so the floor reads as one
   //     continuous paved surface and the tile grid is invisible.
   drawBondFloor(ctx, sx, sy, ts, gx, gy, b);
  } else if(b.floorStyle === "soil"){
   // Forest floor — continuous mottled loam, no slabs and no tile grid. The
   // silver mycelium veins land in their own pass; items and water sit above.
   drawSoilFloor(ctx, sx, sy, ts, gx, gy, b);
  } else {
  // A) Continuous-tone shading — floorTone replaces the old (gx+gy)%2 two-tone
  //    flip, so the floor has soft light/dark patches instead of square steps.
  let slabCol = blendHex(b.floor, b.floor2, floorTone(gx, gy));
  if(n3 < 0.05) slabCol = blendHex(slabCol, "#0a0e12", 0.35);
  // B) Soft flagstone — a rounded-corner slab with a feathered edge sits over a
  //    base only a little darker than itself (in the slab's own colour family,
  //    not the old near-black grout). The joint is rounded and low-contrast, so
  //    the floor reads as worn flags rather than a grid of squares.
  const gap = Math.max(1, Math.round(ts * 0.035));
  const r = ts * 0.20;
  const grout = blendHex(slabCol, "#0a0e12", 0.16);
  ctx.fillStyle = grout; ctx.fillRect(sx, sy, ts, ts);
  const x = sx + gap, y = sy + gap, w = ts - gap * 2, h = ts - gap * 2;
  const midX = x + w * 0.5, midY = y + h * 0.5;
  const grad = ctx.createRadialGradient(midX, midY, h * 0.34, midX, midY, Math.max(w, h) * 0.72);
  grad.addColorStop(0, slabCol);
  grad.addColorStop(0.80, slabCol);
  grad.addColorStop(1, grout);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  if(n > 0.82){
   const crackType = Math.floor(hash3(gx,gy,7)*10);
   ctx.save(); ctx.strokeStyle="rgba(0,0,0,0.32)"; ctx.lineWidth=Math.max(1,ts*0.03);
   ctx.globalAlpha=0.6; ctx.lineCap="round";
   const m=Math.max(3, ts*0.09), x0=sx+m, y0=sy+m, tw=ts-m*2;
   ctx.beginPath();
   switch(crackType){
    case 0: ctx.moveTo(x0,y0); ctx.lineTo(x0+tw*0.5,y0+tw*0.5); break;
    case 1: ctx.moveTo(x0+tw*0.5,y0+tw*0.1); ctx.lineTo(x0+tw*0.5,y0+tw*0.55); ctx.moveTo(x0+tw*0.5,y0+tw*0.55); ctx.lineTo(x0+tw*0.2,y0+tw*0.9); ctx.moveTo(x0+tw*0.5,y0+tw*0.55); ctx.lineTo(x0+tw*0.8,y0+tw*0.9); break;
    case 2: for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2; ctx.moveTo(x0+tw*0.5,y0+tw*0.5); ctx.lineTo(x0+tw*0.5+Math.cos(a)*tw*0.28, y0+tw*0.5+Math.sin(a)*tw*0.28);} break;
    case 3: ctx.moveTo(x0,y0+tw*0.15); ctx.lineTo(x0+tw,y0+tw*0.85); break;
    case 4: ctx.moveTo(x0+tw*0.2,y0+tw*0.3); ctx.lineTo(x0+tw*0.45,y0+tw*0.6); ctx.moveTo(x0+tw*0.55,y0+tw*0.35); ctx.lineTo(x0+tw*0.75,y0+tw*0.65); break;
    case 5: ctx.moveTo(x0+tw*0.35,y0+tw*0.05); ctx.lineTo(x0+tw*0.55,y0+tw*0.40); ctx.lineTo(x0+tw*0.40,y0+tw*0.42); ctx.lineTo(x0+tw*0.65,y0+tw*0.95); break;
    case 6: ctx.moveTo(x0,y0); ctx.lineTo(x0+tw*0.30,y0+tw*0.15); ctx.lineTo(x0+tw*0.15,y0+tw*0.35); break;
    case 7: ctx.arc(x0+tw*0.5,y0+tw*1.0,tw*0.55,Math.PI*1.1,Math.PI*1.9); break;
    case 8: ctx.moveTo(x0+tw*0.2,y0+tw*0.2); ctx.lineTo(x0+tw*0.75,y0+tw*0.8); ctx.moveTo(x0+tw*0.75,y0+tw*0.2); ctx.lineTo(x0+tw*0.2,y0+tw*0.8); break;
    case 9: ctx.moveTo(x0,y0+tw*0.8); ctx.lineTo(x0+tw*0.6,y0+tw*0.8); ctx.lineTo(x0+tw*0.6,y0+tw*0.4); break;
   }
   ctx.stroke(); ctx.restore();
  }
  } // end of the flagstone branch — cobble floors return early above
  if(n4 < 0.03){
   ctx.save(); ctx.globalAlpha=0.55;
   const px=sx+ts*(0.25+hash3(gx,gy,99)*0.4), py=sy+ts*(0.35+hash3(gx,gy,101)*0.3), pr=ts*(0.10+hash3(gx,gy,103)*0.08);
   const grad=ctx.createRadialGradient(px,py,1,px,py,pr*2);
   grad.addColorStop(0,b.water+"cc"); grad.addColorStop(1,b.water+"22");
   ctx.fillStyle=grad; ctx.beginPath(); ctx.ellipse(px,py,pr*2,pr,0,0,Math.PI*2); ctx.fill();
   ctx.globalAlpha=0.7; ctx.fillStyle="rgba(255,255,255,0.55)";
   ctx.beginPath(); ctx.arc(px-pr*0.3,py-pr*0.2,pr*0.22,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  const weedRoll = hash3(gx,gy,43);
  if(weedRoll < 0.06 && n <= 0.82){
   drawWeed(ctx, sx, sy, ts, gx, gy, b, Math.floor(hash3(gx,gy,47)*6));
  }
 }

 function drawWeed(ctx, sx, sy, ts, gx, gy, b, type){
  // Growth follows the biome too: frost ferns and ice crystals in the vault,
  // thorn tendrils and spore stalks in the blackvein, dry stalks in the
  // ossuary. Those are registered content (con-worldart.js); a biome that
  // registers no family gets no weed cover at all. The ruins' inline meadow
  // blades — the thin single green strokes — are gone: on the paved floor they
  // read as a stray line of green rather than anything growing.
  const fam = Delve._clutterFamilies && Delve._clutterFamilies[b.clutter];
  if(fam && fam.weed) fam.weed(ctx, sx, sy, ts, gx, gy, b, type);
 }

 // Per-tile decoration. The family comes from the biome (`clutter`), so the
 // frozen vault isn't quietly growing meadow weeds and mushrooms.
 function drawClutter(ctx, sx, sy, ts, gx, gy, b){
  const roll = hash3(gx, gy, 71);
  if(roll < 0.03){
   // Non-ruins families are registered content (con-worldart.js). The ruins
   // pebbles/bones below stay inline as the fallback family.
   const fam = Delve._clutterFamilies && Delve._clutterFamilies[b.clutter];
   if(fam && fam.clutter){ fam.clutter(ctx, sx, sy, ts, roll); return; }
   ctx.save(); ctx.globalAlpha=0.5;
   if(roll < 0.01){
    ctx.fillStyle="#c9c2b0";
    ctx.fillRect(sx+ts*0.35, sy+ts*0.55, ts*0.3, ts*0.08);
    ctx.beginPath(); ctx.arc(sx+ts*0.35, sy+ts*0.59, ts*0.05, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx+ts*0.65, sy+ts*0.59, ts*0.05, 0, Math.PI*2); ctx.fill();
   } else if(roll < 0.02){
    ctx.fillStyle="#7a7a80"; ctx.beginPath();
    ctx.moveTo(sx+ts*0.3, sy+ts*0.6); ctx.lineTo(sx+ts*0.5, sy+ts*0.5); ctx.lineTo(sx+ts*0.7, sy+ts*0.62); ctx.closePath(); ctx.fill();
   } else { ctx.beginPath(); ctx.arc(sx+ts*0.5, sy+ts*0.55, ts*0.07, 0, Math.PI*2); ctx.fill(); }
   ctx.restore();
  }
 }

 // ── BIOME DECORATION FAMILIES ────────────────────────────────
 // The per-biome clutter/growth painters (frost, blackvein) moved to
 // content/con-worldart.js (16 Oct) — registered via Delve.registerClutter and
 // consumed by drawClutter/drawWeed above. The ruins family stays inline here
 // as the fallback. A new biome registers its family there, so this file stops
 // growing with every ward.

 // ── WALL ─────────────────────────────────────────────────────
 // Batch 17 gave walls texture (per-tile tone, top-down light, growth, chips,
 // torch sheen, a drop-shadow pass). Batch 20 removes the square read: each
 // tile looks at its four neighbours, and any edge facing open floor is
 // "exposed" — inset a couple of pixels over the dark mortar base, bowed
 // slightly off straight by a hash, with rounded corners where two exposed
 // edges meet. Edges facing another wall stay full-bleed, so a run of walls
 // merges into one continuous mass with no internal seams, and the old hard
 // top/bottom strips are gone (which also kills the horizontal banding).
 // Still deterministic and cached once per tile.
 function drawWallTile(ctx, sx, sy, ts, gx, gy, b){
  const n=hash2(gx,gy), n2=hash3(gx,gy,11), n3=hash3(gx,gy,23);
  const mood = n2<0.18?1:n2<0.38?2:n2<0.52?3:0;
  // exposure: the neighbour exists and is not a wall (out of grid = never seen)
  const exposed = function(x,y){ const t = tileAt(x,y); return t !== null && t !== Delve.T.WALL && t !== Delve.T.VOID; };
  const eT = exposed(gx,gy-1), eB = exposed(gx,gy+1), eL = exposed(gx-1,gy), eR = exposed(gx+1,gy);
  const ins = Math.max(1.5, ts*0.045);
  const x0 = sx+(eL?ins:0), y0 = sy+(eT?ins:0);
  const x1 = sx+ts-(eR?ins:0), y1 = sy+ts-(eB?ins:0);
  const midX = (x0+x1)/2, midY = (y0+y1)/2;
  // corners round only where two exposed edges meet — a T-junction with a
  // contiguous neighbour stays square so the two masses merge cleanly
  const rc = ts*0.18;
  const rTL=(eT&&eL)?rc:0, rTR=(eT&&eR)?rc:0, rBR=(eB&&eR)?rc:0, rBL=(eB&&eL)?rc:0;
  // exposed edges bow slightly off straight; direction comes from the hash
  const wob = ts*0.05;
  const wT = eT?(hash3(gx,gy,331)-0.5)*2*wob:0;
  const wR = eR?(hash3(gx,gy,337)-0.5)*2*wob:0;
  const wB = eB?(hash3(gx,gy,341)-0.5)*2*wob:0;
  const wL = eL?(hash3(gx,gy,343)-0.5)*2*wob:0;
  const wallPath = function(){
   ctx.beginPath();
   ctx.moveTo(x0+rTL, y0);
   if(eT) ctx.quadraticCurveTo(midX, y0+wT, x1-rTR, y0); else ctx.lineTo(x1, y0);
   if(rTR) ctx.arcTo(x1, y0, x1, y0+rTR, rTR);
   if(eR) ctx.quadraticCurveTo(x1+wR, midY, x1, y1-rBR); else ctx.lineTo(x1, y1);
   if(rBR) ctx.arcTo(x1, y1, x1-rBR, y1, rBR);
   if(eB) ctx.quadraticCurveTo(midX, y1+wB, x0+rBL, y1); else ctx.lineTo(x0, y1);
   if(rBL) ctx.arcTo(x0, y1, x0, y1-rBL, rBL);
   if(eL) ctx.quadraticCurveTo(x0+wL, midY, x0, y0+rTL); else ctx.lineTo(x0, y0);
   if(rTL) ctx.arcTo(x0, y0, x0+rTL, y0, rTL);
   ctx.closePath();
  };
  // the dark base shows only at the exposed insets — the mortar between stones
  ctx.fillStyle=b.mortar; ctx.fillRect(sx,sy,ts,ts);
  // per-tile stone tone — weathered variation instead of a flat fill
  let stone = blendHex(b.wall, "#0a0e12", n * 0.16);
  if(n3 > 0.90) stone = blendHex(stone, "#ffffff", 0.05);
  wallPath(); ctx.fillStyle=stone; ctx.fill();
  // everything below paints inside the stone shape
  ctx.save(); wallPath(); ctx.clip();
  // soft top-down light, the biome's edge tone at the crest
  const lg=ctx.createLinearGradient(0,y0,0,y1);
  lg.addColorStop(0, b.wallEdge+"55");
  lg.addColorStop(0.30,"rgba(255,255,255,0.06)");
  lg.addColorStop(1,"rgba(0,0,0,0.18)");
  ctx.fillStyle=lg; ctx.fillRect(sx,sy,ts,ts);
  if(mood===2){ ctx.fillStyle="rgba(60,90,60,0.22)"; ctx.fillRect(sx,sy,ts,ts); }
  if(mood===3){ const grad=ctx.createLinearGradient(sx+ts*0.5,sy,sx+ts*0.5,sy+ts); grad.addColorStop(0,"rgba(70,40,20,0.40)"); grad.addColorStop(0.6,"rgba(50,30,15,0.14)"); grad.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=grad; ctx.fillRect(sx+ts*0.25,sy,ts*0.5,ts); }
  if(ts>=20){
   if(b.wallStyle === "roots"){
    // Root-bound earth: wandering root strands and rootlets instead of masonry
    // courses — no straight seams, nothing reads as a square. Positions are
    // smooth functions of (gx,gy), so a root continues into the neighbour tile.
    ctx.strokeStyle = b.wallBrick; ctx.lineCap = "round";
    ctx.globalAlpha = mood===1 ? 0.62 : 0.45;
    for(let i=0;i<3;i++){
     const bx = x0+(x1-x0)*(0.22 + i*0.28 + Math.sin(gx*1.3 + gy*2.1 + i*1.9)*0.06);
     const wob = Math.sin(gx*0.8 + gy*1.6 + i*2.3) * ts * 0.05;
     ctx.lineWidth = Math.max(1, ts*(i===1 ? 0.035 : 0.022));
     ctx.beginPath();
     ctx.moveTo(bx, y0+2);
     ctx.quadraticCurveTo(bx + wob, midY, bx + Math.sin(gx*1.1 + gy*2.5 + i)*ts*0.04, y1-2);
     ctx.stroke();
     for(let k=0;k<2;k++){
      const ry = y0+2 + (y1-y0-4)*(0.25 + 0.5*k + hash3(gx,gy,911+i*3+k)*0.2);
      const rx = bx + Math.sin(gy*2.0 + gx*1.4 + i*1.7 + k)*ts*0.08;
      ctx.lineWidth = Math.max(1, ts*0.014);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (hash3(gx,gy,931+i*3+k)-0.5)*ts*0.22, ry + hash3(gx,gy,951+i*3+k)*ts*0.18);
      ctx.stroke();
     }
    }
    ctx.globalAlpha = 1;
   } else {
    // sagging course line + jittered verticals: masonry, not a grid
    ctx.strokeStyle=b.wallBrick; ctx.lineWidth=1; ctx.globalAlpha=mood===1?0.55:0.38;
    ctx.beginPath();
    // One continuous running bond across the whole wall: the course sag and the
    // head-joint positions are smooth functions of position (not per-tile random
    // dice), and the joint halves alternate by row. Neighbouring tiles therefore
    // finish the courses their neighbours start — no wall piece looks turned,
    // flipped or randomly rotated against the rest of the structure.
    const sag = Math.sin(gx * 0.9 + gy * 1.7) * ts * 0.03;
    ctx.moveTo(x0+2, midY); ctx.quadraticCurveTo(midX, midY+sag, x1-2, midY);
    const v1 = x0+(x1-x0)*(0.32 + Math.sin(gx * 2.1 + gy * 1.3) * 0.05);
    const v2 = x0+(x1-x0)*(0.70 + Math.cos(gx * 1.7 + gy * 2.3) * 0.05);
    const upper = ((gy & 1) === 0);    // running bond: joint halves alternate by row
    if(upper){ ctx.moveTo(v1,y0+2); ctx.lineTo(v1,midY); ctx.moveTo(v2,y0+2); ctx.lineTo(v2,midY); }
    else { ctx.moveTo(v1,midY); ctx.lineTo(v1,y1-2); ctx.moveTo(v2,midY); ctx.lineTo(v2,y1-2); }
    ctx.stroke(); ctx.globalAlpha=1;
    if(mood===1){
     // a single shadowed brick, sitting on the same course line as its row
     const left = ((gx & 1) === 0);
     const bx0 = left? x0+2 : v1+1, bx1 = left? v1-1 : x1-2;
     const by0 = upper? y0+2 : midY+2, by1 = upper? midY-1 : y1-2;
     ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.fillRect(bx0,by0,bx1-bx0,by1-by0);
     ctx.fillStyle=b.wallBrick; ctx.fillRect(bx0+(bx1-bx0)*0.3, by0-1, (bx1-bx0)*0.25, 2);
    }
   }
  }
  // the biome's own growth creeping over the top edge: lichen in the
  // Blackvein, frost in the Vault — colour comes from b.moss. A growthLinked
  // biome (the Upper Ruins) skips this: its walls only grow moss where a
  // floor patch touches them, painted by js/growth.js drawGrowthWalls instead.
  if(!b.growthLinked && hash3(gx,gy,171) < 0.45){
   ctx.save(); ctx.globalAlpha = mood===2 ? 0.40 : 0.28;
   ctx.fillStyle = b.moss;
   const blobN = 2 + Math.floor(hash3(gx,gy,173)*3);
   for(let i=0;i<blobN;i++){
    const bx = sx + ts*(0.12 + hash3(gx,gy,175+i)*0.76);
    const by = sy + ts*(0.06 + hash3(gx,gy,181+i)*0.14);
    const rr = ts*(0.06 + hash3(gx,gy,187+i)*0.08);
    ctx.beginPath(); ctx.ellipse(bx,by,rr,rr*0.7,0,0,Math.PI*2); ctx.fill();
   }
   if(hash3(gx,gy,193) < 0.4){
    ctx.globalAlpha=0.20;
    ctx.fillRect(sx + ts*(0.2+hash3(gx,gy,195)*0.6), sy+ts*0.10, Math.max(1,ts*0.04), ts*(0.18+hash3(gx,gy,197)*0.22));
   }
   ctx.restore();
  }
  // a chip or dent in the stone
  if(n3 < 0.18){
   ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle="#0a0e12";
   ctx.beginPath();
   ctx.ellipse(sx + ts*(0.15+hash3(gx,gy,211)*0.7), sy + ts*(0.15+hash3(gx,gy,213)*0.7),
    ts*0.05, ts*0.035, hash3(gx,gy,217)*3, 0, Math.PI*2);
   ctx.fill(); ctx.restore();
  }
  // warm sheen where a brazier is on or beside this tile
  if(isTorchTile(gx,gy) || isTorchTile(gx-1,gy) || isTorchTile(gx+1,gy) || isTorchTile(gx,gy-1) || isTorchTile(gx,gy+1)){
   const sg=ctx.createRadialGradient(sx+ts*0.5, sy+ts*0.35, 1, sx+ts*0.5, sy+ts*0.35, ts*0.9);
   sg.addColorStop(0, b.torch+"33"); sg.addColorStop(1, "rgba(0,0,0,0)");
   ctx.fillStyle=sg; ctx.fillRect(sx,sy,ts,ts);
  }
  // grounding shade along an exposed bottom edge only — a contiguous wall
  // below gets none, so stacked rows no longer band
  if(eB){
   const bg=ctx.createLinearGradient(0,y1-ts*0.30,0,y1);
   bg.addColorStop(0,"rgba(0,0,0,0)"); bg.addColorStop(1,"rgba(0,0,0,0.30)");
   ctx.fillStyle=bg; ctx.fillRect(x0, y1-ts*0.30, x1-x0, ts*0.30);
  }
  ctx.restore();
 }

 // Wall drop shadows (Batch 17, option D). Every wall throws a soft shadow onto
 // the floor below it and the floor to its right, so the walls read as raised
 // out of the ground instead of painted onto it. Direction is fixed everywhere
 // (down + right) so the dungeon is lit consistently. Called after the floor
 // and props are painted, before the walls — shadows land on the ground.
 function drawWallShadows(ctx, camX, camY, vw, vh, ts){
  const G = Delve.G, T = Delve.T;
  if(!G || !G.grid) return;
  for(let y=0;y<vh+1;y++) for(let x=0;x<vw+1;x++){
   const gx=camX+x, gy=camY+y;
   if(tileAt(gx,gy) !== T.WALL) continue;
   const below = tileAt(gx, gy+1);
   if(below !== null && below !== T.WALL && below !== T.VOID){
    const sy=(y+1)*ts;
    const g=ctx.createLinearGradient(0,sy,0,sy+ts*0.5);
    g.addColorStop(0,"rgba(4,6,10,0.34)"); g.addColorStop(1,"rgba(4,6,10,0)");
    ctx.fillStyle=g; ctx.fillRect(x*ts, sy, ts, ts*0.5);
   }
   const right = tileAt(gx+1, gy);
   if(right !== null && right !== T.WALL && right !== T.VOID){
    const sx=(x+1)*ts;
    const g2=ctx.createLinearGradient(sx,0,sx+ts*0.35,0);
    g2.addColorStop(0,"rgba(4,6,10,0.26)"); g2.addColorStop(1,"rgba(4,6,10,0)");
    ctx.fillStyle=g2; ctx.fillRect(sx, y*ts, ts*0.35, ts);
   }
  }
 }

 // ── TORCH ────────────────────────────────────────────────────
 // ── DOOR + PATCH TILES (layer1 port) ─────────────────────────
 // A door is a single tile in the shared wall between two rooms: a recessed
 // timber set into the stone. GRASS is still a cellular-automaton blob
 // (levels.js), so each tile draws its own deterministic slice. WATER is a
 // wall-anchored puddle: js/puddles.js owns the pool shape.
 function drawDoorTile(ctx, sx, sy, ts, b){
  ctx.save();
  ctx.fillStyle = b.wallBrick || "#3a4248";
  ctx.fillRect(sx, sy, ts, ts);
  const m = Math.max(2, ts * 0.14);
  ctx.fillStyle = "#5a4630";
  ctx.beginPath(); ctx.roundRect(sx + m, sy + m, ts - m*2, ts - m*2, ts*0.12); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = Math.max(1, ts*0.03);
  for(let i = 1; i <= 2; i++){
   const px = sx + m + (ts - m*2) * i / 3;
   ctx.beginPath(); ctx.moveTo(px, sy + m + ts*0.05); ctx.lineTo(px, sy + ts - m - ts*0.05); ctx.stroke();
  }
  ctx.fillStyle = "#c8a84a";
  ctx.beginPath(); ctx.arc(sx + ts*0.68, sy + ts*0.52, Math.max(1, ts*0.05), 0, Math.PI*2); ctx.fill();
  ctx.restore();
 }

 function drawGrassPatch(ctx, sx, sy, ts, gx, gy, b){
  ctx.save();
  // turf tint over the floor slab
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = b.patchGrass;
  ctx.beginPath(); ctx.roundRect(sx + ts*0.04, sy + ts*0.04, ts*0.92, ts*0.92, ts*0.18); ctx.fill();
  ctx.globalAlpha = 1;
  // blades
  const blades = 3 + Math.floor(hash3(gx, gy, 431) * 4);
  ctx.strokeStyle = b.patchGrass; ctx.lineCap = "round";
  for(let i = 0; i < blades; i++){
   const bx = sx + ts * (0.15 + hash3(gx, gy, 433 + i) * 0.7);
   const by = sy + ts * (0.30 + hash3(gx, gy, 443 + i) * 0.5);
   const hgt = ts * (0.10 + hash3(gx, gy, 453 + i) * 0.14);
   ctx.lineWidth = Math.max(1, ts * 0.035);
   ctx.beginPath();
   ctx.moveTo(bx, by);
   ctx.quadraticCurveTo(bx + ts*0.03, by - hgt*0.6, bx + ts*(hash3(gx, gy, 463 + i) - 0.5)*0.12, by - hgt);
   ctx.stroke();
  }
  ctx.restore();
 }

 let torchFrame=0;
 function drawWallTorch(ctx, sx, sy, ts, b){
  const flicker=[{h:0.22,w:0.10,a:0.90},{h:0.26,w:0.12,a:1.00},{h:0.20,w:0.09,a:0.80}][torchFrame];
  const cx=sx+ts*0.5, by=sy+ts*0.72;
  ctx.save(); ctx.globalAlpha=0.18+(torchFrame===1?0.06:0); const glowY=by+ts*0.3;
  const grd=ctx.createRadialGradient(cx,glowY,2,cx,glowY,ts*1.1); grd.addColorStop(0,b.torch+"cc"); grd.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=grd; ctx.fillRect(sx-ts,sy,ts*3,ts*2); ctx.restore();
  ctx.save(); ctx.strokeStyle="#6a5030"; ctx.lineWidth=Math.max(1.5,ts*0.04); ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(cx,by); ctx.lineTo(cx,by-ts*0.12); ctx.moveTo(cx-ts*0.06,by-ts*0.08); ctx.lineTo(cx+ts*0.06,by-ts*0.08); ctx.stroke(); ctx.restore();
  ctx.save(); const fh=ts*flicker.h, fw=ts*flicker.w, fy=by-ts*0.12;
  const flamGrad=ctx.createLinearGradient(cx,fy,cx,fy-fh); flamGrad.addColorStop(0,b.torch+"ff"); flamGrad.addColorStop(0.5,"#ff6020dd"); flamGrad.addColorStop(1,"#ffee8800");
  ctx.fillStyle=flamGrad; ctx.globalAlpha=flicker.a;
  ctx.beginPath(); ctx.moveTo(cx-fw,fy); ctx.quadraticCurveTo(cx-fw*1.2,fy-fh*0.5,cx,fy-fh); ctx.quadraticCurveTo(cx+fw*1.2,fy-fh*0.5,cx+fw,fy); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=flicker.a*0.7; ctx.fillStyle="#fff8c0"; ctx.beginPath(); ctx.ellipse(cx,fy-fh*0.25,fw*0.4,fh*0.28,0,0,Math.PI*2); ctx.fill(); ctx.restore();
 }

 // ── STAIRS ───────────────────────────────────────────────────
 function drawStairs(ctx, sx, sy, ts, b){
  ctx.fillStyle=b.mortar; ctx.fillRect(sx,sy,ts,ts);
  ctx.fillStyle=b.floor2; ctx.fillRect(sx+2,sy+2,ts-4,ts-4);
  const inner=ts-4, steps=4, stepH=inner/steps;
  for(let i=0;i<steps;i++){ const y0=sy+2+i*stepH; const t=0.12+i*0.18; ctx.fillStyle=blendHex(b.floor2,"#05070a",t); ctx.fillRect(sx+2,y0,inner,stepH); ctx.fillStyle="rgba(255,255,255,0.07)"; ctx.fillRect(sx+2,y0,inner,1); }
  ctx.fillStyle="rgba(0,0,0,0.45)"; ctx.fillRect(sx+2,sy+ts-4,inner,2);
 }

 // ── SPRITES ──────────────────────────────────────────────────
 function drawShadow(ctx, cx, cy, ts, scale){
  const k = scale || 1;
  const s = Delve.SPR && Delve.SPR.shadow;
  if(s){ const w=ts*0.8*k, h=w*(s.height/s.width)*0.5; ctx.drawImage(s,cx-w/2,cy+ts*0.30,w,h); }
  else { ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(cx,cy+ts*0.33,ts*0.28*k,ts*0.09,0,0,Math.PI*2); ctx.fill(); }
 }
 // `size` is an optional {w,h} in tiles (bosses are 2x2). Placement is
 // bottom-anchored: a 1x1 sprite's feet land exactly where they always did, and
 // extra height grows upward, so a bigger sprite stands on its tile.
 function drawSprite(ctx, kind, cx, cy, ts, hurt, elite, attack, size){
  const S = Delve.SPR && Delve.SPR[kind];
  if(!S){ ctx.fillStyle="#ff5c7a"; ctx.beginPath(); ctx.arc(cx,cy,ts*0.3,0,Math.PI*2); ctx.fill(); return; }
  let img;
  if(attack && S.attack) img = S.attack;      // its own action wins the pose
  else if(elite && S.elite) img = S.elite;
  else img = hurt ? (S.hurt || S.idle) : S.idle;
  const w = ts * 0.9 * ((size && size.w) || 1);
  const h = ts * 0.9 * ((size && size.h) || 1);
  const bottom = cy + ts * 0.45;
  ctx.drawImage(img, cx - w/2, bottom - h, w, h);
 }
 function drawWorldSprite(ctx, key, cx, cy, ts){
  const S = Delve.SPR && Delve.SPR.world && Delve.SPR.world[key];
  if(!S) return; const size=ts*0.75; ctx.drawImage(S,cx-size/2,cy-size/2,size,size);
 }

 // ── ARENA PROPS ──────────────────────────────────────────────
 // G.decor (levels.js dressBossArena). Floor props sit centred on their tile.
 // Wall props hang from the top of their tile and spill into the tile below —
  // their art is taller than one tile, which is what makes it read as hanging.
 // Nothing here touches the grid, so props can't block, be tapped, or be walked
 // into: they are purely painted.
 function drawDecor(ctx, camX, camY, vw, vh, ts, layer){
  const G = Delve.G;
  const list = G && G.decor;
  if(!list || !list.length) return;
  const W = Delve.SPR && Delve.SPR.world;
  if(!W) return;
  for(let i=0;i<list.length;i++){
   const d = list[i];
   if(d.layer !== layer) continue;
   if(d.x<camX || d.y<camY || d.x>=camX+vw || d.y>=camY+vh) continue;
   const img = W[d.key];
   if(!img) continue;
   const tx = (d.x-camX)*ts, ty = (d.y-camY)*ts;
   const w = ts*0.95;
   if(layer === "wall"){
    const h = w * (img.height / img.width);
    ctx.drawImage(img, tx+ts*0.5-w*0.5, ty, w, h);
   } else {
    ctx.drawImage(img, tx+ts*0.5-w*0.5, ty+ts*0.5-w*0.5, w, w);
   }
  }
 }

 function drawPlayer(ctx, cx, cy, ts, hurt, ox, oy, attack){
  drawShadow(ctx, cx, cy, ts);
  drawSprite(ctx, "soldier", cx+(ox||0), cy+(oy||0), ts, hurt, false, attack, null);
 }

 function drawMob(ctx, m, cx, cy, ts){
  // A boss's art covers a w x h block of tiles; its own tile is the bottom-left
  // of that block, so a wide body straddles its columns evenly.
  const size = m.isBoss ? (m.size || { w:1, h:1 }) : null;
  const bw = size ? size.w : 1, bh = size ? size.h : 1;
  const ax = cx + (bw - 1) * ts * 0.5;
  drawShadow(ctx, ax, cy, ts, bw);

  const hurt = m.hitFlash && Date.now()-m.hitFlash < 130;
  const atk = attacking(m);
  let rx=0, ry=0;
  if(hurt || atk){
   // Recoil pushes away, the attack lunge pulls toward — they naturally cancel.
   const dir = dirAway(m.x, m.y, Delve.G.px, Delve.G.py);
   if(hurt) ensureRecoil(m, m.hitFlash, dir.x, dir.y);
   if(atk)  ensureLunge(m, m.attackFlash, -dir.x, -dir.y);
   const ro = recoilOffset(m, ts), lo = lungeOffset(m, ts);
   rx = ro.x + lo.x; ry = ro.y + lo.y;
  } else recoils.delete(m);

  drawSprite(
   ctx,
   // Act-2 form: a boss whose rib-shield broke swaps to its exposed sprite,
   // permanently (§6.16). Every other mob draws its own kind as before.
   (m.isBoss && m.shieldBroken && m.spriteOpen && Delve.SPR[m.spriteOpen]) ? m.spriteOpen : (m.kind||"goblin"),
   ax+rx, cy+ry, ts, hurt, m.elite, atk, size);

  if(m.elite){ ctx.save(); ctx.strokeStyle=Delve.CONFIG.elite.glow||"#ffd75e"; ctx.lineWidth=1.5; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.arc(ax+rx, cy+ry-ts*0.1, ts*0.42*bw, 0, Math.PI*2); ctx.stroke(); ctx.restore(); }
  if(m.effects && m.effects.length){
   const pips=m.effects.length, pw=5, gap=3, totalW=pips*pw+(pips-1)*gap;
   let px=ax+rx-totalW/2; const py=cy+ry-ts*0.55-(bh-1)*ts*0.9;
   m.effects.forEach(e => { ctx.fillStyle=Delve.statusColor?Delve.statusColor(e.id):"#fff"; ctx.fillRect(px,py,pw,3); px+=pw+gap; });
  }

  // Boss objects carry maxHp like all monsters — read it directly.
  const mhp = m.maxHp;
  const frac = Math.max(0,Math.min(1,m.hp/mhp));
  const barW = ts*0.68*bw, barY = cy+ry-ts*0.48-(bh-1)*ts*0.9;
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(ax+rx-barW/2, barY, barW, 4);
  ctx.fillStyle = m.isBoss?"#c98aff":m.elite?"#ffd75e":"#ff7d93";
  ctx.fillRect(ax+rx-barW/2, barY, barW*frac, 4);
 }

 function drawItem(ctx, it, cx, cy, ts){
  drawWorldSprite(ctx, "itemPile", cx, cy, ts);
  ctx.fillStyle = Delve.TIERS.colors[it.tier] || "#fff";
  ctx.globalAlpha=0.5; ctx.beginPath(); ctx.arc(cx,cy,ts*0.22,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
 }

 function drawBarrel(ctx, cx, cy, ts){ drawWorldSprite(ctx, "barrel", cx, cy, ts); }

 function drawChest(ctx, chest, cx, cy, ts){
  drawShadow(ctx, cx, cy, ts*0.5);
  // Sarcophagus tombs (Bone Ossuary) draw their own sealed/open art.
  if(chest.sarcophagus){ drawWorldSprite(ctx, chest.open ? "tombOpen" : "tombSealed", cx, cy, ts); return; }
  drawWorldSprite(ctx, chest.open ? "chestOpen" : "chestClosed", cx, cy, ts);
 }

 function drawTreasure(ctx, thing, cx, cy, ts){
  if(thing==="gold") drawWorldSprite(ctx,"goldPile",cx,cy,ts);
  else if(thing==="potion") drawWorldSprite(ctx,"potionPile",cx,cy,ts);
  else if(thing==="chest") drawWorldSprite(ctx,"chestClosed",cx,cy,ts);
  else if(thing==="chestOpen") drawWorldSprite(ctx,"chestOpen",cx,cy,ts);
  else drawWorldSprite(ctx,"itemPile",cx,cy,ts);
 }

 function drawShopkeeper(ctx, cx, cy, ts){
  drawShadow(ctx, cx, cy, ts);
  drawWorldSprite(ctx, "shopkeeper", cx, cy, ts*1.2);
  ctx.fillStyle="#5a4a34"; ctx.fillRect(cx-ts*0.5, cy+ts*0.15, ts*1.0, ts*0.12);
  ctx.fillStyle="#7a654a"; ctx.fillRect(cx-ts*0.5, cy+ts*0.15, ts*1.0, ts*0.05);
  ctx.fillStyle="#7ea8e8"; ctx.fillRect(cx-ts*0.15, cy+ts*0.05, ts*0.12, ts*0.12);
  ctx.fillRect(cx+ts*0.03, cy+ts*0.05, ts*0.12, ts*0.12);
 }

 // ── PAPER DOLL (inventory character figure) ──────────────────
 // Moved here from ui.js: it is canvas drawing, and ui.js loads later.
 Delve.drawPaperDoll = function(){
  const cv = document.getElementById("charCanvas");
  if(!cv || !cv.getContext) return;
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext("2d");
  if(!ctx) return;
  ctx.clearRect(0,0,W,H);

  const eq = Delve.equipSlots();
  const cx = W/2;

  // backdrop shadow
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath(); ctx.ellipse(cx, H-24, 46, 10, 0, 0, Math.PI*2); ctx.fill();

  const skin = "#e8c39a", hair = "#5a3d2c", bodyBase = "#33507a", bodyDark = "#233a5c";
  const tier = function(item){
   return item ? (Delve.TIERS.colors[item.tier] || "#cfd8e0") : "#1a2532";
  };

  // cloak (behind everything)
  if(eq.cloak){
   ctx.fillStyle = tier(eq.cloak);
   ctx.beginPath();
   ctx.moveTo(cx-16, H-120);
   ctx.lineTo(cx-42, H-36);
   ctx.lineTo(cx+42, H-36);
   ctx.lineTo(cx+16, H-120);
   ctx.closePath();
   ctx.fill();
  }

  // legs
  ctx.fillStyle = "#4d3622";
  ctx.fillRect(cx-15, H-80, 12, 52);
  ctx.fillRect(cx+3, H-80, 12, 52);
  // feet
  if(eq.feet){ drawSwatch(ctx, cx-17, H-32, 16, 8, tier(eq.feet)); drawSwatch(ctx, cx+1, H-32, 16, 8, tier(eq.feet)); }
  else { ctx.fillStyle = "#2b2118"; ctx.fillRect(cx-17, H-34, 16, 8); ctx.fillRect(cx+1, H-34, 16, 8); }

  // torso
  const bodyCol = eq.body ? tier(eq.body) : bodyBase;
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.roundRect(cx-22, H-132, 44, 58, 8);
  ctx.fill();
  ctx.fillStyle = eq.body ? bodyCol : bodyDark;
  ctx.fillRect(cx-22, H-132, 5, 58);
  ctx.fillRect(cx+17, H-132, 5, 58);

  // arms
  ctx.fillStyle = skin;
  ctx.fillRect(cx-36, H-128, 9, 40);
  ctx.fillRect(cx+27, H-128, 9, 40);
  // hands
  if(eq.hands){ drawSwatch(ctx, cx-37, H-90, 11, 8, tier(eq.hands)); drawSwatch(ctx, cx+26, H-90, 11, 8, tier(eq.hands)); }
  else { ctx.fillStyle = skin; ctx.fillRect(cx-37, H-90, 11, 7); ctx.fillRect(cx+26, H-90, 11, 7); }

  // neck + head
  ctx.fillStyle = skin;
  ctx.fillRect(cx-5, H-140, 10, 8);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(cx, H-152, 20, 0, Math.PI*2); ctx.fill();
  // hair
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(cx, H-158, 20, Math.PI, 0); ctx.fill();
  // face
  ctx.fillStyle = "#1d232b";
  ctx.fillRect(cx-8, H-156, 3, 3); ctx.fillRect(cx+5, H-156, 3, 3);
  // head equipment
  if(eq.head){
   ctx.fillStyle = tier(eq.head);
   ctx.beginPath(); ctx.arc(cx, H-156, 21, Math.PI, Math.PI*2); ctx.fill();
   ctx.fillRect(cx-22, H-158, 44, 7);
  }

  // weapon (right hand side)
  if(eq.weapon){
   ctx.save();
   ctx.translate(cx+30, H-98);
   ctx.rotate(-0.6);
   ctx.fillStyle = tier(eq.weapon);
   ctx.fillRect(-3, -34, 6, 34);      // blade
   ctx.fillStyle = "#8a5a33"; ctx.fillRect(-8, -4, 16, 5);   // hilt
   ctx.restore();
  }
  // offhand
  if(eq.offhand){
   ctx.fillStyle = tier(eq.offhand);
   ctx.beginPath(); ctx.arc(cx-40, H-106, 13, 0, Math.PI*2); ctx.fill();
   ctx.fillStyle = "rgba(0,0,0,0.2)";
   ctx.beginPath(); ctx.arc(cx-40, H-106, 13, 0, Math.PI*2); ctx.stroke();
  }

  // amulet (chest)
  if(eq.amulet){
   ctx.fillStyle = tier(eq.amulet);
   ctx.beginPath(); ctx.arc(cx, H-112, 5, 0, Math.PI*2); ctx.fill();
  }

  function drawSwatch(ctx2, x, y, w, h, col){
   ctx2.fillStyle = col; ctx2.fillRect(x, y, w, h);
   ctx2.fillStyle = "rgba(255,255,255,0.12)"; ctx2.fillRect(x, y, w, 2);
  }
 };

 // ── MINIMAP ──────────────────────────────────────────────────
 // markVisited records the fog-of-war reveal radius as the player moves;
 // renderMinimap draws it. Delve.draw() calls markVisited, and
 // ui.js's updateHUD() calls renderMinimap every HUD refresh.
 Delve.markVisited = function(x, y){
  const G = Delve.G; if(!G || !G.grid || !G.grid.length) return;
  if(G._visitedFloor !== G.floor){ G.visited = []; G._visitedFloor = G.floor; }
  if(!G.visited) G.visited = [];
  const h = G.grid.length, w = G.grid[0].length, R = 5;
  for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){
   if(Math.abs(dx)+Math.abs(dy) > R) continue;
   const ux=x+dx, uy=y+dy;
   if(ux<0||uy<0||ux>=w||uy>=h) continue;
   if(!G.visited[uy]) G.visited[uy] = [];
   G.visited[uy][ux] = 1;
  }
 };

 Delve.renderMinimap = function(){
  const wrap = document.getElementById("minimapWrap");
  if(!wrap || getComputedStyle(wrap).display === "none") return;
  const cv = document.getElementById("minimap"); if(!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d");
  if(!ctx) return;
  const G = Delve.G;
  ctx.fillStyle = "#070a0e";
  ctx.fillRect(0,0,cv.width,cv.height);
  if(!G || !G.grid || !G.grid.length) return;
  const gw = G.grid[0].length, gh = G.grid.length;
  const s = Math.min(cv.width/gw, cv.height/gh);
  const ox = (cv.width-gw*s)/2, oy = (cv.height-gh*s)/2;
  const vis = G.visited || [];
  const T = Delve.T;
  const seen = function(x,y){ return vis[y] && vis[y][x]; };
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){
   const t = G.grid[y][x];
   if(t === T.WALL || t === T.VOID || !seen(x,y)) continue;
   let col = "#2a333d";
   if(t === T.STAIR) col = "#2ad0b0";
    else if(t === T.DOOR) col = "#4a5568";
    else if(t === T.WATER) col = "#2a4a6a";
    else if(t === T.GRASS) col = "#2e5238";
   else if(t === T.GOLD) col = "#d9a11f";
   else if(t === T.CHEST) col = "#c9971f";
   else if(t === T.BARREL) col = "#7a5c3a";
   ctx.fillStyle = col;
   ctx.fillRect(ox+x*s, oy+y*s, s+0.5, s+0.5);
  }
  if(G.shop && G.shop.x >= 0 && seen(G.shop.x, G.shop.y)){
   ctx.fillStyle = "#ffd75e";
   ctx.fillRect(ox+G.shop.x*s, oy+G.shop.y*s, s+1, s+1);
  }
  const dot = function(x,y,col,r){
   ctx.fillStyle = col;
   ctx.beginPath();
   ctx.arc(ox+x*s+s/2, oy+y*s+s/2, s*r, 0, Math.PI*2);
   ctx.fill();
  };
  (G.monsters||[]).forEach(function(m){ if(seen(m.x,m.y)) dot(m.x,m.y,m.elite?"#c98aff":"#e05a6a",0.45); });
  if(G.boss && seen(G.boss.x,G.boss.y)) dot(G.boss.x,G.boss.y,"#ff4a3d",0.6);
  dot(G.px,G.py,"#ffffff",0.4);
 };

 // ── MAIN DRAW ────────────────────────────────────────────────
 Delve.draw = function(){
  const G = Delve.G;
  if(!G) return;
  const ctx=Delve.ctx, W=Delve.W, H=Delve.H, ts=Delve.ts;
  Delve.computeView();
  const vw=Delve.viewW, vh=Delve.viewH, b=biome(), T=Delve.T;
  ensureCache(G);

  let camX=Math.floor(G.px-vw/2), camY=Math.floor(G.py-vh/2);
  camX=Math.max(0,Math.min(camX,G.grid[0].length-vw));
  camY=Math.max(0,Math.min(camY,G.grid.length-vh));
  Delve.camX=camX; Delve.camY=camY;

  let ox=0, oy=0;
  if(shakeT>0){ ox=(Math.random()-0.5)*shakeMag; oy=(Math.random()-0.5)*shakeMag; shakeT--; } else shakeMag=0;

  ctx.save(); ctx.translate(ox,oy); ctx.fillStyle="#06090d"; ctx.fillRect(-10,-10,W+20,H+20);

  // floors
  for(let y=0;y<vh+1;y++) for(let x=0;x<vw+1;x++){
   const gx=camX+x, gy=camY+y, t=tileAt(gx,gy);
   if(t===T.VOID){ ctx.fillStyle="#000000"; ctx.fillRect(x*ts,y*ts,ts,ts); continue; }   // layer1: no room = pure black
    if(t===null||t===T.WALL) continue;
   const sx=x*ts, sy=y*ts;
   blitTile(ctx,gx,gy,sx,sy,ts,b,t);
   if(t===T.FLOOR) drawClutter(ctx,sx,sy,ts,gx,gy,b);
  }
  // biome ground cover, flat on the floor before any prop sits over it
  // Blackvein mycelium: thin silver veins over the soil floor, under the props
   if(b.floorStyle === "soil") drawVeins(ctx,camX,camY,vw,vh,ts);
   Delve.drawGroundCover(ctx,camX,camY,vw,vh,ts);
  // ward growth patches (js/growth.js) — organic spots on top of the floor pattern
  Delve.drawGrowthFloor(ctx,camX,camY,vw,vh,ts);
  // floor props first, so wall edges and their shadows fall over the bases
  drawDecor(ctx,camX,camY,vw,vh,ts,"floor");
  // wall drop shadows, onto the floor below/right before the walls themselves
  drawWallShadows(ctx,camX,camY,vw,vh,ts);
  // walls
  for(let y=0;y<vh+1;y++) for(let x=0;x<vw+1;x++){
   const gx=camX+x, gy=camY+y, t=tileAt(gx,gy);
   if(t!==T.WALL) continue;
    // layer1 autotiling: a wall with no open neighbour is deep wall — never
    // drawn, so buried stone disappears into the void black. The test looks at
    // all EIGHT neighbours, because a corner tile only touches the room
    // diagonally, and the map's outer ring is always drawn — so a room that
    // reaches the map edge is closed off in stone instead of showing a black
    // gap where its corner or top-side wall should be.
    const open = function(x2,y2){ const t2 = tileAt(x2,y2); return t2 !== null && t2 !== T.WALL && t2 !== T.VOID; };
    const edge = (gx === 0 || gy === 0 || gx === G.grid[0].length - 1 || gy === G.grid.length - 1);
    let nearOpen = false;
    for(let ny = -1; ny <= 1 && !nearOpen; ny++){
     for(let nx = -1; nx <= 1; nx++){
      if(!nx && !ny) continue;
      if(open(gx + nx, gy + ny)){ nearOpen = true; break; }
     }
    }
    if(!nearOpen && !edge) continue;
   const sx=x*ts, sy=y*ts;
   if(isTorchTile(gx,gy)){ drawWallTile(ctx,sx,sy,ts,gx,gy,b); drawWallTorch(ctx,sx,sy,ts,b); }
   else blitTile(ctx,gx,gy,sx,sy,ts,b,t);
   const fd=G.floorData;
   if(fd && fd.secretRoom && fd.secretRoom.falseWallX===gx && fd.secretRoom.falseWallY===gy){
    const pulse=0.5+0.5*Math.sin(Date.now()*0.003);
    ctx.save(); ctx.globalAlpha=pulse*0.55; ctx.fillStyle="#7ee0ff"; ctx.beginPath(); ctx.arc(sx+ts*0.5,sy+ts*0.5,ts*0.15,0,Math.PI*2); ctx.fill(); ctx.restore();
   }
  }
  // wall growth climbs (js/growth.js) — only on walls a floor patch grows against
  Delve.drawGrowthWalls(ctx,camX,camY,vw,vh,ts);
  // hanging props, over the wall art. Drawn before the entities below, so a boss
  // or monster standing in front of a banner still covers it.
  drawDecor(ctx,camX,camY,vw,vh,ts,"wall");

  // path highlight
  if(G._path && G._path.length>0){
   const dest=G._path[G._path.length-1];
   if(dest.x>=camX&&dest.y>=camY&&dest.x<camX+vw&&dest.y<camY+vh){
    const sx=(dest.x-camX)*ts, sy=(dest.y-camY)*ts;
    ctx.fillStyle="rgba(255,230,100,0.18)"; ctx.strokeStyle="rgba(255,220,80,0.7)"; ctx.fillRect(sx,sy,ts,ts); ctx.lineWidth=2; ctx.strokeRect(sx+1,sy+1,ts-2,ts-2);
   }
  }

  // The four adjacency highlights that used to ring the player here — a blue
  // square on each walkable neighbour, orange on a monster — were removed by
  // owner request, 16 Oct. Nothing replaces them: the floor is meant to read as
  // one continuous surface. The path-destination square above is the only
  // movement aid that stays.

  // chests
  (G.chests||[]).forEach(ch=>{
   if(ch.x<camX||ch.y<camY||ch.x>=camX+vw||ch.y>=camY+vh) return;
   drawChest(ctx, ch, (ch.x-camX)*ts+ts/2, (ch.y-camY)*ts+ts/2, ts);
  });

  // items
  (G.items||[]).forEach(it=>{
   if(it.x<camX||it.y<camY||it.x>=camX+vw||it.y>=camY+vh) return;
   drawItem(ctx, it, (it.x-camX)*ts+ts/2, (it.y-camY)*ts+ts/2, ts);
  });

  // gold piles
  (G.goldPiles||[]).forEach(p=>{
   if(p.x<camX||p.y<camY||p.x>=camX+vw||p.y>=camY+vh) return;
   drawTreasure(ctx,"gold",(p.x-camX)*ts+ts/2,(p.y-camY)*ts+ts/2,ts);
  });

  // barrels
  (G.barrels||[]).forEach(bar=>{
   if(bar.x<camX||bar.y<camY||bar.x>=camX+vw||bar.y>=camY+vh) return;
   drawBarrel(ctx,(bar.x-camX)*ts+ts/2,(bar.y-camY)*ts+ts/2,ts);
  });

  // shopkeeper
  if(G.shop && G.shop.x>=camX && G.shop.y>=camY && G.shop.x<camX+vw && G.shop.y<camY+vh){
   drawShopkeeper(ctx,(G.shop.x-camX)*ts+ts/2,(G.shop.y-camY)*ts+ts/2,ts);
  }

  // monsters
  drawDeaths(ctx,camX,camY,ts,vw,vh);
  G.monsters.forEach(m=>{
   if(m.x<camX||m.y<camY||m.x>=camX+vw||m.y>=camY+vh) return;
   drawMob(ctx,m,(m.x-camX)*ts+ts/2,(m.y-camY)*ts+ts/2,ts);
  });

  // boss
  if(G.boss && G.boss.x>=camX && G.boss.y>=camY && G.boss.x<camX+vw && G.boss.y<camY+vh){
   // a pool of torchlight under him, so a 2x2 body doesn't sink into the floor
   const bx=(G.boss.x-camX)*ts+ts/2, by=(G.boss.y-camY)*ts+ts/2;
   const pool=ctx.createRadialGradient(bx,by,ts*0.25,bx,by,ts*1.8);
   pool.addColorStop(0,b.torch+"2e"); pool.addColorStop(1,"rgba(0,0,0,0)");
   ctx.fillStyle=pool; ctx.fillRect(bx-ts*1.8,by-ts*1.8,ts*3.6,ts*3.6);
   drawMob(ctx,G.boss,(G.boss.x-camX)*ts+ts/2,(G.boss.y-camY)*ts+ts/2,ts);
  }

  // player
  const pSX=(G.px-camX)*ts, pSY=(G.py-camY)*ts;
  const pHurt=G.playerHit && Date.now()-G.playerHit<150;
  const pAtk=G.swing && Date.now()-G.swing<ATTACK_MS;
  if(pHurt){ const atk=nearestThreat(G.px,G.py); const dir=atk?dirAway(G.px,G.py,atk.x,atk.y):{x:0,y:-1}; ensureRecoil("player",G.playerHit,dir.x,dir.y); }
  else recoils.delete("player");
  if(pAtk){
   const tgt=G.combatTarget||nearestThreat(G.px,G.py);
   const d=tgt?dirAway(G.px,G.py,tgt.x,tgt.y):{x:0,y:-1};
   ensureLunge("player",G.swing,-d.x,-d.y);
  }
  const ro=recoilOffset("player",ts), lo=lungeOffset("player",ts);
  drawPlayer(ctx,pSX+ts/2,pSY+ts/2,ts,pHurt,ro.x+lo.x,ro.y+lo.y,pAtk);

  if(Delve.markVisited) Delve.markVisited(G.px,G.py);

  drawFloaters(ctx,camX,camY,ts);

  // a faint per-biome colour wash, then the vignette
  if(b.light){ ctx.fillStyle=b.light; ctx.fillRect(0,0,W,H); }

  const vig=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.8);
  vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.45)");
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
  ctx.restore();

  if(G.msg && Date.now()<G.msgUntil){
   ctx.font="700 16px system-ui, sans-serif"; ctx.textAlign="center"; ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillText(G.msg,W/2+1,H-45); ctx.fillStyle="#eafff5"; ctx.fillText(G.msg,W/2,H-46);
  }
 };

 // Short corpse fade: shrink a little, sink a little, fade out. A death belonging to a
// different floor is skipped outright, so a corpse from the previous floor can never ghost
// onto a new one — cheaper and safer than clearing the list on every descend.
 function drawDeaths(ctx, camX, camY, ts, vw, vh){
  if(!deaths.length) return;
  const now=Date.now(), alive=[];
  const gf = (Delve.G && Delve.G.floor) || 1;
  deaths.forEach(function(d){
   const age=now-d.born; if(age>=DEATH_LIFE) return;
   if(d.floor!==gf) return;
   if(d.x<camX||d.y<camY||d.x>=camX+vw||d.y>=camY+vh) return;
   const t=age/DEATH_LIFE, s=1-0.35*t, slump=ts*0.22*t;
   const cx=(d.x-camX)*ts+ts*0.5, cy=(d.y-camY)*ts+ts*0.5;
   ctx.save();
   ctx.globalAlpha=1-t;
   ctx.translate(cx,cy); ctx.scale(s,s); ctx.translate(-cx,-cy);
   drawSprite(ctx, d.kind, cx, cy+slump, ts, false, d.elite, false, d.size);
   ctx.restore();
   alive.push(d);
  });
  deaths = alive;
 }

 function drawFloaters(ctx, camX, camY, ts){
  const now=Date.now(), alive=[];
  floaters.forEach(f=>{
   const age=now-f.born; if(age>=FLOAT_LIFE) return;
   const t=age/FLOAT_LIFE; const alpha=t<0.15?t/0.15:1-((t-0.15)/0.85); const rise=t*ts*2.2;
   const sx=(f.x-camX)*ts+ts*0.5, sy=(f.y-camY)*ts-rise;
   ctx.save(); ctx.globalAlpha=alpha; ctx.font="700 "+Math.round(Math.max(11,ts*0.32*(f.sc||1)))+"px system-ui, sans-serif"; ctx.textAlign="center";
   ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillText(f.txt,sx+1,sy+1); ctx.fillStyle=f.col; ctx.fillText(f.txt,sx,sy); ctx.restore();
   alive.push(f);
  });
  floaters=alive;
 }

 function blendHex(hex,hex2,t){
  const p=c=>parseInt(c,16);
  const r1=p(hex.slice(1,3)),g1=p(hex.slice(3,5)),b1=p(hex.slice(5,7));
  const r2=p(hex2.slice(1,3)),g2=p(hex2.slice(3,5)),b2=p(hex2.slice(5,7));
  const r=Math.round(r1+(r2-r1)*t).toString(16).padStart(2,"0");
  const g=Math.round(g1+(g2-g1)*t).toString(16).padStart(2,"0");
  const b=Math.round(b1+(b2-b1)*t).toString(16).padStart(2,"0");
  return "#"+r+g+b;
 }

 // `sc` is an optional size multiplier — crits pass one so a crit reads as a bigger event.
 Delve.addFloater = function(txt,x,y,col,sc){
  while(floaters.length>=60) floaters.shift();
  const key=Math.round(x)+","+Math.round(y);
  const depth=floaterDepth.get(key)||0;
  const jx=(Math.random()-0.5)*0.45;
  floaters.push({txt, x:x+jx, y:y-depth*0.6, col, sc:sc||1, born:Date.now()});
  floaterDepth.set(key,depth+1);
  setTimeout(function(){ const d=floaterDepth.get(key)||0; if(d>1) floaterDepth.set(key,d-1); else floaterDepth.delete(key); },520);
 };
 // Called from killMonster for every monster and boss that dies (§Batch 15).
 Delve.addDeath = function(m){
  if(!m) return;
  while(deaths.length>=14) deaths.shift();
  deaths.push({
   kind:m.kind||"goblin", x:m.x, y:m.y, elite:!!m.elite, size:m.size||null,
   floor:(Delve.G && Delve.G.floor) || 1, born:Date.now()
  });
 };
 Delve.addShake = function(mag){ shakeMag=Math.max(shakeMag,mag); shakeT=6; };
 // Introspection hook for test.html: is this wall tile lit? (see arenaTorches)
 Delve.isTorchTile = isTorchTile;

 // ── ANIMATION CLOCK ──────────────────────────────────────────
 // One timer for everything that moves: torches flicker, lunges and floaters play
 // out. It redraws only while something is genuinely animating,
 // and it stops entirely while the tab is hidden — a phone in a pocket shouldn't
 // be redrawing a dungeon. Raise ANIM_MS if a device runs warm.
 const ANIM_MS = 150;
 let animTick = 0;
 function animating(){
  const G = Delve.G;
  if(!G) return false;
  if(floaters.length || shakeT > 0) return true;
  if(deaths.length) return true;                                  // corpse fades (§Batch 15)
  if(G.hitStopUntil && Date.now() < G.hitStopUntil) return true;  // a frozen impact frame
  if(lunges.size || recoils.size) return true;
  if(G.swing && Date.now()-G.swing < ATTACK_MS) return true;
  if(G.playerHit && Date.now()-G.playerHit < ATTACK_MS*2) return true;
  if(attacking(G.boss)) return true;
  for(const m of (G.monsters || [])){ if(attacking(m)) return true; }
  return false;
 }
 setInterval(function(){
  if(document.hidden) return;
  torchFrame=(torchFrame+1)%3;
  animTick++;
  if(Delve.G && !Delve.G.dead && (animating() || animTick%3===0)) Delve.draw();
 }, ANIM_MS);

})();
