/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"boot-landing","B":"happy-path"} @invariant "A cold first boot ingests the full graph and deals a live opening hand: >1000 nodes ingested, prep/rec empty, masteredCount()===0, and the first landing emits land + options_dealt with >=3 live option indices — the empty-profile first impression is a playable roll, not a blank canvas." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * FRESH-VISITOR COLD BOOT → LIVE OPENING HAND — the empty-profile first impression.
 *
 * A brand-new visitor with NO stored progress boots the app and takes their first roll.
 * The claim: an empty profile is not a blank canvas — the cold boot ingests the whole graph,
 * carries a pristine (zero-mastery) state, and the first landing deals a genuinely PLAYABLE
 * hand of >=3 live option indices.
 *
 * Recipe (probe-verified 2/2 deterministic, ~1.9s/run, zero pageerror):
 *   - freshVisitor() returns undefined → boot() appends no ngseed hash, so the DSL wipe leaves a
 *     clean profile and localStorage["bjj-neural-progress"] is null pre-land (asserted below as a
 *     seeding-sanity check — this is the NON-error empty path, distinct from the corrupt-blob one).
 *   - land("Mount Top") drives the whole intro via the DSL's built-in rigs (ai-skill/role/max-moves
 *     + rigStart). The journey never picks or drills, so NO extra rig queues are needed.
 *   - optionIdxs are NUMERIC .idx values (app.src.jsx:4285 this.optionIdxs = opts.map(o=>o.idx));
 *     land is emitted at :4237, options_dealt at :4286; masteredCount() at :1153 counts rec>=3.
 *
 * DEDUP (distinct but adjacent — cited per house rails):
 *   - gen-w1-15 (corrupt-blob-fresh-fallback-boot.spec.ts) asserts the SAME boot quadruple
 *     (nodes>1000, prep/rec empty, masteredCount===0) + a live hand, but via the ERROR / corrupt-blob
 *     fallback path and only asserts the hand is `>0` (not `>=3` on live option INDICES).
 *   - golden-path.spec.ts asserts a fresh landing deals `>=3` options + land/options_dealt beats,
 *     but uses persona firstRollDay1 and focuses the drill/pump/pick loop — it never asserts the
 *     pristine boot state (nodes / prep / masteredCount).
 *   Unique claim here: the empty-profile (undefined blob) NON-error first impression is BOTH
 *   pristine AND a >=3-index playable hand.
 *
 * Assertions are STRUCTURAL only — node/index counts, boolean map-emptiness, beat presence.
 * No card, option, or answer TEXT is read (MC waves rewrite copy).
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on

test("cold fresh boot ingests full graph, is pristine, and deals a >=3-index live opening hand", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() === undefined by design: boot wipes storage and passes no initialState, so the
  // undefined path appends NO ngseed hash → nothing is re-seeded post-wipe → a genuinely empty profile.
  await j.boot("/", { initialState: freshVisitor() })

  // ── SEEDING SANITY: this is the empty NON-error path, not the corrupt-blob one. The progress key
  // must be absent pre-land, proving no phantom blob is driving the "pristine" reads that follow. ──
  const preRaw = await page.evaluate(() => localStorage.getItem("bjj-neural-progress"))
  expect(preRaw, "empty-profile path: bjj-neural-progress is null before landing (no seed carried)").toBeNull()

  // ── PRISTINE COLD-BOOT STATE: full ingest, empty maps, zero mastery. ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      nodes: a.nodes.length,
      prepKeys: Object.keys(a.prep || {}),
      recKeys: Object.keys(a.rec || {}),
      mastered: a.masteredCount(),
    }
  })
  expect(boot.nodes, "cold boot ingested the full graph").toBeGreaterThan(1000)
  expect(boot.prepKeys, "prep is a pristine empty map on a fresh profile").toEqual([])
  expect(boot.recKeys, "rec is a pristine empty map on a fresh profile").toEqual([])
  expect(boot.mastered, "masteredCount() === 0 — nothing mastered on a fresh profile").toBe(0)

  // ── FIRST LANDING: the empty profile is PLAYABLE — land + options_dealt both fire. ──
  await j.land(POSITION)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── LIVE OPENING HAND: >=3 numeric option indices dealt, and the visible tray agrees. This is
  // the unique claim vs gen-w1-15 (hand `>0`) — the non-error first impression is a >=3-index roll. ──
  const optionIdxs = await page.evaluate(() => ((window as any).__neural.optionIdxs || []).slice())
  expect(
    optionIdxs.length,
    "the empty-profile first landing dealt >=3 live option indices (a playable hand, not a blank canvas)",
  ).toBeGreaterThanOrEqual(3)
  const titles = await j.optionTitles()
  expect(titles.length, "the visible option tray carries >=3 live cards (hand is rendered, not just internal)").toBeGreaterThanOrEqual(3)

  // crash guard: the whole cold-boot → first-landing arc ran clean.
  expect(errors, "zero pageerror across the cold boot and the first landing").toEqual([])
})
