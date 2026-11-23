// LEAK1 (v1.298.1): EVERY PAGE-WIDE LISTENER OF AN APP OR A READER GOES WITH IT. The reader of PR #456 counted 22 listeners
// on document and window (the app's and the reader's) that grew by one a remount, each keeping a dead app alive with its
// graph; every one was added with no way to remove it. Since v1.298.1 the app adds them through `_on` (one AbortController a
// life, `_life`, aborted in `componentWillUnmount`) and the reader through its `on` and `this.life` (aborted in `destroy()`).
// This scan is the gate a hand-kept list lacks (CLAUDE.md §6.7): a direct page-wide add anywhere in the build inputs fails,
// unless it is one of the few that are once a page and hold no instance, each listed below with its reason. A listed one that
// matches nothing fails too, so the list cannot rot.
// MUTANT (each red here after a clean control): G1 a direct `window.addEventListener` in app.src.jsx; G2 a once-a-page entry
// whose line is gone; G3 the sound engine's fallback removed (`app._on` alone, as PR #457's first head shipped it).
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
const DIRECT = /(^|[^\w.$])(document|window|globalThis|self|visualViewport|document\.fonts)\.addEventListener\(|matchMedia\([^)]*\)\.(addEventListener|addListener)\(|\blisten\((document|window)\b/;
const VIA_LIFE = /\b(this|app)\._on\((document\.fonts|document|window)\b|(^|[^\w.$])on\((document|window)\b|signal: (this\.life|life)\b/;

test("no page-wide listener is added outside an instance's life, but the listed once-a-page ones", () => {
  const stray = [], hits = new Map(ONCE_A_PAGE.map((e) => [e, 0]));
  let lines = 0, viaLife = 0;
  for (const f of FILES) {
    const text = readFileSync(new URL(f, DIR), "utf8").split("\n");
    lines += text.length;
    text.forEach((l, i) => {
      if (VIA_LIFE.test(l)) viaLife++;
      if (!DIRECT.test(l) || /signal: (this\.life|life)\b/.test(l)) return;   // (a direct add on a line with an `_on` is still a direct add)
      const e = ONCE_A_PAGE.find((x) => x.file === f && l.includes(x.has));
      if (e) { hits.set(e, hits.get(e) + 1); return; }
      stray.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
  assert.ok(FILES.length >= 40 && lines > 30000, `premise: the build inputs were read (${FILES.length} files, ${lines} lines)`);
  assert.ok(viaLife >= 30, `premise: the instances' own listeners were found going through their life (${viaLife})`);
  assert.deepEqual(stray, [], "a page-wide listener added outside an instance's life: add it through `_on` (the app) or `on` / `this.life` (the reader), or list it here as once a page, with its reason");
  for (const [e, n] of hits) assert.equal(n, 1, `a once-a-page entry matches exactly one line (${e.file}: "${e.has}" matched ${n})`);
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
