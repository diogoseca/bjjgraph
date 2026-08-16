// Neural Graph production build (Phase 1) — LEAN, no-eval, no-bloat.
//
// Discovery: the app is a dc-runtime *template* app, not a JSX-render app. It has no
// render() — it has renderVals() returning refs, and its UI is the <x-dc> template
// skeleton (all bindings are simple identifiers: 40 ref="{{ }}" + 10 value subs, zero
// expressions, zero inline handlers). All interactivity is wired imperatively in boot()
// off those refs. So we need NEITHER React NOR eval NOR the 60 KB design-tool runtime —
// just a tiny shim (createRef + a DCLogic base) + a ~40-line template renderer.
// This is the leanest faithful build (owner: "cut the bloat"): drops support.js entirely.
//
//   source app : neural/src/app.src.jsx  (the class body; fetches patched to the data base)
//   template   : neural/src/xdc-template.html  (skeleton after <helmet>)
//   props      : neural/src/props.json  (baked to current defaults — the version you like)
//   css        : neural/src/helmet.html <style> + Google-fonts @import  -> neural/dist/neural.css
// Run from anywhere: node neural/build/build.mjs   (resolves esbuild from source/node_modules)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const SOURCE = resolve(HERE, "../../source");
const require = createRequire(resolve(SOURCE, "package.json"));
const { build } = require("esbuild");

// 1) app source: patch relative data fetches to the configurable base
const sound = readFileSync(R("src/sound.src.js"), "utf8");
const challengeDefinitions = readFileSync(
  R("src/challenge-definitions.src.js"),
  "utf8",
);
const challengeEngine = readFileSync(R("src/challenge-engine.src.js"), "utf8");
const challengeUI = readFileSync(R("src/challenge-ui.src.js"), "utf8");
const challengeFeedback = readFileSync(
  R("src/challenge-feedback.src.js"),
  "utf8",
);
const challengeCSS = readFileSync(R("src/challenge-ui.css"), "utf8");
const challengeCollectionCSS = readFileSync(
  R("src/challenge-collection.css"),
  "utf8",
);
const challengeFeedbackCSS = readFileSync(
  R("src/challenge-feedback.css"),
  "utf8",
);
const systemsCSS = readFileSync(R("src/systems.css"), "utf8");

// lists-codec.src.js is a REAL ES module (so `node --test` and a Cloudflare Pages Function
// can import the identical source — one codec, never a second implementation to drift).
// This entry is concatenated text, not a module graph, so the `export ` keywords are
// stripped here. If that ever silently stops matching, the bundle breaks at parse time and
// the whole app disappears — so assert it, loudly, at build time.
const stripExports = (file) => {
  const raw = readFileSync(R("src/" + file), "utf8");
  const out = raw.replace(/^export (function|const|let|var|class) /gm, "$1 ");
  if (out === raw || /^\s*(export|import)\s/m.test(out)) {
    throw new Error(
      `build.mjs: ${file} export-strip failed (no match, or an export/import survived). ` +
        "Fix the strip regex or the file — pinned by tests/share_lists_*.test.mjs.",
    );
  }
  return out;
};
const listsCodec = stripExports("lists-codec.src.js");
// lists.src.js shares ONE scope with the codec here, so a duplicated top-level name would be
// a SyntaxError that deletes the whole app. Assert the collision can't creep in.
const listsStore = stripExports("lists.src.js");
{
  // EVERY top-level binding form, not just function/const: two `let NGL_FOO` in one scope is
  // the same SyntaxError, and it would delete the same whole app. (The guard used to scan
  // function|const only, so a colliding `let`/`var`/`class` walked straight past it.)
  const names = (src) =>
    new Set(
      [...src.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
        (m) => m[1],
      ),
    );
  const clash = [...names(listsCodec)].filter((n) => names(listsStore).has(n));
  if (clash.length) {
    throw new Error(
      "build.mjs: lists-codec.src.js and lists.src.js declare the same top-level name(s) " +
        `[${clash.join(", ")}] — in the concatenated bundle that is a SyntaxError and the app ` +
        "disappears. Rename one side (see the scope note at the top of lists.src.js).",
    );
  }
}

let app = readFileSync(R("src/app.src.jsx"), "utf8");
// PER-RULE, AND IT THROWS (v1.104.6). Two of the four rewrites were DEAD — the app has fetched
// `flashcards/_index.json` (via `_dataBase()`) since v1.80.4 and `systems.json` the same way, so
// `fetch("flashcards.json"` and `fetch("systems.json"` matched nothing. The old guard only warned
// when EVERY rule missed, so a rule going stale was invisible: it took a 15-test cold-start
// failure and an audit to find. A rewrite that cannot fire is a lie about what the bundle does.
const FETCH_REWRITES = [
  ['fetch("graph-data.json"', 'fetch((window.__NEURAL_DATA_BASE||"")+"graph-data.json"'],
  ['fetch("curriculum.json"', 'fetch((window.__NEURAL_DATA_BASE||"")+"curriculum.json"'],
];
for (const [from] of FETCH_REWRITES) {
  if (!app.includes(from))
    throw new Error(
      `[build] fetch rewrite is DEAD: ${from} appears nowhere in app.src.jsx. Either the call was ` +
        "renamed (update this list) or it now builds its own URL through _dataBase() (drop the rule). " +
        "A rule that never fires silently stops prefixing __NEURAL_DATA_BASE, which is how the e2e " +
        "harness serves its fixtures.",
    );
}
let patched = app;
for (const [from, to] of FETCH_REWRITES) patched = patched.replaceAll(from, to);
app = patched;

