window.Delve = window.Delve || {};
(function(){

 // ── puddles.js ───────────────────────────────────────────────
 // Wall-anchored puddles. Water is no longer a cellular-automaton patch: every
 // WATER tile belongs to a lobed blob that sits against a wall. Two public seams:
 //
 //   Delve.placePuddles(G)                              — end of genFloor
 //   Delve.drawPuddleTile(ctx, sx, sy, ts, gx, gy, b)   — the tile pass
 //
 // A puddle is one lobed blob anchored at the wall. Placement marks every tile
 // whose 16x16 sample cells the blob touches, so the painted water can never
 // spill onto dry stone; the renderer evaluates the same blob per tile, which
 // is why neighbouring tiles meet without a seam. Nothing here touches the
 // grid except the WATER tiles themselves, so movement, taps, the minimap and
 // the run checkpoint behave exactly as they did.

 const T = function(){ return Delve.T; };
 const PX = 16;             // sample cells per tile, same grain as js/growth/
 const MIN_LEAKS = 2, MAX_LEAKS = 4;
 const MIN_R = 1.30, MAX_R = 1.90;

 // ── deterministic shape field ────────────────────────────────
 function smooth(t){ return t*t*(3-2*t); }
 function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = Delve.hash2(xi, yi),     b = Delve.hash2(xi + 1, yi);
  const c = Delve.hash2(xi, yi + 1), d = Delve.hash2(xi + 1, yi + 1);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fy;
 }

 // Radius of the blob in a given direction: a soft circle with three harmonics
 // (the puddle's lobes) plus a fine world-space wobble at roughly half a tile.
 function puddleRadius(p, wx, wy){
  const dx = wx - p.cx, dy = wy - p.cy;
  const ang = Math.atan2(dy, dx);
  const s = p.seed;
  const lobes = 1
   + 0.13 * Math.sin(ang * 3 + (s % 997) * 0.010)
   + 0.07 * Math.sin(ang * 5 + (s % 631) * 0.013)
   + 0.05 * Math.sin(ang * 2 + (s % 487) * 0.017);
  const n = vnoise(wx * 1.55 + (s % 89) * 0.37, wy * 1.55 + (s % 67) * 0.53) - 0.5;
  return p.r * lobes + n * 0.18;
 }
 function inside(p, wx, wy){
  const dx = wx - p.cx, dy = wy - p.cy;
  return Math.hypot(dx, dy) < puddleRadius(p, wx, wy);
 }

 // ── placement ────────────────────────────────────────────────
 // Leads a puddle out of one wall tile and into the floor in front of it.
 function eligible(G, x, y, taken){
  const grid = G.grid;
  const v = grid[y] ? grid[y][x] : undefined;
  if(v !== T().FLOOR && v !== T().GRASS) return false;
  if(Delve.mdist(x, y, G.px, G.py) <= 2) return false;          // keep spawn dry
  if(G.shop && G.shop.x >= 0 &&
     Math.max(Math.abs(x - G.shop.x), Math.abs(y - G.shop.y)) <= 1) return false;
  if(taken[x + "," + y]) return false;
  // one dry tile between puddles, so two leaks can never merge into one pool
  for(let oy = -1; oy <= 1; oy++){
   for(let ox = -1; ox <= 1; ox++){
    if(taken[(x + ox) + "," + (y + oy)]) return false;
   }
  }
  return true;
 }

 function component(tiles, mx, my){
  const map = {};
  tiles.forEach(function(t){ map[t.x + "," + t.y] = t; });
  if(!map[mx + "," + my]) return null;
  const seen = {}, q = [map[mx + "," + my]], out = [];
  seen[mx + "," + my] = 1;
  while(q.length){
   const t = q.pop(); out.push(t);
   const nb = [[1,0],[-1,0],[0,1],[0,-1]];
   for(let k = 0; k < 4; k++){
    const key = (t.x + nb[k][0]) + "," + (t.y + nb[k][1]);
    if(map[key] && !seen[key]){ seen[key] = 1; q.push(map[key]); }
   }
  }
  return out;
 }

 // nearest / farthest distance from a point to a tile square, in tiles
 function nearDist(cx, cy, tx, ty){
  const dx = Math.max(tx - cx, 0, cx - (tx + 1));
  const dy = Math.max(ty - cy, 0, cy - (ty + 1));
  return Math.hypot(dx, dy);
 }
 function farDist(cx, cy, tx, ty){
  const dx = Math.max(Math.abs(cx - tx), Math.abs(cx - (tx + 1)));
  const dy = Math.max(Math.abs(cy - ty), Math.abs(cy - (ty + 1)));
  return Math.hypot(dx, dy);
 }

 function blobTiles(G, p, taken){
  const raw = [];
  let blocked = false;
  const reach = p.reach;
  const x0 = Math.floor(p.cx - reach), x1 = Math.ceil(p.cx + reach);
  const y0 = Math.floor(p.cy - reach), y1 = Math.ceil(p.cy + reach);
  for(let ty = y0; ty <= y1; ty++){
   for(let tx = x0; tx <= x1; tx++){
    if(!G.grid[ty] || G.grid[ty][tx] === undefined) continue;
    if(nearDist(p.cx, p.cy, tx, ty) > p.maxR) continue;
    let wet = false;
    // A tile entirely inside the smallest possible radius is fully wet; one
    // beyond the largest possible radius is fully dry. Only the shoreline
    // between those two needs the per-cell test — exact, but far cheaper.
    if(farDist(p.cx, p.cy, tx, ty) < p.minR){
     wet = true;
    } else {
     for(let j = 0; j < PX && !wet; j++){
      for(let i = 0; i < PX; i++){
       if(inside(p, tx + (i + 0.5) / PX, ty + (j + 0.5) / PX)){ wet = true; break; }
      }
     }
    }
    if(!wet) continue;
    const v = G.grid[ty][tx];
    // the blob may run into the wall; nothing there is drawn
    if(v === T().WALL || v === T().VOID) continue;
    // a chest, barrel, stair or door must never end up as a dry island in a pool
    if(v !== T().FLOOR && v !== T().GRASS){ blocked = true; continue; }
    raw.push({ x:tx, y:ty });
   }
  }
  if(blocked) return null;
  // Trim to the room the puddle opens into: a blob that pokes through a thin
  // wall into the next room keeps only the half on the anchor's side.
  const comp = component(raw, p.mx, p.my);
  if(!comp || comp.length < 2) return null;
  for(let i = 0; i < comp.length; i++){
   if(!eligible(G, comp[i].x, comp[i].y, taken)) return null;
  }
  return comp;
 }

 Delve.placePuddles = function(G){
  if(!G || !G.grid || !G.grid.length) return;
  G.puddles = [];
  const ward = Delve.getWard ? Delve.getWard(G.floor) : null;
  if(ward && ward.puddles === false) return;

  const grid = G.grid;
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  const cands = [];
  for(let y = 1; y < G.gridH - 1; y++){
   for(let x = 1; x < G.gridW - 1; x++){
    if(grid[y][x] !== T().WALL) continue;
    // never anchor a puddle at the secret room's false wall — the shimmer pulse is its only marker
    const secret = G.floorData && G.floorData.secretRoom;
    if(secret && x === secret.falseWallX && y === secret.falseWallY) continue;
    // a brazier is a wall over open floor with this hash roll; never anchor a puddle there
    const below = grid[y + 1] && grid[y + 1][x];
    const openBelow = below !== undefined && below !== null &&
                      below !== T().WALL && below !== T().VOID;
    if(openBelow && Delve.hash3(x, y, 137) < 0.05) continue;
    for(let d = 0; d < 4; d++){
     const dx = dirs[d][0], dy = dirs[d][1];
     const fx = x + dx, fy = y + dy;
     if(!grid[fy] || grid[fy][fx] !== T().FLOOR) continue;
     if(Delve.mdist(fx, fy, G.px, G.py) <= 2) continue;
     cands.push({ x:x, y:y, dx:dx, dy:dy, fx:fx, fy:fy });
    }
   }
  }
  if(!cands.length) return;

  for(let i = cands.length - 1; i > 0; i--){
   const j = Math.floor(Math.random() * (i + 1));
   const tmp = cands[i]; cands[i] = cands[j]; cands[j] = tmp;
  }

  const want = Delve.rng(MIN_LEAKS, MAX_LEAKS);
  const taken = {};
  for(let c = 0; c < cands.length && G.puddles.length < want; c++){
   const a = cands[c];
   if(grid[a.y][a.x] !== T().WALL) continue;
   // Three size attempts: the first draws a small puddle; if the room is too
   // tight for it, the next two try slightly smaller ones before giving up.
   for(let tries = 0; tries < 3; tries++){
    const r = (MIN_R + Math.random() * (MAX_R - MIN_R)) * (1 - tries * 0.10);
    const p = {
     cx: a.fx + 0.5,
     cy: a.fy + 0.5,
     r: r,
     seed: Delve.rng(1, 999999),
     mx: a.fx, my: a.fy
    };
    p.minR = p.r * 0.75 - 0.09;
    p.maxR = p.r * 1.25 + 0.09;
    p.reach = p.maxR + 0.05;
    const tiles = blobTiles(G, p, taken);
    if(!tiles) continue;
    tiles.forEach(function(t){
     grid[t.y][t.x] = T().WATER;
     taken[t.x + "," + t.y] = 1;
    });
    G.puddles.push(p);
    break;
   }
  }
 };

 // ── water painting ───────────────────────────────────────────
 let cacheKey = "", cacheCols = null;
 function hexRGB(h){
  h = (h || "#000000").replace("#", "");
  if(h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if(h.length > 6) h = h.slice(0, 6);
  const v = parseInt(h, 16) || 0;
  return [ (v >> 16) & 255, (v >> 8) & 255, v & 255 ];
 }
 function mix(a, b, t){
  const A = hexRGB(a), B = hexRGB(b);
  return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," +
                  Math.round(A[1] + (B[1] - A[1]) * t) + "," +
                  Math.round(A[2] + (B[2] - A[2]) * t) + ")";
 }
 function bands(pw){
  if(pw === cacheKey) return cacheCols;
  cacheKey = pw;
  cacheCols = [
   mix(pw, "#04070a", 0.42),   // sunken contact edge
   mix(pw, "#ffffff", 0.16),   // shallow lip
   pw,                         // body
   mix(pw, "#04070a", 0.20)    // deeper middle
  ];
  return cacheCols;
 }

 function glint(ctx, sx, sy, ts, gx, gy, p, wx, wy){
  const d = Math.hypot(wx - p.cx, wy - p.cy);
  if(puddleRadius(p, wx, wy) - d < 0.14) return;   // never float on the shore
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(sx + (wx - gx) * ts, sy + (wy - gy) * ts, ts * 0.085, ts * 0.042, 0, 0, Math.PI * 2);
  ctx.fill();
 }

 function drawPart(ctx, sx, sy, ts, gx, gy, p, win){
  const N = PX, cellW = ts / N;
  const cols = bands(win);
  const alpha = [0.92, 0.80, 0.86, 0.90];
  let any = false;
  ctx.save();
  for(let j = 0; j < N; j++){
   let start = -1, band = -1;
   for(let i = 0; i <= N; i++){
    let nb = -1;
    if(i < N){
     const wx = gx + (i + 0.5) / N, wy = gy + (j + 0.5) / N;
     const d = Math.hypot(wx - p.cx, wy - p.cy);
     const m = puddleRadius(p, wx, wy) - d;
     if(m > 0) nb = (m < 0.030 ? 0 : m < 0.110 ? 1 : (d < p.r * 0.52 ? 3 : 2));
    }
    if(nb !== band){
     if(band >= 0 && i > start){
      const px0 = Math.round(start * cellW), px1 = Math.round(i * cellW);
      const py0 = Math.round(j * cellW), py1 = Math.round((j + 1) * cellW);
      ctx.globalAlpha = alpha[band];
      ctx.fillStyle = cols[band];
      ctx.fillRect(sx + px0, sy + py0, Math.max(1, px1 - px0), Math.max(1, py1 - py0));
      any = true;
     }
     start = i; band = nb;
    }
   }
  }
  ctx.restore();
  if(any){
   // two quiet highlights, placed only where the puddle is genuinely wet
   const h1 = Delve.hash2(gx * 17 + 3, gy * 13 + 7);
   glint(ctx, sx, sy, ts, gx, gy, p,
         gx + 0.24 + h1 * 0.48, gy + 0.26 + Delve.hash3(gx, gy, 401) * 0.40);
   if(Delve.hash3(gx, gy, 409) < 0.55){
    glint(ctx, sx, sy, ts, gx, gy, p,
          gx + 0.52 + Delve.hash3(gx, gy, 419) * 0.30,
          gy + 0.58 + Delve.hash3(gx, gy, 421) * 0.24);
   }
  }
  return any;
 }

 Delve.drawPuddleTile = function(ctx, sx, sy, ts, gx, gy, b){
  const G = Delve.G;
  if(!G) return;
  const list = G.puddles || [];
  const pw = b.patchWater || b.water || "#1e3a4a";
  let drew = false;
  for(let k = 0; k < list.length; k++){
   const p = list[k];
   if(gx + 1 < p.cx - p.reach || gx > p.cx + p.reach) continue;
   if(gy + 1 < p.cy - p.reach || gy > p.cy + p.reach) continue;
   if(drawPart(ctx, sx, sy, ts, gx, gy, p, pw)) drew = true;
  }
  // A WATER tile with no puddle behind it should never exist; if one does
  // (older test fixture, manual grid edit), paint a plain rounded pool rather
  // than leaving invisible water.
  if(!drew){
   ctx.save();
   ctx.globalAlpha = 0.84;
   ctx.fillStyle = pw;
   const m = ts * 0.14;
   ctx.beginPath();
   ctx.roundRect(sx + m, sy + m, ts - m * 2, ts - m * 2, ts * 0.30);
   ctx.fill();
   ctx.restore();
  }
 };

})();
