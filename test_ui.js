#!/usr/bin/env node
// test_ui.js - Node regression suite for DOM WIRING (buttons, cards, screens).
//
// test_items.js stubs `document` down to one generic object, so it can check
// numbers but never whether a tap actually reaches a handler. This suite builds
// a small DOM from the REAL index.html: every id declared in the markup becomes
// a live element with working addEventListener/onclick/appendChild, then every
// script index.html loads is run against it.
//
// It exists because of a real bug: showItemCard() tested `if(!spr)` against the
// result of $(), which hands back a truthy stand-in for a missing id. The test
// always passed, the sprite canvas was never created, getContext() returned
// null, the handler threw, and tapping an item in the inventory did nothing at
// all. No amount of stubbed-document testing can see that.
//
// COVERAGE — every screen and every binding ui.js owns, not just the inventory:
//   1-7   inventory, item card, equip (the original regression)
//   8-13  HUD, ability bar, stairs prompt, floor card, boss intro, hub
//   14-15 shop (buy / sell / sell-all / heal / leave), end screens
//   16-17 pause menu, the audio controls, log window, minimap toggle
//   18    the ?debug=1 panel, all 16 of its buttons
//   19-20 start vs resume, slot unlocks, close buttons, hideAllScreens, and a
//         check that all 21 ui.js entry points are still exported
// Game-flow functions that need a generated map or a real canvas are replaced
// by recorders (see "stubs"), so a red check means broken WIRING — not a stub
// limitation. The suite was mutation-tested: breaking the sell-all arming, or
// letting a parked run buy hub upgrades, each turns it red.
//
// Run: node test_ui.js
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

let checks = 0, fails = 0;
function ok(cond, msg){
  checks++;
  if(cond){ console.log("  \u2713 " + msg); }
  else { fails++; console.log("  \u2717 " + msg); }
}

// ── canvas 2d stub ───────────────────────────────────────────
function ctx2d(){
  const o = {
    createImageData:(w,h)=>({ width:w, height:h, data:new Uint8ClampedArray(w*h*4) }),
    getImageData:(x,y,w,h)=>({ width:w||1, height:h||1, data:new Uint8ClampedArray((w||1)*(h||1)*4) }),
    putImageData(){}, measureText:()=>({ width:8 }),
    createLinearGradient:()=>({ addColorStop(){} }),
    createRadialGradient:()=>({ addColorStop(){} })
  };
  return new Proxy(o, {
    get(t,k){ if(k in t) return t[k]; return () => {}; },
    set(t,k,v){ t[k]=v; return true; }
  });
}

// ── minimal DOM ──────────────────────────────────────────────
const registry = new Map();
class El {
  constructor(tag){
    this.tagName = String(tag || "div").toUpperCase();
    this._id = ""; this.children = []; this.parentNode = null;
    this.style = {}; this.dataset = {}; this._text = ""; this._html = "";
    this._handlers = {}; this._classes = [];
    this.className = ""; this.disabled = false; this.value = "";
    this.width = 100; this.height = 100;
  }
  get id(){ return this._id; }
  set id(v){ this._id = v; if(v) registry.set(v, this); }
  get textContent(){ return this._text; }
  set textContent(v){ this._text = String(v); }
  get innerHTML(){ return this._html; }
  // ui.js rebuilds lists with `el.innerHTML = ""`; that must drop the children.
  set innerHTML(v){ this._html = String(v); this.children = []; }
  get classList(){
    const self = this;
    const sync = () => { self.className = self._classes.join(" "); };
    return {
      add(c){ if(self._classes.indexOf(c) < 0) self._classes.push(c); sync(); },
      remove(c){ const i = self._classes.indexOf(c); if(i >= 0) self._classes.splice(i,1); sync(); },
      contains(c){ return self._classes.indexOf(c) >= 0; },
      toggle(c){ if(self._classes.indexOf(c) >= 0) this.remove(c); else this.add(c); }
    };
  }
  appendChild(c){ c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref){
    c.parentNode = this;
    const i = this.children.indexOf(ref);
    if(i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c){ const i = this.children.indexOf(c); if(i >= 0) this.children.splice(i,1); c.parentNode = null; return c; }
  addEventListener(t, fn){ (this._handlers[t] = this._handlers[t] || []).push(fn); }
  removeEventListener(t, fn){ const a = this._handlers[t] || []; const i = a.indexOf(fn); if(i >= 0) a.splice(i,1); }
  click(){
    const ev = { target:this, currentTarget:this, stopPropagation(){}, preventDefault(){} };
    // A real click fires the onclick property AND any click listeners.
    if(typeof this.onclick === "function") this.onclick.call(this, ev);
    (this._handlers.click || []).forEach(fn => fn.call(this, ev));
  }
  getContext(){ return ctx2d(); }
  getBoundingClientRect(){ return { left:0, top:0, width:this.width, height:this.height }; }
  setAttribute(){}
  querySelector(sel){ return this._find(sel); }
  querySelectorAll(){ return []; }
  _find(sel){
    const s = String(sel), want = s.replace(/^[.#]/, "");
    const byId = s[0] === "#", byClass = s[0] === ".";
    for(const c of this.children){
      // Tag selectors matter: showEndScreen() reads `deathScreen.querySelector("h1")`.
      const hit = byId ? c.id === want
        : byClass ? c._classes.indexOf(want) >= 0
        : c.tagName === want.toUpperCase();
      if(hit) return c;
      const deep = c._find(sel);
      if(deep) return deep;
    }
    return null;
  }
}


// Every id the real markup declares becomes a live element.
let m;
const idRe = /<(\w+)[^>]*\bid="([^"]+)"/g;
while((m = idRe.exec(html)) !== null){ const el = new El(m[1]); el.id = m[2]; }

// This mock registers ids but does not rebuild nesting. showEndScreen() reads
// its own `<h1>` via querySelector, so the one nesting that code depends on is
// reproduced — and checked against the markup first, so it cannot drift into
// a fabricated test.
if(!/<div id="deathScreen"[\s\S]{0,200}?<h1/.test(html)){
  checks++; fails++;
  console.log("  \u2717 index.html no longer nests an <h1> inside #deathScreen");
}
const deathTitleEl = new El("h1");
deathTitleEl.textContent = "YOU DIED";
registry.get("deathScreen").appendChild(deathTitleEl);

const body = new El("body"), head = new El("head"), docEl = new El("html");
const documentObj = {
  getElementById: id => registry.get(id) || null,
  createElement: t => new El(t),
  createTextNode: t => { const e = new El("#text"); e.textContent = t; return e; },
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener(){}, removeEventListener(){},
  body, head, documentElement: docEl
};

const ctx = {
  console, setTimeout, clearTimeout,
  setInterval:()=>0, clearInterval(){},
  Date, Math, JSON, document:documentObj,
  requestAnimationFrame:()=>0, cancelAnimationFrame(){},
  localStorage:{ getItem:()=>null, setItem(){}, removeItem(){} },
  navigator:{ userAgent:"node" }, Image:function(){ this.onload = null; },
  performance:{ now:()=>Date.now() },
  // Read the element's own style, not a constant, so the minimap toggle (which
  // asks getComputedStyle().display before flipping it) can be tested.
  getComputedStyle:el=>({ display:(el && el.style && el.style.display) || "block" }),
  location:{ href:"http://localhost/", reload(){} },
  devicePixelRatio:1, alert(){}, matchMedia:()=>({ matches:false, addListener(){}, addEventListener(){} })
};
ctx.window = ctx; ctx.self = ctx;
ctx.addEventListener = () => {};
ctx.removeEventListener = () => {};
vm.createContext(ctx);

// ── load exactly what index.html loads, in its order ─────────
console.log("── boot ────────────────────────────────────────────────");
const scriptRe = /<script src="([^"]+)"><\/script>/g;
const files = [];
while((m = scriptRe.exec(html)) !== null) files.push(m[1]);
for(const f of files){
  try { vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename:f }); }
  catch(e){ console.log("  \u2717 LOAD FAIL " + f + ": " + e.message); process.exit(1); }
}
const D = ctx.Delve;
ok(!!D, "all " + files.length + " scripts run against the real markup (" + registry.size + " elements)");

