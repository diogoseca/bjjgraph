/* @hyperspace {"theme":"momentum-and-economy","L":"legacy-corrupt-blob","F":"recall-gate","B":"error-fallback"} @invariant "v1 migration grandfathers deck-level rec but never fabricates card-level proof: on a migrated profile whose rec was minted from prep, questionFor still finds an unproven card (cardStage<2) so the landing asks its question and the momentum economy is reachable for legacy users." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { legacyV1, CURRICULUM } from "./personas"

/**
 * LEGACY v1 USER STILL GETS ASKED — the migration's two-ledger honesty, proven end to end.
 *
 * The seam (app.src.jsx `_loadProgress`, line-verified): a v1 blob has `prep` but no recall
 * history, so migration grandfathers `rec = prep` (deck-LEVEL mastery must not collapse on
 * upgrade) while `stage` — the card-LEVEL proof map — starts empty (v1 never had it, and
 * migration fabricates nothing). `questionFor(key)` gates on the card ledger only
 * (`cardStage(key, c.q) < 2`), so a migrated deck that LOOKS recall-proven at deck level
 * still owes every one of its landing questions — which is exactly how a legacy user first
 * reaches the v1.70.0 momentum economy (`land_q_answered` → `_comboUp` → streak ×1).
 *
 * Persona seam: legacyV1() seeds white unit-1 lesson deckKeys (Mount|Bottom + four Attacker
 * decks) — but positions canonicalize to ONE "<X> Top" node (zero "* Bottom" titles), so a
 * Mount landing keys deck "Mount|Top" because land() rigs the role draw to top and the deck role
 * follows the side actually in play (playedRole, app.src.jsx ~842). Until v1.82.4 it followed the
 * node TITLE instead, which is "… Top" for all 136 collapsed hubs — so it was "Top" either way.
 * Non-vacuous seed: add prep["Mount|Top"] = 3 — the shape of a real v1 user who also drilled
 * Mount top — so the LIVE landing deck is itself a migrated, rec-minted deck. v1 carries no
 * rec and no stage; both facts are asserted, not assumed.
 *
 * Determinism census: land()'s built-ins cover ai-skill/role/max-moves. land-mc-pick /
 * land-mc-shuffle are deliberately left UNRIGGED (house rail, same as
 * e2e/journeys/landing-card.spec.ts): the MC truth is READ at runtime from the __neural._mc
 * closure ({correct, surface:"land"}) and answered by keyboard ("abcd"[correct]) — every
 * assertion stays structural (stages, deckKeys, beat counts, combo), never card/answer text.
 * No commit happens — zero resolve/outcome draws exist. Keypress handling is synchronous;
 * no advance() needed beyond land()'s built-in pump.
 *
 * Red-proof seam (probe-verified, 3x green; probe deleted): bumping every Mount|Top card to
 * stage 2 via _bumpStage BEFORE landing flips questionFor to null and removes [data-land-q]
 * — the probe failed at exactly the invariant assertion, so a migration that ever fabricated
 * card-level proof (stage from prep) would fail here the same way.
 *
 * Ledger cross-ref: composite guard vs core-008 (belt-path.spec.ts:162 asserts only the
 * migration facts rec/v) — this spec adds the card-level recall-gate + momentum clauses.
 */

// L0 = the persona's genuine first lesson deck ("Mount|Bottom") — from curriculum, never hardcoded
const L0: string = CURRICULUM.belts[0].units[0].lessons[0].deckKey

test("migrated v1 rec looks proven at deck level, yet the landing still asks and the combo ladder opens", async ({
  page,
}) => {
  const j = journey(page)
  const seed: any = legacyV1()
  seed.prep["Mount|Top"] = 3 // persona-derived: a real v1 user who drilled Mount top
  await j.boot("/", { initialState: seed })

  // ── SETUP: the migration's exact shape — rec minted from prep, stage fabricated NEVER ──
  const mig = await page.evaluate((l0) => {
    const a = (window as any).__neural
    const q = a.questionFor(l0 as string)
    return {
      v: a._progressBlob().v,
      recL0: (a.rec && a.rec[l0 as string]) ?? null,
      recMountTop: (a.rec && a.rec["Mount|Top"]) ?? null,
      stageKeys: Object.keys(a.stage || {}).length,
      hasQ: !!q,
      qStage: q ? a.cardStage(l0 as string, q.q) : null,
    }
  }, L0)
  expect(mig.v, "the blob writes back as v2 — migration ran").toBe(2)
  expect(mig.recL0, "deck-level rec grandfathered = prep on the persona's genuine deck").toBe(3)
  expect(mig.recMountTop, "and on the seeded landing deck").toBe(3)
  expect(mig.stageKeys, "v1 carries no stage — migration fabricates no card-level proof").toBe(0)
  expect(mig.hasQ, "so questionFor still owes L0 a card").toBe(true)
  expect(mig.qStage!, "and that card is genuinely unproven (cardStage < 2)").toBeLessThan(2)

  // ── LIVE: land on Mount — the rec-minted deck itself — and the game still asks ──
  await j.land("Mount Top")
  const live = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const q = a.questionFor(key)
    return {
      key,
      rec: (a.rec && a.rec[key]) ?? null,
      hasQ: !!q,
      qStage: q ? a.cardStage(key, q.q) : null,
      combo: a._combo || 0,
    }
  })
  expect(live.key, "the side in play is top, so the landing keys Mount|Top").toBe("Mount|Top")
  expect(live.rec, "deck level says recall-proven (the grandfathered mint)").toBe(3)
  expect(live.hasQ, "card level disagrees — an unproven card is still owed").toBe(true)
  expect(live.qStage!, "cardStage < 2 gates the ask").toBeLessThan(2)
  expect(live.combo, "the streak is cold before the answer").toBe(0)
  await expect(page.locator("[data-land-q]"), "so the landing asks its question").toBeVisible()
  await j.expectBeat("land_q_shown")

  // ── answer RIGHT via the house truth rail — the momentum economy is reachable ──
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" && typeof m.correct === "number" ? m.correct : -1
  })
  expect(mc, "live land-surface MC block with a known correct index").toBeGreaterThanOrEqual(0)
  await page.keyboard.press("abcd"[mc])

  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      combo: a._combo || 0,
      answered: (a.beats || []).filter((b: any) => b.beat === "land_q_answered"),
    }
  })
  expect(post.answered.length, "exactly one land_q_answered in the whole journey").toBe(1)
  expect((post.answered[0] as any).correct, "and it was correct").toBe(true)
  expect((post.answered[0] as any).combo, "the momentum ladder opened — streak ×1").toBe(1)
  expect(post.combo, "live combo agrees with the beat").toBe(1)
})
