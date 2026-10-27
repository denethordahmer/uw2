window.Delve = window.Delve || {};
(function(){
 const C = () => Delve.CONFIG;
 const bought = id => (Delve.save && Delve.save.lvls && Delve.save.lvls[id]) || 0;
 const tb = () => (Delve.traitBuffs ? Delve.traitBuffs() : {});
 const ib = () => (Delve.G && Delve.G.equip && Delve.itemBuffs) ? Delve.itemBuffs() : { atk:0,red:0,hp:0,luck:0,dropBonus:0,goldBonus:0,shardBonus:0,bossAtk:0,speedBonus:0,healOnKill:0,crit:0,dodge:0 };
 const n = v => v || 0;

 // ── Shard-tree node bonuses ───────────────────────────────────
 // Node numbers live in the content file (con-progression.js); this file only
 // reads them, so a card's wording and its effect can't drift apart.
 // `_nodeIdx` is built lazily — attrs.js loads before the tree is usable.
 let _nodeIdx = null;
 function nodeIndex(){
  if(_nodeIdx) return _nodeIdx;
  const idx = {};
  const trees = ((C().PROGRESSION || {}).NODES) || {};
  Object.keys(trees).forEach(function(tree){
   (trees[tree] || []).forEach(function(node){
    if(node && node.id) idx[node.id] = node;
   });
  });
  _nodeIdx = idx;
  return idx;
 }
 const owns = id => !!(Delve.hasProgression && Delve.hasProgression(id));
 function ownsType(type){
  const idx = nodeIndex();
  return Object.keys(idx).some(function(id){ return idx[id].type === type && owns(id); });
 }
 // One owned node's data field (0 when the node isn't owned or has no such field).
 function nodeBonus(id, field, fallback){
  if(!owns(id)) return 0;
  const node = nodeIndex()[id];
  if(!node) return 0;
  const v = node[field];
  return (v === undefined || v === null) ? n(fallback) : v;
 }
 // Sum of one field across every owned node of a given type.
 function nodeTypeSum(type, field){
  const idx = nodeIndex();
  let total = 0;
  Object.keys(idx).forEach(function(id){
   const node = idx[id];
   if(!node || node.type !== type || !owns(id)) return;
   total += n(node[field]);
  });
  return total;
 }
 // Sum of an owned flatStat node's `amount` for one stat id (TOU / LUC / ...).
 function nodeStatBonus(statId){
  const idx = nodeIndex();
  let total = 0;
  Object.keys(idx).forEach(function(id){
   const node = idx[id];
   if(!node || node.type !== "flatStat" || node.stat !== statId || !owns(id)) return;
   total += n(node.amount);
  });
  return total;
 }

 // ── HP ─────────────────────────────────────────────────────────
 Delve.baseMaxHp = function(){ const a = C().ATTRS.con; return a.base + a.perLevel * bought("con"); };
 Delve.maxHp = function(){
  const I = C().ITEMS || {};
  const lv = Math.max(0, ((Delve.G && Delve.G.level) || 1) - 1) * n(I.levelHp);
  return Math.max(1, Math.round(Delve.baseMaxHp() + n(ib().hp) + lv + n(tb().maxHp) + nodeTypeSum("flatHp", "hp")));
 };

 // ── Attack ─────────────────────────────────────────────────────
 Delve.baseAtk = function(){ const a = C().ATTRS.str; return a.base + a.perLevel * bought("str"); };

 // ── Weapon damage (L10) ────────────────────────────────────────
 // A swing rolls uniformly between minHit and maxHit. Strength feeds the TOP
 // of the range only, and each family caps how much Strength it can absorb:
 //   maxHit = min(itemMax + STR, itemMax + strCeiling)
 //   minHit = shape * itemMax
 Delve.weaponBand = function(){
  const G = Delve.G;
  const w = (G && G.equip) ? G.equip.weapon : null;
  const str = Delve.strPts();
  if(!w || !w.itemMax) return { min: str, max: str, style: "sword" };  // fists
  const fam = ((C().WEAPON_FAMILIES || {})[w.style]) || { shape: 0.65, strCeiling: 16 };
  const shape = Number(w.shape) || fam.shape;
  const ceiling = Number(w.strCeiling) || fam.strCeiling;
  const itemMax = Math.max(0, Number(w.itemMax) || 0);
  // Strength SHIFTS the whole band and is capped by the family. If it only
  // lifted the top, a low-itemMax weapon would halve the player's damage.
  // The lift is speed-normalised (a sword = 1.000): one Strength is worth the
  // same DAMAGE PER SECOND in every family, which is what keeps the five
  // families at parity on the catalogue. Per hit, a hammer gains more than a
  // dagger and a dagger caps sooner - the intended feel.
  const famSpeed = Number(fam.speed) || 1.0;
  const lift = Math.min(str, ceiling) / famSpeed;
  return {
   min: shape * itemMax + lift,
   max: itemMax + lift,
   style: w.style
  };
 };

 Delve.weaponRoll = function(){
  const b = Delve.weaponBand();
  return b.min + Math.random() * Math.max(0, b.max - b.min);
 };

 // Everything flat that is NOT the weapon: rings, gloves, traits, buffs and the
 // +1 ATK per character level. The weapon contributes through its band only.
 Delve.bonusAtk = function(){
  let a = 0;
  if(Delve.G) a += n(Delve.G.atkBuff);
  a += n(ib().atk) + n(tb().atk) + nodeTypeSum("flatAtk", "atk");
  const I = C().ITEMS || {};
  a += n(I.levelAtk) * Math.max(0, ((Delve.G && Delve.G.level) || 1) - 1);
  return a;
 };

 // Attack power is DPS-normalised: one ATK point is one damage on a SWORD swing
 // (speed 1.0). A dagger converts it into more, smaller hits; a hammer into
 // fewer, larger ones. Without this scale, every flat bonus (base Strength, the
 // +1 ATK per level, ring atk) quietly made fast weapons stronger - measured as
 // a 30% dagger/hammer spread at floor 40.
 Delve.speedScale = function(){
  const G = Delve.G;
  const w = (G && G.equip) ? G.equip.weapon : null;
  if(!w || !w.style) return 1;
  const sp = ((C().WEAPON_SPEEDS || {})[w.style]) || 1;
  // Reciprocal on purpose: a point of ATK is worth the same per SECOND, so a
  // fast weapon gets less of it per hit (many small cuts) and a slow weapon
  // gets more (few big blows).
  return 1 / sp;
 };

 // Expected hit - what the HUD and ability damage want. Combat rolls the band.
 Delve.atk = function(){
  const b = Delve.weaponBand();
  return Math.max(1, Math.round((b.min + b.max) / 2 + Delve.bonusAtk() * Delve.speedScale()));
 };

 // ── Luck / Agility / Toughness / Strength ─────────────────────
 Delve.baseLuck = function(){ return C().ATTRS.luc.base + bought("luc"); };
 Delve.luckPts = function(){
  let v = Delve.baseLuck() + n(ib().luck) + n(tb().luck) + nodeStatBonus("luc");
  if(Delve.G) v += n(Delve.G.luckBuff);
  return v;
 };
 Delve.agiPts = function(){ return C().ATTRS.agi.base + bought("agi") + n(tb().agi); };
 Delve.touPts = function(){ return C().ATTRS.tou.base + bought("tou") + n(tb().tou) + nodeStatBonus("tou"); };
 Delve.strPts = function(){ return C().ATTRS.str.base + bought("str") + n(tb().str) + n(ib().str); };  // FIX #1: was missing — items.js playerSpeed() reads it for heavy armour

 // ── Damage reduction (TOU % + flat from items + temp buff) ────
 Delve.dmgRed = function(){
  const a = C().ATTRS.tou;
  return Math.min(a.cap || 0.50, Delve.touPts() * a.perLevel);
 };
 Delve.flatRed = function(){
  let r = n(ib().red) + n(tb().flatRed) + nodeTypeSum("flatRed", "red");
  if(Delve.G) r += n(Delve.G.redBuff);
  return Math.round(r);
 };

 // ── Dodge / Crit (add item + trait bonuses) ──────────────────
 // outer caps (0.60 dodge / 0.80 crit) are hard ceilings on top of
 // the config's soft caps — keep in sync if balance changes.
 Delve.dodge = function(){
  const s = C().secondaries;
  const itemDodge = n(ib().dodge) + n(ib().weightDodge);
  return Math.min(0.60, Math.min(s.dodgeCap, Delve.agiPts() * s.dodgePerAgi) + itemDodge + n(tb().dodge) + nodeTypeSum("flatDodge", "dodge"));
 };
 Delve.crit = function(){
  const s = C().secondaries;
  return Math.min(0.80, Math.min(s.critCap, Delve.luckPts() * s.critPerLuck) + n(ib().crit) + n(tb().crit));
 };

 // ── Unlocks ────────────────────────────────────────────────────
 Delve.hasSecondWind = function(){ return bought("con") >= C().secondaries.secondWindUnlock; };
 Delve.hasOverkill   = function(){ return bought("str") >= C().secondaries.overkillUnlock; };
 Delve.hasBulwark    = function(){ return Delve.touPts() >= C().secondaries.bulwarkTotal; };
 Delve.firstStrikeBonus = function(){
  const s = C().secondaries;
  if(bought("agi") < s.firstStrikeUnlock) return 0;
  return Math.floor(Delve.agiPts() / s.firstStrikeDiv);
 };
 Delve.hitCap = function(){ return Math.floor(Delve.maxHp() * C().secondaries.bulwarkHitCap); };

 // ── Economy multipliers ────────────────────────────────────────
 Delve.goldMult = function(){
  const eco = C().economy || {};
  return 1 + Delve.luckPts() * (eco.goldLuckMult || 0.05) + n(ib().goldBonus) + n(tb().goldMult) + nodeTypeSum("goldPlus", "goldPct");
 };
 Delve.dropChance = function(){
  const L = C().loot;
  return Math.min(L.dropCap, L.baseDrop + Delve.luckPts() * L.luckDrop) + n(ib().dropBonus) + n(tb().dropBonus) + nodeTypeSum("dropPlus", "dropPct");
 };
 Delve.bossBonus = function(){ return n(ib().bossAtk) + n(tb().bossAtk); };
 Delve.traitHealPerFloor = function(){ return n(tb().healPerFloor); };

 // ── Skill: Luck discount for merchant ─────────────────────────
 Delve.luckDiscount = function(){
  const e = C().economy || {};
  return Math.min(e.maxLuckDiscount || 0.20, Delve.luckPts() * (e.luckDiscountPerPoint || 0.02));
 };

 // ── Shard shop helpers ─────────────────────────────────────────
 Delve.attrCost = function(id){
  const a = C().ATTRS[id];
  return Math.round(a.costBase * Math.pow(C().costGrowth, bought(id)));
 };  // FIX #18: was defined twice — single definition now
 Delve.attrLvl = function(id){ return bought(id); };
 Delve.attrLevel = Delve.attrLvl;
 Delve.attrValue = function(id){ const a = C().ATTRS[id]; return a.base + a.perLevel * bought(id); };

 // ── Node-driven effects other files consume (read at call time) ──
 Delve.nodeBonus = nodeBonus;
 Delve.ownsNodeType = ownsType;
 Delve.healMult = function(){ return 1 + nodeTypeSum("healPct", "healBonus"); };
 Delve.consumableHealMult = function(){ return 1 + nodeTypeSum("consumableHeal", "healBonus"); };
 Delve.cureHealPct = function(){ return nodeTypeSum("cureHeal", "healBonus"); };
 Delve.statusChanceBonus = function(){ return nodeTypeSum("statusUp", "statusPct"); };
 Delve.energyPerKillBonus = function(){ return nodeTypeSum("killEnergy", "energyPerKill"); };
 Delve.overkillPct = function(){ return nodeTypeSum("overkillPct", "healPct"); };
 Delve.bossDamageMult = function(){ return 1 + nodeTypeSum("bossDamage", "bossAtkPct"); };
 Delve.secondWindUpgradePct = function(){ return nodeTypeSum("secondWindPct", "healPct"); };
 Delve.secondWindTriggerPct = function(){ return nodeTypeSum("secondWindTriggerPct", "trigger"); };
 Delve.hasLastStand = function(){ return ownsType("ironWill"); };
 Delve.nodeDiscount = function(){ return nodeTypeSum("discount", "discount"); };
 Delve.goodsDiscount = function(){ return Math.min(0.90, Delve.luckDiscount() + Delve.nodeDiscount()); };
 Delve.restsPerFloor = function(){ return n(C().restPerFloor) + nodeTypeSum("restPlus", "rests"); };
 Delve.startEnergy = function(){
  const a = C().ATTRS.eng || {};
  return Math.round(n(a.base) + n(a.perLevel) * bought("eng") + nodeTypeSum("startEnergy", "energy"));
 };
 Delve.energyCap = function(){ return Delve.startEnergy() + n(C().energyCapOverStart || 90); };
})();
