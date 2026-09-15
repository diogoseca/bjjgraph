import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

// The harness omits dossiers, so these tests explicitly mount film. Geometry is sampled
// through actual layout/animation frames, including repeated docking (the original bounce).
// Touch dispatch in landcard-modes covers direction/click suppression; this file uses a
// real mouse wheel for momentum and real keyboard/mouse input for browsing and grading.
// Red-checked: restoring alternating docking, natural card height, a frozen counter, four
// permanent backs, unconsumed wheel momentum, completion on browsing, or lost cached recall
// controls each makes its corresponding test fail.
async function setup(page: Page, recall = false) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const total = await page.evaluate((recall) => {
    const a = (window as any).__neural
    const key = a._landQ.key, cards = a._landDeckCards(key)
    if (recall) {
      // A due, proven deck is the production recall entry. Lengthen one answer to exercise
      // the card's scrollport rather than relying on the corpus to happen to overflow.
      cards[1].a = "Keep your balance and maintain the frame. ".repeat(35)
      for (const c of cards) a._bumpStage(key, c.q, 2, 2)
      a._cardDue = () => true
      a.gameScore = () => ({ score: .45, belt: "blue", next: null, stripes: 0 })
      a._landQ = null
      a.renderLandCard(a.nodes[a.currentPos], "land", null)
    }
    a._renderLandFilm([{ id: "aQ2vFXXBn-o", title: "Test film", who: "Coach" }])
    a._dockLandCard(a._landEl)
    return cards.length
  }, recall)
  expect(total).toBeGreaterThan(5)
  await page.waitForTimeout(350) // initial entry motion, not the transition under test
  return { j, total }
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector("[data-landcard]")!.getBoundingClientRect()
    const film = document.querySelector(".ng-landfilm")!.getBoundingClientRect()
    return { top: card.top, bottom: card.bottom, height: card.height, filmTop: film.top }
  })
}

// Keep the intended gesture cadence independent of CI/browser scheduling delays. Input
// still travels through the real mouse wheel; only Date.now's gesture clock is controlled.
function gestureWheel(page: Page) {
  let time = Date.now()
  return async (delta: number, gap = 40) => {
    time += gap
    await page.clock.setFixedTime(time)
    await page.evaluate(() => {
      (window as any).__deckWheelDelivered = false
      document.addEventListener("wheel", () => { (window as any).__deckWheelDelivered = true }, { once: true })
    })
    await page.mouse.wheel(delta, 0)
    await page.waitForFunction(() => (window as any).__deckWheelDelivered)
  }
}

for (const width of [1440, 390]) {
  for (const recall of [false, true]) {
    test(`@curated ${width}px ${recall ? "recall" : "MC"}: deck pages without moving card or film`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      const { j, total } = await setup(page, recall)
      const base = await geometry(page)
      await expect(page.locator("[data-land-count]")).toHaveText(`1/${total}`)
      await expect(page.locator("[data-land-back]")).toHaveCount(4)
      // Walk the entire deck, including 4 -> 3 -> 2 -> 1 -> 0 backs. No answering:
      // reaching the last card must not award completion or mastery.
      for (let index = 1; index < total; index++) {
        await page.keyboard.press("ArrowRight")
        await page.waitForFunction((index) => (window as any).__neural._landPage === index, index)
        await expect(page.locator("[data-land-count]")).toHaveText(`${index + 1}/${total}`)
        await expect(page.locator("[data-land-back]")).toHaveCount(Math.min(4, total - index - 1))
        if (recall && index === 1) await j.clickByMouse("[data-land-reveal]")
        const samples = await page.evaluate(async () => {
          const a = (window as any).__neural, samples = []
          for (let frame = 0; frame < 14; frame++) {
            a._dockLandCard(a._landEl)
            await new Promise(requestAnimationFrame)
            const c = a._landEl.getBoundingClientRect(), f = a._landFilmEl.getBoundingClientRect()
            samples.push({ top: c.top, bottom: c.bottom, height: c.height, filmTop: f.top })
          }
          return samples
        })
        for (const sample of samples) {
          for (const key of ["top", "bottom", "height", "filmTop"] as const) {
            expect(Math.abs(sample[key] - base[key]), `${key} at card ${index + 1}`).toBeLessThanOrEqual(1)
          }
        }
      }
      expect((await j.beats()).filter(b => b.beat === "land_deck_completed")).toHaveLength(0)
      // Backwards navigation restores the real cached card and its stack.
      await page.keyboard.press("ArrowLeft")
      await expect(page.locator("[data-land-back]")).toHaveCount(1)
      await j.clickByMouse("[data-land-close]")
      await expect(page.locator(".ng-landstack")).toHaveCount(0)
    })
  }
}