// ── stubs ────────────────────────────────────────────────────
// ui.js is wired to the whole game, so testing it means standing in for the
// parts that need a generated map, a real canvas, or an async round trip.
// Every one of those is replaced by a recorder below. That keeps failures
// honest: if a check fails, the WIRING is wrong, not the stub.
const calls = [];
function record(name){ return function(){ calls.push(name); }; }
function resetCalls(){ calls.length = 0; }
function recorded(name){ return calls.indexOf(name) >= 0; }
function lastFlash(){
  const f = calls.filter(c => c.indexOf("flash:") === 0);
  return f.length ? f[f.length - 1].slice(6) : "";
}
function textOf(id){ const e = registry.get(id); return e ? String(e.textContent) : ""; }
function displayOf(id){ const e = registry.get(id); return e ? e.style.display : undefined; }
function fire(id, type){
  const e = registry.get(id);
  if(!e) return;
  const ev = { target:e, currentTarget:e, stopPropagation(){}, preventDefault(){} };
  (e._handlers[type] || []).forEach(fn => fn.call(e, ev));
}

D.draw = record("draw");
D.drawPaperDoll = record("drawPaperDoll");
D.renderMinimap = record("renderMinimap");
D.flash = msg => calls.push("flash:" + msg);
D.sfx = name => calls.push("sfx:" + name);
// Two real implementations are kept aside. The ability sections need a genuine
// level-up and genuine casts; everything before them wants recorders instead.
const realAddXP = D.addXP;
const realCastAbility = D.castAbility;

["descend","newRun","saveAndExit","retreat","convertGold","bankRunShards","clearRunCheckpoint",
 "persist","recordStat","genFloor","addXP","die","makeElite","triggerVictory","castAbility",
 "enemiesTurn","setFloorCheckpoint","resize","flushLogWindow",
 "sfxStartAmbience","sfxStopAmbience"].forEach(n => { D[n] = record(n); });
D.applyEffect = (target, id) => calls.push("applyEffect:" + id);
D.applyPlayerEffect = id => calls.push("applyPlayerEffect:" + id);
D.hasProgression = () => false;
// Restoring a checkpoint is the one stub whose VALUE matters to control flow, so
// it has to record the call as well as answer it — a plain arrow here would make
// the resume check pass vacuously.
D.restoreRunFromCheckpoint = () => { calls.push("restoreRunFromCheckpoint"); return true; };

function newRun(floor){
  D.save = { version:4, shards:0, bestFloor:1,
    lvls:{con:0,str:0,tou:0,luc:0,agi:0,eng:0}, unlocks:{}, nodes:{}, inventoryCap:16,
    abilities:[], abilityRanks:{}, runTraits:[], runTraitsSeen:[], seenTutorial:true };
  D.G = { floor:floor || 3, equip:{}, inventory:[], items:[], gold:0, level:1, hp:40,
    energy:10, effects:[], abilities:[], runShards:0, monsters:[], goldPiles:[], restCount:0,
    chests:[], barrels:[], decor:[], px:5, py:5, runStats:{}, dead:false, runEnded:false };
}

function itemButtons(){
  const g = registry.get("invCarriedGrid");
  return g.children.filter(c => c.className === "inv-item-btn");
}

// ── 1. Inventory opens ──────────────────────────────────────
console.log("\n── inventory ───────────────────────────────────────────");
newRun(3);
const weapon = D.makeItem(2, { slot:"weapon", floor:3 });
ok(!!weapon && !!weapon.name, "made a weapon (" + (weapon && weapon.name) + ")");
D.G.inventory.push(weapon);

D.openInventory();
const overlay = registry.get("itemCardOverlay");
ok(registry.get("inventoryScreen").style.display === "flex", "inventory screen is shown");
ok(itemButtons().length === 1, "one carried-item button is rendered");

// ── 2. Tapping an item opens the stat card ──────────────────
// This is the regression: the card never appeared and the tap did nothing.
console.log("\n── tap an item ─────────────────────────────────────────");
let threw = null;
try { itemButtons()[0].click(); } catch(e){ threw = e; }
ok(!threw, "tap does not throw" + (threw ? ": " + threw.message : ""));
ok(overlay.style.display === "flex",
   "stat card appears (display=" + JSON.stringify(overlay.style.display) + ")");
