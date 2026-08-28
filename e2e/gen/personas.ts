import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PERSONAS — first-class seed builders for the L (lifecycle time-point) axis of the
 * test hyperspace. Every generated spec seeds its user via `j.boot("/", { initialState:
 * <persona>() })` so journeys are simulated at authentic points in the user's lifetime.
 *
 * Blob shapes (verified against dsl.ts + core specs):
 *   v2: { v:2, prep:{deckKey:n}, rec:{deckKey:n}, stage:{}, units:{"track/unit":{checkpoint,t}},
 *         belts:{won:{trackId:{moves,dominance,byPoints}}}, tut:{done:{}}, challenges:{},
 *         badges:{}, coins:{}, days:{}, settings:{}, settingsAt:{}, updatedAt:0 }
 *   v1 (legacy): { v:1, prep:{deckKey:n}, days:{}, settings:{} }
 * `prep` fuels move odds (graded cards); `rec` is recall-proven distinct cards (mastery);
 * `units` records checkpoint passes; `belts.won` records compatibility capstone victories.
 */

export const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);

/**
 * The Game Knowledge weight table for one ruleset, expanded from the compact wire (v1.146.0:
 * `scoreWeightsByRuleset = {div, p:{k, gi, nogi}, t:{k, gi, nogi}}`, where every `t` name carries
 * both seats at the same value). Mirrors `scoreWeights(frame)` in app.src.jsx, including the rule
 * that a ZERO means "not attemptable in this ruleset" and is therefore absent, not
 * present-with-no-mass.
 *
 * THE FRAME MATTERS AND DEFAULTS THE WAY THE APP DOES (gi): 52 techniques are attemptable only in
 * gi and 16 only in no-gi, so the two frames do not span the same keys. A spec that reads the
 * wrong frame gets `undefined` for a key that really is weighted, which turns a `toBeGreaterThan`
 * red and -- far worse -- a `toBeUndefined` permanently green. Older shapes are read where found.
 */
export function curriculumWeights(frame: "gi" | "nogi" = "gi"): Record<string, number> {
  const br = CURRICULUM.scoreWeightsByRuleset;
  const sw = br?.t?.[frame] ? br : CURRICULUM.scoreWeights;
  if (!sw?.t) return CURRICULUM.weights ?? {}; // pre-v1.145.13 payload
  const pv = sw.p[frame] ?? sw.p.v, tv = sw.t[frame] ?? sw.t.v;
  if (!pv || !tv) return CURRICULUM.weights ?? {};
  const out: Record<string, number> = {};
  sw.p.k.forEach((k: string, i: number) => { if (pv[i]) out[k] = pv[i] / sw.div; });
  sw.t.k.forEach((k: string, i: number) => {
    if (tv[i]) out[`${k}|Attacker`] = out[`${k}|Defender`] = tv[i] / sw.div;
  });
  return out;
}

type Blob = Record<string, unknown>;
const BELTS: any[] = CURRICULUM.belts;

function emptyV2(): any {
  return {
    v: 2,
    prep: {},
    rec: {},
    stage: {},
    srs: {},
    units: {},
    belts: { won: {} },
    tut: { done: {} },
    challenges: {},
    badges: {},
    coins: {},
    days: {},
    settings: {},
    settingsAt: {},
    updatedAt: 0,
  };
}

/** Brand-new player: no stored progress at all (boot wipes storage; pass NO initialState). */
export function freshVisitor(): undefined {
  return undefined;
}

/** Day-1 dabbler: a couple of cards graded in the first lesson, nothing proven. */
export function firstRollDay1(): Blob {
  const b = emptyV2();
  const first = BELTS[0].units[0].lessons[0];
  b.prep[first.deckKey] = 2;
  return b;
}

/** Week-1 casual: unit-1 lessons drilled to goal, no checkpoints passed yet. */
export function casualWeek1(): Blob {
  const b = emptyV2();
  for (const l of BELTS[0].units[0].lessons) {
    b.prep[l.deckKey] = 3;
    b.rec[l.deckKey] = 3;
  }
  return b;
}

