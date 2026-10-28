window.Delve = window.Delve || {};
(function(){
  // ── js/growth/disturbed.js : dug earth + bones (The Bone Ossuary) ──
  // Biome 4's answer to the other wards' moss. Not growth that climbs — the
  // owner's brief was specific: portions of the FLOOR look disturbed, as if
  // something has been digging, and bones poke through the turned earth. So this
  // form returns NO wall climbs at all; it only ever paints on the floor.
  //
  // A zone is: a wobbled patch of turned earth (darker, with a lighter rim where
  // soil was pushed out), a scatter of pale grit, and 3-7 bones from a kit of
  // EIGHT shapes — skull, ribcage, femur, long bone, pelvis, vertebra, fingers,
  // clavicle. Every bone rolls its own 90-degree rotation (all four directions),
  // its own scale and its own offset, so no two zones read the same.
  //
  // The framework (rooms, anchors, bake cache, blitting) is js/growth/core.js.

  const PX = 16;
  const T = function(){ return Delve.T; };

  // ── the bone kit ──────────────────────────────────────────────
  // Primitives in bone-local TILE units, origin at the bone's centre:
  //   cap  — a round-capped segment (x0,y0 → x1,y1, radius r)
  //   disc — a filled circle
  //   hole — cut out again in the earth colour (eye sockets, pelvis gap)
  const SHAPES = {
    femur: function(){
      return [
        { k:"cap", x0:-0.30, y0:0, x1:0.30, y1:0, r:0.055 },
        { k:"disc", x:-0.33, y:-0.03, r:0.10 }, { k:"disc", x:-0.30, y:0.07, r:0.075 },
        { k:"disc", x:0.33, y:-0.03, r:0.10 }, { k:"disc", x:0.30, y:0.07, r:0.075 }
      ];
    },
    longbone: function(){
      return [
        { k:"cap", x0:-0.32, y0:0, x1:0.32, y1:0, r:0.045 },
        { k:"disc", x:-0.33, y:0, r:0.07 }, { k:"disc", x:0.33, y:0, r:0.07 }
      ];
    },
    skull: function(){
      return [
        { k:"disc", x:0, y:-0.02, r:0.17 },
        { k:"cap", x0:-0.07, y0:0.12, x1:0.07, y1:0.21, r:0.075 },
        { k:"hole", x:-0.075, y:-0.03, r:0.055 },
        { k:"hole", x:0.075, y:-0.03, r:0.055 },
        { k:"hole", x:0, y:0.13, r:0.028 }
      ];
    },
    ribcage: function(){
      const p = [{ k:"cap", x0:0, y0:-0.26, x1:0, y1:0.26, r:0.035 }];
      for(let i = 0; i < 4; i++){
        const y = -0.20 + i * 0.13;
        p.push({ k:"cap", x0:0, y0:y, x1:0.21, y1:y + 0.10, r:0.030 });
        p.push({ k:"cap", x0:0, y0:y, x1:-0.21, y1:y + 0.10, r:0.030 });
      }
      return p;
    },
    pelvis: function(){
      return [
        { k:"cap", x0:-0.14, y0:0, x1:0.14, y1:0, r:0.06 },
        { k:"disc", x:-0.15, y:0.02, r:0.11 },
        { k:"disc", x:0.15, y:0.02, r:0.11 },
        { k:"hole", x:0, y:0.04, r:0.055 }
      ];
    },
    vertebra: function(){
      return [
        { k:"disc", x:0, y:0, r:0.08 },
        { k:"cap", x0:-0.13, y0:0, x1:-0.05, y1:0, r:0.030 },
        { k:"cap", x0:0.05, y0:0, x1:0.13, y1:0, r:0.030 },
        { k:"cap", x0:0, y0:-0.13, x1:0, y1:-0.06, r:0.025 },
        { k:"cap", x0:0, y0:0.06, x1:0, y1:0.13, r:0.025 },
        { k:"hole", x:0, y:0, r:0.024 }
      ];
    },
    fingers: function(){
      const out = [{ k:"disc", x:0, y:0, r:0.05 }];
      for(let i = 0; i < 5; i++){
        const a = (-0.40 + i * 0.20) * Math.PI;      // fan across half a circle
        const len = 0.13 + (i === 1 || i === 2 ? 0.07 : 0) + (i === 3 ? 0.03 : 0);
        out.push({ k:"cap", x0:Math.sin(a) * 0.04, y0:0.02,
                   x1:Math.sin(a) * len, y1:-Math.cos(a) * len, r:0.022 });
      }
      return out;
    },
    clavicle: function(){
      return [
        { k:"cap", x0:-0.26, y0:0.06, x1:-0.10, y1:-0.03, r:0.032 },
        { k:"cap", x0:-0.10, y0:-0.03, x1:0.10, y1:-0.03, r:0.032 },
        { k:"cap", x0:0.10, y0:-0.03, x1:0.26, y1:0.06, r:0.032 }
      ];
    }
  };
  const SHAPE_IDS = Object.keys(SHAPES);

  // rotate a local point by rot * 90 degrees — the four directions the owner asked
  // for, so one shape covers four placements
  function rot(rot, x, y){
    switch(rot & 3){
      case 1: return [y, -x];
      case 2: return [-x, -y];
      case 3: return [-y, x];
      default: return [x, y];
    }
  }

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

  // Build one dug zone: a radius, a handful of bones with their own rotation and
  // scale, and a grit scatter. Everything derives from the spot seed, so a redraw
  // reproduces it exactly.
  function makeZone(G, pick, mc, big, rnd){
    const radius = reachRoll(mc, big) * 1.6;            // zone radius, in tiles
    const spot = {
      style: "disturbed",
      x: pick.x, y: pick.y,
      dirX: pick.dx, dirY: pick.dy,
      reach: radius,
      seed: 1 + Math.floor(Math.random() * 2147483646),
      bones: [],
      grit: []
    };
    const bonesMin = mc.bonesMin !== undefined ? mc.bonesMin : 3;
    const bonesMax = mc.bonesMax !== undefined ? mc.bonesMax : 7;
    const want = bonesMin + Math.floor(rnd() * (bonesMax - bonesMin + 1));
    const placed = [];
    for(let attempt = 0; attempt < want * 14 && spot.bones.length < want; attempt++){
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * radius * 0.72;
      const bx = spot.x + 0.5 + Math.cos(a) * d;
      const by = spot.y + 0.5 + Math.sin(a) * d;
      const tileX = Math.floor(bx), tileY = Math.floor(by);
      const row = G.grid[tileY];
      if(!row || row[tileX] !== T().FLOOR) continue;     // bones only on plain floor
      let clash = false;
      for(let i = 0; i < placed.length; i++){
        if(Math.hypot(placed[i][0] - bx, placed[i][1] - by) < 0.42){ clash = true; break; }
      }
      if(clash) continue;
      placed.push([bx, by]);
      spot.bones.push({
        shape: SHAPE_IDS[(rnd() * SHAPE_IDS.length) | 0],
        x: bx, y: by,
        rot: (rnd() * 4) | 0,                            // one of four directions
        scale: 0.75 + rnd() * 0.45,
        seed: 1 + Math.floor(rnd() * 2147483000)
      });
    }
    // pale grit scattered through the turned earth
    const nGrit = Math.round(radius * radius * 9);
    for(let i = 0; i < nGrit; i++){
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * radius * 0.95;
      spot.grit.push([spot.x + 0.5 + Math.cos(a) * d, spot.y + 0.5 + Math.sin(a) * d, rnd()]);
    }
    if(!spot.bones.length && spot.grit.length < 6) return null;

    spot.cx = spot.x + 0.5;
    spot.cy = spot.y + 0.5;
    spot.r = radius + 0.5;
    spot.minX = spot.cx - spot.r; spot.maxX = spot.cx + spot.r;
    spot.minY = spot.cy - spot.r; spot.maxY = spot.cy + spot.r;
    return spot;
  }


  // ── rasterising ───────────────────────────────────────────────
  // Distance from a point to a segment, in tile units — the capsule test.
  function segDist(px, py, x0, y0, x1, y1){
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
  }

  Delve.registerGrowthStyle("disturbed", {
    // The kit itself, exposed so tests and tools can count it (owner asked for a
    // set of bone shapes with four rotations each).
    shapes: SHAPE_IDS,
    // Dark earth → pale bone, in one ladder so the zone and its bones agree.
    palette: function(bm){ return bm.growthDigPal || bm.growthPal; },

    // NOTE: `walls` is always empty. This form is floor-only by design — the
    // owner asked for dug earth on the floor, not growth climbing the stone.
    place: function(G, mc, pal, U){
      const spots = [], climbs = [];
      U.regions(G).forEach(function(tiles){
        if(tiles.length < 6) return;
        if(Math.random() > (mc.roomChance || 0.78)) return;
        const large = tiles.length >= (mc.largeArea || 40);
        const plan = [false];
        if(large && Math.random() < (mc.bigChance || 0.30)) plan[0] = true;
        if(Math.random() < (mc.largeChance || 0.50)) plan.push(false);
        for(let i = 0; i < plan.length; i++){
          const pick = U.pickAnchor(G, tiles, mc);
          if(!pick) continue;
          const rnd = U.rngFrom(1 + Math.floor(Math.random() * 2147483646));
          const spot = makeZone(G, pick, mc, plan[i], rnd);
          if(spot) spots.push(spot);
        }
      });
      return { floor: spots, walls: climbs };
    },


    bake: function(spot, pal, U){
      const G = Delve.G;
      if(!G || !G.grid || !spot.bones) return null;
      const half = Math.max(8, Math.ceil(spot.r * PX));
      const S = half * 2;
      const b = U.newBake(S);
      const d = b.d;
      const ox = spot.cx * PX - half, oy = spot.cy * PX - half;
      const pick = function(i){
        return U.hex6(pal[Math.max(0, Math.min(pal.length - 1, i))]);
      };
      const earthDark = pick(0), earthMid = pick(1);
      const boneShade = pick(2), boneMid = pick(3), boneLight = pick(4);
      const OUT = 0.9 / PX;                       // outline width, in tiles

      function put(px, py, rgb, alpha){
        const i = Math.round(px), j = Math.round(py);
        if(i < 0 || j < 0 || i >= S || j >= S) return;
        const tx = Math.floor((ox + i + 0.5) / PX), ty = Math.floor((oy + j + 0.5) / PX);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) return;   // never over the furniture
        const o = (j * S + i) * 4;
        if(d[o + 3] > alpha) return;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = alpha;
      }

      // 1. the turned earth: a wobbled blob, darker than the floor, with a thin
      //    lighter ring where the soil was pushed out around the hole
      const cx = spot.cx, cy = spot.cy, r = spot.reach;
      const rimR = r * 1.16;
      const p1 = (spot.seed % 628) / 100;
      for(let j = -Math.ceil(rimR * PX) - 2; j <= Math.ceil(rimR * PX) + 2; j++){
        for(let i = -Math.ceil(rimR * PX) - 2; i <= Math.ceil(rimR * PX) + 2; i++){
          const tx = i / PX, ty = j / PX;
          const dd = Math.hypot(tx, ty);
          const ang = Math.atan2(ty, tx);
          const wob = 1 + 0.12 * Math.sin(3 * ang + p1) + 0.07 * Math.sin(5 * ang + p1 * 1.7);
          const edge = r * wob;
          const px = cx * PX - ox + i, py = cy * PX - oy + j;
          if(dd <= edge){
            // dug soil: dithered so it never reads as a flat disc
            const h = Delve.hash3(i + 64, j + 64, spot.seed & 511);
            put(px, py, h < 0.30 ? earthDark : earthMid, h < 0.18 ? 205 : 168);
          } else if(dd <= edge * 1.10){
            if(Delve.hash3(i + 64, j + 64, (spot.seed >> 3) & 511) < 0.45){
              put(px, py, earthMid, 92);
            }
          }
        }
      }
      // 2. pale grit through the turned earth
      spot.grit.forEach(function(g){
        put(g[0] * PX - ox, g[1] * PX - oy, boneMid, 150 + Math.round(g[2] * 90));
      });


      // 3. the bones: silhouette first, then body, then a lit edge; sockets are
      //    cut out last so they stay empty
      function drawPrims(prims, expand, rgb, alpha){
        for(let k = 0; k < prims.length; k++){
          const pr = prims[k];
          if(pr.k === "hole") continue;
          const grow = (pr.r + expand) * PX;
          const x0 = pr.k === "cap" ? pr.x0 : pr.x, y0 = pr.k === "cap" ? pr.y0 : pr.y;
          const x1 = pr.k === "cap" ? pr.x1 : pr.x, y1 = pr.k === "cap" ? pr.y1 : pr.y;
          const ax = x0 * PX - ox, ay = y0 * PX - oy, bx = x1 * PX - ox, by = y1 * PX - oy;
          const lo = Math.floor(Math.min(ax, bx) - grow) - 1, hi = Math.ceil(Math.max(ax, bx) + grow) + 1;
          const top = Math.floor(Math.min(ay, by) - grow) - 1, bot = Math.ceil(Math.max(ay, by) + grow) + 1;
          for(let j = top; j <= bot; j++){
            for(let i = lo; i <= hi; i++){
              const ddx = (i + 0.5 - ax) / PX, ddy = (j + 0.5 - ay) / PX;
              if(segDist(ddx, ddy, 0, 0, x1 - x0, y1 - y0) <= pr.r + expand) put(i, j, rgb, alpha);
            }
          }
        }
      }
      spot.bones.forEach(function(bone){
        const shape = SHAPES[bone.shape];
        if(!shape) return;
        const prims = shape().map(function(pr){
          const s = bone.scale;
          const map = function(x, y){
            const q = rot(bone.rot, x * s, y * s);
            return [bone.x + q[0], bone.y + q[1]];
          };
          if(pr.k === "cap"){
            const a = map(pr.x0, pr.y0), b2 = map(pr.x1, pr.y1);
            return { k:"cap", x0:a[0], y0:a[1], x1:b2[0], y1:b2[1], r:pr.r * s };
          }
          const c = map(pr.x, pr.y);
          return { k:pr.k, x:c[0], y:c[1], r:pr.r * s };
        });
        drawPrims(prims, OUT, boneShade, 236);
        drawPrims(prims, 0, boneMid, 240);
        const lit = prims.map(function(pr){
          return pr.k === "cap"
            ? { k:"cap", x0:pr.x0 - OUT, y0:pr.y0 - OUT, x1:pr.x1 - OUT, y1:pr.y1 - OUT, r:pr.r * 0.42 }
            : { k:"disc", x:pr.x - OUT, y:pr.y - OUT, r:pr.r * 0.42 };
        });
        drawPrims(lit, 0, boneLight, 150);
        prims.forEach(function(pr){
          if(pr.k !== "hole") return;
          const rr = pr.r * PX;
          const px = pr.x * PX - ox, py = pr.y * PX - oy;
          for(let j = Math.floor(py - rr) - 1; j <= Math.ceil(py + rr) + 1; j++){
            for(let i = Math.floor(px - rr) - 1; i <= Math.ceil(px + rr) + 1; i++){
              if(Math.hypot(i + 0.5 - px, j + 0.5 - py) <= rr) put(i, j, earthDark, 250);
            }
          }
        });
      });
      return U.commitBake(b);
    }
  });
})();