// 2) template skeleton (strip the <helmet> — its <style>/fonts go to neural.css)
let tpl = readFileSync(R("src/xdc-template.html"), "utf8");
tpl = tpl.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();

// 3) baked props (current design defaults — the loaded version, no tweak UI)
const rawProps = JSON.parse(readFileSync(R("src/props.json"), "utf8"));
const props = Object.fromEntries(
  Object.entries(rawProps).map(([k, v]) => [
    k,
    v && typeof v === "object" && "default" in v ? v.default : v,
  ]),
);

// 4) compose the entry
const entry = `
// ---- minimal dc-runtime shim (no React, no eval) ----
const __ngRefs = []
const React = {
  createRef() { const r = { current: null }; __ngRefs.push(r); return r },
  Component: class {},
}
;(globalThis).React = React
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {} }
  setState(u, cb) { Object.assign(this.state, typeof u === "function" ? u(this.state) : u); this.forceUpdate(); if (cb) cb() }
  forceUpdate() { /* template skeleton is static; the app updates the DOM imperatively via refs */ }
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  renderVals() { return {} }
}

/* ---- begin sound.src.js ---- */
${sound}
/* ---- end sound.src.js ---- */

/* ---- begin share-link list codec + store (pure; ordinals <-> URL code, lists, og text) ---- */
${listsCodec}
${listsStore}
// Reachable, greppable, and safe from tree-shaking: both files are pure and stateless, so
// exposing them costs nothing and lets the list UI, the /l recipient path, the unit suite and
// a paired debugging session all use the SAME functions. Both naming styles are published:
// the short one reads well at a call site, the ng* one matches the module + the unit tests.
;(globalThis).NGLists = {
  version: NG_LIST_WIRE_VERSION,
  maxItems: NG_LIST_MAX_ITEMS,
  maxCodeChars: NG_LIST_MAX_CODE_CHARS,
  nameMax: NG_LIST_NAME_MAX,
  clipErrors: NG_LIST_CLIP_ERRORS,
  classifyFailure: ngListClassifyFailure,
  looksLikeOurCode: ngListLooksLikeOurCode,
  wireVersionOf: ngListWireVersionOf,
  encodeOrdinals: ngListEncodeOrdinals,
  decodeOrdinals: ngListDecodeOrdinals,
  normalizeOrdinals: ngListNormalizeOrdinals,
  encodeIds: ngListEncodeIds,
  decodeIds: ngListDecodeIds,
  ordinalIndex: ngListOrdinalIndex,
  shareId: ngListShareId,
  normalizeLists: ngListsNormalize,
  mergeLists: ngMergeLists,
  defaultName: ngListDefaultName,
  parseSharePath: ngListParseSharePath,
  shareUrl: ngListShareUrl,
  ogTitle: ngShareOgTitle,
  ogDescription: ngShareOgDescription,
  ngListEncodeOrdinals, ngListDecodeOrdinals, ngListNormalizeOrdinals,
  ngListEncodeIds, ngListDecodeIds, ngListOrdinalIndex, ngListShareId,
  ngListsNormalize, ngMergeLists, ngListDefaultName, ngListParseSharePath,
  ngListShareUrl, ngShareOgTitle, ngShareOgDescription,
}
/* ---- end share-link list codec + store ---- */

/* ---- begin challenge definitions + pure engine ---- */
${challengeDefinitions}
${challengeEngine}
/* ---- end challenge definitions + pure engine ---- */

/* ---- begin app.src.jsx (patched) ---- */
${app}
/* ---- end app.src.jsx ---- */

/* ---- begin challenge UI ---- */
${challengeUI}
${challengeFeedback}
/* ---- end challenge UI ---- */

const __TPL = ${JSON.stringify(tpl)}
const __PROPS = ${JSON.stringify(props)}

function __resolve(vals, key) {
  let v = vals
  for (const part of key.split(".")) { if (v == null) return ""; v = v[part] }
  return v == null || typeof v === "object" ? "" : String(v)
}

function mountNeural() {
  let root = document.getElementById("neural-root")
  if (!root) { root = document.createElement("div"); root.id = "neural-root"; document.body.appendChild(root) }
  try {
    const inst = new Component(__PROPS)
    const vals = { ...__PROPS, ...(inst.renderVals ? inst.renderVals() : {}) }
    // render the skeleton: ref="{{ x }}" -> data-ng-ref; on<Event>="{{ x }}" -> data-ng-on
    // (bound as a real listener below — else the handler fn stringifies into a dead, CSP-blocked
    // inline attribute); any other {{ x }} -> value.
    const html = __TPL
      .replace(/ref="\\{\\{\\s*([\\w$.]+)\\s*\\}\\}"/g, (_, n) => 'data-ng-ref="' + n + '"')
      .replace(/on(\\w+)="\\{\\{\\s*([\\w$.]+)\\s*\\}\\}"/g, (_, ev, n) => 'data-ng-on="' + ev.toLowerCase() + ':' + n + '"')
      .replace(/\\{\\{\\s*([\\w$.]+)\\s*\\}\\}/g, (_, k) => __resolve(vals, k))
    root.innerHTML = html
    // bind refs to their DOM elements (the app reads e.g. this.canvasRef.current in boot())
    root.querySelectorAll("[data-ng-ref]").forEach((el) => {
      const n = el.getAttribute("data-ng-ref")
      const ref = vals[n]
      if (ref && typeof ref === "object") ref.current = el
      el.removeAttribute("data-ng-ref")
    })
    // bind template on<Event> handlers imperatively from renderVals() (logo/Close/Terms/Privacy/etc.)
    root.querySelectorAll("[data-ng-on]").forEach((el) => {
      const spec = el.getAttribute("data-ng-on"); const ci = spec.indexOf(":")
      const ev = spec.slice(0, ci), name = spec.slice(ci + 1)
      const fn = vals[name]
      if (typeof fn === "function") el.addEventListener(ev, fn)
      el.removeAttribute("data-ng-on")
    })
    inst.__ngRoot = root
    // idempotent teardown for SPA nav: run the app's own componentWillUnmount (cancels rAF,
    // disconnects ResizeObserver, removes window keydown/resize listeners, clears timers), then
    // detach the overlay root so no zombie instance keeps the keyboard hijacked after navigation.
    inst.destroy = function () {
      if (inst.__ngDestroyed) return
      inst.__ngDestroyed = true
      try { if (inst.componentWillUnmount) inst.componentWillUnmount() } catch (e) { console.warn("[neural] teardown error:", e) }
      try { if (inst.__ngRoot && inst.__ngRoot.remove) inst.__ngRoot.remove() } catch (e) {}
      if ((window).__neural === inst) (window).__neural = null
    }
    if (inst.componentDidMount) inst.componentDidMount()
    ;(window).__neural = inst
  } catch (e) {
    console.error("[neural] mount failed:", e)
    root.remove()
    document.documentElement.dataset.variant = "legacy"
  }
}
// idempotent (re-)mount hook for the SPA router: no-op if a live overlay root is still connected.
function __mountNeuralOnce() {
  const existing = (window).__neural
  if (existing && existing.__ngRoot && document.body.contains(existing.__ngRoot)) return existing
  mountNeural()
  return (window).__neural
}
;(window).__mountNeural = __mountNeuralOnce
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", __mountNeuralOnce, { once: true })
else __mountNeuralOnce()
`;
mkdirSync(R("build/.tmp"), { recursive: true });
writeFileSync(R("build/.tmp/entry.tsx"), entry);