ok(registry.get("icName").textContent === weapon.name, "card names the item");
ok(registry.get("icStats").children.length > 0, "card lists stat rows");

// ── 3. The sprite canvas is created on first use ────────────
ok(!!registry.get("icSprite"), "item sprite canvas exists after first open");

// ── 4. Equipping from the card ──────────────────────────────
console.log("\n── equip from the card ─────────────────────────────────");
const primary = registry.get("icPrimaryBtn");
ok(primary.textContent === "Equip", "primary button is labelled Equip");
threw = null;
try { primary.click(); } catch(e){ threw = e; }
ok(!threw, "Equip does not throw" + (threw ? ": " + threw.message : ""));
ok(D.G.equip.weapon === weapon, "weapon moved into the weapon slot");
ok(D.G.inventory.indexOf(weapon) < 0, "weapon left the carried inventory");
ok(overlay.style.display === "none", "card closed after equipping");

// ── 5. The rack reflects it on reopen ───────────────────────
const rackCells = registry.get("equipRack").children;
const shown = rackCells.filter(c => c.children.some(k => k.textContent === weapon.name));
ok(shown.length === 1, "equipment rack shows the equipped weapon");

// ── 6. Every item kind opens its card ───────────────────────
console.log("\n── 40 random items ─────────────────────────────────────");
let opened = 0, bad = 0, firstErr = null;
for(let i = 0; i < 40; i++){
  newRun(1 + i);
  D.G.inventory.push(D.makeItem(1 + (i % 4), { floor:1 + i }));
  D.openInventory();
  const b = itemButtons();
  if(!b.length){ bad++; continue; }
  try {
    b[0].click();
    if(overlay.style.display === "flex") opened++;
  } catch(e){ bad++; firstErr = firstErr || e.message; }
  overlay.style.display = "none";
}
ok(opened === 40, "card opened for " + opened + "/40 items");
ok(bad === 0, "no throws across 40 items" + (firstErr ? " (first: " + firstErr + ")" : ""));

// ── 7. No markup drift ──────────────────────────────────────
// ui.js falls back to a stand-in for a missing id, so a renamed element would
// silently stop working. Any id it asks for must exist in index.html.
const missing = D.missingEls || [];
ok(missing.length === 0, "no ids requested that are absent from index.html" +
   (missing.length ? " (missing: " + missing.join(", ") + ")" : ""));

// ── 8. HUD ──────────────────────────────────────────────────
console.log("\n── HUD ─────────────────────────────────────────────────");
newRun(12);
D.G.hp = 17; D.G.gold = 250; D.G.energy = 7; D.G.restCount = 1; D.G.xp = 2;
D.save.shards = 30;
D.updateHUD();
ok(textOf("hudHp") === "17/" + D.maxHp(), "HP reads hp/max (" + textOf("hudHp") + ")");
ok(textOf("hudFloor") === "12", "floor shown");
ok(textOf("hudGold") === "250", "gold shown");
ok(textOf("hudEnergy") === "7/" + D.energyCap(), "energy reads value/cap (" + textOf("hudEnergy") + ")");
ok(textOf("hudXp") === "2/" + D.xpToNext(), "XP reads progress/needed (" + textOf("hudXp") + ")");
ok(textOf("hudLevel") === "Lv 1", "level shown beside the XP bar");
ok(registry.get("hudHpFill").style.width === Math.round((17 / D.maxHp()) * 100) + "%",
   "the HP bar fill tracks HP (" + registry.get("hudHpFill").style.width + ")");
ok(registry.get("hudEnFill").style.width === Math.round((7 / D.energyCap()) * 100) + "%",
   "the energy bar fill tracks energy");
ok(registry.get("hudXpFill").style.width === Math.round((2 / D.xpToNext()) * 100) + "%",
   "the XP bar fill tracks XP");
ok(textOf("hudShards") === String(30 + (D.pendingRunShards ? D.pendingRunShards() : 0)),
   "shards show banked + this run's pending");
const dots = registry.get("restDots").children;
ok(dots.length === D.restsPerFloor(), "one rest dot per rest (" + dots.length + ")");
ok(dots.filter(d => d.className.indexOf("used") >= 0).length === 1, "the spent rest dot is marked");
ok(registry.get("logPanel").classList.contains("active"), "log pill activated during a run");

// ── 9. Ability bar ──────────────────────────────────────────
console.log("\n── ability bar ─────────────────────────────────────────");
const bar = registry.get("abilityBar");
const zap = { id:"zap", name:"Zap", cost:5, target:"self" };
D.G.abilities = [zap]; D.G.energy = 10;
D.renderAbilityBar();
ok(displayOf("abilityBar") === "flex", "bar shown when abilities exist");
const zapBtn = bar.children[0];
ok(!!zapBtn && zapBtn.className === "ability-btn", "one ability button");
ok(zapBtn.children[0].textContent === "Zap", "button names the ability");
ok(zapBtn.children[1].textContent.indexOf("5") >= 0, "button shows the cost");
resetCalls(); zapBtn.click();
ok(recorded("castAbility"), "a self-target ability casts immediately");
ok(recorded("enemiesTurn"), "…and consumes the enemies' turn");

D.G.energy = 1; resetCalls(); D.renderAbilityBar(); bar.children[0].click();
ok(lastFlash().indexOf("Not enough Energy") >= 0, "unaffordable ability is refused out loud");

const bolt = { id:"bolt", name:"Bolt", cost:1, target:"enemy" };
D.G.abilities = [bolt]; D.G.energy = 10; resetCalls(); D.renderAbilityBar();
bar.children[0].click();
ok(D.G.targetingAbility === bolt, "enemy-target ability arms targeting");
bar.children[0].click();
ok(D.G.targetingAbility === null, "a second tap cancels targeting");
ok(lastFlash() === "Cancelled", "cancelling says so");

D.G.abilities = [];
D.renderAbilityBar();
ok(displayOf("abilityBar") === "none", "bar hidden when there are no abilities");

