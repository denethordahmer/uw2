window.Delve = window.Delve || {};
(function(){
  const SAVE_KEY = "underward_save_v4";
  const LEGACY_KEYS = ["underward_save_v3", "delve_save_v1", "underward_save_v2", "underward_save"];
  const ATTR_IDS = ["con", "str", "tou", "luc", "agi", "eng"];

  function makeDefaultLevels(){
    const lvls = {};
    for(const key of ATTR_IDS) lvls[key] = 0;
    return lvls;
  }

  function makeDefaultSave(){
    return {
      version: 4,
      shards: 0,
      bestFloor: 1,
      lvls: makeDefaultLevels(),
      unlocks: {},
      nodes: {},
      inventoryCap: 16,
      abilities: [],
      abilityRanks: {},
      runTraits: [],
      runTraitsSeen: [],
      heirloom: null,            // one item carried through death (js/items.js)
      seenTutorial: false,
      run: null,                 // in-progress run checkpoint (§6.12); null = nothing to resume
      lastUpdated: Date.now()
    };
  }

  function sanitizeNumber(value, fallback){
    if(typeof value === "number" && Number.isFinite(value)) return value;
    return fallback;
  }

  function sanitizeLevels(raw){
    const levels = makeDefaultLevels();
    const src = raw && typeof raw === "object" ? raw : {};
    for(const key of ATTR_IDS) levels[key] = sanitizeNumber(src[key], 0);
    return levels;
  }

  function sanitizeBoolMap(raw){
    const out = {};
    const src = raw && typeof raw === "object" ? raw : {};
    for(const key in src){
      if(src[key] === true || src[key] === 1) out[key] = true;
    }
    return out;
  }

  function sanitizeStringArray(raw){
    if(!Array.isArray(raw)) return [];
    return raw.filter(function(s){ return typeof s === "string"; });
  }

  function sanitizeAbilityRanks(raw){
    const out = {};
    const src = raw && typeof raw === "object" ? raw : {};
    for(const key in src){
      const v = src[key];
      if(typeof v === "number" && Number.isFinite(v)) out[key] = Math.max(0, Math.round(v));
    }
    return out;
  }

  // The in-progress-run checkpoint (§6.12). Deliberately permissive about its innards —
  // the fields are the run object's own — but strict about the two things that matter:
  // it must survive a JSON round-trip, and it must name a real floor. Anything else
  // returns null, which the game reads as "no run to resume".
  // v4 item schema: a gear instance carries a continuous `quality` and (for
  // weapons) an itemMax. Anything older has stale flat-atk gear that would deal
  // nonsense damage with the new range maths, so it is dropped at the door -
  // gold, shards, levels and potions all survive.
  function isCurrentItem(it){
    if(!it || typeof it !== "object") return false;
    if(it.slot === "consumable") return true;
    return typeof it.quality === "number" && it.quality > 0;
  }
  function cleanItems(list){
    if(!Array.isArray(list)) return [];
    return list.filter(isCurrentItem);
  }

  // The heirloom (js/items.js): one carried item kept through a death and
  // returned at the start of the next run. Same schema rule as the bag, and a
  // consumable is never valid — it would be drunk rather than kept.
  function sanitizeHeirloom(raw){
    if(!isCurrentItem(raw)) return null;
    if(raw.slot === "consumable") return null;
    try { return JSON.parse(JSON.stringify(raw)); } catch(_err){ return null; }
  }

  function sanitizeRun(raw){
    if(!raw || typeof raw !== "object") return null;
    const floor = sanitizeNumber(raw.floor, 0);
    if(floor < 1) return null;
    let json;
    try { json = JSON.stringify(raw); } catch(_err){ return null; }
    if(!json || json.length > 40000) return null;   // refuse anything absurd
    try {
      const copy = JSON.parse(json);
      copy.floor = Math.round(floor);
      copy.inventory = cleanItems(copy.inventory);
      copy.items = cleanItems(copy.items);
      if(copy.equip && typeof copy.equip === "object"){
        for(const slot in copy.equip){
          if(!isCurrentItem(copy.equip[slot])) copy.equip[slot] = null;
        }
      }
      return copy;
    } catch(_err){ return null; }
  }

  function migrateSave(raw){
    const base = makeDefaultSave();
    const src = raw && typeof raw === "object" ? raw : {};

    base.version = 4;
    base.shards = sanitizeNumber(src.shards, 0);
    base.bestFloor = sanitizeNumber(src.bestFloor, 1);
    base.lastUpdated = sanitizeNumber(src.lastUpdated, Date.now());
    base.seenTutorial = !!src.seenTutorial;
    base.run = sanitizeRun(src.run);

    if(src.lvls && typeof src.lvls === "object"){
      base.lvls = sanitizeLevels(src.lvls);
    } else {
      if(typeof src.hpLvl === "number") base.lvls.con = src.hpLvl;
      if(typeof src.atkLvl === "number") base.lvls.str = src.atkLvl;
    }

    if(src.unlocks && typeof src.unlocks === "object") base.unlocks = sanitizeBoolMap(src.unlocks);
    if(src.nodes && typeof src.nodes === "object") base.nodes = sanitizeBoolMap(src.nodes);
    if(typeof src.inventoryCap === "number" && Number.isFinite(src.inventoryCap)){
      base.inventoryCap = Math.max(1, Math.round(src.inventoryCap));
    }
    if(Array.isArray(src.abilities)) base.abilities = sanitizeStringArray(src.abilities);
    if(src.abilityRanks && typeof src.abilityRanks === "object") base.abilityRanks = sanitizeAbilityRanks(src.abilityRanks);
    if(Array.isArray(src.runTraits)) base.runTraits = sanitizeStringArray(src.runTraits);
    if(Array.isArray(src.runTraitsSeen)) base.runTraitsSeen = sanitizeStringArray(src.runTraitsSeen);
    base.heirloom = sanitizeHeirloom(src.heirloom);

    return base;
  }

  function safelyParseJSON(value){
    if(typeof value !== "string" || value.trim() === "") return null;
    try { return JSON.parse(value); }
    catch(_err){ return null; }
  }

  function readSaveFromStorage(storageKey){
    try {
      const parsed = safelyParseJSON(localStorage.getItem(storageKey));
      if(parsed && typeof parsed === "object") return migrateSave(parsed);
    } catch(_err) {}
    return null;
  }

  // IMPORTANT: this whitelist must mirror makeDefaultSave()/migrateSave().
  // Any new persisted field must be added in all three places.
  function writeSaveToStorage(storageKey, saveData){
    try {
      const safeSave = {
        version: 4,
        shards: sanitizeNumber(saveData.shards, 0),
        bestFloor: sanitizeNumber(saveData.bestFloor, 1),
        lvls: sanitizeLevels(saveData.lvls),
        unlocks: sanitizeBoolMap(saveData.unlocks),
        nodes: sanitizeBoolMap(saveData.nodes),
        inventoryCap: sanitizeNumber(saveData.inventoryCap, 16),
        abilities: sanitizeStringArray(saveData.abilities),
        abilityRanks: sanitizeAbilityRanks(saveData.abilityRanks),
        runTraits: sanitizeStringArray(saveData.runTraits),
        runTraitsSeen: sanitizeStringArray(saveData.runTraitsSeen),
        heirloom: sanitizeHeirloom(saveData.heirloom),
        seenTutorial: !!saveData.seenTutorial,
        run: sanitizeRun(saveData.run),
        lastUpdated: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(safeSave));
      return safeSave;
    } catch(_err){
      return null;
    }
  }

  // Put `data` into Delve.save WITHOUT replacing the object, so any module
  // holding a reference (const S = Delve.save) stays valid.
  function adopt(data){
    if(Delve.save && typeof Delve.save === "object"){
      for(const k of Object.keys(Delve.save)) delete Delve.save[k];
      Object.assign(Delve.save, data);
    } else {
      Delve.save = data;
    }
    return Delve.save;
  }

  Delve.createDefaultSave = function(){ return makeDefaultSave(); };

  Delve.resetSave = function(options){
    const silent = !!(options && options.silent);
    adopt(makeDefaultSave());
    writeSaveToStorage(SAVE_KEY, Delve.save);
    if(!silent && Delve.flash) Delve.flash("Saved progress reset");
    return Delve.save;
  };

  Delve.loadSave = function(){
    let loaded = readSaveFromStorage(SAVE_KEY);
    if(!loaded){
      for(const key of LEGACY_KEYS){
        loaded = readSaveFromStorage(key);
        if(loaded) break;
      }
    }
    if(!loaded) loaded = makeDefaultSave();
    adopt(loaded);
    writeSaveToStorage(SAVE_KEY, Delve.save);
    return Delve.save;
  };

  // Persist the current Delve.save. Delve.save stays the DATA object.
  Delve.persist = function(){
    if(!Delve.save || typeof Delve.save !== "object") adopt(makeDefaultSave());
    Delve.save.version = 3;
    Delve.save.lastUpdated = Date.now();
    writeSaveToStorage(SAVE_KEY, Delve.save);
  };

  Delve.loadSave();
})();
