// Local-date helpers. "Today" and SRS scheduling key off the user's LOCAL calendar
// day (not UTC), so streaks, daily-goal resets, and due-dates roll at local midnight.
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function addDays(dateStr: string, days: number): string {
  // Parse as LOCAL midnight, mutate locally, re-serialize as a local date key.
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + Math.round(days))
  return localDateKey(d)
}