test("@curated wheel momentum advances once; a fresh gesture advances again", async ({ page }) => {
  await setup(page)
  const wheel = gestureWheel(page)
  const card = await page.locator("[data-landcard]").boundingBox()
  await page.mouse.move(card!.x + card!.width / 2, card!.y + 35)
  // A single gesture with a >350ms inertial tail used to advance twice.
  for (const delta of [90, 64, 42, 25, 12, 5, 2]) {
    await wheel(delta, 90)
  }
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(1)
  await wheel(80, 350)
  await expect(page.locator("[data-land-position]")).toHaveAttribute("data-land-position", /^3\//)
})

test("@curated answering the entire deck celebrates once, without paying extra roll rewards", async ({ page }) => {
  const { j, total } = await setup(page)
  for (let index = 0; index < total; index++) {
    const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
    await j.clickByMouse(`[data-land-mc-opt="${correct}"]`)
    if (index < total - 1) {
      await page.keyboard.press("ArrowRight")
      await page.waitForFunction((index) => (window as any).__neural._landPage === index, index + 1)
      await page.waitForTimeout(200)
    }
  }
  await expect(page.locator("[data-land-count]")).toHaveAttribute("aria-label", new RegExp(`${total} answered this visit`))
  const beats = await j.beats()
  expect(beats.filter(b => b.beat === "land_deck_completed")).toHaveLength(1)
  expect(beats.filter(b => b.beat === "land_q_answered")).toHaveLength(1)
  expect(await page.evaluate(() => (window as any).__neural.evKickerRef.current.textContent)).toContain("Deck complete")
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("ArrowRight")
  expect((await j.beats()).filter(b => b.beat === "land_deck_completed")).toHaveLength(1)
})


test("recall keeps its keyboard controls when revisited, including with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await setup(page, true)
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("Space")
  await expect(page.locator("[data-land-answer]")).toBeVisible()
  await page.keyboard.press("Space")
  await expect(page.locator("[data-land-answer]")).toBeHidden()
  expect(await page.evaluate(() => document.querySelector("[data-land-q]")!.getAnimations().length)).toBe(0)
})

test("@curated responsive deck fits short phones, tablets, and landscape, then rotates back", async ({ page }) => {
  const { j } = await setup(page)
  // Resize the SAME mounted deck: rotation must release the landscape column and keep the
  // selected card, rather than accidentally passing by rebuilding a fresh screen each time.
  await page.keyboard.press("ArrowRight")
  for (const viewport of [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 1440, height: 900 },
    { width: 844, height: 390 }, { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(150)
    await j.advance(100)
    const layout = await page.evaluate(() => {
      const a = (window as any).__neural
      const card = a._landEl.getBoundingClientRect(), film = a._landFilmEl.getBoundingClientRect()
      const hand = a.optionsRef.current.getBoundingClientRect()
      const stack = a._landStackEl.getBoundingClientRect()
      return {
        card: card.toJSON(), film: film.toJSON(), hand: hand.toJSON(), stack: stack.toJSON(),
        page: a._landPage,
        targets: [...a._landEl.querySelectorAll("[data-land-mc-opt]")].map((b: any) => b.getBoundingClientRect().height),
        overflow: a._landEl.scrollWidth - a._landEl.clientWidth,
      }
    })
    for (const rect of [layout.card, layout.film, layout.stack]) {
      expect(rect.top, `${viewport.width}px top`).toBeGreaterThanOrEqual(15)
      expect(rect.left).toBeGreaterThanOrEqual(0)
      expect(rect.right).toBeLessThanOrEqual(viewport.width)
      expect(rect.bottom).toBeLessThanOrEqual(viewport.height)
    }
    expect(layout.stack.left).toBeCloseTo(layout.card.left, 0)
    expect(layout.stack.height).toBeCloseTo(layout.card.height, 0)
    expect(layout.targets).toHaveLength(3)
    for (const height of layout.targets) expect(height).toBeGreaterThanOrEqual(44)
    expect(layout.overflow).toBeLessThanOrEqual(1)
    expect(layout.page).toBe(1)
    if (viewport.width === 844) {
      expect(layout.card.right + 12).toBeLessThanOrEqual(layout.hand.left)
      expect(layout.card.right + 12).toBeLessThanOrEqual(layout.film.left)
      expect(layout.film.bottom + 7).toBeLessThanOrEqual(layout.hand.top)
    } else {
      expect(layout.film.bottom + 7).toBeLessThanOrEqual(layout.card.top)
      expect(layout.card.bottom + 12).toBeLessThanOrEqual(layout.hand.top)
    }
  }
})

test("long mobile answers wrap and stay reachable by vertical scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await setup(page)
  await page.evaluate(() => {
    const answer = document.querySelector("[data-land-mc-opt='2']")!
    answer.append(" Keep your weight balanced over both knees while maintaining control of the hips.")
  })
  const card = page.locator("[data-landcard]")
  const before = await geometry(page)
  const box = await card.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 25)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => card.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(0)
  const last = page.locator("[data-land-mc-opt='2']")
  const answer = await last.boundingBox()
  expect(answer!.height).toBeGreaterThan(44)
  const nav = await page.locator("[data-land-nav]").boundingBox()
  expect(answer!.y + answer!.height).toBeLessThanOrEqual(nav!.y + 1)
  expect(await geometry(page)).toEqual(before)
})


