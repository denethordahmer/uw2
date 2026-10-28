window.Delve = window.Delve || {};
(function(){
  // ── js/growth/mycelium.js : the Blackvein's veins ──────────────
  // Biome 2's own growth form (the owner's call: wet forest floors sprout veins,
  // not the Ruins' lobes). A colony is a handful of THIN branching strands that
  // crawl out of a wall base or a corner, wander, fork 2-3 deep and thin toward
  // their tips — mycelium threads, not a carpet. Its shapes vary widely on
  // purpose: each colony rolls a heading, a curl, a branching rate, a width and
  // a reach, and roughly one in six instead curls all the way round into a
  // fairy ring.
  //
  // Everything is stamped pixel by pixel at 16 fine pixels per tile (no canvas
  // strokes), so the strands stay crisp at any zoom, and only plain FLOOR
  // takes paint. The strands' tile positions are recorded while placing, which
  // is how a wall learns it has mycelium climbing it (the linked rule) without
  // baking anything at generation time.

  const PX = 16;
  const T = function(){ return Delve.T; };

  function reachRoll(mc, big){
    if(big){
      const lo = mc.bigSizeMin !== undefined ? mc.bigSizeMin : 1.15;
      const hi = mc.bigSizeMax !== undefined ? mc.bigSizeMax : 1.9;
      return lo + Math.random() * Math.max(0, hi - lo);
    }
    const lo = mc.sizeMin !== undefined ? mc.sizeMin : 0.45;
    const hi = mc.sizeMax !== undefined ? mc.sizeMax : 0.95;
    return lo + Math.random() * Math.max(0, hi - lo);
  }

  // Grow the strands in tile units. Returns [{ pts:[[x,y,t,w]…], ring:bool }]
  // with x/y in TILE units (so a spot can be reasoned about without a canvas).
  function growStrands(G, spot, rnd){
    const strands = [];
    const ring = rnd() < 0.18;
    const reachPx = spot.reach * PX;               // how far a strand travels
    const curl = ring ? (2 * Math.PI * (0.7 + rnd() * 0.3)) : 0;
    const jitter = ring ? 0.06 : 0.16 + rnd() * 0.22;
    const branchP = (0.012 + rnd() * 0.030) * 3;   // forks per step, capped by size below
    const width0 = 0.55 + rnd() * 0.35;            // fine px: a thread, not a smear
    const origin = [spot.x + 0.5, spot.y + 0.5];
    const queue = [{ x: origin[0], y: origin[1], ang: Math.atan2(spot.dirY, spot.dirX),
                     steps: Math.round(reachPx * (0.85 + rnd() * 0.45)), depth: 0 }];
    let guard = 0;
    while(queue.length && guard++ < 9){
      const q = queue.shift();
      const pts = [];
      let ang = q.ang, x = q.x, y = q.y;
      for(let s = 0; s < q.steps; s++){
        const t = q.steps <= 1 ? 1 : s / (q.steps - 1);
        ang += ring ? (curl / q.steps) : (rnd() - 0.5) * jitter;
        // pull gently back toward the colony's heading: veins creep OUT
        if(!ring){
          const want = Math.atan2(spot.dirY, spot.dirX);
          let d = want - ang;
          while(d > Math.PI) d -= Math.PI * 2;
          while(d < -Math.PI) d += Math.PI * 2;
          ang += d * 0.05;
        }
        x += Math.cos(ang) / PX;
        y += Math.sin(ang) / PX;
        // only where the floor is walkable plain stone
        const tx = Math.floor(x), ty = Math.floor(y);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) break;
        const w = Math.max(0.52, width0 * (1 - t * 0.35));
        pts.push([x, y, t, w]);
        if(q.depth < 3 && s > 11 && s < q.steps - 4 && rnd() < branchP * 4){
          const side = rnd() < 0.5 ? -1 : 1;
          queue.push({ x: x, y: y, ang: ang + side * (0.75 + rnd() * 0.75),
                       steps: Math.max(6, Math.round((q.steps - s) * (0.45 + rnd() * 0.35))),
                       depth: q.depth + 1 });
        }
      }
      if(pts.length > 2) strands.push({ pts: pts, ring: ring && q.depth === 0 });
    }
    return strands;
  }

  // Place one colony: anchor, strands, the blit frame, and the wall links its
  // strands earn by touching stone.
  function addColony(G, tiles, mc, U, spots, climbs, big){
    const pick = U.pickAnchor(G, tiles, mc);
    if(!pick) return;
    const seed = 1 + Math.floor(Math.random() * 2147483646);
    const rnd = U.rngFrom(seed);
    const spot = {
      style: "mycelium",
      x: pick.x, y: pick.y,
      dirX: pick.dx, dirY: pick.dy,
      reach: reachRoll(mc, big) * 2.2,      // strands travel further than a blob's radius
      seed: seed,
      walls: pick.sides.map(function(s){
        return { x: pick.x + s.dx, y: pick.y + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    spot.paths = growStrands(G, spot, rnd);
    if(!spot.paths.length) return;

    // frame the strands: centre + half-extent in tiles, plus the tile set they
    // cover (which is what links walls)
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const touched = {};
    spot.paths.forEach(function(st){
      st.pts.forEach(function(p){
        if(p[0] < minX) minX = p[0];
        if(p[0] > maxX) maxX = p[0];
        if(p[1] < minY) minY = p[1];
        if(p[1] > maxY) maxY = p[1];
        touched[Math.floor(p[0]) + "," + Math.floor(p[1])] = 1;
      });
    });
    spot.cx = (minX + maxX) / 2;
    spot.cy = (minY + maxY) / 2;
    spot.r = Math.max(maxX - minX, maxY - minY) / 2 + 0.6;
    spot.minX = minX; spot.maxX = maxX; spot.minY = minY; spot.maxY = maxY;

    spots.push(spot);

    // linked walls: a strand that reaches stone sends a climb up it, at most 2
    const keys = Object.keys(touched);
    let linked = 0;
    for(let i = 0; i < keys.length && linked < 2; i++){
      const xy = keys[i].split(",");
      const sides = U.wallSides(G, +xy[0], +xy[1]);
      for(let s = 0; s < sides.length && linked < 2; s++){
        climbs.push({ x: +xy[0] + sides[s].dx, y: +xy[1] + sides[s].dy,
                      dx: sides[s].dx, dy: sides[s].dy });
        linked++;
      }
    }
    // the anchor's own wall (if any) is always worth a climb: that is where the
    // colony is rooted
    for(let i = 0; i < spot.walls.length && linked < 3; i++) climbs.push(spot.walls[i]);
  }

  Delve.registerGrowthStyle("mycelium", {
    // Pale, damp threads read better than the moss green against brown soil.
    palette: function(bm){ return bm.growthVeinPal || bm.growthPal; },
    // Veins want to be seen: a large room often carries a second, smaller
    // colony rather than one giant patch.
    place: function(G, mc, pal, U){
      const spots = [], climbs = [];
      U.regions(G).forEach(function(tiles){
        if(tiles.length < 6) return;
        if(Math.random() > (mc.roomChance || 0.80)) return;
        const large = tiles.length >= (mc.largeArea || 40);
        const plan = [false];
        if(large && Math.random() < (mc.bigChance || 0.25)) plan[0] = true;
        if(Math.random() < (mc.largeChance || 0.55)) plan.push(false);
        for(let i = 0; i < plan.length; i++) addColony(G, tiles, mc, U, spots, climbs, plan[i]);
      });
      return { floor: spots, walls: climbs };
    },

    bake: function(spot, pal, U){
      const G = Delve.G;
      if(!G || !G.grid || !spot.paths || !spot.paths.length) return null;
      const pad = 6;                            // fine px of margin around the strands
      // whole-pixel half-extent: the canvas is then exactly S px wide, centred
      // on (cx, cy), so pixel i covers [i, i+1) and its centre is ox + i + 0.5 —
      // the same frame the moss form uses, and the one core blits with.
      const half = Math.max(8, Math.ceil(Math.max((spot.maxX - spot.minX) * PX, (spot.maxY - spot.minY) * PX) / 2 + pad));
      const S = half * 2;
      const b = U.newBake(S);
      const d = b.d;
      const shadesRGB = U.shades(Math.min(2.4, spot.reach), pal);
      const nShades = shadesRGB.length;
      // fine-px origin of the canvas within the map (px i covers [i, i+1), so
      // its CENTRE is ox + i + 0.5 — the same convention the moss form uses)
      const ox = spot.cx * PX - half, oy = spot.cy * PX - half;

      function put(px, py, si){
        const i = Math.round(px), j = Math.round(py);
        if(i < 0 || j < 0 || i >= S || j >= S) return;
        const tx = Math.floor((ox + i + 0.5) / PX), ty = Math.floor((oy + j + 0.5) / PX);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) return;   // never over the furniture
        const col = shadesRGB[Math.max(0, Math.min(nShades - 1, si))];
        const o = (j * S + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 235;
      }

      // stamp a round brush; the shade comes from the point's own progress
      function stamp(px, py, rad, si, salt){
        const r2 = rad * rad;
        const lo = Math.floor(-rad), hi = Math.ceil(rad);
        for(let j = lo; j <= hi; j++){
          for(let i = lo; i <= hi; i++){
            if(i * i + j * j > r2) continue;
            // dithered shade: grain, not a flat line
            let s = si;
            const h = Delve.hash3(i + 64, j + 64, salt);
            if(h < 0.18) s = s + 1;
            else if(h > 0.88) s = s - 1;
            put(px + i, py + j, s);
          }
        }
      }

      spot.paths.forEach(function(st){
        const pts = st.pts;
        for(let k = 0; k < pts.length; k++){
          const p = pts[k];
          const px = p[0] * PX - ox, py = p[1] * PX - oy;
          const si = Math.round(p[2] * (nShades - 1));
          stamp(px, py, p[3], si, spot.seed & 1023);
          // nodes: a fork or a ring point carries a fatter bead
          if(k % 7 === 0 && Delve.hash3(k, 3, spot.seed & 255) < 0.5){
            stamp(px, py, p[3] + 0.9, si + 1, spot.seed & 511);
          }
        }
        // spore dots near the tips, brightest shade, one pixel each
        const tip = pts[pts.length - 1];
        if(Delve.hash3(pts.length, 7, spot.seed & 255) < 0.75){
          const tx = tip[0] * PX - ox, ty = tip[1] * PX - oy;
          for(let s = 0; s < 3; s++){
            const a = Delve.hash3(s, pts.length, spot.seed & 127) * Math.PI * 2;
            const rr = 1.2 + Delve.hash3(s, 9, spot.seed & 63) * 2.2;
            put(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, nShades - 1);
          }
        }
      });
      return U.commitBake(b);
    },

    // Threads climbing stone, not the Ruins' leafy stems.
    wallDesigns: function(C){ return C.WALL_MYCELIUM || C.WALL_MOSS || []; }
  });
})();
