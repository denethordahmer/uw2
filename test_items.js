#!/usr/bin/env node
// test_items.js - Node regression suite for the item overhaul.
//
// This is the ONE command to run before shipping a change. It does three things:
//   - Load-order guard: runs tools/check-order.js, which asserts that
//     js/manifest.js, index.html and the files on disk all agree.
//   - DOM wiring guard: runs test_ui.js, which builds a DOM from the real
//     index.html and clicks the actual buttons.
//   - Item checks: loads the real game scripts in manifest order (canvas and
//     document stubbed) and verifies the numbers the item overhaul locks down.
//
// All three must pass. A load-order failure exits non-zero before a single game
// script loads, so a broken manifest can never quietly "pass" the item suite.
// The wiring guard exists because every check below runs against a stubbed
// `document`: an element lookup that returns a stand-in instead of null looks
// perfectly healthy here and dies silently in the browser.
//
// Run: node test_items.js
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");
const root = __dirname;

// ── 1. load-order guard ───────────────────────────────────────
// Output is inherited, so check-order.js prints its own ✓/✗ lines inline.
try {
  execFileSync(process.execPath, [path.join(root, "tools", "check-order.js")], { stdio: "inherit" });
} catch (e) {
  console.log("");
  console.log("LOAD ORDER FAILED — fix js/manifest.js and/or index.html.");
  console.log("Item results below would be meaningless: the suite may be loading a");
  console.log("different set of files than the game actually ships.");
  process.exit(1);
}

// ── 1b. DOM wiring guard ──────────────────────────────────────
// Numbered 1b so the item sections below keep their own 1-12 numbering.
// Runs in its own process: it builds a real element tree from index.html and
// dispatches real clicks, which the stubbed `document` below cannot model.
try {
  execFileSync(process.execPath, [path.join(root, "test_ui.js")], { stdio: "inherit" });
} catch (e) {
  console.log("");
  console.log("DOM WIRING FAILED — a button, card or screen stopped responding.");
  console.log("Open the failing check in test_ui.js; it names the element.");
  process.exit(1);
}
console.log("");

function ctx2d(){
  return new Proxy({ canvas:null }, {
    get(t,k){
      if(k in t) return t[k];
      if(k === "measureText") return () => ({ width:8 });
      if(k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop(){} });
      if(k === "getImageData") return () => ({ data:new Uint8ClampedArray(4) });
      return () => {};
    },
    set(t,k,v){ t[k] = v; return true; }
  });
}
// ui.js toggles the map button's lit state, so this stub needs `toggle` as well
// as the add/remove/contains trio. Without it the whole script fails to load.
function fakeClassList(){
  const set = [];
  return {
    add(c){ if(set.indexOf(c) < 0) set.push(c); },
    remove(c){ const i = set.indexOf(c); if(i >= 0) set.splice(i,1); },
    contains(c){ return set.indexOf(c) >= 0; },
    toggle(c){ if(set.indexOf(c) >= 0) this.remove(c); else this.add(c); }
  };
}
const canvas = (w,h) => ({ width:w||24, height:h||24, style:{}, classList:fakeClassList(), getContext:()=>ctx2d(), toDataURL:()=>"", addEventListener(){} });
// `dataset` too: updateHUD writes the bag count to #invBtn.dataset.bag. Real
// elements always have one, so the stub has to as well.
const el = () => ({ style:{}, dataset:{}, classList:fakeClassList(), appendChild(){}, insertBefore(){}, addEventListener(){}, removeEventListener(){}, querySelector:()=>null, getContext:()=>ctx2d(), textContent:"", innerHTML:"", children:[], parentNode:{ insertBefore(){} }, width:100, height:100, getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}) });

const ctx = { console, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, Date, Math, JSON, requestAnimationFrame:()=>0 };
ctx.window = ctx;
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
ctx.document = { createElement:(t)=>t==="canvas"?canvas():el(), getElementById:()=>el(), querySelector:()=>el(), querySelectorAll:()=>[], addEventListener(){}, body:el(), documentElement:el() };
ctx.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
ctx.navigator = { userAgent:"node" };
ctx.Image = function(){ this.onload = null; };
ctx.performance = { now:()=>Date.now() };
ctx.getComputedStyle = () => ({ display:"none" });
ctx.location = { href:"http://localhost/" };
vm.createContext(ctx);

// Load order comes from js/manifest.js — the single declared list. This file
// used to carry its own copy, which silently drifted: after the pure helpers
// moved into js/util.js this list still skipped it, and the suite only passed
// because the item checks never happened to call them. Reading the manifest
// means that class of breakage cannot hide again.
vm.runInContext(fs.readFileSync(path.join(root, "js/manifest.js"), "utf8"), ctx, { filename: "js/manifest.js" });
const FILES = (ctx.Delve && Array.isArray(ctx.Delve.MANIFEST)) ? ctx.Delve.MANIFEST.slice() : null;
if(!FILES || !FILES.length){
  console.log("LOAD FAIL js/manifest.js did not expose Delve.MANIFEST");
  process.exit(1);
}

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if(!cond){ fails++; console.log("  FAIL " + msg); } };
const near = (a,b,tol,msg) => ok(Math.abs(a-b) <= tol, msg + " (got " + (Math.round(a*100)/100) + ", want " + b + ")");

