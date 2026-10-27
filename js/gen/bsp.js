window.Delve = window.Delve || {};
(function(){

 // ── gen/bsp.js : BSP partitioning + room graph ───────────────
 // Pure floor-plan machinery, lifted verbatim out of levels.js so that file can
 // stay about *content* (ward rules, special floors, boss arenas, spawns) while
 // the geometry lives here.
 //
 // Nothing in this file touches run state: no G, no save, no DOM. The only
 // outward dependencies are Delve.rng (js/util.js) and Delve.T (js/state.js),
 // both resolved at call time. That is what makes the move safe — every body
 // below is a character-for-character copy of what used to be in levels.js.
 //
 // A faithful port of the source's generator: rooms come from recursively
 // partitioning the map block (RegularLevel.split), neighbours are rooms that
 // share a wall line of 3+ tiles, and connections are routed over that graph.
 //
 // CONVENTION: room rects are {left, top, right, bottom} with right/bottom
 // INCLUSIVE when painting, while the width/height used by every split rule is
 // the exclusive measure right-left / bottom-top — exactly how the Java source's
 // width() behaves. Painted span is [left..right]; interior is [left+1..right-1].

 const T = function(){ return Delve.T; };

 Delve.gen = Delve.gen || {};

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

 // Public surface. levels.js destructures these back into local names, so its
 // call sites read exactly as they did when this code lived there.
 Delve.gen.splitRect     = splitRect;
 Delve.gen.splitAt       = splitAt;
 Delve.gen.intersectLine = intersectLine;
 Delve.gen.edgeKey       = edgeKey;
 Delve.gen.graphPath     = graphPath;
 Delve.gen.distFrom      = distFrom;
 Delve.gen.dijkstraPath  = dijkstraPath;
 Delve.gen.paintRoom     = paintRoom;
 Delve.gen.tryMerge      = tryMerge;

})();
