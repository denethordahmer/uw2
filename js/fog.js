window.Delve = window.Delve || {};
(function(){
 const C = () => Delve.CONFIG;

 // fog.js : per-room fog of war.
 //
 // The rule, in the owner's words: a room is DARK until you set foot in it, and
 // then it stops being dark. Not a slow fade, not a widening circle — the whole
 // room lights at once, the moment you step inside it.
 //
 // The other rule: the game smooths its square grid away everywhere else, so the
 // fog must never put a grid back. Nothing here draws a per-tile square. Each
 // revealed room is ONE soft-edged blob, and the corridor you are walking is a
 // chain of overlapping round pools that merge into a tunnel. The mask is built
 // on an offscreen canvas and cut with `destination-out`, so the darkness is a
 // single sheet with soft holes rather than a grid of tiles.
 //
 // What stays dark:
 //  · a room you have not entered yet — including its monsters, chests and loot;
 //  · corridor you have never walked.
 // What lights up:
 //  · any room you have entered, permanently, for the rest of the floor;
 //  · a small pool around you, so a corridor is walkable before you commit;
 //  · the corridor behind you, kept faintly lit as a trail.
 //
 // Nothing here touches the grid, the save, or a monster's position.

 let mask = null, maskW = 0, maskH = 0;
 let builtKey = "";

 function cfg(){
  const f = C() && C().FOG;
  return f || { enabled:true, darkness:0.95, lantern:3.4, soften:18, trail:true };
 }

 function roomsOf(G){ return (G && G.rooms) || []; }

 // Fog is off on a boss floor: the arena is one chamber, and hiding it would
 // only hide the thing you came to fight. `G.fogAll` is the escape hatch a test
 // or a debug run can set to light a whole floor.
 function fogOff(G){
  if(!G) return true;
  if(G.floorType === "boss") return true;
  if(G.fogAll) return true;
  return false;
 }

 // The room whose interior holds a tile, or null in a corridor.
 function roomIndexAt(G, x, y){
  const rs = roomsOf(G);
  for(let i = 0; i < rs.length; i++){
   const r = rs[i];
   if(!r) continue;
   if(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
 }

 // Called once per draw. Reveals the room the player is standing in and records
 // the corridor trail. Both are cheap and idempotent.
 Delve.fogReveal = function(){
  const G = Delve.G;
  if(!G) return;
  const f = cfg();
  if(!f.enabled) return;
  if(fogOff(G)) return;

  if(!G.fogSeen) G.fogSeen = [];
  if(!G.fogTrail) G.fogTrail = [];

  // A room lights the instant any part of the player's tile is inside it.
  const idx = roomIndexAt(G, G.px, G.py);
  if(idx >= 0 && !G.fogSeen[idx]) G.fogSeen[idx] = true;

  // Corridor memory: one light point every other tile, so a walked corridor
  // reads as a tunnel rather than a dotted line.
  const last = G.fogTrail[G.fogTrail.length - 1];
  if(!last || (last.x !== G.px || last.y !== G.py)){
   if(!last || Math.abs(last.x - G.px) + Math.abs(last.y - G.py) >= 1){
    G.fogTrail.push({ x:G.px, y:G.py });
    if(G.fogTrail.length > 400) G.fogTrail.shift();
   }
  }
 };

 // Is a tile lit right now? Tests use this; drawing uses the mask, not this.
 Delve.tileLit = function(x, y){
  const G = Delve.G;
  if(!G) return false;
  const f = cfg();
  if(!f.enabled || fogOff(G)) return true;
  const idx = roomIndexAt(G, x, y);
  if(idx >= 0) return !!(G.fogSeen && G.fogSeen[idx]);
  return Delve.mdist(x, y, G.px, G.py) <= f.lantern + 1;
 };

 function roundRect(m, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  m.beginPath();
  m.moveTo(x + rr, y);
  m.lineTo(x + w - rr, y);
  m.quadraticCurveTo(x + w, y, x + w, y + rr);
  m.lineTo(x + w, y + h - rr);
  m.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  m.lineTo(x + rr, y + h);
  m.quadraticCurveTo(x, y + h, x, y + h - rr);
  m.lineTo(x, y + rr);
  m.quadraticCurveTo(x, y, x + rr, y);
  m.closePath();
 }

 Delve.drawFog = function(ctx, camX, camY, ts, vw, vh){
  const G = Delve.G;
  if(!G || !G.grid) return;
  const f = cfg();
  if(!f.enabled || fogOff(G)) return;

  const W = Delve.W, H = Delve.H;
  if(!W || !H || !ts) return;

  if(!mask || maskW !== W || maskH !== H){
   mask = document.createElement("canvas");
   mask.width = W;
   mask.height = H;
   maskW = W; maskH = H;
   builtKey = "";
  }

  // Rebuild only when something that shapes the mask has changed: the player's
  // tile, the camera, the tile size, or a newly revealed room. Everything else
  // is one drawImage of the cached mask, which is what keeps this cheap on a
  // phone.
  const seenCount = (G.fogSeen || []).filter(Boolean).length;
  const trailLen = (G.fogTrail || []).length;
  const key = G.floor + "|" + G.px + "," + G.py + "|" + camX + "," + camY + "|" + ts + "|" + seenCount + "|" + trailLen;

  if(key !== builtKey && mask){
   buildMask(mask, G, camX, camY, ts, f);
   builtKey = key;
  }

  ctx.drawImage(mask, -2, -2, W + 4, H + 4);
 };

 function buildMask(mask, G, camX, camY, ts, f){
  const W = mask.width, H = mask.height;
  const m = mask.getContext("2d");
  if(!m) return;

  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = "source-over";
  m.globalAlpha = 1;
  m.clearRect(0, 0, W, H);
  m.fillStyle = "rgba(3,5,8," + f.darkness + ")";
  m.fillRect(0, 0, W, H);

  // `filter` blurs the edge cleanly on desktop, but Chromium on Android does not
  // honour it together with `destination-out` — the cut-outs silently vanish and
  // the player sees an all-black screen (the owner hit exactly this twice). So
  // the blur is never used; the soft edge comes from three nested shapes at
  // decreasing alpha, which is plain compositing and behaves everywhere.
  m.globalCompositeOperation = "destination-out";
  const SOFT_STEPS = [
   { grow: 1.00, alpha: 0.55 },
   { grow: 0.55, alpha: 0.75 },
   { grow: 0.22, alpha: 1.00 }
  ];

  const punchShape = function(x, y, w, h, r){
   roundRect(m, x, y, w, h, r);
   m.fillStyle = "#000";
   m.fill();
  };

  // Three nested alpha steps read as a feathered edge without any filter.
  const punchSoft = function(x, y, w, h, r, pad){
   for(const s of SOFT_STEPS){
    const gx = pad * s.grow;
    m.globalAlpha = s.alpha;
    punchShape(x - gx, y - gx, w + gx * 2, h + gx * 2, r + gx);
   }
   m.globalAlpha = 1;
  };

  // Corridor trail first, so rooms sit on top of it without a seam.
  if(f.trail !== false && G.fogTrail){
   const rad = ts * 1.15;
   for(const p of G.fogTrail){
    const cx = (p.x - camX) * ts + ts / 2;
    const cy = (p.y - camY) * ts + ts / 2;
    if(cx < -rad || cy < -rad || cx > W + rad || cy > H + rad) continue;
    m.beginPath();
    m.arc(cx, cy, rad, 0, Math.PI * 2);
    m.fillStyle = "#000";
    m.fill();
   }
  }

  // Revealed rooms: one blob each, padded so the wall ring is lit with the room.
  const pad = ts * 1.15;
  const rooms = roomsOf(G);
  for(let i = 0; i < rooms.length; i++){
   const r = rooms[i];
   if(!r || !(G.fogSeen && G.fogSeen[i])) continue;
   const x = (r.x - camX) * ts - pad;
   const y = (r.y - camY) * ts - pad;
   const w = r.w * ts + pad * 2;
   const h = r.h * ts + pad * 2;
   if(x > W + pad || y > H + pad || x + w < -pad || y + h < -pad) continue;
   punchSoft(x, y, w, h, Math.min(w, h) * 0.14, ts * 0.55);
  }

  // The pool around the player. Round, never square, so a corridor bends
  // smoothly instead of showing tile corners.
  const pcx = (G.px - camX) * ts + ts / 2;
  const pcy = (G.py - camY) * ts + ts / 2;
  const rad = (f.lantern || 3.4) * ts;
  const g = m.createRadialGradient(pcx, pcy, rad * 0.35, pcx, pcy, rad);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.65, "rgba(0,0,0,0.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  m.fillStyle = g;
  m.beginPath();
  m.arc(pcx, pcy, rad, 0, Math.PI * 2);
  m.fill();

  m.globalAlpha = 1;
  m.globalCompositeOperation = "source-over";
 }

})();
