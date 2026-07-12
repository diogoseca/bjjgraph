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

let booted = false

function bootNeural(): void {
  if (booted) return
  booted = true
  // configurable data base so the app's fetches resolve regardless of the page URL
  ;(window as any).__NEURAL_DATA_BASE = DATA_BASE
  const loadScript = (src: string) =>
    new Promise<void>((res) => {
      const el = document.createElement("script")
      el.src = src
      el.defer = true
      el.onload = () => res()
      el.onerror = () => res() // non-fatal (e.g. NG_CONTENT seed absent → app falls back)
      document.body.appendChild(el)
    })

  const run = async () => {
    // stylesheet (optional — bundle may inline its own styles)
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = APP_BASE + "neural.css"
    css.onerror = () => css.remove()
    document.head.appendChild(css)
    // technique-content.js sets window.NG_CONTENT (rich per-node content); load it BEFORE
    // the app so the content is present at mount. Missing → app falls back gracefully.
    await loadScript(DATA_BASE + "technique-content.js")
    // the app bundle mounts its own full-screen overlay
    const js = document.createElement("script")
    js.src = APP_BASE + "neural.js"
    js.defer = true
    js.onerror = () => {
      console.warn("[variant] neural bundle unavailable at", js.src, "— staying on legacy")
      document.documentElement.dataset.variant = "legacy"
    }
    document.body.appendChild(js)
  }
  if (document.body) run()
  else document.addEventListener("DOMContentLoaded", run, { once: true })
}

function applyVariant(): void {
  const v = resolveVariant()
  document.documentElement.dataset.variant = v
  if (v === "neural") bootNeural()
}

applyVariant()
