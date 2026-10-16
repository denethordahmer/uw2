window.Delve = window.Delve || {};
(function(){
 const T = () => Delve.T;
 const C = () => Delve.CONFIG;

 // movement.js : tile interaction and traversal — tapping to move, step-on
 // pathfinding, rest, barrels, gold pickup, chests, and floor descent.
 // Split out of combat.js (C-006). Load AFTER js/combat.js (calls Delve.startCombat,
 // Delve.enemiesTurn); Delve.openShop lives in ui.js. All references are call-time,
 // so no load-time dependency exists in either direction.
 //
 // C-017: every entry point that reads Delve.G now guards it before dereferencing.

 // ── Single-step act (tap to move) ────────────────────────────
 Delve.tryAct = function(tx, ty){
 const G = Delve.G;
 if(!G || G.dead || G.runEnded) return;
 const g = G.grid;

 // Shopkeeper: tapping him opens the shop instead of moving.
 if(G.shop && G.shop.x === tx && G.shop.y === ty && !G.inCombat && !G.targetingAbility){
 G._path = null;
 if(G._pathTimer){ clearInterval(G._pathTimer); G._pathTimer = null; }
 Delve.openShop();
 return;
 }

 if(G.targetingAbility){
 const ok = Delve.castAbility ? Delve.castAbility(G.targetingAbility, tx, ty) : false;
 G.targetingAbility = null;
 if(ok !== false){ Delve.enemiesTurn(); Delve.updateHUD(); }
 return;
 }

 if(!g[ty] || g[ty][tx] === undefined) return;
 if(Math.abs(tx-G.px) + Math.abs(ty-G.py) !== 1){ Delve.flash("Too far"); return; }

 if(tx > G.px) G.lastDir = "right";
 else if(tx < G.px) G.lastDir = "left";
 else if(ty > G.py) G.lastDir = "down";
 else G.lastDir = "up";

 const cell = g[ty][tx];
 if(cell === T().MONSTER){
 const m = G.monsters.find(m => m.x===tx && m.y===ty);
 if(m) Delve.startCombat(m);
 } else if(cell === T().BOSS){
 if(G.boss && G.boss.x===tx && G.boss.y===ty) Delve.startCombat(G.boss);
 } else if(cell === T().WALL){
 const fd = G.floorData;
 if(fd && fd.secretRoom && fd.secretRoom.falseWallX===tx && fd.secretRoom.falseWallY===ty){
 g[ty][tx] = T().FLOOR;
 if(Delve.sfx) Delve.sfx("secret");
 Delve.flash("A secret passage!");
 if(Delve.logSystem) Delve.logSystem("You found a secret room!");
 }
 } else if(cell === T().CHEST){
 Delve.openChest(tx, ty);
 } else if(cell === T().STAIR){
 Delve.promptStairs();
 } else if(bossBodyAt(tx, ty)){
 Delve.startCombat(bossBodyAt(tx, ty));
 } else {
 if(cell === T().BARREL) Delve.smashBarrel(tx, ty);
 G.px = tx; G.py = ty;
 if(Delve.sfx) Delve.sfx("footstep");
 Delve.collectGold(tx, ty);
 const idx = G.items.findIndex(i => i.x===tx && i.y===ty);
 if(idx >= 0){ const it = G.items.splice(idx,1)[0]; Delve.pickupItem(it); }
 Delve.enemiesTurn();
 }
 Delve.updateHUD();
 };

 // A boss's art covers a w x h block of tiles even though it only *occupies* its
 // own tile (its tile is the bottom-left of that block). Tapping any tile of that
 // body starts the fight, so it doesn't matter which part of a wide boss you press.
 function bossBodyAt(tx, ty){
  const G = Delve.G, b = G && G.boss;
  if(!b) return null;
  const s = b.size || { w:1, h:1 };
  if(tx < b.x || tx > b.x + s.w - 1) return null;
  if(ty > b.y || ty <= b.y - s.h) return null;
  return b;
 }

 // ── Pathfinder step version ──────────────────────────────────
 Delve.tryActOnStep = function(tx, ty){
 const G = Delve.G;
 if(!G || G.dead || G.runEnded) return;
 const g = G.grid;

 if(G.shop && G.shop.x === tx && G.shop.y === ty && !G.inCombat && !G.targetingAbility){
 G._path = null;
 if(G._pathTimer){ clearInterval(G._pathTimer); G._pathTimer = null; }
 Delve.openShop();
 return;
 }

 if(!g[ty] || g[ty][tx] === undefined) return;
 if(G.inCombat){ G._path = null; return; }

 if(tx > G.px) G.lastDir = "right";
 else if(tx < G.px) G.lastDir = "left";
 else if(ty > G.py) G.lastDir = "down";
 else G.lastDir = "up";

 const cell = g[ty][tx];
 if(cell === T().MONSTER){
 const m = G.monsters.find(m => m.x===tx && m.y===ty);
 if(m){ G._path = null; Delve.startCombat(m); }
 } else if(cell === T().BOSS){
 if(G.boss && G.boss.x===tx && G.boss.y===ty){ G._path = null; Delve.startCombat(G.boss); }
 } else if(cell === T().WALL){
 G._path = null;
 } else if(cell === T().CHEST){
 G._path = null; Delve.openChest(tx, ty);
 } else if(cell === T().STAIR){
 G._path = null; Delve.promptStairs();
 } else if(bossBodyAt(tx, ty)){
 G._path = null; Delve.startCombat(bossBodyAt(tx, ty));
 } else {
 if(cell === T().BARREL) Delve.smashBarrel(tx, ty);
 G.px = tx; G.py = ty;
 if(Delve.sfx) Delve.sfx("footstep");
 Delve.collectGold(tx, ty);
 const idx = G.items.findIndex(i => i.x===tx && i.y===ty);
 if(idx >= 0){ const it = G.items.splice(idx,1)[0]; Delve.pickupItem(it); }
 Delve.enemiesTurn();
 }
 Delve.updateHUD();
 };

 // ── Smash barrel ─────────────────────────────────────────────
 Delve.smashBarrel = function(tx, ty){
 const G = Delve.G, b = C().barrel;
 if(!G || G.dead || G.runEnded) return; // C-017 guard
 let gold = 0;
 if(Math.random() < b.goldChance) gold = Delve.rng(b.goldMin, b.goldMax);

 if(G.grid[ty] && G.grid[ty][tx] === T().BARREL) G.grid[ty][tx] = T().FLOOR;
 G.barrels = (G.barrels || []).filter(x => !(x.x === tx && x.y === ty));
 Delve.addShake(1);
 if(Delve.sfx) Delve.sfx("barrel");
 Delve.recordStat("barrelsSmashed", 1);

 if(gold > 0){
 const mult = Delve.goldMult ? Delve.goldMult() : 1;
 const gained = Math.round(gold * mult);
 G.gold += gained;
 Delve.recordStat("goldEarned", gained);
 Delve.addFloater("+" + gained + "g", tx, ty, "#ffd75e");
 if(Delve.logSystem) Delve.logSystem("Barrel smashed! +" + gained + " gold");
 } else {
 Delve.addFloater("empty", tx, ty, "#9fb3c5");
 if(Delve.logSystem) Delve.logSystem("Barrel smashed — empty.");
 }
 Delve.updateHUD();
 };

 // ── Rest ─────────────────────────────────────────────────────
 Delve.tryRest = function(){
 const G = Delve.G, cfg = C();
 if(!G || G.dead || G.runEnded) return; // C-017 guard
 if(G.inCombat) return;
 if(G.restCount >= (Delve.restsPerFloor ? Delve.restsPerFloor() : cfg.restPerFloor)){ Delve.flash("No more rest available this floor"); return; }
 const heal = Math.max(cfg.restMinHeal, Math.round(Delve.maxHp() * cfg.restHealPct * (Delve.healMult ? Delve.healMult() : 1)));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 G.restCount++;
 if(Delve.sfx) Delve.sfx("rest");
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 if(Delve.logHeal) Delve.logHeal(heal, "Rest");
 Delve.flash("Rested. (" + ((Delve.restsPerFloor ? Delve.restsPerFloor() : cfg.restPerFloor) - G.restCount) + " left)");
 Delve.enemiesTurn();
 Delve.updateHUD();
 Delve.draw();
 };

 // ── Collect gold pile ────────────────────────────────────────
 Delve.collectGold = function(tx, ty){
 const G = Delve.G;
 if(!G || !G.goldPiles) return; // C-017 guard
 const idx = G.goldPiles.findIndex(p => p.x === tx && p.y === ty);
 if(idx < 0) return;
 const pile = G.goldPiles.splice(idx,1)[0];
 G.gold += pile.amount;
 Delve.recordStat("goldEarned", pile.amount);
 if(Delve.sfx) Delve.sfx("pickup_gold");
 if(G.grid[ty] && G.grid[ty][tx] === T().GOLD) G.grid[ty][tx] = T().FLOOR;
 if(Delve.logSystem) Delve.logSystem("+" + pile.amount + " gold");
 Delve.updateHUD();
 };

 // ── Descend ──────────────────────────────────────────────────
 Delve.descend = function(){
 const G = Delve.G, cfg = C();
 if(!G || G.dead || G.runEnded) return; // C-017 guard
 G.hp = Math.min(Delve.maxHp(), G.hp + Math.round(Delve.maxHp() * cfg.healOnDescendPct * (Delve.healMult ? Delve.healMult() : 1)));
 // Hearty Stew / floorHeal: consume one charge on descend.
 if(G.floorHealLeft > 0){
 G.floorHealLeft--;
 const stew = Math.round(3 * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + stew);
 Delve.addFloater("+" + stew + " stew", G.px, G.py, "#ffd75e");
 if(Delve.logSystem) Delve.logSystem("The stew warms you. +" + stew + " HP.");
 }
 G.floor++;
 if(Delve.sfx) Delve.sfx("stairs");
 if(Delve.sfxSetWard) Delve.sfxSetWard((Delve.getWard(G.floor)||{}).id || 1);
 if(G.floor > Delve.save.bestFloor){ Delve.save.bestFloor = G.floor; Delve.persist(); }
 G.secondWindUsed = false;
 G.lastStandUsed = false;
 G.floorCleared = false;
 Delve.recordStat("floorsDescended", 1);
 if(Delve.logFloor) Delve.logFloor(G.floor);
 Delve.genFloor();
 Delve.updateHUD();
 if(Delve.showFloorCard) Delve.showFloorCard(G.floor);
 };

 // ── Stairs prompt ────────────────────────────────────────────
 // Reads no G state of its own, so no guard is needed here — the ui.js
 // prompt and the descend() fallback both handle their own.
 Delve.promptStairs = function(){
 if(Delve.showStairsPrompt) Delve.showStairsPrompt();
 else Delve.descend();
 };
})();
