// BJJ Training Settings — shared utility module
// localStorage-based with optional Supabase cloud sync

export type GameMode = "off" | "normal" | "hard" | "ultra"
// Front-end variant: "neural" = the Neural Graph experience (default since v1.54.0 — mounted
// client-side on top of the same static HTML, see variant.inline.ts), "legacy" = the classic
// Quartz UI (?variant=legacy escape hatch, kept for comparison). The static/SEO surface is
// identical for both; only the client presentation differs, so this is purely a client-side
// preference.
export type Variant = "legacy" | "neural"

export interface BJJSettings {
  gameMode: GameMode
  dailyGoal: number
  showFlashcards: boolean
  variant: Variant
}

export interface DailyProgress {
  date: string // "YYYY-MM-DD"
  learned: number
  reviewed: number
}

export interface StreakData {
  currentStreak: number
  lastActiveDate: string // "YYYY-MM-DD"
  longestStreak: number
}

import { safeSetItem } from "./util"
import { localDateKey, addDays } from "./dateUtil"

const STORAGE_KEY = "bjj-settings"
const PROGRESS_KEY = "bjj-daily-progress"
const STREAK_KEY = "bjj-streak"

const VALID_GAME_MODES: GameMode[] = ["off", "normal", "hard", "ultra"]
const VALID_VARIANTS: Variant[] = ["legacy", "neural"]

export const DEFAULT_SETTINGS: BJJSettings = {
  gameMode: "off",
  dailyGoal: 30,
  showFlashcards: true,
  variant: "neural",
}

const today = localDateKey

function intGE0(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : fallback
}

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyProgress
      if (parsed && parsed.date === today()) {
        return {
          date: today(),
          learned: intGE0(parsed.learned, 0),
          reviewed: intGE0(parsed.reviewed, 0),
        }
      }
    }
  } catch {
    // corrupt data
  }
  return { date: today(), learned: 0, reviewed: 0 }
}

export function saveDailyProgress(progress: DailyProgress) {
  safeSetItem(PROGRESS_KEY, JSON.stringify(progress))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

export function incrementLearned() {
  const p = loadDailyProgress()
  p.learned++
  p.date = today()
  saveDailyProgress(p)
}

export function decrementLearned() {
  const p = loadDailyProgress()
  if (p.learned > 0) p.learned--
  p.date = today()
  saveDailyProgress(p)
}

export function incrementReviewed() {
  const p = loadDailyProgress()
  p.reviewed++
  p.date = today()
  saveDailyProgress(p)
}

// Clamp/repair a parsed settings object over the defaults so callers always get
// a usable BJJSettings (sane dailyGoal range, valid gameMode enum).
function sanitizeSettings(parsed: Partial<BJJSettings>): BJJSettings {
  const merged = { ...DEFAULT_SETTINGS, ...parsed }
  const goal = Math.round(num(merged.dailyGoal, DEFAULT_SETTINGS.dailyGoal))
  merged.dailyGoal = Math.min(
    1000,
    Math.max(1, Number.isFinite(goal) ? goal : DEFAULT_SETTINGS.dailyGoal),
  )
  if (!VALID_GAME_MODES.includes(merged.gameMode)) {
    merged.gameMode = DEFAULT_SETTINGS.gameMode
  }
  if (!VALID_VARIANTS.includes(merged.variant)) {
    merged.variant = DEFAULT_SETTINGS.variant
  }
  merged.showFlashcards = !!merged.showFlashcards
  return merged
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}

export function loadSettings(): BJJSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migrate legacy opponentOnFail → gameMode
      if ("opponentOnFail" in parsed && !("gameMode" in parsed)) {
        parsed.gameMode = parsed.opponentOnFail ? "normal" : "off"
        delete parsed.opponentOnFail
        safeSetItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(parsed)))
      }
      return sanitizeSettings(parsed)
    }
  } catch {
    // corrupt data, use defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: BJJSettings) {
  safeSetItem(STORAGE_KEY, JSON.stringify(settings))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

export function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StreakData
      if (parsed && typeof parsed === "object") {
        return {
          currentStreak: intGE0(parsed.currentStreak, 0),
          lastActiveDate: typeof parsed.lastActiveDate === "string" ? parsed.lastActiveDate : "",
          longestStreak: intGE0(parsed.longestStreak, 0),
        }
      }
    }
  } catch {
    // corrupt data
  }
  return { currentStreak: 0, lastActiveDate: "", longestStreak: 0 }
}

export function updateStreak(): StreakData {
  const streak = loadStreak()
  const t = today()

  if (streak.lastActiveDate === t) return streak // already active today

  const yesterdayStr = addDays(t, -1)

  if (streak.lastActiveDate === yesterdayStr) {
    streak.currentStreak++
  } else {
    streak.currentStreak = 1
  }

  streak.lastActiveDate = t
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak
  }

  safeSetItem(STREAK_KEY, JSON.stringify(streak))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
  return streak
}
