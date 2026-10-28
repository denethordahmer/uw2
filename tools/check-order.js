#!/usr/bin/env node
// check-order.js — keeps the script load order honest.
//
// There is no build step, so index.html MUST physically list its <script> tags
// and js/manifest.js MUST declare the same list. Two lists can drift; this
// script is what stops that happening silently.
//
// It asserts:
//   1. js/manifest.js parses and exposes Delve.MANIFEST
//   2. no duplicate entries in the manifest
//   3. index.html's <script src> tags equal the manifest, in order
//   4. every .js file on disk under js/ is in the manifest (nothing orphaned)
//   5. every manifest entry exists on disk (no ghosts)
//   6. every url() in css/game.css resolves (these are relative to css/, so a
//      path moved out of index.html's inline styles needs a "../")
//   7. every <link href> in index.html resolves (stylesheet, icons, preloads)
//
// Usage:  node tools/check-order.js
// Exit:   0 = consistent, 1 = drift found (safe to run in CI)
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "js", "manifest.js");
const INDEX = path.join(ROOT, "index.html");

let failed = 0;
const fail = msg => { console.log("  ✗ " + msg); failed++; };
const pass = msg => { console.log("  ✓ " + msg); };

// ── 1. load the manifest ───────────────────────────────────────
if(!fs.existsSync(MANIFEST)){
  console.log("✗ js/manifest.js not found");
  process.exit(1);
}
const sandbox = { console, Math };
sandbox.window = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync(MANIFEST, "utf8"), sandbox, { filename: "js/manifest.js" });
} catch(e){
  console.log("✗ js/manifest.js threw: " + e.message);
  process.exit(1);
}
const list = sandbox.Delve && sandbox.Delve.MANIFEST;
if(!Array.isArray(list) || !list.length){
  console.log("✗ js/manifest.js did not expose Delve.MANIFEST (array)");
  process.exit(1);
}
console.log("manifest: " + list.length + " entries");

// ── 2. duplicates ──────────────────────────────────────────────
const seen = {}, dupes = [];
list.forEach(f => { if(seen[f]) dupes.push(f); else seen[f] = 1; });
if(dupes.length) fail("duplicate manifest entries: " + [...new Set(dupes)].join(", "));
else pass("no duplicate entries");

// ── 3. index.html parity ───────────────────────────────────────
if(!fs.existsSync(INDEX)){
  fail("index.html not found");
} else {
  const html = fs.readFileSync(INDEX, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const tags = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while((m = re.exec(html)) !== null){
    const src = m[1].split("?")[0];
    const at = src.indexOf("js/");
    if(at >= 0) tags.push(src.slice(at));
  }
  const tagDupes = [];
  const tseen = {};
  tags.forEach(t => { if(tseen[t]) tagDupes.push(t); else tseen[t] = 1; });
  if(tagDupes.length) fail("index.html loads a script twice: " + [...new Set(tagDupes)].join(", "));

  if(tags.length !== list.length){
    fail("index.html has " + tags.length + " script tags, manifest has " + list.length);
  }
  const n = Math.max(tags.length, list.length);
  let firstBad = -1;
  for(let i = 0; i < n; i++){
    if(tags[i] !== list[i]){ if(firstBad < 0) firstBad = i; }
  }
  if(firstBad < 0){
    pass("index.html matches the manifest exactly (" + tags.length + " scripts, same order)");
  } else {
    fail("index.html differs from manifest at entry " + firstBad);
    for(let i = Math.max(0, firstBad - 1); i < Math.min(n, firstBad + 4); i++){
      console.log("      [" + i + "] manifest: " + (list[i] || "—"));
      console.log("            index.html: " + (tags[i] || "—"));
    }
  }
}

// ── 4/5. disk vs manifest ──────────────────────────────────────
const onDisk = [];
(function walk(dir){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p);
    else if(e.name.endsWith(".js")) onDisk.push(path.relative(ROOT, p).split(path.sep).join("/"));
  }
})(path.join(ROOT, "js"));

const orphans = onDisk.filter(f => list.indexOf(f) < 0);
const ghosts = list.filter(f => !fs.existsSync(path.join(ROOT, f)));

if(orphans.length) fail("js file(s) on disk but NOT in the manifest: " + orphans.join(", "));
else pass("every js file on disk is in the manifest (" + onDisk.length + " files)");

if(ghosts.length) fail("manifest entry points at a missing file: " + ghosts.join(", "));
else pass("every manifest entry exists on disk");

// ── 6. referenced assets resolve ───────────────────────────────
// Moving CSS out of index.html silently breaks every url() inside it: a path
// that resolved against the page now resolves against the stylesheet. That is
// how the title font stopped loading — "fonts/title.ttf" became
// /css/fonts/title.ttf, and the browser hid the 404 by falling back to a system
// font. These checks make a broken path loud instead of invisible.
const CSS = path.join(ROOT, "css", "game.css");
const SKIP = /^(data:|https?:|\/\/|#)/i;
const stripRef = r => r.split("?")[0].split("#")[0];

if(!fs.existsSync(CSS)){
  fail("css/game.css not found");
} else {
  const css = fs.readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const bad = [];
  const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  let um;
  while((um = urlRe.exec(css)) !== null){
    const ref = um[1].trim();
    if(SKIP.test(ref)) continue;
    const target = path.resolve(path.dirname(CSS), stripRef(ref));
    if(!fs.existsSync(target)) bad.push(ref + " -> " + path.relative(ROOT, target));
  }
  if(bad.length) fail("css/game.css references a missing file: " + bad.join(" | "));
  else pass("every url() in css/game.css resolves (relative to css/, not the page)");
}

if(!fs.existsSync(INDEX)){
  fail("index.html not found");
} else {
  const page = fs.readFileSync(INDEX, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const badLinks = [];
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let lm;
  while((lm = linkRe.exec(page)) !== null){
    const ref = lm[1].trim();
    if(SKIP.test(ref)) continue;
    if(!fs.existsSync(path.resolve(ROOT, stripRef(ref)))) badLinks.push(ref);
  }
  if(badLinks.length) fail("index.html links to missing file(s): " + badLinks.join(", "));
  else pass("every <link href> in index.html resolves");
}

// ── result ─────────────────────────────────────────────────────
console.log("");
if(failed){
  console.log("FAILED — " + failed + " problem(s). See the ✗ lines above.");
  process.exit(1);
}
console.log("OK — load order and asset paths are consistent.");