// 5) bundle (tsx loader handles class fields; no JSX factory needed — the app has none)
mkdirSync(R("dist"), { recursive: true });
await build({
  entryPoints: [R("build/.tmp/entry.tsx")],
  bundle: true,
  format: "iife",
  target: "es2019",
  minify: true,
  legalComments: "none",
  outfile: R("dist/neural.js"),
  loader: { ".tsx": "tsx" },
  jsx: "automatic",
  jsxImportSource: "preact",
  absWorkingDir: SOURCE,
  nodePaths: [resolve(SOURCE, "node_modules")],
  logLevel: "info",
});

// 6) CSS from the helmet <style> ONLY. The Google-fonts @import is deliberately NOT carried:
// the Quartz page already loads the same families in its own <head>, and a failed @import
// fires the <link>'s onerror in Chromium — which variant.inline.ts answers by removing the
// WHOLE app stylesheet. With the @import in place, any fonts hiccup (ad-blocker, offline,
// the hermetic e2e route) silently unstyled the entire app. helmet.html keeps the link for
// the standalone design-tool preview; the shipped bundle must not depend on it.
const helmet = readFileSync(R("src/helmet.html"), "utf8");
const styleM = helmet.match(/<style>([\s\S]*?)<\/style>/);
writeFileSync(
  R("dist/neural.css"),
  [
    styleM ? styleM[1] : "",
    challengeCSS,
    challengeCollectionCSS,
    challengeFeedbackCSS,
    systemsCSS,
  ].join("\n"),
);

console.log(
  "[build] lean neural/dist/neural.js + neural.css written (no React/eval/support.js)",
);
