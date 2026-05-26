// Shared training-session module: queue building, suggestion engine, format
// helpers, and session lifecycle. Consumed by FlashcardsHeader, DecksModal,
// SessionChevrons, the per-page Flashcard runtime, and (transitionally) the
// legacy TrainingDashboard until it is removed.
//
// All session state lives in sessionStorage under "training-session" so it
// survives SPA navigations but clears with the tab. SRS state stays in
// localStorage (see srs.ts).

import { loadSRSCards, getDueCards, getUpcomingCards, getMasteredCards } from "./srs"
import type { SRSCard } from "./srs"
import { loadSettings, loadDailyProgress } from "./settings"
import { loadExplored } from "./explored"

// ── Types ─────────────────────────────────────────────────────────────────

export interface QuestionBankEntry {
  name: string
  type: "transition" | "submission" | "position" | "principle" | "system"
  slug: string
  flashcards: Array<{ question: string; answer: string }>
}

export interface GraphAdjacency {
  /** positionHub → array of bank indices of techniques from that position */
  positions: Record<string, number[]>
  /** bank[index] → array of position hubs this technique leads to */
  outcomes: string[][]
}

export interface SessionPage {
  slug: string
  name: string
  type: string
}

/**
 * Source of a session — drives label copy and behaviour for special decks.
 * `mixed` is the default (due cards + suggestions to dailyGoal).
 */
export type SessionSource = "mixed" | "due" | "reviewing" | "mastered" | "suggested" | "explored"

export interface SessionQueue {
  pages: SessionPage[]
  currentIndex: number
  completed: number
  /** True → Flashcard component skips minimized state, jumps straight to expanded + answer revealed. */
  autoExpand?: boolean
  /** Where the queue came from — useful for labels and analytics. */
  source?: SessionSource
}

// ── Lazy training data loaders ────────────────────────────────────────────
// Fetched on demand from /static/questionBank.json(.gz) and
// /static/graphAdjacency.json(.gz). The fetch is cached per session via the
// window.loadQuestionBank / window.loadGraphAdjacency Promise wrappers
// installed by renderPage.tsx, so subsequent calls reuse the same Promise.

declare global {
  interface Window {
    loadQuestionBank?: () => Promise<QuestionBankEntry[]>
    loadGraphAdjacency?: () => Promise<GraphAdjacency | null>
  }
}

