#!/usr/bin/env node
// test_items.js - Node regression suite for the item overhaul.
// Loads the real game scripts in index.html order (canvas/document stubbed),
// then checks the numbers that docs/results/items_overhaul.md locks down.
// Run: node test_items.js
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
const root = __dirname;

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
const canvas = (w,h) => ({ width:w||24, height:h||24, style:{}, classList:{add(){},remove(){},contains(){return false}}, getContext:()=>ctx2d(), toDataURL:()=>"", addEventListener(){} });
const el = () => ({ style:{}, classList:{add(){},remove(){},contains(){return false}}, appendChild(){}, insertBefore(){}, addEventListener(){}, removeEventListener(){}, querySelector:()=>null, getContext:()=>ctx2d(), textContent:"", innerHTML:"", children:[], parentNode:{ insertBefore(){} }, width:100, height:100, getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}) });

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

const FILES = ["js/config.js","js/content/con-monsters.js","js/content/con-items.js","js/content/con-itemaffixes.js","js/content/con-biomes.js","js/content/con-traits.js","js/content/con-progression.js","js/save.js","js/attrs.js","js/items.js","js/sprites.js","js/content/con-bosssprites.js","js/content/con-itemsprites.js","js/content/con-worldart.js","js/content/con-monstersprites.js","js/state.js","js/levels.js","js/ground.js","js/growth.js","js/puddles.js","js/render.js","js/combat.js","js/movement.js","js/pathfind.js","js/input.js","js/ui.js","js/log.js","js/effects.js","js/rewards.js","js/progression.js","js/traits.js","js/menu.js","js/sfx.js","js/main.js"];

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

console.log("\n" + (fails ? "FAILED " + fails + "/" + checks : "PASSED " + checks + "/" + checks) + " checks");
process.exit(fails ? 1 : 0);
