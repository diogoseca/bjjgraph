// Front-end variant bootstrap (Neural Graph epic, Phase 0.2; default flipped to neural in
// v1.54.0 — Phase 2 rollout).
//
// Resolves the active variant — URL ?variant= (sticky) → bjj-settings.variant → "neural"
// (default; ?variant=legacy is the escape hatch) — and reflects it as <html data-variant>.
// When "neural", it boots the Neural Graph app bundle as a FULL-SCREEN OVERLAY on top of the
// existing static page and hides the legacy chrome CLIENT-SIDE (a head <style> keyed on
// data-variant, so fixed-position legacy UI can't bleed through the canvas). Two SEO
// guarantees by construction:
//   1. The emitted static HTML is identical for both variants — this script only *adds*
//      behavior at runtime; it never alters the head/schema/crawlable content. Crawlers and
//      no-JS visitors never get data-variant=neural, so the hide rule never applies to them.
//   2. Neural is an overlay over the legacy DOM, so if the bundle is absent or fails, the
//      boot path resets data-variant to legacy — the hide rule stops matching and the full
//      legacy page (and its crawlable content) shows — no blank screen, no SEO loss.
//
// The static base for the app bundle + generated data is /static/neural/ (see
// scripts/regenerate_neural_data.py for the data; neural/dist/ for the bundle).

const SETTINGS_KEY = "bjj-settings"
const DATA_BASE = "/static/neural/"
const APP_BASE = "/static/neural/app/"
type Variant = "legacy" | "neural"

function persistVariant(v: Variant): void {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    if (s.variant !== v) {
      s.variant = v
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
    }
  } catch {
    /* ignore quota/parse errors — variant still applies for this load */
  }
}

function resolveVariant(): Variant {
  try {
    const p = new URLSearchParams(location.search).get("variant")
    if (p === "neural" || p === "legacy") {
      persistVariant(p) // ?variant= sticks for subsequent navigations
      return p
    }
  } catch {
    /* no URLSearchParams (ancient browser) — fall through */
  }
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    if (s.variant === "neural" || s.variant === "legacy") return s.variant
  } catch {
    /* corrupt settings — default */
  }
  return "neural"
}

// Hide the legacy presentation while the Neural overlay owns the screen. Keyed on
// html[data-variant="neural"] so it is self-disabling: any fallback that resets data-variant
// to legacy (bundle missing, boot failure) instantly un-hides the full legacy page. The dark
// body background covers the brief gap before the app's own loader paints. Client-side only —
// the static HTML (what crawlers/no-JS get) never carries the attribute.
const HIDE_STYLE_ID = "neural-hide-legacy"
function setLegacyHidden(hide: boolean): void {
  const existing = document.getElementById(HIDE_STYLE_ID)
  if (!hide) {
    existing?.remove()
    return
  }
  if (existing) return
  const st = document.createElement("style")
  st.id = HIDE_STYLE_ID
  st.setAttribute("spa-preserve", "") // survive head-patching across soft navs
  st.textContent =
    'html[data-variant="neural"] body > *:not(#neural-root){display:none !important}' +
    'html[data-variant="neural"] body{background:#0b0e1a}'
  document.head.appendChild(st)
}

let scriptLoaded = false

// Inject the bundle <script> exactly once per full page load. The bundle installs
// window.__mountNeural + window.__neural (see neural/build/build.mjs). It stays resident on
// window across SPA navs even after micromorph removes its <script> tag.
function loadNeuralBundle(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  scriptLoaded = true
  ;(window as any).__NEURAL_DATA_BASE = DATA_BASE

  const loadScript = (src: string) =>
    new Promise<void>((res) => {
      const el = document.createElement("script")
      el.src = src
      el.defer = true
      el.onload = () => res()
      el.onerror = () => res() // non-fatal
      document.body.appendChild(el)
    })

  return (async () => {
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = APP_BASE + "neural.css"
    css.onerror = () => css.remove()
    css.setAttribute("spa-preserve", "") // survive head-patching across navs
    document.head.appendChild(css)
    // technique-content.js sets window.NG_CONTENT; load it BEFORE the app.
    await loadScript(DATA_BASE + "technique-content.js")
    await new Promise<void>((res) => {
      const el = document.createElement("script")
      el.src = APP_BASE + "neural.js"
      el.defer = true
      el.onload = () => res()
      el.onerror = () => {
        console.warn("[variant] neural bundle unavailable at", el.src, "— staying on legacy")
        document.documentElement.dataset.variant = "legacy"
        res()
      }
      document.body.appendChild(el)
    })
  })()
}

// Mount (or re-mount) the overlay for the current page and register its teardown with the SPA
// router, so it is destroyed BEFORE the next body morph (releasing the keyboard + stopping the
// rAF loop). addCleanup drains + clears each nav, so we re-register after every mount.
async function mountAndRegisterCleanup(): Promise<void> {
  await loadNeuralBundle()
  const mount = (window as any).__mountNeural
  if (typeof mount !== "function") return // bundle failed to load; legacy stays
  mount() // idempotent: no-op if a live root already exists
  ;(window as any).addCleanup?.(() => {
    try {
      ;(window as any).__neural?.destroy?.()
    } catch (e) {
      console.warn("[variant] neural teardown failed:", e)
    }
  })
}

function applyVariant(): void {
  // variant attribute + legacy-hide style need only <head>/<html>, which exist even at
  // prescript (head) time — applying them immediately prevents any flash of legacy UI.
  const v = resolveVariant()
  document.documentElement.dataset.variant = v
  setLegacyHidden(v === "neural") // hide legacy chrome under the overlay (self-disabling on fallback)
  if (v === "neural") {
    // appending the bundle <script>s needs <body>, which does NOT exist at head time — defer
    // just the mount (the "nav" path is always post-body, so this resolves immediately there).
    const mount = () => void mountAndRegisterCleanup()
    if (document.body) mount()
    else document.addEventListener("DOMContentLoaded", mount, { once: true })
  } else {
    // switched to (or navigated under) legacy: tear down any live overlay.
    try {
      ;(window as any).__neural?.destroy?.()
    } catch {
      /* ignore */
    }
  }
}

// First execution (full page load, from prescript.js in <head>) + every SPA soft-nav (this
// inline script does not re-execute on soft nav, so react to the router's "nav" event —
// teardown for the outgoing page has already run via addCleanup, and micromorph removed
// #neural-root, so __mountNeural builds a fresh one).
applyVariant()
document.addEventListener("nav", () => applyVariant())
