window.Delve = window.Delve || {};
(function(){

 // ── js/manifest.js : the canonical script load order ──────────
 // ONE place that says what order the game's files load in.
 //
 // Why this file exists: index.html has to list its <script> tags physically
 // (there is no build step and no bundler), and test.html used to keep its own
 // hand-copied FILES[] array. Those two lists drifted — which is exactly what
 // test.html's "index.html parity" section was written to catch after the fact.
 // Now test.html reads this list instead of copying it, and tools/check-order.js
 // asserts that index.html matches it.
 //
 // RULES
 //  · index.html's <script src> tags must be THIS list, in THIS order.
 //  · Every .js file under js/ must appear here and nowhere twice.
 //  · Order is load order, and it matters:
 //      manifest, util      — no dependencies at all
 //      config              — Delve.CONFIG, needed by every content file
 //      content/con-*       — data and art; register onto Delve.CONFIG / sprites
 //      state               — Delve.T/G, ward + monster-band lookups
 //      generation          — levels, ground, growth, puddles
 //      systems             — traits, combat, movement, rewards, effects, sfx, log
 //      presentation        — render  (reads everything above)
 //      input/ui/boot       — pathfind, input, ui, menu, progression, main
 //
 // Run `node tools/check-order.js` after adding, removing or renaming a file.

 Delve.MANIFEST = [
  "js/manifest.js",          // this list
  "js/util.js",              // pure helpers: rng, clamp, hashes, colour
  "js/config.js",            // Delve.CONFIG — tuning + content registries

  // ── content: data ──────────────────────────────────────────
  "js/content/con-monsters.js",
  "js/content/con-items.js",
  "js/content/con-itemaffixes.js",
  "js/content/con-biomes.js",
  "js/content/con-traits.js",
  "js/content/con-progression.js",
  "js/content/con-events.js",   // floor events: data only

  // ── save + derived stats ───────────────────────────────────
  "js/save.js",
  "js/attrs.js",

  // ── items + sprite builders ────────────────────────────────
  "js/itemgen.js",           // item construction: quality budget, stats, affixes
  "js/items.js",             // item runtime: price, sell, pickup, equip, shop
  "js/sprites.js",
  "js/content/con-bosssprites.js",
  "js/content/con-itemsprites.js",
  "js/content/con-worldart.js",
  "js/content/con-monstersprites.js",

  // ── run state + floor generation ───────────────────────────
  "js/state.js",
  "js/gen/bsp.js",           // floor-plan geometry: split, neighbour graph, paint
  "js/gen/bossarena.js",     // boss floors: three-part arena layout + dressing
  "js/levels.js",
  "js/ground.js",
  "js/growth/core.js",       // growth framework: placement, bake cache, wall climbs
  "js/growth/moss.js",       // form "moss"      — the Upper Ruins' lobed patches
  "js/growth/mycelium.js",   // form "mycelium"  — the Blackvein's branching veins
  "js/puddles.js",

  // ── systems ────────────────────────────────────────────────
  "js/traits.js",
  "js/combat.js",
  "js/movement.js",
  "js/rewards.js",
  "js/encounters.js",           // floor events + ambushes
  "js/effects.js",
  "js/sfx.js",
  "js/log.js",

  // ── presentation ───────────────────────────────────────────
  "js/render/tiles.js",
  "js/render.js",

  // ── input, ui, boot ────────────────────────────────────────
  "js/pathfind.js",
  "js/input.js",
  "js/ui.js",
  "js/menu.js",
  "js/progression.js",
  "js/main.js"
 ];

})();
