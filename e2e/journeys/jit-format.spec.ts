import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type W = Window & { __neural: any }

/**
 * THE FORMAT LADDER REACHES THE JIT DRILL.
 *
 * The in-sheet micro-drill was the last question surface that only ever asked one way: reveal →
 * "Got it", whatever the player already knew. It now follows `askFormat` like the node card —
 * recognition below stage 2, recall at or above it.
 *
 * WHICH LADDER, AND WHY IT IS THE NODE CARD'S. There are two format rules in this app and they
 * are not interchangeable. The landing and defend cards ask against a running clock and use the
 * RANK gate (`_recallInPlayNow`: recall only from blue belt up, v1.133.0, owner). `expandOption`
 * pauses motion and DECLINES the landing question, so the JIT has no clock at all — it is a
 * paused study surface, and it takes the paused surface's rule. A build that wired the rank gate
 * in here would be asking a white belt to recall in a place the owner never put a clock.
 *
 * Rails: __neural.askFormat() · ._mc · ._rig · .cardStage()
 * Surfaces: [data-jit] · [data-jit-mc-opt] · [data-jit-reveal]/[data-jit-got] · [data-jit-next]
 *
 * Mutants, run against the built bundle:
 *   M1 — `askFormat` ignored, the drill is always recall                    → journey 1
 *   M2 — `askFormat` ignored, the drill is always MC                        → journey 2
 *   M3 — the "jit" rng scope is dropped, so the drill draws on the bare
 *        mc-* stream the sidebar journeys rig by name (§6.3)                → journey 3
 *   M4 — a WRONG answer pumps the odds                                      → journey 4
 *   M5 — `done` re-credits prep on top of `_mcAnswer`                       → journey 4
 *   M6 — `_handBackMc("jit")` is dropped from `_setDetailCtx`               → journey 5,
 *        and also by keyboard.spec.ts and option-edge.spec.ts, which own the
 *        real contract: A-D must still answer the landing question after Esc
 *   M7 — the hand-back consults `_landQ.answered` (the dossier's guard) on a
 *        surface that DECLINES on entry, so the keys are nulled every close    → keyboard.spec.ts
 *        + option-edge.spec.ts (journey 5 does NOT catch this one — see below)
 *
 * NON-KILLS, recorded so nobody reads this file as covering them (§6.3):
 *   · the cold-pool fallback and its one-warm-attempt latch (`_jitWarmTried`). The harness boots
 *     a monolith payload, so `mcPoolWarm` is unconditionally true here and the fallback branch
 *     is unreachable under test — it ships on the shared path, checked by hand only.
 *   · `[data-jit-next]`'s advance is asserted to EXIST and to advance; nothing here fails if its
 *     styling or copy changes.
 *   · M7 above: journey 5 only asserts the keys STOPPED pointing at "jit", which nulling also
 *     satisfies. What the app owes is that they point back at the LANDING block, and that claim
 *     lives in keyboard.spec.ts / option-edge.spec.ts. Do not read journey 5 as covering it —
 *     that is exactly the hole M7 fell through when this shipped its first cut.
 */

/** Open a mid-odds option's expand sheet and wait for the drill. Returns the technique name. */
async function openJit(j: ReturnType<typeof journey>, page: Page) {
  const options = await j.optionTitles()
  let target = options[0]
  for (const o of options) {
    const odds = await j.displayedOdds(o)
    if (odds >= 20 && odds <= 70) { target = o; break }
  }
  await page.locator(`[data-tech="${target}"]`).first().click()
  await expect(page.locator("[data-jit]"), "the in-sheet drill mounted").toBeVisible()
  return target
}

const jitKey = (page: Page) =>
  page.evaluate(() => {
    const a = (window as W).__neural
    const n = a.nodes[a._detailCtx.opt.node.idx != null ? a._detailCtx.opt.node.idx : a.currentPos]
    return a.deckKeyFor(n).key
  })

// ── 1. an unproven card is RECOGNITION ────────────────────────────────────────────────────────
test("a card the player has never proven asks MULTIPLE CHOICE @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openJit(j, page)

  // M1: a build that ignored askFormat and kept reveal-first shows no options at all here.
  await expect(page.locator("[data-jit-mc-opt]").first(), "the drill deals options").toBeVisible()
  expect(await page.locator("[data-jit-mc-opt]").count(), "three options since v1.148.0").toBe(3)
  await expect(
    page.locator("[data-jit-reveal]"),
    "and the reveal rung is not also on screen — one format at a time",
  ).toHaveCount(0)

  // the block really is the JIT's, not another surface's leaking into the sheet
  expect(
    await page.evaluate(() => ((window as W).__neural._mc || {}).surface),
    "the live MC truth belongs to the jit surface",
  ).toBe("jit")
})

