// Neural app bootstrap — the loader for the site's ONE front-end.
//
// History, because the shape of this file only makes sense with it: until v1.80.0 the site
// shipped two front-ends. Quartz rendered a full interactive page UI (in-page graphs, an SRS
// training stack, move/outcome trays, a drawer of chrome) and this script decided which one you
// got: `?variant=neural` (the default) booted the Neural app as a full-screen overlay and hid
// the Quartz chrome with a client-side <style>; `?variant=legacy` left it visible. Nobody chose
// legacy, so every visitor downloaded ~1.46MB of a UI they never saw. v1.80.0 deleted it.
//
// What is left is the part that was always doing the work:
//   1. load the Neural bundle + its data, and mount it, on first load and on every SPA soft nav;
//   2. leave the STATIC ARTICLE in place underneath as the fallback.
//
// The fallback is not a courtesy, it is the SEO contract. Quartz stays the site's static-site
// generator: the emitted HTML carries the real <article>, the <head>, and the JSON-LD for all
// 4,600+ indexed URLs, and Neural is an overlay on top of it. So:
//   - a crawler or a JS-less visitor never gets `data-variant`, the hide rule never applies, and
//     they read the prose directly (see scripts/check_seo_parity.py, which gates this);
//   - if the bundle 404s or throws, `data-variant` is cleared, the hide rule stops matching, and
//     the article is revealed instead of a blank dark screen.
//
// `?variant=legacy` is now accepted-and-ignored: the second front-end it selected does not
// exist. It is not an error (old links and bookmarks carry it), it simply has no effect.

const DATA_BASE = "/static/neural/"
const APP_BASE = "/static/neural/app/"

// one exposure event per full page load (fired post-DOM so the PostHog stub queue exists)
let exposureFired = false
function fireExposure(): void {
  if (exposureFired) return
  exposureFired = true
  const send = () => {
    try {
      const ph = (window as any).posthog
      if (ph?.capture) ph.capture("neural_variant_exposure", { variant: "neural" })
    } catch {
      /* analytics must never break the page */
    }
  }
  if (document.body) send()
  else document.addEventListener("DOMContentLoaded", send, { once: true })
}

// Hide the static article while the Neural overlay owns the screen. Keyed on
// html[data-variant="neural"] so it is SELF-DISABLING: any fallback that clears the attribute
// (bundle missing, boot failure) instantly reveals the full article. The dark body background
// covers the brief gap before the app's own loader paints. Client-side only — the emitted HTML
// (what crawlers and no-JS visitors get) never carries the attribute.
// #dev-snapshot-btn is exempt: a dev-only overlay that must stay clickable over the neural
// canvas (it only ever exists on localhost — see snapshotButton.inline.ts).
const HIDE_STYLE_ID = "neural-hide-static"
function setStaticHidden(hide: boolean): void {
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
    'html[data-variant="neural"] body > *:not(#neural-root):not(#dev-snapshot-btn){display:none !important}' +
    'html[data-variant="neural"] body{background:#0b0e1a}'
  document.head.appendChild(st)
}

// The in-flight (or settled) bundle load. Cached as a PROMISE, not a boolean: boot() can be
// called twice in quick succession on a cold load — once from prescript in <head> (which defers
// its mount to DOMContentLoaded) and once from the router's "nav" event — and a boolean guard
// would let the second caller fall straight through while the <script> was still downloading.
// It would then see no window.__mountNeural and wrongly conclude the bundle had failed. Sharing
// the promise means every caller awaits the real outcome, so "not a function" after the await
// means genuinely broken rather than merely not-ready-yet.
let bundlePromise: Promise<void> | null = null

// Inject the bundle <script> exactly once per full page load. The bundle installs
// window.__mountNeural + window.__neural (see neural/build/build.mjs). It stays resident on
// window across SPA navs even after micromorph removes its <script> tag.
function loadNeuralBundle(): Promise<void> {
  if (bundlePromise) return bundlePromise
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

  bundlePromise = (async () => {
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = APP_BASE + "neural.css"
    css.onerror = () => css.remove()
    css.setAttribute("spa-preserve", "") // survive head-patching across navs
    document.head.appendChild(css)
    // app bundle FIRST — the ~20MB NG_CONTENT dossier payload is deferred off the critical
    // path (the app renders graceful fallbacks until it lands, then onContentReady refreshes).
    await new Promise<void>((res) => {
      const el = document.createElement("script")
      el.src = APP_BASE + "neural.js"
      el.defer = true
      el.onload = () => res()
      el.onerror = () => {
        console.warn("[variant] neural bundle unavailable at", el.src, "— showing static article")
        revealStaticArticle()
        res()
      }
      document.body.appendChild(el)
    })
    void loadScript(DATA_BASE + "technique-content.js").then(() => {
      try {
        ;(window as any).__neural?.onContentReady?.()
      } catch {
        /* app not mounted yet — it reads window.NG_CONTENT lazily anyway */
      }
    })
  })()
  return bundlePromise
}

/** Fall back to the crawlable static page: clear the attribute the hide rule keys on, so the
 *  <article> Quartz rendered becomes visible instead of a blank dark screen. */
function revealStaticArticle(): void {
  delete document.documentElement.dataset.variant
  setStaticHidden(false)
}

// Mount (or re-mount) the overlay for the current page and register its teardown with the SPA
// router, so it is destroyed BEFORE the next body morph (releasing the keyboard + stopping the
// rAF loop). addCleanup drains + clears each nav, so we re-register after every mount.
async function mountAndRegisterCleanup(): Promise<void> {
  await loadNeuralBundle()
  const mount = (window as any).__mountNeural
  if (typeof mount !== "function") {
    // The load has SETTLED and the bundle still did not install its entry point — genuinely
    // broken (404, parse error, truncated response). The article is the fallback.
    revealStaticArticle()
    return
  }
  try {
    mount() // idempotent: no-op if a live root already exists
  } catch (e) {
    console.warn("[variant] neural mount failed:", e, "— showing static article")
    revealStaticArticle()
    return
  }
  ;(window as any).addCleanup?.(() => {
    try {
      ;(window as any).__neural?.destroy?.()
    } catch (e) {
      console.warn("[variant] neural teardown failed:", e)
    }
  })
}

function boot(): void {
  // The attribute + hide style need only <head>/<html>, which exist even at prescript time —
  // applying them immediately prevents a flash of the static article before the app paints.
  document.documentElement.dataset.variant = "neural"
  fireExposure()
  setStaticHidden(true)
  // appending the bundle <script>s needs <body>, which does NOT exist at head time — defer
  // just the mount (the "nav" path is always post-body, so it resolves immediately there).
  const mount = () => void mountAndRegisterCleanup()
  if (document.body) mount()
  else document.addEventListener("DOMContentLoaded", mount, { once: true })
}

// First execution (full page load, from prescript.js in <head>) + every SPA soft-nav (this
// inline script does not re-execute on soft nav, so react to the router's "nav" event —
// teardown for the outgoing page has already run via addCleanup, and micromorph removed
// #neural-root, so __mountNeural builds a fresh one).
boot()
document.addEventListener("nav", () => boot())
