window.Delve = window.Delve || {};
(function(){
 const T = () => Delve.T;
 const C = () => Delve.CONFIG;

 // combat.js : the auto-combat loop, monster/player swings, ambient attacks,
 // kill resolution, and run lifecycle (end/retreat/die/victory).
 // Tile movement, rest, barrels, gold pickup and descent now live in
 // js/movement.js. Economy lives in js/rewards.js.
 // Exports Delve.rowFor / Delve.onHitEffectFor for rewards.js to consume.

 // Chance for an enemy with an on-hit status to actually apply it.
 const ON_HIT_STATUS_CHANCE = 0.15;

 // Trait buffs, reachable from every function in this file. The later local
 // `tb` inside enemiesTurn shadows nothing; this is the module-level one.
 const TB = () => (Delve.traitBuffs ? Delve.traitBuffs() : {});

 // Hit-stop (§Batch 15): freeze the swing loop for a few frames so an impact reads. Kept on
 // G rather than in a timer because the combat loop is the only thing that reads it — and
 // that loop deliberately does not advance its swing timers while frozen, so the pause is
 // real rather than a skipped swing.
 function hitStop(ms){
  const G = Delve.G;
  if(!G) return;
  const until = Date.now() + ms;
  if(!G.hitStopUntil || until > G.hitStopUntil) G.hitStopUntil = until;
 }

 // ── Shared monster-data lookups ──────────────────────────────
 function rowFor(kind){
 const cfg = Delve.CONFIG;
 for(const key in cfg.MONSTER_ROSTER){
 if(cfg.MONSTER_ROSTER[key].kind === kind) return cfg.MONSTER_ROSTER[key];
 }
 return cfg.MONSTER_ROSTER.goblin;
 }
 Delve.rowFor = rowFor;

 // Returns the status id an enemy applies on a successful hit, or null.
 function onHitEffectFor(m){
 if(!m) return null;
 const row = rowFor(m.kind);
 if(row && row.onHitEffect) return row.onHitEffect;
 return null;
 }
 Delve.onHitEffectFor = onHitEffectFor;

 // ── End a run (death / retreat / victory) ────────────────────
 Delve.endRun = function(kind, extra){
 const G = Delve.G;
 G.runEnded = true; if(Delve.bankRunShards) Delve.bankRunShards(); // commit point: bank the run's shards
 G.inCombat = false;
 if(G.combatTimer){ clearInterval(G.combatTimer); G.combatTimer = null; }
 if(Delve.sfxStopAmbience) Delve.sfxStopAmbience();
 Delve.persist();
 if(Delve.showEndScreen){
 Delve.showEndScreen(kind, extra);
 } else if(kind === "death"){
 if(document.getElementById("deathScreen")) document.getElementById("deathScreen").style.display = "flex";
 }
 };

 // ── Retreat to surface — counts as a SUCCESS (gold kept) ────
 Delve.retreat = function(){
 const G = Delve.G;
 if(!G || G.dead || G.runEnded) return;
 if(G.inCombat){ Delve.flash("Can't retreat mid-fight!"); return; }
 const gained = Delve.convertGold(); // js/rewards.js
 const banked = Delve.bankRunShards(); Delve.recordStat("retreated", 1);
 if(Delve.logSystem) Delve.logSystem("Retreated — " + banked + " shards banked.");
 Delve.endRun("retreat", { shards: banked || gained });
 };

 // ── Save floor & exit — a PAUSE, not an end (§6.12) ──────────
 // The pause menu's way out that keeps the run: the floor is checkpointed, the player lands
 // on the title screen, and the main button reads FLOOR n so they can carry on later.
 //
 // It deliberately does NOT re-take the checkpoint, and that is the whole trick. The
 // checkpoint belongs to the moment the player WALKED INTO this floor; re-taking it here
 // would snapshot their current gold, XP, items and health — everything this floor has
 // already handed them — while a resume rebuilds the floor fresh, chests, monsters and rest
 // spots included. Half-clearing a floor, saving, quitting and resuming would then be
 // repeatable for profit. Leaving the checkpoint where it is means a resumed floor is worth
 // exactly what it was worth the first time. (A checkpoint is only taken here in the rare
 // case that none exists at all, which cannot be farmed because there is nothing to reset.)
 //
 // It also does NOT bank the run's shards: leaving the game is not ending the run (§6.10).
 // Banking here would be a duplication bug on top of that — the resumed run restores the
 // same pending amount, so death or retreat afterwards would bank it a second time.
 //
 // Allowed during a fight, unlike Flee: it ends nothing and banks nothing, so it is the same
 // escape a killed tab already gives, priced the same way (that floor's loot and XP).
 Delve.saveAndExit = function(){
  const G = Delve.G;
  if(!G || G.dead || G.runEnded) return false;
  if(!Delve.hasSavedRun()) Delve.setFloorCheckpoint();  // before runEnded — capture refuses after
  G.runEnded = true;                 // stops the loop and every input guard; NOT a death
  G.inCombat = false;
  if(G.combatTimer){ clearInterval(G.combatTimer); G.combatTimer = null; }
  if(Delve.sfxStopAmbience) Delve.sfxStopAmbience();
  Delve.persist();
  const pend = Delve.pendingRunShards ? Delve.pendingRunShards() : (G.runShards || 0);
  if(Delve.logSystem) Delve.logSystem("Saved at floor " + G.floor + " — " + pend + " shards carried, not yet banked.");
  // menu.js owns the title screen: it closes the overlays, hides the HUD, stops the ambience
  // and re-reads the checkpoint, so the main button reads FLOOR n on the way in.
  if(Delve.showTitle) Delve.showTitle();
  else if(Delve.showHub) Delve.showHub();
  return true;
 };

 // ── Start auto-combat ────────────────────────────────────────
 Delve.startCombat = function(m){
 const G = Delve.G;
 if(G.combatTarget) Delve.endCombat(true);

 G.combatTarget = m;
 G._path = null;
 if(G._pathTimer){ clearInterval(G._pathTimer); G._pathTimer = null; }
 G.inCombat = true;

 const playerInterval = Math.round(C().secondaries.baseInterval / Delve.playerSpeed());
 const monsterInterval = Math.round(C().secondaries.baseInterval / (m.speed || 1.0));
 let playerTimer = playerInterval;
 let monsterTimer = monsterInterval;
 const TICK = 80;

 G.combatTimer = setInterval(function(){
 if(!G.combatTarget || G.dead || G.runEnded){ Delve.endCombat(false); return; }
 const m = G.combatTarget;

 // Hit-stop (§Batch 15): the swing timers do not advance either, so the pause is a real
  // freeze rather than a skipped swing.
  if(G.hitStopUntil && Date.now() < G.hitStopUntil){ Delve.draw(); return; }
  playerTimer -= TICK;
 monsterTimer -= TICK;

 if(playerTimer <= 0){
 // Recompute rather than reuse: attack speed can now change mid-fight (Chill,
 // speed potions), and playerInterval was captured when combat started.
 playerTimer = Math.round(C().secondaries.baseInterval / Delve.playerSpeed());
 playerSwing(m);
 if(!G.combatTarget) return;
 }
 if(monsterTimer <= 0){
 monsterTimer = monsterInterval;
 if(G.combatTarget) monsterSwing(m);
 }

 Delve.updateHUD();
 Delve.draw();
 }, TICK);
 };

 Delve.endCombat = function(fled){
 const G = Delve.G;
 if(G.combatTimer){ clearInterval(G.combatTimer); G.combatTimer = null; }
 const m = G.combatTarget;
 G.combatTarget = null;
 G.inCombat = false;

 if(fled && m){
 const hit = Math.max(1, Math.round(m.atk * (1 - Delve.dmgRed()) - Delve.flatRed()));
 if(Math.random() >= Delve.dodge()){
 G.hp -= hit;
 Delve.addFloater("-" + hit, G.px, G.py, "#ff5c5c");
 if(Delve.logEnemyAtk) Delve.logEnemyAtk(m.name, hit);
 Delve.addShake(2);
 }
 m.hp = m.maxHp;
 if(Delve.logSystem) Delve.logSystem("Fled — " + m.name + " recovers.");
 if(G.hp <= 0){ Delve.die(); return; }
 }
 Delve.updateHUD();
 Delve.draw();
 };

 // ── Player swing (status-on-hit, crit, vampiric) ─────────────
 function playerSwing(m){
 const G = Delve.G, sec = C().secondaries;

 const weakened = Delve.playerWeakened ? Delve.playerWeakened() : false;
 if(Delve.tickPlayerEffects) Delve.tickPlayerEffects();
 if(G.dead || G.runEnded) return;

 G.swing = Date.now();
 m.hitFlash = Date.now();

 // Weapon damage is a ROLL now (L10): uniform between minHit and maxHit.
 // Flat bonuses (rings, gloves, traits, buffs, levels) are added on top; the
 // weapon's own atk is never in bonusAtk(), so nothing is counted twice.
 let dmg = Delve.weaponRoll() + Delve.bonusAtk() * (Delve.speedScale ? Delve.speedScale() : 1);
 if(m.isBoss){
 dmg += Delve.bossBonus ? Delve.bossBonus() : (Delve.itemBuffs().bossAtk || 0);
 // Warden's Bane: +10% of the whole hit, on top of the flat boss bonus.
 if(Delve.bossDamageMult) dmg = Math.round(dmg * Delve.bossDamageMult());
 }

 const fs = Delve.firstStrikeBonus();
 if(fs && !m.hasActed) dmg += fs;

 // ── Trait damage modifiers (the 5-rank passive lines) ──
 // Executioner: bonus damage against a wounded target.
 if(m.maxHp > 0 && (m.hp / m.maxHp) < 0.30 && TB().executeBonus) dmg = Math.round(dmg * (1 + TB().executeBonus));
 // Last Gasp: bonus damage while the PLAYER is nearly dead.
 if(G.hp < Delve.maxHp() * 0.25 && TB().lowHpDmg) dmg = Math.round(dmg * (1 + TB().lowHpDmg));
 // Momentum: each consecutive swing on the same enemy adds a little.
 if(TB().momentum){
  if(m._lastHitTarget === true) m._momentumStacks = Math.min(10, (m._momentumStacks || 0) + 1);
  else m._momentumStacks = 0;
  m._lastHitTarget = true;
  dmg = Math.round(dmg * (1 + TB().momentum * (m._momentumStacks || 0)));
 } else {
  m._lastHitTarget = true;
 }
 // Piercing: subtract from the target's flat armour later, via a flag.
 m._pierce = TB().pierce || 0;

 // Unique proc: Gravemaker hits harder on a wounded target.
 const wielded = G.equip && G.equip.weapon;
 if(wielded && wielded.proc === "execute" && m.maxHp > 0 && (m.hp / m.maxHp) < 0.30){
  dmg = Math.round(dmg * 1.30);
 }

 const weaponStyle = (G.equip && G.equip.weapon && G.equip.weapon.style) || "sword";
 let isCrit = false;
 if(Math.random() < Delve.crit()){
 dmg = Math.round(dmg * sec.critMult);
 isCrit = true;
 hitStop(90);                                     // a crit gets a beat of impact (§Batch 15)
 if(Delve.sfx) Delve.sfx("crit", { weapon: weaponStyle });
 }

 // Weaken applied BEFORE display — floater, log, and stats all show
 // the real damage dealt.
 if(weakened){
 const wpct = (C().STATUS_EFFECTS.weaken && C().STATUS_EFFECTS.weaken.pct) || 0.30;
 dmg = Math.max(1, Math.round(dmg * (1 - wpct)));
 }

 // Boss shield (the Bonefather's ribs): damage eats the shield first; only the
 // remainder reaches HP. absorbBossShield floats/logs the absorbed part itself.
 let dealt = (m.isBoss && Delve.absorbBossShield) ? Delve.absorbBossShield(m, dmg) : dmg;
 // Flat monster armour, applied after the shield and after all trait/buff maths,
 // so a heavy plated enemy reads as "needs a heavier hit" at every depth.
 if(Delve.applyMonsterArmour) dealt = Delve.applyMonsterArmour(m, dealt);
 // Piercing eats into that armour, after the fact: a rank of 0.5 removes half a
 // point per hit, which is what makes a plated enemy approachable.
 if(m._pierce) dealt = Math.max(1, Math.round(dealt + m._pierce));

 // Twin Fang: every third swing strikes a second time.
 G._swingCount = (G._swingCount || 0) + 1;
 if(TB().twinFang && G._swingCount % 3 === 0 && dealt > 0){
  dealt *= 2;
  Delve.addFloater("TWIN", m.x, m.y - 0.9, "#c2ff4d", 1.2);
 }

 if(dealt > 0){
 // Enrage: a monster with `enrageAt` (a HP fraction) gets faster and hits
 // harder once it drops below that line. It exists so kill ORDER matters — a
 // room with two enraging enemies is a different problem from a room with one,
 // and the player can choose to burst one down before it flips.
 if(m.enrageAt > 0 && !m.enraged && m.maxHp > 0 && (m.hp - dealt) / m.maxHp <= m.enrageAt){
  m.enraged = true;
  m.atk = Math.round(m.atk * 1.4);
  m.speed = (m.speed || 1) * 1.3;
  if(Delve.addFloater) Delve.addFloater("ENRAGED", m.x, m.y - 0.7, "#ff6b5e", 1.4);
  if(Delve.addShake) Delve.addShake(3);
  if(Delve.sfx) Delve.sfx("elite_kill", { monster: m.kind });
  if(Delve.logSystem) Delve.logSystem((m.name || "It") + " is enraged!");
 }
 Delve.addFloater(isCrit ? ("CRIT " + dealt) : ("-" + dealt), m.x, m.y, isCrit ? "#ff9d3d" : "#ffd75e", isCrit ? 1.5 : 1);
 if(isCrit) Delve.addShake(2);   // a crit should be felt, not just read (§Batch 15)
 if(!isCrit && Delve.sfx) Delve.sfx("hit", { weapon: weaponStyle });
 if(Delve.logPlayerAtk) Delve.logPlayerAtk(m.name || m.kind || "enemy", dealt, isCrit);
 Delve.recordStat("damageDealt", dealt);
 m.hp -= dealt;
 }

 // Weapon on-hit status (poison/bleed/burn from item)
 const equip = G.equip || {};
 const wpn = equip.weapon;
 const ws = wpn && Delve.weaponStatus ? Delve.weaponStatus(wpn) : null;
 if(ws && m.hp > 0 && Math.random() < ws.chance){
 if(Delve.applyEffect) Delve.applyEffect(m, ws.kind);
 Delve.addFloater(Delve.CONFIG.STATUS_EFFECTS[ws.kind].name.toUpperCase(), m.x, m.y - 0.6, Delve.CONFIG.STATUS_EFFECTS[ws.kind].color);
 }

 // Vampiric Strike: crits heal for half damage
 if(isCrit && tb().vampiric){
 const heal = Math.round(dmg / 2 * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 }
 // Reaver: a crit heals a flat amount, stacking with Vampiric Strike.
 if(isCrit && TB().healOnCrit){
  const h = Math.round(TB().healOnCrit * (Delve.healMult ? Delve.healMult() : 1));
  if(h > 0){ G.hp = Math.min(Delve.maxHp(), G.hp + h); Delve.addFloater("+" + h, G.px, G.py, "#7ee08a"); }
 }

 if(m.hp <= 0){
 if(Delve.hasOverkill()){
 const excess = -m.hp;
 const okPct = (Delve.overkillPct && Delve.overkillPct() > 0) ? Delve.overkillPct() : sec.overkillHealPct;
 const heal = Math.round(excess * okPct * (Delve.healMult ? Delve.healMult() : 1));
 if(heal > 0){
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 if(Delve.logHeal) Delve.logHeal(heal, "Overkill");
 }
 }
 Delve.killMonster(m);
 Delve.endCombat(false);
 }
 }

 // Boss shield (Batch 18 — the Bonefather's ribcage, generic for future bosses).
 // A boss with shieldHp > 0 soaks damage into the shield first; only the
 // remainder reaches HP. The ribs do not regrow: once the shield breaks it
 // stays broken (m.shieldBroken), which render.js uses to swap the art to the
 // boss's exposed form. Returns the damage that actually reached HP.
 Delve.absorbBossShield = function(m, dmg){
  if(!m || !m.isBoss || !(m.shieldHp > 0)) return dmg;
  const absorbed = Math.min(m.shieldHp, dmg);
  m.shieldHp -= absorbed;
  Delve.addFloater("ribs -" + absorbed, m.x, m.y, "#e8dcc0");
  if(Delve.logPlayerAtk) Delve.logPlayerAtk((m.name || "boss") + " (ribs)", absorbed, false);
  if(m.shieldHp <= 0){
   m.shieldHp = 0;
   if(!m.shieldBroken){
    m.shieldBroken = true;   // Act 2 begins — and stays begun
    Delve.flash("THE RIBS SHATTER!");
    Delve.addFloater("THE HEART IS EXPOSED", m.x, m.y - 0.8, "#ff9d3d", 1.3);
    Delve.addShake(5);
    if(Delve.sfx) Delve.sfx("crit", { weapon: "bone" });
    if(Delve.logSystem) Delve.logSystem("The ribcage breaks — the black heart is exposed!");
   }
  }
  return dmg - absorbed;
 };

 // ── Monster armour ───────────────────────────────────────────
 // A flat damage reduction per hit, carried on the roster row (`armour`). Unlike
 // the boss shield this never breaks, so the answer is not "keep hitting it" but
 // "hit it harder or differently" — it rewards the player who reads the room and
 // swaps to a heavier weapon, and it makes a Furnace Guard feel like a wall
 // rather than a slow rat.
 //
 // Capped so armour can never make a monster unkillable: it always leaves at
 // least 1 damage, and it is a flat subtraction applied AFTER the trait and buff
 // maths, not a percentage, so its effect is predictable at every depth.
 Delve.applyMonsterArmour = function(m, dmg){
  if(!m || !(m.armour > 0)) return dmg;
  const after = Math.max(1, dmg - m.armour);
  if(after < dmg && Delve.addFloater) Delve.addFloater("armour " + (dmg - after), m.x, m.y, "#9fb3c5");
  return after;
 };

 // helper for trait buffs inside combat tick
 const tb = () => Delve.traitBuffs ? Delve.traitBuffs() : {};

 // Test hook: monsterSwing runs off an interval timer, so a headless test cannot
 // step it one swing at a time without waiting real time. Exposing it lets the
 // suite verify the boss chain blow directly (it is otherwise only reachable
 // through a running auto-combat).
 Delve._swingForTest = function(m){ return monsterSwing(m); };
 // The same hook for the player's swing, so the suite can drive a hit (and the
 // monster-side reactions it triggers: armour, enrage, split, rebirth) without
 // waiting on the 600ms auto-combat timer.
 Delve._playerSwingForTest = function(m){ return playerSwing(m); };

 // ── Monster swing (DOTs tick at start of its cycle) ──────────
 function monsterSwing(m){
 const G = Delve.G, sec = C().secondaries;

 if(Delve.tickMonsterEffects && Delve.tickMonsterEffects(m)){
 Delve.killMonster(m);
 Delve.endCombat(false);
 return;
 }

 m.hasActed = true;
 m.attackFlash = Date.now();   // render.js telegraphs this as a lunge

 // Set when this swing was the boss's chain blow. The normal-hit block below is
 // skipped in that case (the chain IS the hit for this turn — running both
 // would deal 52 + 26 in one swing), but the death-save checks still run,
 // which is the whole point of routing the chain through this path.
 let chainLanded = false;
 if(m.isBoss && m.chainHitEvery){
 m.chainHitCount = (m.chainHitCount || 0) + 1;
 if(m.chainHitCount % m.chainHitEvery === 0){
 // The chain hit used to be raw `G.hp -= m.atk * 2`: no armour, no dodge, and
 // it called Delve.die() directly, so it killed straight through Second Wind,
 // Unbroken and Last Stand. On the Forge Titan (26 ATK -> 52 a chain) that is
 // the difference between a hard fight and an unavoidable one. It keeps its
 // identity — a heavier, telegraphed blow — but now travels the same
 // mitigation route as a normal hit and respects the death saves.
 //
 // The dodge roll stays, but is applied here explicitly so a chain can still
 // be slipped; the intent is "hard to survive", not "cannot be avoided".
 if(Math.random() < Delve.dodge()){
  Delve.addFloater("dodged", G.px, G.py, "#c2ff4d");
  if(Delve.sfx) Delve.sfx("dodge");
  if(Delve.logDodge) Delve.logDodge(m.name || "enemy");
  return;
 }
 let chainDmg = Math.max(1, Math.round((m.atk * 2) * (1 - Delve.dmgRed())) - Delve.flatRed());
 if(G.stoneSkin > 0) chainDmg = Math.round(chainDmg * 0.4);
 if(Delve.hasBulwark()) chainDmg = Math.min(chainDmg, Delve.hitCap());
 G.hp -= chainDmg;
 G.playerHit = Date.now();
 Delve.addFloater("CHAIN -" + chainDmg, G.px, G.py, "#c98aff");
 Delve.addShake(4);
 if(Delve.sfx) Delve.sfx("hurt", { monster: m.kind });
 if(Delve.logEnemyAtk) Delve.logEnemyAtk(m.name + " (chain)", chainDmg);
 // Fall through to the shared death-save checks below rather than calling
 // Delve.die() here: Second Wind, Unbroken and Last Stand all live there.
 chainLanded = true;
 }
 }

 if(!chainLanded){
 if(Math.random() < Delve.dodge()){
 Delve.addFloater("dodged", G.px, G.py, "#c2ff4d");
 if(Delve.sfx) Delve.sfx("dodge");
 if(Delve.logDodge) Delve.logDodge(m.name || m.kind || "enemy");
 return;
 }

 let hit = Math.max(1, Math.round(m.atk * (1 - Delve.dmgRed())) - Delve.flatRed());
 if(G.stoneSkin > 0) hit = Math.round(hit * 0.4);
 if(Delve.hasBulwark()) hit = Math.min(hit, Delve.hitCap());

 G.hp -= hit;
 G.playerHit = Date.now();
 Delve.addFloater("-" + hit, G.px, G.py, "#ff5c5c");
 Delve.addShake(1);
 if(Delve.sfx) Delve.sfx("hurt", { monster: m.kind });
 if(Delve.logEnemyAtk) Delve.logEnemyAtk(m.name || m.kind || "enemy", hit);

 // On-hit status: any enemy with an onHitEffect in the roster applies it
 // on a successful hit, at ON_HIT_STATUS_CHANCE.
 const effectId = onHitEffectFor(m);
 if(effectId && Delve.applyPlayerEffect && Math.random() < ON_HIT_STATUS_CHANCE){
 Delve.applyPlayerEffect(effectId);
 const ed = C().STATUS_EFFECTS[effectId];
 if(ed) Delve.addFloater(ed.name.toUpperCase(), G.px, G.py - 0.6, ed.color);
 }
 }   // end of the normal-hit block (skipped when the chain blow landed)

 const swTrigger = (Delve.secondWindTriggerPct && Delve.secondWindTriggerPct() > 0)
 ? Delve.secondWindTriggerPct() : sec.secondWindTrigger;
 if(Delve.hasSecondWind() && !G.secondWindUsed &&
 G.hp <= Math.floor(Delve.maxHp() * swTrigger)){
 const ov = tb().secondWindHealOverride;
 const nodePct = (Delve.secondWindUpgradePct ? Delve.secondWindUpgradePct() : 0);
 // Best source wins: the unique trait, else the node, else the base 30%.
 const pct = Math.max(ov > 0 ? ov : 0, nodePct, sec.secondWindHeal);
 const heal = Math.round(Delve.maxHp() * pct * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 G.secondWindUsed = true;
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 if(Delve.sfx) Delve.sfx("second_wind");
 if(Delve.logSecondWind) Delve.logSecondWind(heal);
 }

 if(G.hp <= 0 && tb().unbroken && !G.unbrokenUsed){
 G.hp = 1; G.unbrokenUsed = true;
 if(Delve.sfx) Delve.sfx("unbroken");
 Delve.flash("Unbroken! Survived at 1 HP");
 }

 // Last Stand (shard-tree node): one save per floor, tracked separately from
 // the run-trait versions above, so a lucky trait and the node both count.
 if(G.hp <= 0 && Delve.hasLastStand && Delve.hasLastStand() && !G.lastStandUsed){
 G.hp = 1; G.lastStandUsed = true;
 if(Delve.sfx) Delve.sfx("unbroken");
 Delve.flash("Last Stand! Survived at 1 HP");
 }

 if(G.hp <= 0){ Delve.die(); Delve.endCombat(false); }
 }

 // ── Enemies turn (ambient attacks) ───────────────────────────
 // Stays here: it is monsters attacking you, and it shares
 // ON_HIT_STATUS_CHANCE / onHitEffectFor with monsterSwing.
 Delve.enemiesTurn = function(){
 const G = Delve.G;
 if(G.hp <= 0 || G.dead || G.runEnded) return;
 if(G.stoneSkin > 0) G.stoneSkin--;
 if(Delve.tickPlayerEffects) Delve.tickPlayerEffects();
 if(G.hp <= 0 || G.dead || G.runEnded) return;
 if(G.boss && !G.inCombat) ambientMob(G.boss);
 for(const m of G.monsters){
 if(G.hp <= 0 || G.dead || G.runEnded) break;
 if(G.inCombat) continue;
 // A monster that closes the gap spends its turn walking, so it cannot also
 // strike: one step OR one swing per player action. pursuitStep handles the
 // awake/line-of-sight test and returns false for anything still asleep.
 const walked = Delve.pursuitStep ? Delve.pursuitStep(m) : false;
 if(!walked) ambientMob(m);
 }
 };

 function ambientMob(m){
 const G = Delve.G;
 if(Delve.mdist(G.px, G.py, m.x, m.y) === 1){
 m.hasActed = true;
 m.attackFlash = Date.now();   // same telegraph for out-of-combat swings
 if(Math.random() < Delve.dodge()){
 Delve.addFloater("dodged", G.px, G.py, "#c2ff4d");
 if(Delve.sfx) Delve.sfx("dodge");
 if(Delve.logDodge) Delve.logDodge(m.name || "enemy");
 return;
 }
 let hit = Math.max(1, Math.round(m.atk * (1 - Delve.dmgRed())) - Delve.flatRed());
 if(G.stoneSkin > 0) hit = Math.round(hit * 0.4);
 if(Delve.hasBulwark()) hit = Math.min(hit, Delve.hitCap());
 G.hp -= hit; G.playerHit = Date.now();
 Delve.addFloater("-" + hit, G.px, G.py, "#ff5c5c");
 Delve.addShake(1);
 if(Delve.sfx) Delve.sfx("hurt", { monster: m.kind });
 if(Delve.logEnemyAtk) Delve.logEnemyAtk(m.name || "enemy", hit);

 const effectId = onHitEffectFor(m);
 if(effectId && Delve.applyPlayerEffect && Math.random() < ON_HIT_STATUS_CHANCE){
 Delve.applyPlayerEffect(effectId);
 const ed = C().STATUS_EFFECTS[effectId];
 if(ed) Delve.addFloater(ed.name.toUpperCase(), G.px, G.py - 0.6, ed.color);
 }

 if(G.hp <= 0) Delve.die();
 }
 }

 // ── Kill monster ─────────────────────────────────────────────
 Delve.killMonster = function(m){
 const G = Delve.G;
 if(!G || !m) return;
 // The Reassembled (Bone Ossuary): on its first death it reassembles at half
 // HP and keeps fighting — no rewards, no corpse, no floor-clear until the
 // second death actually lands. The gimmick fires from any kill path
 // (weapon, ability, DOT) because they all route through here.
 if(!m.isBoss && m.reassembleOnce && !m.reassembled){
  m.reassembled = true;
  m.hp = Math.max(1, Math.ceil(m.maxHp * 0.5));
  if(G.grid[m.y] && G.grid[m.y][m.x] !== undefined) G.grid[m.y][m.x] = T().MONSTER;
  Delve.flash("IT REASSEMBLES!");
  Delve.addShake(3);
  if(Delve.sfx) Delve.sfx("elite_kill", { monster: m.kind });
  Delve.addFloater("reassembled", m.x, m.y - 0.6, "#e8dcc0", 1.2);
  if(Delve.logSystem) Delve.logSystem(m.name + " drags itself back together.");
  if(Delve.updateHUD) Delve.updateHUD();
  return;
 }
 // The Reforged (Ashen Forge): on death it BREAKS INTO TWO smaller copies. Both
 // must be killed to clear the floor, and each inherits its own reward row
 // ("reforged_shard"), so the halves pay their own, smaller, share — killing
 // one big thing and getting four small ones free would be a shard farm.
 //
 // Placement: the split lands on the dead monster's tile plus the free
 // orthogonal neighbours, so it can never stack on a wall, a prop or the
 // player. If no neighbour is free it still spawns one on its own tile.
 if(!m.isBoss && m.splitOnDeath && !m.hasSplit){
  const spec = m.splitOnDeath;
  const free = [];
  [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
   const x = m.x + d[0], y = m.y + d[1];
   const row = G.grid[y];
   if(!row || row[x] === undefined) return;
   if(row[x] !== T().FLOOR && row[x] !== T().GRASS) return;
   if(x === G.px && y === G.py) return;             // never on the player
   if(Delve.eventAt && Delve.eventAt(x, y)) return; // never on a floor event
   free.push({ x:x, y:y });
  });
  if(free.length && Delve.spawnMonsterAt){
   const count = Math.min(spec.count || 2, free.length);
   let made = 0;
   for(let i = 0; i < count; i++){
    const spot = free[i];
    const child = Delve.spawnMonsterAt(spot.x, spot.y, spec.into);
    if(!child) continue;
    // 25% HP and ATK, per the ward brief. Apply AFTER spawn so the depth
    // scaling the spawner does is kept, then scaled down.
    child.maxHp = Math.max(1, Math.round(child.maxHp * (spec.hpPct || 0.25)));
    child.hp = child.maxHp;
    child.atk = Math.max(1, Math.round(child.atk * (spec.atkPct || 0.25)));
    child.hasSplit = true;                            // fragments never split again
    child.isFragment = true;
    made++;
   }
   if(made){
    // The tile the parent occupied goes back to plain floor; the children hold
    // their own tiles.
    if(G.grid[m.y] && G.grid[m.y][m.x] === T().MONSTER) G.grid[m.y][m.x] = m.tile || T().FLOOR;
    G.monsters = G.monsters.filter(function(x){ return x !== m; });

    // PAY THE PARENT. Returning here skips every payout below in this function
    // (kills stat, gold, drops, shards, XP, energy, death fade), so without this
    // block killing The Reforged would be worth LESS than killing nothing: the
    // halves pay only their own small rows. Award the parent's row now, through
    // the SAME helpers the normal path uses, so the split is a change of shape
    // rather than a loss of value.
    //
    // Delve.killRewards(m) is the single source of truth for the value of a
    // kill (base row + depth curve + elite multiplier + luck). Using it here
    // means an elite Reforged pays its 3x, and the numbers can never drift from
    // the normal path.
    const parentRew = Delve.killRewards ? Delve.killRewards(m) : { gold:0, shards:0, xp:0 };
    const pGold = Math.round(parentRew.gold || 0);
    const pShards = Math.round(parentRew.shards || 0);
    const pXp = Math.round(parentRew.xp || 0);

    Delve.recordStat("kills", 1);
    if(m.elite) Delve.recordStat("elitesKilled", 1);

    if(pGold > 0){
      G.gold += pGold;
      Delve.recordStat("goldEarned", pGold);
    }
    if(pShards > 0){
      G.runShards = (G.runShards || 0) + pShards;
      Delve.recordStat("shardsEarned", pShards);
    }
    if(pXp > 0 && Delve.addXP) Delve.addXP(pXp);

    // Death drops belong to the thing that died. Rolling them at the parent's
    // tile (now free floor) keeps loot placement correct and matches what the
    // player would have received had it simply died.
    if(Delve.rollKillDrop) Delve.rollKillDrop(m.x, m.y, { name:m.name, elite:!!m.elite });
    const splitPotionChance = ((C().ITEMS || {}).drop || {}).potion || 0;
    if(Delve.dropPotion && Math.random() < splitPotionChance){
      Delve.dropPotion(m.x, m.y, 2, { kind:"monster", name:m.name, elite:!!m.elite });
    }
    if(m.elite && C().elite.guaranteedPotion && Delve.dropPotion){
      Delve.dropPotion(m.x, m.y, 2, { kind:"monster", name:m.name, elite:true });
    }
    if(Delve.logKill) Delve.logKill(m.name || m.kind || "enemy", pGold, pShards, false);

    Delve.flash("IT SPLITS!");
    Delve.addShake(3);
    if(Delve.sfx) Delve.sfx("status_burn");
    Delve.addFloater("split", m.x, m.y - 0.6, "#ff8a3d", 1.2);
    if(Delve.logSystem) Delve.logSystem(m.name + " breaks apart!");
    if(Delve.updateHUD) Delve.updateHUD();
    return;
   }
  }
  // No room to split: fall through and let it die normally rather than
  // swallowing the kill.
 }

 // Every death leaves a corpse fade and a beat of hit-stop (§Batch 15). A boss gets a
 // longer freeze — it should land like the end of something.
 hitStop(m.isBoss ? 170 : 70);
 if(Delve.addDeath) Delve.addDeath(m);
 const g = G.grid;
 const buffs = Delve.itemBuffs();
 const rewards = Delve.killRewards(m); // js/rewards.js

 Delve.recordStat("kills", 1);
 if(m.elite) Delve.recordStat("elitesKilled", 1);

 if(m.isBoss){
 G.boss = null;
 const mult = Delve.goldMult ? Delve.goldMult() : 1;
 G.gold += Math.round(rewards.gold * mult);
 Delve.recordStat("goldEarned", Math.round(rewards.gold * mult));
 // Boss floors no longer drop a staircase — the arena stays a clean chamber
 // and the run continues (or ends) from the victory screen. Restore the tile
 // to floor either way so the arena centre never becomes a blocked BOSS tile.
 if(G.floorType === "boss"){
 G.stairs = null;
 g[m.y][m.x] = T().FLOOR;
 } else {
 G.stairs = { x: m.x, y: m.y };
 g[m.y][m.x] = T().STAIR;
 }
 const bossName = m.name || "The Warden";
 Delve.flash(bossName.toUpperCase() + " FALLS!");
 Delve.addShake(6);
 if(Delve.sfx) Delve.sfx("boss_kill", { monster: m.kind });
 if(Delve.logSystem) Delve.logSystem(bossName + " has fallen.");
 if(!G.bossesBeaten) G.bossesBeaten = [];
 const wardIdx = Math.ceil(G.floor / 10);
 if(G.bossesBeaten.indexOf(wardIdx) < 0) G.bossesBeaten.push(wardIdx);
 if(Delve.rollKillDrop) Delve.rollKillDrop(m.x, m.y, { guaranteed:true, minTier:3, name:m.name, elite:false, boss:true });
 // Ward bosses always leave one unique behind (design 3.6).
 if(Delve.dropUnique) Delve.dropUnique(m.x, m.y, "boss", { kind:"boss", name:m.name });
 Delve.triggerVictory(wardIdx);
 } else {
 G.monsters = G.monsters.filter(x => x !== m);
 const mult = Delve.goldMult ? Delve.goldMult() : 1;
 G.goldPiles = G.goldPiles || [];
 // Remember the tile the monster stood on (plain floor or a grass patch) so
 // collecting the pile restores it instead of punching a bare square in a patch.
 G.goldPiles.push({ x: m.x, y: m.y, amount: Math.round(rewards.gold * mult), tile: m.tile || T().FLOOR });
 // Scavenger: flat gold per kill, dropped as its own pile on the same tile so it
 // is collected with the rest. Added after the multiplier so it is predictable.
 if(TB().goldPerKill){
  G.goldPiles.push({ x: m.x, y: m.y, amount: Math.round(TB().goldPerKill), tile: m.tile || T().FLOOR });
 }
 g[m.y][m.x] = T().GOLD;
 Delve.addShake(2);
 if(Delve.sfx) Delve.sfx(m.elite ? "elite_kill" : "kill", { monster: m.kind });
 if(Delve.rollKillDrop) Delve.rollKillDrop(m.x, m.y, { name:m.name, elite:!!m.elite });
 // Potions are their own roll (L5): 7% per kill, independent of gear.
 const potionChance = ((C().ITEMS || {}).drop || {}).potion || 0;
 if(Delve.dropPotion && Math.random() < potionChance){
  Delve.dropPotion(m.x, m.y, 2, { kind:"monster", name:m.name, elite:!!m.elite });
 }
 if(m.elite && C().elite.guaranteedPotion && Delve.dropPotion){
 Delve.dropPotion(m.x, m.y, 2, { kind:"monster", name:m.name, elite:true });
 }
 }

 // run-earned only — committed at a commit point (rewards.js bankRunShards)
 G.runShards += rewards.shards;
 Delve.recordStat("shardsEarned", rewards.shards);

 // floor-clear bonus: granted if this emptied the floor
 if(!m.isBoss && G.monsters.length === 0 && !G.floorCleared){
 G.floorCleared = true;
 const bonus = Delve.floorClearBonus ? Delve.floorClearBonus() : 0;
 if(bonus > 0){
 // run-earned only — see the banking note in killMonster above
 G.runShards += bonus;
 Delve.recordStat("shardsEarned", bonus);
 Delve.addFloater("+" + bonus + "◇ floor cleared", G.px, G.py, "#7ee0ff");
 if(Delve.logSystem) Delve.logSystem("Floor cleared! +" + bonus + " shards");
 }
 // Field Dressing trait: heal per floor cleared. The value was computed in
 // attrs.js but never applied anywhere, so the trait did nothing.
 const perFloor = Delve.traitHealPerFloor ? Delve.traitHealPerFloor() : 0;
 if(perFloor > 0){
 const heal = Math.round(perFloor * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + heal);
 Delve.addFloater("+" + heal, G.px, G.py, "#7ee08a");
 if(Delve.logHeal) Delve.logHeal(heal, "Field Dressing");
 }
 }

 Delve.persist();

 if(Delve.logKill) Delve.logKill(m.name || m.kind || "enemy", rewards.gold, rewards.shards, m.isBoss);

 // Item life-steal AND the Bloodthirst passive land here. The trait half used
 // to be aggregated but never read, so the card healed for nothing.
 const lifeSteal = ((buffs && buffs.healOnKill) || 0) + (tb().healOnKill || 0);
 if(lifeSteal > 0){
 const steal = Math.round(lifeSteal * (Delve.healMult ? Delve.healMult() : 1));
 G.hp = Math.min(Delve.maxHp(), G.hp + steal);
 Delve.addFloater("+" + steal, G.px, G.py, "#7ee08a");
 if(Delve.logHeal) Delve.logHeal(steal, "Life Steal");
 }
 if(Delve.addXP) Delve.addXP(rewards.xp);
 const eGain = C().energyPerKill + (tb().extraEnergyPerKill || 0) + (Delve.energyPerKillBonus ? Delve.energyPerKillBonus() : 0);
 G.energy = Math.min(Delve.energyCap ? Delve.energyCap() : 100, (G.energy || 0) + eGain);

 // Death burst (Shatterling): if the player is standing beside it when it dies,
 // the shell shatters. Flat damage reduced by armour like a normal hit, but no
 // dodge roll — it is contact, not an attack. Second Wind / Last Stand still save.
 const burstRow = Delve.rowFor ? Delve.rowFor(m.kind) : null;
 const burstDmg = (burstRow && burstRow.deathBurst) ? burstRow.deathBurst : 0;
 if(burstDmg > 0 && !G.dead && !G.runEnded && Delve.mdist(m.x, m.y, G.px, G.py) <= 1){
 const hit = Math.max(1, Math.round(burstDmg * (1 - Delve.dmgRed()) - Delve.flatRed()));
 G.hp -= hit;
 Delve.addFloater("-" + hit + " shatter", G.px, G.py, "#a8e8ff");
 if(Delve.logSystem) Delve.logSystem((m.name || "It") + "'s shell shatters — " + hit + " damage!");
 Delve.addShake(3);
 if(Delve.sfx) Delve.sfx("status_chill");
 if(G.hp <= 0) Delve.die();
 }
 };

 // ── Victory ──────────────────────────────────────────────────
 Delve.triggerVictory = function(wardIdx){
 const G = Delve.G;
 const idx = wardIdx || Math.ceil(G.floor / 10);
 if(!G._victoriesProcessed) G._victoriesProcessed = [];
 if(G._victoriesProcessed.indexOf(idx) >= 0) return;
 G._victoriesProcessed.push(idx);

 G.inCombat = false;
 if(G.combatTimer){ clearInterval(G.combatTimer); G.combatTimer = null; }

 // Gold is NOT converted here. The player is about to choose "descend deeper" or
 // "return to hub", and the design (items_overhaul L11) is that gold only turns
 // into shards when they LEAVE the dungeon. Kill/floor shards still bank here,
 // because clearing a ward is a commit point.
 const totalBanked = Delve.bankRunShards(); // commit point

 Delve.recordStat("victories", 1);
 if(Delve.sfx) Delve.sfx("victory");

 // canContinue: offer "Descend deeper" only if a deeper ward actually exists.
 // Data-driven — adding a biome no longer needs an edit here.
 const canContinue = (Delve.CONFIG.WARDS || []).some(function(w){ return w.id > idx; });

 // Finishing the deepest ward is the end of the run. Record it: the flag is
 // purely a record today (there is no New Game+ yet), but it means a future
 // endgame can read "already finished" without a save migration, and the hub
 // can badge a completed save.
 if(!canContinue){
  if(!Delve.save) Delve.save = {};
  Delve.save.clearedWard5 = true;
  if(Delve.persist) Delve.persist();
  if(Delve.recordStat) Delve.recordStat("gameCompleted", 1);
 }

 // wardIdx is passed so the cleared screen can pull that ward's own heading,
 // boss name, paragraph and accent (CONFIG.WARDS[n].cleared) instead of
 // showing one generic "WARD CLEARED" for all five.
 if(Delve.showVictory) Delve.showVictory(totalBanked, canContinue, { wardIdx: idx });
 else Delve.flash("WARD CLEARED! +" + totalBanked + " shards");

 Delve.updateHUD();
 Delve.draw();
 };

 // ── Die ────────────────────────────────────────────────────────
 Delve.die = function(){
 const G = Delve.G;
 if(G.dead || G.runEnded) return;
 G.dead = true;
 G.inCombat = false;
 if(G.combatTimer){ clearInterval(G.combatTimer); G.combatTimer = null; }
 if(Delve.sfx) Delve.sfx("death");
 if(Delve.logDeath) Delve.logDeath();
 Delve.endRun("death", {});
 };
})();
