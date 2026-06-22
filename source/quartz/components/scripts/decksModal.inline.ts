// DecksModal runtime — lean overlay listing the 5 deck types with a sticky
// bottom CTA. Opened via window.__openDecksModal() (called by the
// FlashcardsHeader label). Closed by × / Esc / click-outside.
//
// Each deck row is a one-click "make this my session" shortcut: clicking a
// row closes the modal, builds a session from that source, and navigates
// to the first card. The sticky bottom CTA always trains the Due cards
// (or 30 suggested if 0 due, or resumes a session if one's active).

import { getDueCards, getUpcomingCards, getMasteredCards } from "./srs"
import { loadSettings, loadDailyProgress, loadStreak } from "./settings"
import { loadExplored } from "./explored"
import {
  loadQuestionBank,
  loadGraphAdjacency,
  getSuggestedTechniques,
  buildMasteryLookup,
  buildSuggestionContext,
  startOrResumeSession,
  getSession,
  type SessionSource,
  type SuggestedTechnique,
  type SuggestionFactor,
} from "./trainingSession"

const MODAL_ID = "decks-modal-overlay"

interface DeckRow {
  key: SessionSource
  label: string
  count: number
  /** Disabled when count is 0 — clicking shows a brief "nothing here" hint */
  enabled: boolean
}

// How many picks to preview with factor chips when the Suggested row expands.
const SUGGESTED_PREVIEW_LIMIT = 6

async function buildDeckRows(): Promise<{ rows: DeckRow[]; suggestedPicks: SuggestedTechnique[] }> {
  const settings = loadSettings()
  const suggestionsCount = Math.min(settings.dailyGoal, 30)

  const due = getDueCards()
  const reviewing = getUpcomingCards()
  const mastered = getMasteredCards()
  const explored = loadExplored().filter((e) => e.type === "transition" || e.type === "submission")

  // Compute the actual picked set (gap-filling, mastery-graded) so the row count
  // and the expandable preview share one ranking.
  let suggestedPicks: SuggestedTechnique[] = []
  const [bank, adjacency] = await Promise.all([loadQuestionBank(), loadGraphAdjacency()])
  if (bank.length > 0 && adjacency) {
    const mastery = buildMasteryLookup()
    const ctx = buildSuggestionContext()
    suggestedPicks = getSuggestedTechniques(bank, mastery, adjacency, suggestionsCount, {
      exploredHubs: ctx.exploredHubs,
      exploredNames: ctx.exploredNames,
    })
  }

  const rows: DeckRow[] = [
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
      count: suggestedPicks.length,
      enabled: suggestedPicks.length > 0,
    },
    {
      key: "explored",
      label: "Recently explored",
      count: explored.length,
      enabled: explored.length > 0,
    },
  ]
  return { rows, suggestedPicks }
}

const FACTOR_LABELS: Record<SuggestionFactor, string> = {
  common: "Common",
  effective: "Effective",
  newground: "New ground",
  fitsyourgame: "Fits your game",
}

// At least this share of the score to earn a chip; no single factor dominates,
// so we surface the top ≤2 meaningful contributors rather than one "reason".
const CHIP_SHARE_THRESHOLD = 0.18

function chipsHtml(s: SuggestedTechnique): string {
  return s.factors
    .filter((f) => f.share >= CHIP_SHARE_THRESHOLD)
    .slice(0, 2)
    .map((f) => {
      const label = FACTOR_LABELS[f.factor]
      const pct = Math.round(f.share * 100)
      let title = `${label} — ~${pct}% of why this was picked`
      if (f.factor === "effective") title += ` · ${Math.round(f.raw * 100)}% success rate`
      return `<span class="suggestion-chip suggestion-chip--${f.factor}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`
    })
    .join("")
}

