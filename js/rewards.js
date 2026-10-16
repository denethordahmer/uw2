window.Delve = window.Delve || {};
(function(){
 const C = () => Delve.CONFIG;
 const ECO = () => Delve.CONFIG.economy;

 // rewards.js : run economy — gold→shards, boss bonuses, kill rewards,
 // floor-clear bonuses, elite promotion, monster stat lookup.
 // Load AFTER js/combat.js (uses Delve.rowFor, exported from there).
 // Everything else it touches (save, recordStat, luckPts, logSystem) is
 // resolved at call time, so no other ordering constraint applies.

 // ── Gold → shards conversion (successful run ends) ──────────
 Delve.convertGold = function(rate){
 const G = Delve.G;
 const r = rate || ECO().goldToShardRate;
 const shards = Math.floor(G.gold / r);
 G.gold -= shards * r;
 // Run-earned shards accumulate in G.runShards ONLY. They reach save.shards at a
 // commit point — see Delve.bankRunShards() below. Never write save.shards here:
 // a mid-run refresh would then bank a run the player never finished.
 G.runShards += shards;
 return shards;
 };

 // ── Shard banking ────────────────────────────────────────────
 // Run-earned shards (kills, floor-clear bonuses, gold converted at a boss, the
 // boss's own bonus) live in G.runShards while the run is in progress and are NOT
 // in the save. They are committed to the save at a commit point only: dying,
 // retreating, or beating a ward boss. So refreshing mid-run loses the run's
 // earnings, exactly as it loses the run itself.
 //
 // "Banked" is tracked as an amount, not a boolean, so this is safe to call at
 // every commit point — each call commits only what accrued since the last one.
 Delve.pendingRunShards = function(){
 const G = Delve.G;
 if(!G) return 0;
 return Math.max(0, Math.round((G.runShards || 0) - (G.shardsBanked || 0)));
 };

 Delve.bankRunShards = function(){
 const G = Delve.G;
 if(!G || !Delve.save) return 0;
 const pending = Delve.pendingRunShards();
 if(pending <= 0){ G.shardsBanked = G.runShards || 0; return 0; }
 G.shardsBanked = (G.shardsBanked || 0) + pending;
 Delve.save.shards = Math.max(0, Math.round((Delve.save.shards || 0) + pending));
 Delve.persist();
 return pending;
 };

 // ── Boss shard bonus ─────────────────────────────────────────
 // Applied once per boss, at the moment of the victory screen.
 // Bonus is bossDef.shardBonusPct × current runShards.
 Delve.applyBossBonus = Delve._applyBossBonus = function(wardIdx){
 const G = Delve.G;
 if(!G._bonusesApplied) G._bonusesApplied = [];
 if(G._bonusesApplied.indexOf(wardIdx) >= 0) return 0;
 G._bonusesApplied.push(wardIdx);
 const def = C().BOSS_DEFS[wardIdx];
 if(!def || !def.shardBonusPct) return 0;
 const bonus = Math.round((G.runShards || 0) * def.shardBonusPct);
 if(bonus > 0){
 G.runShards += bonus;
 Delve.recordStat("shardsEarned", bonus);
 if(Delve.logSystem) Delve.logSystem(def.name + " bonus: +" + bonus + " shards");
 }
 return bonus;
 };

 // ── Monster roster / rewards ────────────────────────────────
 Delve.monsterStats = function(type, floor){
 const cfg = Delve.CONFIG;
 const row = cfg.MONSTER_ROSTER[type] || cfg.MONSTER_ROSTER.goblin;
 return {
 name: row.name,
 kind: row.kind,
 hp: Math.round(row.hp + row.hpPerFloor * (floor - 1)),
 atk: Math.max(1, Math.round(row.atk + row.atkPerFloor * floor)),
 xp: row.xp,
 shards: row.shards,
 gold: row.gold
 };
 };

 Delve.killRewards = function(m){
 const G = Delve.G, cfg = Delve.CONFIG, eco = cfg.economy;
 const floor = G.floor;
 const luckMult = 1 + Delve.luckPts() * (eco.goldLuckMult || 0.05);

 let gold, shards, xp;

 if(m.isBoss){
 gold = cfg.goldBossBase || 80;
 shards = eco.bossShards || 40;
 xp = (cfg.xpKill && cfg.xpKill.boss) || 30;
 } else {
 const row = Delve.rowFor(m.kind); // exported by js/combat.js
 gold = row.gold + (eco.goldCurveK || 3.0) * Math.log(floor + 1);
 shards = row.shards;
 xp = row.xp;
 }

 if(m.elite){
 const r = cfg.elite.rewardMult || 3;
 gold *= r; shards *= r; xp *= r;
 }

 return {
 gold: Math.round(gold * luckMult),
 shards: Math.round(shards),
 xp: Math.round(xp)
 };
 };

 Delve.floorClearBonus = function(){
 const G = Delve.G, eco = Delve.CONFIG.economy;
 return (eco.floorClearBonus || 0) + (eco.floorClearBonusPerFloor || 0) * G.floor;
 };

 Delve.makeElite = function(m){
 const e = Delve.CONFIG.elite;
 m.elite = true;
 m.maxHp = Math.round(m.maxHp * e.hpMult);
 m.hp = m.maxHp;
 m.atk = Math.max(1, Math.round(m.atk * e.atkMult));
 m.name = "Elite " + m.name;
 if(Delve.sfx) Delve.sfx("elite");
 return m;
 };
})();
