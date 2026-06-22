// Known nodes store — the honor-system "I know this technique" layer.
//
// Distinct from SRS (`bjj-srs-cards`, which is review scheduling and is type-limited
// to transitions/submissions) and from `bjj-explored` (visited, written automatically).
// `bjj-known` is a deliberate user assertion: "I've learned this part of the graph."
// Marked-known nodes light up in the graph and explorer (those readers UNION this set
// with the SRS-derived one).
//
// Slugs are stored as case-preserving node ids ("Positions/Ashi-Garami"). Graph and
// explorer readers normalize as needed (graph lowercases; explorer strips a leading
// slash). Keep that contract stable — the readers parse this key inline.

export interface KnownEntry {
  slug: string // node id, e.g. "Positions/Ashi-Garami" or "Submissions/Heel-Hook"
  name: string // "Ashi Garami"
  type: string // "position" | "transition" | "submission" | "principle"
  markedAt: string // ISO date "2026-06-19"
}

import { safeSetItem } from "./util"
import { localDateKey } from "./dateUtil"

const KNOWN_KEY = "bjj-known"

export function loadKnown(): KnownEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveKnown(entries: KnownEntry[]) {
  safeSetItem(KNOWN_KEY, JSON.stringify(entries))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

export function isKnown(slug: string): boolean {
  return loadKnown().some((e) => e.slug === slug)
}

/** Add a node to the known set. Returns true if newly added. */
export function markKnown(slug: string, name: string, type: string): boolean {
  const entries = loadKnown()
  if (entries.some((e) => e.slug === slug)) return false
  entries.push({ slug, name, type, markedAt: localDateKey() })
  saveKnown(entries)
  return true
}

/** Remove a node from the known set. Returns true if it was present. */
export function unmarkKnown(slug: string): boolean {
  const entries = loadKnown()
  const next = entries.filter((e) => e.slug !== slug)
  if (next.length === entries.length) return false
  saveKnown(next)
  return true
}

/** Toggle a node. Returns the new known state. */
export function toggleKnown(slug: string, name: string, type: string): boolean {
  if (isKnown(slug)) {
    unmarkKnown(slug)
    return false
  }
  markKnown(slug, name, type)
  return true
}

/** Mark many nodes known in a single write (e.g. "mark whole system"). Returns count added. */
export function markManyKnown(items: Array<{ slug: string; name: string; type: string }>): number {
  const entries = loadKnown()
  const have = new Set(entries.map((e) => e.slug))
  const today = localDateKey()
  let added = 0
  for (const it of items) {
    if (!it.slug || have.has(it.slug)) continue
    entries.push({ slug: it.slug, name: it.name, type: it.type, markedAt: today })
    have.add(it.slug)
    added++
  }
  if (added > 0) saveKnown(entries)
  return added
}

export function getKnownSlugSet(): Set<string> {
  return new Set(loadKnown().map((e) => e.slug))
}