// ── 10. Stairs prompt ───────────────────────────────────────
console.log("\n── stairs prompt ───────────────────────────────────────");
D.showStairsPrompt();
ok(displayOf("stairsPrompt") === "flex", "stairs prompt shown");
resetCalls(); registry.get("stairsNo").click();
ok(displayOf("stairsPrompt") === "none", "No closes the prompt");
ok(!recorded("descend"), "No does not descend");
D.showStairsPrompt(); resetCalls(); registry.get("stairsYes").click();
ok(displayOf("stairsPrompt") === "none", "Yes closes the prompt");
ok(recorded("descend"), "Yes descends");

// ── 11. Floor card ──────────────────────────────────────────
console.log("\n── floor card ──────────────────────────────────────────");
D.showFloorCard(3);
ok(textOf("floorCardNum") === "Floor 3", "card numbers the floor");
ok(displayOf("floorCard") === "flex", "card is shown");
clearTimeout(D._floorCardT);
D.showFloorCard(5);
ok(textOf("floorCardName").indexOf("Trading Post") >= 0, "shop floor is named as one");
clearTimeout(D._floorCardT);
D.showFloorCard(10);
ok(textOf("floorCardName").indexOf("Boss Arena") >= 0, "boss floor is named as one");
clearTimeout(D._floorCardT);

// ── 12. Boss intro ──────────────────────────────────────────
console.log("\n── boss intro ──────────────────────────────────────────");
D.showBossIntro(10);
ok(displayOf("bossIntroOverlay") === "flex", "boss intro overlay shown");
ok(textOf("bossIntroName").length > 0, "intro names the boss (" + textOf("bossIntroName") + ")");
clearTimeout(D._bossIntroT);

// ── 13. Hub ─────────────────────────────────────────────────
console.log("\n── hub ─────────────────────────────────────────────────");
newRun(4);
D.save.shards = 99999;
D.runInProgress = () => false;
D.refreshHub();
ok(textOf("hubShards") === "99999", "hub shows the shard balance");
const hubRows = registry.get("shop").children;
ok(hubRows.length > 0, "hub built " + hubRows.length + " upgrade rows");
ok(textOf("startBtn") === "START RUN", "start button reads START RUN");
ok(displayOf("hubTitleBtn") === "none", "title button hidden with no run parked");
const shardsBefore = D.save.shards;
const lvlBefore = D.save.lvls.con || 0;
resetCalls(); hubRows[0].children[1].click();
ok(D.save.shards < shardsBefore, "buying an attribute spends shards");
ok((D.save.lvls.con || 0) === lvlBefore + 1, "…and raises that attribute");
ok(recorded("persist"), "…and persists the save");

D.runInProgress = () => true;
D.save.shards = 99999;
D.refreshHub();
ok(registry.get("shop").children.filter(c => c.className === "hub-locked-note").length === 1,
   "locked banner shown while a run is unfinished");
ok(textOf("startBtn").indexOf("RESUME FLOOR") >= 0, "start button becomes RESUME FLOOR n");
ok(displayOf("hubTitleBtn") !== "none", "title button appears with a run parked");
const lockedShards = D.save.shards;
const upgradeRow = registry.get("shop").children.filter(c => c.className === "upgrade")[0];
resetCalls(); upgradeRow.children[1].click();
ok(D.save.shards === lockedShards, "a locked hub cannot be bought from");

D.runInProgress = () => false;
D.showHub();
ok(displayOf("hubScreen") === "flex", "showHub shows the hub");
ok(displayOf("hud") === "none", "showHub hides the HUD");
ok(displayOf("abilityBar") === "none", "showHub hides the ability bar");
ok(!registry.get("logPanel").classList.contains("active"), "showHub drops the log pill");
D.hideHub();
ok(displayOf("hubScreen") === "none", "hideHub hides the hub");
ok(displayOf("hud") === "flex", "hideHub restores the HUD");

// ── 14. Shop ────────────────────────────────────────────────
console.log("\n── shop ────────────────────────────────────────────────");
newRun(5);
D.G.gold = 100000; D.G.hp = 10;
D.runInProgress = () => false;
D.openShop();
ok(displayOf("shopScreen") === "flex", "shop screen opens");
ok(textOf("shopGold") === "100000", "shop shows carried gold");
const stockRows = registry.get("shopStock").children;
ok(stockRows.length > 0 && stockRows.length === D.G.shop.stock.length,
   "every stock entry rendered (" + stockRows.length + ")");
ok(textOf("shopGreeting").length > 0, "a greeting is rendered");
ok(textOf("shopHealBtn").indexOf("Restore") >= 0, "heal button is labelled");

const buyBtn = stockRows[0].children[1];
const goldBeforeBuy = D.G.gold, bagBefore = D.G.inventory.length;
resetCalls(); buyBtn.click();
ok(D.G.gold < goldBeforeBuy, "buying spends gold");
ok(D.G.inventory.length === bagBefore + 1, "the bought item enters the bag");
ok(D.G.shop.stock.filter(e => e.sold).length >= 1, "the bought entry is marked sold");

const sellRows = registry.get("shopSellList").children;
ok(sellRows.length >= 1, "sell list rendered (" + sellRows.length + ")");
const goldBeforeSell = D.G.gold, bagBeforeSell = D.G.inventory.length;
sellRows[0].children[1].click();
ok(D.G.gold > goldBeforeSell, "selling earns gold");
ok(D.G.inventory.length === bagBeforeSell - 1, "the sold item leaves the bag");

D.G.inventory.push(D.makeItem(1, { floor:5 }));
D.buildShop();
const sellAllBtn = registry.get("shopSellAll");
sellAllBtn.click();
ok(sellAllBtn.dataset.armed === "1", "the first tap only arms sell-all");
ok(String(sellAllBtn.textContent).indexOf("again") >= 0, "…and asks for a second tap");
sellAllBtn.click();
ok(D.G.inventory.length === 0, "the second tap sells everything carried");

D.G.hp = 10;
const goldBeforeHeal = D.G.gold;
registry.get("shopHealBtn").click();
ok(D.G.hp > 10, "heal raises HP");
ok(D.G.gold < goldBeforeHeal, "heal costs gold");

registry.get("shopLeaveBtn").click();
ok(displayOf("shopScreen") === "none", "shop closes");
ok(displayOf("hud") === "flex", "the HUD returns after the shop");

