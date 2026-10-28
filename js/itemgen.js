window.Delve = window.Delve || {};
(function(){

 // ── itemgen.js : item CONSTRUCTION (quality -> budget -> stats -> affixes) ──
 // The continuous-quality model from docs/results/items_overhaul.md: one pool
 // of POINTS decides an item's power. Quality sets the budget, the slot decides
 // which stats spend it, affixes carve a slice out of it, and nothing is added
 // on top — so two items of equal quality are worth the same whichever stats
 // they carry.
 //
 // Lifted verbatim out of items.js, which keeps the *runtime* side of items:
 // pricing, selling, pickup, equipping, consumables, shop stock and stat lines.
 //
 // Outward dependencies are data only — Delve.CONFIG.ITEMS, CONFIG.WEAPON_FAMILIES,
 // CONFIG.SLOT_*, Delve.ITEM_UNIQUES — all resolved at call time. No save, no DOM,
 // no G. Every body below is a character-for-character copy of what was in
 // items.js; the modulo/roll order is unchanged, so seeded item rolls still
 // produce the same items.
 //
 // Public names are unchanged: these functions still assign straight onto
 // Delve.*, so no call site moved. IT() and FAM() are the only module-scope
 // helpers the rest of items.js needs back, so they are exported at the foot.

 Delve.itemGen = Delve.itemGen || {};

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

 // items.js destructures these two back; nothing else crosses the seam.
 Delve.itemGen.IT = IT;
 Delve.itemGen.FAM = FAM;

})();
