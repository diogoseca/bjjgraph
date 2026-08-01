/* @hyperspace {"theme":"spa-nav-inflight-progress-survives","L":"whiteBeltHolder","F":"persistence","B":"soft-nav"}
   @invariant "A card graded moments before a Quartz soft navigation is not lost to the prod debounced save: teardown flushes the pending write, so the remounted instance's prep map carries the grade and the seeded belt win stays intact." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "../gen/personas"

// RED — Q001 (e2e/quarantine/ISSUES.md). The SPA teardown chain (addCleanup ->
// __neural.destroy() -> componentWillUnmount, neural/build/build.mjs:116-122 +
// app.src.jsx:74-86) neither calls _flushSave() nor clears _saveT. In prod, a card graded
// within 400ms of a soft nav is therefore only in memory + a pending debounce timer when
// the remount's _loadProgress reads storage: life 2 boots STALE, the orphaned timer's late
// write lands after that read, and life 2's first save clobbers it back. The grade is
// permanently lost. SPA navs never fire pagehide, so the boot-time flush listeners
// (app.src.jsx:341-344) do not cover this path.
//
// The harness pins __NEURAL_TEST__, which makes _saveProgress synchronous
// (app.src.jsx:1116) and hides the bug — so this spec forces the PROD branch by
// overriding _saveProgress with a faithful copy of the source (lines 1110-1117) minus
// that one shortcut line. The natural fix — `this._flushSave()` in componentWillUnmount
// (it also clears _saveT) — turns this spec green with the override still in place,
// because the flush writes synchronously BEFORE the body morph and remount.
test("card graded right before a soft nav survives into the remounted instance (prod save branch)", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  const beltId: string = CURRICULUM.belts[0].id

  const life1 = await page.evaluate((bid) => {
    const a = (window as any).__neural
    a.__probeLife = 1 // marker: the remounted instance will not carry this
    // force the PROD save branch — faithful copy of _saveProgress minus the isTest() line
    a._saveProgress = function () {
      clearTimeout(this._saveT)
      const write = () => {
        try {
          localStorage.setItem("bjj-neural-progress", JSON.stringify(this._progressBlob()))
        } catch (e) {}
        if (this._pushCloud) this._pushCloud()
      }
      this._saveT = setTimeout(write, 400)
    }
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    return { key, prep0: a.prep[key] || 0, beltWon: !!(a.belts?.won || {})[bid] }
  }, beltId)
  expect(life1.beltWon, "seed sanity: whiteBeltHolder carries the belt win in life 1").toBe(true)

  // grade ONE card through the UI choke — no manual flush; the debounced write stays pending
  await j.drill(1)

  // immediately soft-navigate (spa.inline.ts seam) — cleanups destroy the app, body morphs,
  // "nav" remounts a fresh instance which re-reads localStorage
  await page.evaluate(() => {
    ;(window as any).spaNavigate(new URL("/Positions/Mount", location.origin))
  })
  await page.waitForFunction(
    () => {
      const a = (window as any).__neural
      return !!(a && !a.__probeLife && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks)
    },
    undefined,
    { timeout: 90_000 },
  )

  // THE INVARIANT (red today): the remounted prep map must carry the life-1 grade.
  // No timer waits needed — with the teardown flush in place the write is already in
  // storage when _loadProgress runs; without it, life 2 deterministically reads prep0.
  const life2 = await page.evaluate(
    ([k, bid]) => {
      const a = (window as any).__neural
      return { prep: a.prep[k] || 0, beltWon: !!(a.belts?.won || {})[bid] }
    },
    [life1.key, beltId] as [string, string],
  )
  expect(life2.prep, "graded card survives teardown into the remounted prep map").toBe(life1.prep0 + 1)
  expect(life2.beltWon, "seeded belt win intact after the remount").toBe(true)
})
