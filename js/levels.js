window.Delve = window.Delve || {};
(function(){

 // How often an enrage-capable species actually spawns enraged. Read at CALL
 // time, not load time: `C()` is the config accessor and is not initialised when
 // this file is evaluated, so capturing it in a const here threw
 // "Cannot access 'C' before initialization" on load.
 function enrageChance(){
  return (C().secondaries || {}).enrageChance || 0.40;
 }
 const T = function(){ return Delve.T; };
 const C = function(){ return Delve.CONFIG; };

 // Pure comparison/random helpers now live in js/util.js (loaded before this
 // file). These aliases keep every call site below reading exactly as it was.
 const geq  = Delve.geq;    // a >= b
 const leq  = Delve.leq;    // a <= b
 const prob = Delve.prob;   // true with probability p

 // ── BSP + room graph ────────────────────────────────────────
 // The floor-plan geometry — recursive splitting, the room-neighbour graph,
 // path routing, room painting and wall merging — now lives in js/gen/bsp.js,
 // which loads immediately before this file. Destructuring it back into local
 // names keeps every call site below byte-identical to when the code was here.
 const {
  splitRect, splitAt, intersectLine, edgeKey, graphPath,
  distFrom, dijkstraPath, paintRoom, tryMerge
 } = Delve.gen;

 // ── Boss arena ──────────────────────────────────────────────
 // The bespoke boss-floor layout and the props dressed onto it now live in
 // js/gen/bossarena.js, which loads immediately before this file. That file
 // keeps the public name `Delve.genBossFloor`, so only the private dresser
 // needs bringing back into scope here.
 const { dressBossArena } = Delve.gen;

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
  // Water is no longer a cellular-automaton patch: it only appears as wall-fed
  // puddles (js/puddles.js), so a leftover water entry is ignored.
  if(!def || !def.type || def.type === "water") return;
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
  // GRASS patches are walkable floor too — a swarm can stand on a tuft. Remember
  // the tile we replaced so clearing the floor restores the patch instead of
  // leaving a bare stone square punched through it.
  if(!G.grid[y] || (G.grid[y][x] !== T().FLOOR && G.grid[y][x] !== T().GRASS)) return null;
  const row = C().MONSTER_ROSTER[kind];
  if(!row) return null;
  const m = {
   id:"m"+Date.now()+"_"+Math.floor(Math.random()*99999),
   kind: row.kind, name: row.name,
   x:x, y:y,
   tile: G.grid[y][x],
   maxHp: openScale(G, row.hp + Math.floor((G.floor-1) * row.hpPerFloor), "monsterHpPct"),
   atk: openScale(G, row.atk + Math.floor(G.floor * row.atkPerFloor), "monsterAtkPct"),
   speed: row.speed,
   xp: row.xp, shards: row.shards, gold: row.gold,
   // Roster flags the kill path reads off the INSTANCE must be carried across.
   // `reassembleOnce` (the Ossuary's Reassembled) was read from m but never
   // copied from the row, so its gimmick could never fire — it just died.
   // `splitOnDeath` (the Forge's Reforged) is the same trap: killMonster gates
   // the split on m.splitOnDeath, so without this line the whole branch is dead
   // code and The Reforged dies like any other monster.
   reassembleOnce: !!row.reassembleOnce,
   splitOnDeath: row.splitOnDeath || null,
   // Combat texture the damage path reads off the INSTANCE. Same trap as the
   // two flags above: a roster field that is not copied here simply never
   // fires, and nothing errors to tell you.
   armour: row.armour || 0,
   // Enrage is rolled per INSTANCE, not granted to every copy of the species.
   // Measured before this: floor 45 had 15 of 22 enemies able to enrage, so the
   // worst-case burst reached 85% of max HP — a floor that could kill you
   // through volume rather than bad positioning. At the configured roll rate the
   // same floor carries roughly 3, which keeps "some hounds frenzy" as a
   // warning without turning the ward into a damage race.
   enrageAt: (row.enrageAt && Math.random() < enrageChance()) ? row.enrageAt : 0,
   effects: [], elite: false, hasActed: false
  };
  m.hp = m.maxHp;
  G.monsters.push(m);
  G.grid[y][x] = T().MONSTER;
  return m;
 }

 // Floor-1 softening (CONFIG.openingFloor): a percentage applied to a spawned
 // monster's HP or ATK on the teaching floor only. Any later floor is untouched,
 // so the depth curve below floor 2 is exactly what it was.
 function openScale(G, v, key){
  if(!G || G.floor !== 1) return v;
  const o = C().openingFloor || {};
  const pct = o[key];
  if(!pct) return v;
  return Math.max(1, Math.round(v * pct));
 }

 // Public seam for js/encounters.js: ambient ambushes must spawn the exact same
 // monster shape the floor generator uses, so they level, drop and behave like
 // any other enemy. Deliberately skips the safety radius — the caller has
 // already chosen a tile at arm's length from the player.
 Delve.spawnMonsterAt = function(x, y, kind){
  return Delve.G ? spawnMonsterKind(Delve.G, x, y, kind) : null;
 };

 // ── Shop chamber ─────────────────────────────────────────────
 // A shop floor used to put the shopkeeper in a corner of whatever room the RNG
 // picked. Now the shop gets its OWN chamber: a fixed interior size, exactly one
 // door, and a merchant's stall dressed into it, so the room reads as a shop from
 // the doorway. The chamber is carved into a leaf room that is not the entrance,
 // the exit or the boss arena.
 //
 // Sized 5x5 interior (7x7 outer wall) every time: uniform, as the owner asked,
 // and small enough to see the whole stall at once on a phone.
 const SHOP_HALF = 2;           // interior half-extent -> 5x5 inside, 7x7 with walls

 function carveShopChamber(G, rooms, entrance, exitOut){
  if(!Delve.isShopFloor || !Delve.isShopFloor(G.floor)) return null;
  if(!rooms || !rooms.length) return null;

  // Candidate centres: any FLOOR tile with two clear tiles either side in all
  // four directions, away from spawn and the stairs, and in a room the player
  // has to walk to rather than one they start in.
  const ok = [];
  for(let y = SHOP_HALF + 1; y < G.gridH - SHOP_HALF - 1; y++){
   for(let x = SHOP_HALF + 1; x < G.gridW - SHOP_HALF - 1; x++){
    if(G.grid[y][x] !== T().FLOOR) continue;
    if(Delve.mdist(x, y, G.px, G.py) < 4) continue;
    if(G.stairs && Delve.mdist(x, y, G.stairs.x, G.stairs.y) < 3) continue;
    // must sit inside a painted room interior, not a corridor
    let inRoom = false;
    for(const r of rooms){
     if(x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1){ inRoom = true; break; }
    }
    if(!inRoom) continue;
    ok.push({ x:x, y:y });
   }
  }
  if(!ok.length) return null;

  // Try several candidate centres before giving up: a centre whose four sides all
  // face unconnected rock cannot host a one-door room, and the caller would then
  // fall back to a shopkeeper in a corner.
  for(let attempt = 0; attempt !== 8; attempt++){
   if(!ok.length) return null;
   const pickIdx = Delve.rng(0, ok.length - 1);
   const chosen = ok.splice(pickIdx, 1)[0];
   const built = buildShopAt(G, rooms, chosen);
   if(built) return built;
  }
  return null;
 }

 function buildShopAt(G, rooms, c){
  const x0 = c.x - SHOP_HALF, x1 = c.x + SHOP_HALF;
  const y0 = c.y - SHOP_HALF, y1 = c.y + SHOP_HALF;

  // Uniform chamber: solid wall ring, clear floor inside.
  for(let y = y0 - 1; y <= y1 + 1; y++){
   for(let x = x0 - 1; x <= x1 + 1; x++){
    const edge = (x === x0-1 || x === x1+1 || y === y0-1 || y === y1+1);
    G.grid[y][x] = edge ? T().WALL : T().FLOOR;
   }
  }

  // Exactly ONE door. Try each of the four sides in turn and keep the first that
  // actually leads somewhere: the door tile is opened, and a short corridor is
  // driven outward until it meets open floor. A side that only faces solid rock
  // is skipped, which is what previously left the merchant walled in.
  const sides = [
   { dx:-1, dy:0 }, { dx:1, dy:0 }, { dx:0, dy:-1 }, { dx:0, dy:1 }
  ];
  // Prefer the side facing the player.
  sides.sort(function(a, b){
   const score = function(d){ return -(Math.sign(G.px - c.x) === d.dx) - (Math.sign(G.py - c.y) === d.dy); };
   return score(a) - score(b);
  });

  // Reachability from the player, computed once. A door must open toward a tile
  // that is genuinely connected to the spawn: "there is floor over there" is not
  // enough, because BSP leaves glassy slivers of floor that belong to no room and
  // join nothing. That sliver is what walled the merchant in.
  const reach = (function(){
   const seen = new Uint8Array(G.gridW * G.gridH);
   const q = [G.py * G.gridW + G.px];
   seen[q[0]] = 1;
   for(let qi = 0; qi < q.length; qi++){
    const cur = q[qi];
    const cx = cur % G.gridW, cy = (cur - cx) / G.gridW;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for(const d of dirs){
     const nx = cx + d[0], ny = cy + d[1];
     if(nx <= 0 || ny <= 0 || nx >= G.gridW-1 || ny >= G.gridH-1) continue;
     const ni = ny * G.gridW + nx;
     if(seen[ni]) continue;
     const t = G.grid[ny][nx];
     if(t !== T().FLOOR && t !== T().DOOR && t !== T().GRASS && t !== T().STAIR) continue;
     seen[ni] = 1;
     q.push(ni);
    }
   }
   return seen;
  })();

  let door = null;
  for(const sd of sides){
   // Door sits in the chamber's wall ring.
   const doorX = c.x + sd.dx * (SHOP_HALF + 1);
   const doorY = c.y + sd.dy * (SHOP_HALF + 1);
   if(doorX <= 0 || doorY <= 0 || doorX >= G.gridW-1 || doorY >= G.gridH-1) continue;

   // Walk outward from the door looking for floor/void we can join. Wall is
   // replaced all the way, so the door always opens onto the rest of the map.
   const path = [];
   let x = doorX + sd.dx, y = doorY + sd.dy;
   let reachedFloor = false;
   for(let i = 0; i < 8; i++, x += sd.dx, y += sd.dy){
    if(x <= 0 || y <= 0 || x >= G.gridW-1 || y >= G.gridH-1) break;
    const t = G.grid[y][x];
    if(t === T().FLOOR || t === T().GRASS || t === T().DOOR || t === T().STAIR){
     // Only counts if that tile is connected to where the player starts.
     reachedFloor = !!reach[y * G.gridW + x];
     break;
    }
    if(t === T().MONSTER || t === T().CHEST || t === T().BARREL) break;
    path.push({ x:x, y:y });   // WALL or VOID we will open
   }
   if(!reachedFloor) continue;   // this side leads nowhere; try the next

   // Seal the whole ring first: the host room may have its own doors sitting on
   // this wall, and those would read as extra entrances to the stall. Then cut
   // exactly one.
   for(let y = y0-1; y <= y1+1; y++){
    for(let x = x0-1; x <= x1+1; x++){
     const edge = (x === x0-1 || x === x1+1 || y === y0-1 || y === y1+1);
     if(edge) G.grid[y][x] = T().WALL;
     else G.grid[y][x] = T().FLOOR;
    }
   }
   G.grid[doorY][doorX] = T().DOOR;
   for(const t of path) G.grid[t.y][t.x] = T().FLOOR;
   door = { x:doorX, y:doorY, dx:sd.dx, dy:sd.dy };
   break;
  }
  if(!door) return null;   // no side connects, so let the caller fall back

  // The merchant stands at the BACK of the chamber, on the fixed wall row, so
  // the stall faces the door and the room has a focal point. The tile in front
  // of him is always open floor, which is where the player stops to trade.
  const merchant = { x:c.x, y:y0 };
  G.shop = { x:merchant.x, y:merchant.y, stock:null,
             room:{ x:x0, y:y0, w:SHOP_HALF*2+1, h:SHOP_HALF*2+1 } };
  G.shop.merchant = { x:merchant.x, y:merchant.y };
  // Merchant stands at the back of the chamber, shelf props along the side walls.
  G.decor = G.decor || [];
  const put = function(x, y, key, layer){ G.decor.push({ x:x, y:y, key:key, layer:layer || "floor" }); };
  // The stall: counter at the merchant's feet (he stands behind it), crates
  // stacked at the back corners, a lantern hung over the counter. All painted
  // on the tile, never blocking.
  put(merchant.x, merchant.y, "prop_shopCounter", "floor");
  // Crates sit in the four CORNERS. The merchant stands mid-back-wall, so the
  // tile below him stays clear: that is the tile the player walks onto to talk.
  put(x0, y0, "prop_shopCrate", "floor");
  put(x1, y0, "prop_shopCrate", "floor");
  put(x0, y1, "prop_shopCrate", "floor");
  put(x1, y1, "prop_shopCrate", "floor");
  put(merchant.x, merchant.y - 1, "prop_shopLantern", "wall");
  // A banner over the doorway is the shop's sign, readable from the approach.
  if(door) put(door.x, Math.max(1, door.y - 1), "prop_bannerWarden", "wall");

  return G.shop;
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
   if(G.grid[m.y] && G.grid[m.y][m.x] === T().MONSTER) G.grid[m.y][m.x] = m.tile || T().FLOOR;
  });
  G.monsters = [];

  // Pick the LARGEST usable chamber. A random pick could land on a 2x2 BSP
  // stub, where 18-26 bodies simply do not fit — that produced swarm floors
  // with 3-5 monsters. Area-weight the choice so the pack fills a real room.
  const room = usable.reduce(function(best, r){
   const area = Math.max(0, r.w) * Math.max(0, r.h);
   const bestArea = Math.max(0, best.w) * Math.max(0, best.h);
   // ties and near-ties still vary, so swarms aren't always the same room
   if(area > bestArea * 1.4) return r;
   if(area >= bestArea * 0.72 && Math.random() < 0.5) return r;
   return best;
  }, usable[0]);
  const kind = (special && special.swarmKind) || "spore_swarm";
  const roomTiles = Math.max(1, Math.max(0, room.w) * Math.max(0, room.h));
  const rolled = Delve.rng((special && special.swarmMin) || 18, (special && special.swarmMax) || 26);
  // Never ask for more bodies than the chamber has tiles; the centre becomes a chest.
  const count = Math.max(1, Math.min(rolled, roomTiles - 1));
  let placed = 0, attempts = 400;
  while(placed < count && attempts-- > 0){
   const ox = room.x + Delve.rng(0, room.w - 1);
   const oy = room.y + Delve.rng(0, room.h - 1);
   if(spawnMonsterKind(G, ox, oy, kind)) placed++;
  }
  // If the chamber still came up short (props, merged walls, patch overlap),
  // top the swarm up on open floor elsewhere rather than shipping a thin floor.
  // Candidates are shuffled so the overflow never lines up in the map corner.
  if(placed < count){
   const spare = [];
   for(let ty = 1; ty !== G.gridH - 1; ty++){
    for(let tx = 1; tx !== G.gridW - 1; tx++){
     const tt = G.grid[ty][tx];
     if((tt === T().FLOOR || tt === T().GRASS) && !leq(Delve.mdist(tx, ty, G.px, G.py), 2)) spare.push({ x:tx, y:ty });
    }
   }
   for(let i = spare.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = spare[i]; spare[i] = spare[j]; spare[j] = tmp;
   }
   for(let i = 0; i !== spare.length && placed < count; i++){
    if(spawnMonsterKind(G, spare[i].x, spare[i].y, kind)) placed++;
   }
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

 Delve.genFloor = function(){
  const G = Delve.G;
  if(!G) return;
  G.floorCleared = false;
  G.floorType = null;
  // Stale drops used to survive a descent (audit #9): you could walk into a
  // new floor and step on an item from the last one. Clear them.
  G.items = [];
  G.monsters = [];
  G.goldPiles = [];
  G.barrels = [];
  G.chests = [];
  G.boss = null;
  G.bossArena = null;
  G.decor = [];   // arena props (Batch 8): decoration only, never tiles
  G.groundCover = [];   // biome floor clusters (Batch 16): decoration only, never tiles
  G.puddles = [];       // wall-anchored water (js/puddles.js): shape data, never saved
  G.shop = { x:-1, y:-1 };
  G.stairs = null;
  // One optional floor event and the ambush budget are per-floor, never inherited.
  G.floorEvent = null;
  G.ambushCount = 0;
  // FIX: floorData used to persist across floors, so a secret room found on
  // floor 9 could leave a phantom false-wall pulse on floor 10.
  G.floorData = {};
  // Fog of war state is per floor: revealed rooms, corridor trail.
  G.fogSeen = [];
  G.fogTrail = [];
  // Cleared here too: a boss floor returns before the room list is rebuilt, and
  // a stale list from the previous floor would light the wrong places.
  G.rooms = [];
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
   // Partition the map INSET by one tile on every side. No room can ever reach
   // the outermost ring, so the ring always stays VOID and renders as pure black:
   // a visible hard cap between the northmost (or any edge) rooms and the end of
   // the map. It also stops room centres from sitting on row 0 / row gridH-1,
   // where the ±2 monster scatter used to push coordinates outside the grid.
   splitRect({ left:1, top:1, right:G.gridW - 2, bottom:G.gridH - 2 }, leaves);
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

  // Keep the room list on G so fog of war (js/fog.js) can ask which room a tile
  // belongs to. Interiors only; it is never saved and never drawn.
  G.rooms = rooms;

  // player spawn: centre of the entrance room
  G.px = rooms[0].cx; G.py = rooms[0].cy;
  G.lastDir = "right";

  // stairs: centre of the exit room — the room the routing walked TO
  const exitOut = exit._out || rooms[0];
  G.stairs = { x:exitOut.cx, y:exitOut.cy };
  G.grid[exitOut.cy][exitOut.cx] = T().STAIR;

  // shop floors (5, 15, 25...): the shop gets its OWN chamber — a uniform 5x5
  // room, one door, merchant's stall inside — rather than a corner of a random
  // room. Falls back to the old corner placement only if no space can be carved.
  if(Delve.isShopFloor && Delve.isShopFloor(G.floor)){
   const carved = carveShopChamber(G, rooms, rooms[0], exitOut);
   if(!carved){
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
  }

  // The shop chamber is carved after G.rooms is built, so register its interior
  // here — otherwise the merchant's room would stay under the fog until the
  // player was standing on top of the stall.
  if(G.shop && G.shop.room){
   const sr = G.shop.room;
   G.rooms.push({ x:sr.x, y:sr.y, w:sr.w, h:sr.h,
                  cx:sr.x + Math.floor(sr.w / 2), cy:sr.y + Math.floor(sr.h / 2),
                  type:"shop" });
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
  const inShopRoom = function(x, y){
   const r = G.shop && G.shop.room;
   if(!r) return false;
   return x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
  };
  for(let i = 0; i !== barrelCount && openTiles.length !== 0; i++){
   const pick = openTiles.splice(Math.floor(Math.random()*openTiles.length), 1)[0];
   if(G.grid[pick.y][pick.x] !== T().FLOOR) continue;
   if(inShopRoom(pick.x, pick.y)) continue;   // keep the stall clear
   G.barrels.push({ x:pick.x, y:pick.y });
   G.grid[pick.y][pick.x] = T().BARREL;
  }

  // chests — the per-biome numbers now live in CONFIG.ITEMS.drop so one place
  // controls "how much loot does a floor hold".
  const DC = (C().ITEMS || {}).drop || {};
  const chestChance = (Delve.hasProgression && Delve.hasProgression("sealed_cache")) ? 1
   : Math.min(ward.treasureChanceCap || DC.chestChanceCap || 0.60,
              (DC.chestChanceBase || 0.30) + (DC.chestChanceLuck || 0.02) * Delve.luckPts());
  if(prob(chestChance) && openTiles.length !== 0){
   // `openTiles` is collected AFTER the shop chamber is carved, so the chamber's
   // floor is in the pool. A chest inside the stall blocks the room and can even
   // seal the merchant in, so it is filtered out here.
   let pick = null;
   for(let t = 0; t !== openTiles.length; t++){
    const cand = openTiles.splice(Math.floor(Math.random()*openTiles.length), 1)[0];
    if(G.grid[cand.y][cand.x] !== T().FLOOR) continue;
    if(inShopRoom(cand.x, cand.y)) continue;
    pick = cand; break;
   }
   if(pick){
    G.grid[pick.y][pick.x] = T().CHEST;
    G.chests.push({ x:pick.x, y:pick.y, open:false });
   }
  }

  // normal monsters: distribute across rooms (skip spawn room) for even density
  const band = Delve.getMonsterBand(G.floor);
  // Floor 1 is the teaching floor: fewer, weaker bodies (CONFIG.openingFloor),
  // so the first minute is "this is how a fight works", not an attrition test.
  const open = (G.floor === 1) ? (C().openingFloor || {}) : {};
  let count = Delve.rng(band.countMin || 10, band.countMax || 14);
  if(open.monsters) count = Math.min(count, open.monsters);
  let placed = 0;
  // The entrance room stays clear so the player never lands in a pack. If the BSP
  // collapsed to a single room, use it anyway — an empty floor is worse than a
  // tight start.
  const usable = rooms.length > 1 ? rooms.slice(1) : rooms.slice(0);
  for(let ri = 0; ri !== usable.length && placed !== count; ri++){
   const room = usable[ri];
   const remaining = count - placed;
   const roomsLeft = usable.length - ri;
   const perHere = Math.ceil(remaining / roomsLeft);
   for(let k = 0; k !== perHere && placed !== count; k++){
    // Clamp the scatter to the room's interior. A room sitting near the map edge
    // used to hand spawnMonster a coordinate off the grid; now it slides back in.
    const ox = Math.max(room.x, Math.min(room.x + room.w - 1, room.cx + Delve.rng(-2, 2)));
    const oy = Math.max(room.y, Math.min(room.y + room.h - 1, room.cy + Delve.rng(-2, 2)));
    if(spawnMonster(G, ox, oy, band)) placed = placed + 1;
   }
  }
  // Guarantee the band's population. The per-room pass above is a best-effort
  // scatter and can come up short when rooms merge into blobs, when patches or
  // props eat the offsets, or when the map produces few rooms. Sweep every open
  // floor tile until the count is met, so a floor is never left near-empty.
  if(placed < count){
   const spare = [];
   for(let sy = 1; sy !== G.gridH - 1; sy++){
    for(let sx = 1; sx !== G.gridW - 1; sx++){
     const st = G.grid[sy][sx];
     if((st === T().FLOOR || st === T().GRASS) && !leq(Delve.mdist(sx, sy, G.px, G.py), 2)) spare.push({ x:sx, y:sy });
    }
   }
   // Shuffle: without it the fallback always fills from the top-left corner.
   for(let i = spare.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = spare[i]; spare[i] = spare[j]; spare[j] = tmp;
   }
   for(let i = 0; i !== spare.length && placed !== count; i++){
    if(spawnMonster(G, spare[i].x, spare[i].y, band)) placed = placed + 1;
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
      // Never carve onto the map's outer ring. A false wall one tile in from the
      // edge would punch FLOOR through row 0 / column 0 (or leave floor sitting
      // against the VOID ring with no stone between), which is the "room running
      // off the top of the screen" report. The ring stays sealed stone.
      if(yy === 0 || yy === G.gridH - 1 || xx === 0 || xx === G.gridW - 1) continue;
      if(G.grid[yy] && G.grid[yy][xx] === T().WALL) G.grid[yy][xx] = T().FLOOR;
     }
    }
    G.grid[w.y][w.x] = T().CHEST;
    G.chests.push({ x:w.x, y:w.y, open:false, secret:true });
    G.floorData.secretRoom = { falseWallX:w.x, falseWallY:w.y };
   }
  }
  // Seal the rooms and the map edge. Every painted room's one-tile border is
  // forced back to stone wherever a later pass chipped it into VOID, and the
  // map's outermost ring can never be walkable — so a room that reaches the
  // top (or any) edge of the map is always closed off by wall instead of
  // running into blank space.
  all.forEach(function(r){
   if(!r.painted) return;
   for(let x = r.left; x <= r.right; x++){
    if(G.grid[r.top] && G.grid[r.top][x] === T().VOID) G.grid[r.top][x] = T().WALL;
    if(G.grid[r.bottom] && G.grid[r.bottom][x] === T().VOID) G.grid[r.bottom][x] = T().WALL;
   }
   for(let y = r.top; y <= r.bottom; y++){
    if(G.grid[y] && G.grid[y][r.left] === T().VOID) G.grid[y][r.left] = T().WALL;
    if(G.grid[y] && G.grid[y][r.right] === T().VOID) G.grid[y][r.right] = T().WALL;
   }
  });
  // Hard cap on the map's outer ring. Any walkable tile sitting ON the ring
  // becomes stone, and any ring cell whose inward neighbour is walkable becomes
  // stone too — so a room that reaches the edge is always closed off by a drawn
  // wall instead of running straight into the black VOID band. Cells with no
  // room behind them stay VOID, which is what keeps the ragged map silhouette.
  const walkable = function(v){ return v !== undefined && v !== T().WALL && v !== T().VOID; };
  for(let x = 0; x !== G.gridW; x++){
   if(walkable(G.grid[0][x])) G.grid[0][x] = T().WALL;
   if(walkable(G.grid[G.gridH-1][x])) G.grid[G.gridH-1][x] = T().WALL;
   if(G.grid[0][x] === T().VOID && walkable(G.grid[1][x])) G.grid[0][x] = T().WALL;
   if(G.grid[G.gridH-1][x] === T().VOID && walkable(G.grid[G.gridH-2][x])) G.grid[G.gridH-1][x] = T().WALL;
  }
  for(let y = 0; y !== G.gridH; y++){
   if(walkable(G.grid[y][0])) G.grid[y][0] = T().WALL;
   if(walkable(G.grid[y][G.gridW-1])) G.grid[y][G.gridW-1] = T().WALL;
   if(G.grid[y][0] === T().VOID && walkable(G.grid[y][1])) G.grid[y][0] = T().WALL;
   if(G.grid[y][G.gridW-1] === T().VOID && walkable(G.grid[y][G.gridW-2])) G.grid[y][G.gridW-1] = T().WALL;
  }

  // Seal interior void pockets. Phase 6 above leaves unconnected BSP leaves as
  // VOID ("never painted"), and a merge, a door or the secret-room carve can open
  // a painted room onto one of those leaves — leaving a hole in the wall that the
  // renderer fills with pure black. That is the "wall missing, just showing the
  // void" report. So any VOID cell sitting directly against a walkable tile is
  // forced back to stone. Void that only touches stone stays VOID, which keeps the
  // ragged map silhouette and the black band beyond the walls intact.
  const sealable = function(v){ return v !== undefined && v !== T().WALL && v !== T().VOID; };
  const voidHoles = [];
  for(let y = 0; y !== G.gridH; y++){
   for(let x = 0; x !== G.gridW; x++){
    if(G.grid[y][x] !== T().VOID) continue;
    const up = G.grid[y-1] ? G.grid[y-1][x] : undefined;
    const dn = G.grid[y+1] ? G.grid[y+1][x] : undefined;
    if(sealable(up) || sealable(dn) || sealable(G.grid[y][x-1]) || sealable(G.grid[y][x+1]))
     voidHoles.push([x, y]);
   }
  }
  voidHoles.forEach(function(c){ G.grid[c[1]][c[0]] = T().WALL; });

  // Wall-fed puddles (js/puddles.js) — after every prop is placed, so a pool can
  // never cover a chest, barrel, gold pile or monster, and before the ground
  // cover/growth, which only dress plain FLOOR. A failure here must never abort
  // floor generation, exactly like growth below.
  try {
    if (typeof Delve.placePuddles === "function") Delve.placePuddles(G);
  } catch (e) {
    if (Delve.logSystem) Delve.logSystem("Puddles skipped: " + e.message);
  }
  // Biome ground cover (Batch 16) — placed last so it avoids the stairs, shop,
  // chests and monsters this floor has just laid down.
  Delve.placeGroundCover(G);
  // Ward growth (js/growth/core.js) — rolled per room after everything else is
  // placed. Guarded + try/caught so a growth failure (missing file, runtime
  // error) can NEVER abort floor generation: the monster spawning loop, the
  // chests and the rest of this floor must always be laid down.
  try {
    if (typeof Delve.placeGrowth === "function") Delve.placeGrowth(G);
  } catch (e) {
    if (Delve.logSystem) Delve.logSystem("Growth skipped: " + e.message);
  }
  // Starter gear (CONFIG.openingFloor.starterGear): on floor 1 only, drop one
  // weapon and one armour piece near the player so the first fight happens with
  // a real weapon in hand rather than fists. Placed at the end so it lands on
  // clear floor, and only if the player is not already carrying a weapon (a
  // resumed run or a purchased starting kit must not get a second free set).
  try {
    const openCfg = C().openingFloor || {};
    if(G.floor === 1 && openCfg.starterGear && !(G.equip && G.equip.weapon)){
      const spots = [];
      for(let y = 1; y < G.gridH - 1 && spots.length < 2; y++){
        for(let x = 1; x < G.gridW - 1 && spots.length < 2; x++){
          if(G.grid[y][x] !== T().FLOOR) continue;
          if(x === G.px && y === G.py) continue;
          if(Delve.mdist(x, y, G.px, G.py) > 3) continue;
          if(Delve.eventAt && Delve.eventAt(x, y)) continue;
          if(G.items.some(function(i){ return i.x === x && i.y === y; })) continue;
          spots.push({ x:x, y:y });
        }
      }
      const wantSlots = ["weapon", "body"];
      for(let i = 0; i < spots.length && i < wantSlots.length; i++){
        const it = Delve.makeGear ? Delve.makeGear(wantSlots[i], 1, { tier:1 }) : null;
        if(!it) continue;
        it.x = spots[i].x; it.y = spots[i].y;
        if(Delve.stampProvenance) Delve.stampProvenance(it, { kind:"starter" });
        G.items.push(it);
      }
    }
  } catch (e) {
    if (Delve.logSystem) Delve.logSystem("Starter gear skipped: " + e.message);
  }

  // One optional floor event (js/encounters.js), placed last: it only chooses a
  // plain walkable tile, so it can never displace a chest, a monster or the stairs.
  try {
    if (typeof Delve.placeFloorEvent === "function") Delve.placeFloorEvent(G);
  } catch (e) {
    if (Delve.logSystem) Delve.logSystem("Floor event skipped: " + e.message);
  }
 };

 // monster spawn helper: respects safety radius and tile state
 function spawnMonster(G, x, y, band){
  // Bounds first: a scatter offset from a room near the map edge could land on
  // row -1 or row gridH. G.grid[y] was undefined there and the dereference threw,
  // aborting genFloor halfway — which left the floor with no monsters AND no
  // edge sealing. That single throw caused both reported bugs.
  if(!G.grid[y] || G.grid[y][x] === undefined) return null;
  if(leq(Delve.mdist(x,y,G.px,G.py), 2)) return null;
  // Nothing spawns inside the shop chamber: a merchant with a monster on his
  // doorstep would mean being attacked while shopping.
  if(G.shop && G.shop.room){
   const r = G.shop.room;
   if(x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h) return null;
  }
  const tile = G.grid[y][x];
  if(tile !== T().FLOOR && tile !== T().GRASS) return null;
  const kind = Delve.pickWeighted(band.weights);
  if(!kind) return null;
  const row = C().MONSTER_ROSTER[kind] || C().MONSTER_ROSTER.goblin;
  const m = {
   id:"m"+Date.now()+"_"+Math.floor(Math.random()*99999),
   kind: row.kind, name: row.name,
   x:x, y:y,
   tile: tile,
   maxHp: openScale(G, row.hp + Math.floor((G.floor-1) * row.hpPerFloor), "monsterHpPct"),
   atk: openScale(G, row.atk + Math.floor(G.floor * row.atkPerFloor), "monsterAtkPct"),
   speed: row.speed,
   xp: row.xp, shards: row.shards, gold: row.gold,
   // Roster flags the kill path reads off the INSTANCE must be carried across.
   // `reassembleOnce` (the Ossuary's Reassembled) was read from m but never
   // copied from the row, so its gimmick could never fire — it just died.
   // `splitOnDeath` (the Forge's Reforged) is the same trap: killMonster gates
   // the split on m.splitOnDeath, so without this line the whole branch is dead
   // code and The Reforged dies like any other monster.
   reassembleOnce: !!row.reassembleOnce,
   splitOnDeath: row.splitOnDeath || null,
   // Combat texture the damage path reads off the INSTANCE. Same trap as the
   // two flags above: a roster field that is not copied here simply never
   // fires, and nothing errors to tell you.
   armour: row.armour || 0,
   // Enrage is rolled per INSTANCE, not granted to every copy of the species.
   // Measured before this: floor 45 had 15 of 22 enemies able to enrage, so the
   // worst-case burst reached 85% of max HP — a floor that could kill you
   // through volume rather than bad positioning. At the configured roll rate the
   // same floor carries roughly 3, which keeps "some hounds frenzy" as a
   // warning without turning the ward into a damage race.
   enrageAt: (row.enrageAt && Math.random() < enrageChance()) ? row.enrageAt : 0,
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
    const it = Delve.makeItem(tier, { unique:true, kind: (source && source.kind === "secret") ? "secret" : "chest" });
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
   const it = Delve.makeItem(tier, { unique:true, kind: (source && source.kind === "secret") ? "secret" : "chest" });
   it.x = x; it.y = y;
   Delve.stampProvenance(it, source);
   G.items.push(it);
   Delve.dropPotion(x, y, 3, source);
   const mult = Delve.goldMult ? Delve.goldMult() : 1;
   const gold = Math.round((30 + Math.floor(Math.random()*20) + G.floor*3) * mult);
   G.gold += gold;
   Delve.recordStat("goldEarned", gold);
   Delve.addFloater("+" + gold + "g", x, y, "#ffd75e");
   if(Delve.maybeAmbush) Delve.maybeAmbush("chest");
   Delve.updateHUD();
   Delve.draw();
   return;
  }

  if(prob(0.45)){
   let tier = Delve.rollTier(G.floor, (Delve.CONFIG.loot.sourceRarityMult || {}).chest || 1);
   if(Delve.hasProgression && Delve.hasProgression("lucky_find")) tier = Math.min(4, tier+1);
   const it = Delve.makeItem(tier, { unique:true, kind: (source && source.kind === "secret") ? "secret" : "chest" });
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
  // An opened chest is a noise. The contents are already out by now, so an
  // ambush can never cost the player the thing they just found.
  if(Delve.maybeAmbush) Delve.maybeAmbush("chest");
  Delve.updateHUD();
  Delve.draw();
 };

})();
