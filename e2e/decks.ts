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

/** One node's dossier, as the app would hydrate it, or null when it has none. */
export function dossier(key: string): any {
  try {
    return JSON.parse(readFileSync(resolve(NEURAL, "content", fnv1a32(key) + ".json"), "utf8"))[key] ?? null
  } catch {
    return null
  }
}

/**
 * Every authored defender half of a submission, read from the WIRE, with the video ids its reel
 * shows. Same test as `_landFilmClips`: `authored`, then `clips`. Sorted by route, so a pick from
 * it is deterministic. A spec needing "a page with no clip" must choose from here rather than
 * name one: naming one goes stale the day that page gets its clip (v1.246.0 did exactly that).
 */
export function defenderReels(): { route: string; clips: string[] }[] {
  const graph = JSON.parse(readFileSync(resolve(NEURAL, "graph-data.json"), "utf8"))
  const reels: { route: string; clips: string[] }[] = []
  for (const node of graph.nodes) {
    if (node.ty !== "submissions") continue
    const half = dossier(node.t)?.perspectives?.defender
    if (half?.authored) reels.push({ route: "/" + node.id + "/Defender", clips: (half.clips ?? []).map((c: any) => c.id) })
  }
  return reels.sort((a, b) => a.route.localeCompare(b.route))
}

/**
 * Every position seat whose BUILT article has no Film Study section, as the wire names it ("Reverse Mount Top"), sorted, so
 * a pick from it is deterministic. A spec needing "a node with no Videos section" must choose from here rather than name
 * one: v1.251.5 gave Reverse Mount Top its first film and turned camera-continuity's named premise false. The pages read
 * are the two the reader renders for the seat (the hub `<id>/index.html` as context, `<id>/Top.html` as the guide); the
 * spec still asserts its own premise in the browser.
 */
export function seatsWithoutVideos(): string[] {
  const graph = JSON.parse(readFileSync(resolve(NEURAL, "graph-data.json"), "utf8"))
  const out: string[] = []
  for (const node of graph.nodes) {
    if (node.ty !== "positions" || !/ Top$/.test(node.t)) continue
    // The reader renders the hub page as context AND the Top page as the guide, so both must lack the section.
    let html = ""
    try { html = ["/index.html", "/Top.html"].map((p) => readFileSync(resolve(NEURAL, "../..", node.id + p), "utf8")).join("") } catch { continue }
    if (!/id="film-study"/.test(html)) out.push(node.t)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/** Names of the emitted per-node dossier chunks (content/<fnv1a32(key)>.json). */
export function contentChunkFiles(): string[] {
  try {
    return readdirSync(resolve(NEURAL, "content")).filter((f) => f.endsWith(".json"))
  } catch {
    return []
  }
}
