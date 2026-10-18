window.Delve = window.Delve || {};
(function(){
 const T = function(){ return Delve.T; };
 const C = function(){ return Delve.CONFIG; };

 function geq(a,b){ return Math.max(a,b) === a; } // a >= b
 function leq(a,b){ return Math.min(a,b) === a; } // a <= b
 function prob(p){ var r = Math.random(); return Math.min(r,p) === r; } // r <= p

 // ── BSP + room graph machinery (layer1 port) ────────────────
 // A faithful port of the source's generator: rooms come from recursively
 // partitioning the map block (RegularLevel.split), neighbours are rooms that
 // share a wall line of 3+ tiles, and connections are routed over that graph.
 //
 // CONVENTION (the off-by-one the port notes warn about): room rects are
 // {left, top, right, bottom} with right/bottom INCLUSIVE when painting, while
 // the width/height used by every split rule is the exclusive measure
 // right-left / bottom-top — exactly how the Java source's width() behaves.
 // Painted span is [left..right]; interior is [left+1..right-1].

 const BSP_MIN = 7, BSP_MAX = 9;

 function splitRect(r, out){
  const w = r.right - r.left, h = r.bottom - r.top;
  if(w > BSP_MAX && h < BSP_MIN){ splitAt(r, "v", out); return; }
  if(h > BSP_MAX && w < BSP_MIN){ splitAt(r, "h", out); return; }
  if(w <= BSP_MAX && h <= BSP_MAX && Math.random() <= 49 / (w * h)){ out.push(r); return; }
  if(w < BSP_MIN || h < BSP_MIN){ out.push(r); return; }
  // default: wider rects split vertically more often (aspect-weighted)
  if(Math.random() < (w - 2) / (w + h - 4)) splitAt(r, "v", out);
  else splitAt(r, "h", out);
 }

 function splitAt(r, dir, out){
  if(dir === "v"){
   if(r.right - 3 <= r.left + 3){ out.push(r); return; }   // too tight to split
   const x = Delve.rng(r.left + 3, r.right - 3);
   // children SHARE column x — both paint WALL there, which is the separation
   splitRect({ left:r.left, top:r.top, right:x, bottom:r.bottom }, out);
   splitRect({ left:x, top:r.top, right:r.right, bottom:r.bottom }, out);
  } else {
   if(r.bottom - 3 <= r.top + 3){ out.push(r); return; }
   const y = Delve.rng(r.top + 3, r.bottom - 3);
   splitRect({ left:r.left, top:r.top, right:r.right, bottom:y }, out);
   splitRect({ left:r.left, top:y, right:r.right, bottom:r.bottom }, out);
  }
 }

 // Two rooms are neighbours when their bounding rects meet in a shared wall
 // line of at least 3 tiles. Corner-touching rooms never get a door.
 function intersectLine(a, b){
  if(a.right === b.left || b.right === a.left){
   const x = (a.right === b.left) ? a.right : b.right;
   const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
   if(bottom - top >= 2) return { vertical:true, x:x, top:top, bottom:bottom };
   return null;
  }
  if(a.bottom === b.top || b.bottom === a.top){
   const y = (a.bottom === b.top) ? a.bottom : b.bottom;
   const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
   if(right - left >= 2) return { vertical:false, y:y, left:left, right:right };
   return null;
  }
  return null;
 }

 function edgeKey(a, b){ return Math.min(a.idx, b.idx) + "-" + Math.max(a.idx, b.idx); }

 // BFS over the neighbour graph: the shortest hop-path from start to goal.
 function graphPath(start, goal){
  const prev = new Map();
  prev.set(start, null);
  const q = [start];
  while(q.length){
   const r = q.shift();
   if(r === goal){
    const path = [];
    for(let c = goal; c; c = prev.get(c)) path.unshift(c);
    return path;
   }
   r.neighbours.forEach(function(n){
    if(!prev.has(n)){ prev.set(n, r); q.push(n); }
   });
  }
  return null;
 }

 // Graph distances from src (used for entrance/exit picking).
 function distFrom(src){
  const dist = new Map();
  dist.set(src, 0);
  const q = [src];
  while(q.length){
   const r = q.shift();
   r.neighbours.forEach(function(n){
    if(!dist.has(n)){ dist.set(n, dist.get(r) + 1); q.push(n); }
   });
  }
  return dist;
 }

 // Dijkstra over the neighbour graph with the first path's edges re-priced
 // (cost 3 instead of 1), so the second path prefers fresh rooms — the loop
 // that keeps the floor from being purely linear.
 function dijkstraPath(start, goal, penalized){
  const dist = new Map(), prev = new Map(), done = new Set();
  dist.set(start, 0);
  while(true){
   let cur = null, best = Infinity;
   dist.forEach(function(d, r){
    if(!done.has(r) && d < best){ best = d; cur = r; }
   });
   if(cur === null || cur === goal) break;
   done.add(cur);
   cur.neighbours.forEach(function(n){
    const w = penalized.has(edgeKey(cur, n)) ? 3 : 1;
    const nd = best + w;
    if(nd < (dist.get(n) ?? Infinity)){ dist.set(n, nd); prev.set(n, cur); }
   });
  }
  if(goal !== start && !prev.has(goal)) return null;
  const path = [];
  for(let c = goal; c; c = prev.get(c)) path.unshift(c);
  return path[0] === start ? path : null;
 }

 // Paint one room: full rect WALL, interior (margin 1) FLOOR.
 function paintRoom(grid, r){
  for(let y = r.top; y <= r.bottom; y++)
   for(let x = r.left; x <= r.right; x++) grid[y][x] = T().WALL;
  for(let y = r.top + 1; y <= r.bottom - 1; y++)
   for(let x = r.left + 1; x <= r.right - 1; x++) grid[y][x] = T().FLOOR;
 }

 // joinRooms: two linked STANDARD rooms fuse their shared wall into open
 // floor — where the big irregular U-shaped spaces come from. Conditions are
 // the source's: wall >= 3 long, not a full side, combined size <= 9.
 function tryMerge(a, b, grid){
  const line = intersectLine(a, b);
  if(!line) return false;
  if(line.vertical){
   const wallLen = line.bottom - line.top + 1;
   const maxSide = Math.max(a.bottom - a.top, b.bottom - b.top);
   const combined = (a.right - a.left) + (b.right - b.left);
   if(wallLen < 3 || wallLen > maxSide || combined > 9) return false;
   for(let y = line.top; y <= line.bottom; y++) grid[y][line.x] = T().FLOOR;
  } else {
   const wallLen = line.right - line.left + 1;
   const maxSide = Math.max(a.right - a.left, b.right - b.left);
   const combined = (a.bottom - a.top) + (b.bottom - b.top);
   if(wallLen < 3 || wallLen > maxSide || combined > 9) return false;
   for(let x = line.left; x <= line.right; x++) grid[line.y][x] = T().FLOOR;
  }
  a.merged.push(b); b.merged.push(a);
  return true;
 }

 // ── Cellular-automaton patches (layer1 port, Patch.java) ────
 // Every cell starts alive with probability `seed`, then nGen generations of
 // the 5/4 Moore-neighbour rule run with double buffering. Border cells never
 // update, exactly like the source. This is what grows the organic blobs.
 function generatePatch(w, h, seed, nGen){
  let off = [], cur = [];
  for(let y = 0; y !== h; y++){
   off[y] = []; cur[y] = [];
   for(let x = 0; x !== w; x++){
    off[y][x] = Math.random() < seed;
    cur[y][x] = false;
   }
  }
  for(let g = 0; g !== nGen; g++){
   for(let y = 1; y !== h - 1; y++){
    for(let x = 1; x !== w - 1; x++){
     const count =
      (off[y-1][x-1]?1:0) + (off[y-1][x]?1:0) + (off[y-1][x+1]?1:0) +
      (off[y][x-1]?1:0) +                     (off[y][x+1]?1:0) +
      (off[y+1][x-1]?1:0) + (off[y+1][x]?1:0) + (off[y+1][x+1]?1:0);
     cur[y][x] = (!off[y][x] && count >= 5) || (off[y][x] && count >= 4);
    }
   }
   const tmp = off; off = cur; cur = tmp;
  }
  return off;
 }

 // Paint one patch pass over the floor. `amount` caps how much of the floor
 // the pass may claim, so a ward tunes coverage as pure data. Runs after
 // spawn/stairs/shop so those tiles stay plain, and claims plain FLOOR only —
 // spawners never sit on a patch.
 function applyPatch(G, def){
  if(!def || !def.type) return;
  const patch = generatePatch(G.gridW, G.gridH, def.seed || 0.5, def.nGen || 3);
  const tile = (def.type === "water") ? T().WATER : T().GRASS;
  let floorCount = 0;
  for(let y = 1; y !== G.gridH - 1; y++)
   for(let x = 1; x !== G.gridW - 1; x++)
    if(G.grid[y][x] === T().FLOOR) floorCount++;
  let cap = Math.floor(floorCount * (def.amount || 0.25));
  for(let y = 1; y !== G.gridH - 1 && cap > 0; y++){
   for(let x = 1; x !== G.gridW - 1 && cap > 0; x++){
    if(!patch[y][x] || G.grid[y][x] !== T().FLOOR) continue;
    if(Delve.mdist(x, y, G.px, G.py) <= 1) continue;   // keep the spawn tile plain
    G.grid[y][x] = tile;
    cap--;
   }
  }
 }

 // ── Ward floor plan: rolled once per ward per run ──
 // Driven by the ward's own `special` block (con-biomes.js): how many
 // clustered-loot floors, and the per-floor chance of a swarm chamber. The
 // offsets in that block are ward-relative (1 = the ward's first floor).
 function ensureWardPlan(G, ward){
  G._wardPlans = G._wardPlans || {};
  const key = ward.id || 1;
  if(G._wardPlans[key]) return G._wardPlans[key];
  const plan = { clustered: [], swarm: [], sarcophagus: [] };
  const s = ward.special;
  if(s && s.floors){
   const pool = [];
   for(let f = s.floors[0]; f <= s.floors[1]; f++) pool.push(ward.floors[0] + f - 1);
   const range = s.clustered || [2, 3];
   const clusterCount = Delve.rng(range[0], range[1]);
   for(let i=0; i<clusterCount && pool.length; i++){
    const idx = Math.floor(Math.random() * pool.length);
    plan.clustered.push(pool.splice(idx, 1)[0]);
   }
   for(let i=0; i<pool.length; i++){
    if(Math.random() < (s.swarmChance || 0)) plan.swarm.push(pool[i]);
    if(Math.random() < (s.sarcophagusChance || 0)) plan.sarcophagus.push(pool[i]);
   }
  }
  G._wardPlans[key] = plan;
  return plan;
 }

 // Kind-specific spawner used by swarm/cluster floors. Skips the standard
 // safety-radius check so enemies can pack tightly around a chest.
 function spawnMonsterKind(G, x, y, kind){
  if(!G.grid[y] || G.grid[y][x] !== T().FLOOR) return null;
  const row = C().MONSTER_ROSTER[kind];
  if(!row) return null;
  const m = {
   id:"m"+Date.now()+"_"+Math.floor(Math.random()*99999),
   kind: row.kind, name: row.name,
   x:x, y:y,
   maxHp: row.hp + Math.floor((G.floor-1) * row.hpPerFloor),
   atk: row.atk + Math.floor(G.floor * row.atkPerFloor),
   speed: row.speed,
   xp: row.xp, shards: row.shards, gold: row.gold,
   effects: [], elite: false, hasActed: false
  };
  m.hp = m.maxHp;
  G.monsters.push(m);
  G.grid[y][x] = T().MONSTER;
  return m;
 }

 // Candidate rooms for a special floor: skip spawn room, stairs, shop.
 function specialRooms(G, rooms){
  return rooms.slice(1).filter(function(r){
   if(G.stairs && r.cx === G.stairs.x && r.cy === G.stairs.y) return false;
   if(G.shop && G.shop.x >= 0 && r.cx === G.shop.x && r.cy === G.shop.y) return false;
   return true;
  });
 }

 // Swarm floor: clear the spread-out spawns, fill one chamber with a tight
 // pack of one enemy kind, drop a high-value chest at its centre.
 function applySwarmFloor(G, rooms, special){
  const usable = specialRooms(G, rooms);
  if(!usable.length) return;

  G.monsters.forEach(function(m){
   if(G.grid[m.y] && G.grid[m.y][m.x] === T().MONSTER) G.grid[m.y][m.x] = T().FLOOR;
  });
  G.monsters = [];

  const room = usable[Math.floor(Math.random() * usable.length)];
  const kind = (special && special.swarmKind) || "spore_swarm";
  const count = Delve.rng((special && special.swarmMin) || 18, (special && special.swarmMax) || 26);
  let placed = 0, attempts = 400;
  while(placed < count && attempts-- > 0){
   const ox = room.x + Delve.rng(0, room.w - 1);
   const oy = room.y + Delve.rng(0, room.h - 1);
   if(spawnMonsterKind(G, ox, oy, kind)) placed++;
  }

  const cx = room.cx, cy = room.cy;
  if(G.grid[cy] && (G.grid[cy][cx] === T().FLOOR || G.grid[cy][cx] === T().MONSTER || G.grid[cy][cx] === T().CHEST)){
   G.monsters = G.monsters.filter(function(m){ return !(m.x === cx && m.y === cy); });
   G.chests = G.chests.filter(function(c){ return !(c.x === cx && c.y === cy); });
   G.grid[cy][cx] = T().CHEST;
   G.chests.push({ x:cx, y:cy, open:false, highValue:true, swarm:true });
  }

  G.floorType = "swarm";
  if(Delve.logSystem) Delve.logSystem("The air thickens — a swarm fills the chamber.");
 }

  // Clustered loot floor: 4-5 guards ring a high-value chest.
 function applyClusteredLootFloor(G, rooms){
  const usable = specialRooms(G, rooms);
  if(!usable.length) return;

  const room = usable[Math.floor(Math.random() * usable.length)];
  const cx = room.cx, cy = room.cy;
  if(!G.grid[cy]) return;
  if(G.grid[cy][cx] !== T().FLOOR && G.grid[cy][cx] !== T().MONSTER && G.grid[cy][cx] !== T().CHEST) return;

  G.monsters = G.monsters.filter(function(m){ return !(m.x === cx && m.y === cy); });
  G.chests = G.chests.filter(function(c){ return !(c.x === cx && c.y === cy); });
  G.grid[cy][cx] = T().CHEST;
  G.chests.push({ x:cx, y:cy, open:false, highValue:true, clustered:true });

  const band = Delve.getMonsterBand(G.floor);
  const guards = Delve.rng(4, 5);
  let placed = 0, attempts = 80;
  while(placed < guards && attempts-- > 0){
   const ox = cx + Delve.rng(-1, 1);
   const oy = cy + Delve.rng(-1, 1);
   if(ox === cx && oy === cy) continue;
   const kind = Delve.pickWeighted(band.weights);
   if(kind && spawnMonsterKind(G, ox, oy, kind)) placed++;
  }

  G.floorType = "clustered";
  if(Delve.logSystem) Delve.logSystem("A knot of vines guards a sealed chest.");
 }

 // Sarcophagus Hall (Bone Ossuary): 6-10 sealed stone tombs scattered across
 // the floor. Opening one is the player's choice; contents differ — loot, a
 // monster bursting out, or dust. Tombs ride the CHEST tile so taps reach
 // openChest, flagged sarcophagus:true.
 function applySarcophagusFloor(G, rooms, special){
  const usable = specialRooms(G, rooms);
  if(!usable.length) return;
  const count = Delve.rng((special && special.sarcMin) || 6, (special && special.sarcMax) || 10);
  let placed = 0, attempts = 120;
  while(placed < count && attempts-- > 0){
   const room = usable[Delve.rng(0, usable.length - 1)];
   const x = room.x + Delve.rng(0, room.w - 1);
   const y = room.y + Delve.rng(0, room.h - 1);
   if(!G.grid[y] || G.grid[y][x] !== T().FLOOR) continue;
   if(x === G.px && y === G.py) continue;
   if(G.stairs && x === G.stairs.x && y === G.stairs.y) continue;
   if(G.shop && G.shop.x === x && G.shop.y === y) continue;
   G.grid[y][x] = T().CHEST;
   G.chests.push({ x:x, y:y, open:false, sarcophagus:true });
   placed++;
  }
  G.floorType = "sarcophagus";
  if(Delve.logSystem) Delve.logSystem("Sealed tombs crowd the hall. Some are not empty.");
 }

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
 };

 Delve.genFloor = function(){
  const G = Delve.G;
  if(!G) return;
  G.floorCleared = false;
  G.floorType = null;
  G.items = G.items || [];
  G.monsters = [];
  G.goldPiles = [];
  G.barrels = [];
  G.chests = [];
  G.boss = null;
  G.bossArena = null;
  G.decor = [];   // arena props (Batch 8): decoration only, never tiles
  G.groundCover = [];   // biome floor clusters (Batch 16): decoration only, never tiles
  G.shop = { x:-1, y:-1 };
  G.stairs = null;
  // FIX: floorData used to persist across floors, so a secret room found on
  // floor 9 could leave a phantom false-wall pulse on floor 10.
  G.floorData = {};
  const cfg = C();
  const ward = Delve.getWard(G.floor);

  const size = ward.dungeonSize || 34;
  G.gridW = size;
  G.gridH = size;
  G.grid = [];

  // ── Boss floors: bespoke arena, then bail out ──
  // Handled before room generation so the arena is the whole floor, with no
  // stray rooms, corridors, monsters, barrels or chests left over. Boss
  // arenas keep the old all-WALL underlay: their dressing reads WALL tiles.
  if(G.floor % 10 === 0){
   for(let y = 0; y !== G.gridH; y++){
    const row = [];
    for(let x = 0; x !== G.gridW; x++) row.push(T().WALL);
    G.grid.push(row);
   }
   Delve.genBossFloor(G, ward);
   if(Delve.showBossIntro) Delve.showBossIntro(G.floor);
   return;
  }

  // Everywhere else the underlay is VOID: unpainted space renders as pure
  // black (layer1 Phase 7) and blocks movement (movement.js / pathfind.js).
  for(let y = 0; y !== G.gridH; y++){
   const row = [];
   for(let x = 0; x !== G.gridW; x++) row.push(T().VOID);
   G.grid.push(row);
  }

  // ── BSP partition of the map block (layer1 Phase 2) ──
  // Retried until the ward's minimum room count is met.
  const minRooms = ward.roomMin || 8;
  let all = null;
  for(let attempt = 0; attempt !== 40 && !all; attempt++){
   const leaves = [];
   splitRect({ left:0, top:0, right:G.gridW - 1, bottom:G.gridH - 1 }, leaves);
   if(leaves.length >= minRooms){
    all = leaves.map(function(r, i){
     return { idx:i, left:r.left, top:r.top, right:r.right, bottom:r.bottom,
              neighbours:[], links:[], merged:[], connected:false, painted:false };
    });
   }
  }
  if(!all){
   // last-resort fallback: one guaranteed chamber, so a floor always exists
   all = [{ idx:0, left:2, top:2, right:10, bottom:8,
            neighbours:[], links:[], merged:[], connected:false, painted:false }];
  }

  // ── Neighbour graph (layer1 Phase 3) ──
  for(let i = 0; i !== all.length; i++){
   for(let j = i + 1; j !== all.length; j++){
    if(intersectLine(all[i], all[j])){
     all[i].neighbours.push(all[j]);
     all[j].neighbours.push(all[i]);
    }
   }
  }

  // entrance & exit: rooms with inner size >= 4; the exit must sit at least
  // sqrt(roomCount) graph-hops away (10 tries, then the farthest reachable).
  const sqrtN = Math.sqrt(all.length);
  const big = all.filter(function(r){ return r.right - r.left - 1 >= 4 && r.bottom - r.top - 1 >= 4; });
  const pool = big.length ? big : all;
  const entrance = pool[Delve.rng(0, pool.length - 1)];
  entrance.connected = true;
  const dist0 = distFrom(entrance);
  let exit = null;
  for(let t = 0; t !== 10 && !exit; t++){
   const cands = pool.filter(function(r){ return r !== entrance && (dist0.get(r) || 0) >= sqrtN; });
   if(cands.length) exit = cands[Delve.rng(0, cands.length - 1)];
  }
  if(!exit){
   let bestD = -1;
   dist0.forEach(function(d, r){ if(r !== entrance && d > bestD){ bestD = d; exit = r; } });
   if(!exit) exit = all.find(function(r){ return r !== entrance; }) || entrance;
  }
  exit.connected = true;

  // ── Connection routing (layer1 Phase 4) ──
  const link = function(a, b){
   if(a.links.indexOf(b) < 0){ a.links.push(b); b.links.push(a); }
   a.connected = true; b.connected = true;
  };
  const path1 = graphPath(entrance, exit);
  if(path1 && path1.length > 1){
   for(let i = 0; i !== path1.length - 1; i++) link(path1[i], path1[i + 1]);
   // re-price the first path's edges, then walk a second shortest path so the
   // floor isn't purely linear (the redundant loop)
   const used = new Set();
   for(let i = 0; i !== path1.length - 1; i++) used.add(edgeKey(path1[i], path1[i + 1]));
   const path2 = dijkstraPath(entrance, exit, used);
   if(path2) for(let i = 0; i !== path2.length - 1; i++) link(path2[i], path2[i + 1]);
  } else if(entrance !== exit){
   link(entrance, exit);
  }

  // random expansion until 50-70% of rooms are connected
  const target = Math.floor(all.length * (0.5 + Math.random() * 0.2));
  let guard = 300;
  while(guard-- > 0){
   const conn = all.filter(function(r){ return r.connected; });
   if(conn.length >= target) break;
   const seeds = conn.filter(function(r){
    return r.neighbours.some(function(n){ return !n.connected; });
   });
   if(!seeds.length) break;
   const from = seeds[Delve.rng(0, seeds.length - 1)];
   const opts = from.neighbours.filter(function(n){ return !n.connected; });
   link(from, opts[Delve.rng(0, opts.length - 1)]);
  }

  // ── Room types (layer1 Phase 5) ──
  // Single-connection rooms (and the endpoints) stay standard; multi-
  // connection rooms are mostly tunnel; at least 4 standard rooms guaranteed.
  let standardCount = 0;
  all.forEach(function(r){
   if(!r.connected){ r.type = null; return; }
   const multi = r.links.length >= 2 && r !== entrance && r !== exit;
   r.type = (multi && Math.random() < 0.6) ? "tunnel" : "standard";
   if(r.type === "standard") standardCount++;
  });
  for(let i = 0; standardCount < 4 && i !== all.length; i++){
   if(all[i].type === "tunnel"){ all[i].type = "standard"; standardCount++; }
  }

  // ── Painting (layer1 Phase 6) ──
  // Unconnected rooms are never painted — they stay VOID, the black.
  all.forEach(function(r){
   if(!r.connected) return;
   r.painted = true;
   paintRoom(G.grid, r);
  });

  // joinable STANDARD rooms fuse their shared wall into open floor, which is
  // where the big irregular U-shaped spaces come from (layer1 joinRooms)
  const mergeChance = ward.mergeChance !== undefined ? ward.mergeChance : 0.5;
  if(mergeChance > 0){
   for(let i = 0; i !== all.length; i++){
    for(let j = i + 1; j !== all.length; j++){
     const a = all[i], b = all[j];
     if(!a.painted || !b.painted) continue;
     if(a.links.indexOf(b) < 0) continue;
     if(a.type !== "standard" || b.type !== "standard") continue;
     if(Math.random() >= mergeChance) continue;
     tryMerge(a, b, G.grid);
    }
   }
  }

  // doors: one per linked pair, at a random point along the shared wall, with
  // both interiors either side of it. Merged pairs need no door.
  all.forEach(function(a){
   a.links.forEach(function(b){
    if(a.idx >= b.idx) return;
    if(a.merged.indexOf(b) >= 0) return;
    const line = intersectLine(a, b);
    if(!line) return;
    if(line.vertical){
     const y = Delve.rng(line.top + 1, line.bottom - 1);
     if(G.grid[y] && G.grid[y][line.x] === T().WALL) G.grid[y][line.x] = T().DOOR;
    } else {
     const x = Delve.rng(line.left + 1, line.right - 1);
     if(G.grid[line.y] && G.grid[line.y][x] === T().WALL) G.grid[line.y][x] = T().DOOR;
    }
   });
  });

  // downstream room list: painted rooms only, entrance first (the old
  // "skip rooms[0]" spawn convention), interior coordinates for the spawners
  const rooms = [];
  const pushRoom = function(r){
   const out = {
    x:r.left + 1, y:r.top + 1,
    w:r.right - r.left - 1, h:r.bottom - r.top - 1,
    cx:Math.floor((r.left + r.right) / 2),
    cy:Math.floor((r.top + r.bottom) / 2),
    type:r.type
   };
   r._out = out;
   rooms.push(out);
  };
  pushRoom(entrance);
  all.forEach(function(r){ if(r.painted && r !== entrance) pushRoom(r); });

  // player spawn: centre of the entrance room
  G.px = rooms[0].cx; G.py = rooms[0].cy;
  G.lastDir = "right";

  // stairs: centre of the exit room — the room the routing walked TO
  const exitOut = exit._out || rooms[0];
  G.stairs = { x:exitOut.cx, y:exitOut.cy };
  G.grid[exitOut.cy][exitOut.cx] = T().STAIR;

  // shop floors (5, 15, 25...): place the shopkeeper off spawn and off stairs
  if(Delve.isShopFloor && Delve.isShopFloor(G.floor)){
   for(let t = 0; t !== rooms.length; t++){
    const cand = rooms[Delve.rng(0, rooms.length-1)];
    if(!cand) continue;
    const d = Delve.mdist(cand.cx, cand.cy, G.px, G.py);
    const onStairs = G.stairs && cand.cx === G.stairs.x && cand.cy === G.stairs.y;
    if(G.grid[cand.cy][cand.cx] === T().FLOOR && !leq(d, 3) && !onStairs){
     G.shop = { x:cand.cx, y:cand.cy, stock:null };
     break;
    }
   }
  }

  // ── Organic patches (layer1 Phase 8) ──
  // Placed after spawn/stairs/shop so those tiles stay plain, and before
  // barrels/chests/monsters so those only ever sit on open stone.
  (ward.patches || []).forEach(function(def){ applyPatch(G, def); });

  // barrels: random scattered floor tiles away from spawn
  const barrelCount = Delve.rng(3, 7);
  const openTiles = [];
  for(let by = 1; by !== G.gridH-1; by++){
   for(let bx = 1; bx !== G.gridW-1; bx++){
    if(G.grid[by][bx] === T().FLOOR && !leq(Delve.mdist(bx,by,G.px,G.py), 4)) openTiles.push({x:bx,y:by});
   }
  }
  for(let i = 0; i !== barrelCount && openTiles.length !== 0; i++){
   const pick = openTiles.splice(Math.floor(Math.random()*openTiles.length), 1)[0];
   if(G.grid[pick.y][pick.x] !== T().FLOOR) continue;
   G.barrels.push({ x:pick.x, y:pick.y });
   G.grid[pick.y][pick.x] = T().BARREL;
  }

  // chests
  const chestChance = (Delve.hasProgression && Delve.hasProgression("sealed_cache")) ? 1
   : Math.min(ward.treasureChanceCap || 0.45, (ward.treasureChanceBase || 0.14) + (ward.treasureChanceLuck || 0.018) * Delve.luckPts());
  if(prob(chestChance) && openTiles.length !== 0){
   const s = openTiles.splice(Math.floor(Math.random()*openTiles.length), 1)[0];
   if(G.grid[s.y][s.x] === T().FLOOR){
    G.grid[s.y][s.x] = T().CHEST;
    G.chests.push({ x:s.x, y:s.y, open:false });
   }
  }

  // normal monsters: distribute across rooms (skip spawn room) for even density
  const band = Delve.getMonsterBand(G.floor);
  const count = Delve.rng(band.countMin || 10, band.countMax || 14);
  let placed = 0;
  const usable = rooms.slice(1);
  for(let ri = 0; ri !== usable.length && placed !== count; ri++){
   const room = usable[ri];
   const remaining = count - placed;
   const roomsLeft = usable.length - ri;
   const perHere = Math.ceil(remaining / roomsLeft);
   for(let k = 0; k !== perHere && placed !== count; k++){
    const ox = room.cx + Delve.rng(-2, 2);
    const oy = room.cy + Delve.rng(-2, 2);
    if(spawnMonster(G, ox, oy, band)) placed = placed + 1;
   }
  }

  // Ward special floors: a swarm chamber or a clustered-loot room. The plan is
  // per ward and comes from its `special` block in con-biomes.js.
  if(ward.special){
   const plan = ensureWardPlan(G, ward);
   if(plan.swarm.indexOf(G.floor) >= 0){
    applySwarmFloor(G, rooms, ward.special);
   } else if(plan.clustered.indexOf(G.floor) >= 0){
    applyClusteredLootFloor(G, rooms);
   } else if(plan.sarcophagus.indexOf(G.floor) >= 0){
    applySarcophagusFloor(G, rooms, ward.special);
   }
  }

  // elite: one elite per floor at the configured chance
  const minF = cfg.elite.minFloor || 3, maxF = cfg.elite.maxFloor || 9;
  if(geq(G.floor, minF) && leq(G.floor, maxF)){
   if(prob(cfg.elite.chance || 0.10)){
    const m = G.monsters.find(function(x){ return x && !x.elite; });
    if(m) Delve.makeElite(m);
   }
  }

  // secret room: fake wall plus hidden chest behind it
  const secretChance = Math.min(ward.secretRoomChanceCap || 0.70,
   (ward.secretRoomChanceBase || 0.20) + (ward.secretRoomChanceLuck || 0.04) * Delve.luckPts());
  if(prob(secretChance * 0.30)){
   const adjWalls = [];
   for(let y = 1; y !== G.gridH-1; y++){
    for(let x = 1; x !== G.gridW-1; x++){
     if(G.grid[y][x] === T().WALL){
      if(G.grid[y-1][x] === T().FLOOR || G.grid[y+1][x] === T().FLOOR ||
         G.grid[y][x-1] === T().FLOOR || G.grid[y][x+1] === T().FLOOR){
       adjWalls.push({x:x,y:y});
      }
     }
    }
   }
   if(adjWalls.length !== 0){
    const w = adjWalls[Math.floor(Math.random()*adjWalls.length)];
    for(let yy = w.y-1; yy !== w.y+2; yy++){
     for(let xx = w.x-1; xx !== w.x+2; xx++){
      if(G.grid[yy] && G.grid[yy][xx] === T().WALL) G.grid[yy][xx] = T().FLOOR;
     }
    }
    G.grid[w.y][w.x] = T().CHEST;
    G.chests.push({ x:w.x, y:w.y, open:false, secret:true });
    G.floorData.secretRoom = { falseWallX:w.x, falseWallY:w.y };
   }
  }
  // Biome ground cover (Batch 16) — placed last so it avoids the stairs, shop,
  // chests and monsters this floor has just laid down.
  Delve.placeGroundCover(G);
 };

 // monster spawn helper: respects safety radius and tile state
 function spawnMonster(G, x, y, band){
  if(leq(Delve.mdist(x,y,G.px,G.py), 2)) return null;
  if(G.grid[y][x] !== T().FLOOR) return null;
  const kind = Delve.pickWeighted(band.weights);
  if(!kind) return null;
  const row = C().MONSTER_ROSTER[kind] || C().MONSTER_ROSTER.goblin;
  const m = {
   id:"m"+Date.now()+"_"+Math.floor(Math.random()*99999),
   kind: row.kind, name: row.name,
   x:x, y:y,
   maxHp: row.hp + Math.floor((G.floor-1) * row.hpPerFloor),
   atk: row.atk + Math.floor(G.floor * row.atkPerFloor),
   speed: row.speed,
   xp: row.xp, shards: row.shards, gold: row.gold,
   effects: [], elite: false, hasActed: false
  };
  m.hp = m.maxHp;
  G.monsters.push(m);
  G.grid[y][x] = T().MONSTER;
  return m;
 }

 // opening a chest: item, potion, or gold, with provenance
  Delve.openChest = function(x, y){
  const G = Delve.G;
  if(!G) return;
  const chest = G.chests.find(function(c){ return c.x===x && c.y===y; });
  if(!chest || chest.open) return;

  // ── Sarcophagus (Bone Ossuary): shift the lid and see what stirs ──
  if(chest.sarcophagus){
   chest.open = true;
   G.grid[y][x] = T().FLOOR;
   if(Delve.sfx) Delve.sfx("chest");
   const roll = Math.random();
   const source = { kind:"sarcophagus" };
   if(roll < 0.30){          // an item sleeps with the dead
    let tier = Delve.rollTier(G.floor, (Delve.CONFIG.loot.sourceRarityMult || {}).chest || 1);
    if(Delve.hasProgression && Delve.hasProgression("lucky_find")) tier = Math.min(4, tier+1);
    const it = Delve.makeItem(tier);
    it.x = x; it.y = y;
    Delve.stampProvenance(it, source);
    G.items.push(it);
    if(Delve.logSystem) Delve.logSystem("The lid shifts — grave goods, still wrapped.");
   } else if(roll < 0.55){   // gold left for the afterlife
    const mult = Delve.goldMult ? Delve.goldMult() : 1;
    const gold = Math.round((15 + Math.floor(Math.random()*10) + G.floor*2) * mult);
    G.gold += gold;
    Delve.recordStat("goldEarned", gold);
    Delve.addFloater("+" + gold + "g", x, y, "#ffd75e");
    if(Delve.logSystem) Delve.logSystem("The tomb held its gold. Now it doesn't.");
   } else if(roll < 0.75){   // something bursts out
    const band = Delve.getMonsterBand(G.floor);
    const kind = Delve.pickWeighted(band.weights);
    G.monsters = G.monsters.filter(function(m){ return !(m.x === x && m.y === y); });
    const m = kind ? spawnMonsterKind(G, x, y, kind) : null;
    if(m){
     if(Delve.sfx) Delve.sfx("hit", { monster: m.kind });
     Delve.addShake(3);
     Delve.flash(m.name.toUpperCase() + " BURSTS OUT!");
     if(Delve.logSystem) Delve.logSystem(m.name + " bursts from the tomb!");
    } else {
     if(Delve.logSystem) Delve.logSystem("The lid shifts. Dust. Nothing more.");
    }
   } else if(roll < 0.90){   // a potion, preserved
    Delve.dropPotion(x, y, 2, source);
    if(Delve.logSystem) Delve.logSystem("A sealed potion, kept for a journey the dead never took.");
   } else {                  // already empty
    if(Delve.logSystem) Delve.logSystem("The lid shifts. Dust. Nothing more.");
   }
   Delve.updateHUD();
   Delve.draw();
   return;
  }

  chest.open = true;
  G.grid[y][x] = T().FLOOR;
  if(Delve.sfx) Delve.sfx("chest");
  if(Delve.logSystem) Delve.logSystem("You open a chest.");
  const source = chest.secret ? { kind:"secret" } : { kind:"chest" };

  // high-value chest (Blackvein cluster or swarm): guaranteed tier 3+ item,
  // tier 3 potion, and boosted gold
  if(chest.highValue){
   let tier = Math.max(3, Delve.rollTier(G.floor, (Delve.CONFIG.loot.sourceRarityMult || {}).treasure || 1));
   if(Delve.hasProgression && Delve.hasProgression("lucky_find")) tier = Math.min(4, tier+1);
   const it = Delve.makeItem(tier);
   it.x = x; it.y = y;
   Delve.stampProvenance(it, source);
   G.items.push(it);
   Delve.dropPotion(x, y, 3, source);
   const mult = Delve.goldMult ? Delve.goldMult() : 1;
   const gold = Math.round((30 + Math.floor(Math.random()*20) + G.floor*3) * mult);
   G.gold += gold;
   Delve.recordStat("goldEarned", gold);
   Delve.addFloater("+" + gold + "g", x, y, "#ffd75e");
   Delve.updateHUD();
   Delve.draw();
   return;
  }

  if(prob(0.45)){
   let tier = Delve.rollTier(G.floor, (Delve.CONFIG.loot.sourceRarityMult || {}).chest || 1);
   if(Delve.hasProgression && Delve.hasProgression("lucky_find")) tier = Math.min(4, tier+1);
   const it = Delve.makeItem(tier);
   it.x = x; it.y = y;
   Delve.stampProvenance(it, source);
   G.items.push(it);
  } else if(prob(0.8)){
   Delve.dropPotion(x, y, 2, source);
  } else {
   const mult = Delve.goldMult ? Delve.goldMult() : 1;
   const gold = Math.round((15 + Math.floor(Math.random()*10) + G.floor*2) * mult);
   G.gold += gold;
   Delve.recordStat("goldEarned", gold);
   Delve.addFloater("+" + gold + "g", x, y, "#ffd75e");
   if(Delve.logSystem) Delve.logSystem("Chest contained " + gold + " gold.");
  }
  Delve.updateHUD();
  Delve.draw();
 };

})();
