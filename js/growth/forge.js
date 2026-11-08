window.Delve = window.Delve || {};
(function(){
  // ── js/growth/forge.js : ember cracks + slag crust (The Ashen Forge) ──
  // Biome 5's answer to the other wards' moss. The brief was a hellscape, so the
  // "growth" here is the floor FAILING: a patch of the ash crust has cracked
  // open, and the fire underneath shows through the seams. Around it the crust
  // is scorched black and crazed with hairline fractures.
  //
  // A zone is:
  //   · a scorched halo  — darkens the surrounding crust, irregular and eroded
  //   · a cracked plate  — a wobbled polygon of crust, lifted at its rim
  //   · the fissures     — 2-5 branching cracks radiating out from the centre,
  //                        each one hot at the root and cooling toward its tip,
  //                        with short branches leaving at angles
  //   · embers           — a few bright specks inside the cracks, and a little
  //                        bleed of light onto the crust either side
  //
  // It DOES climb: the wall link rule sends slag up the stone where a cracked
  // zone meets it (C.WALL_SLAG), because the heat is coming from behind the wall.
  //
  // The framework (rooms, anchors, bake cache, wall links) is js/growth/core.js;
  // this file only decides what the growth looks like.

  const PX = 16;
  const T = function(){ return Delve.T; };

  // Size roll, same convention as the other forms: `big` uses the higher pair.
  function reachRoll(mc, big){
    if(big){
      const lo = mc.bigSizeMin !== undefined ? mc.bigSizeMin : 1.25;
      const hi = mc.bigSizeMax !== undefined ? mc.bigSizeMax : 2.00;
      return lo + Math.random() * Math.max(0, hi - lo);
    }
    const lo = mc.sizeMin !== undefined ? mc.sizeMin : 0.55;
    const hi = mc.sizeMax !== undefined ? mc.sizeMax : 1.05;
    return lo + Math.random() * Math.max(0, hi - lo);
  }

  // ── the crack network ────────────────────────────────────────
  // A crack is a polyline that wanders outward from the zone centre. Each step
  // turns a little and is nudged by noise, so no two cracks look alike and none
  // of them is straight. Points carry a 0..1 "heat" that falls toward the tip.
  function growCrack(cx, cy, ang, len, rnd, G, jitter){
    const pts = [];
    const stepLen = 0.085;                       // tiles per step, fine enough
    let a = ang, x = cx, y = cy;
    const steps = Math.max(4, Math.round(len / stepLen));
    let turn = (rnd() - 0.5) * 0.5;
    for(let s = 0; s < steps; s++){
      turn += (rnd() - 0.5) * jitter;
      turn *= 0.90;                              // keep the crack from coiling
      a += turn;
      x += Math.cos(a) * stepLen;
      y += Math.sin(a) * stepLen;
      const tx = Math.floor(x), ty = Math.floor(y);
      const row = G.grid[ty];
      // Cracks stop at the first tile that is not plain floor, so a fissure can
      // never run out over a wall, a chest or a pool.
      if(!row || row[tx] !== T().FLOOR) break;
      pts.push([x, y, 1 - s / steps]);
    }
    return pts;
  }

  // One ember zone: scorch + plates + cracks + embers, positioned in tiles.
  function makeZone(G, pick, mc, big, rnd){
    const reach = reachRoll(mc, big) * 1.45;
    const spot = {
      style: "forge",
      x: pick.x, y: pick.y,
      dirX: pick.dx, dirY: pick.dy,
      reach: reach,
      seed: 1 + Math.floor(Math.random() * 2147483646),
      cracks: [],
      hubs: [],        // the bright points where cracks meet
      scorch: 0.55 + rnd() * 0.35,
      walls: pick.sides.map(function(s){
        return { x: pick.x + s.dx, y: pick.y + s.dy, dx: s.dx, dy: s.dy };
      })
    };
    const cx = pick.x + 0.5, cy = pick.y + 0.5;
    const nMain = 2 + Math.floor(rnd() * 4);     // 2-5 primary cracks
    const spread = 2.2 + rnd() * 1.4;            // how wide the fan opens
    const heading = Math.atan2(pick.dy, pick.dx);
    const all = [];
    for(let i = 0; i < nMain; i++){
      const a = heading + ((i / Math.max(1, nMain - 1)) - 0.5) * spread
                + (rnd() - 0.5) * 0.5;
      const len = reach * (0.55 + rnd() * 0.55);
      const pts = growCrack(cx, cy, a, len, rnd, G, 0.22);
      if(pts.length > 3){ all.push(pts); spot.cracks.push(pts); }
    }
    // branches: short spurs leaving an existing crack at a wide angle
    const base = all.slice();
    for(let i = 0; i < base.length; i++){
      const pts = base[i];
      if(pts.length < 8) continue;
      const n = rnd() < 0.65 ? 1 : 2;
      for(let k = 0; k < n; k++){
        const at = 3 + Math.floor(rnd() * Math.max(1, pts.length - 6));
        const p = pts[at];
        const q = pts[Math.max(0, at - 1)];
        const a0 = Math.atan2(p[1] - q[1], p[0] - q[0]);
        const a = a0 + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.7);
        const sub = growCrack(p[0], p[1], a, (pts.length - at) * 0.085 * (0.5 + rnd()), rnd, G, 0.30);
        if(sub.length > 2){ spot.cracks.push(sub); }
      }
    }
    if(!spot.cracks.length) return null;

    // ember hubs: a bright point at the root of each crack, plus the centre
    spot.hubs.push([cx, cy, 1]);
    for(let i = 0; i < spot.cracks.length; i++){
      const c = spot.cracks[i];
      if(c.length > 2 && rnd() < 0.7) spot.hubs.push([c[0][0], c[0][1], 0.8 + rnd() * 0.2]);
    }

    // bounding box for the blit frame
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const note = function(x, y){
      if(x < minX) minX = x; if(x > maxX) maxX = x;
      if(y < minY) minY = y; if(y > maxY) maxY = y;
    };
    spot.cracks.forEach(function(c){ c.forEach(function(p){ note(p[0], p[1]); }); });
    note(cx, cy);
    const pad = reach * 0.35;
    spot.minX = minX - pad; spot.maxX = maxX + pad;
    spot.minY = minY - pad; spot.maxY = maxY + pad;
    spot.cx = cx;
    spot.cy = cy;
    // The blit frame is centred on the ANCHOR, not on the crack span, and cracks
    // grow outward from the anchor asymmetrically. Sizing the canvas from the
    // span therefore cut the far side off (measured: 3 of 17 zones clipped on a
    // straight edge). Size it from the farthest point from the centre instead.
    let far = 0;
    spot.cracks.forEach(function(c){
      c.forEach(function(p){
        const d = Math.hypot(p[0] - cx, p[1] - cy);
        if(d > far) far = d;
      });
    });
    // The bake radius must cover whichever reaches further: the farthest crack,
    // or the SCORCH HALO. The halo paints out to reach*1.42 wobbled by up to
    // ±16%, so reach*1.7 is its true outer limit. Sizing the canvas from the
    // crack span alone cut one or the other off on a straight edge (measured:
    // 3 of 17 zones clipped before, 14 of 16 when only the halo was enlarged).
    spot.bakeR = Math.max(far, reach * 1.70) + 0.25;
    // core culls on r, so it must match the bake or a visible corner can pop out
    spot.r = spot.bakeR;
    return spot;
  }

  Delve.registerGrowthStyle("forge", {
    // Hot gradient: dark crust -> dull clinker -> ember -> hot orange -> white heat
    palette: function(bm){ return bm.growthEmberPal || bm.growthPal; },

    place: function(G, mc, pal, U){
      const spots = [], climbs = [];
      U.regions(G).forEach(function(tiles){
        if(tiles.length < 6) return;
        if(Math.random() > (mc.roomChance || 0.88)) return;
        const large = tiles.length >= (mc.largeArea || 38);
        const plan = [false];
        if(large && Math.random() < (mc.bigChance || 0.35)) plan[0] = true;
        if(Math.random() < (mc.largeChance || 0.60)) plan.push(false);
        for(let i = 0; i < plan.length; i++){
          const pick = U.pickAnchor(G, tiles, mc);
          if(!pick) continue;
          const rnd = U.rngFrom(1 + Math.floor(Math.random() * 2147483646));
          const spot = makeZone(G, pick, mc, plan[i], rnd);
          if(!spot) continue;
          spots.push(spot);
          // Linked walls: the heat is behind the stone, so a zone that touches a
          // wall sends slag up it — at most two climbs, as every form does.
          for(let k = 0; k < spot.walls.length && k < 2; k++) climbs.push(spot.walls[k]);
        }
      });
      return { floor: spots, walls: climbs };
    },

    bake: function(spot, pal, U){
      const G = Delve.G;
      if(!G || !G.grid || !spot.cracks) return null;
      // Big enough for the scorch halo AND the farthest crack, with the anchor at
      // the centre. Both were getting cut by a straight edge when the canvas was
      // sized from the crack span alone.
      const half = Math.max(10, Math.ceil((spot.bakeR || spot.r) * PX));
      const S = half * 2;
      const b = U.newBake(S);
      const d = b.d;
      const ox = spot.cx * PX - half, oy = spot.cy * PX - half;
      const pick = function(i){
        return U.hex6(pal[Math.max(0, Math.min(pal.length - 1, i))]);
      };
      const crust   = pick(0);     // darkest: burnt crust
      const clinker = pick(1);
      const emberDim= pick(2);
      const emberHot= pick(3);
      const white   = pick(4);

      function put(px, py, rgb, alpha){
        const i = Math.round(px), j = Math.round(py);
        if(i < 0 || j < 0 || i >= S || j >= S) return;
        const tx = Math.floor((ox + i + 0.5) / PX), ty = Math.floor((oy + j + 0.5) / PX);
        const row = G.grid[ty];
        if(!row || row[tx] !== T().FLOOR) return;   // never over the furniture
        const o = (j * S + i) * 4;
        if(d[o + 3] > alpha) return;                // lighter paint wins
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = alpha;
      }

      // 1. the scorched halo: a dark, ragged stain around the whole zone. Cheap
      //    and wide — this is what makes the patch read as heat damage at a
      //    glance, before any crack is legible.
      const cx = spot.cx, cy = spot.cy, R = spot.reach;
      const p1 = (spot.seed % 628) / 100;
      const rr = Math.ceil((R * 1.5) * PX) + 2;
      for(let j = -rr; j <= rr; j++){
        for(let i = -rr; i <= rr; i++){
          const tx = i / PX, ty = j / PX;
          const dd = Math.hypot(tx, ty);
          const ang = Math.atan2(ty, tx);
          const wob = 1 + 0.16 * Math.sin(3 * ang + p1) + 0.09 * Math.sin(5 * ang + p1 * 1.7);
          if(dd > R * 1.42 * wob) continue;
          // fade outward, and dither the edge so it never reads as a disc.
          // Alpha is deliberately LOW: the halo is a stain on the crust, not a
          // hole in it. The first pass painted it at 110-200 and the zone read
          // as a black blob with the cracks lost inside it.
          const falloff = 1 - dd / (R * 1.42 * wob);
          const h = Delve.hash3(i + 128, j + 128, spot.seed & 511);
          if(h > falloff * 1.35 + 0.12) continue;
          put(cx * PX - ox + i, cy * PX - oy + j, crust,
              54 + Math.round(falloff * 76));
        }
      }

      // 2. the cracks. Drawn as a hot core with a dimmer bleed either side, so
      //    each fissure has depth instead of being a flat red line. Intensity
      //    follows the point's heat, so cracks cool toward their tips.
      spot.cracks.forEach(function(pts){
        for(let k = 0; k < pts.length; k++){
          const p = pts[k], heat = p[2];
          const px = p[0] * PX - ox, py = p[1] * PX - oy;
          // bleed: a wide, very transparent halo of heat on the crust
          for(let oy2 = -2; oy2 <= 2; oy2++){
            for(let ox2 = -2; ox2 <= 2; ox2++){
              const dist = Math.hypot(ox2, oy2);
              if(dist > 2.2) continue;
              if((ox2 === 0 && oy2 === 0)) continue;
              put(px + ox2, py + oy2, emberDim,
                  Math.round(38 * heat * (1 - dist / 2.4)));
            }
          }
          // the fissure itself, hottest in the middle of the crack's life. Wide
          // enough to be legible: a 1px hairline disappeared against the crust
          // at play zoom, so the near-root half of each crack is 2px of hot
          // colour with a white core.
          put(px, py, heat > 0.72 ? white : emberHot, 240);
          if(heat > 0.35){
           put(px + 1, py, emberHot, 205);
           put(px, py + 1, emberHot, 150);
          }
          if(heat > 0.80){
           put(px + 1, py - 1, white, 210);
           put(px - 1, py, emberHot, 160);
          }
        }
      });

      // 3. ember hubs: a small bright core where the cracks meet. These are the
      //    points the eye is drawn to, so they get the white heat and a bloom.
      spot.hubs.forEach(function(h){
        const px = h[0] * PX - ox, py = h[1] * PX - oy;
        const size = 1 + h[2];
        for(let j = -Math.ceil(size); j <= Math.ceil(size); j++){
          for(let i = -Math.ceil(size); i <= Math.ceil(size); i++){
            const dd = Math.hypot(i, j);
            if(dd > size) continue;
            if(dd > size - 1) put(px + i, py + j, emberDim, 90);
            else put(px + i, py + j, dd < 1 ? white : emberHot, 245);
          }
        }
      });

      return U.commitBake(b);
    },

    wallDesigns: function(C){ return C.WALL_SLAG || C.WALL_MOSS || []; }
  });
})();
