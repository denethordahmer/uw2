window.Delve = window.Delve || {};
Delve.T = { FLOOR:0, WALL:1, STAIR:2, MONSTER:3, BOSS:4, CHEST:5, GOLD:6, ITEM:7, POTION:8, BARREL:9 };
Delve.G = null;

Delve.rng = function(min, max){ return Math.floor(Math.random()*(max-min+1))+min; };
Delve.rngF = function(){ return Math.random(); };
Delve.clamp = function(v,a,b){ return Math.max(a,Math.min(b,v)); };

Delve.flash = function(t){
 if(Delve.G){ Delve.G.msg = t; Delve.G.msgUntil = Date.now()+1400; }
};

Delve.mdist = function(x1,y1,x2,y2){ return Math.abs(x1-x2)+Math.abs(y1-y2); };

Delve.getWard = function(floor){
 const wards = Delve.CONFIG.WARDS || [];
 for(const w of wards){
  if(floor >= w.floors[0] && floor <= w.floors[1]) return w;
 }
 return wards[0] || { id:1, name:"Upper Ruins", floors:[1,10], biome:0 };
};

Delve.getMonsterBand = function(floor){
 const bands = Delve.CONFIG.MONSTER_BANDS || [];
 for(const b of bands){
  if(floor >= b.floors[0] && floor <= b.floors[1]) return b;
 }
 return bands[bands.length-1] || { weights:{goblin:100}, countMin:10, countMax:14, boss:false };
};

Delve.pickWeighted = function(weights){
 let total = 0;
 for(const k in weights) total += weights[k]||0;
 if(total<=0) return Object.keys(weights)[0]||null;
 let roll = Delve.rngF()*total;
 for(const k in weights){ roll -= weights[k]||0; if(roll<=0) return k; }
 return Object.keys(weights)[0];
};

// ── Shop floor helper & heal cost ─────────────────────────────
// MOVED: Delve.isShopFloor and Delve.healCost now live in js/items.js,
// alongside makeShopStock / shopHealCost — all shop-domain logic in one place.
// They load earlier (items.js is position 9, this file is 12) and every caller
// reads them at call time, so no load-order constraint is affected.

// ── Run-stat recorder ─────────────────────────────────────────
Delve.recordStat = function(key, amount){
 const G = Delve.G;
 if(!G) return;
 G.runStats = G.runStats || {};
 G.runStats[key] = (G.runStats[key] || 0) + amount;
};

Delve.newRun = function(){
 Delve.G = {
  dead:false, runEnded:false, floor:1, level:1, xp:0, gold:0,
  energy:(Delve.startEnergy ? Delve.startEnergy() : 10), restCount:0,
  traits:[], abilities:[], takenUniques:[], inventory:[],
  equip:{ weapon:null, offhand:null, head:null, body:null, hands:null, feet:null, cloak:null, amulet:null, ring1:null, ring2:null },
  atkBuff:0, speedBuff:0, redBuff:0, luckBuff:0,
  secondWindUsed:false, unbrokenUsed:false, lastStandUsed:false, victoryDone:false, stoneSkin:0,
  effects:[], runStats:{}, runShards:0, shardsBanked:0,
  combatTarget:null, inCombat:false, combatTimer:null, targetingAbility:null,
  pendingLevelUps:0, levelUpOpen:false,
  lastDir:"right", msg:"", msgUntil:0,
  visited:[], _visitedFloor:-1,
  monsters:[], goldPiles:[], barrels:[], chests:[], items:[], decor:[],
  shop:{ x:-1, y:-1, stock:null }, stairs:null, boss:null, floorData:{},
  px:0, py:0, gridW:0, gridH:0, grid:[]
 };
  Delve.G.hp = Delve.maxHp();

 (Delve._hooks && Delve._hooks.runStart || []).forEach(function(fn){ fn(); });

 Delve.genFloor();
 Delve.updateHUD();
 Delve.setFloorCheckpoint();   // floor 1 is a checkpoint too (§6.12)
};

