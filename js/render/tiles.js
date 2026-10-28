window.Delve = window.Delve || {};
(function(){

 // ── render/tiles.js ──────────────────────────────────────────
 // The tile atlas: the offscreen per-tile cache, every per-tile painter (floor,
 // wall, door, stairs, torch, floor decoration) and the seamless-floor texture
 // bakers. Split out of render.js (Phase 3) by verbatim move — the painters are
 // unchanged character-for-character, only their enclosing file changed.
 // Depends on: Delve.hash2 / Delve.hash3 / Delve.getWard (state.js),
 //             Delve.rgbOf / Delve.mixRGB / Delve.blendHex (util.js),
 //             Delve.CONFIG.BIOMES (con-biomes.js),
 //             Delve._clutterFamilies (con-worldart.js).
 // Loads BEFORE render.js, which destructures Delve.tiles back into the same
 // local names, so no call site in render.js moved.

 const blendHex = Delve.blendHex;   // the painters below call it per tile

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
   // Seamless floor + linked growth (js/growth/). floorStyle "runningbond" = the
   // baked 3x3 torus masonry pattern instead of per-tile slabs; growthLinked = the
   // walls grow growth only where a floor patch touches them; growthPal = the
   // biome's locked green gradient (dark root → bright tip).
   floorStyle: b.floorStyle || null,
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
  // Size the offscreen tile to whole device pixels, then scale by the ACTUAL
  // ratio (canvasWidth / ts) rather than the raw devicePixelRatio. On screens
  // with a fractional DPR — common on Android, e.g. 2.625 or 2.75 — rounding
  // ts*dpr leaves the scaled drawing area a fraction wider/taller than the
  // canvas, so the tile never quite fills its own bitmap. Blitting that back
  // leaves a sub-pixel gap on every tile edge, which reads as a faint square
  // grid across the whole floor. Scaling by the exact ratio fills the canvas
  // edge to edge, so adjacent tiles meet with no seam at all.
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement("canvas");
  const pw = Math.max(1, Math.round(ts*dpr)), ph = Math.max(1, Math.round(ts*dpr));
  c.width = pw; c.height = ph;
  const cx = c.getContext("2d"); cx.scale(pw / ts, ph / ts);
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
  // Colour helpers are defined once in js/util.js; these aliases keep the many
  // call sites in this file reading exactly as they did.
  const rgbOf  = Delve.rgbOf;
  const mixRGB = Delve.mixRGB;

  // ── SEAMLESS FLOOR STYLES ─────────────────────────────────────
  // Every style here bakes a 48x48-pixel torus (= 3x3 tiles at 16px) and blits
  // 16x16 cells from it, so pattern edges continue across the tile seam and the
  // square grid never reads. "dirt" is the exception with no lattice at all —
  // periodic noise only, for biomes whose floor is earth rather than masonry.
  // A biome opts in with floorStyle:"<name>"; anything unknown keeps the old
  // per-tile slab look.
  const BOND_STYLES = { runningbond:true, dirt:true };

  // Exact 32-bit position hash for texture baking. Delve.hash3 (state.js) loses
  // precision on large float products and skews low for small integer inputs —
  // measured: every value it returned for salt 1409 landed between 0 and 0.46,
  // which flattened the dirt floor and killed the mycelium threads entirely.
  // Math.imul multiplies as true 32-bit ints, so the output is evenly spread.
  // Used ONLY by the organic styles below; the runningbond masonry keeps its
  // original hash so ward 1's locked-in look does not shift.
  function texHash(x, y, salt){
   let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1274126177);
   h = Math.imul(h ^ (h >>> 13), 1274126177);
   h = h ^ (h >>> 16);
   return (h >>> 0) / 4294967295;
  }

  // Periodic value noise on the S-pixel torus: N control points across the
  // repeat, smoothstep-interpolated and wrapped in both axes, so the field is
  // seamless no matter how it tiles.
  function periodicNoise(px, py, N, S, salt){
   const fx = (px / S) * N, fy = (py / S) * N;
   const x0 = Math.floor(fx), y0 = Math.floor(fy);
   const tx = fx - x0, ty = fy - y0;
   const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
   const v = function(a, b){ return texHash(((a % N) + N) % N, ((b % N) + N) % N, salt); };
   const a = v(x0, y0), b = v(x0 + 1, y0);
   const c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
   const top = a + (b - a) * sx, bot = c + (d - c) * sx;
   return top + (bot - top) * sy;
  }

  // Dirt / forest floor (The Blackvein): continuous soil, no seams, with pale
  // mycelium threads running through it. Two noise octaves give broad patches
  // and finer clumping; a third field crossing its midpoint draws the threads.
  function dirtPixel(px, py, S, floorA, floorB, thread){
   const n1 = periodicNoise(px, py, 6, S, 1409);    // broad soil patches
   const n2 = periodicNoise(px, py, 12, S, 1411);   // finer clumping
   const n3 = periodicNoise(px, py, 16, S, 1417);   // dry-earth flecks (16 divides 48)
   const grain = texHash(px, py, 1427) - 0.5;
   let t = n1 * 0.54 + n2 * 0.28 + grain * 0.12;
   t = Math.max(0, Math.min(1, t));
   let base = mixRGB(floorA, floorB, t);
   // a third octave lifts sparse patches toward dry, paler soil — this is what
   // breaks the banding a pure two-colour blend leaves behind
   if(n3 > 0.68) base = mixRGB(base, [132, 110, 74], (n3 - 0.68) * 1.4);
   // mycelium threads: pale filaments where the vein field crosses its midpoint
   const m = periodicNoise(px, py, 4, S, 1423);
   if(Math.abs(m - 0.5) < 0.011) base = mixRGB(base, thread || [196, 208, 150], 0.34);
   return base;
  }
  function bondTexture(b){
   const style = BOND_STYLES[b.floorStyle] ? b.floorStyle : "runningbond";
   const key = style + "|" + b.floor + "|" + b.floor2;
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
   // Style dispatch. "dirt" skips the lattice entirely and paints continuous
   // soil; every other style uses the interlocking masonry courses below.
   const COL_W = 8, ROW_H = 16;
   const isDirt = style === "dirt";
   const thread = b.moss ? rgbOf(b.moss) : [196, 208, 150];
   for(let py = 0; py < S; py++){
    for(let px = 0; px < S; px++){
     let col3;
     if(isDirt){
      // no seams anywhere — smooth earth with pale mycelium threads
      col3 = dirtPixel(px, py, S, floorA, floorB, thread);
     } else {
     const col = (px / COL_W) | 0;              // 0..5 across the torus
     const lx = px % COL_W;
     const shift = (col & 1) ? 8 : 0;           // stagger every other column
     const yy = (py + shift) % ROW_H;           // position in this column's course
     const period = ((py + shift) / ROW_H) | 0;
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
     }
     // fine weathered grain over everything, a few units of brightness either way.
     // Dirt uses the unbiased texHash; runningbond keeps its original grain so
     // ward 1's locked-in surface does not shift.
     const g = ((isDirt ? texHash(px, py, 1223) : hash3(px, py, 1223)) - 0.5) * 8;
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
   // Continuous large-scale tone — bilinear per position, so it drifts across
   // tiles without a step; this is what hides the 3x3 repeat from casual view.
   //
   // Dirt SKIPS this overlay entirely. floorTone is sampled once per tile centre
   // and then stamped as a flat fillRect across the whole tile, so each tile
   // becomes a hard-edged rectangle of a single alpha — neighbouring tiles get
   // different alphas and the boundary reads as a square grid. That rectangle is
   // exactly what this style exists to avoid. The dirt field already carries its
   // own multi-octave variation (broad patches, clumping, dry flecks, mycelium),
   // so the texture does its own shading and there is no per-tile rectangle to
   // see. Masonry keeps the overlay, byte for byte, so ward 1 is untouched.
   if(b.floorStyle !== "dirt"){
    const t = floorTone(gx, gy);
    ctx.save();
    ctx.globalAlpha = 0.05 + Math.abs(t - 0.5) * 0.22;
    ctx.fillStyle = t < 0.5 ? "#060a0e" : "#9fb2c4";
    ctx.fillRect(sx, sy, ts, ts);
    ctx.restore();
   }
  }
 function drawFloorTile(ctx, sx, sy, ts, gx, gy, b){
  const n = hash2(gx,gy), n3 = hash3(gx,gy,31), n4 = hash3(gx,gy,53);
  if(BOND_STYLES[b.floorStyle]){
   // B2) Seamless torus floor — runningbond masonry, or the organic "dirt"
   //     field. Either way the pattern is baked across a 3x3-tile torus and its
   //     edges continue into the neighbouring copies, so the floor reads as one
   //     continuous surface and the tile grid is invisible.
   drawBondFloor(ctx, sx, sy, ts, gx, gy, b);
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
  // the biome's own growth creeping over the top edge: lichen in the
  // Blackvein, frost in the Vault — colour comes from b.moss. A growthLinked
  // biome (the Upper Ruins) skips this: its walls only grow moss where a
  // floor patch touches them, painted by js/growth/core.js drawGrowthWalls instead.
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

 // ── PUBLIC SURFACE ───────────────────────────────────────────
 Delve.tiles = {
  biome: biome,
  tileAt: tileAt,
  ensureCache: ensureCache,
  isTorchTile: isTorchTile,
  blitTile: blitTile,
  drawClutter: drawClutter,
  drawWallTile: drawWallTile,
  drawWallShadows: drawWallShadows,
  drawWallTorch: drawWallTorch,
  // The torch flicker advances once per animation frame. render.js owns the
  // animation clock, so it ticks this rather than reaching into our state.
  tickTorch: function(){ torchFrame = (torchFrame + 1) % 3; },
  // Exposed for the render harness; render.js does not call these directly.
  _floorTone: floorTone, _texHash: texHash, _drawFloorTile: drawFloorTile,
  _drawWeed: drawWeed, _drawDoorTile: drawDoorTile,
  _drawGrassPatch: drawGrassPatch, _drawStairs: drawStairs
 };

})();
