import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
// The app's own manifest decoder (v1.204.3): format 4 keys each deck by its node's share ordinal,
// so the names come back through the SAME function the browser and the digest Worker run.
import { ngWireDecks } from "../neural/src/wire-keys.src.js"

/**
 * The whole flashcard corpus, assembled from the per-deck chunks.
 *
 * The 16.4MB flashcards.json monolith was deleted in v1.80.4 — it was the app's boot payload and
 * shipping all 2,924 decks before the visitor could move was the biggest single contributor to a
 * real-user LCP P75 of 13.7s. The chunks are now the ONE source of truth, so tests that need the
 * corpus (or that want to hand the app FULL residency because residency is not what they are
 * testing) read it through here.
 *
 * The Python equivalent, used by the exhaustive MC-viability audit, is scripts/_neural_decks.py.
 *
 * Since v1.204.3 the manifest names no deck: it carries each deck's node ORDINAL and card count,
 * and `deckIndex()` decodes it against graph-data.json beside it. A decode that could not resolve
 * every ordinal THROWS here — a corpus with holes in it would quietly shrink every "all decks" test.
 */

const NEURAL = resolve(__dirname, "../source/public/static/neural")
const FC = resolve(NEURAL, "flashcards")

export type Card = { q: string; a: string; [k: string]: unknown }
export type Deck = { cat: string; role: string; cards: Card[]; n?: number }

let cache: Record<string, Deck> | null = null
let manifestCache: any = null

/** The boot manifest, verbatim (format 4: {_meta, deckOrd:{o, n}, shared}). */
export function deckManifest(): any {
  if (!manifestCache) manifestCache = JSON.parse(readFileSync(resolve(FC, "_index.json"), "utf8"))
  return manifestCache
}

let indexCache: Record<string, { cat: string; n: number; file?: string }> | null = null
/** The manifest DECODED: {"<Name>|<Role>": {cat, n}} in name order — what the app ingests. */
export function deckIndex(): Record<string, { cat: string; n: number; file?: string }> {
  if (indexCache) return indexCache
  const nodes = JSON.parse(readFileSync(resolve(NEURAL, "graph-data.json"), "utf8")).nodes
  const dec = ngWireDecks(deckManifest(), nodes)
  if (dec.unresolved || dec.dupes)
    throw new Error(`e2e/decks.ts: manifest decode left ${dec.unresolved} ordinal(s) unresolved, ${dec.dupes} duplicate(s) — graph-data.json and _index.json are from different emits`)
  indexCache = dec.decks
  return indexCache
}

/** Every deck, fully hydrated. Built once per worker (2,924 small reads, ~0.3s). */
export function allDecks(): Record<string, Deck> {
  if (cache) return cache
  const out: Record<string, Deck> = {}
  const blobs: Record<string, any> = {}
  for (const [key, entry] of Object.entries<any>(deckIndex())) {
    const file = chunkName(key, entry)
    if (!blobs[file]) blobs[file] = JSON.parse(readFileSync(resolve(FC, file), "utf8"))
    const blob = blobs[file]
    const deck = blob.cards ? blob : blob[key] || {}
    out[key] = {
      cat: deck.cat,
      role: deck.role ?? key.split("|").pop()!,
      cards: deck.cards ?? [],
      n: entry.n,
    }
  }
  cache = out
  return out
}

/** FNV-1a over UTF-16 code units — the app's qhash(), which is how a chunk is addressed. */
export function fnv1a32(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return ("0000000" + h.toString(16)).slice(-8)
}

/** format 3+ derives the address from the key; older formats carried a filename. */
function chunkName(key: string, entry: any): string {
  return (entry && entry.file) || fnv1a32(key) + ".json"
}

/** One deck's chunk, as the app would fetch it. */
export function deckChunk(key: string): Deck | null {
  const entry = deckIndex()[key]
  if (!entry) return null
  const blob = JSON.parse(readFileSync(resolve(FC, chunkName(key, entry)), "utf8"))
  return blob.cards ? blob : blob[key] || null
}

/** Names of the emitted per-node dossier chunks (content/<fnv1a32(key)>.json). */
export function contentChunkFiles(): string[] {
  try {
    return readdirSync(resolve(NEURAL, "content")).filter((f) => f.endsWith(".json"))
  } catch {
    return []
  }
}
