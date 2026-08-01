/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"persistence-reload"} @invariant "Coaching completes once per profile across a Quartz soft navigation: after finishing the coach then soft-navigating to rebuild the app instance, the remounted app's first landing emits no fresh coach_1 (the persisted flag survives the rebuild) even though window.__neural is a new ref." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING COACH — PERSISTS ACROSS A SOFT NAV (the STORAGE flag, not the in-memory guard).
 *
 * A fresh visitor is coached exactly once, finishes the coach (which writes the durable
 * bjj-neural-coached flag), then Quartz soft-navigates to REBUILD the app instance. The remounted
 * life is a genuinely new object whose _coachDone booted FALSE — yet its first landing must NOT
 * re-coach, because maybeStartCoach reads the persisted flag and latches _coachDone without ever
 * firing coach_1. Onboarding is once-per-profile, not once-per-app-instance.
 *
 * Distinct from its two siblings (this is the middle guard of the trio):
 *   - onboard-coach-done-guard-without-storage-read (freshVisitor, ONE session): isolates the
 *     IN-MEMORY guard — wipe the storage flag, _coachDone alone still short-circuits. Same session,
 *     same app instance, so it can NEVER prove the storage flag does anything.
 *   - spa-nav-single-instance-law (freshVisitor): observes no-coach-re-fire only as a side-effect
 *     of asserting its life-3 post-land stream equals [stakes,land,options_dealt,beacon_moved].
 *   This spec pins the CAUSAL CHAIN the other two leave implicit: finishCoach WRITES the flag →
 *   the flag SURVIVES a full app rebuild (new ref, _coachDone==false at boot) → on the fresh life
 *   maybeStartCoach READS it and latches _coachDone WITHOUT firing coach_1. The falsifiability tell:
 *   the remounted life's _coachDone is unset at mount yet true after landing — proving it was the
 *   READ of the persisted flag (not a surviving in-memory bit) that suppressed the coach.
 *
 * Mechanism (source-verified, neural/src/app.src.jsx:4034-4061):
 *   maybeStartCoach() 4035: `if (this._coach || this._coachDone) return;`  — in-memory guard first.
 *                     4036: reads localStorage.getItem("bjj-neural-coached"); if SET →
 *                     `this._coachDone = true; return;` — latches done and BAILS with NO coach_1.
 *                     4041: coach_1 is emitted ONLY past both guards (fresh, unflagged profile).
 *   finishCoach()     4055-4060: _coach=null; _coachDone=true; localStorage.setItem(
 *                     "bjj-neural-coached","1"); fx("coach_done").
 *   The flag lives in "bjj-neural-coached" — a DIFFERENT key from "bjj-neural-progress". A soft nav
 *   never full-loads the page, so the harness storage-wipe init script (dsl.ts, gated on __ng_keep)
 *   never runs → the flag survives into the remounted life whose _coachDone booted unset.
 *
 * Probe-verified recipe (2/2 deterministic, ~3.0s each):
 *   - freshVisitor() → boot wipes storage so bjj-neural-coached is ABSENT → coach eligible.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach MANDATORY; land() otherwise auto-dismisses
 *     the coach. Dismissing it OURSELVES (dismissCoach) is what makes the count-0 assert on the
 *     remounted life non-vacuous: a coach that re-fired would leave a live beat to catch.
 *   - soft nav via page.evaluate(() => window.spaNavigate(new URL("/Positions/Mount", ...))) —
 *     async, evaluate awaits it; "/Positions/Mount" is a real built page (capital P — no lowercase
 *     alias-stub hard-nav trap), soft-navigable under the DSL hermetic route filter.
 *   - remount awaited via __probeId !== 1 + nodes/advance/flashcards.decks ingested @90s.
 *   - beats array FULLY EMPTY right after remount (test mode freezes the loop — safe pre-pump).
 *   - window.__life1 (a window global, survives a SOFT nav, NOT a hard one) doubles as corpse
 *     handle AND hard-nav detector (sameDoc guard).
 *   - SELECTORS: coach_1 beat count (structural), boolean flags, one #neural-root. No copy text —
 *     coach copy is decorative and rewritten per step; MC waves rewrite card text; we assert
 *     STRUCTURE only. All sim time via advance() — the decision clock is frozen while _coach is set.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on