/** Mid-curriculum: unit 1 fully done (checkpoint passed), unit 2 half-drilled. */
export function curriculumMid(): Blob {
  const b = emptyV2();
  const white = BELTS[0];
  const [u1, u2] = white.units;
  b.units[`${white.id}/${u1.id}`] = { checkpoint: true, t: 1 };
  for (const l of u1.lessons) {
    b.prep[l.deckKey] = 3;
    b.rec[l.deckKey] = 3;
  }
  for (const l of u2.lessons.slice(0, Math.ceil(u2.lessons.length / 2)))
    b.prep[l.deckKey] = 3;
  return b;
}

/** Content-capstone READY: every selected track unit has lesson evidence + a checkpoint; no capstone won. */
export function beltReady(belt: any = BELTS[0]): Blob {
  const b = emptyV2();
  for (const u of belt.units) {
    b.units[`${belt.id}/${u.id}`] = { checkpoint: true, t: 1 };
    for (const l of u.lessons) {
      b.prep[l.deckKey] = 3;
      b.rec[l.deckKey] = 3;
    }
  }
  return b;
}

/** White-track capstone holder: beltReady + the compatibility capstone victory recorded. */
export function whiteBeltHolder(): Blob {
  const b: any = beltReady();
  b.belts.won[BELTS[0].id] = { moves: 14, dominance: 4, byPoints: false };
  return b;
}

/** SRS veteran: first `nDecks` lesson decks across the whole curriculum proven (rec>=3). */
export function srsVeteran(nDecks = 25): Blob {
  const b = emptyV2();
  let n = 0;
  outer: for (const belt of BELTS)
    for (const u of belt.units)
      for (const l of u.lessons) {
        b.prep[l.deckKey] = 5;
        b.rec[l.deckKey] = 3;
        if (++n >= nDecks) break outer;
      }
  return b;
}

/**
 * Lapsed returner: a White-capstone holder coming back after a break. The blob carries their
 * full progress; the STALENESS dimension (overdue days/streak semantics) is time-derived by
 * the app and must be pinned by a probe before tests assert on it — treat this persona as
 * "returning capstone-holder" until the days/streak shape is probe-verified.
 */
export function lapsedReturner(): Blob {
  return whiteBeltHolder();
}

/** Content-capstone endgame: every track's units are done and every compatibility capstone is won. */
export function multiBeltEndgame(): Blob {
  const b = emptyV2();
  for (const belt of BELTS) {
    for (const u of belt.units) {
      b.units[`${belt.id}/${u.id}`] = { checkpoint: true, t: 1 };
      for (const l of u.lessons) {
        b.prep[l.deckKey] = 3;
        b.rec[l.deckKey] = 3;
      }
    }
    b.belts.won[belt.id] = { moves: 12, dominance: 5, byPoints: false };
  }
  return b;
}

/** Legacy v1 blob (pre-v2 Challenges/Collection schema): app must migrate/tolerate it. */
export function legacyV1(): Blob {
  const prep: Record<string, number> = {};
  for (const l of BELTS[0].units[0].lessons) prep[l.deckKey] = 3;
  return { v: 1, prep, days: {}, settings: {} };
}

/**
 * Corrupt stored blob — NOT passable through boot({initialState}) (that path JSON-encodes
 * objects). To seed truly malformed storage, add an init script BEFORE boot:
 *   await page.addInitScript(`localStorage.setItem("bjj-neural-progress", ${JSON.stringify(CORRUPT_BLOB_RAW)})`)
 *   await j.boot("/")   // boot's wipe runs first, then this re-seeds — verify order in probe
 * The app must fall back to a fresh profile without crashing.
 */
export const CORRUPT_BLOB_RAW = '{"v":2,"prep":{{{ definitely-not-json';
