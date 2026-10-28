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

 // The main button's label: CONTINUE for anyone with progress, BEGIN for a save with
 // nothing in it. Called by showTitle(), and again after a RESET.
 function refreshTitleButton(){
  // A run in progress outranks everything else: the button names the floor it will take
  // the player back to, and continuePressed() below resumes it (§6.12).
  if(Delve.hasSavedRun && Delve.hasSavedRun()){
   $("titleContinueBtn").textContent = "FLOOR " + Delve.savedRunFloor();
   // HUB appears only now. With no run parked the main button already leads to the hub, so a
   // second door would be clutter — and it would imply the hub is always a separate place.
   $("titleHubBtn").style.display = "";
   return;
  }
  $("titleHubBtn").style.display = "none";
  $("titleContinueBtn").textContent = isFreshSave() ? "BEGIN" : "CONTINUE";
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
  closeResetConfirm();
  $("titleResetDone").textContent = "";
 }

 // ── RESET (wipe the save) ────────────────────────────────────
 // Two taps on purpose: nothing is deleted until the second one. Sound settings live in
 // sfx.js under their own storage key, so they survive a reset — losing your volume
 // because you reset your game would be silly. See architecture.md §6.11.
 function openResetConfirm(){
  $("titleResetDone").textContent = "";
  $("titleResetBtn").style.display = "none";
  $("titleResetConfirm").classList.add("open");
 }
 function closeResetConfirm(){
  $("titleResetConfirm").classList.remove("open");
  $("titleResetBtn").style.display = "";
 }
 function doReset(){
  if(Delve.resetSave) Delve.resetSave({ silent:true });
  Delve.G = null;                       // no half-finished run left in memory
  closeResetConfirm();
  refreshTitleButton();                 // the main button becomes BEGIN
  $("titleResetDone").textContent = "Progress erased. Everything is back to zero.";
  if(Delve.sfx) Delve.sfx("deny");
 }

 // ── Screens ──────────────────────────────────────────────────
 // Deliberately a close sibling of ui.js's showHub(), minus the hub rendering:
 // same overlays closed, same chrome hidden, same ambience stop.
 Delve.showTitle = function(){
  if(Delve.hideAllScreens) Delve.hideAllScreens();
  $("levelupScreen").style.display = "none";
  if(Delve.setHudVisible) Delve.setHudVisible(false);
  else $("hud").style.display = "none";
  $("abilityBar").style.display = "none";
  if(Delve.setMinimapOpen) Delve.setMinimapOpen(false);
  else $("minimapWrap").style.display = "none";
  const lp = $("logPanel"); if(lp) lp.classList.remove("active");
  const vg = $("combatVignette"); if(vg) vg.classList.remove("active");
  if(Delve.sfxStopAmbience) Delve.sfxStopAmbience();
  closeSettings();
  refreshTitleButton();
  $("titleScreen").style.display = "flex";
 };

 Delve.hideTitle = function(){
  $("titleScreen").style.display = "none";
 };

// ── CONTINUE ─────────────────────────────────────────────────
 // Forward-compatible seam. Nothing saves an in-progress run yet, so today this
 // always falls through to the hub. When run-resume is built it will expose
 // Delve.hasSavedRun() / Delve.resumeRun(), and CONTINUE starts resuming with no
 // change to this file.
 //
 // Owner's decision, 16 Oct: when resume is built, the FLOOR IS REBUILT FRESH and the run
 // REWINDS to how it was when the player entered that floor — gold, items, XP, level,
 // traits and health all as they were on entry. Rewinding is what stops a resumed floor
 // being farmed for chests or monster kills, and rebuilding fresh means the game never has
 // to store a map. See architecture.md §6.12 and cp.txt, "resuming a run".
 function continuePressed(){
  if(Delve.hasSavedRun && Delve.hasSavedRun() && Delve.resumeRun){
   Delve.resumeRun();
   return;
  }
  Delve.showHub();
 }

 // ── Wiring ───────────────────────────────────────────────────
 $("titleContinueBtn").addEventListener("click", continuePressed);
 $("titleHubBtn").addEventListener("click", function(){ Delve.showHub(); });
 $("titleSettingsBtn").addEventListener("click", openSettings);
 $("titleSettingsClose").addEventListener("click", closeSettings);
 $("titleResetBtn").addEventListener("click", openResetConfirm);
 $("titleResetYes").addEventListener("click", doReset);
 $("titleResetNo").addEventListener("click", closeResetConfirm);

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
