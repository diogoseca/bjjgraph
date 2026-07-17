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
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createRequire } from "node:module"

const HERE = dirname(fileURLToPath(import.meta.url))
const R = (p) => resolve(HERE, "..", p)
const SOURCE = resolve(HERE, "../../source")
const require = createRequire(resolve(SOURCE, "package.json"))
const { build } = require("esbuild")

// 1) app source: patch relative data fetches to the configurable base
let app = readFileSync(R("src/app.src.jsx"), "utf8")
const patched = app
  .replaceAll('fetch("graph-data.json"', 'fetch((window.__NEURAL_DATA_BASE||"")+"graph-data.json"')
  .replaceAll('fetch("flashcards.json"', 'fetch((window.__NEURAL_DATA_BASE||"")+"flashcards.json"')
  .replaceAll('fetch("curriculum.json"', 'fetch((window.__NEURAL_DATA_BASE||"")+"curriculum.json"')
if (patched === app) console.warn("[build] WARNING: no fetch() patched — check app source")
app = patched

// 2) template skeleton (strip the <helmet> — its <style>/fonts go to neural.css)
let tpl = readFileSync(R("src/xdc-template.html"), "utf8")
tpl = tpl.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim()

// 3) baked props (current design defaults — the loaded version, no tweak UI)
const rawProps = JSON.parse(readFileSync(R("src/props.json"), "utf8"))
const props = Object.fromEntries(
  Object.entries(rawProps).map(([k, v]) => [k, v && typeof v === "object" && "default" in v ? v.default : v]),
)

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

/* ---- begin app.src.jsx (patched) ---- */
${app}
/* ---- end app.src.jsx ---- */

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
`
mkdirSync(R("build/.tmp"), { recursive: true })
writeFileSync(R("build/.tmp/entry.tsx"), entry)

// 5) bundle (tsx loader handles class fields; no JSX factory needed — the app has none)
mkdirSync(R("dist"), { recursive: true })
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
})

// 6) CSS from the helmet <style> + the Google-fonts stylesheet (the css2 link, not preconnect)
const helmet = readFileSync(R("src/helmet.html"), "utf8")
const styleM = helmet.match(/<style>([\s\S]*?)<\/style>/)
const fontHref = (helmet.match(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/) || [])[1]
writeFileSync(
  R("dist/neural.css"),
  (fontHref ? `@import url("${fontHref}");\n` : "") + (styleM ? styleM[1] : ""),
)

console.log("[build] lean neural/dist/neural.js + neural.css written (no React/eval/support.js)")
