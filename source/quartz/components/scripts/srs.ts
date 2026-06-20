// Spaced Repetition System (SM-2) — shared utility module
// localStorage-based with optional Supabase cloud sync

export interface SRSCard {
  technique: string // e.g. "Armbar from Mount"
  type: "transition" | "submission"
  slug: string // page path
  easeFactor: number // SM-2 (starts at 2.5)
  interval: number // days until next review
  nextReview: string // ISO date "YYYY-MM-DD"
  repetitions: number // consecutive correct reviews
  lastReview: string // ISO date
  history: Array<{ date: string; rating: "again" | "hard" | "easy" }>
  flashcardsMastered: number[] // indices of flashcards answered correctly (Hard/Easy)
}

import { safeSetItem } from "./util"
import { localDateKey, addDays } from "./dateUtil"

const STORAGE_KEY = "bjj-srs-cards"

const today = localDateKey

// SM-2 tuning. Ease is bounded so "easy" streaks cannot run away; intervals use
// fixed graduating steps for the first reps, then grow by ease, with an absolute
// ceiling so a card can never disappear from review for years.
const MIN_EASE = 1.3
const MAX_EASE = 3.0
const HARD_FACTOR = 1.2
const GRADUATING_INTERVAL = 1 // days — first successful review
const SECOND_INTERVAL = 6 // days — second successful review
const MAX_INTERVAL = 365 // days — absolute ceiling

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease))
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)))
}

/** The interval (days) a rating would produce from the card's CURRENT state.
 * Pure — used by both reviewCard and the on-button interval preview so they
 * can never disagree. */
export function nextInterval(card: SRSCard, rating: "again" | "hard" | "easy"): number {
  if (rating === "again") return GRADUATING_INTERVAL
  if (card.repetitions <= 0) return GRADUATING_INTERVAL
  if (card.repetitions === 1) return SECOND_INTERVAL
  const factor = rating === "hard" ? HARD_FACTOR : card.easeFactor
  return clampInterval(card.interval * factor)
}

/** Single source of truth for "mastered" — used by getMasteredCards, the
 * flashcard badge, the move-card badge, and the dice mastery bonus. */
export function isMastered(card: SRSCard): boolean {
  return card.repetitions >= 5 && card.easeFactor >= 2.5
}

// Coerce a value to a finite number, else fall back.
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}

function intGE0(v: unknown, fallback: number): number {
  const n = num(v, fallback)
  return Math.max(0, Math.round(n))
}

export function loadSRSCards(): SRSCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    const out: SRSCard[] = []
    for (const c of parsed as Array<SRSCard & { questionsMastered?: number[] }>) {
      // Drop entries that aren't a usable card (technique must be a string).
      if (!c || typeof c !== "object" || typeof c.technique !== "string") continue

      // Migrate legacy questionsMastered → flashcardsMastered in-memory.
      const mastered = Array.isArray(c.flashcardsMastered)
        ? c.flashcardsMastered
        : (c.questionsMastered ?? [])

      const card: SRSCard = {
        technique: c.technique,
        type: c.type === "submission" ? "submission" : "transition",
        slug: typeof c.slug === "string" ? c.slug : "",
        easeFactor: num(c.easeFactor, 2.5),
        interval: num(c.interval, 1),
        nextReview: typeof c.nextReview === "string" ? c.nextReview : today(),
        repetitions: intGE0(c.repetitions, 0),
        lastReview: typeof c.lastReview === "string" ? c.lastReview : today(),
        history: Array.isArray(c.history) ? c.history : [],
        flashcardsMastered: (Array.isArray(mastered) ? mastered : []).filter(
          (n) => typeof n === "number" && Number.isFinite(n),
        ),
      }
      out.push(card)
    }
    return out
  } catch {
    return []
  }
}

export function saveSRSCards(cards: SRSCard[]) {
  safeSetItem(STORAGE_KEY, JSON.stringify(cards))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

export function findCard(technique: string): SRSCard | undefined {
  return loadSRSCards().find((c) => c.technique === technique)
}

export function addCard(
  technique: string,
  type: "transition" | "submission",
  slug: string,
): SRSCard {
  const cards = loadSRSCards()
  const existing = cards.find((c) => c.technique === technique)
  if (existing) return existing

  const card: SRSCard = {
    technique,
    type,
    slug,
    easeFactor: 2.5,
    interval: 1,
    nextReview: today(),
    repetitions: 0,
    lastReview: today(),
    history: [],
    flashcardsMastered: [],
  }
  cards.push(card)
  saveSRSCards(cards)
  return card
}

export function reviewCard(technique: string, rating: "again" | "hard" | "easy") {
  const cards = loadSRSCards()
  const card = cards.find((c) => c.technique === technique)
  if (!card) return

  const now = today()
  card.lastReview = now
  card.history.push({ date: now, rating })

  // Compute the new interval from the CURRENT state, before mutating repetitions.
  const newInterval = nextInterval(card, rating)

  if (rating === "easy") {
    card.easeFactor = clampEase(card.easeFactor + 0.15)
    card.repetitions++
  } else if (rating === "hard") {
    card.easeFactor = clampEase(card.easeFactor - 0.15)
    card.repetitions++
  } else {
    // again — lapse: reset progress and drop ease
    card.repetitions = 0
    card.easeFactor = clampEase(card.easeFactor - 0.2)
  }

  card.interval = newInterval
  card.nextReview = addDays(now, card.interval)
  saveSRSCards(cards)
}

export function getDueCards(): SRSCard[] {
  const now = today()
  return loadSRSCards().filter((c) => c.nextReview <= now)
}

export function getUpcomingCards(): SRSCard[] {
  const now = today()
  return loadSRSCards()
    .filter((c) => c.nextReview > now)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
}

export function getMasteredCards(): SRSCard[] {
  return loadSRSCards().filter(isMastered)
}

export function masterFlashcard(technique: string, flashcardIndex: number) {
  const cards = loadSRSCards()
  const card = cards.find((c) => c.technique === technique)
  if (!card) return
  if (!card.flashcardsMastered) card.flashcardsMastered = []
  if (!card.flashcardsMastered.includes(flashcardIndex)) {
    card.flashcardsMastered.push(flashcardIndex)
    saveSRSCards(cards)
  }
}

export function removeCard(technique: string) {
  const cards = loadSRSCards().filter((c) => c.technique !== technique)
  saveSRSCards(cards)
}
