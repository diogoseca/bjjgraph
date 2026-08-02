/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"spa-nav","B":"idempotence"} @invariant "A brand-new visitor who soft-navigates before any progress gets exactly one rebuilt app instance with an empty career: after a Quartz soft nav there is exactly one #neural-root, window.__neural is a fresh ref with empty beats, and prep/rec are still empty (navigation on an empty profile mints nothing)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * FRESH BOOT → SOFT NAV MINTS NOTHING. A brand-new visitor boots on "/" with an empty profile
 * and — crucially — never plays: no land, no roll, no coach, no grade. A single Quartz soft
 * navigation must destroy the outgoing app life and mount exactly ONE fresh one whose career is
 * still empty. The whole point is the NEGATIVE space: navigation on an empty profile rebuilds
 * the app instance but mints nothing into prep/rec/masteredCount.
 *
 * Complement to two accepted siblings — do not duplicate their angle:
 *   - spa-nav-single-instance-law (freshVisitor, PLAYED): one-root / fresh-ref / keydown-handler
 *     idempotence across TWO navs, after the visitor lands and the coach fires.
 *   - lapsed-returner-spa-nav-preserves-career (SEEDED): a seeded career SURVIVES a soft nav.
 *   THIS spec: an UNPLAYED fresh visitor's EMPTY career STAYS empty after a nav. One soft nav
 *   suffices; keeping life 1 unplayed makes the empty-career assertion the whole point rather
 *   than incidental.
 *
 * window.__neural IS the app instance directly (neural/build/build.mjs:124
 * `(window).__neural = inst`; destroy nulls it at :121), so prep/rec/beats/nodes/masteredCount()
 * read off it with no accessor indirection:
 *   - prep init app.src.jsx:310 `this.prep = {}`; rec reset in _loadProgress app.src.jsx:1091 —
 *     both start {} for a fresh profile (freshVisitor() → undefined → boot's wipe leaves it empty).
 *   - masteredCount() app.src.jsx:1153 = `Object.keys(this.rec).filter(k => rec[k]>=3).length`;
 *     mastery is RECALL-proven (reads rec, not prep), so an unplayed profile yields 0.
 *
 * SOFT-NAV recipe (probe-verified, 2x byte-identical, ~2.2s, zero pageerrors):
 *   - nav via page.evaluate(() => window.spaNavigate(new URL("/Positions/Mount", location.origin))).
 *     spaNavigate is a window global (spa.inline.ts:119); "/Positions/Mount" is a real built route
 *     under the DSL's hermetic route filter (same safe soft route the single-instance-law sibling
 *     uses). Async — evaluate awaits it.
 *   - remount wait (load-bearing): stash the old ref as window.__probeOldRef + tag it __probeLife=1
 *     BEFORE the nav, then waitForFunction on the FRESH life via `!a.__probeLife` — window.__neural
 *     briefly still points at the corpse during teardown, so the missing-marker predicate is what
 *     distinguishes the new life from the dying one.
 *   - CANONICAL-SLUG GUARD (shared by every spa-nav spec): assert after.sameDoc === true. A window
 *     global survives a SOFT nav; a lowercase-alias redirect stub HARD-navigates → fresh window →
 *     the harness init script wipes storage → a false "career lost". /Positions/Mount is the safe
 *     soft route — never a lowercase-alias redirect target.
 *
 * No rig() draws needed: an unplayed boot + nav hits no RNG site (no roll, no MC, no opponent).
 */

test("onboard fresh boot → soft nav: one rebuilt instance, empty career mints nothing", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() → undefined → boot's storage wipe leaves an empty profile. NO j.land(): the
  // invariant is about a nav BEFORE any play, so life 1 stays unplayed — that is the whole point.
  await j.boot("/", { initialState: freshVisitor() })

  // ── LIFE 1 premise: a genuinely EMPTY, unplayed profile. beats empty, prep/rec empty,
  // masteredCount 0 — the "stays empty after nav" checks below are only meaningful if it starts
  // empty here. nodes ingested (the app IS built), so the fresh-ref/one-root checks are non-vacuous. ──
  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    a.__probeLife = 1 // marker: the remounted life must NOT carry this
    ;(window as any).__probeOldRef = a // corpse handle + hard-nav detector (a window global survives a SOFT nav)
    return {
      roots: document.querySelectorAll("#neural-root").length,
      beats: (a.beats || []).length,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
      mastered: a.masteredCount(),
      nodesLen: (a.nodes || []).length,
    }
  })
  expect(before.roots, "exactly one #neural-root on the fresh boot").toBe(1)
  expect(before.beats, "an unplayed fresh boot has emitted no beats").toBe(0)
  expect(before.prepKeys, "seed sanity: empty profile — prep map empty in life 1").toBe(0)
  expect(before.recKeys, "seed sanity: empty profile — recall map empty in life 1").toBe(0)
  expect(before.mastered, "seed sanity: nothing recall-proven — masteredCount 0 in life 1").toBe(0)
  expect(before.nodesLen, "the app IS built in life 1 (non-vacuity guard for the fresh-ref check)").toBeGreaterThan(0)

  // ── Quartz soft nav on the EMPTY profile (spa.inline.ts seam). CANONICAL soft route —
  // /Positions/Mount; see the pitfall note above. Async, evaluate awaits it. ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Positions/Mount", location.origin)))
  await page.waitForFunction(
    () => {
      const a = (window as any).__neural
      return !!(
        a &&
        !a.__probeLife && // the fresh life, not the corpse (window.__neural briefly still points at the dying one)
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

  // ── THE INVARIANT: a fresh app life (new ref, empty beats, one root, nodes re-ingested) whose
  // career is STILL empty (prep/rec/masteredCount all 0) — navigation on an empty profile rebuilt
  // the app instance but minted nothing. ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const old = (window as any).__probeOldRef
    return {
      sameDoc: !!old, // a lowercase alias-stub HARD nav would have wiped this window global
      sameRef: a === old, // the remount is a distinct instance, not the recycled old one
      roots: document.querySelectorAll("#neural-root").length,
      beats: (a.beats || []).length,
      nodesLen: (a.nodes || []).length,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
      mastered: a.masteredCount(),
      corpseDestroyed: old && old.__ngDestroyed === true,
    }
  })

  // app rebuilt — exactly one fresh life
  expect(after.sameDoc, "soft nav stayed same-document (canonical slug; a lowercase alias stub would hard-navigate)").toBe(true)
  expect(after.sameRef, "the remount is a NEW instance, not the recycled old ref").toBe(false)
  expect(after.roots, "exactly one #neural-root after the soft nav (old overlay removed)").toBe(1)
  expect(after.beats, "the fresh life's beat stream starts EMPTY (app rebuilt, not resumed)").toBe(0)
  expect(after.nodesLen, "the fresh life re-ingested its graph nodes").toBeGreaterThan(0)
  expect(after.corpseDestroyed, "the old life ran destroy() (__ngDestroyed set)").toBe(true)

  // empty career MINTED NOTHING — the negative-space assertion this spec exists for
  expect(after.prepKeys, "navigation on an empty profile mints no prep entries").toBe(0)
  expect(after.recKeys, "navigation on an empty profile mints no recall entries").toBe(0)
  expect(after.mastered, "navigation on an empty profile mints no mastery (masteredCount still 0)").toBe(0)

  expect(errors, "no pageerror across the fresh boot, the soft nav, and the remount").toEqual([])
})
