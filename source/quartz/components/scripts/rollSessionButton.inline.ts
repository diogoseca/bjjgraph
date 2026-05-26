// RollSessionButton runtime — start/stop a "roll" session (curated journey
// through positions/techniques). Lives at top-right, visually decoupled from
// the FlashcardsHeader so users don't conflate it with flashcards controls.

import { isInSession, startOrResumeSession, stopSession } from "./trainingSession"

interface Boundable extends HTMLElement {
  __rollSessionBound?: boolean
}

document.addEventListener("nav", () => {
  const btn = document.getElementById("roll-session-btn") as Boundable | null
  if (!btn) return

  const syncState = () => {
    const active = isInSession()
    btn.classList.toggle("roll-session-btn--active", active)
    btn.setAttribute(
      "aria-label",
      active
        ? "Stop the current roll session"
        : "Start a roll — simulate a journey through positions",
    )
    btn.setAttribute("title", active ? "Stop session" : "Roll — start a session")
  }
  syncState()

  if (btn.__rollSessionBound) return
  btn.__rollSessionBound = true

  btn.addEventListener("click", () => {
    if (isInSession()) {
      stopSession()
      document.body.removeAttribute("data-training-active")
    } else {
      startOrResumeSession("mixed", { autoExpand: true })
      document.body.setAttribute("data-training-active", "true")
    }
    syncState()
  })
})
