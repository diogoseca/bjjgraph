// FirstLoadHint runtime — show a one-time "Click to start" tooltip next to
// the FlashcardsHeader play button. Auto-dismiss after 5s, on Esc, or on
// any click anywhere. Persisted via localStorage["bjj-onboarded"]=true so
// the hint never reappears for that user.

const ONBOARDED_KEY = "bjj-onboarded"
const HINT_ID = "first-load-hint"
const HINT_DURATION_MS = 5000

let hintShownThisSession = false

function dismiss(reason: "timeout" | "click" | "esc" = "click") {
  const el = document.getElementById(HINT_ID)
  if (!el) return
  el.classList.add("first-load-hint--leaving")
  // Wait for CSS leave animation before removing
  window.setTimeout(() => el.remove(), 180)
  try {
    localStorage.setItem(ONBOARDED_KEY, "true")
  } catch {
    // storage unavailable — onboarding will re-fire next visit, fine
  }
  // Suppress further attempts in this tab
  hintShownThisSession = true
  // Voiding unused for now; reason kept for future analytics
  void reason
}

function show() {
  // Wait one frame so the strip's runtime has had a chance to populate.
  requestAnimationFrame(() => {
    const playBtn = document.getElementById("flashcards-header-play")
    if (!playBtn) return
    if (document.getElementById(HINT_ID)) return

    const rect = playBtn.getBoundingClientRect()
    const hint = document.createElement("div")
    hint.id = HINT_ID
    hint.className = "first-load-hint"
    hint.setAttribute("role", "tooltip")
    hint.setAttribute("aria-live", "polite")
    // Position the hint just below the play button, horizontally centered on it
    hint.style.top = `${rect.bottom + 10}px`
    hint.style.left = `${rect.left + rect.width / 2}px`
    hint.innerHTML = `
      <div class="first-load-hint-arrow" aria-hidden="true"></div>
      <span class="first-load-hint-text">Click to start</span>
    `
    document.body.appendChild(hint)

    // Auto-dismiss timer
    const timer = window.setTimeout(() => dismiss("timeout"), HINT_DURATION_MS)

    const cleanup = () => {
      window.clearTimeout(timer)
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
  show()
})
