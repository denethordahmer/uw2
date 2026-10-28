window.Delve = window.Delve || {};
(function(){
  // ── js/growth/moss.js : the lobed moss patch (Upper Ruins) ─────
  // The original growth form: a wobbled, multi-lobed organic blob that grows
  // outward from a corner or a wall base. Never a square, never a clean circle,
  // no hard straight edge anywhere — the contact with the wall is eroded fine
  // pixel by fine pixel. Bigger patch = more gradient shades, the dark root
  // shade sits at the wall and the bright tips face open floor.
  //
  // The placement model (anchor, size roll, room plan) is shared, in
  // js/growth/core.js; this file only says what the shape looks like.

  const PX = 16;
  const T = function(){ return Delve.T; };

  // The size roll: between the ward's caps, with a higher pair for the one big
  // patch a large room may grow instead of two normal ones.
  function sizeRoll(mc, big){
    if(big){
      const lo = mc.bigSizeMin !== undefined ? mc.bigSizeMin : 1.15;
      const hi = mc.bigSizeMax !== undefined ? mc.bigSizeMax : 1.9;
      return lo + Math.random() * Math.max(0, hi - lo);
    }
    const lo = mc.sizeMin !== undefined ? mc.sizeMin : 0.45;
    const hi = mc.sizeMax !== undefined ? mc.sizeMax : 0.95;
    return lo + Math.random() * Math.max(0, hi - lo);
  }

  function addSpot(G, tiles, mc, U, spots, climbs, big){
    const pick = U.pickAnchor(G, tiles, mc);
    if(!pick) return;
    const size = sizeRoll(mc, big);
    const spot = {
      style: "moss",
      x: pick.x, y: pick.y,
      // the centre sits inside the anchor tile, nudged toward the wall
      ox: 0.5 - pick.dx * 0.14 + (Math.random() - 0.5) * 0.10,
      oy: 0.5 - pick.dy * 0.14 + (Math.random() - 0.5) * 0.10,
      size: size, dirX: pick.dx, dirY: pick.dy,
      seed: 1 + Math.floor(Math.random() * 2147483646),
      walls: pick.sides.map(function(s){
        return { x: pick.x + s.dx, y: pick.y + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    // the blit frame core needs: canvas centre + cull radius, in tiles
    spot.cx = spot.x + spot.ox;
    spot.cy = spot.y + spot.oy;
    spot.r = size * 1.5 + 0.6;
    spots.push(spot);
    // the linked wall growth: at most the two wall tiles the patch touches
    for(let i = 0; i < spot.walls.length && i < 2; i++) climbs.push(spot.walls[i]);
  }

  Delve.registerGrowthStyle("moss", {
    place: function(G, mc, pal, U){
      const spots = [], climbs = [];
      U.regions(G).forEach(function(tiles){
        if(tiles.length < 6) return;                        // a sliver stays bare
        if(Math.random() > (mc.roomChance || 0.80)) return; // this room stays bare
        const large = tiles.length >= (mc.largeArea || 40);
        let plan;
        if(large && Math.random() < (mc.bigChance || 0.25)) plan = [true];                // one big patch
        else if(large && Math.random() < (mc.largeChance || 0.55)) plan = [false, false]; // two normal
        else plan = [false];
        for(let i = 0; i < plan.length; i++) addSpot(G, tiles, mc, U, spots, climbs, plan[i]);
      });
      return { floor: spots, walls: climbs };
    },

    bake: function(spot, pal, U){ return bakeMoss(spot, pal, U); }
  });

  // ── the shape ─────────────────────────────────────────────────
  function bakeMoss(spot, pal, U){
    const G = Delve.G;
    if(!G || !G.grid) return null;
    const rnd = U.rngFrom(spot.seed);
    const R = spot.size;
    const theta = Math.atan2(spot.dirY, spot.dirX);
    // edge wobble — three sine octaves, amplitudes rolled from the seed
    const w1 = { a: 0.10 + rnd() * 0.12, p: rnd() * 6.2832 };
    const w2 = { a: 0.05 + rnd() * 0.08, p: rnd() * 6.2832 };
    const w3 = { a: 0.03 + rnd() * 0.05, p: rnd() * 6.2832 };
    // the main lobe, stretched along the growth heading
    const lobes = [{ ox: 0, oy: 0, rx: R * 1.28, ry: R * 0.96, ang: theta, a1: w1, a2: w2, a3: w3 }];
    // satellites — rugged near-round bits hanging off the fringe, biased to
    // spread outward along the heading; part of this patch, not new patches
    const nSat = 1 + Math.floor(R * 1.6 + rnd() * 1.2);
    for(let i = 0; i < nSat; i++){
      const sa = theta + (rnd() - 0.5) * 2.6;
      const sd = R * (0.55 + rnd() * 0.55);
      lobes.push({
        ox: Math.cos(sa) * sd, oy: Math.sin(sa) * sd,
        rx: R * (0.22 + rnd() * 0.26), ry: R * (0.20 + rnd() * 0.24),
        ang: rnd() * Math.PI,
        a1: { a: 0.12 + rnd() * 0.10, p: rnd() * 6.2832 },
        a2: { a: 0.06 + rnd() * 0.06, p: rnd() * 6.2832 },
        a3: { a: 0.03, p: rnd() * 6.2832 }
      });
    }
    const half = Math.ceil((R * 1.45 + 0.55) * PX);   // canvas half-width, fine px
    const b = U.newBake(half * 2);
    const S = b.S, d = b.d;
    // this patch's slice of the biome's gradient, dark → bright
    const shadesRGB = U.shades(spot.size, pal);
    const nShades = shadesRGB.length;
    // gradient root: pulled back toward the wall the patch grows from, so the
    // dark damp shade sits at the wall and the bright tips face open floor
    const rootX = -spot.dirX * R * 0.9, rootY = -spot.dirY * R * 0.9;
    for(let j = 0; j < S; j++){
      for(let i = 0; i < S; i++){
        // this fine pixel in tile units, relative to the blob centre
        const fx = (i + 0.5 - half) / PX, fy = (j + 0.5 - half) / PX;
        // growth only ever grows on plain floor — walls, doors, water, stairs,
        // chests all cut the patch, which is what keeps it off the furniture
        const wx = spot.x + spot.ox + fx, wy = spot.y + spot.oy + fy;
        const tx = Math.floor(wx), ty = Math.floor(wy);
        if(!G.grid[ty] || G.grid[ty][tx] !== T().FLOOR) continue;
        let inside = false, dmin = 1e9;
        for(let k = 0; k < lobes.length; k++){
          const L = lobes[k];
          const lx = fx - L.ox, ly = fy - L.oy;
          // rotate into the lobe's frame
          const rx = lx * Math.cos(L.ang) + ly * Math.sin(L.ang);
          const ry = -lx * Math.sin(L.ang) + ly * Math.cos(L.ang);
          const ang = Math.atan2(ry, rx);
          const wob = 1 + L.a1.a * Math.sin(3 * ang + L.a1.p)
                       + L.a2.a * Math.sin(5 * ang + L.a2.p)
                       + L.a3.a * Math.sin(7 * ang + L.a3.p);
          const dd = Math.hypot(rx / (L.rx * wob), ry / (L.ry * wob));
          if(dd < dmin) dmin = dd;
          if(dd <= 1) inside = true;
        }
        if(!inside) continue;
        // eroded fringe: the outermost band is nibbled pixel by pixel, so no
        // edge is ever a clean curve — least of all where it meets the wall
        if(dmin > 0.82 && Delve.hash3(i, j, spot.seed & 1023) < 0.45) continue;
        // the gradient: dark at the root, brighter toward the growing fringe,
        // quantised + dithered so it reads as pixel-art grain, not a blur
        const gdx = fx - rootX, gdy = fy - rootY;
        let t = Math.hypot(gdx, gdy) / (R * 2.1);
        t = Math.max(0, Math.min(1, t));
        const band = t * (nShades - 1) + (Delve.hash3(i, j, (spot.seed >> 3) & 1023) - 0.5) * 0.85;
        let si = Math.max(0, Math.min(nShades - 1, Math.round(band)));
        // sparse bright specks — the dappled tips real growth has
        if(Delve.hash3(i, j, (spot.seed >> 6) & 1023) < 0.05) si = Math.min(nShades - 1, si + 1);
        const col = shadesRGB[si];
        const o = (j * S + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 230;
      }
    }
    return U.commitBake(b);
  }
})();

