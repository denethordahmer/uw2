window.Delve = window.Delve || {};
(function(){

 // ── Chosen passives live in G.traits (an ARRAY) ─────────────
 Delve.traits = function(){
 const G = Delve.G;
 return (G && G.traits) ? G.traits : [];
 };

 // Sum every chosen passive's effects (safe when no run exists yet)
 Delve.traitBuffs = function(){
 const b = {
 atk:0, maxHp:0, dodge:0, luck:0, goldMult:0, crit:0,
 bossAtk:0, flatRed:0, healPerFloor:0, healOnKill:0,
 dropBonus:0, speedBonus:0, extraEnergyPerKill:0, agi:0, tou:0, str:0,
 vampiric:false, unbroken:false, secondWindHealOverride:0
 };
 // One accumulator, so the two special cases stay special in one place.
 const addKey = function(k, v){
 if(!(k in b)) return;
 if(typeof b[k] === "boolean"){ b[k] = !!v; return; }
 if(k === "secondWindHealOverride"){ b[k] = Math.max(b[k], v); return; }
 b[k] += v;
 };
 const tagRanks = {};
 Delve.traits().forEach(t => {
 // A passive scales by its rank: effects = rank I, perRank = each step after.
 const rank = Math.max(1, t.rank || 1);
 const ef = t.effects || {}, pr = t.perRank || {};
 for(const k in ef){
 addKey(k, ef[k] + (rank - 1) * (pr[k] || 0));
 }
 if(t.tag) tagRanks[t.tag] = (tagRanks[t.tag] || 0) + rank;
 });
 // Set bonuses count total RANKS per tag, so taking one line to rank III
 // advances its set exactly as far as three different lines would.
 const sets = (Delve.CONFIG.TRAITS && Delve.CONFIG.TRAITS.sets) || {};
 Object.keys(tagRanks).forEach(function(tag){
 const def = sets[tag]; if(!def) return;
 (def.tiers || []).forEach(function(tier){
 if(tagRanks[tag] < tier.ranks) return;
 const ef = tier.effects || {};
 for(const k in ef) addKey(k, ef[k]);
 });
 });
 b.tagRanks = tagRanks;
 return b;
 };
 Delve.hasUnbroken = function(){ return Delve.traitBuffs().unbroken; };
 Delve.secondWindHealOverride = function(){ return Delve.traitBuffs().secondWindHealOverride; };

 // ── Ability data + ranks ──────────────────────────────────────
 // Numbers live in content (con-traits.js `data` fields); rank deltas
 // (from abilityRank shard-tree nodes) are stored in save.abilityRanks.
 function abilityDef(id){
 const list = (Delve.CONFIG.TRAITS && Delve.CONFIG.TRAITS.abilities) || [];
 return list.find(a => a.id === id) || null;
 }
 function abilityRanks(id){
 return (Delve.save && Delve.save.abilityRanks && Delve.save.abilityRanks[id]) || 0;
 }
 function abilityData(id){
 const d = abilityDef(id);
 return (d && d.data) || {};
 }
 // Actual energy cost: base cost reduced by second_nature node (if owned)
 function abilityCost(a){
 const base = a.cost || 0;
 if(Delve.hasProgression && Delve.hasProgression("second_nature")) return Math.max(1, Math.round(base * 0.8));
 return base;
 }

 // ── XP curve (rises per ward) ───────────────────────────────
 // Distinct from CONFIG.XP_CURVE (the base array) on purpose: this is the
 // per-ward adjusted curve for one floor.
 Delve.xpCurveFor = function(floor){
 const cfg = Delve.CONFIG;
 const step = cfg.xpWardStep || 2;
 const ward = Delve.getWard(floor);
 const wardIdx = Math.max(0, ((ward && ward.id) || 1) - 1);
 return cfg.XP_CURVE.map(v => v + wardIdx * step);
 };

 Delve.addXP = function(amount){
 const G = Delve.G;
 if(!G || G.dead || G.runEnded) return;
 G.xp = (G.xp || 0) + (amount || 0);
 while(checkLevelUp()){ /* process stacked level-ups */ }
 Delve.updateHUD();
 };

 function xpNeeded(G){
 const curve = Delve.xpCurveFor(G.floor);
 const next = curve[G.level - 1];
 if(next !== undefined) return next;
 const last = curve[curve.length - 1];
 return last + (G.level - curve.length) * 12;
 }
 // Public: the HUD's XP bar needs the same number the level-up loop uses.
 Delve.xpToNext = function(){
 const G = Delve.G;
 return G ? xpNeeded(G) : 1;
 };

 function checkLevelUp(){
 const G = Delve.G;
 const next = xpNeeded(G);
 if(G.xp >= next){
 G.xp -= next;
 G.level++;
 G.pendingLevelUps = (G.pendingLevelUps || 0) + 1;
 if(!G.levelUpOpen){
 G.levelUpOpen = true;
 if(Delve.sfx) Delve.sfx("levelup");
 if(Delve.logXP) Delve.logXP(0, G.level);
 else if(Delve.logSystem) Delve.logSystem("Reached Level " + G.level + "!");
 showLevelUpChoices();
 }
 return true;
 }
 return false;
 }

 function shuffle(a){
 const arr = a.slice();
 for(let i = arr.length - 1; i > 0; i--){
 const j = Math.floor(Math.random() * (i + 1));
 const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
 }
 return arr;
 }

 // ── Level-up choices ────────────────────────────────────────
 function showLevelUpChoices(){
 const G = Delve.G;
 const cfg = Delve.CONFIG.TRAITS;
 const passives = cfg.passives || [];
 const uniques = cfg.uniques || [];
 const abilities = cfg.abilities || [];

 // 3 different passives — but a line you already own offers its NEXT RANK
 // rather than appearing again as a duplicate, and a maxed line leaves the
 // pool entirely. That is what turns the same card into a build decision.
 const ownedRank = {};
 (G.traits || []).forEach(t => {
 if(t && t.id) ownedRank[t.id] = Math.max(ownedRank[t.id] || 0, t.rank || 1);
 });
 const ROMAN = ["", "I", "II", "III", "IV", "V"];
 const options = [];
 passives.forEach(function(p){
 const owned = ownedRank[p.id] || 0;
 const max = p.maxRank || 1;
 if(owned >= max) return;
 const next = owned + 1;
 options.push(Object.assign({}, p, {
 rank: next,
 name: next > 1 ? (p.name + " " + (ROMAN[next] || next)) : p.name,
 upgrade: owned > 0
 }));
 });
 const pool = shuffle(options).slice(0, 3);

 // One card is ALWAYS an ability while any remain unlearned. Abilities are
 // uncapped (CONFIG.levelMaxAbilities 0), so they are the run's long-term
 // progression; leaving that to a coin flip made deep runs passives-only.
 // Passives and uniques fill the other two cards.
 const known = (G.abilities || []).map(a => a.id)
 .concat((Delve.save && Delve.save.abilities) || []);
 const cap = Delve.CONFIG.levelMaxAbilities || 0;
 const abilitySlotsOpen = !cap || (G.abilities || []).length < cap;
 const openAbilities = abilities.filter(a => known.indexOf(a.id) < 0);
 if(openAbilities.length && abilitySlotsOpen){
 const pick = openAbilities[Math.floor(Math.random() * openAbilities.length)];
 if(pool.length) pool[0] = pick; else pool.push(pick);
 }

 // Chance for a unique not yet taken — it replaces one of the two non-ability
 // cards. (This used to pick a random slot twice, so it could overwrite the
 // ability card, or write the same unique into both cards.)
 const openUniques = uniques.filter(u => !(G.takenUniques || []).includes(u.id));
 if(openUniques.length && Math.random() < 0.25 && pool.length > 1){
 pool[1 + Math.floor(Math.random() * (pool.length - 1))] =
 openUniques[Math.floor(Math.random() * openUniques.length)];
 }

 G.levelUpChoices = pool;
 renderLevelUpChoices(pool);
 }

 function renderLevelUpChoices(choices){
 const G = Delve.G;
 if(!G) return;
 const overlay = document.getElementById("levelupScreen");
 if(!overlay) return;
 overlay.style.display = "flex";
 const slot = document.getElementById("levelupChoices");
 slot.innerHTML = "";

 choices.forEach(function(t){
 const card = document.createElement("button");
 card.className = "btn";
 card.style.cssText = "width:100%;padding:16px;text-align:left;font-size:17px;min-height:82px;background:#1a2a3a;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden;";
 const isAbility = t.cost !== undefined;
 const cost = isAbility ? abilityCost(t) : 0;
 const title = document.createElement("div");
 title.style.cssText = "font-weight:800;font-size:19px;margin-bottom:4px;";
 title.textContent = (isAbility ? "⚡ " : "") + t.name + (isAbility ? " (" + cost + " energy)" : "");
 const desc = document.createElement("div");
 desc.style.cssText = "font-size:14px;color:#a9bccd;white-space:normal;";
 desc.textContent = t.desc;
 card.appendChild(title);
 // Tag + rank, so a passive card says what build it belongs to and whether
 // this is a new line or an upgrade of one you already own.
 if(t.tag){
 const TAG_COL = { Edge:"#ff9a6b", Iron:"#7ee0ff", Blood:"#ff7a9c", Greed:"#ffd75e" };
 const meta = document.createElement("div");
 const maxRank = t.maxRank || 1;
 meta.style.cssText = "font-size:11px;font-weight:800;letter-spacing:.06em;" +
 "color:" + (TAG_COL[t.tag] || "#a9bccd") + ";margin:2px 0 4px;";
 meta.textContent = t.tag.toUpperCase() + " \u00b7 RANK " + (t.rank || 1) + "/" + maxRank +
 (t.upgrade ? " \u00b7 UPGRADE" : "");
 card.appendChild(meta);
 }
 card.appendChild(desc);

 card.addEventListener("click", function(){
 applyTrait(t);
 overlay.style.display = "none";
 G.pendingLevelUps = (G.pendingLevelUps || 1) - 1;
 if(G.pendingLevelUps > 0){
 G.levelUpOpen = true;
 showLevelUpChoices();
 } else {
 G.levelUpOpen = false;
 }
 Delve.updateHUD();
 Delve.draw();
 });
 slot.appendChild(card);
 });
 }

 function applyTrait(t){
 const G = Delve.G;
 if(!G || !t) return;
 if(t.unique){
 G.takenUniques = G.takenUniques || [];
 G.takenUniques.push(t.id);
 }
 // FIX #traitReq-chain: record taken traits so reqMet(traitReq) gates work.
 if(Delve.markRunTrait) Delve.markRunTrait(t.name, t.id);

 if(t.cost !== undefined){ Delve.addAbility(t); return; }

 G.traits = G.traits || [];
 const rank = Math.max(1, t.rank || 1);
 const hpBefore = Delve.maxHp();
 const owned = G.traits.find(x => x.id === t.id);
 if(owned){
 // A repeat pick upgrades the line rather than stacking a duplicate entry.
 owned.rank = Math.max(owned.rank || 1, rank);
 owned.name = t.name;            // keeps the rank suffix for the log/HUD
 } else {
 G.traits.push(Object.assign({}, t, { rank: rank }));
 }
 // Any line that raised max HP should also heal you by what it added.
 const gained = Delve.maxHp() - hpBefore;
 if(gained > 0) G.hp += gained;
 if(G.hp > Delve.maxHp()) G.hp = Delve.maxHp();
 Delve.flash(t.name + (t.upgrade ? " upgraded" : " acquired"));
 if(Delve.sfx) Delve.sfx("trait");
 if(Delve.logTrait) Delve.logTrait(t.name, t.id);
 }

 // ── Abilities ───────────────────────────────────────────────
 Delve.addAbility = function(a){
 const G = Delve.G;
 if(!G || !a) return;
 G.abilities = G.abilities || [];
 // Uncapped on purpose (CONFIG.levelMaxAbilities 0). The old code shifted the
 // oldest ability away once you had three, which silently deleted a choice the
 // player had made. The only guard left is against learning one twice.
 if(G.abilities.some(x => x.id === a.id)) return;
 G.abilities.push({ id:a.id, name:a.name, cost:a.cost, target:a.target, desc:a.desc });
 if(Delve.sfx) Delve.sfx("ability_learn");
 Delve.flash("Ability learned: " + a.name);
 };

 // ── Hub-purchased abilities: inject into every run at start ──
 // (Called by progression.js injectRunStart via this exported hook.)
 Delve.injectHubAbilities = function(){
 const G = Delve.G;
 const owned = (Delve.save && Delve.save.abilities) || [];
 owned.forEach(function(id){
 const d = abilityDef(id);
 if(!d) return;
 const known = (G.abilities || []).some(a => a.id === id);
 if(known) return;
 G.abilities = G.abilities || [];
 G.abilities.push({ id:d.id, name:d.name, cost:d.cost, target:d.target, desc:d.desc });
 });
 };

 function monsterAt(x, y){
 const G = Delve.G;
 if(G.boss && G.boss.x === x && G.boss.y === y) return G.boss;
 return G.monsters.find(m => m.x === x && m.y === y) || null;
 }
 function adjacentTo(x, y){
 const G = Delve.G, out = [];
 G.monsters.forEach(m => { if(Delve.mdist(m.x, m.y, x, y) === 1) out.push(m); });
 if(G.boss && Delve.mdist(G.boss.x, G.boss.y, x, y) === 1) out.push(G.boss);
 return out;
 }
 function hurt(m, dmg, col){
 const G = Delve.G;
 // Boss shield (the Bonefather's ribs): abilities are absorbed the same way
 // weapon hits are. absorbBossShield floats/logs the absorbed part itself.
 let dealt = dmg;
 if(m.isBoss && Delve.absorbBossShield) dealt = Delve.absorbBossShield(m, dmg);
 if(dealt > 0){
 m.hp -= dealt;
 m.hitFlash = Date.now();
 Delve.addFloater("-" + dealt, m.x, m.y, col || "#ffd75e");
 }
 if(m.hp <= 0){
 const wasTarget = (G.combatTarget === m);
 Delve.killMonster(m);
 if(wasTarget) Delve.endCombat(false);
 }
 }

 // Returns true on success, false on a rejected cast (no energy spent)
 Delve.castAbility = function(ability, tx, ty){
 const G = Delve.G, T = Delve.T;
 if(!G || !ability) return false;
 const cost = abilityCost(ability);
 if((G.energy || 0) < cost){ Delve.flash("Not enough Energy"); return false; }

 const d = abilityData(ability.id);
 const ranks = abilityRanks(ability.id);
 const dist = Delve.mdist(G.px, G.py, tx, ty);
 const mAt = monsterAt(tx, ty);
 const atk = Delve.atk();

 switch(ability.id){

 case "cleave": {
 if(!mAt || dist !== 1){ Delve.flash("Cleave: tap an adjacent enemy"); return false; }
 const bonus = (d.bonusAtk || 0) + (d.perRank || 0) * ranks;
 const hits = [mAt].concat(adjacentTo(tx, ty).filter(m => m !== mAt));
 hits.forEach(m => hurt(m, atk + bonus));
 break;
 }

 case "lunge": {
 // Lunge II adds damage, not range, so the range stays the base value.
 const range = (d.range || 4);
 const dx = Math.sign(tx - G.px), dy = Math.sign(ty - G.py);
 if(!mAt || (dx !== 0 && dy !== 0) || dist < 1 || dist > range){
 Delve.flash("Lunge: enemy in a straight line, " + range + " tiles"); return false;
 }
 let x = G.px, y = G.py;
 for(let i = 1; i < dist; i++){
 x += dx; y += dy;
 const c = G.grid[y] && G.grid[y][x];
 if(c !== T.FLOOR && c !== T.GOLD){ Delve.flash("Path blocked"); return false; }
 }
 if(G.inCombat && G.combatTarget !== mAt) Delve.endCombat(false);
 G.px = x; G.py = y;
 if(Delve.collectGold) Delve.collectGold(x, y);
 const bonus = (d.bonusAtk || 0) + (d.perRank || 0) * ranks;
 hurt(mAt, atk + bonus);
 break;
 }

 case "cinderbolt": {
 const range = (d.range || 5);
 if(!mAt || dist > range){ Delve.flash("Cinderbolt: enemy within 5 tiles"); return false; }
 const dmg = (d.dmg || 10) + (d.perRankDmg || 0) * ranks;
 hurt(mAt, dmg, "#f97316");
 if(mAt.hp > 0 && Delve.applyEffect){
 Delve.applyEffect(mAt, "burn");
 // perRankBurn would need per-status turn overrides — burn turns come from
 // CONFIG.STATUS_EFFECTS; ranks extend via re-apply (applyEffect refreshes).
 }
 break;
 }

 case "blink": {
 const range = (d.range || 4) + (d.perRankRange || 0) * ranks;
 const c = G.grid[ty] && G.grid[ty][tx];
 const shopHere = G.shop && G.shop.x === tx && G.shop.y === ty;
 if(dist < 1 || dist > range || (c !== T.FLOOR && c !== T.GOLD) || shopHere){
 Delve.flash("Blink: empty floor within " + range + " tiles"); return false;
 }
 if(G.inCombat) Delve.endCombat(false);
 G.px = tx; G.py = ty;
 if(Delve.collectGold) Delve.collectGold(tx, ty);
 const idx = G.items.findIndex(i => i.x === tx && i.y === ty);
 if(idx >= 0){ const it = G.items.splice(idx, 1)[0]; Delve.pickupItem(it); }
 break;
 }

 case "whirlwind": {
 const bonus = (d.bonusAtk || 0) + (d.perRank || 0) * ranks;
 const hits = adjacentTo(G.px, G.py);
 if(!hits.length){ Delve.flash("Whirlwind: no enemies adjacent"); return false; }
 hits.forEach(m => hurt(m, atk + bonus));
 break;
 }

 case "stone_skin":
 G.stoneSkin = (d.turns || 2) + (d.perRankTurns || 0) * ranks;
 Delve.flash("Stone Skin! -60% damage for " + G.stoneSkin + " turns");
 break;

 case "rally": {
 const pct = (d.healPct || 0.35) + (d.perRankHeal || 0) * ranks;
 const heal = Math.round(Delve.maxHp() * pct * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 G.effects = (G.effects || []).filter(e => e.id !== "bleed");
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 Delve.flash("Rally! +" + heal + " HP");
 break;
 }

 // ── Second wave ─────────────────────────────────────────────
 // Same contract as everything above: return false (spending nothing) for a
 // rejected cast. The shared tail below deducts energy only after a case runs.
 case "crushing_blow": {
 if(!mAt || dist !== 1){ Delve.flash("Crushing Blow: tap an adjacent enemy"); return false; }
 const mult = (d.mult || 1.5) + (d.perRankMult || 0) * ranks;
 hurt(mAt, Math.round(atk * mult), "#ffd75e");
 break;
 }

 case "rend": {
 if(!mAt || dist !== 1){ Delve.flash("Rend: tap an adjacent enemy"); return false; }
 const bonus = (d.bonusAtk || 0) + (d.perRank || 0) * ranks;
 hurt(mAt, atk + bonus, "#ef4444");
 if(mAt.hp > 0 && Delve.applyEffect) Delve.applyEffect(mAt, "bleed");
 break;
 }

 case "rupture": {
 if(!mAt || dist !== 1){ Delve.flash("Rupture: tap an adjacent enemy"); return false; }
 const base = (d.dmg || 10) + (d.perRankDmg || 0) * ranks;
 const bleeding = (mAt.effects || []).some(e => e.id === "bleed");
 hurt(mAt, Math.round(base * (bleeding ? (d.bleedMult || 2) : 1)), "#ef4444");
 break;
 }

 case "leech": {
 if(!mAt || dist !== 1){ Delve.flash("Leech: tap an adjacent enemy"); return false; }
 const bonus = (d.bonusAtk || 0) + (d.perRank || 0) * ranks;
 const before = mAt.hp;
 hurt(mAt, atk + bonus, "#7ee08a");
 const dealt = Math.max(0, before - Math.max(0, mAt.hp));
 const pct = (d.healPct || 0.5) + (d.perRankHeal || 0) * ranks;
 const heal = Math.round(dealt * pct);
 if(heal > 0){
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 }
 break;
 }

 case "venom_dart": {
 const range = (d.range || 5);
 if(!mAt || dist > range){ Delve.flash("Venom Dart: enemy within " + range + " tiles"); return false; }
 hurt(mAt, (d.dmg || 6) + (d.perRankDmg || 0) * ranks, "#a855f7");
 if(mAt.hp > 0 && Delve.applyEffect) Delve.applyEffect(mAt, "poison");
 break;
 }

 case "siphon": {
 const range = (d.range || 4);
 if(!mAt || dist > range){ Delve.flash("Siphon: enemy within " + range + " tiles"); return false; }
 hurt(mAt, (d.dmg || 6) + (d.perRankDmg || 0) * ranks, "#7ee0ff");
 G.energy += (d.refund || 3);   // the shared tail still deducts the cost
 break;
 }

 case "meteor": {
 const range = (d.range || 5);
 if(!mAt || dist > range){ Delve.flash("Meteor: enemy within " + range + " tiles"); return false; }
 const dmg = (d.dmg || 14) + (d.perRankDmg || 0) * ranks;
 const splash = (d.splash || 10) + (d.perRankDmg || 0) * ranks;
 const cx = mAt.x, cy = mAt.y;
 hurt(mAt, dmg, "#f97316");
 adjacentTo(cx, cy).forEach(m => { if(m !== mAt && m.hp > 0) hurt(m, splash, "#f97316"); });
 break;
 }

 case "tremor": {
 const radius = (d.radius || 2);
 const around = G.monsters.filter(m => Delve.mdist(m.x, m.y, G.px, G.py) <= radius);
 if(G.boss && Delve.mdist(G.boss.x, G.boss.y, G.px, G.py) <= radius) around.push(G.boss);
 if(!around.length){ Delve.flash("Tremor: no enemies within " + radius); return false; }
 const dmg = (d.dmg || 8) + (d.perRankDmg || 0) * ranks;
 around.forEach(m => hurt(m, dmg, "#c9971f"));
 break;
 }

 case "brace": {
 const pct = (d.healPct || 0.15) + (d.perRankHeal || 0) * ranks;
 const heal = Math.round(Delve.maxHp() * pct * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 G.effects = (G.effects || []).filter(e => e.id !== "poison" && e.id !== "bleed");
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 Delve.flash("Brace! +" + heal + " HP");
 break;
 }

 default:
 return false;
 }

 G.energy -= cost;
 if(Delve.sfx) Delve.sfx("ability_" + ability.id);
 Delve.updateHUD();
 return true;
 };

})();
