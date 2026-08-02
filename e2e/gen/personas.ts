import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * PERSONAS — first-class seed builders for the L (lifecycle time-point) axis of the
 * test hyperspace. Every generated spec seeds its user via `j.boot("/", { initialState:
 * <persona>() })` so journeys are simulated at authentic points in the user's lifetime.
 *
 * Blob shapes (verified against dsl.ts + core specs):
 *   v2: { v:2, prep:{deckKey:n}, rec:{deckKey:n}, stage:{}, units:{"belt/unit":{checkpoint,t}},
 *         belts:{won:{beltId:{moves,dominance,byPoints}}}, days:{}, settings:{} }
 *   v1 (legacy): { v:1, prep:{deckKey:n}, days:{}, settings:{} }
 * `prep` fuels move odds (graded cards); `rec` is recall-proven distinct cards (mastery);
 * `units` records checkpoint passes; `belts.won` records belt-test victories.
 */

export const CURRICULUM = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"),
)

type Blob = Record<string, unknown>
const BELTS: any[] = CURRICULUM.belts

function emptyV2(): any {
  return { v: 2, prep: {}, rec: {}, stage: {}, units: {}, belts: { won: {} }, days: {}, settings: {} }
}

/** Brand-new player: no stored progress at all (boot wipes storage; pass NO initialState). */
export function freshVisitor(): undefined {
  return undefined
}

/** Day-1 dabbler: a couple of cards graded in the first lesson, nothing proven. */
export function firstRollDay1(): Blob {
  const b = emptyV2()
  const first = BELTS[0].units[0].lessons[0]
  b.prep[first.deckKey] = 2
  return b
}

/** Week-1 casual: unit-1 lessons drilled to goal, no checkpoints passed yet. */
export function casualWeek1(): Blob {
  const b = emptyV2()
  for (const l of BELTS[0].units[0].lessons) {
    b.prep[l.deckKey] = 3
    b.rec[l.deckKey] = 3
  }
  return b
}

/** Mid-curriculum: unit 1 fully done (checkpoint passed), unit 2 half-drilled. */
export function curriculumMid(): Blob {
  const b = emptyV2()
  const white = BELTS[0]
  const [u1, u2] = white.units
  b.units[`${white.id}/${u1.id}`] = { checkpoint: true, t: 1 }
  for (const l of u1.lessons) {
    b.prep[l.deckKey] = 3
    b.rec[l.deckKey] = 3
  }
  for (const l of u2.lessons.slice(0, Math.ceil(u2.lessons.length / 2))) b.prep[l.deckKey] = 3
  return b
}

/** Belt-test READY: every white unit's lessons drilled + checkpoint passed; no belt won. */
export function beltReady(belt: any = BELTS[0]): Blob {
  const b = emptyV2()
  for (const u of belt.units) {
    b.units[`${belt.id}/${u.id}`] = { checkpoint: true, t: 1 }
    for (const l of u.lessons) {
      b.prep[l.deckKey] = 3
      b.rec[l.deckKey] = 3
    }
  }
  return b
}

/** White-belt holder: beltReady + the white belt actually won (boss battle victory recorded). */
export function whiteBeltHolder(): Blob {
  const b: any = beltReady()
  b.belts.won[BELTS[0].id] = { moves: 14, dominance: 4, byPoints: false }
  return b
}

/** SRS veteran: first `nDecks` lesson decks across the whole curriculum proven (rec>=3). */
export function srsVeteran(nDecks = 25): Blob {
  const b = emptyV2()
  let n = 0
  outer: for (const belt of BELTS)
    for (const u of belt.units)
      for (const l of u.lessons) {
        b.prep[l.deckKey] = 5
        b.rec[l.deckKey] = 3
        if (++n >= nDecks) break outer
      }
  return b
}

/**
 * Lapsed returner: a white-belt holder coming back after a break. The blob carries their
 * full progress; the STALENESS dimension (overdue days/streak semantics) is time-derived by
 * the app and must be pinned by a probe before tests assert on it — treat this persona as
 * "returning belt-holder" until the days/streak shape is probe-verified.
 */
export function lapsedReturner(): Blob {
  return whiteBeltHolder()
}

/** Multi-belt endgame: every belt's units done and won (as far as the curriculum defines). */
export function multiBeltEndgame(): Blob {
  const b = emptyV2()
  for (const belt of BELTS) {
    for (const u of belt.units) {
      b.units[`${belt.id}/${u.id}`] = { checkpoint: true, t: 1 }
      for (const l of u.lessons) {
        b.prep[l.deckKey] = 3
        b.rec[l.deckKey] = 3
      }
    }
    b.belts.won[belt.id] = { moves: 12, dominance: 5, byPoints: false }
  }
  return b
}

/** Legacy v1 blob (pre-v2 schema): app must migrate/tolerate it. */
export function legacyV1(): Blob {
  const prep: Record<string, number> = {}
  for (const l of BELTS[0].units[0].lessons) prep[l.deckKey] = 3
  return { v: 1, prep, days: {}, settings: {} }
}

/**
 * Corrupt stored blob — NOT passable through boot({initialState}) (that path JSON-encodes
 * objects). To seed truly malformed storage, add an init script BEFORE boot:
 *   await page.addInitScript(`localStorage.setItem("bjj-neural-progress", ${JSON.stringify(CORRUPT_BLOB_RAW)})`)
 *   await j.boot("/")   // boot's wipe runs first, then this re-seeds — verify order in probe
 * The app must fall back to a fresh profile without crashing.
 */
export const CORRUPT_BLOB_RAW = '{"v":2,"prep":{{{ definitely-not-json'