export async function loadQuestionBank(): Promise<QuestionBankEntry[]> {
  if (typeof window === "undefined" || !window.loadQuestionBank) return []
  try {
    const data = await window.loadQuestionBank()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function loadGraphAdjacency(): Promise<GraphAdjacency | null> {
  if (typeof window === "undefined" || !window.loadGraphAdjacency) return null
  try {
    return (await window.loadGraphAdjacency()) ?? null
  } catch {
    return null
  }
}

// ── Suggestion engine ─────────────────────────────────────────────────────

export function getSuggestedTechniques(
  questionBank: QuestionBankEntry[],
  existingNames: Set<string>,
  adjacency: GraphAdjacency,
  count: number,
): Array<{ entry: QuestionBankEntry; score: number; reason: string }> {
  const coldStart = existingNames.size === 0

  const knownIndices = new Set<number>()
  questionBank.forEach((entry, idx) => {
    if (existingNames.has(entry.name)) knownIndices.add(idx)
  })

  const idxToPositions: string[][] = []
  for (let i = 0; i < questionBank.length; i++) idxToPositions.push([])
  for (const [pos, indices] of Object.entries(adjacency.positions)) {
    for (const idx of indices) {
      if (idx < idxToPositions.length) idxToPositions[idx].push(pos)
    }
  }

  const scored: Array<{ entry: QuestionBankEntry; score: number; reason: string }> = []

  for (let i = 0; i < questionBank.length; i++) {
    const entry = questionBank[i]
    if (existingNames.has(entry.name)) continue

    let siblingScore = 0
    let chainScore = 0

    for (const pos of idxToPositions[i]) {
      const siblings = adjacency.positions[pos] || []
      for (const sibIdx of siblings) {
        if (sibIdx !== i && (coldStart || knownIndices.has(sibIdx))) siblingScore++
      }
    }

    const outPositions = adjacency.outcomes[i] || []
    for (const pos of outPositions) {
      const targets = adjacency.positions[pos] || []
      for (const tIdx of targets) {
        if (tIdx !== i && (coldStart || knownIndices.has(tIdx))) chainScore++
      }
    }

    const score = siblingScore + chainScore
    if (score === 0) continue

    const reason = coldStart
      ? `${score} connected techniques`
      : siblingScore > 0 && chainScore > 0
        ? `${siblingScore} from same position, ${chainScore} chained`
        : siblingScore > 0
          ? `${siblingScore} from same position`
          : `${chainScore} chained techniques`

    scored.push({ entry, score, reason })
  }

  // Cold-start: boost half-guard-adjacent techniques so new users start there
  if (coldStart) {
    for (const s of scored) {
      const idx = questionBank.indexOf(s.entry)
      const positions = idxToPositions[idx] || []
      if (positions.some((p) => p.includes("half-guard"))) s.score += 1000
    }
  }

  scored.sort((a, b) => b.score - a.score)

  // Type-balanced selection: interleave transitions and submissions
  const transitions = scored.filter((s) => s.entry.type === "transition")
  const submissions = scored.filter((s) => s.entry.type === "submission")
  const result: typeof scored = []
  let ti = 0
  let si = 0
  while (result.length < count) {
    const t = transitions[ti]
    const s = submissions[si]
    if (!t && !s) break
    if (!s || (t && t.score >= s.score * 0.5)) {
      result.push(t!)
      ti++
    } else {
      result.push(s!)
      si++
    }
  }
  return result
}

// ── Slug + date helpers ───────────────────────────────────────────────────

/**
 * Transitions and submissions live at `/Type/Name/Attacker` for the trainable
 * surface; everything else uses its hub slug.
 */
export function toRoleSlug(slug: string, type: string): string {
  if (type === "transition" || type === "submission") {
    const clean = slug.replace(/\/$/, "")
    if (!clean.endsWith("/Attacker") && !clean.endsWith("/Defender")) {
      return clean + "/Attacker"
    }
  }
  return slug
}

export function formatIntervalPreview(days: number): string {
  if (days < 1) return "1d"
  if (days < 30) return `${Math.round(days)}d`
  return `${Math.round(days / 30)}mo`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatFutureDate(dateStr: string): string {
  const now = new Date()
  const target = new Date(dateStr + "T00:00:00")
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 1) return "Tomorrow"
  if (diffDays <= 7) return `In ${diffDays} days`
  return formatDate(dateStr)
}

// ── Session lifecycle ─────────────────────────────────────────────────────

const SESSION_KEY = "training-session"
const SESSION_COMPLETE_KEY = "training-session-complete"

export function getSession(): SessionQueue | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as SessionQueue
  } catch {
    // corrupt
  }
  return null
}

export function saveSession(session: SessionQueue) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isInSession(): boolean {
  const session = getSession()
  return session !== null && session.pages.length > 0
}

/**
 * Build a queue from one of the named decks. Default `mixed` source:
 * all due cards first (overdue first), then suggestions to fill to dailyGoal.
 */
