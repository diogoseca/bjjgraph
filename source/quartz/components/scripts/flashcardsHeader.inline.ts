// FlashcardsHeader runtime — pure-noun wayfinding pill.
// The play/stop button lives in a separate RollSessionButton component; the
// strip itself never carries a verb (avoids colliding with the adjacent roll
// button — "training" used to mean both flashcards and rolling).
//
//  Label state machine:
//    Idle, due > 0          → "Flashcards · N due"
//    Idle, no SRS yet       → "Flashcards"
//    Idle, has SRS, 0 due   → "Flashcards"
//
//  The icon (stacked-cards SVG) lives in the SSR markup as a sibling span
//  and is never touched by this script. Only `.flashcards-header-text` is
//  mutated.
//
//  Click label → opens DecksModal.

import { getDueCards } from "./srs"
import { getSession } from "./trainingSession"

interface Boundable extends HTMLElement {
  __flashcardsHeaderBound?: boolean
}

document.addEventListener("nav", () => {
  const container = document.getElementById("flashcards-header") as Boundable | null
  if (!container) return

  const labelBtn = document.getElementById("flashcards-header-label") as HTMLButtonElement | null
  if (!labelBtn) return
  const textEl = labelBtn.querySelector(".flashcards-header-text") as HTMLElement | null
  const badgeEl = labelBtn.querySelector(".flashcards-header-badge") as HTMLElement | null

  const renderState = () => {
    const session = getSession()
    const due = getDueCards()

    // Label stays stable regardless of active session — session progress is
    // surfaced via SessionChevrons, not by hijacking this label.
    const labelText = due.length > 0 ? `Flashcards · ${due.length} due` : "Flashcards"

    if (textEl) {
      textEl.textContent = labelText
    } else {
      // Defensive fallback if the SSR span structure ever regresses.
      labelBtn.textContent = labelText
    }
    // Badge: only visible on mobile (icon-only mode) via CSS `:not(:empty)`.
    // Setting empty string when N=0 hides it without needing a JS class toggle.
    if (badgeEl) {
      badgeEl.textContent = due.length > 0 ? String(due.length) : ""
    }
    // Keep the session class hook around in case other styles depend on it,
    // but it now tracks the actual session state without affecting label text.
    container.classList.toggle(
      "flashcards-header--session",
      !!(session && session.pages.length > 0),
    )
  }

  renderState()

  if (container.__flashcardsHeaderBound) return
  container.__flashcardsHeaderBound = true

  const onLabelClick = () => {
    const open = (window as any).__openDecksModal as (() => void) | undefined
    if (open) open()
  }
  labelBtn.addEventListener("click", onLabelClick)

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === "bjj-srs-cards") renderState()
  }
  window.addEventListener("storage", onStorage)
})
