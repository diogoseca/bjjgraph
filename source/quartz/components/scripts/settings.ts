// BJJ Training Settings — shared utility module
// localStorage-based with optional Supabase cloud sync

export type GameMode = "off" | "normal" | "hard" | "ultra"

export interface BJJSettings {
  gameMode: GameMode
  dailyGoal: number
  showFlashcards: boolean
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

const STORAGE_KEY = "bjj-settings"
const PROGRESS_KEY = "bjj-daily-progress"
const STREAK_KEY = "bjj-streak"

export const DEFAULT_SETTINGS: BJJSettings = {
  gameMode: "off",
  dailyGoal: 30,
  showFlashcards: true,
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyProgress
      if (parsed.date === today()) return parsed
    }
  } catch {
    // corrupt data
  }
  return { date: today(), learned: 0, reviewed: 0 }
}

export function saveDailyProgress(progress: DailyProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
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

export function loadSettings(): BJJSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migrate legacy opponentOnFail → gameMode
      if ("opponentOnFail" in parsed && !("gameMode" in parsed)) {
        parsed.gameMode = parsed.opponentOnFail ? "normal" : "off"
        delete parsed.opponentOnFail
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }))
      }
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    // corrupt data, use defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: BJJSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

export function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (raw) return JSON.parse(raw) as StreakData
  } catch {
    // corrupt data
  }
  return { currentStreak: 0, lastActiveDate: "", longestStreak: 0 }
}

export function updateStreak(): StreakData {
  const streak = loadStreak()
  const t = today()

  if (streak.lastActiveDate === t) return streak // already active today

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (streak.lastActiveDate === yesterdayStr) {
    streak.currentStreak++
  } else {
    streak.currentStreak = 1
  }

  streak.lastActiveDate = t
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak
  }

  localStorage.setItem(STREAK_KEY, JSON.stringify(streak))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
  return streak
}
