window.Delve = window.Delve || {};
(function(){
  // ── js/growth/frost.js : hoarfrost ferns (The Frosted Vault) ───
  // Biome 3's own growth form. Where the Ruins grow soft lobed moss and the
  // Blackvein grows wandering mycelium veins, the Vault grows ANGULAR ice:
  // hoarfrost dendrites that leave a wall base or corner as straight runs joined
  // by sharp turns, forking at crystal angles and ending in small points. It is
  // the same underlying system as the other forms (js/growth/core.js owns rooms,
  // anchors, baking, culling, wall climbs) — only the shape is different, which
  // is the whole point of one file per form.
  //
  // Dendrites are stamped pixel by pixel at 16 fine px/tile, only on plain FLOOR,
  // and the tiles they cross decide which walls get a matching climb.

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

  // Crystalline walk: mostly straight runs joined by discrete turns. `turn` is
  // the per-strand bias (positive or negative), so one frond curls one way and
  // its sibling the other — frost fans out in symmetric-ish pairs.
  function growFronds(G, spot, rnd){
    const fronds = [];
    const reachPx = spot.reach * PX;
    const turn = (rnd() < 0.5 ? -1 : 1) * (0.10 + rnd() * 0.16);
    const width0 = 0.52 + rnd() * 0.30;
    const forkEvery = 5 + Math.floor(rnd() * 5);
    // a fan, not a single hair: the anchor sends 2-3 fronds out at crystal angles
    const heading = Math.atan2(spot.dirY, spot.dirX);
    const queue = [];
    const nMain = 2 + (rnd() < 0.45 ? 1 : 0);
    for(let i = 0; i < nMain; i++){
      const spread = (i - (nMain - 1) / 2) * (0.55 + rnd() * 0.45);
      queue.push({ x: spot.x + 0.5, y: spot.y + 0.5,
                   ang: heading + spread,
                   steps: Math.round(reachPx * (0.75 + rnd() * 0.55)), depth: 0 });
    }
    let guard = 0;
    while(queue.length && guard++ < 16){
      const q = queue.shift();
      const pts = [];
      let ang = q.ang, x = q.x, y = q.y;
      for(let s = 0; s < q.steps; s++){
        const t = q.steps <= 1 ? 1 : s / (q.steps - 1);
        // 1 px forward, then a discrete turn: straight, slight, or hard
        const roll = rnd();
        ang += (roll < 0.55 ? 0.02 : roll < 0.74 ? 0.20 : roll < 0.90 ? 0.42 : 0.72) * turn
             + (rnd() - 0.5) * 0.05;
        // and a slow drift back toward the colony heading, so it still spreads out
        const want = Math.atan2(spot.dirY, spot.dirX);
        let d = want - ang;
        while(d > Math.PI) d -= Math.PI * 2;
        while(d < -Math.PI) d += Math.PI * 2;
        ang += d * 0.045;
        x += Math.cos(ang) / PX;
        y += Math.sin(ang) / PX;
        const tx = Math.floor(x), ty = Math.floor(y);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) break;
        const w = Math.max(0.52, width0 * (1 - t * 0.45));
        pts.push([x, y, t, w]);
        // forks at crystal angles, each a shorter, thinner sibling
        if(q.depth < 3 && s > 4 && s % forkEvery === 0 && rnd() < 0.72){
          const side = rnd() < 0.5 ? -1 : 1;
          queue.push({ x: x, y: y, ang: ang + side * (0.85 + rnd() * 0.45),
                       steps: Math.max(5, Math.round((q.steps - s) * (0.50 + rnd() * 0.30))),
                       depth: q.depth + 1 });
        }
      }
      if(pts.length > 2) fronds.push({ pts: pts });
    }
    return fronds;
  }

  // Place one colony: anchor, fronds, the blit frame, and the wall links its
  // fronds earn by reaching stone.
  function addColony(G, tiles, mc, U, spots, climbs, big){
    const pick = U.pickAnchor(G, tiles, mc);
    if(!pick) return;
    const seed = 1 + Math.floor(Math.random() * 2147483646);
    const rnd = U.rngFrom(seed);
    const spot = {
      style: "frost",
      x: pick.x, y: pick.y,
      dirX: pick.dx, dirY: pick.dy,
      reach: reachRoll(mc, big) * 2.0,
      seed: seed,
      walls: pick.sides.map(function(s){
        return { x: pick.x + s.dx, y: pick.y + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    spot.paths = growFronds(G, spot, rnd);
    if(!spot.paths.length) return;

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

    // linked walls: a frond that reaches stone sends a climb up it, at most 2
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

  Delve.registerGrowthStyle("frost", {
    // Icy threads read best paler than the floor: dark frozen root → white tips.
    palette: function(bm){ return bm.growthFrostPal || bm.growthPal; },

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

      function put(px, py, si){
        const i = Math.round(px), j = Math.round(py);
        if(i < 0 || j < 0 || i >= S || j >= S) return;
        // pixel centre, the same frame every form uses
        const tx = Math.floor((ox + i + 0.5) / PX), ty = Math.floor((oy + j + 0.5) / PX);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) return;
        const col = shadesRGB[Math.max(0, Math.min(nShades - 1, si))];
        const o = (j * S + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 235;
      }
      // hard-edged crystalline stamp: a single pixel, or a plus at the joints
      function stamp(px, py, rad, si){
        if(rad < 0.8){ put(px, py, si); return; }
        put(px, py, si);
        put(px + 1, py, si); put(px - 1, py, si);
        put(px, py + 1, si); put(px, py - 1, si);
      }

      spot.paths.forEach(function(st){
        const pts = st.pts;
        for(let k = 0; k < pts.length; k++){
          const p = pts[k];
          const px = p[0] * PX - ox, py = p[1] * PX - oy;
          const si = Math.round(p[2] * (nShades - 1));
          stamp(px, py, p[3], si);
          // a node bead where the strut thickens — the crystal joints
          if(k % 5 === 0 && Delve.hash3(k, 11, spot.seed & 255) < 0.45){
            stamp(px, py, 1, Math.min(nShades - 1, si + 1));
          }
        }
        // a bright point at the tip, and two short barbs: a frost crystal
        const tip = pts[pts.length - 1];
        const tx = tip[0] * PX - ox, ty = tip[1] * PX - oy;
        put(tx, ty, nShades - 1);
        if(Delve.hash3(pts.length, 5, spot.seed & 127) < 0.6){
          const a = Delve.hash3(1, pts.length, spot.seed & 63) * Math.PI;
          put(tx + Math.cos(a) * 1.6, ty + Math.sin(a) * 1.6, nShades - 1);
          put(tx - Math.cos(a) * 1.6, ty - Math.sin(a) * 1.6, nShades - 1);
        }
      });
      return U.commitBake(b);
    },

    // Crystalline fronds climbing the ice, not leafy stems or threads.
    wallDesigns: function(C){ return C.WALL_FROST || C.WALL_MOSS || []; }
  });
})();
