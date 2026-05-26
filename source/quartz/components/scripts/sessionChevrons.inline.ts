// SessionChevrons runtime — show/hide chevrons + wire prev/next nav.
//   Visible only when body[data-training-active] (toggled by FlashcardsHeader,
//   DecksModal, or trainingSession.stopSession()/completeSession()).
//   Click left → reverseSession() → spaNavigate prev page.
//   Click right → advanceSession() → spaNavigate next page (or completeSession at end).
//   ArrowLeft/ArrowRight keyboard, gated by isTypingTarget (no input focus).

import {
  advanceSession,
  reverseSession,
  completeSession,
  getSession,
  isInSession,
} from "./trainingSession"

interface Boundable extends HTMLElement {
  __sessionChevronsBound?: boolean
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  return false
}

document.addEventListener("nav", () => {
  const container = document.getElementById("session-chevrons") as Boundable | null
  if (!container) return

  const prevBtn = document.getElementById("session-chevron-prev") as HTMLButtonElement | null
  const nextBtn = document.getElementById("session-chevron-next") as HTMLButtonElement | null
  if (!prevBtn || !nextBtn) return

  // Reflect current session into the chevron visibility / glyphs
  const renderState = () => {
    const inSession = isInSession()
    document.body.toggleAttribute("data-training-active", inSession)
    container.classList.toggle("session-chevrons--visible", inSession)

    if (!inSession) {
      prevBtn.classList.add("session-chevron--hidden")
      nextBtn.classList.remove("session-chevron--finish")
      return
    }

    const session = getSession()!
    const atFirst = session.currentIndex <= 0
    const atLast = session.currentIndex >= session.pages.length - 1

    prevBtn.classList.toggle("session-chevron--hidden", atFirst)
    nextBtn.classList.toggle("session-chevron--finish", atLast)
    nextBtn.setAttribute("aria-label", atLast ? "Finish session" : "Next flashcard")
    nextBtn.setAttribute("title", atLast ? "Finish session" : "Next (→)")
  }

  renderState()

  // Bind once; element persists across navs
  if (container.__sessionChevronsBound) return
  container.__sessionChevronsBound = true

  const onPrev = () => {
    if (!isInSession()) return
    reverseSession()
  }

  const onNext = () => {
    if (!isInSession()) return
    const session = getSession()
    if (!session) return
    const atLast = session.currentIndex >= session.pages.length - 1
    if (atLast) {
      completeSession()
      renderState()
    } else {
      advanceSession()
    }
  }

  prevBtn.addEventListener("click", onPrev)
  nextBtn.addEventListener("click", onNext)

  // Global keyboard shortcuts — only fire when a session is active and the
  // user isn't typing in an input.
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (isTypingTarget(e.target)) return
    if (!isInSession()) return
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      onPrev()
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      onNext()
    }
  }
  document.addEventListener("keydown", onKey)
})
