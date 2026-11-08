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

 // ── the two styles ───────────────────────────────────────────
 Delve.puddleStyles = Delve.puddleStyles || {};
 // "water": the original blob. Rainwater: bright lipped, sparkles on the surface,
 // 2-4 pools a floor. Unchanged, so wards 1-4 are untouched.
 Delve.puddleStyles.water = {
  minLeaks: MIN_LEAKS, maxLeaks: MAX_LEAKS, minR: MIN_R, maxR: MAX_R,
  radius: waterRadius,
  bands: function(pw){
   return [
    mix(pw, "#04070a", 0.42),   // sunken contact edge
    mix(pw, "#ffffff", 0.16),   // shallow lip
    pw,                         // body
    mix(pw, "#04070a", 0.20)    // deeper middle
   ];
  },
  alpha: [0.92, 0.80, 0.86, 0.90],
  finish: "glint"
 };

 // "blood" (The Ashen Forge): thick, dark, and pooled. The outline is WIDER and
 // FLATTER than a water puddle — it spreads under its own weight — with a ragged
 // torn edge rather than a lobed circle. No sparkles: the surface carries a dull
 // wet SHEEN instead, and the edge is a dark drying crust, so it reads as
 // something that congealed, not something reflecting the sky.
 Delve.puddleStyles.blood = {
  minLeaks: 2, maxLeaks: 3,
  minR: 1.55, maxR: 2.25,        // wider: it spreads
  radius: function(p, wx, wy){
   const dx = wx - p.cx, dy = wy - p.cy;
   const ang = Math.atan2(dy, dx);
   const s = p.seed;
   // Flatter spread: the blob is squashed along one axis (bias from the seed),
   // so pools are irregular ovals thrown out from the wall rather than circles.
   const squash = 0.72 + ((s % 53) / 53) * 0.34;
   const qx = dx, qy = dy / squash;
   const rr = Math.hypot(qx, qy);
   // Two slow harmonics + a sharper 7th: the 7th gives the torn, ragged fringe.
   const lobes = 1
    + 0.16 * Math.sin(ang * 2 + (s % 811) * 0.011)
    + 0.09 * Math.sin(ang * 3 + (s % 733) * 0.014)
    + 0.045 * Math.sin(ang * 7 + (s % 577) * 0.019);
   // Coarser noise than water -> ragged, not rippled.
   const n = vnoise(wx * 1.15 + (s % 97) * 0.41, wy * 1.15 + (s % 71) * 0.59) - 0.5;
   return p.r * lobes * Math.sqrt(squash) + n * 0.26;
  },
  bands: function(pw){
   return [
    mix(pw, "#14000a", 0.62),   // dried crust, nearly black
    mix(pw, "#2a0008", 0.34),   // clotted rim
    pw,                         // body
    mix(pw, "#1a0006", 0.44)    // thick centre, darker still
   ];
  },
  // Opaque, because blood is not translucent the way water is: you cannot see
  // the stone through it.
  alpha: [0.97, 0.94, 0.96, 0.97],
  finish: "sheen"
 };

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

 // ── PUDDLE STYLES ────────────────────────────────────────────
 // A biome names a style (BIOMES[n].puddleStyle). Each style owns THREE things:
 //   radius(p, wx, wy) — the outline, in world tiles
 //   bands(hex)        — the four colour bands, contact edge -> deep middle
 //   alpha             — per-band opacity
 //   glints            — "water" sparkles, or "sheen" for blood (see below)
 // plus the placement numbers (minR/maxR/leaks) so a blood pool can be wider and
 // flatter than a rainwater puddle. This exists because colour alone was not
 // enough: every ward's pool was the SAME lobed blob, so "blood" would have been
 // a red water puddle. A different outline and a different surface finish are
 // what make it read as something else.
 function puddleStyle(b){
  const id = (b && b.puddleStyle) || "water";
  return Delve.puddleStyles[id] || Delve.puddleStyles.water;
 }

 // Water: a soft circle with three harmonics plus a fine world-space wobble.
 function waterRadius(p, wx, wy){
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

 // The outline used by every painted tile. Resolved through the active style, so
 // the placement pass and the paint pass can never disagree about the shape.
 function puddleRadius(p, wx, wy){
  const st = p.style || Delve.puddleStyles.water;
  return st.radius(p, wx, wy);
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
  // The ward's biome names the puddle style (BIOMES[n].puddleStyle); anything
  // unknown falls back to "water", so a biome can never end up with NO pools.
  const bm = (Delve.CONFIG.BIOMES || [])[(ward && ward.biome) || 0] || {};
  const style = puddleStyle(bm);

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

  const want = Delve.rng(style.minLeaks, style.maxLeaks);
  const taken = {};
  for(let c = 0; c < cands.length && G.puddles.length < want; c++){
   const a = cands[c];
   if(grid[a.y][a.x] !== T().WALL) continue;
   // Three size attempts: the first draws a small puddle; if the room is too
   // tight for it, the next two try slightly smaller ones before giving up.
   for(let tries = 0; tries < 3; tries++){
    const r = (style.minR + Math.random() * (style.maxR - style.minR)) * (1 - tries * 0.10);
    const p = {
     cx: a.fx + 0.5,
     cy: a.fy + 0.5,
     r: r,
     seed: Delve.rng(1, 999999),
     mx: a.fx, my: a.fy,
     style: style            // carried on the puddle, so the painter and the
    };                        // outline test agree even if the ward lookup moves
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
 function bands(pw, style){
  const key = pw + "|" + (style && style.finish || "water");
  if(key === cacheKey) return cacheCols;
  cacheKey = key;
  cacheCols = (style || Delve.puddleStyles.water).bands(pw);
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
  const style = p.style || Delve.puddleStyles.water;
  const cols = bands(win, style);
  const alpha = style.alpha;
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
  // Surface finish. Water throws two small specular sparkles. Blood does NOT:
  // a bright point on a red pool reads as water, which is exactly the mistake
  // this style exists to avoid. Instead the surface gets one broad, soft, low
  // contrast sheen patch — wet, not reflective — placed on the thickest part.
  if(any){
   if(style.finish === "sheen"){
    const hx2 = gx + 0.30 + Delve.hash2(gx * 11 + 5, gy * 7 + 3) * 0.40;
    const hy2 = gy + 0.32 + Delve.hash3(gx, gy, 431) * 0.36;
    const d2 = Math.hypot(hx2 - p.cx, hy2 - p.cy);
    if(puddleRadius(p, hx2, hy2) - d2 > 0.18){
     ctx.save();
     const g2 = ctx.createRadialGradient(
       sx + (hx2 - gx) * ts, sy + (hy2 - gy) * ts, 1,
       sx + (hx2 - gx) * ts, sy + (hy2 - gy) * ts, ts * 0.26);
     g2.addColorStop(0, "rgba(255,150,150,0.16)");
     g2.addColorStop(0.55, "rgba(180,60,70,0.10)");
     g2.addColorStop(1, "rgba(0,0,0,0)");
     ctx.fillStyle = g2;
     ctx.beginPath();
     ctx.ellipse(sx + (hx2 - gx) * ts, sy + (hy2 - gy) * ts,
       ts * 0.30, ts * 0.17, 0.4, 0, Math.PI * 2);
     ctx.fill();
     ctx.restore();
    }
   } else {
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
   const fb = bands(pw, puddleStyle(b));
   ctx.save();
   ctx.globalAlpha = fb[2] ? 0.9 : 0.84;
   ctx.fillStyle = fb[2];
   const m = ts * 0.14;
   ctx.beginPath();
   ctx.roundRect(sx + m, sy + m, ts - m * 2, ts - m * 2, ts * 0.30);
   ctx.fill();
   ctx.restore();
  }
 };

})();
