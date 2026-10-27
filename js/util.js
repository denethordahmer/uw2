window.Delve = window.Delve || {};
(function(){

 // ── js/util.js : pure helpers, no game state ──────────────────
 // Everything here is a deterministic or purely arithmetic function: nothing
 // reads or writes Delve.G, the grid, the save or the DOM. That is what makes it
 // safe to load dead first — before the content files, before state.js.
 //
 // These used to be scattered:
 //   · rng / rngF / clamp / mdist / hash2 / hash3 lived in state.js, which loads
 //     AFTER the content files, so con-worldart.js had to wrap the hashes lazily
 //   · geq / leq / prob lived only inside levels.js
 //   · rgbOf / mixRGB / blendHex lived only inside render.js
 // Moving them here does not change a single result: each body is copied
 // verbatim. render.js and levels.js keep thin local aliases so their call sites
 // read exactly as before.

 // ── randomness ───────────────────────────────────────────────
 // Delve.rng is the ONLY source of run randomness. It is Math.random-based, so
 // runs are not reproducible; the deterministic position hashes below are what
 // make decoration stable within a generation.
 Delve.rng  = function(min, max){ return Math.floor(Math.random()*(max-min+1))+min; };
 Delve.rngF = function(){ return Math.random(); };

 // ── arithmetic ───────────────────────────────────────────────
 Delve.clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };
 Delve.mdist = function(x1, y1, x2, y2){ return Math.abs(x1-x2) + Math.abs(y1-y2); };

 // prob(p) is true with probability p. Written as a min() comparison rather than
 // `r < p` so that p >= 1 is always true and p <= 0 always false, without a
 // special case.
 Delve.prob = function(p){ var r = Math.random(); return Math.min(r,p) === r; };

 // Tolerant comparisons. `a >= b` is not safe when either side is a float that
 // should have landed exactly on b, so these compare via min/max identity.
 Delve.geq = function(a, b){ return Math.max(a,b) === a; };
 Delve.leq = function(a, b){ return Math.min(a,b) === a; };

 // ── deterministic position hashes ────────────────────────────
 // hash2 maps an integer (x,y) to [0,1). Same input, same output, forever —
 // this is what keeps decoration pinned to a tile across frames and re-renders.
 //
 // NOTE: this is NOT a uniformly distributed hash. The multiply overflows 2^53
 // and loses precision, which biases small-integer inputs low (measured: one
 // salt returned only 0..0.46). That is fine for scattering decoration, but it
 // is not good enough for texture noise — js/render.js bakes its floor textures
 // with a separate Math.imul-based texHash for exactly that reason. Do not
 // "fix" this one without re-checking every tile layout that depends on it.
 Delve.hash2 = function(x, y){
  let n = x*374761393 + y*668265263;
  n = (n ^ (n>>13)) * 1274126177;
  return ((n ^ (n>>16)) >>> 0) / 4294967295;
 };
 Delve.hash3 = function(x, y, salt){ return Delve.hash2(x*2053+salt, y*3571+salt*7); };

 // ── colour ───────────────────────────────────────────────────
 // rgbOf("#3b2f1d") -> [59, 47, 29]. Expects a 6-digit hex with the '#'.
 Delve.rgbOf = function(hex){
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
 };

 // Linear interpolate between two [r,g,b] arrays. Returns an array (unrounded) so
 // callers can keep chaining mixes before clamping to bytes.
 Delve.mixRGB = function(a, b, t){
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
 };

 // blendHex("#111111", "#ffffff", 0.5) -> "#888888". Same idea as mixRGB but
 // stays in hex-land and rounds, because these values go straight into fillStyle.
 Delve.blendHex = function(hex, hex2, t){
  const p = c => parseInt(c, 16);
  const r1 = p(hex.slice(1,3)),  g1 = p(hex.slice(3,5)),  b1 = p(hex.slice(5,7));
  const r2 = p(hex2.slice(1,3)), g2 = p(hex2.slice(3,5)), b2 = p(hex2.slice(5,7));
  const r = Math.round(r1 + (r2-r1)*t).toString(16).padStart(2,"0");
  const g = Math.round(g1 + (g2-g1)*t).toString(16).padStart(2,"0");
  const b = Math.round(b1 + (b2-b1)*t).toString(16).padStart(2,"0");
  return "#" + r + g + b;
 };

})();
