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

const STORAGE_KEY = "bjj-srs-cards"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

export function loadSRSCards(): SRSCard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Array<
      SRSCard & { questionsMastered?: number[] }
    >
    // Ensure flashcardsMastered exists on every card. Also handles in-memory
    // migration for any legacy card that still has questionsMastered (the
    // persisted migration runs once in flashcard.inline.ts).
    for (const card of raw) {
      if (!card.flashcardsMastered) {
        card.flashcardsMastered = card.questionsMastered ?? []
      }
      if (card.questionsMastered) delete card.questionsMastered
    }
    return raw as SRSCard[]
  } catch {
    return []
  }
}

export function saveSRSCards(cards: SRSCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
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

  if (rating === "easy") {
    card.interval = Math.max(1, card.interval * card.easeFactor)
    card.easeFactor += 0.15
    card.repetitions++
  } else if (rating === "hard") {
    card.interval = Math.max(1, card.interval * 1.2)
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.15)
    card.repetitions++
  } else {
    // again
    card.interval = 1
    card.repetitions = 0
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.2)
  }

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
  return loadSRSCards().filter((c) => c.repetitions >= 5 && c.easeFactor >= 2.5)
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
