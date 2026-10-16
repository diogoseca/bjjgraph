// STALE TIMING — pre-existing since deferred reader.js arrived in v1.225.0.
// The graph/flashcard wait races the reader. Module installation emits only the
// first two beats; true readiness includes the question display, giving five on
// BASE (3/3) and candidate (5/5), without awarding any career credit.
// Evidence: /home/user/bjj-orchestrator/scratch/node-identities/genfix/readiness-finding.json
// Wait for the reader's emitted readiness signal, not elapsed time. Its Mount
// arrival is allowed; career credit and any beat inherited from the old life are not.
/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"spa-nav","B":"idempotence"} @invariant "An unplayed fresh visitor soft-navigates to Mount and waits for true reader readiness: exactly one fresh root and instance, the old instance destroyed, no old-instance beat survives, exactly land(Mount Top, first=true), beacon_moved(options), mc_shown, land_q_shown, land_q_unseen in order, all owned by the fresh instance, and prep, recall and mastery remain zero." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * Navigation before any play keeps the fresh career empty. The reader seats Mount
 * without starting play. The new instance owns exactly five arrival/display beats.
 * An old-life canary is appended only after the empty-boot premise is checked;
 * writing the beat log directly cannot mint gameplay or career credit.
 *
 * The old reference also detects a hard navigation, which would reset the window
 * and storage rather than exercise Quartz's same-document teardown and remount.
 * The reader-ready marker belongs to the fresh instance and names /Positions/Mount.
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

  // A non-vacuous old-life beat must be discarded, including a copied object.
  // This is a log canary, not fx(): the fresh visitor still has never played.
  await page.evaluate(() => {
    const w = window as any
    const old = w.__probeOldRef
    w.__probeOldBeat = { t: old.now || 0, beat: "old_instance_canary", life: 1 }
    ;(old.beats = old.beats || []).push(w.__probeOldBeat)
  })

  // ── Quartz soft nav on the EMPTY profile (spa.inline.ts seam). CANONICAL soft route —
  // /Positions/Mount; see the pitfall note above. Async, evaluate awaits it. ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Positions/Mount", location.origin)))
  // Assert teardown directly, so a skipped destroy fails here rather than merely
  // timing out while waiting for a new instance that the old root can obstruct.
  await expect.poll(
    () => page.evaluate(() => (window as any).__probeOldRef?.__ngDestroyed === true),
    { message: "the old life ran destroy() after navigation", timeout: 5_000 },
  ).toBe(true)
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

  // Graph and flashcard readiness do not include the deferred reader. Wait for
  // its real, rendered signal on this arrival, then read the fresh instance's log.
  await expect(
    page.locator('#neural-root [data-reader][data-reader-ready="true"][data-reader-path="/Positions/Mount"]'),
  ).toBeVisible({ timeout: 90_000 })
  await j.landSettled()

  // ── THE INVARIANT: a fresh app life (new ref, arrival beats, one root, nodes re-ingested) whose
  // career is STILL empty (prep/rec/masteredCount all 0) — navigation on an empty profile rebuilt
  // the app instance but minted nothing. ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const old = (window as any).__probeOldRef
    return {
      sameDoc: !!old, // a lowercase alias-stub HARD nav would have wiped this window global
      sameRef: a === old, // the remount is a distinct instance, not the recycled old one
      roots: document.querySelectorAll("#neural-root").length,
      beats: (a.beats || []).map(({ t, ...beat }: any) => beat),
      sameBeatLog: a.beats === old.beats,
      oldCanaryPresent: (old.beats || []).includes((window as any).__probeOldBeat),
      oldBeatSurvives: (a.beats || []).some((beat: any) => (old.beats || []).includes(beat)),
      readerOwned: a.__ngRoot.contains(a._readerEl) && a._readerEl.dataset.readerReady === "true",
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
  expect(after.readerOwned, "the ready reader belongs to the fresh app instance").toBe(true)
  expect(after.oldCanaryPresent, "old-life canary remains available to detect a copied beat").toBe(true)
  expect(after.sameBeatLog, "the new instance owns a distinct beat log").toBe(false)
  expect(after.oldBeatSurvives, "no beat object from the old instance survives").toBe(false)
  expect(after.beats, "exactly the new reader's ordered arrival beats, with no old-life residue").toEqual([
    { beat: "land", position: "Mount Top", first: true },
    { beat: "beacon_moved", target: "options" },
    { beat: "mc_shown", deckKey: "Mount|Top", qhash: expect.stringMatching(/^[a-f0-9]{8}$/), opts: 3, surface: "land" },
    { beat: "land_q_shown", deckKey: "Mount|Top", mode: "land", unseen: true, cards: 8, backfill: true },
    { beat: "land_q_unseen", deckKey: "Mount|Top", node: "Mount Top", cards: 8, mode: "land", landing: 1 },
  ])
  expect(after.nodesLen, "the fresh life re-ingested its graph nodes").toBeGreaterThan(0)
  expect(after.corpseDestroyed, "the old life ran destroy() (__ngDestroyed set)").toBe(true)

  // empty career MINTED NOTHING — the negative-space assertion this spec exists for
  expect(after.prepKeys, "navigation on an empty profile mints no prep entries").toBe(0)
  expect(after.recKeys, "navigation on an empty profile mints no recall entries").toBe(0)
  expect(after.mastered, "navigation on an empty profile mints no mastery (masteredCount still 0)").toBe(0)

  expect(errors, "no pageerror across the fresh boot, the soft nav, and the remount").toEqual([])
})
