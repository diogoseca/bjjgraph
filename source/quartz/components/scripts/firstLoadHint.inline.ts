// FirstLoadHint runtime — show a one-time discrete ghost tooltip below the
// FlashcardsHeader strip pill on a new visitor's first page load. Anchored
// to #flashcards-header-label (the strip's text button).
//
// Lifecycle (CSS-driven, symmetrical):
//   t=0          opacity 0 (invisible, just inserted)
//   t=0.35s      opacity 0.5 (quiet dark ghost — fade-in done)
//   t=1.85s      opacity 0.5 (hold ends)
//   t=2.2s       opacity 0 (faded out — DOM node removed by JS)
//
// Manual dismiss (Esc / click anywhere) starts the same 0.35s fade-out
// immediately from whatever opacity the hint is currently at — same speed,
// just sooner. Never a snap cut.
//
// On the home page, the show() call is held back until after the cinematic
// intro completes (5s) plus a 1s breathing gap — so the hint doesn't compete
// with the title / taglines / overlay-fade animation. On every other page,
// the hint fires immediately on `nav`.
//
// The onboarded flag is written inside show() so a reload during the 6s
// home-page hold doesn't lock the user out of ever seeing the hint.

const ONBOARDED_KEY = "bjj-onboarded"
const HINT_ID = "first-load-hint"
const HINT_LIFETIME_MS = 2200 // must match the CSS keyframe duration
const HINT_FADE_OUT_MS = 350 // must match the --leaving transition
// Home-page intro is 5s (see body[data-slug="index"] keyframes in custom.scss).
// 1s extra gap so the hint doesn't crowd the moment the overlay fully clears.
const HOME_PAGE_START_DELAY_MS = 6000

let hintShownThisSession = false

function dismiss(reason: "timeout" | "click" | "esc" = "click") {
  const el = document.getElementById(HINT_ID)
  if (!el) return
  if (reason === "timeout") {
    // Auto-dismiss path — CSS keyframe has already faded the node, just remove it.
    el.remove()
    return
  }
  // Manual dismiss — pin the current animated opacity inline, then stop the
  // keyframe and trigger the --leaving transition. This makes the fade-out
  // start from wherever the hint is right now (mid-fade-in, hold, etc.)
  // and complete in the same 0.5s as the auto fade-out — sooner, not faster.
  const currentOpacity = window.getComputedStyle(el).opacity
  el.style.opacity = currentOpacity
  el.classList.add("first-load-hint--leaving")
  // Force a reflow so the browser commits the pinned opacity before we set
  // the target — otherwise the transition can miss its starting point.
  void el.offsetHeight
  el.style.opacity = "0"
  window.setTimeout(() => el.remove(), HINT_FADE_OUT_MS)
  void reason
}

function show() {
  // Wait one frame so the strip's runtime has had a chance to populate.
  requestAnimationFrame(() => {
    const anchor = document.getElementById("flashcards-header-label")
    if (!anchor) return
    if (document.getElementById(HINT_ID)) return

    // Persist the onboarded flag immediately. If the user reloads mid-fade
    // we don't want to re-show — the hint fires exactly once per browser, ever.
    try {
      localStorage.setItem(ONBOARDED_KEY, "true")
    } catch {
      // storage unavailable — hint will re-fire next visit, acceptable
    }

    const rect = anchor.getBoundingClientRect()
    const hint = document.createElement("div")
    hint.id = HINT_ID
    hint.className = "first-load-hint"
    hint.setAttribute("role", "tooltip")
    hint.setAttribute("aria-live", "polite")
    // Position the hint just below the strip label, horizontally centered on it
    hint.style.top = `${rect.bottom + 10}px`
    hint.style.left = `${rect.left + rect.width / 2}px`
    hint.innerHTML = `
      <span class="first-load-hint-text">Memorize BJJ using spaced-repetition.</span>
    `
    document.body.appendChild(hint)

    // Auto-removal at end of CSS keyframe cycle
    const autoTimer = window.setTimeout(() => dismiss("timeout"), HINT_LIFETIME_MS)

    const cleanup = () => {
      window.clearTimeout(autoTimer)
      document.removeEventListener("click", onAnyClick, true)
      document.removeEventListener("keydown", onKey)
    }

    const onAnyClick = () => {
      cleanup()
      dismiss("click")
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup()
        dismiss("esc")
      }
    }
    // capture:true so we see the click before any other handler dismisses it indirectly
    document.addEventListener("click", onAnyClick, true)
    document.addEventListener("keydown", onKey)
  })
}

document.addEventListener("nav", () => {
  if (hintShownThisSession) return
  try {
    if (localStorage.getItem(ONBOARDED_KEY) === "true") {
      hintShownThisSession = true
      return
    }
  } catch {
    // proceed without storage
  }
  hintShownThisSession = true

  const isHomePage = document.body.dataset.slug === "index"
  const startDelay = isHomePage ? HOME_PAGE_START_DELAY_MS : 0

  if (startDelay > 0) {
    window.setTimeout(show, startDelay)
  } else {
    show()
  }
})
