// Explored pages tracking — lightweight awareness layer
// Tracks which content pages the user has visited (separate from SRS training)

export interface ExploredEntry {
  slug: string // "Transitions/Armbar-from-Mount" or "Positions/Mount"
  name: string // "Armbar from Mount" or "Mount"
  type: string // "position" | "transition" | "submission" | "principle" | "system"
  firstVisited: string // ISO date "2026-04-06"
}

const EXPLORED_KEY = "bjj-explored"

export function loadExplored(): ExploredEntry[] {
  try {
    return JSON.parse(localStorage.getItem(EXPLORED_KEY) || "[]")
  } catch {
    return []
  }
}

export function saveExplored(entries: ExploredEntry[]) {
  localStorage.setItem(EXPLORED_KEY, JSON.stringify(entries))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

/** Add a page to explored set. Returns true if newly added. */
export function addExplored(slug: string, name: string, type: string): boolean {
  const entries = loadExplored()
  if (entries.some((e) => e.slug === slug)) return false
  entries.push({
    slug,
    name,
    type,
    firstVisited: new Date().toISOString().slice(0, 10),
  })
  saveExplored(entries)
  return true
}

export function isExplored(slug: string): boolean {
  return loadExplored().some((e) => e.slug === slug)
}

export function getExploredCount(): number {
  return loadExplored().length
}