function suggestedPreviewHtml(picks: SuggestedTechnique[]): string {
  const cards = picks
    .slice(0, SUGGESTED_PREVIEW_LIMIT)
    .map(
      (s) => `
      <div class="suggestion-card">
        <div class="suggestion-card-head">
          <span class="suggestion-card-title">${escapeHtml(s.entry.name)}</span>
          <span class="suggestion-card-type">${s.entry.type === "submission" ? "Submission" : "Transition"}</span>
        </div>
        <div class="suggestion-chips">${chipsHtml(s)}</div>
      </div>`,
    )
    .join("")
  const more =
    picks.length > SUGGESTED_PREVIEW_LIMIT
      ? `<p class="suggestion-more">+ ${picks.length - SUGGESTED_PREVIEW_LIMIT} more in this session</p>`
      : ""
  return `
    <div class="decks-suggested-preview" id="decks-suggested-preview" hidden>
      <div class="decks-suggested-cards">${cards}</div>
      ${more}
      <button type="button" class="decks-suggested-drill" id="decks-suggested-drill">Drill these ${picks.length} ▶</button>
    </div>`
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

// Esc is bound on document, so it must be torn down explicitly on close —
// otherwise repeated open/close leaks a keydown listener each time (ui-1). The
// click-outside listener is bound to the overlay element and dies when it's
// removed, so it needs no explicit cleanup.
let escHandler: ((e: KeyboardEvent) => void) | null = null

// Synchronous re-entrancy guard for open(). The DOM guard (getElementById) can't
// catch a double-tap because the overlay isn't appended until after an await, so
// two fast calls would both pass it and append two overlays (#30). Set true at
// the top of open() and cleared once the overlay lands (and on close / error).
let opening = false

function close() {
  document.getElementById(MODAL_ID)?.remove()
  opening = false
  if (escHandler) {
    document.removeEventListener("keydown", escHandler)
    escHandler = null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function open() {
  // If already open (or an open is mid-flight across an await), do nothing.
  if (opening || document.getElementById(MODAL_ID)) return
  opening = true

  try {
    await openInner()
  } finally {
    // Always release the sentinel so a later open can run, even if openInner
    // threw before appending the overlay.
    opening = false
  }
}

async function openInner() {
  const settings = loadSettings()
  const progress = loadDailyProgress()
  const streak = loadStreak()
  const totalDone = progress.learned + progress.reviewed

  const { rows: decks, suggestedPicks } = await buildDeckRows()
  const cta = buildCtaState()

  const streakBit =
    streak.currentStreak > 0
      ? `<span class="decks-modal-streak">✨ ${streak.currentStreak}-day streak</span>`
      : ""

  const rowsHtml = decks
    .map((d) => {
      const disabledAttr = d.enabled ? "" : "disabled"
      const disabledClass = d.enabled ? "" : "decks-modal-row--disabled"
      // The Suggested row expands an inline preview (with factor chips) instead
      // of immediately starting a session; everything else is one-click.
      const isExpandable = d.key === "suggested" && d.enabled
      const chev = isExpandable ? "⌄" : "›"
      const expandAttrs = isExpandable
        ? ` aria-expanded="false" aria-controls="decks-suggested-preview"`
        : ""
      const row = `
        <button
          type="button"
          class="decks-modal-row ${disabledClass}"
          data-deck="${d.key}"
          ${disabledAttr}${expandAttrs}
        >
          <span class="decks-modal-row-label">${escapeHtml(d.label)}</span>
          <span class="decks-modal-row-count">${d.count}</span>
          <span class="decks-modal-row-chev" aria-hidden="true">${chev}</span>
        </button>
      `
      return isExpandable ? row + suggestedPreviewHtml(suggestedPicks) : row
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
          <p class="decks-modal-subtitle">Spaced-repetition Q&A on BJJ techniques.</p>
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

  // Click-outside (bound to the overlay, GC'd with it) + Esc (bound to
  // document, removed in close()). Plus a nav safety net.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      e.preventDefault()
      close()
    }
  })
  escHandler = (e: KeyboardEvent) => {
    // Topmost-only: when the Settings modal (z 9991) is stacked above us, let it
    // own Esc. Otherwise one Esc would close both stacked overlays at once (#29).
    if (document.getElementById("settings-modal-overlay")) return
    if (e.key.startsWith("Esc")) {
      e.preventDefault()
      close()
    }
  }
  document.addEventListener("keydown", escHandler)
  window.addCleanup(close)

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

  // Per-row click — start a session from that deck (Suggested toggles its
  // preview instead).
  overlay.querySelectorAll(".decks-modal-row").forEach((rowEl) => {
    rowEl.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement
      if (target.disabled) return
      const deck = (target.dataset.deck ?? "mixed") as SessionSource

      if (deck === "suggested") {
        const preview = document.getElementById("decks-suggested-preview")
        if (preview) {
          const nowHidden = !preview.hasAttribute("hidden")
          if (nowHidden) preview.setAttribute("hidden", "")
          else preview.removeAttribute("hidden")
          target.setAttribute("aria-expanded", String(!nowHidden))
          target.classList.toggle("decks-modal-row--expanded", !nowHidden)
        }
        return
      }

      document.body.setAttribute("data-training-active", "true")
      close()
      startOrResumeSession(deck, { autoExpand: true, force: true })
    })
  })

  // Suggested preview → "Drill these N" starts the suggested session.
  document.getElementById("decks-suggested-drill")?.addEventListener("click", () => {
    document.body.setAttribute("data-training-active", "true")
    close()
    startOrResumeSession("suggested", { autoExpand: true, force: true })
  })
}

;(window as any).__openDecksModal = open
