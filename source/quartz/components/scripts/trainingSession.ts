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
import { playGameSound } from "./gameAudio"

// ── Types ─────────────────────────────────────────────────────────────────

export interface QuestionBankEntry {
  name: string
  type: "transition" | "submission" | "position" | "principle" | "system"
  slug: string
  flashcards: Array<{ question: string; answer: string }>
}

export interface PosTech {
  /** bank index of the technique */
  i: number
  /** attemptProbability (0–100) from this position-role */
  ap: number
  role: "top" | "bottom" | "hub"
}

export interface GraphAdjacency {
  version?: number
  /** position hub → techniques attempted from it (both roles folded in) */
  posTechs: Record<string, PosTech[]>
  /** bank[index] → array of position hubs this technique leads to */
  outcomes: string[][]
  /** position hub → importance weight W(hub), Σ≈1 */
  weights: Record<string, number>
  /** bank[index] → successRate/100 (effectiveness) */
  effectiveness: number[]
  /** bank[index] → the position hub this technique primarily starts from */
  startHub: string[]
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
//
// Expected-value gap-filling scorer. Each candidate technique is scored by:
//   commonness   — how often you land where it applies (W·attemptProbability)
//   newground    — how under-covered those positions currently are for you
//   effectiveness — its success rate
//   fitsyourgame — how well it slots into techniques you already know
// graded by mastery (mastered 1.0 · in-SRS 0.5 · explored 0.2 · unknown 0), then
// a greedy submodular pass spreads picks across positions so a session builds a
// *complete* game rather than piling onto one position.

export type SuggestionFactor = "common" | "effective" | "newground" | "fitsyourgame"

export interface SuggestionFactorContribution {
  factor: SuggestionFactor
  /** this factor's normalized share of the card's score, 0..1 */
  share: number
  /** underlying factor value, for hover/expand */
  raw: number
}

export interface SuggestedTechnique {
  entry: QuestionBankEntry
  score: number
  /** hub this pick chiefly fills */
  filledHub: string
  /** factors ordered desc by share */
  factors: SuggestionFactorContribution[]
}

/** technique name → m(t): 1 mastered · 0.5 in-SRS · 0.2 explored-only · 0 unknown */
export interface MasteryLookup {
  get(name: string): number
}

export interface SuggestionContext {
  /** position hubs the user has recently visited (recency boost) */
  exploredHubs?: Set<string>
  /** technique names the user has recently visited (recency boost) */
  exploredNames?: Set<string>
  /** technique names to exclude as candidates (e.g. already queued this session) */
  exclude?: Set<string>
}

const GAP_FLOOR = 0.25 // a well-covered position still scores, just down-weighted
const GAP_DECAY = 0.5 // covering a hub halves its remaining gap (greedy spread)
const LEARN_GAIN = 1.0
const LEARN_SCALE = 2.0
const RECENCY_GAIN = 0.15
const EFF_FLOOR = 0.1 // a 0%/missing-rate technique isn't fully excluded
// In-SRS (0.5) and mastered (1.0) techniques aren't themselves suggested — they
// live in the Due/Reviewing/Mastered decks. Unknown (0) and explored-only (0.2)
// are eligible candidates.
const CANDIDATE_CUTOFF = 0.5

/** Build a graded mastery lookup from SRS + explored state. Memoized per call. */
export function buildMasteryLookup(): MasteryLookup {
  const mastered = new Set(getMasteredCards().map((c) => c.technique))
  const inSrs = new Set(loadSRSCards().map((c) => c.technique))
  const explored = new Set(
    loadExplored()
      .filter((e) => e.type === "transition" || e.type === "submission")
      .map((e) => e.name),
  )
  const cache = new Map<string, number>()
  return {
    get(name: string): number {
      const c = cache.get(name)
      if (c !== undefined) return c
      let v = 0
      if (mastered.has(name)) v = 1
      else if (inSrs.has(name)) v = 0.5
      else if (explored.has(name)) v = 0.2
      cache.set(name, v)
      return v
    },
  }
}

/** Recency context: recently-visited technique names + position hubs. */
export function buildSuggestionContext(): {
  exploredHubs: Set<string>
  exploredNames: Set<string>
} {
  const exploredHubs = new Set<string>()
  const exploredNames = new Set<string>()
  for (const e of loadExplored()) {
    if (e.type === "transition" || e.type === "submission") exploredNames.add(e.name)
    else if (e.type === "position") exploredHubs.add(e.name.toLowerCase().replace(/\s+/g, "-"))
  }
  return { exploredHubs, exploredNames }
}

export function getSuggestedTechniques(
  questionBank: QuestionBankEntry[],
  mastery: MasteryLookup,
  adjacency: GraphAdjacency,
  count: number,
  ctx: SuggestionContext = {},
): SuggestedTechnique[] {
  if (count <= 0) return []
  // Guard against a stale/old-shape cached adjacency (e.g. a tab loaded before
  // the v2 emit): degrade gracefully rather than throw.
  if (!adjacency || !adjacency.posTechs || !adjacency.weights) return []

  const { posTechs, weights, outcomes } = adjacency
  const effectiveness = adjacency.effectiveness || []
  const startHub = adjacency.startHub || []
  const exploredHubs = ctx.exploredHubs ?? new Set<string>()
  const exploredNames = ctx.exploredNames ?? new Set<string>()
  const exclude = ctx.exclude ?? new Set<string>()

  // index → [{hub, ap}] (a technique may be attempted from several hubs).
  // Aggregate per hub (sum ap across roles) so each (technique, hub) appears
  // once — otherwise a technique listed by both roles of one hub would decay
  // that hub's gap twice per pick and double-count its known-mass (CS-3).
  const idxToPosMap: Array<Map<string, number>> = questionBank.map(() => new Map())
  for (const [hub, techs] of Object.entries(posTechs)) {
    for (const t of techs) {
      if (t.i >= 0 && t.i < idxToPosMap.length) {
        const m = idxToPosMap[t.i]
        m.set(hub, (m.get(hub) || 0) + t.ap)
      }
    }
  }
  const idxToPos: Array<Array<{ hub: string; ap: number }>> = idxToPosMap.map((m) =>
    Array.from(m, ([hub, ap]) => ({ hub, ap })),
  )

  // Per-hub: base gap (1 − graded coverage ratio) and mastery-weighted known mass.
  const gapBase: Record<string, number> = {}
  const knownMass: Record<string, number> = {}
  for (const [hub, techs] of Object.entries(posTechs)) {
    let num = 0
    let den = 0
    let known = 0
    for (const t of techs) {
      const m = mastery.get(questionBank[t.i].name)
      const w = t.ap / 100
      den += w
      num += w * m
      known += m
    }
    gapBase[hub] = den > 0 ? 1 - num / den : 1
    knownMass[hub] = known
  }

  // Fixed per-candidate factor values (newground depends on the decaying liveGap
  // and is computed during selection).
  type Cand = {
    i: number
    type: string
    hubs: Array<{ hub: string; ap: number }>
    vCommon: number
    vEffective: number
    effRaw: number
    vFits: number
    recency: number
    startHub: string
  }
  const candidates: Cand[] = []
  for (let i = 0; i < questionBank.length; i++) {
    const entry = questionBank[i]
    if (entry.type !== "transition" && entry.type !== "submission") continue
    if (mastery.get(entry.name) >= CANDIDATE_CUTOFF) continue
    if (exclude.has(entry.name)) continue
    const hubs = idxToPos[i]
    if (hubs.length === 0) continue

    let vCommon = 0
    for (const { hub, ap } of hubs) vCommon += (weights[hub] || 0) * (ap / 100)
    if (vCommon <= 0) continue

    const effRaw = effectiveness[i] ?? 0
    const vEffective = EFF_FLOOR + (1 - EFF_FLOOR) * effRaw

    const mSelf = mastery.get(entry.name)
    let rawLearn = 0
    for (const { hub } of hubs) {
      rawLearn += (weights[hub] || 0) * Math.max(0, (knownMass[hub] || 0) - mSelf)
    }
    for (const outHub of outcomes[i] || []) {
      rawLearn += (weights[outHub] || 0) * (knownMass[outHub] || 0)
    }
    const vFits = 1 + LEARN_GAIN * (1 - Math.exp(-rawLearn / LEARN_SCALE))

    const recency =
      exploredNames.has(entry.name) || hubs.some(({ hub }) => exploredHubs.has(hub))
        ? 1 + RECENCY_GAIN
        : 1

    candidates.push({
      i,
      type: entry.type,
      hubs,
      vCommon,
      vEffective,
      effRaw,
      vFits,
      recency,
      startHub: startHub[i] || (hubs[0] ? hubs[0].hub : ""),
    })
  }
  if (candidates.length === 0) return []

  const newground = (c: Cand, gap: Record<string, number>): number => {
    let gapWeighted = 0
    for (const { hub, ap } of c.hubs) {
      gapWeighted += (weights[hub] || 0) * (ap / 100) * (gap[hub] ?? 1)
    }
    const gapMult = gapWeighted / Math.max(c.vCommon, 1e-9)
    return GAP_FLOOR + (1 - GAP_FLOOR) * gapMult
  }

  // Multi-factor attribution. The score is multiplicative, so a factor's
  // "share" is how far above the pool it sits — but factors have wildly
  // different natural log-spreads (vCommon spans ~400×, vFits only [1,2]), so a
  // raw above-mean-log share lets commonness dominate every card. We instead
  // STANDARDIZE each factor's log by its own pool spread (z-score), making the
  // factors comparable so the top ≤2 genuinely vary card to card (CS-1). This
  // is display-only; selection below uses the raw multiplicative score.
  const LN = (x: number) => Math.log(Math.max(x, 1e-9))
  const lnCommon: number[] = []
  const lnEff: number[] = []
  const lnNew: number[] = []
  const lnFits: number[] = []
  for (const c of candidates) {
    lnCommon.push(LN(c.vCommon))
    lnEff.push(LN(c.vEffective))
    lnNew.push(LN(newground(c, gapBase)))
    lnFits.push(LN(c.vFits))
  }
  const stats = (arr: number[]): { mean: number; std: number } => {
    const len = arr.length
    const mean = arr.reduce((a, b) => a + b, 0) / len
    const variance = arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / len
    const std = Math.sqrt(variance)
    return { mean, std: std > 1e-9 ? std : 1 }
  }
  const st = {
    common: stats(lnCommon),
    effective: stats(lnEff),
    newground: stats(lnNew),
    fitsyourgame: stats(lnFits),
  }

  const attribute = (c: Cand, vNew: number): SuggestionFactorContribution[] => {
    const z = (v: number, s: { mean: number; std: number }) => Math.max(0, (LN(v) - s.mean) / s.std)
    const contribs = {
      common: z(c.vCommon, st.common),
      effective: z(c.vEffective, st.effective),
      newground: z(vNew, st.newground),
      fitsyourgame: z(c.vFits, st.fitsyourgame),
    }
    const total = contribs.common + contribs.effective + contribs.newground + contribs.fitsyourgame
    const raw: Record<SuggestionFactor, number> = {
      common: c.vCommon,
      effective: c.effRaw,
      newground: vNew,
      fitsyourgame: c.vFits,
    }
    return (["common", "effective", "newground", "fitsyourgame"] as SuggestionFactor[])
      .map((f) => ({ factor: f, share: total > 0 ? contribs[f] / total : 0, raw: raw[f] }))
      .sort((a, b) => b.share - a.share)
  }

  // Greedy submodular selection with a soft submission quota. Submissions have
  // a ~3× lower commonness than transitions, so the multiplicative score starves
  // them; a flat penalty can't close that gap. Instead, whenever submissions are
  // under SUB_TARGET of the picks so far, restrict that pick to the best
  // remaining submission — fills the quota with the strongest finishes while
  // leaving the commonness-driven transition ranking intact (CS-2).
  const SUB_TARGET = 0.3
  const liveGap: Record<string, number> = { ...gapBase }
  const remaining = candidates.slice()
  const result: SuggestedTechnique[] = []
  let nTrans = 0
  let nSub = 0

  while (result.length < count && remaining.length > 0) {
    const total = result.length
    const forceSub =
      total > 0 && nSub / total < SUB_TARGET && remaining.some((c) => c.type === "submission")
    let bestPos = -1
    let bestScore = -Infinity
    let bestVNew = 0
    for (let p = 0; p < remaining.length; p++) {
      const c = remaining[p]
      if (forceSub && c.type !== "submission") continue
      const vNew = newground(c, liveGap)
      const score = c.vCommon * vNew * c.vEffective * c.vFits * c.recency
      if (score > bestScore) {
        bestScore = score
        bestPos = p
        bestVNew = vNew
      }
    }
    if (bestPos < 0) break
    const c = remaining[bestPos]
    result.push({
      entry: questionBank[c.i],
      score: bestScore,
      filledHub: c.startHub,
      factors: attribute(c, bestVNew),
    })
    for (const { hub } of c.hubs) liveGap[hub] = (liveGap[hub] ?? 1) * GAP_DECAY
    if (c.type === "submission") nSub++
    else nTrans++
    remaining.splice(bestPos, 1)
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
    // Rating a card Hard/Easy during the session is what enrolls it.
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
        const mastery = buildMasteryLookup()
        const explored = buildSuggestionContext()
        const suggestions = getSuggestedTechniques(
          questionBank,
          mastery,
          adjacency,
          remainingSlots,
          {
            exploredHubs: explored.exploredHubs,
            exploredNames: explored.exploredNames,
            // Don't re-suggest cards already queued this session (due cards in mixed).
            exclude: new Set(pages.map((p) => p.name)),
          },
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

  playGameSound("session-start")
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
  playGameSound("session-complete")

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
