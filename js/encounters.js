window.Delve = window.Delve || {};
(function(){

 // ── encounters.js : floor events + ambushes ────────────────────
 // Two optional interruptions that give a floor something to decide:
 //
 //   · a FLOOR EVENT is one prop on a walkable tile. Stepping onto it opens a
 //     card of two or three priced choices (js/content/con-events.js holds the
 //     data). Resolving it marks it used; walking away leaves it for later.
 //   · an AMBUSH is a chance, on resting or opening a chest, that one or two
 //     enemies arrive nearby. It is never fatal on the spot — they spawn two
 //     tiles away, so the player always gets the next move.
 //
 // Every number lives in CONFIG.FLOOR_EVENTS. This file owns no content.
 // Depends on (all resolved at call time): Delve.spawnMonsterAt (levels.js),
 // Delve.getMonsterBand/pickWeighted (state.js), Delve.addAbility (traits.js),
 // Delve.makeItem/rollTier/pickupItem (items.js), Delve.maxHp (attrs.js).

 const cfg = function(){ return Delve.CONFIG.FLOOR_EVENTS || {}; };
 const T = function(){ return Delve.T; };

 function kinds(){ return cfg().kinds || []; }

 function kindDef(kindId){
  const list = kinds();
  for(let i = 0; i !== list.length; i++){
   if(list[i].id === kindId) return list[i];
  }
  return null;
 }

 // ── Placement ────────────────────────────────────────────────
 // Called once, at the end of genFloor(). Returns the event or null.
 Delve.placeFloorEvent = function(G){
  G = G || Delve.G;
  if(!G || !G.grid) return null;
  const c = cfg();
  if(!kinds().length) return null;
  if(G.floor < (c.minFloor || 1)) return null;
  if(G.floor % 10 === 0) return null;                       // boss arena: nothing else lives here
  if(Delve.isShopFloor && Delve.isShopFloor(G.floor)) return null;
  if(Math.random() > (c.chance || 0)) return null;

  const free = [];
  for(let y = 1; y < G.gridH - 1; y++){
   for(let x = 1; x < G.gridW - 1; x++){
    const t = G.grid[y][x];
    if(t !== T().FLOOR && t !== T().GRASS) continue;
    if(Delve.mdist(x, y, G.px, G.py) < 5) continue;         // never in the entrance room
    if(G.shop && G.shop.x === x && G.shop.y === y) continue;
    free.push({ x:x, y:y });
   }
  }
  if(!free.length) return null;

  const spot = free[Math.floor(Math.random() * free.length)];
  const def = kinds()[Math.floor(Math.random() * kinds().length)];
  G.floorEvent = { x:spot.x, y:spot.y, kind:def.id, used:false };
  return G.floorEvent;
 };

 // The event under a tile, if it is still awaiting an answer.
 Delve.eventAt = function(x, y){
  const G = Delve.G;
  const ev = G && G.floorEvent;
  if(!ev || ev.used) return null;
  if(ev.x !== x || ev.y !== y) return null;
  return ev;
 };

 // Called by movement when the player steps on the event tile.
 Delve.openFloorEvent = function(){
  const G = Delve.G;
  if(!G || !G.floorEvent || G.floorEvent.used) return false;
  if(Delve.showFloorEventCard) Delve.showFloorEventCard(G.floorEvent);
  return true;
 };

 // ── Costs & availability ─────────────────────────────────────
 Delve.floorEventCost = function(opt){
  const G = Delve.G;
  const gold = Math.round((opt && opt.gold || 0) + (opt && opt.goldPerFloor || 0) * (G ? G.floor : 0));
  const hp = (opt && opt.hpPct) ? Math.round(Delve.maxHp() * opt.hpPct) : 0;
  return { gold:gold, hp:hp };
 };

 function unlearnedAbility(){
  const all = (Delve.CONFIG.TRAITS && Delve.CONFIG.TRAITS.abilities) || [];
  const G = Delve.G || {};
  const known = (G.abilities || []).map(function(a){ return a.id; })
   .concat((Delve.save && Delve.save.abilities) || []);
  for(let i = 0; i !== all.length; i++){
   if(known.indexOf(all[i].id) < 0) return all[i];
  }
  return null;
 }

 Delve.floorEventCanUse = function(opt){
  const G = Delve.G;
  if(!G || !opt) return false;
  const cost = Delve.floorEventCost(opt);
  if(cost.gold > (G.gold || 0)) return false;
  if(cost.hp > 0 && (G.hp || 0) <= cost.hp) return false;    // never let a choice kill you
  if(opt.effect === "hpForAbility" && !unlearnedAbility()) return false;
  return true;
 };

 // ── Resolution ───────────────────────────────────────────────
 // Returns true when the choice was taken. The caller (ui.js) closes the card.
 Delve.resolveFloorEvent = function(optionId){
  const G = Delve.G;
  const ev = G && G.floorEvent;
  if(!G || !ev || ev.used) return false;
  const def = kindDef(ev.kind);
  if(!def) return false;

  let opt = null;
  (def.options || []).forEach(function(o){ if(o.id === optionId) opt = o; });
  if(!opt) return false;

  if(!Delve.floorEventCanUse(opt)){
   Delve.flash("You cannot pay that price.");
   if(Delve.sfx) Delve.sfx("deny");
   return false;
  }

  const cost = Delve.floorEventCost(opt);
  if(cost.gold > 0){
   G.gold -= cost.gold;
   Delve.recordStat("goldSpentEvent", cost.gold);
  }
  if(cost.hp > 0) G.hp = Math.max(1, G.hp - cost.hp);

  switch(opt.effect){
   case "healPct": {
    const heal = Math.round(Delve.maxHp() * (opt.value || 0) * (Delve.healMult ? Delve.healMult() : 1));
    G.hp = Math.min(Delve.maxHp(), G.hp + heal);
    Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
    if(Delve.logHeal) Delve.logHeal(heal, def.name);
    break;
   }
   case "maxHp": {
    const before = Delve.maxHp();
    G.maxHpBonus = (G.maxHpBonus || 0) + (opt.value || 0);
    const gained = Delve.maxHp() - before;
    if(gained > 0) G.hp = Math.min(Delve.maxHp(), G.hp + gained);
    Delve.addFloater("+" + gained + " max HP", G.px, G.py, "#7ee08a");
    if(Delve.logSystem) Delve.logSystem("Your maximum health rises by " + gained + ".");
    break;
   }
   case "shards": {
    G.runShards = (G.runShards || 0) + (opt.value || 0);
    Delve.recordStat("shardsEarned", opt.value || 0);
    Delve.addFloater("+" + (opt.value || 0) + "◇", G.px, G.py, "#7ee0ff");
    if(Delve.logSystem) Delve.logSystem("+" + (opt.value || 0) + " shards, banked when the run ends.");
    break;
   }
   case "gamble": {
    if(Math.random() < (opt.chance || 0.5)){
     const tier = Math.min(4, Delve.rollTier(G.floor, 1) + (opt.tierBonus || 0));
     const it = Delve.makeItem(tier, { unique:true, kind:"event" });
     if(it){
      Delve.stampProvenance(it, { kind:"event" });
      Delve.pickupItem(it);
      if(Delve.sfx) Delve.sfx("pickup_item", { tier: it.tier });
      Delve.flash("The bones favour you: " + it.name);
      if(Delve.logSystem) Delve.logSystem("The wager pays out — " + it.name + ".");
     }
    } else {
     Delve.flash("The bones come up empty.");
     if(Delve.logSystem) Delve.logSystem("The wager takes your coin and gives nothing back.");
    }
    break;
   }
   case "hpForAbility": {
    const a = unlearnedAbility();
    if(a) Delve.addAbility(a);
    break;
   }
   case "hpForShards": {
    G.runShards = (G.runShards || 0) + (opt.value || 0);
    Delve.recordStat("shardsEarned", opt.value || 0);
    Delve.addFloater("+" + (opt.value || 0) + "◇", G.px, G.py, "#7ee0ff");
    if(Delve.logSystem) Delve.logSystem("The altar drinks, and pays: +" + (opt.value || 0) + " shards.");
    break;
   }
   default:
    Delve.flash("You step away.");
    break;
  }

  ev.used = true;
  if(Delve.sfx) Delve.sfx(opt.effect === "nothing" ? "ui_click" : "potion");
  if(Delve.updateHUD) Delve.updateHUD();
  if(Delve.draw) Delve.draw();
  return true;
 };

 // ── Ambush ───────────────────────────────────────────────────
 // `source` is "rest" or "chest" — the key read from CONFIG.FLOOR_EVENTS.ambush.
 Delve.maybeAmbush = function(source){
  const G = Delve.G;
  const a = cfg().ambush || {};
  if(!G || G.dead || G.runEnded) return null;
  if(G.inCombat || G.combatTarget) return null;
  if(G.floor < (a.minFloor || 1)) return null;
  if(G.floor % 10 === 0) return null;                        // the boss IS the ambush
  if((G.ambushCount || 0) >= (a.maxPerFloor || 0)) return null;
  const chance = a[source] || 0;
  if(!chance || Math.random() > chance) return null;
  return Delve.spawnAmbush(a);
 };

 Delve.spawnAmbush = function(a){
  const G = Delve.G;
  if(!G) return null;
  a = a || cfg().ambush || {};

  // Two tiles out: close enough to be frightening, far enough that they do not
  // get a free hit on the same turn.
  const free = [];
  for(let y = 0; y < G.gridH; y++){
   for(let x = 0; x < G.gridW; x++){
    const t = G.grid[y][x];
    if(t !== T().FLOOR && t !== T().GRASS) continue;
    const d = Delve.mdist(x, y, G.px, G.py);
    if(d !== 2 && d !== 3) continue;
    if(Delve.eventAt && Delve.eventAt(x, y)) continue;
    free.push({ x:x, y:y });
   }
  }
  if(!free.length) return null;

  const band = Delve.getMonsterBand(G.floor);
  const spawned = [];
  const want = (G.floor >= (a.secondAtFloor || 999) && Math.random() < (a.secondChance || 0)) ? 2 : 1;
  for(let i = 0; i !== want && free.length; i++){
   const spot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
   const kind = Delve.pickWeighted(band.weights);
   if(!kind || !Delve.spawnMonsterAt) break;
   const m = Delve.spawnMonsterAt(spot.x, spot.y, kind);
   if(m) spawned.push(m);
  }
  if(!spawned.length) return null;

  G.ambushCount = (G.ambushCount || 0) + 1;
  const names = spawned.map(function(m){ return m.name; }).join(" and ");
  if(Delve.sfx) Delve.sfx("elite");
  if(Delve.addShake) Delve.addShake(3);
  Delve.flash("AMBUSH! " + names);
  if(Delve.logSystem) Delve.logSystem("Ambush! " + names + " close in.");
  if(Delve.updateHUD) Delve.updateHUD();
  if(Delve.draw) Delve.draw();
  return spawned;
 };

})();
