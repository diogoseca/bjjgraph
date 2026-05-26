// DecksModal runtime — lean overlay listing the 5 deck types with a sticky
// bottom CTA. Opened via window.__openDecksModal() (called by the
// FlashcardsHeader label). Closed by × / Esc / click-outside.
//
// Each deck row is a one-click "make this my session" shortcut: clicking a
// row closes the modal, builds a session from that source, and navigates
// to the first card. The sticky bottom CTA always trains the Due cards
// (or 30 suggested if 0 due, or resumes a session if one's active).

import { registerEscapeHandler } from "./util"
import { loadSRSCards, getDueCards, getUpcomingCards, getMasteredCards } from "./srs"
import { loadSettings, loadDailyProgress, loadStreak } from "./settings"
import { loadExplored } from "./explored"
import {
  loadQuestionBank,
  loadGraphAdjacency,
  getSuggestedTechniques,
  startOrResumeSession,
  getSession,
  type SessionSource,
} from "./trainingSession"

const MODAL_ID = "decks-modal-overlay"

interface DeckRow {
  key: SessionSource
  label: string
  count: number
  /** Disabled when count is 0 — clicking shows a brief "nothing here" hint */
  enabled: boolean
}

async function buildDeckRows(): Promise<DeckRow[]> {
  const settings = loadSettings()
  const suggestionsCount = Math.min(settings.dailyGoal, 30)

  const due = getDueCards()
  const reviewing = getUpcomingCards()
  const mastered = getMasteredCards()
  const explored = loadExplored().filter((e) => e.type === "transition" || e.type === "submission")

  // Suggestions can be expensive to fully compute; just show the raw count of
  // suggestion candidates (the pool, not the picked set). If we wanted the
  // exact session-size we'd run getSuggestedTechniques here, but for a header
  // count the candidate pool is sufficient and faster.
  let suggestionsAvailable = 0
  const [bank, adjacency] = await Promise.all([loadQuestionBank(), loadGraphAdjacency()])
  if (bank.length > 0 && adjacency) {
    const existing = new Set(loadSRSCards().map((c) => c.technique))
    const suggested = getSuggestedTechniques(bank, existing, adjacency, suggestionsCount)
    suggestionsAvailable = suggested.length
  }

  return [
    { key: "due", label: "Due Today", count: due.length, enabled: due.length > 0 },
    {
      key: "reviewing",
      label: "Reviewing",
      count: reviewing.length,
      enabled: reviewing.length > 0,
    },
    { key: "mastered", label: "Mastered", count: mastered.length, enabled: mastered.length > 0 },
    {
      key: "suggested",
      label: "Suggested for you",
      count: suggestionsAvailable,
      enabled: suggestionsAvailable > 0,
    },
    {
      key: "explored",
      label: "Recently explored",
      count: explored.length,
      enabled: explored.length > 0,
    },
  ]
}

function buildCtaState(): { label: string; enabled: boolean; source: SessionSource } {
  const session = getSession()
  if (session && session.pages.length > 0) {
    const current = session.currentIndex + 1
    const total = session.pages.length
    return { label: `Resume ${current}/${total} ▶`, enabled: true, source: "mixed" }
  }

  const due = getDueCards()
  if (due.length > 0) {
    return { label: `Drill ${due.length} ▶`, enabled: true, source: "due" }
  }

  const settings = loadSettings()
  // 0 due — offer suggestions to fill to dailyGoal
  return {
    label: `Drill ${settings.dailyGoal} new ▶`,
    enabled: true,
    source: "suggested",
  }
}

function close() {
  document.getElementById(MODAL_ID)?.remove()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function open() {
  // If already open, do nothing
  if (document.getElementById(MODAL_ID)) return

  const settings = loadSettings()
  const progress = loadDailyProgress()
  const streak = loadStreak()
  const totalDone = progress.learned + progress.reviewed

  const decks = await buildDeckRows()
  const cta = buildCtaState()

  const streakBit =
    streak.currentStreak > 0
      ? `<span class="decks-modal-streak">✨ ${streak.currentStreak}-day streak</span>`
      : ""

  const rowsHtml = decks
    .map((d) => {
      const disabledAttr = d.enabled ? "" : "disabled"
      const disabledClass = d.enabled ? "" : "decks-modal-row--disabled"
      return `
        <button
          type="button"
          class="decks-modal-row ${disabledClass}"
          data-deck="${d.key}"
          ${disabledAttr}
        >
          <span class="decks-modal-row-label">${escapeHtml(d.label)}</span>
          <span class="decks-modal-row-count">${d.count}</span>
          <span class="decks-modal-row-chev" aria-hidden="true">›</span>
        </button>
      `
    })
    .join("")

  const overlay = document.createElement("div")
  overlay.id = MODAL_ID
  overlay.className = "decks-modal-overlay"
  overlay.innerHTML = `
    <div class="decks-modal-panel" role="dialog" aria-labelledby="decks-modal-title">
      <header class="decks-modal-header">
        <div class="decks-modal-header-titles">
          <h2 id="decks-modal-title" class="decks-modal-title">
            <span class="decks-modal-title-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </span>
            <span class="decks-modal-title-text">Flashcards to drill</span>
          </h2>
          <p class="decks-modal-subtitle">Lock BJJ techniques into long-term memory.</p>
        </div>
        <div class="decks-modal-header-actions">
          <button
            type="button"
            class="decks-modal-icon-btn"
            id="decks-modal-settings"
            aria-label="Open settings"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button
            type="button"
            class="decks-modal-icon-btn"
            id="decks-modal-close"
            aria-label="Close"
            title="Close"
          >&times;</button>
        </div>
      </header>
      <div class="decks-modal-body">
        ${rowsHtml}
      </div>
      <footer class="decks-modal-footer">
        <div class="decks-modal-footer-stats">
          ${streakBit}
          <span class="decks-modal-progress">${totalDone}/${settings.dailyGoal} today</span>
        </div>
        <button
          type="button"
          class="decks-modal-cta"
          id="decks-modal-cta"
          data-source="${cta.source}"
          ${cta.enabled ? "" : "disabled"}
        >
          ${escapeHtml(cta.label)}
        </button>
      </footer>
    </div>
  `

  document.body.appendChild(overlay)
  registerEscapeHandler(overlay, close)

  document.getElementById("decks-modal-close")?.addEventListener("click", close)

  document.getElementById("decks-modal-settings")?.addEventListener("click", () => {
    const openSettings = (window as any).__openSettingsModal as
      | ((defaultTab?: "flashcards" | "game") => void)
      | undefined
    if (openSettings) openSettings("flashcards")
  })

  document.getElementById("decks-modal-cta")?.addEventListener("click", () => {
    const src = (cta.source ?? "mixed") as SessionSource
    document.body.setAttribute("data-training-active", "true")
    close()
    startOrResumeSession(src, { autoExpand: true })
  })

  // Per-row click — start a session from that deck
  overlay.querySelectorAll(".decks-modal-row").forEach((rowEl) => {
    rowEl.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement
      if (target.disabled) return
      const deck = (target.dataset.deck ?? "mixed") as SessionSource
      document.body.setAttribute("data-training-active", "true")
      close()
      startOrResumeSession(deck, { autoExpand: true, force: true })
    })
  })
}

;(window as any).__openDecksModal = open
