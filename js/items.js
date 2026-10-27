window.Delve = window.Delve || {};
(function(){

 // items.js : item LOGIC only. Catalogue lives in js/content/con-items.js.
 // Depends on: Delve.itemDefs, Delve.potionDefs, Delve.TIERS, Delve.SLOT_DEFS.
 // Also owns shop STOCK GENERATION and shop HEAL PRICING (moved here from
 // ui.js — item-pool selection is item-domain logic, not screen logic).

 const SLOT_DEFS = function(){ return Delve.SLOT_DEFS || {}; };

 function statusName(id){
 const s = Delve.CONFIG.STATUS_EFFECTS && Delve.CONFIG.STATUS_EFFECTS[id];
 return s ? s.name : id;
 }

 Delve.itemsByTier = function(tier){
 return Object.keys(Delve.itemDefs || {}).map(function(k){ return Delve.itemDefs[k]; })
 .filter(function(d){ return d.tier === tier; });
 };

 Delve.wardOf = function(floor){
 const f = Number(floor);
 return Math.max(1, Math.ceil((isFinite(f) && f > 0 ? f : 1) / 10));
 };

 // ══════════════════════════════════════════════════════════════
 //  CONTINUOUS-QUALITY ITEM GENERATION (docs/results/items_overhaul.md)
 //  One budget of POINTS decides an item's power. Quality sets the
 //  budget, the slot decides which stats spend it, affixes carve a slice
 //  out of it. Nothing is added on top, so two items of equal quality are
 //  worth the same whichever stats they carry.
 // ══════════════════════════════════════════════════════════════
 const IT = function(){ return (Delve.CONFIG && Delve.CONFIG.ITEMS) || {}; };
 const FAM = function(style){
  const t = (Delve.CONFIG && Delve.CONFIG.WEAPON_FAMILIES) || {};
  return t[style] || t.sword;
 };
 function gauss(){
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
 }

 // Q = min(cap, 2.5*floor + 3*Luck) + noise, sigma = 5 + 0.3*floor
 Delve.qualityOf = function(floor, luck){
  const q = IT().quality || {};
  const f = Math.max(0, Number(floor) || 0);
  const L = Math.max(0, Number(luck) || 0);
  const mean = Math.min(q.cap || 100, (q.floorScale || 2.5) * f + (q.luckScale || 3) * L);
  const sigma = (q.noiseBase || 5) + (q.noiseFloor || 0.3) * f;
  return Math.max(1, Math.min(q.cap || 100, Math.round(mean + gauss() * sigma)));
 };

 // Display band only. tier stays 1-4 so colours / status tables / sfx keep working.
 Delve.bandOf = function(quality){
  const b = IT().bands || [20, 40, 60];
  const q = Number(quality) || 1;
  if(q < b[0]) return 1;
  if(q < b[1]) return 2;
  if(q < b[2]) return 3;
  return 4;
 };

 Delve.pointsOfQuality = function(quality){
  const per = (IT().quality || {}).perPoint || 0.2;
  return Math.max(0.5, (Number(quality) || 1) * per);
 };

 // Fraction stats are stored as fractions but costed per whole percent.
 const PCT_STATS = { crit:1, dodge:1, speed:1, goldBonus:1, dropBonus:1 };

 // What one stat point is worth, in points. Inverse of the generation below.
 Delve.statPoints = function(stat, value){
  const c = (IT().pointCost || {})[stat];
  if(!c || !value) return 0;
  return (PCT_STATS[stat] ? value * 100 : value) * c;
 };

 // A weapon's budget buys its own average hit: avg = P/2, so itemMax*(1+shape)/2 = P/2.
 Delve.itemPoints = function(item){
  if(!item) return 0;
  if(item.unique){
   let p = 0;
   Object.keys(item).forEach(function(k){ p += Delve.statPoints(k, item[k]); });
   if(item.itemMax){
    const sh = Number(item.shape) || FAM(item.style).shape || 0.65;
    const sp = Number(item.speed) || FAM(item.style).speed || 1.0;
    p += item.itemMax * (1 + sh) * sp;
   }
   return Math.round(p * 100) / 100;
  }
  if(typeof item.points === "number") return item.points;
  let p = 0;
  ["atk","str","hp","crit","red","dodge","speedBonus","luck","goldBonus","dropBonus","bossAtk","shardBonus","healOnKill"].forEach(function(k){
   const v = item[k];
   if(!v) return;
   const stat = k === "speedBonus" ? "speed" : k;
   p += Delve.statPoints(stat, v);
  });
  if(item.itemMax){
   const sh = Number(item.shape) || FAM(item.style).shape || 0.65;
   const sp = Number(item.speed) || FAM(item.style).speed || 1.0;
   p += item.itemMax * (1 + sh) * sp;
  }
  return Math.round(p * 100) / 100;
 };

 // Slot first, then the item inside it (L5) - pool size can no longer bias drops.
 Delve.rollSlot = function(){
  const w = IT().slotWeights || {};
  const keys = Object.keys(w);
  let total = 0;
  keys.forEach(function(k){ total += Math.max(0, Number(w[k]) || 0); });
  if(total <= 0) return "weapon";
  let r = Math.random() * total;
  for(let i = 0; i < keys.length; i++){
   r -= Math.max(0, Number(w[keys[i]]) || 0);
   if(r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
 };

 // Base definitions for a slot, nearest tier first (so a Rare floors 20+ gets a
 // Rare name, but a thin slot still finds something).
 function basesForSlot(slot, tier){
  const slotKey = slot === "ring" ? "ring" : slot;
  const all = Object.keys(Delve.itemDefs || {}).map(function(k){ return Delve.itemDefs[k]; })
   .filter(function(d){ return d.slot === slotKey; });
  if(!all.length) return [];
  const near = all.filter(function(d){ return d.tier === tier; });
  if(near.length) return near;
  let best = all[0].tier, bestDist = 99;
  all.forEach(function(d){ const dist = Math.abs(d.tier - tier); if(dist < bestDist){ bestDist = dist; best = d.tier; } });
  return all.filter(function(d){ return d.tier === best; });
 }

 function pickBase(slot, tier){
  const pool = basesForSlot(slot, tier);
  if(!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
 }

 // ── Affixes ───────────────────────────────────────────────────
 const STAT_LABEL = {
  atk:"Attack Power", str:"Strength", hp:"Maximum Health", crit:"Critical Chance",
  red:"Damage Reduction", dodge:"Dodge Chance", speed:"Attack Speed", luck:"Luck",
  goldBonus:"Gold Find", dropBonus:"Item Find", bossAtk:"Damage vs Ward Bosses",
  shardBonus:"Bonus Shards", healOnKill:"Life Steal on Kill",
  poison:"Poison", bleed:"Bleed", burn:"Burn"
 };

 Delve.affixText = function(a){
  if(!a) return "";
  if(a.stat.indexOf("status:") === 0){
   const s = a.stat.split(":")[1];
   return "+" + Math.round(a.per * 100) + "% " + (STAT_LABEL[s] || s) + " Chance";
  }
  const label = STAT_LABEL[a.stat] || a.stat;
  const v = PCT_STATS[a.stat] ? Math.round(a.per * 1000) / 10 + "%" : (Math.round(a.per * 10) / 10);
  return "+" + v + " " + label;
 };

 function slotGroup(slot){
  if(slot === "weapon") return "weapon";
  if(slot === "ring" || slot === "amulet") return "accessory";
  if(slot === "offhand") return "offhand";
  return "armour";
 }
 function affixPool(kind, slot){
  const g = slotGroup(slot);
  const list = (Delve.ITEM_AFFIXES || {})[kind] || [];
  return list.filter(function(a){
   if(a.group.indexOf(g) >= 0) return true;
   return g === "offhand" && a.group.indexOf("armour") >= 0;
  });
 }
 function applyAffix(item, a){
  if(a.stat.indexOf("status:") === 0){
   item.status = a.stat.split(":")[1];
   item.statusBonus = (item.statusBonus || 0) + a.per;
   return;
  }
  const key = a.stat === "speed" ? "speedBonus" : a.stat;
  item[key] = (item[key] || 0) + a.per;
 }

 // Affix count comes from the display band; the points come out of the budget.
 Delve.rollAffixes = function(slot, band, budget){
  const cfg = IT().affixes || {};
  const want = cfg[band] || 0;
  if(!want) return [];
  const out = [], used = {};
  let pre = 0, suf = 0, spent = 0, guard = 0;
  while(out.length < want && guard++ < 40){
   let kind = (pre < (cfg.maxPrefix || 1) && Math.random() < 0.55) ? "prefixes" : "suffixes";
   if(kind === "prefixes" && pre >= (cfg.maxPrefix || 1)) kind = "suffixes";
   if(kind === "suffixes" && suf >= (cfg.maxSuffix || 2)) kind = "prefixes";
   const pool = affixPool(kind, slot).filter(function(a){
    return !used[a.stat] && spent + a.pts <= budget * 0.40;
   });
   if(!pool.length) break;
   const a = pool[Math.floor(Math.random() * pool.length)];
   used[a.stat] = 1;
   spent += a.pts;
   out.push(a);
   if(kind === "prefixes") pre++; else suf++;
  }
  return out;
 };

 // Name: prefixes + base + suffixes ("Heavy Keen Shortsword of the Fox").
 Delve.affixName = function(baseName, affixes){
  const pre = [], suf = [];
  (affixes || []).forEach(function(a){
   if(a.name.indexOf("of ") === 0) suf.push(a.name);
   else pre.push(a.name);
  });
  let n = baseName;
  if(pre.length) n = pre.join(" ") + " " + n;
  if(suf.length) n = n + " " + suf.join(" ");
  return n;
 };

 // Spend points on a stat. Fractions are stored as fractions (0.01 = 1%).
 function addStat(item, stat, points){
  const c = (IT().pointCost || {})[stat];
  if(!c || points <= 0) return;
  const value = PCT_STATS[stat] ? points / (c * 100) : points / c;
  if(stat === "speed") item.speedBonus = (item.speedBonus || 0) + value;
  else item[stat] = (item[stat] || 0) + value;
 }

 // ── The generator ─────────────────────────────────────────────
 // makeGear(slot, floor, {tier, qualityBonus, luck}) -> a complete item.
 // Every field an old item had still exists, so the rest of the game is
 // unchanged: tier, atk, hp, red, crit, dodge, luck, status, style, lore.
 Delve.makeGear = function(slot, floor, opts){
  opts = opts || {};
  if(!slot) slot = Delve.rollSlot();
  const fl = (floor === undefined || floor === null) ? ((Delve.G && Delve.G.floor) || 1) : floor;
  const luck = (opts.luck === undefined) ? (Delve.luckPts ? Delve.luckPts() : 1) : opts.luck;
  let quality = Delve.qualityOf(fl, luck);
  if(opts.qualityBonus) quality = Math.min(100, quality + opts.qualityBonus);
  const band = Delve.bandOf(quality);
  const wantedTier = opts.tier || band;
  const base = pickBase(slot, wantedTier) || { id:"scrap_" + slot, name:"Scrap", slot:slot, tier:band };
  const P = Delve.pointsOfQuality(quality);

  const item = {
   id: base.id, baseId: base.id, baseName: base.name, name: base.name,
   slot: base.slot, tier: band, quality: quality, points: P,
   lore: base.lore, flavour: base.flavour, affixes: []
  };
  if(base.keep) item.keep = true;
  if(base.slot === "weapon"){
   item.style = opts.style || base.style || "sword";
   const fam = FAM(item.style);
   item.shape = fam.shape;
   item.strCeiling = fam.strCeiling;
   if(fam.critBonus) item.crit = fam.critBonus;
  }
  if(base.status) item.status = base.status;

  const affixes = Delve.rollAffixes(base.slot, band, P);
  let affixPts = 0;
  affixes.forEach(function(a){
   applyAffix(item, a);
   affixPts += a.pts;
   item.affixes.push({ id:a.id, name:a.name, stat:a.stat, value:a.per, pts:a.pts, text: Delve.affixText(a) });
  });
  const basePts = Math.max(P * 0.2, P - affixPts);

  if(base.slot === "weapon"){
   const wPts = basePts * (IT().weaponShare || 1);
   // Points buy DPS, not average hit: an ATK point is one damage on a SWORD
   // swing (1.67 hits/s). A dagger must hit for less per swing, a hammer more,
   // or the family speeds would break parity.
   //   avg = (P/2) * (swordSpeed / familySpeed)  and  avg = itemMax*(1+shape)/2
   const famSpeed = FAM(item.style).speed || 1.0;
   const strNow = Delve.strPts ? Delve.strPts() : 6;
   const strTerm = Math.min(strNow, item.strCeiling);
   // Strength now shifts the whole band (attrs.js weaponBand), so it is not
   // subtracted from the budget - a point still buys the same DPS in any family.
   const critAdj = 1 + (FAM(item.style).critBonus || 0) * 0.5;
   // The band carries a speed-normalised Strength lift, so it comes out of the
   // budget first: a weapon never sells the same point twice.
   const raw = (wPts / famSpeed / critAdj - strTerm / famSpeed) / (1 + item.shape);
   item.itemMax = Math.round(Math.max(0.1, raw) * 10) / 10;
  } else {
   const aff = (Delve.SLOT_AFFINITY || {})[base.slot] || { hp:0.6, red:0.4 };
   Object.keys(aff).forEach(function(stat){ addStat(item, stat, basePts * aff[stat]); });
   // one decimal is plenty for display; keep the maths honest
   ["atk","hp","red","luck","crit","dodge","speedBonus","goldBonus","dropBonus","bossAtk","shardBonus","healOnKill"].forEach(function(k){
    if(typeof item[k] === "number") item[k] = Math.round(item[k] * 100) / 100;
   });
  }

  item.name = Delve.affixName(base.name, item.affixes);
  item.points = Math.round(P * 10) / 10;
  item.provenance = item.provenance || null;
  return item;
 };

 // A unique: fixed stats, never budget-scaled, never in shop stock.
 Delve.makeUnique = function(id, floor){
  const u = Delve.uniqueById ? Delve.uniqueById(id) : null;
  if(!u) return null;
  const fl = (floor === undefined || floor === null) ? ((Delve.G && Delve.G.floor) || 1) : floor;
  const item = {
   id: u.id, baseId: u.id, baseName: u.name, name: u.name,
   slot: u.slot, tier: u.tier || 4, unique: true,
   quality: 100, lore: u.lore, flavour: u.flavour,
   affixes: [], provenance: null
  };
  Object.keys(u).forEach(function(k){
   if(["id","name","slot","tier","lore","flavour"].indexOf(k) >= 0) return;
   item[k] = u[k];
  });
  if(u.slot === "weapon"){
   const fam = FAM(u.style || "sword");
   item.shape = fam.shape;
   item.strCeiling = fam.strCeiling;
  }
  item.points = Math.round(Delve.itemPoints(item) * 10) / 10;
  item.floorFound = fl;
  return item;
 };

 // Returns a unique item or null. Source gating lives in CONFIG.ITEMS.unique.
 Delve.rollUnique = function(sourceKind, floor){
  const cfg = (IT().unique) || {};
  const chance = cfg[sourceKind + "Chance"];
  if(!chance || Math.random() > chance) return null;
  const list = (Delve.ITEM_UNIQUES || []).slice();
  if(!list.length) return null;
  const u = list[Math.floor(Math.random() * list.length)];
  return Delve.makeUnique(u.id, floor);
 };

 // ── Tier roll (always returns integer 1-4) ─────────────────────
 // `rarityMult` is an optional nudge from the loot source (elite, chest, boss).
 // It scales the rare + legendary weights only, never the common/uncommon bulk.
 Delve.rollTier = function(floor, rarityMult){
 if(floor === undefined && Delve.G) floor = Delve.G.floor;
 const L = Delve.CONFIG.loot, ward = Delve.wardOf(floor);
 let luck = 0;
 try { luck = Number(Delve.luckPts()) || 0; } catch(_e){}
 const num = function(v){ return (typeof v === "number" && isFinite(v) && v > 0) ? v : 0; };
 let mult = (typeof rarityMult === "number" && isFinite(rarityMult) && rarityMult > 0) ? rarityMult : 1;
 try {
  const w = Delve.getWard ? Delve.getWard(floor) : null; // per-biome knob (content)
  if(w && typeof w.lootRarityMult === "number") mult *= w.lootRarityMult;
 } catch(_e){}
 const c = num(L.weights.common());
 const u = num(L.weights.uncommon(luck, ward, floor));
 const r = num(L.weights.rare(luck, ward, floor)) * mult;
 const l = num(L.weights.legendary(luck, ward, floor)) * mult;
 const total = c + u + r + l;
 if(total <= 0) return 1;
 const roll = Math.random() * total;
 if(roll < c) return 1;
 if(roll < c + u) return 2;
 if(roll < c + u + r) return 3;
 return 4;
 };

 Delve.makeItem = function(tier, opts){
  opts = opts || {};
  if(opts.unique){
   const u = Delve.rollUnique(opts.kind || "chest", opts.floor);
   if(u) return u;
  }
  const slot = opts.slot || Delve.rollSlot();
  return Delve.makeGear(slot, opts.floor, { tier: tier, qualityBonus: opts.qualityBonus, luck: opts.luck });
 };

 // ── Provenance ────────────────────────────────────────────────
 Delve.stampProvenance = function(item, source){
 const G = Delve.G;
 const floor = G ? G.floor : "?";
 source = source || {};
 let line = "";
 switch(source.kind){
 case "monster":
 line = source.elite ? "Wrested from an Elite " + source.name + " on Floor " + floor + "."
 : "Recovered from a " + source.name + " on Floor " + floor + ".";
 break;
 case "boss":
 line = "Claimed from " + source.name + " on Floor " + floor + ".";
 break;
 case "chest":
 line = "Found sealed in a chest on Floor " + floor + ".";
 break;
 case "secret":
 line = "Hidden in a forgotten chamber, Floor " + floor + ".";
 break;
 case "shop":
 line = "Bought from the trader on Floor " + floor + ".";
 break;
 default:
 line = "Found on Floor " + floor + ".";
 }
 item.provenance = line;
 return item;
 };

 // ── Loot rolls ────────────────────────────────────────────────
 Delve.rollKillDrop = function(x, y, opts){
 opts = opts || {};
 const G = Delve.G;
 const L = Delve.CONFIG.loot;
 // Gear rolls on its own (L5); potions are a separate roll in combat.js.
 const D = IT().drop || {};
 let chance = Math.min(D.cap || 0.60, (D.gearBase || 0.155) + Delve.luckPts() * (D.gearPerLuck || 0.025));
 if(opts.elite) chance += (L.eliteDropBonus || 0);
 if(opts.guaranteed) chance = 1;
 if(Math.random() > chance) return false;
 // Source edge: elites and bosses find better-made gear, not more of it.
 const S = L.sourceRarityMult || {};
 let bonus = 0;
 if(opts.elite) bonus += 8 * (S.elite || 1);
 if(opts.boss) bonus += 12 * (S.boss || 1);
 const tier = opts.minTier ? Math.max(opts.minTier, Delve.bandOf(Delve.qualityOf(G.floor, Delve.luckPts()) + bonus)) : null;
 const item = Delve.makeItem(tier || undefined, { qualityBonus: bonus });
 if(!item) return false;
 item.x = x; item.y = y;
 Delve.stampProvenance(item, { kind:"monster", name:opts.name || "foe", elite:!!opts.elite });
 G.items.push(item);
 return true;
 };

 Delve.dropPotion = function(x, y, tier, source){
 const all = Delve.potionDefs || [];
 let pool = all.filter(function(d){ return d.tier === (tier || 2); });
 if(!pool.length) pool = all;
 if(!pool.length) return null;
 const it = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
 it.x = x; it.y = y;
 Delve.stampProvenance(it, source || { kind:"monster", name:"foe", elite:false });
 Delve.G.items.push(it);
 return it;
 };

 // ── Unique drops ──────────────────────────────────────────────
 // Bosses, chests and secrets only. Never a plain kill, never shop stock.
 Delve.dropUnique = function(x, y, kind, source){
  const G = Delve.G;
  if(!G || !G.items) return null;
  const it = Delve.rollUnique(kind, G.floor);
  if(!it) return null;
  it.x = x; it.y = y;
  Delve.stampProvenance(it, source || { kind:"chest" });
  G.items.push(it);
  if(Delve.flash) Delve.flash("UNIQUE: " + it.name);
  if(Delve.logSystem) Delve.logSystem("A unique item: " + it.name + ".");
  return it;
 };

 // ── Shop price ─────────────────────────────────────────────────
 Delve.itemPrice = function(item){
 const e = Delve.CONFIG.economy;
 // Goods get the Luck discount plus any Haggler / Silver Tongue node discount.
 const disc = Delve.goodsDiscount ? Delve.goodsDiscount() : Delve.luckDiscount();
 if(item.slot === "consumable"){
 return Math.max(1, Math.round((e.consumablePrices[item.tier] || (item.tier * 10)) * (1 - disc)));
 }
 // price = points x (19 + 24 x ward). A rule, not a price list.
 const P = Delve.itemPoints(item);
 const pr = IT().price || {};
 const ward = Delve.wardOf((Delve.G && Delve.G.floor) || 1);
 const rate = (pr.base || 19) + (pr.perWard || 24) * ward;
 return Math.max(1, Math.round(P * rate * (1 - disc)));
 };

 // Salvage value. Deliberately NOT a share of the buy price (design 3.5).
 Delve.sellValue = function(item){
 if(!item || item.slot === "consumable") return Math.max(1, Math.round((item && item.tier || 1) * 3));
 const pr = IT().price || {};
 return Math.max(1, Math.round(Delve.itemPoints(item) * (pr.sellPerPoint || 4)));
 };

 // ── Selling (design 5.8) ──────────────────────────────────────
 // Selling lives in the shop only. Carried items convert to gold at the salvage
 // rate; equipped items are untouched (they live in G.equip, not the bag).
 Delve.sellItem = function(item){
 const G = Delve.G;
 if(!G || !G.inventory || !item) return 0;
 const i = G.inventory.indexOf(item);
 if(i < 0) return 0;
 const value = Delve.sellValue(item);
 G.inventory.splice(i, 1);
 G.gold = (G.gold || 0) + value;
 if(Delve.recordStat) Delve.recordStat("goldFromSales", value);
 if(Delve.logSystem) Delve.logSystem("Sold " + item.name + " for " + value + " gold.");
 if(Delve.updateHUD) Delve.updateHUD();
 return value;
 };

 Delve.sellAll = function(){
 const G = Delve.G;
 if(!G || !G.inventory) return { gold:0, count:0 };
 let gold = 0, count = 0;
 // Slice first: sellItem splices the live array.
 G.inventory.slice().forEach(function(it){
  const v = Delve.sellItem(it);
  if(v > 0){ gold += v; count++; }
 });
 return { gold:gold, count:count };
 };

 // ── Inventory capacity ────────────────────────────────────────
 Delve.inventoryCap = function(){
 const base = (Delve.save && Delve.save.inventoryCap) || Delve.CONFIG.inventorySlots || 16;
 return Math.min(Delve.CONFIG.inventoryMax || 24, base);
 };

 // ── Pickup with capacity enforcement ──────────────────────────
 Delve.pickupItem = function(item){
 const G = Delve.G;
 if(!G.inventory) G.inventory = [];
 if(G.inventory.length >= Delve.inventoryCap()){
 item.x = G.px; item.y = G.py;
 const dup = (G.items||[]).find(function(i){ return i.x===item.x && i.y===item.y && i.id===item.id; });
 if(!dup) G.items.push(item);
 Delve.flash("Bag is full!");
 if(Delve.sfx) Delve.sfx("deny");
 if(Delve.logSystem) Delve.logSystem("Bag full — left " + item.name + " behind.");
 Delve.updateHUD();
 return false;
 }
 const stored = Object.assign({}, item);
 delete stored.x; delete stored.y;
 G.inventory.push(stored);
 if(Delve.sfx) Delve.sfx("pickup_item", { tier: item.tier });
 Delve.flash("Picked up " + item.name);
 Delve.recordStat("itemsGained", 1);
 if(Delve.logPickup) Delve.logPickup(item.name, item.tier);
 Delve.updateHUD();
 return true;
 };

 // ── Weight profile ────────────────────────────────────────────
 function weightProfile(item){
 const W = Delve.CONFIG.WEIGHT;
 const w = (item.weight && W[item.weight]) || W.medium;
 const scale = item.slot === "body" ? 1.0 : 0.5;
 return { speed: w.speed * scale, dodge: w.dodge * scale };
 }

 // ── Attack speed ──────────────────────────────────────────────
 Delve.playerSpeed = function(){
 const G = Delve.G, cfg = Delve.CONFIG, sec = cfg.secondaries;
 let speed = 1.0;
 if(G && G.equip && G.equip.weapon){
 const ws = cfg.WEAPON_SPEEDS[G.equip.weapon.style];
 if(ws) speed = ws;
 }
 speed += Delve.agiPts() * sec.speedPerAgi;

 let wSpeed = 0;
 const eq = G && G.equip ? G.equip : {};
 ["head","body","hands","feet"].forEach(function(s){
 if(eq[s]) wSpeed += weightProfile(eq[s]).speed;
 });
 if(wSpeed < 0){
 const mitigation = Delve.strPts() * (cfg.weightMitigation.strPerPoint || 0.01);
 wSpeed = Math.min(0, wSpeed + mitigation);
 wSpeed = Math.max(cfg.weightMitigation.speedPenaltyFloor || -0.04, wSpeed);
 }
 speed += wSpeed;

 if(G && G.equip){
 ["weapon","head","body","hands","feet","cloak","amulet","ring1","ring2"].forEach(function(s){
 const it = G.equip[s];
 if(it && it.speedBonus) speed += it.speedBonus;
 });
 }
 if(G) speed += (G.speedBuff || 0);
 speed = Math.max(0.5, speed);
 // Chill (The Frosted Vault) halves attack speed for its duration.
 if(Delve.playerChilled && Delve.playerChilled()){
  const cPct = ((Delve.CONFIG.STATUS_EFFECTS || {}).chill || {}).pct || 0.50;
  speed *= (1 - cPct);
 }
 return speed;
 };

 // ── Aggregate stats ───────────────────────────────────────────
 Delve.itemBuffs = function(){
 const G = Delve.G;
 const eq = G && G.equip ? G.equip : {};
 const b = { atk:0, str:0, red:0, hp:0, luck:0, dropBonus:0, goldBonus:0, shardBonus:0, bossAtk:0, speedBonus:0, healOnKill:0, crit:0, dodge:0, weightSpeed:0, weightDodge:0 };

 const add = function(it){
 if(!it) return;
 // A weapon's power lives in its damage band (see Delve.weaponBand), so its
 // flat atk must NOT be added here or the hit would count it twice.
 if(it.slot !== "weapon") b.atk += it.atk || 0;
 b.red += it.red || 0;
 b.hp += it.hp || 0;
 b.luck += it.luck || 0;
 b.dropBonus += it.dropBonus || 0;
 b.goldBonus += it.goldBonus || 0;
 b.shardBonus += it.shardBonus || 0;
 b.bossAtk += it.bossAtk || 0;
 b.speedBonus += it.speedBonus || 0;
 b.healOnKill += it.healOnKill || 0;
 b.crit += it.crit || 0;
 b.dodge += it.dodge || 0;
 b.str += it.str || 0;
 };
 add(eq.weapon); add(eq.offhand); add(eq.head); add(eq.body); add(eq.hands);
 add(eq.feet); add(eq.cloak); add(eq.amulet); add(eq.ring1); add(eq.ring2);

 ["head","body","hands","feet"].forEach(function(s){
 if(eq[s]){
 const wp = weightProfile(eq[s]);
 b.weightSpeed += wp.speed;
 b.weightDodge += wp.dodge;
 }
 });
 return b;
 };

 // ── Equip / unequip ───────────────────────────────────────────
 function removeFromInv(item){
 const inv = Delve.G && Delve.G.inventory;
 if(!inv) return;
 const i = inv.indexOf(item);
 if(i >= 0) inv.splice(i, 1);
 else {
 const j = inv.findIndex(function(x){ return x.id === item.id; });
 if(j >= 0) inv.splice(j, 1);
 }
 }
 function clampHp(){ Delve.G.hp = Math.min(Delve.G.hp, Delve.maxHp()); }

 Delve.equipItem = function(item, toKey){
 const G = Delve.G;
 const def = SLOT_DEFS()[item.slot];
 let key = toKey;
 if(!key) key = def ? def.equipKey : null;
 if(!key){
 if(!G.equip.ring1) key = "ring1";
 else if(!G.equip.ring2) key = "ring2";
 else key = "ring1";
 }
 const old = G.equip[key];
 if(old) G.inventory.push(old);
 G.equip[key] = item;
 removeFromInv(item);
 clampHp();
 if(Delve.sfx) Delve.sfx("equip", { slot: item.slot });
 Delve.flash("Equipped " + item.name);
 if(Delve.logEquip) Delve.logEquip(item.name, key);
 Delve.updateHUD();
 };

 Delve.unequipItem = function(item){
 const G = Delve.G;
 for(let i = 0; i < Delve.CONFIG.SLOT_ORDER.length; i++){
 const key = Delve.CONFIG.SLOT_ORDER[i];
 if(G.equip[key] === item){
 G.equip[key] = null;
 G.inventory.push(item);
 clampHp();
 Delve.flash("Unequipped " + item.name);
 Delve.updateHUD();
 return;
 }
 }
 };

 Delve.equipWeapon = function(item){ Delve.equipItem(item, "weapon"); };
 Delve.equipArmour = function(item){ Delve.equipItem(item, "body"); };

 // ── Status-on-hit ─────────────────────────────────────────────
 Delve.weaponStatus = function(weapon){
 if(!weapon || !weapon.status) return null;
 const cfg = Delve.CONFIG.statusChance || {};
 const table = cfg[weapon.status];
 if(!table) return null;
 // Executioner: +5 percentage points to every weapon status chance.
 const bonus = (Delve.statusChanceBonus ? Delve.statusChanceBonus() : 0);
 const chance = Math.min(1, (table[weapon.tier] || 0) + bonus);
 return { kind: weapon.status, chance: chance };
 };

 // ── Use consumables ───────────────────────────────────────────
 // Item is removed and counted exactly once, up front, so every
 // potion type (heal, cure, atk/speed/red/luck buff) is consumed.
 Delve.useConsumable = function(item){
 const G = Delve.G;
 removeFromInv(item);
 Delve.recordStat("consumablesUsed", 1);
 if(Delve.sfx) Delve.sfx(item.cures ? "cure" : "potion");

 if(item.cures){
 const cured = [];
 if(!G.effects) G.effects = [];
 item.cures.forEach(function(id){
 const before = G.effects.length;
 G.effects = G.effects.filter(function(e){ return e.id !== id; });
 if(G.effects.length < before) cured.push(id);
 });
 const label = cured.length ? cured.map(statusName).join(", ") : "nothing to cure";
 Delve.flash(item.name + " — cured " + label);
 if(Delve.logConsumable) Delve.logConsumable(item.name, "cured " + label);
 // Alchemist: a cure also restores 15% Health.
 const curePct = (Delve.cureHealPct ? Delve.cureHealPct() : 0);
 if(curePct > 0){
 const cureHeal = Math.round(Delve.maxHp() * curePct * (Delve.healMult ? Delve.healMult() : 1));
 if(cureHeal > 0){
 G.hp = Math.min(Delve.maxHp(), G.hp + cureHeal);
 Delve.flash(item.name + " — cured " + label + " (+" + cureHeal + " HP)");
 if(Delve.logHeal) Delve.logHeal(cureHeal, "Alchemist");
 }
 }
 }
 if(item.healPct || item.healFlat){
 // Field Kit (+15% consumables) and Salve Lore (+10% all healing) both apply.
 const hm = (Delve.healMult ? Delve.healMult() : 1) * (Delve.consumableHealMult ? Delve.consumableHealMult() : 1);
 const raw = item.healFlat ? item.healFlat : Math.round(Delve.maxHp() * (item.healPct || 0));
 const heal = Math.round(raw * hm);
 if(heal > 0){
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 Delve.flash(item.name + " — +" + heal + " HP");
 if(Delve.logHeal) Delve.logHeal(heal, item.name);
 }
 }
 if(item.atkBuff){
 G.atkBuff = (G.atkBuff || 0) + item.atkBuff;
 Delve.flash("+" + item.atkBuff + " Attack Power for this run");
 }
 if(item.speedBuff){
 G.speedBuff = (G.speedBuff || 0) + item.speedBuff;
 Delve.flash("+" + Math.round(item.speedBuff * 100) + "% Attack Speed for this run");
 }
 if(item.redBuff){
 G.redBuff = (G.redBuff || 0) + item.redBuff;
 Delve.flash("+" + item.redBuff + " Damage Reduction for this run");
 }
 if(item.luckBuff){
 G.luckBuff = (G.luckBuff || 0) + item.luckBuff;
 Delve.flash("+" + item.luckBuff + " Luck for this run");
 }

 Delve.enemiesTurn();
 Delve.updateHUD();
 };

 // ── Stat card lines ───────────────────────────────────────────
 Delve.itemStatLines = function(item){
 const lines = [];
 const eq = Delve.G && Delve.G.equip;

 function cmp(field, label, fmt){
 const val = item[field] || 0;
 if(!val) return;
 let delta = 0;
 if(eq){
 const cur = (item.slot === "weapon" && eq.weapon) ? (eq.weapon[field] || 0) :
 (item.slot === "ring") ? Math.max(eq.ring1 ? eq.ring1[field] || 0 : 0, eq.ring2 ? eq.ring2[field] || 0 : 0) :
 (eq[item.slot]) ? (eq[item.slot][field] || 0) : 0;
 delta = val - cur;
 }
 lines.push({ label: label, value: fmt ? fmt(val) : val, delta: delta });
 }
 const pct = function(v){ return "+" + Math.round(v * 100) + "%"; };

 // Weapon: the actual damage band, not a single number (L10).
 if(item.itemMax){
  const fam = FAM(item.style);
  const str = Delve.strPts ? Delve.strPts() : 6;
  const ceiling = item.strCeiling || fam.strCeiling;
  const mx = item.itemMax + Math.min(str, ceiling);
  const mn = (item.shape || fam.shape) * item.itemMax;
  lines.push({ label:"Damage", value: Math.round(mn) + " - " + Math.round(mx), delta:0 });
  lines.push({ label:"Strength cap", value: "+" + ceiling, delta:0 });
 }

 // Quality is the real stat; the band name is just its label.
 if(item.quality){
  const bandName = (Delve.TIERS && Delve.TIERS.names) ? (Delve.TIERS.names[item.tier] || "") : "";
  lines.push({ label:"Quality", value: bandName + " (" + Math.round(item.quality) + "/100)", delta:0 });
 }

 (item.affixes || []).forEach(function(a){
  lines.push({ label:"Affix", value: a.text, delta:0 });
 });
 if(item.proc || item.unique){
  lines.push({ label:"Unique", value: item.flavour || "", delta:0 });
 }

 cmp("atk", "Attack Power");
 cmp("red", "Damage Reduction");
 cmp("hp", "Maximum Health");
 cmp("luck", "Luck");
 cmp("crit", "Critical Chance", pct);
 cmp("dodge", "Dodge Chance", pct);
 cmp("dropBonus", "Item Find", pct);
 cmp("goldBonus", "Gold Find", pct);
 cmp("shardBonus", "Bonus Shards");
 cmp("bossAtk", "Damage vs Ward Bosses");
 cmp("speedBonus", "Attack Speed", pct);
 cmp("healOnKill", "Life Steal on Kill");

 if(item.healPct) lines.push({ label:"Restores", value: Math.round(Delve.maxHp() * item.healPct) + " Health", delta:0 });
 if(item.healFlat) lines.push({ label:"Restores", value: item.healFlat + " Health", delta:0 });
 if(item.cures && item.cures.length){
 const names = item.cures.map(statusName).join(", ");
 const hasHeal = item.healPct || item.healFlat;
 lines.push({ label: hasHeal ? "Also cures" : "Cures", value: names, delta:0 });
 }
 if(item.atkBuff) lines.push({ label:"Grants", value:"+" + item.atkBuff + " Attack Power (run)", delta:0 });
 if(item.speedBuff) lines.push({ label:"Grants", value:"+" + Math.round(item.speedBuff * 100) + "% Attack Speed (run)", delta:0 });
 if(item.redBuff) lines.push({ label:"Grants", value:"+" + item.redBuff + " Damage Reduction (run)", delta:0 });
 if(item.luckBuff) lines.push({ label:"Grants", value:"+" + item.luckBuff + " Luck (run)", delta:0 });
 if(item.status){
 const label = item.status === "poison" ? "Chance to Poison"
 : item.status === "burn" ? "Chance to Burn" : "Chance to Bleed";
 lines.push({ label:"On Hit", value: label, delta:0 });
 }
 if(item.style){
 const spd = Delve.CONFIG.WEAPON_SPEEDS[item.style] || 1.0;
 lines.push({ label:"Attack Speed", value: spd.toFixed(2), delta:0 });
 }
 if(item.weight){
 const W = Delve.CONFIG.WEIGHT[item.weight];
 lines.push({ label:"Weight", value: W ? W.name : item.weight, delta:0 });
 if(W && W.speed){
 const vsign = W.speed > 0 ? "+" : "";
 lines.push({ label:"Speed Effect", value: vsign + Math.round(W.speed * 100) + "%", delta:0 });
 }
 }
 return lines;
 };

 // ── Shop stock & heal pricing ─────────────────────────────────
 // Item-pool selection is item-domain logic, so it lives here rather than
 // in ui.js. Nothing load-time: reads itemDefs/CONFIG at call time.
 // ui.js calls these as Delve.makeShopStock(G) / Delve.shopHealCost(G).
 function shopItemPool(type){
 return Object.keys(Delve.itemDefs).map(function(k){ return Delve.itemDefs[k]; })
 .filter(function(d){ return type === "consumable" ? d.slot === "consumable" : d.slot !== "consumable"; });
 }

 Delve.makeShopStock = function(G){
 const stock = [];
 // Rolled goods, not catalogue rows: a shop item is a real quality roll with
 // a small bonus so buying feels like a shortcut, not a downgrade.
 const gearCount = (Delve.CONFIG.shop.stockGear || 1) + 2;
 for(let i=0;i<gearCount;i++){
 const it = Delve.makeGear(null, G.floor, { qualityBonus: 10 });
 if(it) stock.push({ item: it, sold:false });
 }
 const maxTier = Math.min(4, Math.floor(G.floor/10)+1);
 const cons = shopItemPool("consumable").filter(function(d){ return d.tier <= Math.min(maxTier,3); });
 const used = {};
 const want = Math.min(Delve.CONFIG.shop.stockConsumables||4, cons.length);
 let guard=0;
 while(Object.keys(used).length < want && guard++<100){
 const pick = cons[Math.floor(Math.random()*cons.length)];
 if(used[pick.id]) continue;
 used[pick.id]=1;
 stock.push({ item: Object.assign({}, pick), sold:false });
 }
 return stock;
 };

 Delve.shopHealCost = function(G){
 return Math.max(1, Math.round(Delve.healCost(G.floor)*(1-Delve.luckDiscount())));
 };

 // ── Shop floor helper ─────────────────────────────────────────
 // MOVED from state.js — all shop-domain logic now lives in this file.
 Delve.isShopFloor = function(floor){
 const s = Delve.CONFIG.shop;
 return floor > 0 && (floor % 10 === s.offset);
 };

 // ── Shop heal cost ────────────────────────────────────────────
 // MOVED from state.js. Called by Delve.shopHealCost above.
 Delve.healCost = function(floor){
 const e = Delve.CONFIG.economy;
 return Math.round(e.healCostA + e.healCostB * Math.log(floor + 1));
 };

})();