// ── 15. End screens ─────────────────────────────────────────
console.log("\n── end screens ─────────────────────────────────────────");
newRun(7); D.G.runShards = 12;
D.G.runStats = { kills:9, elitesKilled:1, goldEarned:120, goldSpentShop:30,
  goldFromSales:15, barrelsSmashed:2, consumablesUsed:1 };
D.showVictory(12, true);
ok(displayOf("victoryScreen") === "flex", "victory screen shown");
ok(textOf("victoryShards") === "12", "victory shows the shards earned");
ok(registry.get("victorySummary").innerHTML.indexOf("Kills") >= 0, "victory lists the run stats");
ok(displayOf("victoryContinue") !== "none", "continue is offered when allowed");
D.showVictory(3, false);
ok(displayOf("victoryContinue") === "none", "continue is hidden when not allowed");

resetCalls();
D.showEndScreen("retreat", { shards:4 });
ok(displayOf("deathScreen") === "flex", "retreat shows the end screen");
ok(registry.get("deathScreen").querySelector("h1").textContent === "ESCAPED", "retreat is titled ESCAPED");
ok(textOf("deathShards").indexOf("4") >= 0, "retreat reports its banked shards");
ok(recorded("clearRunCheckpoint"), "a finished run clears its checkpoint");

D.showEndScreen("death");
ok(registry.get("deathScreen").querySelector("h1").textContent === "YOU DIED", "death is titled YOU DIED");
ok(textOf("deathInfo").indexOf("floor 7") >= 0, "death names the floor reached");
ok(registry.get("deathSummary").innerHTML.indexOf("Kills") >= 0, "death lists the run stats");

D.showEndScreen("victory", { shards:5 });
ok(displayOf("victoryScreen") === "flex", "kind=victory delegates to the victory screen");

resetCalls();
registry.get("victoryHub").click();
ok(recorded("convertGold"), "leaving converts gold");
ok(recorded("bankRunShards"), "…and banks the run's shards");
ok(D.G.runEnded === true, "the run is marked ended");
ok(recorded("clearRunCheckpoint"), "…and its checkpoint is cleared");
ok(displayOf("hubScreen") === "flex", "…and lands on the hub");

newRun(7); D.G.victoryDone = true; D.G.secondWindUsed = true;
resetCalls(); registry.get("victoryContinue").click();
ok(D.G.victoryDone === false && D.G.secondWindUsed === false, "descending resets the per-floor flags");
ok(recorded("descend"), "continue descends");
ok(displayOf("hud") === "flex", "the HUD is restored after descending");
clearTimeout(D._floorCardT);

// ── 16. Pause menu & audio ──────────────────────────────────
console.log("\n── pause menu & audio ──────────────────────────────────");
newRun(9);
registry.get("gearBtn").click();
ok(displayOf("pauseMenu") === "flex", "the pause menu opens mid-run");
ok(textOf("pauseSaveBtn").indexOf("floor 9") >= 0,
   "the save button names the floor (" + textOf("pauseSaveBtn") + ")");
registry.get("pauseCloseBtn").click();
ok(displayOf("pauseMenu") === "none", "pause closes");

registry.get("gearBtn").click();
resetCalls(); registry.get("pauseSaveBtn").click();
ok(displayOf("pauseMenu") === "none", "save & exit closes the menu");
ok(recorded("saveAndExit"), "save & exit calls saveAndExit");

registry.get("gearBtn").click();
resetCalls(); registry.get("pauseRetreatBtn").click();
ok(recorded("retreat"), "retreat calls retreat");

D.G.runEnded = true;
registry.get("pauseMenu").style.display = "none";
registry.get("gearBtn").click();
ok(displayOf("pauseMenu") === "none", "the pause menu stays shut once the run has ended");
D.G.runEnded = false;

let muted = false;
D.sfxToggleMute = () => (muted = !muted);
registry.get("muteBtn").click();
ok(muted === true, "mute reaches the audio layer");
ok(textOf("muteBtn").indexOf("🔇") >= 0, "mute shows the muted icon");

let vol = null;
D.sfxSetVolume = v => { vol = v; };
registry.get("volumeSlider").value = "0.35";
fire("volumeSlider", "input");
ok(vol !== null && Math.abs(vol - 0.35) < 1e-9, "the volume slider sets volume");

let music = null;
D.musicSetVolume = v => { music = v; };
registry.get("musicSlider").value = "0.2";
fire("musicSlider", "input");
ok(music !== null && Math.abs(music - 0.2) < 1e-9, "the music slider sets volume");

let hapt = null;
D.sfxGetHaptics = () => false;
D.sfxSetHaptics = v => { hapt = v; };
registry.get("hapticsBtn").click();
ok(hapt === true, "the haptics toggle switches on");
ok(textOf("hapticsBtn") === "ON", "the haptics button reads ON");

// ── 17. Log & minimap ───────────────────────────────────────
console.log("\n── log & minimap ───────────────────────────────────────");
resetCalls(); registry.get("logExpandBtn").click();
ok(recorded("flushLogWindow"), "the log pill flushes the window");
ok(displayOf("logWindow") === "flex", "the log window opens");
registry.get("logWindowClose").click();
ok(displayOf("logWindow") === "none", "the log window closes");

registry.get("minimapWrap").style.display = "none";
resetCalls(); registry.get("minimapBtn").click();
ok(displayOf("minimapWrap") === "block", "the minimap toggles open");
ok(recorded("renderMinimap"), "toggling the minimap redraws it");
registry.get("minimapBtn").click();
ok(displayOf("minimapWrap") === "none", "the minimap toggles shut");

// ── 18. Debug panel ─────────────────────────────────────────
console.log("\n── debug panel ─────────────────────────────────────────");
newRun(11);
D.initDebug();
ok(displayOf("debugPanel") === "flex", "the debug panel opens");
const dbgSel = registry.get("dbgFloor");
ok(dbgSel.children.length > 0, "the floor select is filled (" + dbgSel.children.length + " options)");
const goldD0 = D.G.gold;
registry.get("dbgGold").click();
ok(D.G.gold === goldD0 + 25, "dbgGold adds 25 gold");
D.G.hp = 1;
registry.get("dbgHeal").click();
ok(D.G.hp === D.maxHp(), "dbgHeal restores full HP");
registry.get("dbgLowHp").click();
ok(D.G.hp === 5, "dbgLowHp drops to 5 HP");
const shardsD0 = D.save.shards;
registry.get("dbgShards").click();
ok(D.save.shards === shardsD0 + 5, "dbgShards adds 5 shards");

