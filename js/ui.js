window.Delve = window.Delve || {};
(function(){

 // ── ui.js ────────────────────────────────────────────────────
 // Owns: HUD updates, inventory/item-card screens, shop screen UI,
 //       screen orchestration (hub/run/end), the debug panel, and ALL
 //       DOM event wiring.
 // Does NOT own canvas drawing. The paper doll and minimap moved to
 // render.js; shop stock/pricing moved to items.js. Call sites below
 // reach them via Delve.drawPaperDoll / Delve.makeShopStock / Delve.shopHealCost.

 // Safe element lookup: if an id is missing from index.html, return an inert
 // stand-in instead of null. One missing element can no longer crash the rest
 // of this file. Missing ids are logged and listed in Delve.missingEls.
 const _warned = {};
 function nullEl(id){
  const noop = function(){};
  return {
   // isStub lets callers tell a stand-in from a real element. Plain
   // `if(!el)` tests do NOT work here: a stub is truthy by design.
   isStub: true,
   id: id, style: {}, dataset: {}, children: [],
   textContent: "", innerHTML: "", value: "", disabled: false,
   classList: { add: noop, remove: noop, toggle: noop, contains: function(){ return false; } },
   addEventListener: noop, appendChild: noop, removeChild: noop,
   querySelector: function(){ return nullEl(id + ">?"); },
   getContext: function(){ return null; }
  };
 }
 const $ = function(id){
  const el = document.getElementById(id);
  if(el) return el;
  if(!_warned[id]){
   _warned[id] = 1;
   (Delve.missingEls = Delve.missingEls || []).push(id);
   try { console.warn("ui.js: missing element #" + id); } catch(_e){}
  }
  return nullEl(id);
 };

 const DEATH_QUOTES = [
  "The Undercroft claims another.",
  "The stones drink you in silence.",
  "Down here, the only way out is through. You went down.",
  "The Warden was not the only thing watching.",
  "Your torch gutters. The dark does not wait."
 ];

 function hideAll(){
  ["titleScreen","hubScreen","deathScreen","inventoryScreen","shopScreen","victoryScreen",
   "stairsPrompt","bossIntroOverlay","itemCardOverlay","logWindow","pauseMenu",
   "statsOverlay","eventScreen","tutorialOverlay"].forEach(function(id){
   const el = $(id); if(el) el.style.display = "none";
  });
 }

   Delve.hideAllScreens = hideAll;

  // One owner for "the run chrome is on screen". The HUD strip and the bottom
  // action cluster are separate elements (the cluster is a sibling of #hud so it
  // can be positioned against #app rather than the strip), so they must never be
  // toggled independently — that is how a button ends up visible over the title
  // screen. Every screen change goes through here.
 Delve.setHudVisible = function(on){
  const hud = $("hud"), act = $("hudActions");
  if(hud) hud.style.display = on ? "flex" : "none";
  if(act) act.style.display = on ? "flex" : "none";
 };

  // ── Slot unlock state ────────────────────────────────────────
 Delve.isSlotUnlocked = function(slotKey){
  const def = Delve.CONFIG.SLOTS && Delve.CONFIG.SLOTS[slotKey];
  if(!def) return true;
  if(def.unlock === 0) return true;
  if(Delve.save && Delve.save.unlocks && Delve.save.unlocks[slotKey]) return true;
  return false;
 };

 Delve.equipSlots = function(){
  const G = Delve.G;
  if(!G.equip) G.equip = {};
  return G.equip;
 };

 // ── HUD update ────────────────────────────────────────────────
 // The top bar shows THREE things — health, energy, experience — because the
 // play area is where the player is looking. Every combat number moved into the
 // character sheet (openStats), which is read while standing still.
 function setBar(id, frac){
  const el = $(id);
  if(el && el.style) el.style.width = Math.round(Math.max(0, Math.min(1, frac || 0)) * 100) + "%";
 }

 Delve.updateHUD = function(){
  const G = Delve.G; if(!G) return;

  const maxHp = Delve.maxHp();
  const hp = Math.max(0, Math.min(maxHp, G.hp || 0));
  $("hudHp").textContent = hp + "/" + maxHp;
  setBar("hudHpFill", maxHp > 0 ? hp / maxHp : 0);

  // Energy against the cap, so the bar also answers "can I afford this cast?".
  const cap = Delve.energyCap ? Delve.energyCap() : 100;
  const en = Math.max(0, Math.min(cap, Math.floor(G.energy || 0)));
  $("hudEnergy").textContent = en + "/" + cap;
  setBar("hudEnFill", cap > 0 ? en / cap : 0);

  const need = (Delve.xpToNext ? Delve.xpToNext() : 1) || 1;
  const xp = Math.max(0, Math.floor(G.xp || 0));
  $("hudLevel").textContent = "Lv " + (G.level || 1);
  $("hudXp").textContent = xp + "/" + need;
  setBar("hudXpFill", xp / need);

  $("hudFloor").textContent = G.floor;
  // The badge answers "is there something in the bag I have not looked at?".
  // It counts G.inventory items flagged isNew (see items.js), NOT the loot lying
  // on the floor: counting the floor is what left a stale "1" up after equipping
  // the drop. 0 hides the badge (CSS); the title always carries the real bag.
  const bagBtn = $("invBtn");
  if(bagBtn){
   const carried = (G.inventory || []).length;
   const unseen = Delve.unseenCount ? Delve.unseenCount() : 0;
   const cap = Delve.inventoryCap ? Delve.inventoryCap() : (Delve.CONFIG.inventorySlots || 16);
   bagBtn.dataset.bag = String(unseen);
   bagBtn.title = "Inventory " + carried + "/" + cap + (unseen ? " — " + unseen + " new" : "");
  }
  $("hudGold").textContent = G.gold;
  $("hudShards").textContent = Delve.save.shards + (Delve.pendingRunShards ? Delve.pendingRunShards() : 0); // banked + unbanked run earnings
  // The 📜 Log pill is visible during a run only — showHub() takes the class off.
  // The pill takes no space; the log itself stays hidden until it's tapped.
  const lp = $("logPanel"); if(lp) lp.classList.add("active");

  const rd = $("restDots");
  if(rd){
   const max = Delve.restsPerFloor ? Delve.restsPerFloor() : Delve.CONFIG.restPerFloor, used = G.restCount || 0;
   rd.innerHTML = "";
   for(let i=0;i<max;i++){
    const d = document.createElement("span");
    d.className = "rest-dot" + (i<used ? " used" : "");
    rd.appendChild(d);
   }
  }
  Delve.renderAbilityBar();
  Delve.renderMinimap();     // render.js
 };

 // ── CHARACTER SHEET ──────────────────────────────────────────
 // Opened with 📊. This is where the attribute numbers went when they left the
 // HUD: it is read while standing still, so it may use the whole screen.
 function statRow(label, value){
  const row = document.createElement("div");
  row.className = "stats-row";
  const l = document.createElement("span");
  l.className = "sr-label"; l.textContent = label;
  const v = document.createElement("span");
  v.className = "sr-value"; v.textContent = value;
  row.appendChild(l); row.appendChild(v);
  return row;
 }
 function statHead(text){
  const h = document.createElement("div");
  h.className = "stats-head"; h.textContent = text;
  return h;
 }

 Delve.openStats = function(){
  const G = Delve.G; if(!G) return;
  const list = $("statsList");
  list.innerHTML = "";
  const pct = v => Math.round((v || 0) * 100) + "%";

  list.appendChild(statHead("OFFENCE"));
  list.appendChild(statRow("⚔️ Attack", String(Delve.atk())));
  if(Delve.weaponBand){
   const bd = Delve.weaponBand();
   list.appendChild(statRow("Weapon damage", Math.round(bd.min) + "-" + Math.round(bd.max)));
  }
  if(Delve.crit) list.appendChild(statRow("🎯 Crit chance", pct(Delve.crit())));
  if(Delve.playerSpeed) list.appendChild(statRow("⚡ Attack speed", Delve.playerSpeed().toFixed(2) + "x"));

  list.appendChild(statHead("DEFENCE"));
  list.appendChild(statRow("❤️ Max HP", String(Delve.maxHp())));
  if(Delve.dmgRed) list.appendChild(statRow("🛡️ Damage reduction", pct(Delve.dmgRed())));
  if(Delve.dodge) list.appendChild(statRow("👟 Dodge", pct(Delve.dodge())));

  list.appendChild(statHead("LUCK & LOOT"));
  if(Delve.luckPts) list.appendChild(statRow("🍀 Luck", String(Math.round(Delve.luckPts()))));
  if(Delve.goodsDiscount) list.appendChild(statRow("Merchant discount", pct(Delve.goodsDiscount())));

  // Passives and tag progress, so the build stays legible away from level-up.
  const traits = Delve.traits ? Delve.traits() : [];
  if(traits.length){
   list.appendChild(statHead("PASSIVES"));
   traits.forEach(function(t){
    list.appendChild(statRow(t.name + (t.tag ? " · " + t.tag : ""), "Rank " + (t.rank || 1)));
   });
   const tr = (Delve.traitBuffs && Delve.traitBuffs().tagRanks) || {};
   const parts = Object.keys(tr).map(k => k + " " + tr[k] + "/6");
   if(parts.length){
    list.appendChild(statHead("SET PROGRESS"));
    list.appendChild(statRow("Tags", parts.join("  ·  ")));
   }
  }

  $("statsOverlay").style.display = "flex";
 };
 Delve.closeStats = function(){ $("statsOverlay").style.display = "none"; };
 $("statsBtn").addEventListener("click", Delve.openStats);
 $("statsCloseBtn").addEventListener("click", Delve.closeStats);

 // ── INVENTORY ────────────────────────────────────────────────
 Delve.openInventory = function(){
  const G = Delve.G;
  if(!G) return;
  const eq = Delve.equipSlots();
  Delve.drawPaperDoll();     // render.js

  // Build equipment slot grid
  const rack = $("equipRack");
  rack.innerHTML = "";
  Delve.CONFIG.SLOT_ORDER.forEach(function(key){
   const def = Delve.CONFIG.SLOTS[key];
   const unlocked = Delve.isSlotUnlocked(key);
   const item = eq[key];
   const slot = document.createElement("div");
   slot.className = "equip-cell";
   if(!unlocked) slot.classList.add("locked");
   const lbl = document.createElement("div");
   lbl.className = "equip-cell-label";
   lbl.textContent = def.icon + " " + def.label;
   const val = document.createElement("div");
   val.className = "equip-cell-val";
   if(!unlocked){
    val.textContent = "🔒 " + def.unlock + "◇";
    val.style.color = "#5a4a34";
   } else if(item){
    val.textContent = item.name;
    val.style.color = Delve.TIERS.colors[item.tier] || "#cfd8e0";
   } else {
    val.textContent = "empty";
    val.style.color = "#3a4d5c";
   }
   slot.appendChild(lbl); slot.appendChild(val);
   if(unlocked && item){
    slot.addEventListener("click", function(){ Delve.showItemCard(item, "inventory"); });
   }
   rack.appendChild(slot);
  });

  // Carried items grid
  const grid = $("invCarriedGrid");
  grid.innerHTML = "";
  const inv = G.inventory || [];
  const cap = Delve.inventoryCap ? Delve.inventoryCap() : (Delve.CONFIG.inventorySlots || 16);
  if(!inv.length){
   const empty = document.createElement("div");
   empty.style.cssText = "color:#3a4d5c;font-size:13px;padding:8px;";
   empty.textContent = "Nothing carried. (" + inv.length + "/" + cap + ")";
   grid.appendChild(empty);
  } else {
   const count = document.createElement("div");
   count.style.cssText = "width:100%;color:#7f94a8;font-size:11px;font-weight:700;";
   count.textContent = inv.length + " / " + cap + " carried";
   grid.appendChild(count);
   inv.forEach(function(it){
    const col = Delve.TIERS.colors[it.tier] || "#cfd8e0";
    const btn = document.createElement("button");
    btn.className = "inv-item-btn";
    btn.style.borderColor = col + "66";
    const n = document.createElement("span");
    n.textContent = it.name; n.style.color = col; n.style.fontWeight = "800";
    const t = document.createElement("span");
    t.textContent = Delve.TIERS.names[it.tier] || ""; t.style.color = "#7f94a8";
    btn.appendChild(n); btn.appendChild(t);
    btn.addEventListener("click", function(){ Delve.showItemCard(it, "inventory"); });
    grid.appendChild(btn);
   });
  }

  // Everything is on screen now, so the "new" flags have been seen. Clearing them
  // here is what stops the number sitting on the 🎒 after the player has looked.
  if(Delve.markBagSeen) Delve.markBagSeen();
  Delve.updateHUD();
  $("inventoryScreen").style.display = "flex";
 };
 $("invBtn").addEventListener("click", Delve.openInventory);
 $("invCloseBtn2").addEventListener("click", function(){ $("inventoryScreen").style.display = "none"; });

 // ── ITEM STAT CARD ───────────────────────────────────────────
 let pendingItemAction = null;
 function closeItemCard(){ $("itemCardOverlay").style.display = "none"; }

 Delve.showItemCard = function(item, source){
  pendingItemAction = { item: item, source: source };
  // The Equip button belongs to the floor card only; an inventory item is
  // already yours. Hide it here so it can never leak in from a previous card.
  const tBtn = $("icTertiaryBtn");
  if(tBtn) tBtn.style.display = "none";
  const overlay = $("itemCardOverlay");
  const tierCol = Delve.TIERS.colors[item.tier] || "#cfd8e0";
  const tierName = Delve.TIERS.names[item.tier] || "";

  // Item sprite: same art as the floor, so the card is recognisable.
  // This canvas is created on first use, so the lookup must go through the
  // real DOM: $() hands back a truthy stand-in for a missing id, which would
  // defeat an `if(!spr)` test and leave getContext() returning null.
  let spr = document.getElementById("icSprite");
  if(!spr){
   spr = document.createElement("canvas");
   spr.id = "icSprite";
   spr.width = 72; spr.height = 72;
   spr.style.cssText = "image-rendering:pixelated;display:block;margin:0 auto 6px;";
   const nameEl = document.getElementById("icName");
   const host = nameEl && nameEl.parentNode;
   if(host) host.insertBefore(spr, nameEl);
  }
  const sctx = (spr.getContext ? spr.getContext("2d") : null);
  if(sctx){
   sctx.clearRect(0, 0, 72, 72);
   const img = Delve.itemSprite ? Delve.itemSprite(item) : null;
   if(img){ sctx.imageSmoothingEnabled = false; sctx.drawImage(img, 0, 0, 72, 72); }
  }

  // On the floor the card leads with the BASE name ("Short Spear"), so the
  // question "do I want a weapon?" is answerable at a glance; the full affixed
  // name ("Keen Short Spear of the Fox") is shown underneath once it is yours.
  // In the inventory, and on the floor for uniques, the full name leads.
  const isFloor = (source === "floor");
  const fullName = item.name;
  const baseName = item.baseName || item.name;
  const showFullFirst = !isFloor || item.unique;
  $("icName").textContent = showFullFirst ? fullName : baseName;
  $("icName").style.color = tierCol;
  // A second line carries whichever name is not already on top.
  const sub = $("icNameSub");
  if(sub){
   const second = showFullFirst ? "" : fullName;
   sub.textContent = second;
   sub.style.display = second ? "block" : "none";
  }
  $("icTier").textContent = tierName;
  $("icTier").style.color = tierCol;
  $("icFlavour").textContent = item.lore || item.flavour || "";

  const body = $("icStats");
  body.innerHTML = "";
  Delve.itemStatLines(item).forEach(function(l){
   const row = document.createElement("div");
   row.className = "ic-stat-row";
   const lbl = document.createElement("span");
   lbl.className = "ic-stat-label"; lbl.textContent = l.label;
   const val = document.createElement("span");
   val.className = "ic-stat-value"; val.textContent = l.value;
   // deltaText already carries its sign and unit (see itemStatLines).
   if(l.deltaText){ val.textContent += "  " + l.deltaText; }
   if(l.delta > 0){ val.style.color = "#7ee08a"; }
   else if(l.delta < 0){ val.style.color = "#ff9a9a"; }
   row.appendChild(lbl); row.appendChild(val);
   body.appendChild(row);
  });
  if(item.provenance){
   const prov = document.createElement("div");
   prov.style.cssText = "font-size:11px;color:#7f94a8;font-style:italic;margin-top:6px;";
   prov.textContent = item.provenance;
   body.appendChild(prov);
  }

  const primary = $("icPrimaryBtn");
  const secondary = $("icSecondaryBtn");
  const tertiary = $("icTertiaryBtn");

  if(source === "floor"){
   const full = Delve.G.inventory.length >= (Delve.inventoryCap ? Delve.inventoryCap() : Delve.CONFIG.inventorySlots);
   // Where the item is lying. Captured once here: both Pick Up and Equip need it,
   // and the pending action is replaced if another card opens.
   const fx = item.x, fy = item.y;
   // A floor item that can be worn gets a THIRD button: Pick Up, Equip, Leave.
   // Equipping straight from the floor is the whole point of inspecting it —
   // the card has just told you it is better than what you have, so making you
   // put it in the bag first is a step with no decision in it.
   const wearable = item.slot !== "consumable";
   if(tertiary){
    tertiary.style.display = wearable ? "" : "none";
    tertiary.textContent = "Equip";
   }
   primary.textContent = full ? "No Room" : (wearable ? "Pick Up" : "Take");
   primary.disabled = full;
   secondary.textContent = "Leave";
   secondary.onclick = function(){
    // Leave means "not this one": the step still happens and the item stays on
    // the floor. Closing the card alone left the tile impassable, so a player
    // who declined an item could not walk past it.
    //
    // Only an ORTHOGONAL neighbour is a legal step. A diagonal tap must not move
    // — that was the bug that made an item block the passageway: the player
    // tapped a diagonal item, the card opened, Leave declined to step because
    // the tile was not adjacent, and the tile stayed refused.
    const G = Delve.G;
    if(G && fx !== undefined && fy !== undefined && Delve.mdist(fx, fy, G.px, G.py) === 1){
     const cell = G.grid[fy] && G.grid[fy][fx];
     const walkable = cell === Delve.T.FLOOR || cell === Delve.T.GRASS || cell === Delve.T.DOOR;
     if(walkable){
      G.px = fx; G.py = fy;
      if(Delve.sfx) Delve.sfx("footstep");
      Delve.collectGold(fx, fy);
      if(Delve.enemiesTurn) Delve.enemiesTurn();
     }
    }
    Delve.updateHUD(); Delve.draw(); closeItemCard();
   };

   // Walk onto the tile, if it is one step away and walkable. Shared by both
   // actions so Pick Up and Equip reach the world the same way.
   const stepOnto = function(){
    const G = Delve.G;
    if(!G || fx === undefined || fy === undefined) return;
    if(Delve.mdist(fx, fy, G.px, G.py) !== 1) return;
    const cell = G.grid[fy] && G.grid[fy][fx];
    const walkable = cell === Delve.T.FLOOR || cell === Delve.T.GRASS || cell === Delve.T.DOOR;
    if(!walkable) return;
    G.px = fx; G.py = fy;
    if(Delve.sfx) Delve.sfx("footstep");
    Delve.collectGold(fx, fy);
   };
   const takeOffFloor = function(){
    if(fx === undefined || fy === undefined) return;
    Delve.G.items = Delve.G.items.filter(function(i){ return !(i.x === fx && i.y === fy); });
   };

   primary.onclick = function(){
    if(full) return;
    const it = Object.assign({}, pendingItemAction.item);
    stepOnto();
    takeOffFloor();
    it.isNew = true;
    Delve.G.inventory.push(it);
    if(Delve.logPickup) Delve.logPickup(it.name, it.tier);
    Delve.flash("Picked up " + it.name);
    if(Delve.enemiesTurn) Delve.enemiesTurn();
    Delve.updateHUD(); Delve.draw(); closeItemCard();
   };

   if(tertiary){
    tertiary.onclick = function(){
     const it = Object.assign({}, pendingItemAction.item);
     stepOnto();
     takeOffFloor();
     // equipItem swaps out whatever was in the slot and returns it to the bag,
     // so an upgrade costs no inventory space.
     Delve.equipItem(it);
     if(Delve.enemiesTurn) Delve.enemiesTurn();
     Delve.updateHUD(); Delve.draw(); closeItemCard();
    };
   }
  } else {
   if(item.slot === "consumable"){
    primary.textContent = "Use";
    primary.disabled = false;
    primary.onclick = function(){
     closeItemCard();
     $("inventoryScreen").style.display = "none";
     Delve.useConsumable(item);
     Delve.updateHUD(); Delve.draw();
    };
    secondary.textContent = "Discard";
    secondary.onclick = function(){
     const i = Delve.G.inventory.indexOf(item);
     if(i >= 0) Delve.G.inventory.splice(i, 1);
     Delve.flash("Discarded " + item.name);
     Delve.updateHUD(); Delve.draw(); closeItemCard(); Delve.openInventory();
    };
   } else {
    const equipped = isEquipped(item);
    primary.textContent = equipped ? "Unequip" : "Equip";
    primary.disabled = equipped && Delve.G.inventory.length >= (Delve.inventoryCap ? Delve.inventoryCap() : Delve.CONFIG.inventorySlots);
    primary.onclick = function(){
     if(equipped){ Delve.unequipItem(item); }
     else { Delve.equipItem(item); }
     Delve.updateHUD(); Delve.draw(); closeItemCard(); Delve.openInventory();
    };
    secondary.textContent = equipped ? "Close" : "Discard";
    secondary.onclick = function(){
     if(!equipped){
      const i = Delve.G.inventory.indexOf(item);
      if(i >= 0) Delve.G.inventory.splice(i, 1);
      Delve.flash("Discarded " + item.name);
     }
     Delve.updateHUD(); Delve.draw(); closeItemCard(); Delve.openInventory();
    };
   }
  }
  overlay.style.display = "flex";
 };

 function isEquipped(item){
  const eq = Delve.equipSlots();
  for(const k of Delve.CONFIG.SLOT_ORDER){
   if(eq[k] === item) return true;
  }
  return false;
 }
 $("icCloseBtn").addEventListener("click", closeItemCard);

 // ── LOG WINDOW ───────────────────────────────────────────────
 $("logExpandBtn").addEventListener("click", function(){
  if(Delve.flushLogWindow) Delve.flushLogWindow();
  $("logWindow").style.display = "flex";
 });
 $("logWindowClose").addEventListener("click", function(){ $("logWindow").style.display = "none"; });

 // ── STAIRS / FLOOR CARD / BOSS INTRO ─────────────────────────
 Delve.showStairsPrompt = function(){ $("stairsPrompt").style.display = "flex"; };
 $("stairsYes").addEventListener("click", function(){ $("stairsPrompt").style.display = "none"; Delve.descend(); });
 $("stairsNo").addEventListener("click", function(){ $("stairsPrompt").style.display = "none"; });

 Delve.showFloorCard = function(floor){
  const ward = Delve.getWard(floor);
  const wname = (ward && ward.name) || "The Undercroft";
  if(Delve.sfx) Delve.sfx("floor_enter", { ward: ward ? ward.id : 1 });
  $("floorCardNum").textContent = "Floor " + floor;
  $("floorCardName").textContent =
   Delve.isShopFloor(floor) ? "Trading Post — " + wname :
   (floor % 10 === 0) ? wname + " — Boss Arena" : wname;
  const card = $("floorCard");
  card.style.display = "flex";
  clearTimeout(Delve._floorCardT);
  Delve._floorCardT = setTimeout(function(){ card.style.display = "none"; }, 1500);
 };

 Delve.showBossIntro = function(floor){
  const f = floor || (Delve.G && Delve.G.floor) || 10;
  const cfg = Delve.CONFIG;
  const bossDef = cfg.BOSS_DEFS[Math.ceil(f/10)] || cfg.BOSS_DEFS[1] || {};
  const accent = bossDef.accent || "#c98aff";
  $("bossIntroName").textContent = bossDef.name || "The Warden";
  $("bossIntroTitle").textContent = bossDef.title || "";
  $("bossIntroFlavour").textContent = bossDef.flavour || "";
  const warnEl = $("bossIntroWarning");
  const titleEl = $("bossIntroTitle");
  const cardEl = $("bossIntroCard");
  if(warnEl) warnEl.style.color = accent;
  if(titleEl) titleEl.style.color = accent;
  if(cardEl) cardEl.style.borderColor = accent + "66";
  const ov = $("bossIntroOverlay");
  if(Delve.sfx) Delve.sfx("boss_intro", { ward: Math.ceil(f/10) });
  ov.style.display = "flex";
  clearTimeout(Delve._bossIntroT);
  Delve._bossIntroT = setTimeout(function(){ ov.style.display = "none"; }, 3000);
 };

 // ── HUB ──────────────────────────────────────────────────────
 Delve.refreshHub = function(){
  $("hubShards").textContent = Delve.save.shards;
  const shop = $("shop"); shop.innerHTML = "";
  // A run in progress locks the whole hub (§6.12.2, owner's rule 16 Oct). Shown as a banner
  // rather than by hiding anything: the player can look at every upgrade and buy none of it.
  const locked = Delve.runInProgress ? Delve.runInProgress() : false;
  const lockFloor = (Delve.hasSavedRun && Delve.hasSavedRun()) ? Delve.savedRunFloor()
   : (Delve.G ? Delve.G.floor : 0);
  if(locked){
   const note = document.createElement("div");
   note.className = "hub-locked-note";
   note.textContent = "Your run is still going — floor " + lockFloor +
    ". Upgrades unlock when it ends.";
   shop.appendChild(note);
  }
  Delve.CONFIG.ATTR_ORDER.forEach(function(id){
   const a = Delve.CONFIG.ATTRS[id];
   if(a.kind === "dormant") return;
   const lvl = Delve.save.lvls[id] || 0;
   const cost = Delve.attrCost(id);
   const capped = (a.kind === "pct" && a.cap && Delve.dmgRed() >= a.cap);
   const row = document.createElement("div"); row.className = "upgrade";
   const info = document.createElement("div");
   const name = document.createElement("div"); name.className = "name";
   name.textContent = a.name;
   const lv = document.createElement("span"); lv.className = "lvl"; lv.textContent = " Lv " + lvl;
   name.appendChild(lv);
   const desc = document.createElement("div"); desc.className = "desc"; desc.textContent = a.desc;
   info.appendChild(name); info.appendChild(desc);
   if(!capped && Delve.save.shards < cost){
    const need = document.createElement("div");
    need.className = "desc"; need.style.color = "#c9971f";
    need.textContent = "Need " + (cost - Delve.save.shards) + " more ◇";
    info.appendChild(need);
   }
   const btn = document.createElement("button"); btn.className = "btn";
   btn.textContent = capped ? "MAX" : String(cost);
   btn.disabled = locked || capped || Delve.save.shards < cost;
   btn.addEventListener("click", function(){
    // Asked again at click time rather than trusted from render time — the screen can sit open.
    if(Delve.runInProgress && Delve.runInProgress()) return;
    const c = Delve.attrCost(id);
    if(Delve.save.shards < c) return;
    Delve.save.shards -= c; Delve.save.lvls[id] = (Delve.save.lvls[id] || 0) + 1;
    Delve.persist(); Delve.refreshHub();
   });
   row.appendChild(info); row.appendChild(btn);
   shop.appendChild(row);
  });

  // ── Items bought with shards ──────────────────────────────────
  // The attribute list above buys STATS. This panel buys GEAR — permanent
  // starting items that equip on floor 1 of every future run. They are the
  // clearest expression of "I improved between runs", so they sit in their own
  // section with a heading rather than buried in the attribute list.
  if(!locked){
   const nodes = Delve.CONFIG.PROGRESSION.NODES || {};
   const gearNodes = [];
   Object.keys(nodes).forEach(function(tree){
    (nodes[tree] || []).forEach(function(nd){
     if(nd.type === "startGear") gearNodes.push(nd);
    });
   });
   gearNodes.sort(function(a, b){ return (a.cost || 0) - (b.cost || 0); });
   if(gearNodes.length){
    const h = document.createElement("div");
    h.className = "hub-section";
    h.textContent = "STARTING GEAR";
    shop.appendChild(h);
    gearNodes.forEach(function(nd){
     const owned = !!(Delve.save.nodes && Delve.save.nodes[nd.id]);
     const reqMet = !nd.req || (Delve.save.nodes && Delve.save.nodes[nd.req]);
     const row = document.createElement("div");
     row.className = "upgrade" + (owned ? " owned" : "");
     const info = document.createElement("div");
     const name = document.createElement("div");
     name.className = "name";
     name.textContent = nd.name;
     if(owned){
      const tag = document.createElement("span");
      tag.className = "lvl"; tag.textContent = " OWNED";
      name.appendChild(tag);
     }
     const desc = document.createElement("div");
     desc.className = "desc";
     if(reqMet){
      desc.textContent = nd.desc;
     } else {
      // Find the required node by id across every tree. The previous version
      // chained an object lookup through `.name` before the fallback, so a
      // missing requirement made the whole expression yield undefined and the
      // row rendered with no description.
      let reqName = "an earlier item";
      Object.keys(nodes).forEach(function(t){
       (nodes[t] || []).forEach(function(n){ if(n.id === nd.req) reqName = n.name; });
      });
      desc.textContent = "Requires " + reqName;
     }
     info.appendChild(name); info.appendChild(desc);
     if(!owned && reqMet && Delve.save.shards < nd.cost){
      const need = document.createElement("div");
      need.className = "desc"; need.style.color = "#c9971f";
      need.textContent = "Need " + (nd.cost - Delve.save.shards) + " more ◇";
      info.appendChild(need);
     }
     const btn = document.createElement("button");
     btn.className = "btn";
     btn.textContent = owned ? "OWNED" : String(nd.cost);
     btn.disabled = owned || !reqMet || Delve.save.shards < nd.cost;
     btn.addEventListener("click", function(){
      if(Delve.runInProgress && Delve.runInProgress()) return;
      const n2 = (Delve.CONFIG.PROGRESSION.NODES.kit || []).filter(function(n){ return n.id === nd.id; })[0];
      if(!n2 || Delve.save.shards < n2.cost) return;
      Delve.save.shards -= n2.cost;
      Delve.save.nodes = Delve.save.nodes || {};
      Delve.save.nodes[n2.id] = true;
      if(Delve.sfx) Delve.sfx("levelup");
      Delve.persist();
      Delve.refreshHub();
     });
     row.appendChild(info); row.appendChild(btn);
     shop.appendChild(row);
    });
   }
  }

  // The footer button follows the same rule: with a run parked it is the way BACK INTO that
  // run, not the way to start a second one — starting a fresh run here would overwrite the
  // checkpoint without a word (§6.12.2). The title button appears for the same reason: with
  // a run parked, the hub has no other way back out.
  $("startBtn").textContent = locked ? ("RESUME FLOOR " + lockFloor) : "START RUN";
  $("hubTitleBtn").style.display = locked ? "" : "none";

  (Delve._hooks && Delve._hooks.hubLoaded || []).forEach(function(fn){ fn(); });
 };
 Delve.buildHub = Delve.refreshHub;

 Delve.showHub = function(){
  hideAll();
  if(Delve.sfxStopAmbience) Delve.sfxStopAmbience();
  $("levelupScreen").style.display = "none";
  $("hubScreen").style.display = "flex";
  Delve.setHudVisible(false);
  $("abilityBar").style.display = "none";
  if(Delve.setMinimapOpen) Delve.setMinimapOpen(false);
  const lp = $("logPanel"); if(lp) lp.classList.remove("active");
  const vg = $("combatVignette"); if(vg) vg.classList.remove("active");
  Delve.refreshHub();
 };
 Delve.hideHub = function(){
  $("hubScreen").style.display = "none";
  Delve.setHudVisible(true);
  $("levelupScreen").style.display = "none";
 };

 Delve.startRun = function(){
  hideAll();
  Delve.setHudVisible(true);
  Delve.newRun();
  if(Delve.sfxStartAmbience) Delve.sfxStartAmbience();
  if(Delve.resize) Delve.resize();
  Delve.draw();
  Delve.showFloorCard(Delve.G.floor);
  // First run only. showTutorialIfNeeded() is defined in js/menu.js and reads
  // save.seenTutorial, which save.js has persisted since the beginning without
  // anything ever reading it. Guarded so a missing file cannot block a run.
  if(Delve.showTutorialIfNeeded) Delve.showTutorialIfNeeded();
 };

  // Carrying on from the title screen's FLOOR n button (§6.12). The checkpoint is restored,
 // the floor is rebuilt fresh, and the run screen is shown exactly as startRun() shows it.
 Delve.resumeRun = function(){
  if(!Delve.restoreRunFromCheckpoint) return false;
  if(!Delve.restoreRunFromCheckpoint()) return false;
  hideAll();
  Delve.setHudVisible(true);
  if(Delve.sfxStartAmbience) Delve.sfxStartAmbience();
  if(Delve.resize) Delve.resize();
  Delve.draw();
  Delve.showFloorCard(Delve.G.floor);
  return true;
 };

 // ── ABILITY BAR ──────────────────────────────────────────────
 Delve.renderAbilityBar = function(){
  const bar = $("abilityBar"); if(!bar) return;
  const G = Delve.G;
  bar.innerHTML = "";
  if(!G || !G.abilities || !G.abilities.length){ bar.style.display = "none"; return; }
  bar.style.display = "flex";
  G.abilities.forEach(function(ab){
   const btn = document.createElement("button");
   btn.className = "ability-btn";
   const afford = (G.energy || 0) >= displayCost(ab);
   btn.disabled = !afford;
   if(G.targetingAbility && G.targetingAbility.id === ab.id){
    btn.style.borderColor = "#ffd75e";
    btn.style.background = "#2a2a14";
   }
   const n = document.createElement("span");
   n.className = "ability-name"; n.textContent = ab.name;
   const c = document.createElement("span");
   c.className = "ability-cost";
   c.textContent = "⚡ " + displayCost(ab);
   btn.appendChild(n); btn.appendChild(c);
   btn.addEventListener("click", function(){ activateAbility(ab); });
   bar.appendChild(btn);
  });
 };

 function displayCost(ab){
  return (Delve.hasProgression && Delve.hasProgression("second_nature"))
   ? Math.max(1, Math.round((ab.cost || 0) * 0.8)) : ab.cost;
 }

 function activateAbility(ab){
  const G = Delve.G;
  if(!G || G.dead || G.runEnded) return;
  if((G.energy || 0) < displayCost(ab)){ Delve.flash("Not enough Energy"); return; }
  if(ab.target === "self"){
   G.targetingAbility = null;
   if(Delve.castAbility(ab, G.px, G.py) !== false){
    Delve.enemiesTurn();
   }
  } else if(G.targetingAbility && G.targetingAbility.id === ab.id){
   G.targetingAbility = null;
   Delve.flash("Cancelled");
  } else {
   G.targetingAbility = ab;
   Delve.flash(ab.name + " — tap a target");
  }
  Delve.updateHUD();
  Delve.draw();
 }

 // ── FLOOR EVENT CARD (js/encounters.js) ──────────────────────
 // The engine owns placement, costs and effects. This only draws the choices
 // and closes the card once one is taken.
 function closeFloorEvent(){
  const el = $("eventScreen");
  if(el) el.style.display = "none";
 }
 Delve.closeFloorEvent = closeFloorEvent;

 Delve.showFloorEventCard = function(ev){
  const cfg = (Delve.CONFIG && Delve.CONFIG.FLOOR_EVENTS) || {};
  const def = (cfg.kinds || []).filter(function(k){ return k.id === ev.kind; })[0];
  if(!def) return;

  $("eventTitle").textContent = def.name || "Something waits";
  $("eventTitle").style.color = def.accent || "#ffd75e";
  $("eventFlavour").textContent = def.flavour || "";

  const wrap = $("eventOptions");
  wrap.innerHTML = "";
  (def.options || []).forEach(function(opt){
   const btn = document.createElement("button");
   btn.className = "event-option";
   btn.disabled = Delve.floorEventCanUse ? !Delve.floorEventCanUse(opt) : false;

   const label = document.createElement("div");
   label.className = "eo-label"; label.textContent = opt.label || "";
   const desc = document.createElement("div");
   desc.className = "eo-desc"; desc.textContent = opt.desc || "";
   btn.appendChild(label); btn.appendChild(desc);

   const cost = Delve.floorEventCost ? Delve.floorEventCost(opt) : { gold:0, hp:0 };
   if(cost.gold || cost.hp){
    const bits = [];
    if(cost.gold) bits.push("💰 " + cost.gold);
    if(cost.hp) bits.push("❤️ " + cost.hp);
    const c = document.createElement("div");
    c.className = "eo-cost"; c.textContent = bits.join("   ");
    btn.appendChild(c);
   }

   btn.addEventListener("click", function(){
    if(Delve.resolveFloorEvent && Delve.resolveFloorEvent(opt.id)){
     closeFloorEvent();
     Delve.updateHUD();
     Delve.draw();
    }
   });
   wrap.appendChild(btn);
  });

  if(Delve.sfx) Delve.sfx("secret");
  $("eventScreen").style.display = "flex";
 };

 // ── SHOP (screen only) ───────────────────────────────────────
 // Stock generation and pricing live in items.js
 // (Delve.makeShopStock / Delve.shopHealCost).
 Delve.openShop = function(){
  const G = Delve.G; if(!G) return;
  hideAll();
  if(!G.shop) G.shop = { x:-1, y:-1 };
  if(!G.shop.stock) G.shop.stock = Delve.makeShopStock(G);
  if(Delve.sfx) Delve.sfx("shop_open");
  $("shopScreen").style.display = "flex";
  Delve.buildShop();
 };

 Delve.buildShop = function(){
  const G = Delve.G;
  $("shopGold").textContent = G.gold;
  const goodsDisc = Delve.goodsDiscount ? Delve.goodsDiscount() : Delve.luckDiscount();
  $("shopGreeting").textContent = goodsDisc > 0
   ? "\"Lucky one, aren't you? Here's " + Math.round(goodsDisc*100) + "% off.\""
   : "\"Take a look. Everything's honestly priced.\"";
  const healCost = Delve.shopHealCost(G);
  const hb = $("shopHealBtn");
  // A shop stocks a limited number of heals (CONFIG.shop.healStock), so gold
  // buys sustain but cannot buy immortality. The button stays visible and reads
  // "sold out" when the stock is gone, rather than vanishing.
  const stock = Delve.shopHealStockLeft ? Delve.shopHealStockLeft(G) : 1;
  const healName = Math.round((Delve.CONFIG.shop.healPct || 0.5) * 100);
  hb.textContent = stock > 0
   ? "❤️ Restore " + healName + "% HP — " + healCost + "g (" + stock + " left)"
   : "❤️ No heals left in this shop";
  hb.disabled = stock <= 0 || G.gold < healCost || G.hp >= Delve.maxHp();
  // ── Buy side ──────────────────────────────────────────────
  // A shop row shows the ITEM, not just its name: tier, damage/armour, every
  // rolled stat with the same green/red delta the item card uses, and a
  // comparable price. It reuses Delve.itemStatLines() rather than re-deriving
  // stats here, so the shop can never drift out of step with the card.
  const wrap = $("shopStock");
  wrap.innerHTML = "";
  if(!G.shop.stock.length){
   const empty = document.createElement("div");
   empty.className = "si-desc"; empty.textContent = "Sold out.";
   wrap.appendChild(empty);
  }
  G.shop.stock.forEach(function(entry){
   const item = entry.item;
   const price = Delve.itemPrice(item);
   const row = document.createElement("div"); row.className = "shop-item";
   const info = document.createElement("div"); info.className = "si-info";

   const tierCol = Delve.TIERS.colors[item.tier] || "#fff";
   const tierName = Delve.TIERS.names[item.tier] || "";

   const nm = document.createElement("div"); nm.className="si-name";
   nm.style.color = tierCol; nm.textContent = item.name;

   const ds = document.createElement("div"); ds.className="si-desc";
   const slotName = (Delve.SLOT_NAME ? Delve.SLOT_NAME(item.slot) : item.slot) || "";
   ds.textContent = [tierName, slotName].filter(Boolean).join(" · ");

   info.appendChild(nm);
   if(item.baseName && item.baseName !== item.name){
    const bn = document.createElement("div"); bn.className="si-base";
    bn.textContent = item.baseName;
    info.appendChild(bn);
   }
   info.appendChild(ds);

   // Stat list, identical formatting to the item card.
   const stats = Delve.itemStatLines(item);
   if(stats.length){
    const box = document.createElement("div"); box.className = "si-stats";
    stats.forEach(function(l){
     const line = document.createElement("div"); line.className = "ic-stat-row";
     const lbl = document.createElement("span"); lbl.className="ic-stat-label";
     lbl.textContent = l.label;
     const val = document.createElement("span"); val.className="ic-stat-value";
     val.textContent = l.value;
     if(l.deltaText){ val.textContent += "  " + l.deltaText; }
     if(l.delta > 0){ val.style.color = "#7ee08a"; }
     else if(l.delta < 0){ val.style.color = "#ff9a9a"; }
     line.appendChild(lbl); line.appendChild(val);
     box.appendChild(line);
    });
    info.appendChild(box);
   }
   if(item.lore || item.flavour){
    const fl = document.createElement("div"); fl.className = "si-flavour";
    fl.textContent = item.lore || item.flavour;
    info.appendChild(fl);
   }

   // Buttons: Buy, and Equip for anything wearable that is better than what is
   // worn. Equipping straight from the shop mirrors the floor card.
   const btns = document.createElement("div"); btns.className = "si-btns";
   const buy = document.createElement("button"); buy.className="btn shop-buy";
   buy.textContent = entry.sold ? "Sold" : price + "g";
   buy.disabled = entry.sold || G.gold < price;
   buy.addEventListener("click", function(){
    if(entry.sold || G.gold<price) return;
    if(G.inventory.length >= (Delve.inventoryCap?Delve.inventoryCap():Delve.CONFIG.inventorySlots)){ Delve.flash("Bag is full!"); if(Delve.sfx) Delve.sfx("deny"); return; }
    G.gold -= price;
    entry.sold = true;
    Delve.recordStat("goldSpentShop", price);
    if(Delve.sfx) Delve.sfx("buy");
    const bought = Object.assign({}, item);
    Delve.stampProvenance(bought, { kind:"shop" });
    Delve.pickupItem(bought);
    Delve.updateHUD();
    Delve.buildShop();
   });
   btns.appendChild(buy);

   const wearable = item.slot && item.slot !== "consumable";
   if(wearable && !entry.sold){
    const eq = document.createElement("button"); eq.className="btn shop-equip";
    eq.textContent = "Equip";
    eq.addEventListener("click", function(){
     if(entry.sold || G.gold < price) return;
     G.gold -= price;
     entry.sold = true;
     Delve.recordStat("goldSpentShop", price);
     if(Delve.sfx) Delve.sfx("buy");
     const bought = Object.assign({}, item);
     Delve.stampProvenance(bought, { kind:"shop" });
     // equipItem returns whatever it replaced to the bag, so equipping costs no
     // inventory space — same rule as the floor card's Equip button.
     Delve.equipItem(bought);
     Delve.updateHUD();
     Delve.buildShop();
    });
    btns.appendChild(eq);
   }

   row.appendChild(info); row.appendChild(btns);
   wrap.appendChild(row);
  });

  // ── Sell carried (design 5.8): salvage at 4 gold per point ──
  const sellWrap = $("shopSellList");
  if(sellWrap){
   sellWrap.innerHTML = "";
   const inv = G.inventory || [];
   if(!inv.length){
    const empty = document.createElement("div");
    empty.className = "si-desc";
    empty.textContent = "Nothing carried to sell.";
    sellWrap.appendChild(empty);
   }
   inv.forEach(function(item){
    const value = Delve.sellValue(item);
    const row = document.createElement("div"); row.className = "shop-item";
    const info = document.createElement("div"); info.className = "si-info";
    const nm = document.createElement("div"); nm.className = "si-name";
    nm.style.color = Delve.TIERS.colors[item.tier] || "#fff";
    nm.textContent = item.name;
    const ds = document.createElement("div"); ds.className = "si-desc";
    ds.textContent = (Delve.TIERS.names[item.tier] || "") +
     (Delve.SLOT_NAME && item.slot ? " · " + Delve.SLOT_NAME(item.slot) : "") +
     (typeof item.points === "number" ? " · " + item.points + " pts" : "");
    info.appendChild(nm); info.appendChild(ds);
    // The sell list shows the same stat lines as the buy side, so the player can
    // see what they would be giving up before pressing Sell.
    const stats = Delve.itemStatLines(item);
    if(stats.length){
     const box = document.createElement("div"); box.className = "si-stats";
     stats.forEach(function(l){
      if(l.label === "Quality") return;   // already in the line above
      const line = document.createElement("div"); line.className = "ic-stat-row";
      const lbl = document.createElement("span"); lbl.className="ic-stat-label"; lbl.textContent = l.label;
      const val = document.createElement("span"); val.className="ic-stat-value"; val.textContent = l.value;
      if(l.deltaText){ val.textContent += "  " + l.deltaText; }
      if(l.delta > 0){ val.style.color = "#7ee08a"; }
      else if(l.delta < 0){ val.style.color = "#ff9a9a"; }
      line.appendChild(lbl); line.appendChild(val);
      box.appendChild(line);
     });
     info.appendChild(box);
    }
    const sell = document.createElement("button");
    sell.className = "btn shop-buy";
    sell.textContent = "Sell " + value + "g";
    sell.addEventListener("click", function(){
     if(Delve.sellItem(item) > 0){
      if(Delve.sfx) Delve.sfx("buy");
      Delve.buildShop();
     }
    });
    row.appendChild(info); row.appendChild(sell);
    sellWrap.appendChild(row);
   });
   const all = $("shopSellAll");
   if(all){
    all.disabled = !inv.length;
    all.textContent = inv.length
     ? "Sell all carried (" + inv.length + ")"
     : "Sell all carried";
   }
  }
 };

 function closeShop(){
  $("shopScreen").style.display = "none";
  Delve.setHudVisible(true);
  Delve.updateHUD();
  Delve.draw();
 }
 function doShopHeal(){
  const G = Delve.G;
  const cost = Delve.shopHealCost(G);
  if(Delve.shopHealStockLeft && Delve.shopHealStockLeft(G) <= 0) return;
  if(G.gold < cost || G.hp >= Delve.maxHp()) return;
  G.gold -= cost;
  if(Delve.spendShopHeal) Delve.spendShopHeal(G);
  const heal = Math.round(Delve.maxHp()*Delve.CONFIG.shop.healPct*(Delve.healMult ? Delve.healMult() : 1));
  G.hp = Math.min(Delve.maxHp(), G.hp+heal);
  Delve.recordStat("goldSpentShop", cost);
  if(Delve.sfx) Delve.sfx("potion");
  Delve.flash("+" + heal + " HP");
  Delve.updateHUD();
  Delve.buildShop();
 }

 // ── VICTORY / END SCREENS ────────────────────────────────────
 function summaryRows(){
  const s = (Delve.G && Delve.G.runStats) || {};
  const rows = [
   ["Floors reached", Delve.G ? Delve.G.floor : 0],
   ["Kills", s.kills || 0],
   ["Elites slain", s.elitesKilled || 0],
   ["Gold earned", s.goldEarned || 0],
   ["Gold spent", s.goldSpentShop || 0],
   ["Gold from sales", s.goldFromSales || 0],
   ["Barrels smashed", s.barrelsSmashed || 0],
   ["Consumables used", s.consumablesUsed || 0],
   ["Shards this run", Delve.G ? Delve.G.runShards : 0]
  ];
  return rows.map(function(r){
   return '<div class="death-row"><span class="dr-label">'+r[0]+'</span><span class="dr-value">'+r[1]+'</span></div>';
  }).join("");
 }

 Delve.showVictory = function(shards, canContinue, opts){
  hideAll();
  $("victoryShards").textContent = shards || 0;
  $("victorySummary").innerHTML = summaryRows().replace(/death-row/g,"victory-row").replace(/dr-label/g,"vr-label").replace(/dr-value/g,"vr-value");

  // Ward clear vs. finishing the game. `canContinue === false` means there is no
  // deeper ward, i.e. this was the last one — so the screen changes from "a ward
  // cleared, onward" to "the dungeon is done". The old text was static HTML
  // saying "The Warden lies broken at your feet. The way deeper yawns open.",
  // which is wrong after the Forge Titan on both counts.
  // Per-ward cleared text (CONFIG.WARDS[n].cleared). Each ward has its own
  // heading, boss name and closing paragraph, so four clears do not read as the
  // same screen four times. Falls back to the generic copy if a ward has no
  // `cleared` block, so adding a ward can never break the screen.
  const wardIdx = opts && opts.wardIdx;
  const wards = (Delve.CONFIG && Delve.CONFIG.WARDS) || [];
  const ward = (wardIdx && wards.filter(function(w){ return w.id === wardIdx; })[0]) || null;
  const cl = (ward && ward.cleared) || null;

  const finished = (canContinue === false);
  const titleEl = $("victoryTitle");
  const subEl = $("victorySub");

  const heading = cl ? cl.heading : (finished ? "THE DEEPEST WARD IS SILENT" : "WARD CLEARED");
  if(titleEl) titleEl.textContent = heading;

  const bodyEl = $("victoryBody");
  if(bodyEl){
   // The body is the ward's own paragraph; the generic line is only a fallback.
   bodyEl.textContent = cl ? cl.body : (opts && opts.sub) || "The way deeper yawns open.";
   bodyEl.style.display = "";
  }
  if(subEl) subEl.textContent = cl ? ("— " + cl.boss) : "";

  // Tint the screen with the ward's own accent, so each clear has its own colour
  // signature (violet ruins, cyan vault, ember forge).
  // Guard the CSS-variable calls: setProperty/removeProperty exist on a real
  // CSSStyleDeclaration but not on every stub (and older WebViews). A missing
  // accent is cosmetic; throwing here would take down the whole victory screen.
  const scr = $("victoryScreen");
  if(scr && scr.style && typeof scr.style.setProperty === "function"){
   if(cl && cl.accent) scr.style.setProperty("--ward-accent", cl.accent);
   else if(typeof scr.style.removeProperty === "function") scr.style.removeProperty("--ward-accent");
  }
  const badge = $("victoryBadge");
  if(badge){
   if(ward){ badge.textContent = "WARD " + ward.id + " · " + ward.name.toUpperCase(); badge.style.display = ""; }
   else badge.style.display = "none";
  }
  // The "Return to Hub" button reads differently once the run is over.
  const hubBtn = $("victoryHub");
  if(hubBtn) hubBtn.textContent = finished ? "Return to the surface" : "Return to Hub";

  const contBtn = $("victoryContinue");
  if(contBtn) contBtn.style.display = finished ? "none" : "";
  $("victoryScreen").style.display = "flex";
 };

 // ── HEIRLOOM PICKER (death screen) ───────────────────────────
 // On death only. Up to ten of the best-carried non-consumables are offered;
 // picking one stores it in the save (js/items.js) and it arrives in the bag at
 // the start of the next run. Skipping is just the normal BACK TO HUB button.
 function hideHeirloomPicker(){
  const box = $("heirloomBox");
  if(box) box.style.display = "none";
 }

 function renderHeirloomPicker(){
  const G = Delve.G;
  const box = $("heirloomBox"), list = $("heirloomList");
  if(!G){ hideHeirloomPicker(); return; }

  const pool = [];
  (G.inventory || []).forEach(function(it){
   if(it && it.slot !== "consumable" && pool.indexOf(it) < 0) pool.push(it);
  });
  Object.keys(G.equip || {}).forEach(function(slot){
   const it = G.equip[slot];
   if(it && it.slot !== "consumable" && pool.indexOf(it) < 0) pool.push(it);
  });
  if(!pool.length){ hideHeirloomPicker(); return; }

  if(Delve.itemPoints){
   pool.sort(function(a, b){ return Delve.itemPoints(b) - Delve.itemPoints(a); });
  }

  list.innerHTML = "";
  pool.slice(0, 10).forEach(function(it){
   const btn = document.createElement("button");
   btn.className = "heirloom-item";
   btn.style.color = (Delve.TIERS.colors[it.tier] || "#e8eef5");
   btn.textContent = (Delve.TIERS.names[it.tier] || "") + " · " + it.name;
   btn.addEventListener("click", function(){
    if(Delve.setHeirloom && Delve.setHeirloom(it)){
     list.innerHTML = "";
     const done = document.createElement("div");
     done.className = "heirloom-item";
     done.style.color = "#7ee08a";
     done.textContent = "Kept: " + it.name;
     list.appendChild(done);
    }
   });
   list.appendChild(btn);
  });
  if(box) box.style.display = "flex";
 }

 Delve.showEndScreen = function(kind, extra){
 // death or retreat: the run is over, so there is nothing left to resume (§6.12)
 Delve.clearRunCheckpoint();
  hideAll();
  $("levelupScreen").style.display = "none";
  const title = $("deathScreen").querySelector("h1");
  if(kind === "victory"){ Delve.showVictory((extra&&extra.shards)||0, (extra&&extra.canContinue!==false)); return; }
  if(kind === "retreat"){
   title.textContent = "ESCAPED";
   $("deathInfo").textContent = "You climbed back to the surface.";
   $("deathQuote").textContent = "Some runs are measured in what you carry out.";
   $("deathShards").textContent = "+" + ((extra&&extra.shards)||0) + " shards banked";
  } else {
   title.textContent = "YOU DIED";
   $("deathInfo").textContent = "You reached floor " + Delve.G.floor + " — best " + Delve.save.bestFloor;
   $("deathQuote").textContent = DEATH_QUOTES[Math.floor(Math.random()*DEATH_QUOTES.length)];
   $("deathShards").textContent = "+" + Delve.G.runShards + " shards this run";
  }
  $("deathSummary").innerHTML = summaryRows();
  // Death offers one keepsake; retreating does not (you carried the bag out).
  if(kind === "retreat") hideHeirloomPicker();
  else renderHeirloomPicker();
  $("deathScreen").style.display = "flex";
 };

 // ── DEBUG PANEL ──────────────────────────────────────────────
 function applyDebugEffect(id){
  return function(){
   const G = Delve.G; if(!G) return;
   let t = null;
   if(G.boss && Delve.mdist(G.boss.x,G.boss.y,G.px,G.py)<=1) t = G.boss;
   else t = G.monsters.find(function(m){ return Delve.mdist(m.x,m.y,G.px,G.py)<=1; }) || G.monsters[0];
   if(t && Delve.applyEffect){ Delve.applyEffect(t, id); Delve.flash(id + " applied"); }
   else Delve.flash("No target");
   Delve.updateHUD(); Delve.draw();
  };
 }

 Delve.initDebug = function(){
  const p = $("debugPanel"); if(!p) return;
  p.style.display = "flex";
  const need = function(){ return Delve.G && !Delve.G.runEnded; };

  (function fillFloorSelect(){
   const sel = $("dbgFloor"); if(!sel) return;
   sel.innerHTML = "";
   (Delve.CONFIG.WARDS || []).forEach(function(w){
    const lo = w.floors[0], hi = w.floors[1];
    for(let f = lo; f <= hi; f++){
     const o = document.createElement("option");
     o.value = f;
     let label = "Floor " + f;
     if(f % 10 === 0) label += " (boss — " + w.name + ")";
     else if(Delve.isShopFloor && Delve.isShopFloor(f)) label += " (shop)";
     if(f >= 11 && f <= 19) label += " (swarm/cluster pool)";
     o.textContent = label;
     sel.appendChild(o);
    }
   });
   sel.value = (Delve.G && Delve.G.floor) || 1;
  })();

  $("dbgGo").addEventListener("click", function(){
   if(!need()) return;
   Delve.G.floor = parseInt($("dbgFloor").value,10);
   Delve.setFloorCheckpoint();   // a debug jump is a floor entry too (§6.12)
   Delve.genFloor(); Delve.updateHUD(); Delve.draw();
   Delve.showFloorCard(Delve.G.floor);
  });

  $("dbgGold").addEventListener("click", function(){ if(!need()) return; Delve.G.gold += 25; Delve.updateHUD(); });
  $("dbgShards").addEventListener("click", function(){ Delve.save.shards += 5; Delve.persist(); Delve.updateHUD(); });
  $("dbgHeal").addEventListener("click", function(){ if(!need()) return; Delve.G.hp = Delve.maxHp(); Delve.updateHUD(); });
  $("dbgLowHp").addEventListener("click", function(){ if(!need()) return; Delve.G.hp = 5; Delve.updateHUD(); });

  $("dbgPoison").addEventListener("click", applyDebugEffect("poison"));
  $("dbgBleed").addEventListener("click", applyDebugEffect("bleed"));
  $("dbgBurn").addEventListener("click", applyDebugEffect("burn"));
  $("dbgWeaken").addEventListener("click", function(){ if(!need()) return; if(Delve.applyPlayerEffect) Delve.applyPlayerEffect("weaken"); Delve.flash("Weaken applied (you)"); });

  $("dbgElite").addEventListener("click", function(){
   if(!need()) return;
   const m = Delve.G.monsters.find(function(x){ return !x.elite; });
   if(m){ Delve.makeElite(m); Delve.draw(); Delve.flash("Elite created"); }
   else Delve.flash("No monster to promote");
  });

  $("dbgXP").addEventListener("click", function(){ if(!need()) return; Delve.addXP(20); });
  $("dbgShop").addEventListener("click", function(){ if(!need()) return; Delve.openShop(); });
  $("dbgVictory").addEventListener("click", function(){
   if(!need()) return;
   Delve.triggerVictory(Math.ceil(Delve.G.floor / 10));
  });
  $("dbgDeath").addEventListener("click", function(){ if(!need()) return; Delve.die(); });

  $("dbgRender").addEventListener("click", function(){
   if(!Delve.G) return;
   Delve.genFloor(); Delve.updateHUD(); Delve.draw();
   Delve.showFloorCard(Delve.G.floor);
  });
  $("dbgDump").addEventListener("click", function(){
   console.log("RUN STATS", Delve.G && Delve.G.runStats);
   console.log("SAVE", Delve.save);
   Delve.flash("Dumped to console");
  });
  $("dbgReset").addEventListener("click", function(){
   Object.keys(localStorage).forEach(function(k){ if(/underward|delve/i.test(k)) localStorage.removeItem(k); });
   location.reload();
  });
 };

 // ── WIRING ───────────────────────────────────────────────────
 $("startBtn").addEventListener("click", function(){
  // With a run parked, this button carries the player back into it (§6.12.2).
  if(Delve.runInProgress && Delve.runInProgress() && Delve.resumeRun){ Delve.resumeRun(); return; }
  Delve.startRun();
 });
 $("deathBtn").addEventListener("click", Delve.showHub);
 $("hubTitleBtn").addEventListener("click", function(){
  if(Delve.showTitle) Delve.showTitle(); else Delve.showHub();
 });

 // One entry point for the map panel, so the button's lit state can never drift
 // from what is on screen. It used to toggle the panel silently, which read as
 // "the button did nothing" when the panel opened over a dark tile.
 Delve.setMinimapOpen = function(open){
  const w = $("minimapWrap"), btn = $("minimapBtn");
  if(w) w.style.display = open ? "block" : "none";
  if(btn) btn.classList.toggle("active", !!open);
  if(open && Delve.renderMinimap) Delve.renderMinimap();   // render.js
  return !!open;
 };
 $("minimapBtn").addEventListener("click", function(){
  Delve.setMinimapOpen(getComputedStyle($("minimapWrap")).display === "none");
 });

 $("gearBtn").addEventListener("click", function(){
  if(Delve.G && !Delve.G.runEnded){
   // Name the floor in the save button while the name is accurate (§6.12).
   $("pauseSaveBtn").textContent = "💾 Save floor " + Delve.G.floor + " & exit";
   $("pauseMenu").style.display = "flex";
  }
 });
 $("pauseCloseBtn").addEventListener("click", function(){ $("pauseMenu").style.display = "none"; });
 $("pauseSaveBtn").addEventListener("click", function(){
  $("pauseMenu").style.display = "none";
  Delve.saveAndExit();   // combat.js: keeps the run and its floor, banks nothing (§6.12)
 });
 $("pauseRetreatBtn").addEventListener("click", function(){
  $("pauseMenu").style.display = "none";
  Delve.retreat();
 });
 $("muteBtn").addEventListener("click", function(){
  const muted = Delve.sfxToggleMute ? Delve.sfxToggleMute() : false;
  $("muteBtn").textContent = muted ? "🔇" : "🔊";
 });
 $("volumeSlider").addEventListener("input", function(){
  if(Delve.sfxSetVolume) Delve.sfxSetVolume(parseFloat(this.value));
 });
 $("musicSlider").addEventListener("input", function(){
  if(Delve.musicSetVolume) Delve.musicSetVolume(parseFloat(this.value));
 });
 $("hapticsBtn").addEventListener("click", function(){
  const on = Delve.sfxGetHaptics ? !Delve.sfxGetHaptics() : false;
  if(Delve.sfxSetHaptics) Delve.sfxSetHaptics(on);
  $("hapticsBtn").textContent = on ? "ON" : "OFF";
 });
 // Sync controls to persisted audio prefs on load.
 if(Delve.sfxGetVolume) $("volumeSlider").value = Delve.sfxGetVolume();
 if(Delve.musicGetVolume) $("musicSlider").value = Delve.musicGetVolume();
 if(Delve.sfxGetHaptics) $("hapticsBtn").textContent = Delve.sfxGetHaptics() ? "ON" : "OFF";
 if(Delve.sfxMuted) $("muteBtn").textContent = Delve.sfxMuted() ? "🔇" : "🔊";

 $("shopHealBtn").addEventListener("click", doShopHeal);
 $("shopLeaveBtn").addEventListener("click", closeShop);
 $("eventLeaveBtn").addEventListener("click", closeFloorEvent);

 // Sell-all is a two-tap action: the first tap arms it, the second sells. No
 // browser confirm() on mobile, and no accidental wipe of a full bag.
 $("shopSellAll").addEventListener("click", function(){
  const G = Delve.G;
  if(!G || !(G.inventory || []).length) return;
  const btn = this;
  if(btn.dataset.armed !== "1"){
   btn.dataset.armed = "1";
   btn.textContent = "Tap again to sell all";
   setTimeout(function(){
    if(!btn.dataset || btn.dataset.armed !== "1") return;
    btn.dataset.armed = "";
    if(Delve.G === G && Delve.buildShop) Delve.buildShop();
   }, 3000);
   return;
  }
  btn.dataset.armed = "";
  const r = Delve.sellAll();
  if(Delve.sfx) Delve.sfx("buy");
  Delve.flash("Sold " + r.count + " for " + r.gold + "g");
  Delve.updateHUD();
  Delve.buildShop();
 });

 $("victoryContinue").addEventListener("click", function(){
  hideAll();
  Delve.setHudVisible(true);
  const G = Delve.G;
  G.victoryDone = false;
  G.secondWindUsed = false;
  Delve.descend();
  Delve.updateHUD();
  Delve.draw();
  Delve.showFloorCard(G.floor);
 });
 $("victoryHub").addEventListener("click", function(){
  const G = Delve.G;
  // Leaving the dungeon is the ONLY place gold becomes shards (design L11).
  // triggerVictory no longer converts, because the player may descend instead.
  if(G && !G.runEnded && Delve.convertGold){
   Delve.convertGold();
   if(Delve.bankRunShards) Delve.bankRunShards();
  }
  if(G) G.runEnded = true;
  Delve.clearRunCheckpoint();   // the run is abandoned from here, not paused (§6.12)
  Delve.showHub();
 });

 if(/[?&]debug=1/.test(location.search)) Delve.initDebug();

 // ── Android back button contract ───────────────────────────
 // The native shell calls this and reads the returned string. "exit" means the
 // system may close the app; anything else means the game consumed the press.
 // Order matters: dismiss the topmost thing first, and never drop a live run
 // straight to the launcher.
 Delve.handleAndroidBack = function(){
  const G = Delve.G;
  const open = function(id){ const el = $(id); return el && el.style.display !== "none"; };

  // 1. A card or overlay is on top: close just that.
  if(open("itemCardOverlay")){ closeItemCard(); return "consumed"; }
  if(open("statsOverlay")){ Delve.closeStats(); return "consumed"; }
  if(open("logWindow")){ $("logWindow").style.display = "none"; return "consumed"; }
  if(open("pauseMenu")){ $("pauseMenu").style.display = "none"; return "consumed"; }
  if(open("inventoryScreen")){ $("inventoryScreen").style.display = "none"; return "consumed"; }
  if(open("stairsPrompt")){ $("stairsPrompt").style.display = "none"; return "consumed"; }
  if(open("shopScreen")){ $("shopScreen").style.display = "none"; return "consumed"; }

  // 2. Title or hub: nothing to protect, so back may leave the app.
  if(open("titleScreen") || open("hubScreen")) return "exit";

  // 3. A live run: open the pause menu rather than quitting mid-floor.
  if(G && !G.runEnded && G.hp > 0){
   $("gearBtn").click();
   return "consumed";
  }

  // 4. End screens: back returns to the hub.
  if(open("deathScreen") || open("victoryScreen")){
   if(Delve.showHub) Delve.showHub();
   return "consumed";
  }
  return "exit";
 };

 Delve.showHub();

})();
