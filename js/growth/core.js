window.Delve = window.Delve || {};
(function(){
  // ── js/growth/core.js : the growth framework ───────────────────
  // Growth is a ward's moss-like floor overgrowth and the climbs it sends up
  // the walls. Pure presentation: rolled per room during generation into
  // G.growth = { floor:[...], walls:[...] }, never written into the grid, never
  // blocking, never in the run snapshot (a resume rebuilds the floor and
  // re-rolls it, exactly like the ground cover).
  //
  // ONE FORM PER BIOME. A biome NAMES its form (BIOMES[n].growthStyle) and one
  // file under js/growth/ supplies it:
  //   js/growth/moss.js      "moss"      — the Upper Ruins' lobed moss patches
  //   js/growth/mycelium.js  "mycelium"  — the Blackvein's branching veins
  // A ward with no `growth` block grows nothing; a biome with no (or an
  // unregistered) growthStyle grows nothing. Adding a biome's own growth is a
  // new file plus two strings — no branches in here.
  //
  // The shared rules live here, so no style has to re-invent them:
  //   · spots roll per room (a room may stay bare), biased to corners and wall
  //     bases, each growing outward into the room
  //   · growth only paints plain FLOOR — walls, doors, water, stairs, chests
  //     and props cut it, which is what keeps it off the furniture
  //   · wall growth is LINKED: a wall climbs only where a floor spot touches it
  //   · every shape derives from the spot's seed, so every redraw is identical
  //
  // A style implements two seams and may override a third:
  //   place(G, cfg, pal, U)     → { floor:[spot…], walls:[{x,y,dx,dy}…] }
  //   bake(spot, pal, U)        → canvas at 16 fine pixels per tile
  //   wallDesigns(C)            → the climb art (default CONFIG.WALL_MOSS)
  // A floor spot must set cx, cy (canvas centre, in tiles) and r (cull radius,
  // in tiles); core does the culling, caching and blitting for every style.

  const PX = 16;   // fine pixels per tile (the project's Batch 22 grain)
  const T = function(){ return Delve.T; };

  // ── registry ──────────────────────────────────────────────────
  Delve.growthStyles = {};
  Delve.registerGrowthStyle = function(id, api){
    if(!id || !api) return false;
    if(typeof api.place !== "function" || typeof api.bake !== "function") return false;
    Delve.growthStyles[id] = api;
    return true;
  };

  function wardOf(G){ return (G && Delve.getWard) ? Delve.getWard(G.floor) : null; }
  function biomeOf(G){
    const w = wardOf(G);
    const list = (Delve.CONFIG && Delve.CONFIG.BIOMES) || [];
    return list[(w && w.biome !== undefined) ? w.biome : 0] || {};
  }
  function cfgOf(G){
    const w = wardOf(G);
    return (w && w.growth) ? w.growth : null;
  }
  function palOf(G, style){
    const bm = biomeOf(G);
    const p = (style && style.palette) ? style.palette(bm) : bm.growthPal;
    return (p && p.length >= 2) ? p : null;
  }
  function styleOf(G){
    if(!cfgOf(G)) return null;                 // no ward block = no growth
    const id = biomeOf(G).growthStyle;
    return (id && Delve.growthStyles[id]) ? Delve.growthStyles[id] : null;
  }


  // ── rooms as the generator built them ─────────────────────────
  // Flood-fill regions of walkable floor (FLOOR + the organic WATER/GRASS
  // variants), stopped by doors and walls, so "per room" below means per
  // chamber the player actually sees.
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

  // Which sides of a floor tile touch wall — every style's anchors.
  function wallSides(G, x, y){
    const W = T().WALL, out = [];
    if(G.grid[y - 1] && G.grid[y - 1][x] === W) out.push({ dx: 0, dy: -1 });
    if(G.grid[y + 1] && G.grid[y + 1][x] === W) out.push({ dx: 0, dy: 1 });
    if(G.grid[y][x - 1] === W) out.push({ dx: -1, dy: 0 });
    if(G.grid[y][x + 1] === W) out.push({ dx: 1, dy: 0 });
    return out;
  }

  // The shared anchor rule: corner-huggers first, then wall-huggers, then open
  // floor, with the odds from the ward's growth block. Returns the tile, the
  // walls it touches, and the outward heading (the bisector out of a corner,
  // the normal out of a wall, a random heading on open floor).
  function pickAnchor(G, tiles, mc){
    const corners = [], edges = [], free = [];
    for(let i = 0; i < tiles.length; i++){
      const s = wallSides(G, tiles[i][0], tiles[i][1]);
      if(s.length >= 2) corners.push({ c: tiles[i], sides: s });
      else if(s.length === 1) edges.push({ c: tiles[i], sides: s });
      else free.push({ c: tiles[i], sides: s });
    }
    const cb = mc.cornerBias !== undefined ? mc.cornerBias : 0.65;
    const wb = mc.wallBias !== undefined ? mc.wallBias : 0.32;
    const roll = Math.random();
    let pick = null;
    if(roll < cb && corners.length) pick = corners[(Math.random() * corners.length) | 0];
    else if(roll < cb + wb && edges.length) pick = edges[(Math.random() * edges.length) | 0];
    if(!pick){
      const pool = free.length ? free : (edges.length ? edges : corners);
      if(!pool.length) return null;
      pick = pool[(Math.random() * pool.length) | 0];
    }
    let dx = 0, dy = 0;
    if(pick.sides.length){
      for(let i = 0; i < pick.sides.length; i++){ dx -= pick.sides[i].dx; dy -= pick.sides[i].dy; }
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    } else {
      const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a);
    }
    return { x: pick.c[0], y: pick.c[1], sides: pick.sides, dx: dx, dy: dy };
  }


  // ── small shared maths ────────────────────────────────────────
  function hex6(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rngFrom(seed){
    let s = seed >>> 0;
    return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  // A spot's slice of the biome's gradient, dark root → bright tip. The owner's
  // rule: a bigger patch carries more shades, a small one only a couple.
  function shadesOf(size, pal){
    const n = Math.max(2, Math.min(pal.length, Math.round(1.6 + size * 1.8)));
    const out = [];
    for(let i = 0; i < n; i++){
      const f = n === 1 ? 0 : i / (n - 1);
      out.push(hex6(pal[Math.min(pal.length - 1, Math.round(f * (pal.length - 1)))]));
    }
    return out;
  }
  // Fine-pixel bake target: a canvas plus its ImageData. Every style writes
  // pixels directly, so smoothing never matters.
  function newBake(S){
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const cc = c.getContext("2d");
    const img = cc.createImageData(S, S);
    return { c: c, cc: cc, img: img, d: img.data, S: S };
  }
  function commitBake(b){
    b.cc.putImageData(b.img, 0, 0);
    return b.c;
  }

  // What every style gets handed. Anything a second style would also need
  // belongs here, not copied into both files.
  const U = {
    PX: PX,
    regions: regions,
    wallSides: wallSides,
    pickAnchor: pickAnchor,
    hex6: hex6,
    rngFrom: rngFrom,
    shades: shadesOf,
    newBake: newBake,
    commitBake: commitBake
  };
  Delve.growthUtil = U;

  // ── placement (end of genFloor / genBossFloor) ────────────────
  Delve.placeGrowth = function(G){
    if(!G || !G.grid || !G.grid.length) return;
    const style = styleOf(G), cfg = cfgOf(G), pal = palOf(G, style);
    if(!style || !cfg || !pal){ G.growth = { floor: [], walls: [] }; return; }
    let plan = null, err = null;
    // A form must never abort floor generation, but a silent failure would look
    // exactly like a bare floor: keep the message so tests and ?debug=1 can tell.
    try { plan = style.place(G, cfg, pal, U); } catch(_err){ plan = null; err = _err.message || String(_err); }
    G.growth = {
      floor: (plan && plan.floor) || [],
      walls: (plan && plan.walls) || [],
      error: err
    };
  };

  // ── bake cache: one canvas per spot, for the floor's life ─────
  let bakeFloor = -1, bakeMap = {};
  function styleCanvas(style, spot, pal){
    const G = Delve.G;
    if(!G || !G.grid) return null;
    if(bakeFloor !== G.floor){ bakeFloor = G.floor; bakeMap = {}; }
    const key = (spot.style || "") + "|" + spot.seed + ":" + spot.x + "," + spot.y;
    if(bakeMap[key]) return bakeMap[key];
    const c = style.bake(spot, pal, U);
    if(c) bakeMap[key] = c;
    return c;
  }

  Delve.drawGrowthFloor = function(ctx, camX, camY, vw, vh, ts){
    const G = Delve.G;
    const list = G && G.growth && G.growth.floor;
    if(!list || !list.length) return;
    const style = styleOf(G);
    if(!style) return;
    const pal = palOf(G, style);
    if(!pal) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for(let i = 0; i < list.length; i++){
      const sp = list[i];
      const R = sp.r || 2;
      const cX = (sp.cx !== undefined) ? sp.cx : sp.x + (sp.ox || 0.5);
      const cY = (sp.cy !== undefined) ? sp.cy : sp.y + (sp.oy || 0.5);
      if(cX + R < camX || cY + R < camY || cX - R > camX + vw || cY - R > camY + vh) continue;
      const c = styleCanvas(style, sp, pal);
      if(!c) continue;
      const w = (c.width / PX) * ts;
      ctx.drawImage(c, (cX - camX) * ts - w / 2, (cY - camY) * ts - w / 2, w, w);
    }
    ctx.restore();
  };

  // ── wall climbs ───────────────────────────────────────────────
  // The climb art is content (per style, default CONFIG.WALL_MOSS), 16x16 with
  // D = dark root, M = mid, L = bright tip, recoloured from the biome's
  // gradient. Cached per design + palette: the art is content, the colours are
  // per biome, and neither changes during a run.
  let climbMap = {};
  function climbCanvas(design, pal){
    const key = design.join("/") + "|" + pal.join(",");
    if(climbMap[key]) return climbMap[key];
    const c = document.createElement("canvas");
    c.width = PX; c.height = PX;
    const cc = c.getContext("2d");
    const D = hex6(pal[0]);
    const M = hex6(pal[Math.floor(pal.length / 2)]);
    const L = hex6(pal[pal.length - 1]);
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
    climbMap[key] = c;
    return c;
  }

  Delve.drawGrowthWalls = function(ctx, camX, camY, vw, vh, ts){
    const G = Delve.G;
    const list = G && G.growth && G.growth.walls;
    if(!list || !list.length) return;
    const style = styleOf(G);
    if(!style) return;
    const C = Delve.CONFIG || {};
    const designs = (typeof style.wallDesigns === "function")
      ? (style.wallDesigns(C) || [])
      : (style.wallDesigns || C.WALL_MOSS || []);
    const pal = palOf(G, style);
    if(!pal || !designs.length) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for(let i = 0; i < list.length; i++){
      const w = list[i];
      if(w.x < camX || w.y < camY || w.x >= camX + vw || w.y >= camY + vh) continue;
      // never over a brazier — the light source wins
      if(Delve.isTorchTile && Delve.isTorchTile(w.x, w.y)) continue;
      const design = designs[Math.floor(Delve.hash3(w.x, w.y, 517) * designs.length) % designs.length];
      const img = climbCanvas(design, pal);
      const sc = ts * 0.95;
      ctx.save();
      ctx.translate((w.x - camX) * ts + ts / 2, (w.y - camY) * ts + ts / 2);
      // rotate so the climb's BASE edge faces the floor the growth grows from
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
