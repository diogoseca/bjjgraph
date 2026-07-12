// Front-end variant bootstrap (Neural Graph epic, Phase 0.2).
//
// Resolves the active variant — URL ?variant= (sticky) → bjj-settings.variant → "legacy"
// (default) — and reflects it as <html data-variant>. When "neural", it boots the Neural
// Graph app bundle as a FULL-SCREEN OVERLAY on top of the existing static page. Two SEO
// guarantees by construction:
//   1. The emitted static HTML is identical for both variants — this script only *adds*
//      behavior at runtime; it never alters the head/schema/crawlable content.
//   2. Neural is an overlay over the legacy DOM, so if the bundle is absent or fails, the
//      full legacy page (and its crawlable content) remains — no blank screen, no SEO loss.
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
  return "legacy"
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
  const v = resolveVariant()
  document.documentElement.dataset.variant = v
  if (v === "neural") {
    void mountAndRegisterCleanup()
  } else {
    // switched to (or navigated under) legacy: tear down any live overlay.
    try {
      ;(window as any).__neural?.destroy?.()
    } catch {
      /* ignore */
    }
  }
}

// First execution (full page load) + every SPA soft-nav (this inline script does not re-execute
// on soft nav, so react to the router's "nav" event — teardown for the outgoing page has already
// run via addCleanup, and micromorph removed #neural-root, so __mountNeural builds a fresh one).
applyVariant()
document.addEventListener("nav", () => applyVariant())
