// FlashcardsHeader runtime — context-aware label + ▶/◾ play/stop toggle.
// The DOM element persists across SPA navs via [data-persist]; this script
// re-runs each "nav" event and patches text + icon based on current state.
//
//  Label state machine:
//    Idle, due > 0          → "Flashcards (N due)"
//    Active session         → "Session  X/Y"
//    Idle, 0 due, no SRS    → "Start training"
//    Idle, 0 due, has SRS   → "All caught up · train more"
//
//  Click label → opens DecksModal (when implemented; for now a no-op stub).
//  Click ▶ → startOrResumeSession('mixed', { autoExpand: true })
//  Click ◾ → stopSession() (during active session only).

import { getDueCards, loadSRSCards } from "./srs"
import { getSession, isInSession, startOrResumeSession, stopSession } from "./trainingSession"

// Tag the runtime so we don't double-bind across SPA navs (the element
// persists, so binding inside the nav handler would stack listeners every
// time the user navigates).
interface Boundable extends HTMLElement {
  __flashcardsHeaderBound?: boolean
}

document.addEventListener("nav", () => {
  const container = document.getElementById("flashcards-header") as Boundable | null
  if (!container) return

  const labelBtn = document.getElementById("flashcards-header-label") as HTMLButtonElement | null
  const playBtn = document.getElementById("flashcards-header-play") as HTMLButtonElement | null
  if (!labelBtn || !playBtn) return

  // ── Label + button state ─────────────────────────────────────────────
  const renderState = () => {
    const session = getSession()
    const due = getDueCards()
    const allCards = loadSRSCards()

    let labelText: string
    let playIsStop = false

    if (session && session.pages.length > 0) {
      // Active session
      const current = session.currentIndex + 1
      const total = session.pages.length
      labelText = `Session  ${current}/${total}`
      playIsStop = true
    } else if (due.length > 0) {
      labelText = `Flashcards (${due.length} due)`
    } else if (allCards.length === 0) {
      labelText = "Start training"
    } else {
      labelText = "All caught up · train more"
    }

    labelBtn.textContent = labelText
    container.classList.toggle("flashcards-header--session", playIsStop)
    playBtn.setAttribute(
      "aria-label",
      playIsStop ? "Stop training session" : "Start training session",
    )
    playBtn.setAttribute("title", playIsStop ? "Stop session" : "Start session")
  }

  renderState()

  // ── Wire handlers once (skip on subsequent navs) ─────────────────────
  if (container.__flashcardsHeaderBound) return
  container.__flashcardsHeaderBound = true

  const onLabelClick = () => {
    // DecksModal not yet built — stub. Will be wired in task 5.
    const open = (window as any).__openDecksModal as (() => void) | undefined
    if (open) open()
  }

  const onPlayClick = () => {
    if (isInSession()) {
      // ◾ stop session, snackbar with Undo
      stopSession()
      renderState()
    } else {
      // ▶ start (or resume if a session exists but is paused)
      startOrResumeSession("mixed", { autoExpand: true })
      // Mark body so SessionChevrons + dim styles activate
      document.body.setAttribute("data-training-active", "true")
      // renderState will run on the next nav event the SPA fires
    }
  }

  labelBtn.addEventListener("click", onLabelClick)
  playBtn.addEventListener("click", onPlayClick)

  // ── Storage changes (e.g., session created in another tab) ───────────
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === "bjj-srs-cards") renderState()
  }
  window.addEventListener("storage", onStorage)

  // No cleanup registered here — the element persists across navs, listeners
  // outlive a single page. The bound flag prevents re-binding.
})
