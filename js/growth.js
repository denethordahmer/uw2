window.Delve = window.Delve || {};
(function(){
  // ── js/growth.js : per-biome floor + wall growth (the ward's ground cover) ──
  // Replaces the old flat-green decoration. Growth is placed at generation time
  // as a list of sporadic organic spots (G.growth) and painted by the renderer
  // on top of the floor pattern — never written into the grid, never saved in
  // the run snapshot (a resume rebuilds the floor and re-rolls it, exactly
  // like the ground cover). Three public seams:
  //   Delve.placeGrowth(G)          — end of genFloor / genBossFloor
  //   Delve.drawGrowthFloor(...)    — render.js, after the floor + ground cover
  //   Delve.drawGrowthWalls(...)    — render.js, after the wall pass
  //
  // Rules (owner spec):
  //  - spots roll randomly per room (a room may stay bare), biased to corners
  //    and wall bases, each growing slightly OUTWARD into the room
  //  - each spot's size rolls between the ward's low and high caps; a large
  //    room may instead grow one bigger, more developed patch
  //  - bigger patch = more gradient shades; a small patch needs only a couple
  //  - the shape is a wobbled, multi-lobed organic blob — never a square, never
  //    a clean circle, no hard straight edge anywhere, including where it
  //    meets the wall (the contact is eroded fine-pixel by fine-pixel)
  //  - wall growth is LINKED: a wall only grows growth where a floor patch sits
  //    against it (C.WALL_MOSS climbs, recoloured from the biome's growthPal)
  //
  // Config is per-ward: only a ward with a `growth` block in con-biomes.js grows
  // any (ward 1, the Upper Ruins, is the first). The palette comes from the
  // biome's `growthPal` — dark root shade → bright growing tip.

  const PX = 16;   // fine pixels per tile (the project's Batch 22 convention)

  const T = function(){ return Delve.T; };

  function growthWardCfg(G){
    const ward = Delve.getWard(G.floor);
    return (ward && ward.growth) ? ward.growth : null;
  }
  function growthPal(G){
    const ward = Delve.getWard(G.floor);
    const biomes = Delve.CONFIG.BIOMES || [];
    const bm = biomes[(ward && ward.biome !== undefined) ? ward.biome : 0] || {};
    const p = bm.growthPal;
    return (p && p.length >= 2) ? p : null;
  }

  // Rooms as the generator built them: flood-fill regions of walkable floor
  // (FLOOR + the organic WATER/GRASS variants), stopped by doors and walls, so
  // "per room" below means per chamber the player actually sees.
  function regions(G){
    const walk = function(v){ return v === T().FLOOR || v === T().WATER || v === T().GRASS; };
    const seen = {}, out = [];
    for(let y = 1; y < G.gridH - 1; y++){
      for(let x = 1; x < G.gridW - 1; x++){
        if(!walk(G.grid[y][x]) || seen[x + "," + y]) continue;
        const tiles = [], q = [[x, y]];
        seen[x + "," + y] = 1;
        while(q.length){
          const c = q.pop();
          tiles.push(c);
          const nb = [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]];
          for(let i = 0; i < 4; i++){
            const nx = nb[i][0], ny = nb[i][1];
            if(nx < 1 || ny < 1 || nx >= G.gridW - 1 || ny >= G.gridH - 1) continue;
            if(seen[nx + "," + ny] || !walk(G.grid[ny][nx])) continue;
            seen[nx + "," + ny] = 1;
            q.push([nx, ny]);
          }
        }
        out.push(tiles);
      }
    }
    return out;
  }

  // Which sides of a floor tile touch wall — the growth's anchors.
  function growthWallSides(G, x, y){
    const W = T().WALL, out = [];
    if(G.grid[y - 1] && G.grid[y - 1][x] === W) out.push({ dx: 0, dy: -1 });
    if(G.grid[y + 1] && G.grid[y + 1][x] === W) out.push({ dx: 0, dy: 1 });
    if(G.grid[y][x - 1] === W) out.push({ dx: -1, dy: 0 });
    if(G.grid[y][x + 1] === W) out.push({ dx: 1, dy: 0 });
    return out;
  }

  function addGrowthSpot(G, tiles, mc, pal, spots, climbs, big){
    // classify the room's tiles: corner-huggers, wall-huggers, open floor
    const corners = [], edges = [], free = [];
    for(let i = 0; i < tiles.length; i++){
      const s = growthWallSides(G, tiles[i][0], tiles[i][1]);
      if(s.length >= 2) corners.push({ c: tiles[i], sides: s });
      else if(s.length === 1) edges.push({ c: tiles[i], sides: s });
      else free.push({ c: tiles[i], sides: s });
    }
    const cb = mc.cornerBias || 0.65, wb = mc.wallBias || 0.32;
    const roll = Math.random();
    let pick = null;
    if(roll < cb && corners.length) pick = corners[(Math.random() * corners.length) | 0];
    else if(roll < cb + wb && edges.length) pick = edges[(Math.random() * edges.length) | 0];
    if(!pick){
      const pool = free.length ? free : (edges.length ? edges : corners);
      if(!pool.length) return;
      pick = pool[(Math.random() * pool.length) | 0];
    }
    // the size roll: between the ward's caps (bigger, more developed = the
    // big-room patch, also with a higher cap pair)
    const size = big
      ? (mc.bigSizeMin || 1.15) + Math.random() * Math.max(0, (mc.bigSizeMax || 1.9) - (mc.bigSizeMin || 1.15))
      : (mc.sizeMin || 0.45) + Math.random() * Math.max(0, (mc.sizeMax || 0.95) - (mc.sizeMin || 0.45));
    // growth heading: straight out from a wall, the bisector out of a corner,
    // a random heading for a free-floating patch
    let dx = 0, dy = 0;
    if(pick.sides.length){
      for(let i = 0; i < pick.sides.length; i++){ dx -= pick.sides[i].dx; dy -= pick.sides[i].dy; }
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    } else {
      const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a);
    }
    // owner rule: bigger patch = more gradient shades, small ones only a couple
    const shades = Math.max(2, Math.min(pal.length, Math.round(1.6 + size * 1.8)));
    const spot = {
      x: pick.c[0], y: pick.c[1],
      // the centre sits inside the anchor tile, nudged toward the wall
      ox: 0.5 - dx * 0.14 + (Math.random() - 0.5) * 0.10,
      oy: 0.5 - dy * 0.14 + (Math.random() - 0.5) * 0.10,
      size: size, dirX: dx, dirY: dy,
      seed: 1 + Math.floor(Math.random() * 2147483646),
      shades: shades,
      walls: pick.sides.map(function(s){
        return { x: pick.c[0] + s.dx, y: pick.c[1] + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    spots.push(spot);
    // the linked wall growth: at most the two wall tiles the patch touches
    for(let i = 0; i < spot.walls.length && i < 2; i++) climbs.push(spot.walls[i]);
  }

  Delve.placeGrowth = function(G){
    if(!G || !G.grid || !G.grid.length) return;
    const mc = growthWardCfg(G), pal = growthPal(G);
    if(!mc || !pal){ G.growth = { floor: [], walls: [] }; return; }
    const spots = [], climbs = [];
    regions(G).forEach(function(tiles){
      if(tiles.length < 6) return;                        // a sliver stays bare
      if(Math.random() > (mc.roomChance || 0.80)) return; // this room stays bare
      const large = tiles.length >= (mc.largeArea || 40);
      let plan;
      if(large && Math.random() < (mc.bigChance || 0.25)) plan = [true];               // one big patch
      else if(large && Math.random() < (mc.largeChance || 0.55)) plan = [false, false]; // two normal
      else plan = [false];
      for(let i = 0; i < plan.length; i++) addGrowthSpot(G, tiles, mc, pal, spots, climbs, plan[i]);
    });
    G.growth = { floor: spots, walls: climbs };
  };

  // ── baking ────────────────────────────────────────────────────
  // One canvas per spot, baked on first sight and kept for the floor's life.
  // Everything about the shape derives from the spot's rolled seed, so every
  // redraw reproduces the same blob. Fine pixels, drawn with smoothing off.

  let growthBakeFloor = -1, growthBakeMap = {};
  function growthHex6(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function growthRngFrom(seed){
    let s = seed >>> 0;
    return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function bakeGrowthSpot(spot, pal){
    const G = Delve.G;
    if(!G || !G.grid) return null;
    if(growthBakeFloor !== G.floor){ growthBakeFloor = G.floor; growthBakeMap = {}; }
    const key = spot.seed + ":" + spot.x + "," + spot.y;
    if(growthBakeMap[key]) return growthBakeMap[key];
    const rnd = growthRngFrom(spot.seed);
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
    const S = half * 2;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const cc = c.getContext("2d");
    const img = cc.createImageData(S, S);
    const d = img.data;
    // this patch's slice of the biome's locked gradient, dark → bright
    const shadesRGB = [];
    for(let i = 0; i < spot.shades; i++){
      const f = spot.shades === 1 ? 0 : i / (spot.shades - 1);
      shadesRGB.push(growthHex6(pal[Math.min(pal.length - 1, Math.round(f * (pal.length - 1)))]));
    }
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
        const band = t * (spot.shades - 1) + (Delve.hash3(i, j, (spot.seed >> 3) & 1023) - 0.5) * 0.85;
        let si = Math.max(0, Math.min(spot.shades - 1, Math.round(band)));
        // sparse bright specks — the dappled tips real growth has
        if(Delve.hash3(i, j, (spot.seed >> 6) & 1023) < 0.05) si = Math.min(spot.shades - 1, si + 1);
        const col = shadesRGB[si];
        const o = (j * S + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 230;
      }
    }
    cc.putImageData(img, 0, 0);
    growthBakeMap[key] = c;
    return c;
  }

  // Wall climbs: the C.WALL_MOSS pixel art, recoloured from the biome's
  // gradient — D = dark root, M = mid, L = bright tip. Cached per design +
  // palette (the art is content, the colours are per biome, and neither
  // changes during a run).
  let growthClimbMap = {};
  function growthClimbCanvas(design, pal){
    const key = design.join("/") + "|" + pal.join(",");
    if(growthClimbMap[key]) return growthClimbMap[key];
    const c = document.createElement("canvas");
    c.width = PX; c.height = PX;
    const cc = c.getContext("2d");
    const D = growthHex6(pal[0]);
    const M = growthHex6(pal[Math.floor(pal.length / 2)]);
    const L = growthHex6(pal[pal.length - 1]);
    for(let y = 0; y < design.length && y < PX; y++){
      const row = design[y];
      for(let x = 0; x < PX; x++){
        const ch = row[x] || ".";
        let col = null;
        if(ch === "D") col = D; else if(ch === "M") col = M; else if(ch === "L") col = L;
        if(!col) continue;
        cc.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
        cc.fillRect(x, y, 1, 1);
      }
    }
    growthClimbMap[key] = c;
    return c;
  }

  Delve.drawGrowthFloor = function(ctx, camX, camY, vw, vh, ts){
    const G = Delve.G;
    const list = G && G.growth && G.growth.floor;
    if(!list || !list.length) return;
    const pal = growthPal(G);
    if(!pal) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for(let i = 0; i < list.length; i++){
      const sp = list[i];
      const R = sp.size * 1.5 + 0.6;
      const cX = sp.x + sp.ox, cY = sp.y + sp.oy;
      if(cX + R < camX || cY + R < camY || cX - R > camX + vw || cY - R > camY + vh) continue;
      const c = bakeGrowthSpot(sp, pal);
      if(!c) continue;
      const w = (c.width / PX) * ts;
      ctx.drawImage(c, (cX - camX) * ts - w / 2, (cY - camY) * ts - w / 2, w, w);
    }
    ctx.restore();
  };

  Delve.drawGrowthWalls = function(ctx, camX, camY, vw, vh, ts){
    const G = Delve.G;
    const list = G && G.growth && G.growth.walls;
    if(!list || !list.length) return;
    const designs = Delve.CONFIG.WALL_MOSS || [];
    const pal = growthPal(G);
    if(!pal || !designs.length) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for(let i = 0; i < list.length; i++){
      const w = list[i];
      if(w.x < camX || w.y < camY || w.x >= camX + vw || w.y >= camY + vh) continue;
      // never over a brazier — the light source wins
      if(Delve.isTorchTile && Delve.isTorchTile(w.x, w.y)) continue;
      const design = designs[Math.floor(Delve.hash3(w.x, w.y, 517) * designs.length) % designs.length];
      const img = growthClimbCanvas(design, pal);
      const sc = ts * 0.95;
      ctx.save();
      ctx.translate((w.x - camX) * ts + ts / 2, (w.y - camY) * ts + ts / 2);
      // rotate so the climb's BASE edge faces the floor the patch grows from
      if(w.dy === 1) ctx.rotate(Math.PI);            // wall below: base at its top
      else if(w.dx === -1) ctx.rotate(-Math.PI / 2); // wall left: base at its right
      else if(w.dx === 1) ctx.rotate(Math.PI / 2);    // wall right: base at its left
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, -sc / 2, -sc / 2, sc, sc);
      ctx.restore();
    }
    ctx.restore();
  };
})();