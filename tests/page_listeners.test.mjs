// LEAK1 (v1.298.1): EVERY PAGE-WIDE LISTENER OF AN APP OR A READER GOES WITH IT. The reader of PR #456 counted 22 listeners
// on document and window (the app's and the reader's) that grew by one a remount, each keeping a dead app alive with its
// graph; every one was added with no way to remove it. Since v1.298.1 the app adds them through `_on` (one AbortController a
// life, `_life`, aborted in `componentWillUnmount`) and the reader through its `on` and `this.life` (aborted in `destroy()`).
// This scan is the gate a hand-kept list lacks (CLAUDE.md §6.7): a page-wide add anywhere in the build inputs fails, unless
// it goes through an instance's life, or is one of the few that are once a page and hold no instance, or is removed by name
// at its instance's end (the removal line is checked to be there). A listed one that matches nothing fails too.
//
// WHAT THE SCAN SEES (LEAK1-R1, the orchestrator's ruling on the reader of PR #457), comments stripped first (a comment that
// quotes an add is not an add; it used to fail this falsely): `document.` / `window.` / `globalThis.` / `self.` /
// `document.fonts.` `addEventListener(`; `visualViewport.` and `window.visualViewport.`; `document.body.`,
// `document.documentElement.` and `document.head.`; any `on<event> =` on window or document; a media query's add, inline
// (`matchMedia(…).addEventListener`) or stored (a name assigned from `matchMedia(` in the same file, then its
// `addEventListener` / `addListener`); and the reader's `listen(document|window, …)`.
// UNGUARDED by the scan; the heap step of page-listeners.spec.ts is the backstop: an alias (`const w = window;
// w.addEventListener(…)`) and `EventTarget.prototype.addEventListener.call(window, …)`. A text scan cannot follow a value.
//
// MUTANTS (each red here after a clean control; LEAK1, LEAK1-RED and LEAK1-R1): G1 a direct `window.addEventListener` in
// app.src.jsx; G2 a once-a-page entry whose line is gone; G3 the sound engine's fallback removed; G4
// `window.visualViewport.addEventListener`; G5 `document.body.addEventListener` (and G5b `document.documentElement.`); G6
// `window.onresize =`; G7 a stored media query's `addEventListener`; L6 (the reader's) the reduced-motion query's removal
// dropped, red here at "removed by name" and in the journey at "the first app is collected". A comment quoting
// `window.addEventListener(` is green (C1).
// The journey that counts what really stays after two remounts: e2e/journeys/page-listeners.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const DIR = new URL("../neural/src/", import.meta.url);
// the build inputs (`.gitignore` admits only these names under neural/src: the design dumps beside them are not read)
const FILES = readdirSync(DIR).filter((f) => /\.src\.jsx?$/.test(f));

