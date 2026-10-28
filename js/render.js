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

 // ── TILE PAINTING (js/render/tiles.js) ───────────────────────
 // The offscreen tile cache, every per-tile painter and the seamless-floor
 // texture bakers now live in js/render/tiles.js (Phase 3). biome() went with
 // them, since the painters are its only callers besides draw() below. Both are
 // destructured into the same local names, so every call site here is unchanged.
 const biome = Delve.tiles.biome;
 const { tileAt, ensureCache, isTorchTile, blitTile, drawClutter,
         drawWallTile, drawWallShadows, drawWallTorch } = Delve.tiles;

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
  const col = Delve.TIERS.colors[it.tier] || "#fff";
  // Band halo first: rarity has to read from across the room, before pickup.
  ctx.save();
  ctx.globalAlpha = (it.unique || it.tier >= 4) ? 0.30 : (it.tier >= 3 ? 0.24 : 0.16);
  ctx.fillStyle = it.unique ? (Delve.uniqueAccent ? Delve.uniqueAccent(it.id) : col) : col;
  ctx.beginPath(); ctx.arc(cx, cy, ts*0.44, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  const spr = Delve.itemSprite ? Delve.itemSprite(it) : null;
  if(spr){
   const w = Math.round(ts*0.95), h = Math.round(ts*0.95);
   ctx.imageSmoothingEnabled = false;
   ctx.drawImage(spr, Math.round(cx - w/2), Math.round(cy - h/2), w, h);
  } else {
   drawWorldSprite(ctx, "itemPile", cx, cy, ts);
  }

  // A legendary / unique glints so it is never mistaken for scenery.
  if(it.unique || it.tier === 4){
   const t = (Date.now() % 1600) / 1600;
   const a = 0.35 + 0.45 * Math.abs(Math.sin(t * Math.PI * 2));
   ctx.save();
   ctx.globalAlpha = a;
   ctx.fillStyle = it.unique ? (Delve.uniqueAccent ? Delve.uniqueAccent(it.id) : "#fff") : "#fff8d0";
   ctx.fillRect(Math.round(cx + ts*0.15), Math.round(cy - ts*0.32), 2, 2);
   ctx.fillRect(Math.round(cx - ts*0.26), Math.round(cy + ts*0.10), 1, 1);
   ctx.restore();
  }
 }

 function drawBarrel(ctx, cx, cy, ts){ drawWorldSprite(ctx, "barrel", cx, cy, ts); }

 function drawChest(ctx, chest, cx, cy, ts){
  drawShadow(ctx, cx, cy, ts*0.5);
  // Sarcophagus tombs (Bone Ossuary) draw their own sealed/open art.
  if(chest.sarcophagus){ drawWorldSprite(ctx, chest.open ? "tombOpen" : "tombSealed", cx, cy, ts); return; }
  drawWorldSprite(ctx, chest.open ? "chestOpen" : "chestClosed", cx, cy, ts);
 }

 // Floor event (js/encounters.js): a low altar with a floating, pulsing rune.
 // Drawn as primitives, so a new event kind only needs an `accent` colour.
 function drawFloorEvent(ctx, ev, cx, cy, ts){
  const cfg = (Delve.CONFIG && Delve.CONFIG.FLOOR_EVENTS) || {};
  const def = (cfg.kinds || []).filter(function(k){ return k.id === ev.kind; })[0] || {};
  const accent = def.accent || "#7ee0ff";
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, ts*0.08, cx, cy, ts*0.95);
  glow.addColorStop(0, accent + "66");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - ts, cy - ts, ts*2, ts*2);
  // stone base
  ctx.fillStyle = "#2a3038";
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts*0.20, ts*0.34, ts*0.14, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#39424c";
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts*0.16, ts*0.26, ts*0.10, 0, 0, Math.PI*2);
  ctx.fill();
  // the rune
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy - ts*0.12, ts*0.12, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
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

  // floor event (js/encounters.js) — a prop on plain floor, never a tile
  if(G.floorEvent && !G.floorEvent.used &&
     G.floorEvent.x>=camX && G.floorEvent.y>=camY &&
     G.floorEvent.x<camX+vw && G.floorEvent.y<camY+vh){
   drawFloorEvent(ctx, G.floorEvent,
    (G.floorEvent.x-camX)*ts+ts/2, (G.floorEvent.y-camY)*ts+ts/2, ts);
  }

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

 // Defined once in js/util.js. Alias kept so existing call sites are untouched.
 const blendHex = Delve.blendHex;

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
  Delve.tiles.tickTorch();   // the torch flicker lives with the torch painter
  animTick++;
  if(Delve.G && !Delve.G.dead && (animating() || animTick%3===0)) Delve.draw();
 }, ANIM_MS);

})();