test("onboarding coach completes once per profile: the persisted flag survives a soft-nav rebuild and suppresses coach_1 on the remounted life", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() is undefined by design → boot wipes storage, passes no initialState, so the
  // guided first-roll coach is eligible on landing (its trigger is the absence of bjj-neural-coached).
  await j.boot("/", { initialState: freshVisitor() })

  const coach1Count = async () => (await j.beats()).filter((b) => b.beat === "coach_1").length
  const storedFlag = () => page.evaluate(() => localStorage.getItem("bjj-neural-coached"))

  // ── LIFE 1: fresh landing fires the coach exactly once; the storage flag is not yet written. ──
  await j.land(POSITION, { keepCoach: true }) // keepCoach: the coach must stay UP so we finish it ourselves
  await j.expectBeat("coach_1")
  expect(await coach1Count(), "coach fired exactly once on the fresh landing").toBe(1)
  {
    const f = await page.evaluate(() => {
      const a = (window as any).__neural
      return { coachTruthy: !!a._coach, coachDone: a._coachDone === true }
    })
    expect(f.coachTruthy, "_coach is truthy (coach live) before we finish it").toBe(true)
    expect(f.coachDone, "_coachDone still false while the coach is up").toBe(false)
  }
  expect(await storedFlag(), "bjj-neural-coached not written yet (finishCoach is what persists it)").toBeNull()

  // ── FINISH: dismissCoach → finishCoach sets _coachDone AND writes the durable storage flag.
  // land({keepCoach}) does NOT auto-dismiss, so this explicit call is what makes the later
  // count-0 assert non-vacuous — a re-fired coach would survive to be caught. ──
  await page.evaluate(() => (window as any).__neural.dismissCoach())
  await j.expectBeat("coach_done")
  {
    const f = await page.evaluate(() => {
      const a = (window as any).__neural
      return { coachDone: a._coachDone === true, coachTruthy: !!a._coach }
    })
    expect(f.coachDone, "_coachDone latched true after finish").toBe(true)
    expect(f.coachTruthy, "_coach cleared to falsy after finish").toBe(false)
  }
  expect(await storedFlag(), "finishCoach persisted bjj-neural-coached='1'").toBe("1")

  // ── Non-vacuity + corpse/hard-nav handles, captured BEFORE the nav. window.__life1 is a window
  // global — it survives a SOFT nav (sameDoc) but a hard nav would blow the window away. ──
  const life1Beats = (await j.beats()).length
  expect(life1Beats, "life 1 accumulated beats (premise: the empty-after-nav assert below is non-vacuous)").toBeGreaterThan(0)
  await page.evaluate(() => {
    const w = window as any
    w.__neural.__probeId = 1
    w.__life1 = w.__neural
  })

  // ── SOFT NAV → /Positions/Mount: life 1 destroyed, a fresh app instance mounted. Async;
  // evaluate awaits spaNavigate. Real built route (capital P), no alias-stub hard-nav. ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Positions/Mount", location.origin)))
  await page.waitForFunction(
    () => {
      const a = (window as any).__neural
      return !!(
        a &&
        a.__probeId !== 1 && // the fresh life, not the corpse
        a.nodes &&
        a.nodes.length &&
        typeof a.advance === "function" &&
        a.flashcards &&
        a.flashcards.decks
      )
    },
    undefined,
    { timeout: 90_000 },
  )

  // ── REMOUNT STATE: a genuinely fresh app life — new ref, empty beats, one root, old corpse
  // destroyed — whose _coachDone booted UNSET, yet the persisted flag still reads "1". This is
  // the setup that makes the invariant falsifiable: a new instance that COULD re-coach. ──
  const remount = await page.evaluate(() => {
    const a = (window as any).__neural
    const old = (window as any).__life1
    return {
      sameDoc: !!old, // a hard nav would have wiped this window global (false "coach lost" path)
      sameRef: a === old, // the remount is a distinct instance, not the recycled old one
      beats: (a.beats || []).length,
      roots: document.querySelectorAll("#neural-root").length,
      oldDestroyed: old && old.__ngDestroyed === true,
      freshCoachDone: a._coachDone === true, // the NEW life booted with _coachDone unset
      flag: localStorage.getItem("bjj-neural-coached"),
    }
  })
  expect(remount.sameDoc, "soft nav stayed same-document (window.__life1 present — no hard-nav wipe)").toBe(true)
  expect(remount.sameRef, "window.__neural is a NEW instance, not the recycled old ref").toBe(false)
  expect(remount.beats, "the fresh life's beat stream starts EMPTY (test mode freezes the loop post-remount)").toBe(0)
  expect(remount.roots, "exactly one #neural-root after the soft nav (old overlay removed)").toBe(1)
  expect(remount.oldDestroyed, "the old life ran destroy() (__ngDestroyed set)").toBe(true)
  expect(remount.freshCoachDone, "the remounted life booted with _coachDone UNSET (the in-memory bit did NOT carry over)").toBe(false)
  expect(remount.flag, "the persisted flag survived the rebuild (soft nav never ran the storage wipe)").toBe("1")

  // ── THE INVARIANT: the remounted life lands normally, but coach_1 NEVER fires — maybeStartCoach
  // read the surviving flag and latched _coachDone before the coach_1 line. ──
  await j.land(POSITION, { keepCoach: true }) // keepCoach so a (bug) re-coach isn't dismissed before we count it
  expect(
    (await j.beats()).filter((b) => b.beat === "coach_1").length,
    "ZERO coach_1 on the remounted life — the persisted flag suppressed a fresh coach",
  ).toBe(0)
  {
    const f = await page.evaluate(() => {
      const a = (window as any).__neural
      return { coachTruthy: !!a._coach, coachDone: a._coachDone === true, options: (a.optionIdxs || []).length }
    })
    expect(f.coachTruthy, "_coach stayed falsy on the remounted life — no coach started").toBe(false)
    expect(f.coachDone, "_coachDone latched true FROM THE PERSISTED FLAG (booted unset, set by the storage read)").toBe(true)
    expect(f.options, "a real landing still happened — options dealt, only the coach was suppressed").toBeGreaterThanOrEqual(1)
  }

  expect(errors, "no pageerror across the finish, the soft nav, and the remounted landing").toEqual([])
})