export async function buildSessionQueue(
  source: SessionSource = "mixed",
  options: { autoExpand?: boolean } = {},
): Promise<SessionQueue> {
  const settings = loadSettings()
  const pages: SessionPage[] = []
  const existingNames = new Set(loadSRSCards().map((c) => c.technique))

  const addCard = (card: SRSCard) => {
    pages.push({ slug: toRoleSlug(card.slug, card.type), name: card.technique, type: card.type })
  }

  if (source === "due" || source === "mixed") {
    const due = getDueCards()
    const overdueSorted = [...due].sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    for (const card of overdueSorted) addCard(card)
  }

  if (source === "reviewing") {
    for (const card of getUpcomingCards()) addCard(card)
  }

  if (source === "mastered") {
    for (const card of getMasteredCards()) addCard(card)
  }

  if (source === "explored") {
    // Ad-hoc session over recently visited pages — does NOT auto-add to SRS.
    // The per-card Flashcard component still surfaces its "+ Add to Training"
    // button so the user can opt in.
    const trainableTypes = new Set(["transition", "submission"])
    const explored = loadExplored().filter((e) => trainableTypes.has(e.type))
    for (const e of explored.slice(0, settings.dailyGoal)) {
      pages.push({ slug: toRoleSlug("/" + e.slug, e.type), name: e.name, type: e.type })
    }
  }

  // For `mixed` and `suggested`: fill remaining slots to dailyGoal with
  // graph-derived suggestions. For other deck sources we don't pad.
  if (source === "mixed" || source === "suggested") {
    const progress = loadDailyProgress()
    const totalDone = progress.learned + progress.reviewed
    const cap = source === "suggested" ? settings.dailyGoal : settings.dailyGoal - totalDone
    const remainingSlots = Math.max(0, cap - pages.length)

    if (remainingSlots > 0) {
      const [questionBank, adjacency] = await Promise.all([
        loadQuestionBank(),
        loadGraphAdjacency(),
      ])
      if (questionBank.length > 0 && adjacency) {
        const suggestions = getSuggestedTechniques(
          questionBank,
          existingNames,
          adjacency,
          remainingSlots,
        )
        for (const { entry } of suggestions) {
          pages.push({
            slug: toRoleSlug(entry.slug, entry.type),
            name: entry.name,
            type: entry.type,
          })
        }
      }
    }
  }

  return {
    pages,
    currentIndex: 0,
    completed: 0,
    autoExpand: options.autoExpand ?? true,
    source,
  }
}

/**
 * Resume an existing session if one is in progress, otherwise build a fresh
 * one from the given source and persist it. Navigates the SPA to the current
 * page either way. Used by the strip's ▶ and the DecksModal's CTAs.
 */
export async function startOrResumeSession(
  source: SessionSource = "mixed",
  options: { autoExpand?: boolean; force?: boolean } = {},
) {
  let session = options.force ? null : getSession()
  if (!session || session.pages.length === 0) {
    session = await buildSessionQueue(source, { autoExpand: options.autoExpand ?? true })
    if (session.pages.length === 0) return
    saveSession(session)
  } else if (options.autoExpand !== undefined) {
    session.autoExpand = options.autoExpand
    saveSession(session)
  }

  const page = session.pages[session.currentIndex]
  if (!page) return

  const url = new URL(page.slug, window.location.toString())
  slideNavigate(url, "forward")
}

/**
 * SPA navigate with a carousel slide animation in browsers that support
 * the CSS View Transitions API. Direction sets a data attribute on the
 * root element so CSS can pick the right slide-in/slide-out keyframes.
 * Falls back gracefully to instant nav if the API isn't available.
 */
export function slideNavigate(url: URL, direction: "forward" | "backward" = "forward") {
  const spa = (window as any).spaNavigate as ((url: URL, isBack?: boolean) => void) | undefined

  if (!spa) {
    window.location.href = url.toString()
    return
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => unknown) => unknown
  }

  if (typeof doc.startViewTransition === "function") {
    document.documentElement.dataset.spaTransition = direction
    doc.startViewTransition(() => {
      spa(url, false)
    })
    // Clean up the attribute after the animation duration (matches CSS)
    setTimeout(() => {
      delete document.documentElement.dataset.spaTransition
    }, 600)
  } else {
    spa(url, false)
  }
}

