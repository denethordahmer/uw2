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

 function build(slot, band, style){
  const c = mk(24,24);
  const x = gx(c);
  const m = BAND[band] || BAND[1];
  if(slot === "weapon") paintWeapon(x, style || "sword", m);
  else paintSlot(x, slot, m);
  ornament(x, m);
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

 Delve.itemSpriteKey = function(item){
  if(!item) return "weapon:sword:1";
  if(item.slot === "consumable") return "consumable";
  if(item.slot === "weapon") return "weapon:" + (item.style || "sword") + ":" + (item.tier || 1);
  return (item.slot || "body") + ":" + (item.tier || 1);
 };

 Delve.itemSprite = function(item){
  const key = Delve.itemSpriteKey(item);
  const uid = (item && item.unique) ? item.id : "";
  const ck = key + (uid ? "|" + uid : "");
  if(cache[ck] !== undefined) return cache[ck];

  let cv = null;
  if(key === "consumable"){
   cv = (Delve.SPR && Delve.SPR.potionPile) ? Delve.SPR.potionPile : null;
  } else {
   const b = (Delve._itemSpriteBuilders || {})[key];
   if(b){ try { cv = b(); } catch(_e){ cv = null; } }
  }
  if(!cv && Delve.SPR && Delve.SPR.itemPile) cv = Delve.SPR.itemPile;
  if(cv && uid && U.tint) cv = U.tint(cv, Delve.uniqueAccent(uid));

  cache[ck] = cv;
  return cv;
 };

})();