D.G.px = 5; D.G.py = 5;
D.G.monsters = [{ x:5, y:5, elite:false, kind:"goblin" }];
resetCalls(); registry.get("dbgPoison").click();
ok(recorded("applyEffect:poison"), "dbgPoison poisons an adjacent monster");
resetCalls(); registry.get("dbgWeaken").click();
ok(recorded("applyPlayerEffect:weaken"), "dbgWeaken weakens the player");
resetCalls(); registry.get("dbgElite").click();
ok(recorded("makeElite"), "dbgElite promotes a monster");
resetCalls(); registry.get("dbgXP").click();
ok(recorded("addXP"), "dbgXP grants experience");
resetCalls(); registry.get("dbgVictory").click();
ok(recorded("triggerVictory"), "dbgVictory triggers a victory");
resetCalls(); registry.get("dbgDeath").click();
ok(recorded("die"), "dbgDeath kills the player");
resetCalls(); registry.get("dbgShop").click();
ok(displayOf("shopScreen") === "flex", "dbgShop opens the shop");
registry.get("shopLeaveBtn").click();
resetCalls(); registry.get("dbgRender").click();
ok(recorded("genFloor"), "dbgRender regenerates the floor");
clearTimeout(D._floorCardT);

dbgSel.value = "22";
resetCalls(); registry.get("dbgGo").click();
ok(D.G.floor === 22, "dbgGo jumps to the chosen floor");
ok(recorded("setFloorCheckpoint"), "…and checkpoints that jump");

const realConsole = ctx.console;
ctx.console = { log(){}, warn(){}, error:console.error, info(){} };
let dumpThrew = null;
try { registry.get("dbgDump").click(); } catch(e){ dumpThrew = e.message; }
ctx.console = realConsole;
ok(!dumpThrew, "dbgDump logs without throwing" + (dumpThrew ? ": " + dumpThrew : ""));

let reloaded = false;
ctx.location.reload = () => { reloaded = true; };
registry.get("dbgReset").click();
ok(reloaded === true, "dbgReset wipes the save and reloads");

// ── 19. Start & resume ──────────────────────────────────────
console.log("\n── start & resume ──────────────────────────────────────");
newRun(1);
D.runInProgress = () => false;
resetCalls(); registry.get("startBtn").click();
ok(recorded("newRun"), "START RUN starts a new run");
ok(displayOf("hud") === "flex", "the HUD is shown after starting");
clearTimeout(D._floorCardT);

D.runInProgress = () => true;
D.restoreRunFromCheckpoint = () => { calls.push("restoreRunFromCheckpoint"); return true; };
resetCalls(); registry.get("startBtn").click();
ok(recorded("restoreRunFromCheckpoint"), "START RUN resumes a parked run instead");
ok(displayOf("hud") === "flex", "the HUD is shown after resuming");
clearTimeout(D._floorCardT);

D.restoreRunFromCheckpoint = () => false;
ok(D.resumeRun() === false, "resumeRun reports failure when nothing can be restored");

// ── 20. Slots, exports & last bindings ──────────────────────
console.log("\n── slots, exports & last bindings ──────────────────────");
newRun(3);
D.save.unlocks = {};
ok(D.isSlotUnlocked("weapon") === true, "free slots are unlocked from the start");
ok(D.isSlotUnlocked("offhand") === false, "a paid slot starts locked");
D.save.unlocks.offhand = true;
ok(D.isSlotUnlocked("offhand") === true, "a bought unlock is honoured");
ok(D.isSlotUnlocked("nosuchslot") === true, "an unknown slot is treated as unlocked");

ok(D.equipSlots() === D.G.equip, "equipSlots hands back G.equip");
delete D.G.equip;
const recreatedEquip = D.equipSlots();
ok(recreatedEquip && typeof recreatedEquip === "object", "equipSlots recreates G.equip when missing");

D.openInventory();
registry.get("invCloseBtn2").click();
ok(displayOf("inventoryScreen") === "none", "the inventory close button works");

D.showItemCard(D.makeItem(1, { floor:3 }), "inventory");
registry.get("icCloseBtn").click();
ok(displayOf("itemCardOverlay") === "none", "the item card close button works");

D.runInProgress = () => false;
D.showHub();
registry.get("deathBtn").click();
ok(displayOf("hubScreen") === "flex", "the death screen's button returns to the hub");

D.hideAllScreens();
ok(displayOf("hubScreen") === "none" && displayOf("inventoryScreen") === "none" &&
   displayOf("itemCardOverlay") === "none" && displayOf("pauseMenu") === "none",
   "hideAllScreens sweeps every screen");

const UI_EXPORTS = ["hideAllScreens","isSlotUnlocked","equipSlots","updateHUD","openInventory",
  "showItemCard","showStairsPrompt","showFloorCard","showBossIntro","refreshHub","buildHub",
  "showHub","hideHub","startRun","resumeRun","renderAbilityBar","openShop","buildShop",
  "showVictory","showEndScreen","initDebug"];
const absentExports = UI_EXPORTS.filter(n => typeof D[n] !== "function");
ok(absentExports.length === 0, "all " + UI_EXPORTS.length + " ui.js entry points are exported" +
   (absentExports.length ? " (missing: " + absentExports.join(",") + ")" : ""));

// ── 21. Abilities: uncapped, and the wider pool ─────────────
console.log("\n── abilities ───────────────────────────────────────────");
newRun(3);
D.G.abilities = [];
["cleave","lunge","stone_skin","rally","blink"].forEach(id =>
  D.addAbility({ id:id, name:id, cost:1, target:"self" }));
ok(D.G.abilities.length === 5, "addAbility keeps all 5 — the old 3-cap dropped the oldest");
ok(D.G.abilities[0].id === "cleave", "the first ability learned is still there");
D.addAbility({ id:"cleave", name:"Cleave", cost:1, target:"self" });
ok(D.G.abilities.length === 5, "learning a known ability again is ignored");

