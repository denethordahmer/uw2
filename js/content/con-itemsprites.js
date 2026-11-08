window.Delve = window.Delve || {};
(function(){

 // con-itemsprites.js : ALL item art. Procedural 24x24 pixel art, same
 // language as the monsters (rectangles, hard palette, no gradients).
 //
 // Not 60 hand-drawn sprites: one silhouette per slot, one per weapon family,
 // recoloured by quality band. Bands change MATERIAL and ORNAMENT, so
 // iron -> verdigris steel -> blue steel -> gold reads instantly on the floor:
 //   1 Common     dull iron, no ornament
 //   2 Uncommon   green-tinted steel, one rivet
 //   3 Rare       blue steel, inset gem
 //   4 Legendary  gold fittings, gem + rim light + sparkle
 // Uniques reuse their slot silhouette with a bespoke accent colour and an aura,
 // so every unique is identifiable at a glance without twelve more painters.

 const U = Delve._spriteUtils || {};
 const mk = U.mk, gx = U.gx, R = U.R;

 const BAND = {
  1: { main:"#8d95a0", dark:"#5b626d", edge:"#b6bdc7", gem:"#6f7783", accent:"#cfd8e0", fancy:0 },
  2: { main:"#6f9078", dark:"#46604e", edge:"#a8c9ae", gem:"#7ee08a", accent:"#7ee08a", fancy:1 },
  3: { main:"#6f86b8", dark:"#46557a", edge:"#a8bce8", gem:"#7ea8e8", accent:"#7ea8e8", fancy:2 },
  4: { main:"#c9a343", dark:"#7e6423", edge:"#ffe9a3", gem:"#ffd75e", accent:"#ffd75e", fancy:3 }
 };

 const WOOD = "#6b4a2a", WOOD_L = "#8a6338", WOOD_D = "#4d3622";

 // ── Weapons (drawn pointing up, hilt at the bottom) ────────────
 function paintWeapon(x, style, m){
  const st = m.main, dk = m.dark, ed = m.edge, gd = m.gem;
  if(style === "dagger"){
   R(x,12,3,2,9,st); R(x,13,3,1,9,ed); R(x,12,3,1,9,dk);
   R(x,10,12,6,2,gd); R(x,11,14,4,2,dk);
   R(x,11,16,4,2,WOOD); R(x,11,18,4,1,WOOD_D); R(x,12,19,2,1,gd);
  } else if(style === "sword"){
   R(x,11,1,3,13,st); R(x,13,1,1,13,ed); R(x,11,1,1,13,dk);
   R(x,7,13,11,2,gd); R(x,7,13,11,1,ed);
   R(x,11,15,3,4,WOOD); R(x,11,19,3,1,WOOD_D); R(x,12,20,1,2,gd);
  } else if(style === "spear"){
   R(x,11,1,2,8,st); R(x,12,1,1,8,ed); R(x,11,1,1,8,dk);
   R(x,9,8,6,2,gd);
   R(x,11,10,2,13,WOOD); R(x,11,10,1,13,WOOD_L);
   R(x,10,13,1,3,dk); R(x,13,16,1,3,dk);
  } else if(style === "axe"){
   R(x,12,2,2,18,WOOD); R(x,12,2,1,18,WOOD_L);
   R(x,5,3,8,7,st); R(x,5,3,8,2,ed); R(x,4,5,2,4,dk); R(x,11,9,2,4,dk);
   R(x,13,6,1,1,gd);
  } else {                     // hammer
   R(x,12,2,2,10,WOOD); R(x,12,2,1,10,WOOD_L);
   R(x,5,10,14,7,st); R(x,6,11,12,2,ed); R(x,5,16,14,1,dk);
   R(x,7,12,2,3,gd); R(x,15,12,2,3,gd);
  }
 }

 // ── Armour & accessories ─────────────────────────────────────
 function paintSlot(x, slot, m){
  const st = m.main, dk = m.dark, ed = m.edge, gd = m.gem;

  if(slot === "offhand"){
   R(x,4,4,16,2,ed);
   R(x,5,6,14,8,st);
   R(x,5,6,2,8,dk);
   R(x,17,6,2,8,dk);
   R(x,7,14,10,2,dk);
   R(x,9,16,6,2,dk);
   R(x,11,18,2,2,dk);
   R(x,11,8,3,3,gd);
   return;
  }

  if(slot === "head"){
   R(x,6,5,12,2,ed);
   R(x,5,7,14,6,st);
   R(x,5,7,2,6,dk);
   R(x,17,7,2,6,dk);
   R(x,5,13,4,8,st);
   R(x,15,13,4,8,st);
   R(x,7,9,4,2,"#12181f");
   R(x,13,9,4,2,"#12181f");
   R(x,11,2,2,4,gd);
   return;
  }

  if(slot === "body"){
   R(x,5,5,14,12,st);
   R(x,5,5,14,1,ed);
   R(x,5,5,2,12,dk);
   R(x,17,5,2,12,dk);
   R(x,9,5,6,5,dk);
   R(x,9,5,6,1,ed);
   R(x,11,12,2,5,gd);
   R(x,5,17,4,4,st);
   R(x,15,17,4,4,st);
   return;
  }

  if(slot === "hands"){
   R(x,7,7,10,8,st);
   R(x,7,7,10,1,ed);
   R(x,7,7,2,8,dk);
   R(x,7,15,3,5,st);
   R(x,11,15,3,5,st);
   R(x,15,15,2,4,st);
   R(x,9,10,6,2,gd);
   return;
  }

  if(slot === "feet"){
   R(x,7,4,6,12,st);
   R(x,7,4,6,1,ed);
   R(x,7,4,2,12,dk);
   R(x,7,15,12,5,st);
   R(x,7,19,12,1,"#2b2118");
   R(x,9,8,2,3,gd);
   return;
  }

  if(slot === "cloak"){
   R(x,6,4,12,3,dk);
   R(x,5,6,14,14,st);
   R(x,5,6,2,14,dk);
   R(x,17,6,2,14,dk);
   R(x,4,9,2,10,dk);
   R(x,18,9,2,10,dk);
   R(x,11,4,2,2,gd);
   return;
  }

  if(slot === "amulet"){
   R(x,6,3,3,2,"#7f8b99");
   R(x,15,3,3,2,"#7f8b99");
   R(x,8,5,2,5,"#7f8b99");
   R(x,14,5,2,5,"#7f8b99");
   R(x,9,10,6,2,ed);
   R(x,10,12,4,1,st);
   R(x,9,13,6,4,st);
   R(x,11,14,2,2,gd);
   return;
  }

  R(x,8,10,8,2,st);
  R(x,8,16,8,2,st);
  R(x,7,12,2,4,st);
  R(x,15,12,2,4,st);
  R(x,7,12,1,4,dk);
  R(x,16,12,1,4,dk);
  R(x,10,7,4,3,ed);
  R(x,11,8,2,2,gd);
 }

 // Band ornament: Common stays plain, Legendary gets sparkles.
 function ornament(x, m){
  if(m.fancy >= 1){
   R(x,6,17,1,1,m.edge);
   R(x,17,6,1,1,m.edge);
  }
  if(m.fancy >= 2){
   R(x,11,3,2,1,m.gem);
   R(x,3,11,1,2,m.gem);
  }
  if(m.fancy >= 3){
   R(x,2,2,1,1,"#fff8d0");
   R(x,21,3,1,1,"#fff8d0");
   R(x,3,21,1,1,"#fff8d0");
   R(x,20,20,1,1,"#fff8d0");
  }
 }

 // ── Consumables ──────────────────────────────────────────────
 // One silhouette per FUNCTION, not one for all 24 potions. Before this, every
 // consumable in the game drew the same "potionPile" world sprite, so a Small
 // Draught and a Salve of the Deep were indistinguishable on the floor. Kind
 // comes from the item def (`kind: heal|buff|cure|utility`), and a colour accent
 // comes from what it actually does, so the art also hints at the effect.
 const CONSUMABLE_KINDS = {
  heal:    { glass:"#cfe8f2", liquid:"#d23b4a", dark:"#8e1f2c", bubble:"#ff9aa4" },
  buff:    { glass:"#f2e6cf", liquid:"#e0a13a", dark:"#9c6a14", bubble:"#ffe08a" },
  cure:    { glass:"#d8f0e2", liquid:"#3fa86a", dark:"#1f6b3f", bubble:"#9ef0c0" },
  utility: { glass:"#dfe3ea", liquid:"#6f7f95", dark:"#3d4a5c", bubble:"#c2d2e6" }
 };
 function paintConsumable(x, kind, band){
  const k = CONSUMABLE_KINDS[kind] || CONSUMABLE_KINDS.heal;
  const cork = "#8a5a33", corkD = "#5d3c20";
  if(kind === "utility"){
   // A little satchel/tool bundle rather than a bottle: torches, rope, maps and
   // whetstones are not drinks.
   R(x,6,10,12,11,"#6b4a2a"); R(x,6,10,12,1,"#8a6338");
   R(x,8,7,8,4,"#7d5730"); R(x,8,7,8,1,"#a07a46");
   R(x,11,4,2,4,"#c9a343"); R(x,10,3,4,1,"#e8c86a");
   R(x,6,14,12,1,"#4d3622"); R(x,13,15,3,4,"#c9a343");
   R(x,9,19,2,1,"#4d3622");
   if(band >= 3){ R(x,16,11,1,1,"#ffe08a"); R(x,7,18,1,1,"#ffe08a"); }
   return;
  }
  // Bottle: neck, shoulders, body, and a liquid line that rises with the band.
  R(x,10,3,4,4,k.glass); R(x,10,3,4,1,"#ffffff");
  R(x,9,2,2,1,cork); R(x,13,2,2,1,corkD);
  R(x,8,6,8,2,k.glass); R(x,8,6,8,1,"#ffffff");
  R(x,6,8,12,13,k.glass); R(x,6,8,12,1,"#ffffff");
  R(x,6,20,12,1,k.dark);
  // liquid: fills more of the bottle at a higher band
  const top = band >= 3 ? 9 : band === 2 ? 11 : 13;
  R(x,7,top,10,20-top,k.liquid);
  R(x,7,top,10,1,k.bubble);
  R(x,7,top,2,20-top,k.dark);
  R(x,8,top+2,1,3,"#ffffff");
  // a bubble or two
  R(x,11,top+3,1,1,k.bubble);
  if(band >= 2) R(x,13,top+5,1,1,k.bubble);
  // rare/lock: a stopper seal and a glint
  if(band >= 3){
   R(x,8,4,8,1,"#e8dcc0");
   R(x,16,10,1,1,"#fff8d0"); R(x,6,17,1,1,"#fff8d0");
  }
 }

 function build(slot, band, style){
  const c = mk(24,24);
  const x = gx(c);
  const m = BAND[band] || BAND[1];
  if(slot === "weapon") paintWeapon(x, style || "sword", m);
  else paintSlot(x, slot, m);
  ornament(x, m);
  return c;
 }
 function buildConsumable(kind, band){
  const c = mk(24,24);
  paintConsumable(gx(c), kind, band);
  return c;
 }

 // ── Registration ─────────────────────────────────────────────
 const SLOTS = ["offhand","head","body","hands","feet","cloak","amulet","ring"];
 SLOTS.forEach(function(slot){
  [1,2,3,4].forEach(function(b){
   Delve.registerItemSprite(slot + ":" + b, function(){ return build(slot, b, "sword"); });
  });
 });

 const FAMS = ["dagger","sword","spear","axe","hammer"];
 FAMS.forEach(function(f){
  [1,2,3,4].forEach(function(b){
   Delve.registerItemSprite("weapon:" + f + ":" + b, function(){ return build("weapon", b, f); });
  });
 });

 // consumable:<kind>:<tier> — one silhouette per function, at four fill levels.
 ["heal","buff","cure","utility"].forEach(function(kind){
  [1,2,3,4].forEach(function(b){
   Delve.registerItemSprite("consumable:" + kind + ":" + b,
     function(){ return buildConsumable(kind, b); });
  });
 });

 // ── Accessor ─────────────────────────────────────────────────
 // Uniques reuse their slot/family silhouette and get an accent wash + aura,
 // so all twelve are distinct without twelve more painters.
 const ACCENTS = ["#8ef0c0","#ffe08a","#ff9d6b","#c9c2ff","#8fd4ff","#b0e8a0",
                  "#ffb3c8","#9fe8e0","#e0c8ff","#ffd75e","#ffc2a0","#a0ffd0"];
 const cache = {};

 Delve.uniqueAccent = function(id){
  const list = Delve.ITEM_UNIQUES || [];
  for(let i = 0; i < list.length; i++) if(list[i].id === id) return ACCENTS[i % ACCENTS.length];
  return ACCENTS[0];
 };

 // ── Bespoke unique marks ─────────────────────────────────────
 // A flat 40% tint made all twelve uniques read as "the same item, in a
 // different colour" — which undercut the whole point of hand-written lore and
 // distinct mechanics. Each unique now gets a small ORNAMENT drawn over its
 // silhouette, chosen to picture what the item actually DOES:
 //
 //   Thornbite        three poison barbs down the blade
 //   Sunsplinter      a sunburst at the guard, a light streak up the blade
 //   Gravemaker       a hammer-head crack widening down the haft
 //   Bastion of Ash   an ash-grey chevron plate over a warm rim
 //   Cartographer's Eye  an eye where the brow would be
 //   Shroud of the Deep  a slow wave of shadow across the chest
 //   Gravewright's Grips  soil crust at the knuckles
 //   Silent Step      a footprint, faint
 //   Mothlight Mantle a moth at the shoulder
 //   The Ninth Coin   a coin face at the collar
 //   Loop of Small Mercies  a small cross at the band
 //   Band of the Ledger  tally marks around the band
 //
 // Each is 3-8 rects, in the same 24x24 language as everything else.
 const MARKS = {
  thornbite: function(x, a){
   for(let i = 0; i < 3; i++){
    const y = 4 + i * 3;
    R(x, 14, y, 2, 1, a); R(x, 15, y - 1, 1, 1, "#9fe8b0");
    R(x, 16, y, 1, 1, "#7ee08a");
   }
  },
  sunsplinter: function(x, a){
   R(x, 9, 12, 3, 1, "#ffe9a3"); R(x, 11, 10, 1, 3, "#ffe9a3");
   R(x, 8, 11, 1, 1, a); R(x, 12, 14, 1, 1, a);
   R(x, 13, 2, 1, 6, "#fff6cf");          // light up the blade
  },
  gravemaker: function(x, a){
   R(x, 12, 4, 1, 8, "#2a1a14");          // crack down the haft
   R(x, 12, 7, 2, 1, "#2a1a14");
   R(x, 9, 3, 6, 1, a);                   // struck face
  },
  bastion_of_ash: function(x, a){
   R(x, 8, 13, 8, 2, "#ff9d3d");          // warm rim — "still warm"
   R(x, 10, 10, 4, 1, a); R(x, 9, 11, 6, 1, a);   // chevron
   R(x, 11, 12, 2, 1, "#8d95a0");
  },
  cartographers_eye: function(x, a){
   R(x, 9, 8, 6, 3, a); R(x, 10, 9, 4, 1, "#06121a");
   R(x, 11, 9, 2, 1, "#7ee0ff");          // the pupil looks down
   R(x, 11, 11, 1, 1, "#cfd8e0");
  },
  shroud_of_the_deep: function(x, a){
   R(x, 7, 9, 10, 1, "#0b1120"); R(x, 8, 11, 8, 1, a); R(x, 7, 13, 10, 1, "#0b1120");
   R(x, 9, 15, 6, 1, a);
  },
  gravewrights_grips: function(x, a){
   R(x, 8, 12, 8, 2, "#5a4a34");          // soil
   R(x, 9, 14, 2, 1, "#5a4a34"); R(x, 13, 14, 2, 1, "#5a4a34");
   R(x, 10, 11, 4, 1, a);
  },
  silent_step: function(x, a){
   R(x, 9, 13, 3, 4, a);                  // sole
   R(x, 10, 11, 2, 1, a); R(x, 10, 17, 2, 1, a);
   R(x, 12, 14, 1, 1, "#0b1120");
  },
  mothlight_mantle: function(x, a){
   R(x, 10, 8, 4, 2, "#fff6cf");          // wings
   R(x, 8, 9, 2, 2, a); R(x, 14, 9, 2, 2, a);
   R(x, 11, 7, 2, 5, "#3a3020");          // body
   R(x, 12, 6, 1, 1, a);
  },
  ninth_coin: function(x, a){
   R(x, 10, 8, 4, 4, a); R(x, 11, 9, 2, 2, "#3a2f10");
   R(x, 11, 10, 1, 1, "#fff6cf");
  },
  small_mercies: function(x, a){
   R(x, 10, 11, 4, 1, a); R(x, 11, 10, 2, 3, a);   // a small cross
  },
  ledger_band: function(x, a){
   for(let i = 0; i < 4; i++) R(x, 8 + i * 2, 11, 1, 2, a);
   R(x, 8, 10, 7, 1, "#3a2f10");
  }
 };

 // The ids that HAVE a mark. Exposed so the test suite can assert that every
 // unique in the pool is covered — a pixel comparison cannot do that, because a
 // headless canvas stub records no pixels through drawImage.
 Delve.uniqueMarkIds = function(){ return Object.keys(MARKS); };

 // Apply a unique's mark over its silhouette. Kept separate from the tint so the
 // mark keeps its own colours (a poison barb should stay green on a gold sword).
 function drawUniqueMark(cv, uid, accent){
  const fn = MARKS[uid];
  if(!fn) return cv;
  const out = mk(cv.width, cv.height), x = gx(out);
  x.drawImage(cv, 0, 0);
  try { fn(x, accent); } catch(_e){ return cv; }
  return out;
 }

 // Generated items carry a BASE slot ("ring"), while the equip map uses ring1 /
 // ring2. Mapping the equip keys back here keeps the lookup correct if an item
 // is ever drawn straight off G.equip (the inventory does exactly that), rather
 // than relying on the generic fallback.
 const SPRITE_SLOT = { ring1:"ring", ring2:"ring" };
 const CONSUMABLE_FN = { heal:"heal", buff:"buff", cure:"cure", utility:"utility" };
 Delve.itemSpriteKey = function(item){
  if(!item) return "weapon:sword:1";
  if(item.slot === "consumable"){
   const kind = CONSUMABLE_FN[item.kind] || "heal";
   return "consumable:" + kind + ":" + (item.tier || 1);
  }
  if(item.slot === "weapon") return "weapon:" + (item.style || "sword") + ":" + (item.tier || 1);
  const slot = SPRITE_SLOT[item.slot] || item.slot || "body";
  return slot + ":" + (item.tier || 1);
 };

 Delve.itemSprite = function(item){
  const key = Delve.itemSpriteKey(item);
  const uid = (item && item.unique) ? item.id : "";
  const ck = key + (uid ? "|" + uid : "");
  if(cache[ck] !== undefined) return cache[ck];

  let cv = null;
  const b = (Delve._itemSpriteBuilders || {})[key];
  if(b){ try { cv = b(); } catch(_e){ cv = null; } }
  // Fallbacks are last-resort only. They read from SPR.world: the old consumable
  // path looked at Delve.SPR.potionPile, which does not exist (the sprite lives
  // at SPR.world.potionPile), so every potion silently drew the generic itemPile.
  if(!cv && Delve.SPR && Delve.SPR.world){
   cv = (item && item.slot === "consumable" && Delve.SPR.world.potionPile)
      || Delve.SPR.world.itemPile || null;
  }
  if(!cv && Delve.SPR && Delve.SPR.itemPile) cv = Delve.SPR.itemPile;
  // Order matters: tint first (so the base reads as "unique material"), then the
  // bespoke mark on top, so the mark's own colours survive.
  if(cv && uid && U.tint) cv = U.tint(cv, Delve.uniqueAccent(uid));
  if(cv && uid) cv = drawUniqueMark(cv, uid, Delve.uniqueAccent(uid));

  cache[ck] = cv;
  return cv;
 };

})();
