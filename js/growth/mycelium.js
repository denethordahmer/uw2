window.Delve = window.Delve || {};
(function(){
  // ── js/growth/mycelium.js : ivory mycelium WEBBING (The Blackvein) ──
  // Biome 2's own growth form. The owner's note on the first pass was exact: it
  // read as more of biome 1's moss, because its palette was still yellow-green
  // and its shape was a handful of parallel strands. Both are fixed here —
  // mycelium is now IVORY: dense pale cream threads that fan out of a wall base
  // and cross-link into cobweb mats, the way real fungal mycelium runs under
  // soil. Nothing about it is green, so it cannot be mistaken for the Ruins'
  // moss, nor for the Blackvein's thorn/vine clutter.
  //
  // The framework (rooms, anchors, bake cache, wall climbs) is js/growth/core.js;
  // this file only decides what the growth looks like. Shape data is generated in
  // TILE units at placement (so the tiles it crosses can link walls without
  // baking anything), then stamped pixel by pixel at 16 fine px/tile at draw.

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

  // Walk one thread: a 1-px crawl that wanders (no rings, no blobs — webbing is
  // straight-ish filaments that fork). Returns the point list in tile units.
  function walk(G, x0, y0, ang0, steps, rnd, curl){
    const pts = [];
    let ang = ang0, x = x0, y = y0;
    for(let s = 0; s < steps; s++){
      const t = steps <= 1 ? 1 : s / (steps - 1);
      ang += (rnd() - 0.5) * curl;
      x += Math.cos(ang) / PX;
      y += Math.sin(ang) / PX;
      const tx = Math.floor(x), ty = Math.floor(y);
      const row = G.grid[ty];
      if(!row || row[tx] !== T().FLOOR) break;   // never off plain floor
      pts.push([x, y, t]);
    }
    return pts;
  }

  // A whole colony: 3-5 primary filaments fanning out of the anchor, each forking
  // 2-3 times, then CROSS-LINKS between filaments near the base. The links are
  // what turn a spray of threads into webbing.
  function growWeb(G, spot, rnd){
    const threads = [];
    const reachPx = spot.reach * PX;
    const heading = Math.atan2(spot.dirY, spot.dirX);
    const curl = 0.10 + rnd() * 0.16;
    const nMain = 3 + Math.floor(rnd() * 3);          // 3-5 primary filaments
    const fan = 1.15 + rnd() * 0.55;                  // how wide the fan opens
    for(let i = 0; i < nMain; i++){
      const a = heading + ((i / (nMain - 1)) - 0.5) * fan;
      threads.push(walk(G, spot.x + 0.5, spot.y + 0.5, a,
                        Math.round(reachPx * (0.70 + rnd() * 0.55)), rnd, curl));
    }
    // forks: children leave an existing thread at a wide angle, shorter each time
    const base = threads.slice();
    for(let i = 0; i < base.length; i++){
      const pts = base[i];
      if(pts.length < 8) continue;
      const nFork = 1 + Math.floor(rnd() * 2.4);
      for(let f = 0; f < nFork; f++){
        const at = 3 + Math.floor(rnd() * (pts.length - 6));
        const p = pts[at];
        const ang = Math.atan2(p[1] - pts[Math.max(0, at - 1)][1], p[0] - pts[Math.max(0, at - 1)][0])
                  + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.55);
        const child = walk(G, p[0], p[1], ang,
                           Math.max(5, Math.round((pts.length - at) * (0.55 + rnd() * 0.45))), rnd, curl * 1.2);
        if(child.length > 3) threads.push(child);
      }
    }
    // cross-links: join points on DIFFERENT threads when they pass close by, but
    // only inside the mat radius — the fringes stay open filaments.
    const links = [];
    const pool = [];
    for(let i = 0; i < threads.length; i++){
      const pts = threads[i];
      for(let k = 0; k < pts.length; k += 2){
        if(Math.hypot(pts[k][0] - (spot.x + 0.5), pts[k][1] - (spot.y + 0.5)) <= spot.reach * 0.75){
          pool.push({ x: pts[k][0], y: pts[k][1], th: i, k: k });
        }
      }
    }
    const want = Math.min(26, Math.round(spot.reach * spot.reach * 5));
    for(let attempt = 0; attempt < 220 && links.length < want; attempt++){
      const a = pool[(rnd() * pool.length) | 0];
      const b = pool[(rnd() * pool.length) | 0];
      if(!a || !b || a.th === b.th) continue;
      if(Math.abs(a.k - b.k) < 3) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if(d < 0.18 || d > 0.85) continue;
      links.push([[a.x, a.y], [b.x, b.y]]);
    }
    return { threads: threads.filter(p => p.length > 2), links: links };
  }

  // Place one colony: anchor, web, blit frame, and the wall links its threads
  // earn by reaching stone.
  function addColony(G, tiles, mc, U, spots, climbs, big){
    const pick = U.pickAnchor(G, tiles, mc);
    if(!pick) return;
    const seed = 1 + Math.floor(Math.random() * 2147483646);
    const rnd = U.rngFrom(seed);
    const spot = {
      style: "mycelium",
      x: pick.x, y: pick.y,
      dirX: pick.dx, dirY: pick.dy,
      reach: reachRoll(mc, big) * 2.2,      // threads reach further than a blob's radius
      seed: seed,
      walls: pick.sides.map(function(s){
        return { x: pick.x + s.dx, y: pick.y + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    const web = growWeb(G, spot, rnd);
    if(!web.threads.length) return;
    spot.paths = web.threads;              // the same field name every form uses
    spot.links = web.links;

    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const touched = {};
    const note = function(x, y){
      if(x < minX) minX = x;
      if(x > maxX) maxX = x;
      if(y < minY) minY = y;
      if(y > maxY) maxY = y;
      touched[Math.floor(x) + "," + Math.floor(y)] = 1;
    };
    spot.paths.forEach(function(st){ st.forEach(function(p){ note(p[0], p[1]); }); });
    (spot.links || []).forEach(function(l){ note(l[0][0], l[0][1]); note(l[1][0], l[1][1]); });
    spot.cx = (minX + maxX) / 2;
    spot.cy = (minY + maxY) / 2;
    spot.r = Math.max(maxX - minX, maxY - minY) / 2 + 0.6;
    spot.minX = minX; spot.maxX = maxX; spot.minY = minY; spot.maxY = maxY;
    spots.push(spot);

    // linked walls: threads that reach stone send a climb up it, at most 2
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
    for(let i = 0; i < spot.walls.length && linked < 3; i++) climbs.push(spot.walls[i]);
  }


  Delve.registerGrowthStyle("mycelium", {
    // Ivory, not green: a dark root under the soil running to near-white tips.
    palette: function(bm){ return bm.growthVeinPal || bm.growthPal; },

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
      const pad = 6;
      const half = Math.max(8, Math.ceil(Math.max(
        (spot.maxX - spot.minX) * PX, (spot.maxY - spot.minY) * PX) / 2 + pad));
      const S = half * 2;
      const b = U.newBake(S);
      const d = b.d;
      const shadesRGB = U.shades(Math.min(2.4, spot.reach), pal);
      const nShades = shadesRGB.length;
      const ox = spot.cx * PX - half, oy = spot.cy * PX - half;
      const ax = (spot.x + 0.5) * PX - ox, ay = (spot.y + 0.5) * PX - oy;

      function put(px, py, si, alpha){
        const i = Math.round(px), j = Math.round(py);
        if(i < 0 || j < 0 || i >= S || j >= S) return;
        const tx = Math.floor((ox + i + 0.5) / PX), ty = Math.floor((oy + j + 0.5) / PX);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) return;     // never over the furniture
        const col = shadesRGB[Math.max(0, Math.min(nShades - 1, si))];
        const o = (j * S + i) * 4;
        const a = alpha === undefined ? 235 : alpha;
        // keep the brightest of the two if a pixel is painted twice
        if(d[o + 3] > a) return;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a;
      }

      // the mat: a soft, dithered cream haze right at the wall base, so the web
      // looks rooted in a colony rather than sprayed on. Low alpha on purpose —
      // it must read as growth under the soil, not a white circle.
      const matR = spot.reach * 0.34 * PX;
      for(let j = -matR; j <= matR; j++){
        for(let i = -matR; i <= matR; i++){
          const dd = Math.hypot(i, j) / matR;
          if(dd > 1) continue;
          if(Delve.hash3(((i + 64) | 0), ((j + 64) | 0), spot.seed & 511) > 0.13 - dd * 0.09) continue;
          put(ax + i, ay + j, dd < 0.55 ? 2 : 1, 74);
        }
      }
      // filaments: one fine pixel each, with a plus every few steps for fuzz
      spot.paths.forEach(function(pts){
        for(let k = 0; k < pts.length; k++){
          const p = pts[k];
          const px = p[0] * PX - ox, py = p[1] * PX - oy;
          const si = Math.round(p[2] * (nShades - 1));
          put(px, py, si, 232);
          if(k % 6 === 3 && Delve.hash3(k, 5, spot.seed & 255) < 0.5){
            put(px + 1, py, si, 190); put(px - 1, py, si, 190);
            put(px, py + 1, si, 190); put(px, py - 1, si, 190);
          }
        }
        // a couple of bright specks past the tip — the growing frontier
        const tip = pts[pts.length - 1];
        const tx2 = tip[0] * PX - ox, ty2 = tip[1] * PX - oy;
        for(let s = 0; s < 2; s++){
          const a = Delve.hash3(s, pts.length, spot.seed & 127) * Math.PI * 2;
          const rr = 1.1 + Delve.hash3(s, 9, spot.seed & 63) * 1.9;
          put(tx2 + Math.cos(a) * rr, ty2 + Math.sin(a) * rr, nShades - 1, 210);
        }
      });
      // cross-links: straight 1-px bridges, dimmer than the filaments, so the
      // mat reads as a web and the open fringes still read as threads
      (spot.links || []).forEach(function(l){
        const x0 = l[0][0] * PX - ox, y0 = l[0][1] * PX - oy;
        const x1 = l[1][0] * PX - ox, y1 = l[1][1] * PX - oy;
        const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)));
        for(let s = 0; s <= steps; s++){
          const f = s / steps;
          put(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 2, 150);
        }
      });
      return U.commitBake(b);
    },

    // Ivory threads climbing the stone, not leafy stems.
    wallDesigns: function(C){ return C.WALL_MYCELIUM || C.WALL_MOSS || []; }
  });
})();