const barEl = registry.get("abilityBar");
D.renderAbilityBar();
ok(barEl.children.length === 5, "the bar renders every learned ability");
D.G.abilities = D.CONFIG.TRAITS.abilities.map(a =>
  ({ id:a.id, name:a.name, cost:a.cost, target:a.target }));
D.renderAbilityBar();
ok(barEl.children.length === 16, "the bar renders the whole pool (" + barEl.children.length + ")");
ok(D.CONFIG.TRAITS.abilities.length === 16, "the ability pool holds 16 entries");
ok(D.CONFIG.levelMaxAbilities === 0, "the ability cap is disabled (0 = unlimited)");

// A level-up always offers an ability while any remain unlearned.
D.addXP = realAddXP;
newRun(3);
D.G.abilities = []; D.G.takenUniques = []; D.G.levelUpOpen = false; D.G.pendingLevelUps = 0;
D.addXP(D.xpCurveFor(3)[0]);
const luCards = registry.get("levelupChoices").children;
ok(luCards.length === 3, "a level-up shows 3 cards");
const abilityCards = luCards.filter(c => String(c.children[0].textContent).indexOf("⚡") === 0);
ok(abilityCards.length >= 1, "at least one card is an ability (" + abilityCards.length + " of 3)");
registry.get("levelupScreen").style.display = "none";

// ── 22. The new abilities actually cast ─────────────────────
console.log("\n── ability effects ─────────────────────────────────────");
D.castAbility = realCastAbility;
const applied = [];
function arena(){
  newRun(3);
  D.G.grid = Array.from({ length:20 }, () => Array(20).fill(D.T.FLOOR));
  D.G.px = 5; D.G.py = 5; D.G.energy = 40; D.G.hp = 10;
  D.G.monsters = []; D.G.boss = null;
  D.killMonster = () => {};          // keep the stub monsters standing
  D.addFloater = () => {};
  D.applyEffect = (t, id) => { applied.push(id); return true; };
  applied.length = 0;
}
function cast(id, x, y){
  const def = D.CONFIG.TRAITS.abilities.find(a => a.id === id);
  return D.castAbility({ id:def.id, name:def.name, cost:def.cost, target:def.target }, x, y);
}

arena();
D.G.monsters = [{ id:"m1", x:6, y:5, hp:100, effects:[] }];
ok(cast("rend", 6, 5) === true, "Rend casts on an adjacent enemy");
ok(applied.indexOf("bleed") >= 0, "Rend applies bleed");

arena();
D.G.monsters = [{ id:"m2", x:9, y:5, hp:100, effects:[] }];
ok(cast("venom_dart", 9, 5) === true, "Venom Dart casts at range 4");
ok(applied.indexOf("poison") >= 0, "Venom Dart applies poison");

arena();
const tgtM = { id:"m3", x:7, y:5, hp:200, effects:[] };
const nearM = { id:"m4", x:8, y:5, hp:200, effects:[] };
const farM  = { id:"m5", x:15, y:15, hp:200, effects:[] };
D.G.monsters = [tgtM, nearM, farM];
cast("meteor", 7, 5);
ok(tgtM.hp < 200, "Meteor damages its target");
ok(nearM.hp < 200, "Meteor splashes onto a neighbour");
ok(farM.hp === 200, "Meteor leaves distant enemies alone");

arena();
const t1 = { id:"t1", x:6, y:5, hp:100 }, t2 = { id:"t2", x:7, y:5, hp:100 }, t3 = { id:"t3", x:9, y:5, hp:100 };
D.G.monsters = [t1, t2, t3];
cast("tremor", 5, 5);
ok(t1.hp < 100 && t2.hp < 100, "Tremor hits every enemy within 2 tiles");
ok(t3.hp === 100, "Tremor spares an enemy 4 tiles away");

arena();
D.G.hp = 5;
D.G.monsters = [{ id:"l", x:6, y:5, hp:500, effects:[] }];
cast("leech", 6, 5);
ok(D.G.hp > 5, "Leech heals the player from the damage dealt");

arena();
const plainM = { id:"p", x:6, y:5, hp:500, effects:[] };
D.G.monsters = [plainM];
cast("rupture", 6, 5);
const plainDmg = 500 - plainM.hp;
arena();
const bleedM = { id:"b", x:6, y:5, hp:500, effects:[{ id:"bleed", turns:2 }] };
D.G.monsters = [bleedM];
cast("rupture", 6, 5);
const bleedDmg = 500 - bleedM.hp;
ok(plainDmg > 0 && bleedDmg === plainDmg * 2,
   "Rupture doubles against a bleeding enemy (" + plainDmg + " vs " + bleedDmg + ")");

arena();
D.G.monsters = [{ id:"c", x:6, y:5, hp:500, effects:[] }];
const atkNow = D.atk();
cast("crushing_blow", 6, 5);
ok(500 - D.G.monsters[0].hp === Math.round(atkNow * 2), "Crushing Blow hits for twice attack power");

arena();
D.G.energy = 10;
D.G.monsters = [{ id:"s", x:8, y:5, hp:500, effects:[] }];
cast("siphon", 8, 5);
ok(D.G.energy === 8, "Siphon nets -2 energy (cost 5, refund 3): " + D.G.energy);

arena();
D.G.hp = 5;
D.G.effects = [{ id:"poison", turns:2 }, { id:"bleed", turns:2 }, { id:"chill", turns:1 }];
cast("brace", 5, 5);
ok(D.G.hp > 5, "Brace heals");
ok(!D.G.effects.some(e => e.id === "poison" || e.id === "bleed"), "Brace clears poison and bleed");
ok(D.G.effects.some(e => e.id === "chill"), "Brace leaves an unrelated status alone");

arena();
D.G.monsters = [{ id:"z", x:12, y:12, hp:100, effects:[] }];
const energyBefore = D.G.energy;
ok(cast("rend", 12, 12) === false, "Rend refuses a non-adjacent target");
ok(D.G.energy === energyBefore, "a refused cast spends no energy");