/**
 * SPA navigate with a default cross-fade view transition. Used for graph-node
 * clicks where there's no left/right direction semantics — the browser
 * auto-interpolates position + size + content of any element with a
 * `view-transition-name` (e.g. the .page drawer), and cross-fades the rest.
 * Falls back to plain SPA nav if View Transitions API isn't available.
 */
export function crossfadeNavigate(url: URL) {
  const spa = (window as any).spaNavigate as ((url: URL, isBack?: boolean) => void) | undefined

  if (!spa) {
    window.location.href = url.toString()
    return
  }

  // Warm the HTTP cache in parallel with the view transition setup. Inside
  // the startViewTransition callback, spaNavigate's fetch() will dedupe to
  // the in-flight or cached response (~10ms) rather than blocking the
  // animation while a fresh network request resolves. Callers that already
  // prefetched (e.g. background graph during its Van Wijk pan) will hit the
  // browser's HTTP cache here.
  fetch(url.toString(), { credentials: "same-origin" }).catch(() => {})

  const doc = document as Document & {
    startViewTransition?: (cb: () => unknown) => unknown
  }

  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      spa(url, false)
    })
  } else {
    spa(url, false)
  }
}

export function advanceSession(): boolean {
  const session = getSession()
  if (!session) return false

  session.completed = session.currentIndex + 1
  if (session.currentIndex >= session.pages.length - 1) {
    completeSession()
    return false
  }

  session.currentIndex++
  saveSession(session)

  const showSnackbar = (window as any).showSnackbar as
    | ((opts: { type: string; message: string }) => void)
    | undefined
  if (showSnackbar) {
    showSnackbar({
      type: "info",
      message: `Technique ${session.currentIndex + 1}/${session.pages.length}`,
    })
  }

  const next = session.pages[session.currentIndex]
  slideNavigate(new URL(next.slug, window.location.toString()), "forward")
  return true
}

export function reverseSession(): boolean {
  const session = getSession()
  if (!session) return false
  if (session.currentIndex <= 0) return false

  session.currentIndex--
  saveSession(session)

  const showSnackbar = (window as any).showSnackbar as
    | ((opts: { type: string; message: string }) => void)
    | undefined
  if (showSnackbar) {
    showSnackbar({
      type: "info",
      message: `Technique ${session.currentIndex + 1}/${session.pages.length}`,
    })
  }

  const prev = session.pages[session.currentIndex]
  slideNavigate(new URL(prev.slug, window.location.toString()), "backward")
  return true
}

/**
 * Finish the current session: snackbar + flag for any consumer that wants to
 * render a completion banner on next nav. Does NOT navigate; the caller
 * decides where to go (typically: stay where you are with body class removed).
 */
export function completeSession() {
  const session = getSession()
  const reviewed = session?.completed ?? 0
  clearSession()
  sessionStorage.setItem(SESSION_COMPLETE_KEY, "true")
  document.body.removeAttribute("data-training-active")

  const showSnackbar = (window as any).showSnackbar as
    | ((opts: { type: string; message: string }) => void)
    | undefined
  if (showSnackbar) {
    showSnackbar({
      type: "success",
      message: `Session complete · ${reviewed} reviewed`,
    })
  }
}

/**
 * Stop the current session mid-flight (user clicked ◾). Shows a snackbar
 * with an undo affordance the caller can wire to.
 */
export function stopSession(): SessionQueue | null {
  const session = getSession()
  if (!session) return null
  clearSession()
  document.body.removeAttribute("data-training-active")

  const showSnackbar = (window as any).showSnackbar as
    | ((opts: {
        type: string
        message: string
        action?: { label: string; onClick: () => void }
      }) => void)
    | undefined
  if (showSnackbar) {
    showSnackbar({
      type: "info",
      message: "Session paused",
      action: {
        label: "Undo",
        onClick: () => {
          saveSession(session)
          document.body.setAttribute("data-training-active", "true")
        },
      },
    })
  }

  return session
}
