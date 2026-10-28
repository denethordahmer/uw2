window.Delve = window.Delve || {};
(function(){
  Delve.canvas = document.getElementById("canvas");
  Delve.ctx = Delve.canvas.getContext("2d");
  Delve.W=0; Delve.H=0; Delve.ts=0; Delve.viewW=0; Delve.viewH=0; Delve.camX=0; Delve.camY=0;

  // --hud-h is the height of the real status strip, measured rather than guessed:
  // it is three bars plus a status row, and on a narrow phone that row can wrap.
  // It has two readers — #app's top padding (the board starts below the strip, so
  // the bars cannot cover the top rows of a room that reaches the map edge) and
  // #minimapWrap's top. Written only when it changes, so the combat HUD loop never
  // forces a layout.
  let hudH = -1, resizing = false;
  function syncHudHeight(){
    const hud = document.getElementById("hud"), root = document.documentElement;
    if(!root || !root.style || !root.style.setProperty) return;
    const h = (hud && hud.offsetHeight) || 0;
    if(h === hudH) return;
    hudH = h;
    root.style.setProperty("--hud-h", h + "px");
    // The canvas box just changed; re-fit the view unless this came from resize().
    if(!resizing && Delve.resize) Delve.resize();
  }
  // The bottom band is reserved the same way: the bag row is always there (52px =
  // 44px buttons + their 8px offset), and the ability bar floats above it and
  // grows as abilities wrap. Measuring it too means no control can cover a tile —
  // without this, a player standing in the last row was behind the buttons.
  let uiBottom = -1;
  function syncBottomInset(){
    const bar = document.getElementById("abilityBar"), root = document.documentElement;
    if(!root || !root.style || !root.style.setProperty) return;
    const barH = (bar && bar.offsetHeight) || 0;
    const need = barH ? Math.max(52, 58 + barH) : 52;
    if(need === uiBottom) return;
    uiBottom = need;
    root.style.setProperty("--ui-bottom-px", need + "px");
    if(!resizing && Delve.resize) Delve.resize();
  }
  Delve.syncHudHeight = syncHudHeight;
  Delve.syncBottomInset = syncBottomInset;

  // The canvas fills #app, and #app is the visible viewport (100dvh). Measuring
  // the box rather than window.inner* is what keeps the board from running under
  // a phone's collapsing URL bar: innerHeight reports the taller layout viewport
  // there, so the bottom rows used to be drawn where they could not be seen.
  Delve.resize = function(){
    resizing = true;
    try {
      // Set the two insets first: the canvas sits inside the padded box, so its
      // size is only correct once those values are written.
      syncHudHeight();
      syncBottomInset();
      const dpr = window.devicePixelRatio || 1;
      const cv = Delve.canvas;
      const vv = window.visualViewport;
      Delve.W = Math.round((cv && cv.clientWidth) || (vv ? vv.width : 0) || window.innerWidth || 1);
      Delve.H = Math.round((cv && cv.clientHeight) || (vv ? vv.height : 0) || window.innerHeight || 1);
      Delve.canvas.width  = Math.round(Delve.W*dpr);
      Delve.canvas.height = Math.round(Delve.H*dpr);
      Delve.canvas.style.width = "100%";
      Delve.canvas.style.height = "100%";
      Delve.ctx.setTransform(dpr,0,0,dpr,0,0);
      Delve.ts = Math.floor(Math.min(Delve.W,Delve.H)/9);
      if(Delve.ts<28) Delve.ts=28;
      Delve.computeView();
    } finally {
      resizing = false;
    }
  };

  Delve.computeView = function(){
    Delve.viewW = Math.floor(Delve.W/Delve.ts);
    Delve.viewH = Math.floor(Delve.H/Delve.ts);
    // Never allow a view larger than the grid — prevents camera weirdness on big tiles/small grids
    if(Delve.G && Delve.G.grid && Delve.G.grid.length){
      Delve.viewW = Math.min(Delve.viewW, Delve.G.grid.length);
      Delve.viewH = Math.min(Delve.viewH, Delve.G.grid[0].length);
    }
  };

  window.addEventListener("resize", function(){
    Delve.resize();
    if(Delve.G) Delve.draw();
  });

  // Allow taps to register even when PWA/standalone misreports sizes
  window.addEventListener("orientationchange", function(){
    setTimeout(function(){ Delve.resize(); if(Delve.G) Delve.draw(); }, 250);
  });

  // A collapsing URL bar changes the visible height without a window resize on
  // some browsers. visualViewport reports it, so the board re-fits instead of
  // leaving its bottom rows under the toolbar.
  if(window.visualViewport && window.visualViewport.addEventListener){
    window.visualViewport.addEventListener("resize", function(){
      Delve.resize();
      if(Delve.G) Delve.draw();
    });
  }

  // Keeps --hud-h honest when the HUD is shown, hidden, wrapped, or the emoji
  // font lands late — without measuring (and forcing layout) on every HUD tick.
  if(window.ResizeObserver){
    const hudEl = document.getElementById("hud"), barEl = document.getElementById("abilityBar");
    if(hudEl) new window.ResizeObserver(function(){ syncHudHeight(); }).observe(hudEl);
    if(barEl) new window.ResizeObserver(function(){ syncBottomInset(); }).observe(barEl);
  }

  Delve.resize();
  // Boot into the title screen. menu.js loads before this file; the fallback
  // keeps the game reachable if that file ever fails to load.
  if(Delve.showTitle) Delve.showTitle(); else Delve.showHub();
})();
