window.Delve = window.Delve || {};
(function(){

 // ── menu.js ──────────────────────────────────────────────────
 // The front end: the title screen, its menu, and its settings panel.
 //
 // It owns ONLY what happens before a run starts. Everything during or after a
 // run (hub, HUD, shop, inventory, level-up, pause) belongs to js/ui.js.
 //
 // Load order: AFTER js/ui.js (this file calls Delve.hideAllScreens, exported
 // there) and BEFORE js/main.js, which calls Delve.showTitle() at boot.
 //
 // It defines no name that another file defines, and it overrides nothing.
 //
 // Sound settings live in sfx.js under their own storage key, so this file is a
 // second VIEW onto them, never a second copy: both this panel and the in-run
 // pause menu call the same four sfx.js functions.

 // Guarded lookup with the same contract as ui.js's `$`: a missing id returns an
 // inert stub instead of null, and the miss is recorded in Delve.missingEls so
 // test.html §9 covers this file too.
 const _warned = {};
 function nullEl(id){
  const noop = function(){};
  return {
   id: id, style: {}, dataset: {}, children: [],
   textContent: "", innerHTML: "", value: "", disabled: false,
   classList: { add: noop, remove: noop, toggle: noop, contains: function(){ return false; } },
   addEventListener: noop, appendChild: noop, removeChild: noop
  };
 }
 const $ = function(id){
  const el = document.getElementById(id);
  if(el) return el;
  if(!_warned[id]){
   _warned[id] = 1;
   (Delve.missingEls = Delve.missingEls || []).push(id);
   try { console.warn("menu.js: missing element #" + id); } catch(_e){}
  }
  return nullEl(id);
 };

 // ── "Is there anything to continue?" ─────────────────────────
 // A brand-new save (nothing earned, nothing bought, never descended) gets BEGIN
 // instead of a CONTINUE that leads nowhere. Anything else gets CONTINUE.
 function isFreshSave(){
  const s = Delve.save;
  if(!s) return true;
  if((s.shards || 0) > 0) return false;
  if((s.bestFloor || 1) > 1) return false;
  if(s.nodes && Object.keys(s.nodes).length) return false;
  if(s.abilities && s.abilities.length) return false;
  const lvls = s.lvls || {};
  for(const k in lvls){ if(lvls[k] > 0) return false; }
  return true;
 }

 // ── Settings panel ───────────────────────────────────────────
 // The same four settings as the in-run pause menu, driven through the same
 // sfx.js functions. The ids are title*-prefixed ON PURPOSE: ui.js looks up
 // muteBtn / volumeSlider / musicSlider / hapticsBtn by name at load time, so
 // reusing those ids here would bind ui.js to THIS panel and leave the pause
 // menu dead (see architecture.md §8).
 function syncSettings(){
  if(Delve.sfxGetVolume) $("titleVolumeSlider").value = Delve.sfxGetVolume();
  if(Delve.musicGetVolume) $("titleMusicSlider").value = Delve.musicGetVolume();
  if(Delve.sfxGetHaptics) $("titleHapticsBtn").textContent = Delve.sfxGetHaptics() ? "ON" : "OFF";
  if(Delve.sfxMuted) $("titleMuteBtn").textContent = Delve.sfxMuted() ? "🔇" : "🔊";
 }
 function openSettings(){
  syncSettings();
  $("titleSettingsPane").classList.add("open");
  $("titleButtons").style.display = "none";
 }
 function closeSettings(){
  $("titleSettingsPane").classList.remove("open");
  $("titleButtons").style.display = "flex";
 }

 // ── Screens ──────────────────────────────────────────────────
 // Deliberately a close sibling of ui.js's showHub(), minus the hub rendering:
 // same overlays closed, same chrome hidden, same ambience stop.
 Delve.showTitle = function(){
  if(Delve.hideAllScreens) Delve.hideAllScreens();
  $("levelupScreen").style.display = "none";
  $("hud").style.display = "none";
  $("abilityBar").style.display = "none";
  $("minimapWrap").style.display = "none";
  const lp = $("logPanel"); if(lp) lp.classList.remove("active");
  const vg = $("combatVignette"); if(vg) vg.classList.remove("active");
  if(Delve.sfxStopAmbience) Delve.sfxStopAmbience();
  closeSettings();
  $("titleContinueBtn").textContent = isFreshSave() ? "BEGIN" : "CONTINUE";
  $("titleScreen").style.display = "flex";
 };

 Delve.hideTitle = function(){
  $("titleScreen").style.display = "none";
 };

// ── CONTINUE ─────────────────────────────────────────────────
 // Forward-compatible seam. Nothing saves an in-progress run yet, so today this
 // always falls through to the hub. When run-resume is built it will expose
 // Delve.hasSavedRun() / Delve.resumeRun(), and CONTINUE starts resuming with no
 // change to this file. (Resuming must restore the SAME floor, not regenerate a
 // fresh one — a fresh layout would hand back every chest the player already
 // opened, which is an infinite-loot farm. See cp.txt, "resuming a run".)
 function continuePressed(){
  if(Delve.hasSavedRun && Delve.hasSavedRun() && Delve.resumeRun){
   Delve.resumeRun();
   return;
  }
  Delve.showHub();
 }

 // ── Wiring ───────────────────────────────────────────────────
 $("titleContinueBtn").addEventListener("click", continuePressed);
 $("titleSettingsBtn").addEventListener("click", openSettings);
 $("titleSettingsClose").addEventListener("click", closeSettings);

 $("titleMuteBtn").addEventListener("click", function(){
  const muted = Delve.sfxToggleMute ? Delve.sfxToggleMute() : false;
  $("titleMuteBtn").textContent = muted ? "🔇" : "🔊";
 });
 $("titleVolumeSlider").addEventListener("input", function(){
  if(Delve.sfxSetVolume) Delve.sfxSetVolume(parseFloat(this.value));
 });
 $("titleMusicSlider").addEventListener("input", function(){
  if(Delve.musicSetVolume) Delve.musicSetVolume(parseFloat(this.value));
 });
 $("titleHapticsBtn").addEventListener("click", function(){
  const on = Delve.sfxGetHaptics ? !Delve.sfxGetHaptics() : false;
  if(Delve.sfxSetHaptics) Delve.sfxSetHaptics(on);
  $("titleHapticsBtn").textContent = on ? "ON" : "OFF";
 });

 // No showTitle() call here on purpose. ui.js already builds the hub at load and
 // main.js shows the title last; every script runs in one synchronous pass
 // before the browser's first paint, so the hub underneath is never visible.

})();