for (const target of ["[data-land-q]>div:first-child", "[data-land-mc-opt='0']"]) {
  test(`@curated three quick horizontal scrolls work without moving the cursor over ${target}`, async ({ page }) => {
    const { j, total } = await setup(page)
    const wheel = gestureWheel(page)
    const box = await page.locator(target).boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    const before = await geometry(page)
    for (let gesture = 1; gesture <= 3; gesture++) {
      // Three deliberate impulses, each followed by its fading tail. No mousemove and
      // no 300ms idle between gestures: the next flick starts while the old tail was recent.
      for (const delta of [90, 45, 18, 4]) {
        await wheel(delta, gesture > 1 && delta === 90 ? 100 : 40)
      }
      await expect(page.locator("[data-land-position]")).toHaveAttribute("data-land-position", `${gesture + 1}/${total}`)
    }
    // Reversing direction should work immediately too, with the same stationary pointer.
    await wheel(-90)
    await expect(page.locator("[data-land-position]")).toHaveAttribute("data-land-position", `3/${total}`)
    expect(await geometry(page)).toEqual(before)
    expect((await j.beats()).filter(b => b.beat === "land_q_answered")).toHaveLength(0)
  })
}

test("sustained horizontal scrolling keeps advancing with a stationary cursor", async ({ page }) => {
  await setup(page)
  const wheel = gestureWheel(page)
  const box = await page.locator("[data-land-mc-opt='0']").boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  for (let i = 0; i < 7; i++) {
    await wheel(70, 90)
  }
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBeGreaterThanOrEqual(3)
})

for (const recall of [false, true]) {
  test(`@curated paging resets the ${recall ? "recall" : "MC"} countdown and clears the old warning`, async ({ page }) => {
    const { j } = await setup(page, recall)
    if (recall) await page.evaluate(() => {
      const a = (window as any).__neural
      a._landDeckCards(a._landQ.key)[1].a = "Frame and balance"
    })
    await j.engage()
    // Reproduce the report: leave the old card in its final second with its warning visible.
    await page.evaluate(() => { (window as any).__neural._decision.remaining = 1000 })
    await j.advance(200)
    await expect(page.locator("[data-landcard]")).toHaveClass(/ng-clock-hot/)
    await page.keyboard.press("ArrowRight")
    await page.waitForFunction(() => (window as any).__neural._landPage === 1)
    const fresh = await page.evaluate(() => {
      const a = (window as any).__neural
      return { remaining: a._decision.remaining, total: a._decision.total,
        bar: a._landClockEl.style.transform, warning: a._evCountdown }
    })
    expect(fresh.total).toBeGreaterThan(3000)
    expect(fresh.remaining).toBe(fresh.total)
    expect(fresh.bar).toBe("scaleX(1)")
    expect(fresh.warning).toBeNull()
    await expect(page.locator("[data-landcard]")).not.toHaveClass(/ng-clock-hot/)
    await j.advance(1200)
    expect((await j.beats()).filter(b => b.beat === "land_q_expired")).toHaveLength(0)
    expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBeLessThan(fresh.total)

    // An unanswered cached card also gets a fresh window; an edge gesture is not a new card.
    await page.keyboard.press("ArrowLeft")
    expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBe(fresh.total)
    await j.advance(500)
    const beforeEdge = await page.evaluate(() => (window as any).__neural._decision.remaining)
    await page.keyboard.press("ArrowLeft")
    expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBe(beforeEdge)

    const answer = async () => {
      if (recall) {
        await j.clickByMouse("[data-land-reveal]")
        await j.clickByMouse("[data-land-got]")
      } else {
        const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
        await j.clickByMouse(`[data-land-mc-opt='${correct}']`)
      }
    }
    // Answer the first question and a later study question. BOTH stop their own clocks.
    await answer()
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(200)
    await answer()
    expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBeNull()
    await page.keyboard.press("ArrowLeft")
    expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBeNull()
    expect((await j.beats()).filter(b => b.beat === "land_q_answered")).toHaveLength(1)
  })
}