for(const f of FILES){
  try { vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"), ctx, { filename:f }); }
  catch(e){ console.log("LOAD FAIL", f, e.message); process.exit(1); }
}
const D = ctx.Delve, C = D.CONFIG;
console.log("loaded " + FILES.length + " scripts\n");

function newRun(floor, level){
  D.save = { lvls:{con:0,str:0,tou:0,luc:0,agi:0,eng:0}, unlocks:{}, nodes:{}, inventoryCap:16, abilities:[], abilityRanks:{}, runTraits:[], runTraitsSeen:[] };
  D.G = { floor:floor, equip:{}, inventory:[], items:[], gold:0, level:level||1, hp:40, effects:[], abilities:[], runShards:0, monsters:[], goldPiles:[] };
}
function dpsOf(weapon, level){
  D.G.equip.weapon = weapon;
  const b = D.weaponBand();
  const avg = (b.min + b.max) / 2 + D.bonusAtk() * (D.speedScale ? D.speedScale() : 1);
  return avg * D.playerSpeed() / 0.6;
}

// ── 1. Quality curve ────────────────────────────────────────────────────────
newRun(1,1);
let outOfRange = 0;
for(let i=0;i<5000;i++){ const q = D.qualityOf(1 + (i % 40), 1); if(q < 1 || q > 100) outOfRange++; }
ok(outOfRange === 0, "quality always in 1..100");
ok(D.bandOf(19) === 1 && D.bandOf(20) === 2 && D.bandOf(40) === 3 && D.bandOf(60) === 4, "bands 20/40/60");

// ── 2. Generation invariants ───────────────────────────────────────────────
newRun(15,5);
let overBudget = 0, badBand = 0, noArt = 0, badAffixes = 0;
for(let i=0;i<4000;i++){
  const fl = 1 + Math.floor(Math.random()*40);
  const it = D.makeGear(null, fl, {});
  if(!it) continue;
  if(it.points > D.pointsOfQuality(it.quality) + 0.01) overBudget++;
  if(it.tier !== D.bandOf(it.quality)) badBand++;
  if(!D.itemSprite(it)) noArt++;
  const cap = {1:0,2:1,3:2,4:3}[it.tier];
  if((it.affixes||[]).length > cap) badAffixes++;
  if(it.name.indexOf("undefined") >= 0) ok(false, "name has undefined: " + it.name);
}
ok(overBudget === 0, "no item exceeds its point budget (" + overBudget + ")");
ok(badBand === 0, "display band always matches quality (" + badBand + ")");
ok(noArt === 0, "every generated item has art (" + noArt + ")");
ok(badAffixes === 0, "affix count never exceeds the band cap (" + badAffixes + ")");

// ── 3. Pricing rule ────────────────────────────────────────────────────────
newRun(1,1);
const disc = 1 - D.luckDiscount();
const priced = D.makeGear("body", 1, { tier:1 }); priced.points = 3;
near(D.itemPrice(priced), Math.round(3*43*disc), 1, "3-point item at ward 1 = 129 less Luck discount");
ok(D.sellValue(priced) === 12, "3-point item sells for 12 (got " + D.sellValue(priced) + ")");

// ── 4. Weapon band + Strength caps ─────────────────────────────────────────
newRun(20,1);
const dag = D.makeGear("weapon", 20, { style:"dagger", tier:3 });
dag.itemMax = 5; dag.shape = 0.45; dag.strCeiling = 10; dag.affixes = []; dag.str = 0;
D.G.equip.weapon = dag;
near(D.weaponBand().max, 5 + 6/1.40, 0.05, "dagger max at STR 6");
D.save.lvls.str = 20;
near(D.weaponBand().max, 5 + 10/1.40, 0.05, "dagger caps Strength at 10");
D.save.lvls.str = 0;

// ── 5. Family parity (the locked promise) ──────────────────────────────────
// Affixes are a deliberate trade (a big "of Warding" costs damage), so parity is
// measured on the base budget: affix rolls are switched off for this check only.
const spreadBy = {};
const savedAffixCfg = C.ITEMS.affixes;
C.ITEMS.affixes = { 1:0, 2:0, 3:0, 4:0, maxPrefix:1, maxSuffix:2 };
// Quality is noisy by design (sigma = 5 + 0.3*floor). Pin it, or the check
// measures the dice instead of the families.
const savedQualityOf = D.qualityOf;
D.qualityOf = () => 60;
for(const f of [5,15,30,40]){
  newRun(f, Math.max(1, Math.floor(f*0.45)));
  const vals = {};
  for(const fam of ["dagger","sword","spear","axe","hammer"]){
    const w = D.makeGear("weapon", f, { style:fam, tier:D.bandOf(D.qualityOf(f,1)) });
    vals[fam] = dpsOf(w);
  }
  const v = Object.values(vals);
  spreadBy[f] = (Math.max(...v) - Math.min(...v)) / Math.max(...v);
  ok(spreadBy[f] < 0.10, "F" + f + " family DPS spread < 10% (" + (spreadBy[f]*100).toFixed(1) + "%: " +
     Object.keys(vals).map(k => k + " " + vals[k].toFixed(1)).join(", ") + ")");
}
C.ITEMS.affixes = savedAffixCfg;
D.qualityOf = savedQualityOf;

// ── 6. Drop shape ──────────────────────────────────────────────────────────
newRun(5,3);
const kills = 20000; let gear = 0;
for(let i=0;i<kills;i++) if(D.rollKillDrop(1,1,{name:"x"})) gear++;
ok(gear/kills > 0.15 && gear/kills < 0.21, "gear drop rate ~18% (got " + (100*gear/kills).toFixed(1) + "%)");
const slotShare = {};
for(let i=0;i<30000;i++){ const s = D.rollSlot(); slotShare[s] = (slotShare[s]||0)+1; }
ok(Math.abs(slotShare.weapon/30000 - 0.23) < 0.03, "weapon ~23% of gear (got " + (100*slotShare.weapon/30000).toFixed(1) + "%)");
ok(Math.abs(slotShare.ring/30000 - 0.05) < 0.02, "ring ~5% of gear (got " + (100*slotShare.ring/30000).toFixed(1) + "%)");

// ── 7. Uniques: art, budget, gating ────────────────────────────────────────
D.ITEM_UNIQUES.forEach(u => {
  const it = D.makeUnique(u.id, 20);
  ok(!!it, "unique builds: " + u.id);
  ok(it.points > 0, "unique has a positive point value: " + u.id);
  ok(D.itemSprite(it) && D.itemSprite(it).width === 24, "unique has art: " + u.id);
  ok(it.name === u.name, "unique keeps its name: " + u.id);
});
newRun(10,4);
let ungated = 0;
for(let i=0;i<5000;i++){ const it = D.makeItem(3, { unique:true, kind:"none" }); if(it && it.unique) ungated++; }
ok(ungated === 0, "no uniques from an ungated roll (" + ungated + ")");
const shop = D.makeShopStock(D.G);
ok(shop.every(s => !s.item.unique), "no uniques in shop stock");
ok(shop.some(s => s.item.slot !== "consumable" && s.item.quality > 0), "shop sells rolled gear");

// ── 8. Pacing (TTK, real monster HP) ───────────────────────────────────────
function monsterHp(f){
  let band = null;
  for(const b of C.MONSTER_BANDS) if(f >= b.floors[0] && f <= b.floors[1]) band = b;
  if(!band) return null;
  let tot = 0, wsum = 0;
  for(const k in band.weights){ const m = C.MONSTER_ROSTER[k]; tot += band.weights[k] * (m.hp + Math.floor((f-1)*(m.hpPerFloor||0))); wsum += band.weights[k]; }
  return tot / wsum;
}
console.log("\n  floor  lvl   DPS    mHP    TTK   family");
for(const f of [1,5,10,15,20,25,30,35,40]){
  newRun(f, Math.max(1, Math.floor(f*0.45)));
  for(const slot of ["weapon","body","head","hands","feet","cloak"]){
    const it = D.makeGear(slot, f, {});
    if(it) D.G.equip[slot] = it;
  }
  const b = D.weaponBand();
  const avg = (b.min + b.max)/2 + D.bonusAtk() * (D.speedScale ? D.speedScale() : 1);
  const dps = avg * D.playerSpeed() / 0.6;
  const mhp = monsterHp(f);
  const ttk = mhp ? mhp / dps : null;
  console.log("  " + String(f).padStart(5) + String(D.G.level).padStart(5) + dps.toFixed(1).padStart(7) +
              (mhp ? mhp.toFixed(0).padStart(6) : "     -") + (ttk ? ttk.toFixed(2).padStart(7) : "      -") +
              "   " + (D.G.equip.weapon ? D.G.equip.weapon.style : "fists"));
  if(ttk) ok(ttk > 0.55 && ttk < 3.6, "F" + f + " TTK in band (" + ttk.toFixed(2) + "s)");
}

// ── 9. Save migration drops pre-v4 gear ────────────────────────────────────
const run = { floor:4, inventory:[{id:"x",slot:"body",tier:2,atk:3},{id:"p",slot:"consumable",tier:1}], equip:{ weapon:{id:"w",slot:"weapon",tier:2,atk:3} }, items:[] };
const cleaned = D.__testSanitizeRun ? D.__testSanitizeRun(run) : null;
if(cleaned){
  ok(cleaned.inventory.length === 1 && cleaned.inventory[0].slot === "consumable", "old gear dropped, potion kept");
  ok(cleaned.equip.weapon === null, "old equipped weapon dropped");
}

// ── 10. Boss gold stays gold until the player leaves ───────────────────────
newRun(10, 5);
D.G.gold = 137;
D.G.runShards = 0;
// triggerVictory ends by drawing the frame; this harness has no grid, so stub the
// presentation calls and keep the test on the economy logic.
const _draw = D.draw, _hud = D.updateHUD, _victory = D.showVictory;
D.draw = () => {}; D.updateHUD = () => {}; D.showVictory = () => {};
D.triggerVictory(1);
D.draw = _draw; D.updateHUD = _hud; D.showVictory = _victory;
ok(D.G.gold === 137, "victory does not convert gold (design L11)");
ok(D.G.runShards === 0, "no shards minted from gold at victory");

// ── 11. Selling carried gear ───────────────────────────────────────────────
newRun(10, 5);
D.G.inventory = [D.makeGear("ring", 10, {}), D.makeGear("weapon", 10, {})].filter(Boolean);
D.G.gold = 0;
const n0 = D.G.inventory.length;
const first = D.G.inventory[0];
const want = D.sellValue(first);
const got = D.sellItem(first);
ok(want > 0, "salvage value is positive");
ok(got === want, "sellItem pays the salvage value");
ok(D.G.gold === want, "sale adds gold");
ok(D.G.inventory.length === n0 - 1, "sold item leaves the bag");
ok(D.sellItem(first) === 0, "cannot sell the same item twice");
const sale = D.sellAll();
ok(D.G.inventory.length === 0, "sellAll empties the bag");
ok(sale.count === n0 - 1 && sale.gold > 0, "sellAll reports count and gold");
ok(D.sellAll().count === 0, "sellAll on an empty bag is a no-op");

// ── 12. Shop renders a sell list without throwing ──────────────────────────
newRun(5, 3);
D.G.inventory = [D.makeGear("ring", 5, {}), D.makeGear("body", 5, {})].filter(Boolean);
D.G.shop = { x:0, y:0, stock: D.makeShopStock(D.G) };
let shopOk = true;
try { D.buildShop(); }
catch(e){ shopOk = false; console.log("  buildShop threw: " + e.message); }
ok(shopOk, "buildShop renders with carried items");

// ── 13. Bag "new" markers and the save round trip ──────────────────────────
newRun(5, 3);
D.G.inventory = [];
D.pickupItem(D.makeGear("ring", 5, {}));
ok(D.unseenCount() === 1, "a pickup is counted as unseen");
ok(D.G.inventory[0].isNew === true, "the flag lives on the item");
D.markItemSeen(D.G.inventory[0]);
ok(D.unseenCount() === 0, "markItemSeen clears one item");
D.G.inventory[0].isNew = true;
ok(D.markBagSeen() === 1, "markBagSeen reports what it cleared");
ok(D.unseenCount() === 0, "and clears everything");
const keepItem = D.makeGear("ring", 5, {});
keepItem.isNew = true;
const savedRun = D.__testSanitizeRun
  ? D.__testSanitizeRun({ floor:5, inventory:[keepItem], items:[] })
  : null;
ok(!!savedRun && savedRun.inventory.length === 1 && savedRun.inventory[0].isNew === undefined,
   "a saved run does not keep the badge flag (no stale dot on resume)");

// ── 14. Per-biome growth forms (js/growth/) ────────────────────────────────
// Growth used to be one hard-coded blob for every ward. It is now a form per
// biome: the biome NAMES a style (BIOMES[n].growthStyle) and one file under
// js/growth/ supplies it. These checks pin the seams, not the art.
console.log("\n-- growth forms ---------------------------------------");
const realRandom = Math.random;
(function seedGrowth(){
  let n = 20250101;
  Math.random = function(){ n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
})();
// A canvas stub that keeps its pixels, so a bake can be inspected.
const realCreate = ctx.document.createElement;
ctx.document.createElement = function(t){
  if(t !== "canvas") return realCreate.call(ctx.document, t);
  const el = { width:0, height:0, style:{}, _img:null };
  el.getContext = () => ({
    createImageData:(w,h)=>({ width:w, height:h, data:new Uint8ClampedArray(w*h*4) }),
    putImageData(img){ el._img = img; },
    fillRect(){}, drawImage(){}, save(){}, restore(){}, translate(){}, rotate(){}
  });
  return el;
};

// A floor of two walled rooms: enough shape for anchors, wall links and the
// "large room" branch of the placement plan.
function growthGrid(){
  const W = 24, H = 16, g = [];
  for(let y = 0; y < H; y++) g.push(new Array(W).fill(D.T.WALL));
  for(let y = 2; y <= 8; y++) for(let x = 2; x <= 13; x++) g[y][x] = D.T.FLOOR;
  for(let y = 10; y <= 13; y++) for(let x = 2; x <= 8; x++) g[y][x] = D.T.FLOOR;
  return { grid:g, gridW:W, gridH:H, floor:5 };
}
function runGrowth(ward){
  const saved = D.getWard;
  if(ward) D.getWard = function(){ return ward; };
  const G = growthGrid();
  D.G = G;
  D.placeGrowth(G);
  D.getWard = saved;
  return G;
}
function bakeAll(styleId, G, biome){
  const st = D.growthStyles[styleId];
  const bm = C.BIOMES[biome] || {};
  const pal = st.palette ? st.palette(bm) : (bm.growthPal || []);
  return (G.growth.floor || []).map(sp => st.bake(sp, pal, D.growthUtil));
}
// Painted pixels split by where they land: on plain floor, or anywhere else.
function paintSplit(G, imgs){
  let on = 0, off = 0;
  G.growth.floor.forEach(function(sp, idx){
    const c = imgs[idx];
    if(!c || !c._img) return;
    const S = c.width, d = c._img.data;
    const span = S / 16;                       // the canvas, in tiles
    const ox = sp.cx - span / 2, oy = sp.cy - span / 2;
    const off = 0.5 / 16;                      // a pixel's centre, in tiles
    for(let j = 0; j < S; j++){
      for(let i = 0; i < S; i++){
        if(!d[(j * S + i) * 4 + 3]) continue;
        const tx = Math.floor(ox + i / 16 + off), ty = Math.floor(oy + j / 16 + off);
        const row = G.grid[ty];
        if(row && row[tx] === D.T.FLOOR) on++; else off++;
      }
    }
  });
  return { on: on, off: off };
}

const styles = Object.keys(D.growthStyles || {}).sort();
ok(styles.indexOf("moss") >= 0, "the moss form is registered");
ok(styles.indexOf("mycelium") >= 0, "the mycelium form is registered");
const formless = C.BIOMES.filter(function(b, i){
  const ward = C.WARDS.filter(function(w){ return w.biome === i; })[0];
  return ward && ward.growth && !(b.growthStyle && D.growthStyles[b.growthStyle]);
});
ok(formless.length === 0, "every biome that grows anything names a registered form" +
   (formless.length ? " (bad: " + formless.map(b => b.name).join(", ") + ")" : ""));
ok(C.BIOMES[0].growthStyle === "moss" && C.BIOMES[1].growthStyle === "mycelium",
   "biome 1 grows moss and biome 2 grows mycelium — not the same form");
ok(C.BIOMES[1].growthVeinPal && C.BIOMES[1].growthVeinPal.length >= 3 &&
   C.BIOMES[1].growthVeinPal.join() !== C.BIOMES[1].growthPal.join(),
   "the Blackvein has its own vein palette");
// The owner's note: the first mycelium pass read as biome 1's moss. The palette
// is now IVORY — no shade may be green-dominant, and the floor's own filaments
// must use the same colour instead of borrowing b.moss.
const hexRGB = function(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; };
const greenish = (C.BIOMES[1].growthVeinPal || []).filter(function(h){
  const c = hexRGB(h);
  return (c[1] - c[0]) > 10;            // green above red = a green tint
});
ok(greenish.length === 0, "the mycelium palette is ivory, not green" +
   (greenish.length ? " (green-dominant: " + greenish.join(",") + ")" : ""));
ok(!!C.BIOMES[1].growthThread, "the Blackvein names its own floor-filament colour");
ok((C.BIOMES[1].growthThread || "") !== C.BIOMES[1].moss,
   "and it is not the moss colour the threads used to borrow");
ok(Array.isArray(C.WALL_MYCELIUM) && C.WALL_MYCELIUM.length >= 2 &&
   C.WALL_MYCELIUM.every(function(d){ return d.length === 16 && d.every(r => r.length === 16); }),
   "the mycelium wall climbs are 16x16 art, like C.WALL_MOSS");

// The moss form still paints, and links its walls.
const mossG = runGrowth(C.WARDS[0]);
ok((mossG.growth.floor || []).length > 0, "the moss form places patches on a floor");
ok((mossG.growth.walls || []).length > 0, "and links wall climbs to them");
const mossImgs = bakeAll("moss", mossG, 0);
ok(mossImgs.length === mossG.growth.floor.length && mossImgs.every(c => c && c._img),
   "every moss patch bakes a canvas");
const mossSplit = paintSplit(mossG, mossImgs);
ok(mossSplit.on > 50, "the moss patch actually paints (" + mossSplit.on + " fine px)");
ok(mossSplit.off === 0, "moss never paints off plain floor (" + mossSplit.off + ")");
ok(!mossG.growth.error, "moss placement reported no error" +
   (mossG.growth.error ? " (" + mossG.growth.error + ")" : ""));

// The veins: they place, they bake, they are thin, and they stay on the floor.
const veinG = runGrowth(C.WARDS[1]);
ok((veinG.growth.floor || []).length > 0, "the mycelium form places colonies on a floor");
const veinImgs = bakeAll("mycelium", veinG, 1);
ok(veinImgs.length === veinG.growth.floor.length && veinImgs.every(c => c && c._img),
   "every colony bakes a canvas");
ok(veinG.growth.floor.every(sp => Array.isArray(sp.paths) && sp.paths.length > 0),
   "every colony keeps its strands");
const veinSplit = paintSplit(veinG, veinImgs);
ok(veinSplit.off === 0, "veins never paint off plain floor (" + veinSplit.off + ")");
ok(!veinG.growth.error, "mycelium placement reported no error" +
   (veinG.growth.error ? " (" + veinG.growth.error + ")" : ""));
let vPainted = 0, vTotal = 0;
veinImgs.forEach(function(c){
  const d = c._img.data;
  vTotal += c.width * c.height;
  for(let i = 3; i < d.length; i += 4) if(d[i]) vPainted++;
});
const vCover = vTotal ? vPainted / vTotal : 0;
ok(vCover > 0.02, "the veins paint (" + (100 * vCover).toFixed(1) + "% of their canvas)");
ok(vCover < 0.55, "and stay veins, not a carpet (" + (100 * vCover).toFixed(1) + "%)");

// Determinism: the same spot must bake to the same pixels every time.
const vst = D.growthStyles.mycelium;
const vpal = vst.palette ? vst.palette(C.BIOMES[1]) : C.BIOMES[1].growthPal;
const vsp = veinG.growth.floor[0];
const vb1 = vst.bake(vsp, vpal, D.growthUtil), vb2 = vst.bake(vsp, vpal, D.growthUtil);
ok(!!vb1 && !!vb2 && Buffer.compare(Buffer.from(vb1._img.data), Buffer.from(vb2._img.data)) === 0,
   "baking is a pure function of the spot (same seed, same pixels)");

// Shapes vary: a floor should not repeat one silhouette.
const shapeKeys = {};
veinG.growth.floor.forEach(function(sp){
  shapeKeys[sp.paths.length + ":" + Math.round(sp.reach * 10)] = 1;
});
ok(Object.keys(shapeKeys).length >= Math.min(2, veinG.growth.floor.length),
   "colonies differ in shape (" + Object.keys(shapeKeys).length + " variants)");

// Every climb sits against floor — the linked rule.
let strandedClimb = 0;
(veinG.growth.walls || []).forEach(function(w){
  const near = [[1,0],[-1,0],[0,1],[0,-1]].some(function(d){
    const row = veinG.grid[w.y + d[1]];
    return row && row[w.x + d[0]] === D.T.FLOOR;
  });
  if(!near) strandedClimb++;
});
ok(strandedClimb === 0, "no wall climb without a floor colony against it");

// A ward with no growth block grows nothing, whatever its biome says.
const savedWards = C.WARDS[0].growth;
delete C.WARDS[0].growth;
const bare = runGrowth(C.WARDS[0]);
ok((bare.growth.floor || []).length === 0 && (bare.growth.walls || []).length === 0,
   "no growth block, no growth");
C.WARDS[0].growth = savedWards;

// ── the Frosted Vault: seamless ice floor + hoarfrost growth ──
const vault = C.BIOMES[2];
ok(vault.floorStyle === "ice", "biome 3 uses the seamless ice floor");
ok(vault.wallStyle === "ice", "biome 3's walls use the ice fracture style");
ok(vault.growthStyle === "frost" && !!D.growthStyles.frost, "biome 3 grows the frost form");
ok(Array.isArray(C.WALL_FROST) && C.WALL_FROST.length >= 2 &&
   C.WALL_FROST.every(function(d){ return d.length === 16 && d.every(r => r.length === 16); }),
   "the frost wall climbs are 16x16 art");
(function(){
  const w3 = C.WARDS.filter(function(w){ return w.id === 3; })[0];
  ok(!!w3 && !!w3.growth, "ward 3 has a growth block");
  ok(!!w3 && Array.isArray(w3.patches) && w3.patches.length === 0,
     "ward 3 grows no snow-patch tiles (that repeated white tile is gone)");
})();

// The floor itself: drive the real painter and capture the texture it blits.
function floorTexture(biome, ts){
  let tex = null;
  const stub = {
    save(){}, restore(){}, fillRect(){}, beginPath(){}, roundRect(){}, fill(){},
    arc(){}, ellipse(){}, moveTo(){}, lineTo(){}, stroke(){}, closePath(){},
    quadraticCurveTo(){}, arcTo(){}, translate(){}, rotate(){},
    createRadialGradient:()=>({ addColorStop(){} }),
    createLinearGradient:()=>({ addColorStop(){} }),
    drawImage(img){ if(img && img._img && img.width === 48) tex = img; }
  };
  D.tiles._drawFloorTile(stub, 0, 0, ts || 32, 3, 3, biome);
  return tex;
}
const iceTex = floorTexture(C.BIOMES[2]);
ok(!!iceTex, "the ice floor bakes a 48x48 torus texture");
if(iceTex){
  const d = iceTex._img.data;
  let sum = 0, dark = 0, n = 0;
  for(let i = 0; i < d.length; i += 4){
    const v = (d[i] + d[i+1] + d[i+2]) / 3;
    sum += v; n++;
    if(v < 100) dark++;
  }
  const mean = sum / n;
  ok(mean > 115, "the ice floor reads pale, not dark stone (mean " + mean.toFixed(0) + ")");
  ok(mean < 210, "but not blown-out white (mean " + mean.toFixed(0) + ")");
  ok(dark / n > 0.01 && dark / n < 0.35,
     "the fractures are thin dark seams (" + (100 * dark / n).toFixed(1) + "% dark)");
  // and it is not the masonry: the ruins' texture must differ
  const bondTex = floorTexture(C.BIOMES[0]);
  let differs = false;
  if(bondTex){
    const e = bondTex._img.data;
    for(let i = 0; i < d.length; i += 4){
      if(Math.abs(d[i] - e[i]) > 8){ differs = true; break; }
    }
  }
  ok(differs, "the ice floor is its own surface, not the ruins' masonry");
  // Walls must SEPARATE from the floor: the owner could not tell them apart
  // when both were pale blue, which hid the frost growth climbing them.
  const wl = hexRGB(C.BIOMES[2].wall);
  const wallLum = (wl[0] + wl[1] + wl[2]) / 3;
  ok(mean - wallLum > 40, "biome 3 walls are much darker than its ice floor (" +
     wallLum.toFixed(0) + " vs " + mean.toFixed(0) + ")");
  ok(wl[0] > wl[1], "and a different hue: violet walls (red above green) over a blue floor");
}

// Frost growth on a floor.
const frostG = runGrowth(C.WARDS[2]);
ok((frostG.growth.floor || []).length > 0, "the frost form places colonies on a floor");
ok(!frostG.growth.error, "frost placement reported no error" +
   (frostG.growth.error ? " (" + frostG.growth.error + ")" : ""));
const frostImgs = bakeAll("frost", frostG, 2);
ok(frostImgs.length === frostG.growth.floor.length && frostImgs.every(c => c && c._img),
   "every frost colony bakes a canvas");
const frostSplit = paintSplit(frostG, frostImgs);
ok(frostSplit.on > 30, "the frost dendrites paint (" + frostSplit.on + " fine px)");
ok(frostSplit.off === 0, "frost never paints off plain floor (" + frostSplit.off + ")");
const fst = D.growthStyles.frost;
const fpal = fst.palette ? fst.palette(C.BIOMES[2]) : C.BIOMES[2].growthPal;
ok(C.BIOMES[2].growthFrostPal && C.BIOMES[2].growthFrostPal.join() === fpal.join(),
   "frost uses the Vault's own palette");
const fsp = frostG.growth.floor[0];
const fb1 = fst.bake(fsp, fpal, D.growthUtil), fb2 = fst.bake(fsp, fpal, D.growthUtil);
ok(!!fb1 && !!fb2 && Buffer.compare(Buffer.from(fb1._img.data), Buffer.from(fb2._img.data)) === 0,
   "frost baking is deterministic per spot");

// ── the grass-patch painter must not put a square on the floor ──
// Owner's report: green square tiles all over the Blackvein's floor. The old
// painter stamped a rounded rect over 92% of every patch tile, i.e. a literal
// grid of squares. It is now a world-space noise mask at fine-pixel grain.
console.log("\n-- floor patches -------------------------------------");
(function(){
  const calls = [];
  const rec = {
    save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
    fill(){}, quadraticCurveTo(){}, roundRect(){}, closePath(){}, arc(){}, ellipse(){},
    createRadialGradient:()=>({ addColorStop(){} }),
    createLinearGradient:()=>({ addColorStop(){} }),
    fillStyle:"", strokeStyle:"", globalAlpha:1, lineWidth:1, lineCap:"",
    fillRect(x, y, w, h){ calls.push({ x:x, y:y, w:w, h:h, a:this.globalAlpha }); }
  };
  const bm = D.tiles.biome(C.BIOMES[1] || C.BIOMES[0]);
  D.tiles._drawGrassPatch(rec, 0, 0, 32, 4, 4, bm);
  ok(calls.length > 40, "the patch is painted per fine pixel, not as one tile-sized rect (" +
     calls.length + " fills)");
  const biggest = calls.reduce(function(m, c){ return Math.max(m, c.w * c.h); }, 0);
  ok(biggest < 32 * 32 * 0.5, "no single fill covers half a tile (" + Math.round(biggest) + " px2)");
  const alphas = {};
  calls.forEach(function(c){ alphas[c.a.toFixed(2)] = 1; });
  ok(Object.keys(alphas).length >= 2,
     "the patch edge fades (distinct alphas: " + Object.keys(alphas).length + ")");
})();

// ── the Bone Ossuary: loam floor + dug zones with bones ──
const oss = C.BIOMES[3];
ok(oss.floorStyle === "loam", "biome 4 uses the seamless loam floor");
ok(oss.growthStyle === "disturbed" && !!D.growthStyles.disturbed,
   "biome 4 grows the disturbed-earth form");
ok(!oss.wallStyle, "biome 4 keeps the masonry walls (only the Vault overrode them)");
(function(){
  const w4 = C.WARDS.filter(function(w){ return w.id === 4; })[0];
  ok(!!w4 && Array.isArray(w4.patches) && w4.patches.length === 0,
     "ward 4 grows no patch tiles (the pale bone-dust squares are gone)");
  ok(!!w4 && !!w4.growth && w4.growth.cornerBias === 0 && w4.growth.wallBias === 0,
     "ward 4's zones open on plain floor, not at walls");
})();
ok((D.growthStyles.disturbed.shapes || []).length === 8,
   "the bone kit holds 8 shapes (" + (D.growthStyles.disturbed.shapes || []).length + ")");

// The loam floor: dark, seamless, with pale grit.
const loamTex = floorTexture(C.BIOMES[3]);
ok(!!loamTex, "the loam floor bakes a 48x48 torus texture");
if(loamTex){
  const d = loamTex._img.data;
  let sum = 0, n = 0, grit = 0;
  for(let i = 0; i < d.length; i += 4){
    const L = (d[i] + d[i+1] + d[i+2]) / 3;
    sum += L; n++;
    if(L > 120) grit++;
  }
  const loamMean = sum / n;
  ok(loamMean < 70, "the loam floor is dark (mean " + loamMean.toFixed(0) + ")");
  ok(grit / n > 0.005 && grit / n < 0.12,
     "with pale bone grit scattered through it (" + (100 * grit / n).toFixed(1) + "%)");
}

// The dug zones: floor only, no wall climbs, bones with four rotations.
const digG = runGrowth(C.WARDS[3]);
ok((digG.growth.floor || []).length > 0, "the disturbed form places dug zones on a floor");
ok((digG.growth.walls || []).length === 0, "a dug zone NEVER grows up a wall (owner rule)");
ok(!digG.growth.error, "disturbed placement reported no error" +
   (digG.growth.error ? " (" + digG.growth.error + ")" : ""));
const digImgs = bakeAll("disturbed", digG, 3);
ok(digImgs.length === digG.growth.floor.length && digImgs.every(c => c && c._img),
   "every dug zone bakes a canvas");
const digSplit = paintSplit(digG, digImgs);
ok(digSplit.on > 100, "the dug zones paint (" + digSplit.on + " fine px)");
ok(digSplit.off === 0, "dug zones never paint off plain floor (" + digSplit.off + ")");
const dz = digG.growth.floor[0];
ok(Array.isArray(dz.bones) && dz.bones.every(function(b){
  return D.growthStyles.disturbed.shapes.indexOf(b.shape) >= 0 &&
         b.rot >= 0 && b.rot <= 3;
}), "every bone is a known shape with a 0-3 rotation (" + dz.bones.length + " bones)");
ok(dz.bones.length >= (C.WARDS[3].growth.bonesMin || 3) &&
   dz.bones.length <= (C.WARDS[3].growth.bonesMax || 7),
   "zone bone count stays inside the ward's range");

// four rotations must actually produce four different pictures
(function(){
  const dst = D.growthStyles.disturbed;
  const dpal = dst.palette ? dst.palette(C.BIOMES[3]) : C.BIOMES[3].growthDigPal;
  const shot = function(rot){
    // inside a room of the test grid (5,4) — a bone on wall tiles would be
    // clipped away and every rotation would look identical for the wrong reason
    const sp = { style:"disturbed", x:5, y:4, dirX:0, dirY:0, reach:1.2, seed:4242,
      bones:[{ shape:"skull", x:5.5, y:4.5, rot:rot, scale:1, seed:99 }],
      grit:[], cx:5.5, cy:4.5, r:1.8, minX:3.7, maxX:7.3, minY:2.7, maxY:6.3 };
    const c = dst.bake(sp, dpal, D.growthUtil);
    return c && c._img ? Buffer.from(c._img.data).toString("base64") : null;
  };
  const rots = [0, 1, 2, 3].map(shot);
  const uniq = {};
  rots.forEach(function(r){ if(r) uniq[r] = 1; });
  ok(!!rots[0] && Object.keys(uniq).length === 4,
     "the four rotations give four distinct bone placements");
})();

// Determinism
(function(){
  const dst = D.growthStyles.disturbed;
  const dpal = dst.palette ? dst.palette(C.BIOMES[3]) : C.BIOMES[3].growthDigPal;
  const a1 = dst.bake(dz, dpal, D.growthUtil), a2 = dst.bake(dz, dpal, D.growthUtil);
  ok(!!a1 && !!a2 && Buffer.compare(Buffer.from(a1._img.data), Buffer.from(a2._img.data)) === 0,
     "dug-zone baking is deterministic per zone");
})();

// Integration: a real generated floor, not a hand-built grid, must end up with
// growth in G.growth and bake without throwing (levels.js calls placeGrowth).
let integrationOk = true, integrationMsg = "";
try {
  D.newRun();
  const f1 = D.G.growth || {};
  integrationOk = (f1.floor || []).length >= 0;
  if(f1.error){ integrationOk = false; integrationMsg = "floor 1: " + f1.error; }
  const baked = (f1.floor || []).length ? bakeAll("moss", D.G, 0) : [];
  if(baked.some(c => !c)) { integrationOk = false; integrationMsg = "a moss bake returned null"; }
  // and ward 2
  D.G.floor = 15;
  D.genFloor();
  const f15 = D.G.growth || {};
  if(f15.error){ integrationOk = false; integrationMsg = "floor 15: " + f15.error; }
  const vbaked = (f15.floor || []).length ? bakeAll("mycelium", D.G, 1) : [];
  if(vbaked.some(c => !c)) { integrationOk = false; integrationMsg = "a vein bake returned null"; }
  // and ward 3: ice floor + hoarfrost ferns
  D.G.floor = 25;
  D.genFloor();
  const f25 = D.G.growth || {};
  if(f25.error){ integrationOk = false; integrationMsg = "floor 25: " + f25.error; }
  const fbaked = (f25.floor || []).length ? bakeAll("frost", D.G, 2) : [];
  if(fbaked.some(c => !c)) { integrationOk = false; integrationMsg = "a frost bake returned null"; }
  const tex = floorTexture(D.CONFIG.BIOMES[2]);
  if(!tex) { integrationOk = false; integrationMsg = "the ice floor drew no texture"; }
  // and ward 4: loam floor + dug zones
  D.G.floor = 35;
  D.genFloor();
  const f35 = D.G.growth || {};
  if(f35.error){ integrationOk = false; integrationMsg = "floor 35: " + f35.error; }
  if((f35.walls || []).length){ integrationOk = false; integrationMsg = "floor 35 grew wall climbs"; }
  const dbaked = (f35.floor || []).length ? bakeAll("disturbed", D.G, 3) : [];
  if(dbaked.some(c => !c)){ integrationOk = false; integrationMsg = "a dug-zone bake returned null"; }
  const ltex = floorTexture(D.CONFIG.BIOMES[3]);
  if(!ltex){ integrationOk = false; integrationMsg = "the loam floor drew no texture"; }
} catch(e){
  integrationOk = false;
  integrationMsg = e.message;
}
ok(integrationOk, "a generated floor grows and bakes end to end" +
   (integrationMsg ? " (" + integrationMsg + ")" : ""));

ctx.document.createElement = realCreate;
Math.random = realRandom;
D.G = null;

console.log("\n" + (fails ? "FAILED " + fails + "/" + checks : "PASSED " + checks + "/" + checks) + " checks");
process.exit(fails ? 1 : 0);