// ── In-progress run checkpoint (§6.12) ──────────────────────
// Entering a floor records a snapshot of the run as it stands at that moment. If the tab
// is killed before the run ends, that snapshot is what the player comes back to: the SAME
// floor, rebuilt fresh, with gold, items, XP, level, traits and health rewound to how they
// were when they walked in. Anything earned on the abandoned attempt is forfeited — that is
// what stops a resumed floor being farmed for chests and kills, and it is why no map ever
// has to be stored.
// The cost, accepted by the owner on 16 Oct: quitting before the killing blow escapes
// death, paid for with that floor's loot and XP.
//
// The snapshot is the ONE piece of run state that lives in the save file. Shards still only
// reach save.shards at a commit point (§6.10), so this does not reopen that hole.

const CHECKPOINT_FIELDS = [
 "floor","hp","gold","level","xp","energy","restCount",
 "traits","abilities","takenUniques","inventory","equip",
 "atkBuff","speedBuff","redBuff","luckBuff","stoneSkin","floorHealLeft","effects",
 "secondWindUsed","unbrokenUsed","lastStandUsed","victoryDone",
 "runStats","runShards","shardsBanked",
 "_victoriesProcessed","_bonusesApplied"
];

// Deep-copied through JSON on the way out: the run keeps mutating its nested items and
// arrays, so an aliased snapshot would drift along with the live run instead of freezing.
Delve.captureRunSnapshot = function(){
 const G = Delve.G;
 if(!G || G.dead || G.runEnded) return null;
 const snap = {};
 CHECKPOINT_FIELDS.forEach(function(k){ if(G[k] !== undefined) snap[k] = G[k]; });
 try { return JSON.parse(JSON.stringify(snap)); } catch(_err){ return null; }
};

Delve.setFloorCheckpoint = function(){
 if(Delve._suppressCheckpoint) return;   // test.html sets this — see its header comment
 if(!Delve.save) return;
 const snap = Delve.captureRunSnapshot();
 if(!snap) return;
 Delve.save.run = snap;
 Delve.persist();
};

Delve.clearRunCheckpoint = function(){
 if(!Delve.save || !Delve.save.run) return;
 Delve.save.run = null;
 Delve.persist();
};

Delve.hasSavedRun = function(){
 return !!(Delve.save && Delve.save.run && Delve.save.run.floor >= 1);
};

Delve.savedRunFloor = function(){
 return Delve.hasSavedRun() ? Math.round(Delve.save.run.floor) : 0;
};

// "Is a run unfinished?" — the question the hub asks before it takes any shards. True while a
// run is parked in the save (§6.12), and also while a live run is still going, so the two
// cannot drift apart. The owner's rule, 16 Oct: shards are spendable only once the run they
// were earned in has ended — dying, retreating or winning the ward. That is what lets the hub
// be reachable with a run parked without becoming a mid-run shopping trip.
Delve.runInProgress = function(){
 if(Delve.hasSavedRun && Delve.hasSavedRun()) return true;
 const G = Delve.G;
 return !!(G && !G.runEnded && !G.dead);
};

// Rebuild G from the checkpoint. The caller (ui.js resumeRun) handles the screen.
// newRun() is used deliberately: it builds a correct, fully-formed run object and fires the
// runStart hooks, after which the snapshot overwrites the parts that matter. It is slightly
// wasteful — floor 1 gets generated and thrown away — and worth it, rather than keeping a
// second copy of the run shape in this file for the two to drift apart.
Delve.restoreRunFromCheckpoint = function(){
 if(!Delve.hasSavedRun()) return false;
 const snap = Delve.save.run;       // read before newRun() replaces save.run
 Delve.newRun();
 const G = Delve.G;
 CHECKPOINT_FIELDS.forEach(function(k){ if(snap[k] !== undefined) G[k] = snap[k]; });
 G.floor = Math.max(1, Math.round(snap.floor));
 G.dead = false; G.runEnded = false; G.inCombat = false;
 G.combatTarget = null; G.targetingAbility = null;
 G.pendingLevelUps = 0; G.levelUpOpen = false;
 Delve.genFloor();                  // the same floor, rebuilt fresh — never the same map
 Delve.updateHUD();
 // Re-take the checkpoint for the restored floor. newRun() stamped a floor-1 snapshot on
 // the way through, and if the player quit again before descending that is what they would
 // be sent back to — a rewind all the way to floor 1.
 Delve.setFloorCheckpoint();
 return true;
};