// ── 2. a card at its MC cap reads back as RECALL ───────────────────────────────────────────────
test("a card already proven at MC reads back as recall — the ladder's top rung", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const target = await openJit(j, page)
  const key = await jitKey(page)

  // put EVERY card in this deck at the MC cap (stage 2), the state `askFormat` reads.
  // Driving `_bumpStage` — the app's own writer — rather than assigning `stage` by hand, so a
  // spec-side idea of what "stage" means cannot drift from the app's (§6.3).
  await page.evaluate((k) => {
    const a = (window as W).__neural
    for (const c of a._cardsOf(a.flashcards.decks[k as string])) a._bumpStage(k as string, c.q, 2, 2)
  }, key)
  expect(
    await page.evaluate((k) => {
      const a = (window as W).__neural
      const c = a._cardsOf(a.flashcards.decks[k as string])[0]
      return a.askFormat(k as string, c)
    }, key),
    "the ladder now says recall for this deck",
  ).toBe("recall")

  // reopen the sheet so the drill re-renders against the new stage
  await page.keyboard.press("Escape")
  await page.locator(`[data-tech="${target}"]`).first().click()
  await expect(page.locator("[data-jit]")).toBeVisible()

  // M2: a build that always asked MC deals options here instead of the reveal rung.
  await expect(page.locator("[data-jit-reveal]"), "the recall rung is back").toBeVisible()
  await expect(page.locator("[data-jit-mc-opt]"), "and it is not also dealing options").toHaveCount(0)
})

// ── 3. the drill draws on its OWN rng tags ─────────────────────────────────────────────────────
test("the JIT never eats the sidebar's rigged mc-* queue", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // Sentinel queues on BOTH streams — the bare one (the sidebar's and the checkpoint's) and the
  // drill's own. `rng(tag)` shifts from `_rig[tag]`, so a queue that got shorter is a queue that
  // was drawn from: this is deductive, not statistical, and it reads BOTH directions. Asserting
  // only "the bare queue is untouched" would also pass on a build that asked no question at all.
  const N = 24
  const fill = (base: number) => Array.from({ length: N }, (_, i) => base + i / 1000)
  await j.rig("mc-pick", fill(0.1))
  await j.rig("mc-shuffle", fill(0.2))
  await j.rig("jit-mc-pick", fill(0.3))
  await j.rig("jit-mc-shuffle", fill(0.4))
  const depth = () =>
    page.evaluate(() => {
      const r = (window as W).__neural._rig || {}
      const len = (k: string) => (r[k] || []).length
      return { bare: len("mc-pick") + len("mc-shuffle"), jit: len("jit-mc-pick") + len("jit-mc-shuffle") }
    })
  expect(await depth(), "both streams start full").toEqual({ bare: 2 * N, jit: 2 * N })

  await openJit(j, page)
  await expect(page.locator("[data-jit-mc-opt]").first()).toBeVisible()

  const after = await depth()
  // M3: without the "jit" scope the drill builds its options off the BARE values, which is the
  // §6.3 hazard — every sidebar journey that rigs `mc-*` by name would silently drift.
  expect(after.bare, "the bare mc-* queues are untouched").toBe(2 * N)
  expect(after.jit, "the drill drew on its own tags instead").toBeLessThan(2 * N)
})

// ── 4. right pumps and advances; wrong pumps nothing and offers the next card ──────────────────
test("a right answer buys odds, a wrong one buys nothing @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openJit(j, page)
  const key = await jitKey(page)

  const state = () =>
    page.evaluate((k) => {
      const a = (window as W).__neural
      return { prep: a.prep[k as string] || 0, idx: a._jitIdx[k as string] || 0 }
    }, key)
  const correctIdx = () => page.evaluate(() => (window as W).__neural._mc.correct)

  // ── WRONG first, while the deck is untouched ──
  const s0 = await state()
  const wrong = ((await correctIdx()) + 1) % 3
  await page.locator("[data-jit-mc-opt]").nth(wrong).click()
  const s1 = await state()
  // M4: a build that pumped on wrong moves prep here (the pump's own credit path runs first).
  expect(s1.prep, "a wrong answer credits nothing").toBe(s0.prep)
  expect(s1.idx, "and does not deal the next card by itself").toBe(s0.idx)
  await expect(page.locator("[data-jit-next]"), "it offers the next card instead").toBeVisible()

  await page.locator("[data-jit-next]").click()
  expect((await state()).idx, "Next advances the drill").toBe(s0.idx + 1)

  // ── RIGHT, on the card Next dealt ──
  await expect(page.locator("[data-jit-mc-opt]").first()).toBeVisible()
  const s2 = await state()
  await page.locator("[data-jit-mc-opt]").nth(await correctIdx()).click()
  const s3 = await state()
  // M5: exactly ONE credit. `_mcAnswer` bumps prep; the drill's own `done` must not bump it
  // again, which is the whole reason `banked()` carries no credit of its own.
  expect(s3.prep, "one right answer is one prep, never two").toBe(s2.prep + 1)
  expect(s3.idx, "and it advances").toBe(s2.idx + 1)
  expect(
    (await j.beats()).filter((b: any) => b.beat === "mc_correct").length,
    "graded through the shared MC choke",
  ).toBeGreaterThan(0)
})

// ── 5. closing the sheet hands the keyboard back ───────────────────────────────────────────────
test("the drill gives the A/B/C keys back when the sheet closes", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openJit(j, page)

  expect(await page.evaluate(() => ((window as W).__neural._mc || {}).surface), "the drill took the keys").toBe("jit")

  await page.keyboard.press("Escape")
  // M6: without the hand-back, `_mc` still points at a block that is no longer on screen, and
  // A/B/C grade a question the player cannot see.
  expect(
    await page.evaluate(() => {
      const m = (window as W).__neural._mc
      return m ? m.surface : null
    }),
    "the sheet gave them up on the way out",
  ).not.toBe("jit")
})
