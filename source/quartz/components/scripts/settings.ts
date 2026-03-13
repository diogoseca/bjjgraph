// BJJ Training Settings — shared utility module
// localStorage-based, no backend required

export interface BJJSettings {
  opponentOnFail: boolean
  dailyLearnGoal: number
  dailyReviewGoal: number
}

export interface DailyProgress {
  date: string // "YYYY-MM-DD"
  learned: number
  reviewed: number
}

const STORAGE_KEY = "bjj-settings"
const PROGRESS_KEY = "bjj-daily-progress"

export const DEFAULT_SETTINGS: BJJSettings = {
  opponentOnFail: true,
  dailyLearnGoal: 3,
  dailyReviewGoal: 10,
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
}

export function incrementLearned() {
  const p = loadDailyProgress()
  p.learned++
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
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    // corrupt data, use defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: BJJSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
