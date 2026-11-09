window.Delve = window.Delve || {};
(function(){
 const T = () => Delve.T;
 const C = () => Delve.CONFIG;

 // pursuit.js : monsters that have noticed the player take one step toward them
 // for each step the player takes. Nothing here draws; render.js eases the
 // sprite between the two tiles, so the move reads as walking and the square
 // grid is never visible.
 //
 // Rules, all deliberate:
 //  · A monster stays asleep until it has line of sight inside the wake radius,
 //    or until the player hits it. Most of a floor therefore stays still.
 //  · One step per player action, taken from enemiesTurn(). A monster that took
 //    a step does not also attack that turn.
 //  · Occupied tiles are blocked, and a monster never steps onto the player.
 //  · It will not stray more than `leash` tiles from where it woke, so nothing
 //    follows you across the floor or parks on the stairs.
 //  · Only FLOOR, GRASS and DOOR are steppable. Chests, gold, items, barrels,
 //    stairs and water are never blocked, stolen or covered.

 const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];

 function cfg(){
  const c = C() && C().PURSUIT;
  return c || { radius:5, leash:9, wakeOnDamage:true };
 }

 function tileAt(G, x, y){
  if(!G || !G.grid || !G.grid[y]) return undefined;
  return G.grid[y][x];
 }

 function steppable(G, x, y){
  const t = tileAt(G, x, y);
  return t === T().FLOOR || t === T().GRASS || t === T().DOOR;
 }

 // Dropped loot does NOT set a tile: the ground stays FLOOR and only G.items
 // records the drop. A monster that stepped onto one would hide it under its
 // body until it moved again, so those tiles are refused outright.
 function hasLoot(G, x, y){
  const items = G.items || [];
  for(let i = 0; i < items.length; i++){
   if(items[i].x === x && items[i].y === y) return true;
  }
  if(G.floorEvent && !G.floorEvent.used && G.floorEvent.x === x && G.floorEvent.y === y) return true;
  return false;
 }

 // For the distance field only: another monster's tile is passable, because it
 // is expected to move. Occupancy is checked again at the moment of the step,
 // which is what actually prevents two bodies sharing a tile.
 function fieldWalkable(G, x, y){
  const t = tileAt(G, x, y);
  return steppable(G, x, y) || t === T().MONSTER || t === T().BOSS;
 }

 // Straight line between two tiles; WALL and VOID block sight. Endpoints are
 // never tested, so a monster standing in a doorway can still see out of it.
 function hasLos(G, x0, y0, x1, y1){
  const steps = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
  if(steps <= 1) return true;
  for(let i = 1; i < steps; i++){
   const x = Math.round(x0 + (x1-x0) * i / steps);
   const y = Math.round(y0 + (y1-y0) * i / steps);
   const t = tileAt(G, x, y);
   if(t === undefined) return false;
   if(t === T().WALL || t === T().VOID) return false;
  }
  return true;
 }

 // Distance-to-player over walkable tiles, cached for one player position. A
 // monster that cannot close the straight-line gap (a corner, a corridor mouth)
 // still has a descending path to follow, so it never grinds against a wall it
 // can see around.
 function field(G){
  const key = G.px + "," + G.py + "," + G.floor;
  if(G._purField && G._purFieldKey === key) return G._purField;

  const w = G.gridW || (G.grid && G.grid[0] ? G.grid[0].length : 0);
  const h = G.gridH || (G.grid ? G.grid.length : 0);
  if(!w || !h) return null;

  const dist = new Int16Array(w * h);
  dist.fill(-1);
  const start = G.py * w + G.px;
  if(start < 0 || start >= dist.length) return null;

  dist[start] = 0;
  const queue = [start];
  for(let qi = 0; qi < queue.length; qi++){
   const cur = queue[qi];
   const cx = cur % w, cy = (cur - cx) / w;
   const d = dist[cur] + 1;
   for(let k = 0; k < 4; k++){
    const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
    if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = ny * w + nx;
    if(dist[ni] !== -1) continue;
    if(!fieldWalkable(G, nx, ny) && !(nx === G.px && ny === G.py)) continue;
    dist[ni] = d;
    queue.push(ni);
   }
  }

  G._purField = { dist: dist, w: w, h: h };
  G._purFieldKey = key;
  return G._purField;
 }

 // Returns true when the monster took a step, so the caller skips its attack:
 // closing the gap and striking in the same turn would give it two actions.
 Delve.pursuitStep = function(m){
  const G = Delve.G;
  if(!G || !m || m.isBoss) return false;
  if(G.dead || G.runEnded || G.hp <= 0) return false;
  if(!G.grid || !G.grid.length) return false;

  const c = cfg();
  if(m.spawnX === undefined){ m.spawnX = m.x; m.spawnY = m.y; }

  if(Delve.mdist(G.px, G.py, m.x, m.y) <= 1){ m.awake = true; return false; }  // ambientMob swings

  if(!m.awake){
   if(c.wakeOnDamage !== false && m.hitFlash) m.awake = true;
   else if(Delve.mdist(G.px, G.py, m.x, m.y) <= c.radius && hasLos(G, m.x, m.y, G.px, G.py)) m.awake = true;
   else return false;
  }

  const f = field(G);
  if(!f) return false;
  const w = f.w, h = f.h;
  if(m.y < 0 || m.y >= h || m.x < 0 || m.x >= w) return false;

  const hereD = f.dist[m.y * w + m.x];
  let bestX = -1, bestY = -1, bestD = Infinity;

  for(let k = 0; k < 4; k++){
   const nx = m.x + DIRS[k][0], ny = m.y + DIRS[k][1];
   if(nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
   if(nx === G.px && ny === G.py) continue;
   if(!steppable(G, nx, ny)) continue;
   if(tileAt(G, nx, ny) === T().MONSTER) continue;
   if(hasLoot(G, nx, ny)) continue;   // never stand on a drop and hide it
   if(Delve.mdist(nx, ny, m.spawnX, m.spawnY) > c.leash) continue;
   const nd = f.dist[ny * w + nx];
   if(nd === -1) continue;
   if(nd < bestD){ bestD = nd; bestX = nx; bestY = ny; }
  }

  // With a known path, only step along it (a lower number). Without one — it is
  // boxed in by tiles the flood fill does not cross — accept any step that is at
  // least no further away, so it can work around a chest rather than stall.
  if(bestX === -1) return false;
  if(hereD !== -1 && bestD >= hereD) return false;

  // Move. `m.tile` is the ground under the monster, which is what killMonster
  // restores; carry the destination's own tile so a step off grass stays grass.
  const under = steppable(G, bestX, bestY) ? tileAt(G, bestX, bestY) : T().FLOOR;
  G.grid[m.y][m.x] = m.tile || T().FLOOR;
  m.mvFromX = m.x; m.mvFromY = m.y; m.mvAt = Date.now();
  m.x = bestX; m.y = bestY;
  m.tile = under;
  G.grid[m.y][m.x] = T().MONSTER;

  // No redraw request needed: render.js's animating() test repaints while any
  // monster is between two tiles, which is exactly this window.
  return true;
 };

})();