test("@curated loading the next card pauses expiry, then starts its full countdown", async ({ page }) => {
  const { j } = await setup(page)
  await j.engage()
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._decision.remaining = 500
    const originalWarm = a._warmMcPool, originalReady = a.mcPoolWarm
    a.mcPoolWarm = () => false
    a._warmMcPool = () => new Promise<void>(resolve => {
      ;(window as any).releasePage = () => {
        a.mcPoolWarm = originalReady; a._warmMcPool = originalWarm; resolve()
      }
    })
  })
  await page.keyboard.press("ArrowRight")
  expect(await page.evaluate(() => (window as any).__neural._decision.remaining)).toBeNull()
  await j.advance(2000)
  expect((await j.beats()).filter(b => b.beat === "land_q_expired")).toHaveLength(0)
  await page.evaluate(() => (window as any).releasePage())
  await page.waitForFunction(() => (window as any).__neural._landPage === 1)
  expect(await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return d.remaining === d.total && d.remaining > 3000
  })).toBe(true)
})

test("a gentle second scroll can build gradually out of the previous momentum tail", async ({ page }) => {
  await setup(page)
  const wheel = gestureWheel(page)
  const box = await page.locator("[data-land-mc-opt='0']").boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  for (const delta of [90, 40, 12, 4]) {
    await wheel(delta, 40)
  }
  for (const delta of [4, 6, 8, 10, 12, 14, 16, 18, 20]) {
    await wheel(delta, 20)
  }
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(2)
})

for (const width of [1440, 390]) {
  test(`@curated ${width}px chevrons are clickable, keep focus, and disappear at deck boundaries`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const { j, total } = await setup(page)
    const prev = page.locator("[data-land-prev]"), next = page.locator("[data-land-next]")
    await expect(page.locator("[data-land-nav]")).toHaveCount(1)
    await expect(prev).toBeHidden()
    await expect(next).toBeVisible()
    const box = await next.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await j.clickByMouse("[data-land-next]")
    await expect(prev).toBeVisible()
    await expect(page.locator("[data-land-position]")).toHaveAttribute("data-land-position", `2/${total}`)
    await j.clickByMouse("[data-land-prev]")
    await expect(prev).toBeHidden()
    // Focus is handed to the remaining arrow. Enter activates it through native button behavior.
    await expect(next).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-land-position]")).toHaveAttribute("data-land-position", `2/${total}`)
    for (let index = 2; index < total; index++) {
      await j.clickByMouse("[data-land-next]")
      await page.waitForFunction((index) => (window as any).__neural._landPage === index, index)
    }
    await expect(next).toBeHidden()
    await expect(prev).toBeVisible()
    await expect(prev).toBeFocused()
    await j.clickByMouse("[data-land-prev]")
    await expect(next).toBeVisible()
    expect((await j.beats()).filter(b => b.beat === "land_q_answered")).toHaveLength(0)
  })
}

test("chevrons stay reachable while a long answer scrolls on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  const { j } = await setup(page, true)
  await j.clickByMouse("[data-land-next]")
  await page.waitForTimeout(200)
  await j.clickByMouse("[data-land-reveal]")
  const card = await page.locator("[data-landcard]").boundingBox()
  const navBefore = await page.locator("[data-land-nav]").boundingBox()
  await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2)
  await page.mouse.wheel(0, 6000)
  await expect.poll(() => page.locator("[data-landcard]").evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await expect.poll(async () => (await page.locator("[data-land-nav]").boundingBox())!.y).toBeCloseTo(navBefore!.y, 0)
  await j.clickByMouse("[data-land-prev]")
  expect(await page.locator("[data-landcard]").evaluate(el => el.scrollTop)).toBe(0)
  await expect(page.locator("[data-land-prev]")).toBeHidden()
})
