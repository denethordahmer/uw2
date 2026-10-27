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

// ── result ─────────────────────────────────────────────────────
console.log("");
if(failed){
  console.log("FAILED — " + failed + " problem(s). Fix js/manifest.js and/or index.html.");
  process.exit(1);
}
console.log("OK — load order is consistent.");
