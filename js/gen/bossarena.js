window.Delve = window.Delve || {};
(function(){

 // ── gen/bossarena.js : boss-floor layout + arena dressing ────
 // Lifted verbatim out of js/levels.js, so that file stays about the *dungeon*
 // generator (BSP rooms, special floors, spawns) while the bespoke boss floors
 // — a three-part vertical arena and the props dressed onto it — live here.
 //
 // Nothing here touches run state beyond the G it is handed: no save, no DOM.
 // Outward dependencies, all resolved at call time:
 //   Delve.T, Delve.CONFIG (DRESSING, BOSS_DEFS, bossHpBase/AtkBase/Speed)
 //   Delve.placeGroundCover, Delve.placeGrowth, Delve.logSystem
 // Every body below is a character-for-character copy of what was in levels.js.
 //
 // `Delve.genBossFloor` keeps its public name, so no call site had to move.
 // `dressBossArena` is exported on Delve.gen for levels.js to destructure back,
 // exactly as the BSP geometry already is.

 const C = function(){ return Delve.CONFIG; };

 Delve.gen = Delve.gen || {};

 // ── Boss floor: bespoke arena layout ─────────────────────────
 // A vertical three-part structure: a small entry chamber at the bottom where
 // the player spawns, a short narrow corridor leading north, and a large arena
 // chamber holding the boss. No monsters, no barrels, no chests, no stairs —
 // defeating the boss is the only exit, handled by the victory screen.
 //
 // Geometry is driven by the ward so future wards can vary it. Add an optional
 // `bossArena` block to a WARDS entry in con-biomes.js to override any of:
 //   { bossW, bossH, entryW, entryH, corridorW, pad }
 // Defaults scale with the ward's dungeonSize, so they work unmodified.
 // ── ARENA DRESSING ───────────────────────────────────────────
 // Decoration only. Props live in G.decor and are DRAWN, never written into the
 // grid, so they cannot block movement, be tapped, or show on the minimap.
 // Positions are derived from G.bossArena, so the engine owns *where* and a ward
 // only chooses *what* (CONFIG.DRESSING: which art fills each role). Placement is
 // position-based, never random, so the same floor always dresses identically.
 function dressBossArena(G, ward, boss, A){
  const T = Delve.T;
  const recipe = (C().DRESSING && C().DRESSING[ward && ward.id]) || null;
  if(!recipe || !A) return [];
  const out = [], used = {};
  const floorAt = function(x, y){ const g = G.grid; return !!(g[y] && g[y][x] === T.FLOOR); };
  const wallAt  = function(x, y){ const g = G.grid; return !!(g[y] && g[y][x] === T.WALL); };

  // Never dress the tiles the fight needs: the boss's art footprint, and the
  // tile the player arrives on.
  const blocked = {};
  const bw = (boss && boss.size && boss.size.w) || 1;
  const bh = (boss && boss.size && boss.size.h) || 1;
  if(boss){
   for(let y = boss.y - bh + 1; y <= boss.y; y++)
    for(let x = boss.x; x < boss.x + bw; x++) blocked[x + "," + y] = 1;
  }
  blocked[G.px + "," + G.py] = 1;

  const put = function(x, y, key, layer){
   if(!key) return;
   const k = x + "," + y;
   if(used[k]) return;
   if(blocked[k]) return;
   if(x <= 0 || y <= 0 || x >= G.gridW - 1 || y >= G.gridH - 1) return;
   if(layer === "wall"){ if(!wallAt(x, y)) return; }
   else if(!floorAt(x, y)) return;
   used[k] = 1;
   out.push({ x:x, y:y, key:key, layer:layer });
  };

  // pillars at the chamber's four inner corners
  [A.bossX + 1, A.bossX + A.bossW - 2].forEach(function(px){
   [A.bossY + 1, A.bossY + A.bossH - 2].forEach(function(py){
    put(px, py, recipe.pillar, "floor");
   });
  });

  // banners and a hanging piece across the chamber's back wall. The columns are
  // chosen to fall BETWEEN the braziers render.js derives (arenaTorches), so a
  // prop never covers a torch.
  put(A.bossX + Math.floor(A.bossW * 0.25), A.bossY - 1, recipe.banner, "wall");
  put(A.bossX + Math.floor(A.bossW * 0.75), A.bossY - 1, recipe.banner, "wall");
  put(A.bossX + Math.floor(A.bossW * 0.40), A.bossY - 1, recipe.wallBit, "wall");

  // hanging pieces on both side walls (rows well clear of the brazier rows),
  // and one on each wall of the approach corridor
  put(A.bossX - 1, A.bossY + 1, recipe.wallBit, "wall");
  put(A.bossX + A.bossW, A.bossY + A.bossH - 3, recipe.wallBit, "wall");
  const corrMid = A.corrTop + Math.floor(A.corrH * 0.5);
  put(A.corrX - 1, corrMid, recipe.wallBit, "wall");
  put(A.corrX + A.corrW, corrMid, recipe.wallBit, "wall");

  // debris and remains along the chamber walls: every third tile, alternating
  // rubble and bones, skipping anything the guards above refuse
  const lastRow = A.bossY + A.bossH - 2;
  for(let x = A.bossX + 1; x < A.bossX + A.bossW - 1; x += 3){
   put(x, lastRow, ((x - A.bossX) % 6 === 1) ? recipe.bone : recipe.rubble, "floor");
   put(x, A.bossY + 1, ((x - A.bossX) % 6 === 1) ? recipe.rubble : recipe.bone, "floor");
  }
  const lastCol = A.bossX + A.bossW - 2;
  for(let y = A.bossY + 3; y < lastRow; y += 3){
   put(A.bossX + 1, y, ((y - A.bossY) % 6 === 0) ? recipe.bone : recipe.rubble, "floor");
   put(lastCol, y, ((y - A.bossY) % 6 === 0) ? recipe.rubble : recipe.bone, "floor");
  }

  // a feature either side of the way in, so the entrance frames itself
  put(A.corrX - 1, A.bossY + A.bossH - 1, recipe.cluster, "floor");
  put(A.corrX + A.corrW, A.bossY + A.bossH - 1, recipe.cluster, "floor");

  // and something in the entry chamber, so arriving isn't bare
  put(A.entryX + 1, A.entryY + 1, recipe.bone, "floor");
  put(A.entryX + A.entryW - 2, A.entryY + 1, recipe.rubble, "floor");

  return out;
 }

 Delve.genBossFloor = function(G, ward){
  const t = Delve.T;
  const cfg = C();
  const w = G.gridW, h = G.gridH;
  const tune = (ward && ward.bossArena) || {};

  const carve = function(x, y, cw, ch){
   for(let yy = y; yy < y + ch; yy++){
    if(yy < 1 || yy > h - 2) continue;
    for(let xx = x; xx < x + cw; xx++){
     if(xx < 1 || xx > w - 2) continue;
     G.grid[yy][xx] = t.FLOOR;
    }
   }
  };
  const centred = function(span, used){ return Math.round((span - used) / 2); };

  const pad = tune.pad || 2;
  const maxW = w - pad * 2;
  const maxH = h - pad * 2;

  const bossW  = Math.min(maxW, tune.bossW  || Math.floor(w * 0.62));
  const bossH  = Math.min(maxH, tune.bossH  || Math.floor(h * 0.40));
  const entryW = Math.min(maxW, tune.entryW || Math.floor(w * 0.34));
  const entryH = Math.min(maxH, tune.entryH || Math.floor(h * 0.22));
  const corrW  = Math.min(maxW, tune.corridorW || 3);

  const bossX  = centred(w, bossW);
  const bossY  = pad;
  const entryX = centred(w, entryW);
  const entryY = h - pad - entryH;
  const corrX  = centred(w, corrW);
  const corrTop = bossY + bossH;
  const corrH  = Math.max(1, entryY - corrTop);

  // carve south→north so the three pieces meet without gaps
  carve(entryX, entryY, entryW, entryH);
  carve(corrX,  corrTop, corrW, corrH);
  carve(bossX,  bossY,  bossW,  bossH);

  // player spawns in the entry chamber, facing the corridor
  G.px = entryX + Math.floor(entryW / 2);
  G.py = entryY + Math.floor(entryH / 2);
  G.lastDir = "up";

  // boss holds the centre of the arena
  const bx = bossX + Math.floor(bossW / 2);
  const by = bossY + Math.floor(bossH / 2);
  const bossDef = cfg.BOSS_DEFS[Math.ceil(G.floor / 10)] || cfg.BOSS_DEFS[1] || {};
  G.boss = {
   id:"boss", isBoss:true, x:bx, y:by,
   name:bossDef.name || "The Warden", kind:bossDef.sprite || "boss_warden",
   maxHp:bossDef.hp || cfg.bossHpBase, hp:bossDef.hp || cfg.bossHpBase,
   atk:bossDef.atk || cfg.bossAtkBase,
   speed:bossDef.speed || cfg.bossSpeed,
   chainHitEvery:bossDef.chainHitEvery || 3, chainHitCount:0,
   // Boss shield (Batch 18): the Bonefather's ribcage soaks damage first and
   // never regrows. spriteOpen is the Act-2 form render.js swaps to.
   shieldHp:bossDef.shieldHp || 0, shieldBroken:false,
   spriteOpen:bossDef.spriteOpen || null,
   size:bossDef.size || { w:1, h:1 },   // tiles its art covers (own tile = bottom-left)
   effects:[], elite:false, hasActed:false
  };
  G.grid[by][bx] = t.BOSS;

  G.stairs = null;
  G.shop = { x:-1, y:-1 };
  G.floorType = "boss";
  // Exposed so dressing can place props relative to the arena without re-deriving
  // the geometry: render.js derives its braziers from this, and dressBossArena above
  // derives every arena prop position from it.
  G.bossArena = {
   bossX:bossX, bossY:bossY, bossW:bossW, bossH:bossH,
   entryX:entryX, entryY:entryY, entryW:entryW, entryH:entryH,
   corrX:corrX, corrTop:corrTop, corrW:corrW, corrH:corrH, bossCx:bx, bossCy:by
  };
  // Dress the arena (Batch 8). Read-only with respect to the grid.
  G.decor = dressBossArena(G, ward, G.boss, G.bossArena);
  // Biome ground cover (Batch 16) — placed after the arena so it avoids the
  // boss and the spawn; read-only decoration, like the props above.
  Delve.placeGroundCover(G);
  // Ward growth (js/growth/core.js) — rolled per room after everything else is
  // placed. Guarded + try/caught so a growth failure (missing file, runtime
  // error) can NEVER abort floor generation: the boss, its arena, monsters
  // and everything else this floor lays down must always survive.
  try {
    if (typeof Delve.placeGrowth === "function") Delve.placeGrowth(G);
  } catch (e) {
    if (Delve.logSystem) Delve.logSystem("Growth skipped: " + e.message);
  }
 };

 // levels.js destructures this back into a local name (see its gen/bsp block).
 Delve.gen.dressBossArena = dressBossArena;

})();