// ── 23. Passives: ranks, tags and set bonuses ───────────────
console.log("\n── passives ────────────────────────────────────────────");
const near = (a, b) => Math.abs(a - b) < 1e-9;
const Pdef = id => D.CONFIG.TRAITS.passives.find(p => p.id === id);
const at = (id, rank) => Object.assign({}, Pdef(id), { rank:rank });
function buffsWith(list){ newRun(3); D.G.traits = list; return D.traitBuffs(); }
function cText(c){ return c.children.map(k => String(k.textContent)).join(" "); }

ok(buffsWith([at("sharpened_edge", 1)]).atk === 2, "Sharpened Edge I gives +2 attack");
ok(buffsWith([at("sharpened_edge", 2)]).atk === 4, "Sharpened Edge II gives +4");
const edge3 = buffsWith([at("sharpened_edge", 3)]);
ok(edge3.atk === 7, "Sharpened Edge III gives +6, plus +1 from the 3-rank Edge set");
ok(edge3.tagRanks.Edge === 3, "the Edge tag counts total ranks");
ok(buffsWith([at("bulwark_plate", 3)]).flatRed === 5, "Bulwark III (3) plus the Iron set (2)");
ok(buffsWith([at("bloodthirst", 3)]).healOnKill === 7, "Bloodthirst III (6) plus the Blood set (1)");
ok(near(buffsWith([at("coin_pusher", 3)]).goldMult, 0.38), "Coin Pusher III (+0.30) plus Greed set (+0.08)");
const edge6 = buffsWith([at("sharpened_edge", 3), at("studied_reflexes", 3)]);
ok(near(edge6.crit, 0.28), "6 Edge ranks = Reflexes III (0.18) + tier-2 set (0.10): " + edge6.crit);

// The two dead keys are now read: Swift Hands must move playerSpeed.
newRun(3); D.G.traits = [];
const baseSpeed = D.playerSpeed();
D.G.traits = [at("swift_hands", 3)];
const fastSpeed = D.playerSpeed();
ok(fastSpeed > baseSpeed, "Swift Hands reaches playerSpeed (" +
   baseSpeed.toFixed(2) + " -> " + fastSpeed.toFixed(2) + ")");

// A repeat pick upgrades through the real level-up path.
newRun(3);
D.G.traits = [at("sharpened_edge", 1)];
D.G.abilities = []; D.G.takenUniques = []; D.G.levelUpOpen = false; D.G.pendingLevelUps = 0;
let upgradedLine = null, sawUpgradeCard = false;
for(let i = 0; i < 80 && !upgradedLine; i++){
  D.addXP(D.xpCurveFor(D.G.floor)[0] + 5);
  const cards = registry.get("levelupChoices").children;
  const up = cards.filter(c => cText(c).indexOf("Sharpened Edge II") >= 0)[0];
  if(up){
    sawUpgradeCard = cText(up).indexOf("UPGRADE") >= 0 && cText(up).indexOf("RANK 2/3") >= 0;
    up.click();
    upgradedLine = D.G.traits.find(t => t.id === "sharpened_edge");
    break;
  }
  if(cards.length) cards[0].click();
  D.G.levelUpOpen = false;
}
ok(!!upgradedLine && upgradedLine.rank === 2, "a repeat pick upgrades Sharpened Edge to rank II");
ok(sawUpgradeCard, "the upgrade card is labelled UPGRADE and RANK 2/3");
ok(!!upgradedLine && upgradedLine.name.indexOf("II") >= 0, "the upgraded line carries its rank in its name");

// Maxed lines leave the pool entirely.
newRun(3);
D.G.traits = D.CONFIG.TRAITS.passives.map(p => at(p.id, p.maxRank || 1));
D.G.abilities = []; D.G.takenUniques = D.CONFIG.TRAITS.uniques.map(u => u.id);
D.G.levelUpOpen = false; D.G.pendingLevelUps = 0;
D.addXP(D.xpCurveFor(3)[0] + 5);
const maxedCards = registry.get("levelupChoices").children;
ok(maxedCards.filter(c => cText(c).indexOf("RANK") >= 0).length === 0,
   "with every passive maxed, no passive card is offered");
ok(maxedCards.length === 1, "only the ability card remains (" + maxedCards.length + ")");
registry.get("levelupScreen").style.display = "none";

// ── 24. Character sheet ─────────────────────────────────────
console.log("\n── character sheet ─────────────────────────────────────");
ok(!registry.get("hudAtk") && !registry.get("hudTou") && !registry.get("hudAgi"),
   "the attribute chips are gone from the HUD markup");
newRun(3);
D.G.traits = [at("sharpened_edge", 2)];
D.openStats();
ok(displayOf("statsOverlay") === "flex", "📊 opens the character sheet");
const statRows = registry.get("statsList").children;
ok(statRows.length > 5, "the sheet lists stats (" + statRows.length + " rows)");
const sheet = statRows.map(c => c.children.map(k => String(k.textContent)).join(" ")).join(" | ");
ok(sheet.indexOf("Attack") >= 0, "attack is listed");
ok(sheet.indexOf("Damage reduction") >= 0, "damage reduction is listed");
ok(sheet.indexOf("Dodge") >= 0, "dodge is listed");
ok(sheet.indexOf("Luck") >= 0, "luck is listed");
ok(sheet.indexOf("Sharpened Edge") >= 0, "passives are listed");
ok(sheet.indexOf("Rank 2") >= 0, "a passive's rank is shown");
ok(sheet.indexOf("Edge 2/6") >= 0, "set progress is shown");
ok(D.uiBlocked() === true && (D._lastBlockers || []).indexOf("statsOverlay") >= 0,
   "an open sheet blocks map taps (" + (D._lastBlockers || []).join(",") + ")");
registry.get("statsCloseBtn").click();
ok(displayOf("statsOverlay") === "none", "the close button closes it");
D.uiBlocked();   // _lastBlockers is only refreshed when this runs
ok((D._lastBlockers || []).indexOf("statsOverlay") < 0, "a closed sheet does not block taps");
D.openStats();
D.hideAllScreens();
ok(displayOf("statsOverlay") === "none", "hideAllScreens closes the sheet too");

console.log("\n" + (fails ? "FAILED " + fails + "/" + checks : "PASSED " + checks + "/" + checks) + " checks");
process.exit(fails ? 1 : 0);