const ONCE_A_PAGE = [
  { file: "master-cloze.src.js", has: 'document.addEventListener("pointerdown", (e) => { ngCzTouch', why: "module level, once a page: the last pointer's kind and point, numbers only" },
  { file: "master-cloze.src.js", has: 'document.addEventListener("pointermove", (e) => {', why: "module level, once a page: the pointer's moves counted, numbers only" },
  { file: "reader.src.js", has: 'document.addEventListener("pointerdown", down, true);', why: "one module-level function, so the browser keeps one however many buttons add it; its element (`downOn`) is cleared in `destroy()`" },
];
const BY_NAME = [
  { file: "app.src.jsx", has: 'this._motionQuery?.addEventListener("change", this._motionChanged);', removal: 'this._motionQuery?.removeEventListener("change", this._motionChanged);',
    why: "the reduced-motion query (a MediaQueryList of this app's), removed by name in componentWillUnmount (LEAK1-R1: it stays so; L6 drops the removal)" },
];
const DIRECT = new RegExp([
  /(^|[^\w.$])(document|window|globalThis|self|visualViewport|document\.fonts)\??\.addEventListener\(/.source,
  /\b(window|globalThis|self)\.visualViewport\??\.addEventListener\(/.source,
  /\bdocument\.(body|documentElement|head)\??\.addEventListener\(/.source,
  /(^|[^\w.$])(window|document|globalThis|self)\.on[a-z]+\s*=(?!=)/.source,
  /matchMedia\([^)]*\)\??\.(addEventListener|addListener)\(/.source,
  /\blisten\((document|window)\b/.source,
].join("|"));
const VIA_LIFE = /\b(this|app)\._on\((document\.fonts|document|window)\b|(^|[^\w.$])on\((document|window)\b|signal: (this\.life|life)\b/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** comments out, strings and newlines kept, so a line number is the source's (strings, template literals and regex
 *  literals are walked so that a `//` or a quote inside one is not taken for a comment or a string's end) */
function stripComments(src) {
  let out = "", i = 0, prev = "";
  const n = src.length, regexAfter = /[(,=:[!&|?{};+\-*%<>~^]|^$/;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; prev = c; continue;
    }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2), end = e < 0 ? n : e + 2; out += src.slice(i, end).replace(/[^\n]/g, ""); i = end; continue; }
    if (c === "/" && (regexAfter.test(prev) || /\breturn\s*$/.test(out.slice(-12)))) {   // a regex literal
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n" && (cls || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; j++; }
      out += src.slice(i, j + 1); i = j + 1; prev = "/"; continue;
    }
    out += c; if (!/\s/.test(c)) prev = c; i++;
  }
  return out;
}

/** every page-wide add the scan can see, in `files` ({ name, text }), sorted into the instance's life, the lists, and stray */
function scan(files) {
  const stray = [], hitsOnce = new Map(ONCE_A_PAGE.map((e) => [e, 0])), hitsName = new Map(BY_NAME.map((e) => [e, 0])), lost = [];
  let lines = 0, viaLife = 0;
  for (const { name, text } of files) {
    const clean = stripComments(text), rows = clean.split("\n");
    lines += rows.length;
    // the names a media query is stored under in this file (`this._motionQuery = … matchMedia(…)`)
    const mq = [...clean.matchAll(/([\w$.]+)\s*=\s*[^;\n]*\bmatchMedia\(/g)].map((m) => m[1]).filter((v, k, a) => a.indexOf(v) === k);
    const storedAdd = mq.length ? new RegExp("(" + mq.map(esc).join("|") + ")\\??\\.(addEventListener|addListener)\\(") : null;
    rows.forEach((l, i) => {
      if (VIA_LIFE.test(l)) viaLife++;
      const direct = DIRECT.test(l) && !/signal: (this\.life|life)\b/.test(l), stored = !!storedAdd && storedAdd.test(l);
      if (!direct && !stored) return;   // (a direct add on a line with an `_on` is still a direct add)
      const once = ONCE_A_PAGE.find((x) => x.file === name && l.includes(x.has));
      if (once) { hitsOnce.set(once, hitsOnce.get(once) + 1); return; }
      const byName = BY_NAME.find((x) => x.file === name && l.includes(x.has));
      if (byName) { hitsName.set(byName, hitsName.get(byName) + 1); if (!clean.includes(byName.removal)) lost.push(`${name}: ${byName.removal}`); return; }
      stray.push(`${name}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
  return { stray, hitsOnce, hitsName, lost, lines, viaLife };
}

test("the scanner itself: a comment is not an add, a string's // is not a comment, and each family is seen (C1, G4 to G7 in miniature)", () => {
  const one = (text) => scan([{ name: "fixture.src.js", text }]).stray.length;
  assert.equal(one('// window.addEventListener("resize", f)\n/* document.addEventListener("x", g) */\nconst a = 1;\n'), 0, "C1: comments quoting an add are not adds");
  assert.equal(one('const u = "http://x/"; window.addEventListener("resize", f)\n'), 1, "a string's // does not hide the add after it");
  assert.equal(one('const r = /["\'`]/g; window.addEventListener("resize", f)\n'), 1, "a regex literal's quote does not swallow the add after it");
  assert.equal(one('window.visualViewport.addEventListener("resize", f)\n'), 1, "G4: visualViewport");
  assert.equal(one('document.body.addEventListener("click", f)\ndocument.documentElement.addEventListener("click", f)\n'), 2, "G5: body, documentElement");
  assert.equal(one('window.onresize = () => {}\ndocument.onkeydown = f\nif (window.onload == null) x()\n'), 2, "G6: on<event> = (a comparison is not one)");
  assert.equal(one('this._mq9 = window.matchMedia("(min-width:1px)");\nthis._mq9.addEventListener("change", f)\n'), 1, "G7: a stored media query's add");
  assert.equal(one('const w = window; w.addEventListener("resize", f)\nEventTarget.prototype.addEventListener.call(window, "resize", f)\n'), 0,
    "UNGUARDED by the scan (an alias, a `.call`): said in the header; the journey's heap step is the backstop");
});

test("no page-wide listener is added outside an instance's life, but the listed once-a-page and removed-by-name ones", () => {
  const r = scan(FILES.map((f) => ({ name: f, text: readFileSync(new URL(f, DIR), "utf8") })));
  assert.ok(FILES.length >= 40 && r.lines > 30000, `premise: the build inputs were read (${FILES.length} files, ${r.lines} lines)`);
  assert.ok(r.viaLife >= 30, `premise: the instances' own listeners were found going through their life (${r.viaLife})`);
  assert.deepEqual(r.stray, [], "a page-wide listener added outside an instance's life: add it through `_on` (the app) or `on` / `this.life` (the reader), or list it here, with its reason");
  for (const [e, n] of r.hitsOnce) assert.equal(n, 1, `a once-a-page entry matches exactly one line (${e.file}: "${e.has}" matched ${n})`);
  for (const [e, n] of r.hitsName) assert.equal(n, 1, `a removed-by-name entry matches exactly one line (${e.file}: "${e.has}" matched ${n})`);
  assert.deepEqual(r.lost, [], "a listener listed as removed by name whose removal is gone (L6)");
});

// LEAK1-RED: A HOST WITHOUT THE HELPER STAYS SUPPORTED. The sound engine is built by more than the app: the Forward sound lab
// (forward/sounds/app.js, the /dev sound lab) and sound.spec.ts's own engines each pass only `{ isTest, get }`. PR #457's first
// head called `app._on` alone and both broke (sound.spec.ts:34, and the lab's preview and narrow-route rail in
// forward-components.spec.ts). The engine takes its host's life where the host has one, and otherwise a plain add that its
// own destroy() removes. Read here from the source itself, so a stale built lab cannot hide it.
test("the sound engine supports a host without `_on` (the Forward lab, a spec's own engine) and uses the app's life where there is one", () => {
  const load = () => {
    const win = { adds: [], removes: [], addEventListener(type) { this.adds.push(type); }, removeEventListener(type) { this.removes.push(type); } };
    const sb = { console, setTimeout, clearTimeout, window: win };
    sb.globalThis = sb;
    runInNewContext(readFileSync(new URL("sound.src.js", DIR), "utf8"), sb, { filename: "sound.src.js" });
    return { Engine: sb.NGSound, win };
  };
  const lab = load(), host = { isTest: () => false, get: (_k, fallback) => fallback };
  const engine = new lab.Engine(host);   // the Forward lab's own host: no `_on` (it threw before the fix)
  assert.deepEqual(lab.win.adds.sort(), ["keydown", "pointerdown"], "a host without `_on`: the engine's two listeners are a plain add");
  engine.destroy();
  assert.deepEqual(lab.win.removes.sort(), ["keydown", "pointerdown"], "…which its own destroy() removes");
  const app = load(), via = [];
  new app.Engine({ ...host, _on: (_t, type) => via.push(type) });
  assert.deepEqual([via.sort(), app.win.adds], [["keydown", "pointerdown"], []], "the app's host: both through its life (`_on`), none added plainly");
});
