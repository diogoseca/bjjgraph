import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

// Real mouse/keyboard paths and rendered geometry. Probability/timer/cancellation units are
// in tests/roll_execution.test.mjs. These journeys do not accept the later turn/model changes.
const commits = (page: Page) => page.evaluate(() =>
  ((window as any).__neural.beats || []).filter((b: any) => b.beat === "commit").length)

async function ready(page: Page) {
  const j = journey(page)
  await j.boot("/")
  for (const [tag, value] of Object.entries({
    "opp-finish": .99, "opp-pick": 0, "opp-sub-pick": 0, escape: 0,
    "start-pos": .5, role: 0, "ai-skill": .5, "max-moves": .5,
    "land-mc-pick": 0, "land-mc-shuffle": .5, "mc-pick": 0, "mc-shuffle": .5,
    "panic-mc-pick": 0, "panic-mc-shuffle": .5, "checkpoint-pick": 0,
  })) await j.rig(tag, Array(32).fill(value))
  await j.land("Mount Top")
  return j
}

async function transition(page: Page) {
  const opt = await page.evaluate(() => {
    const a = (window as any).__neural
    const o = a._optList.find((o: any) => o.node.ty === "transitions"
      && o.node.cal.outcomes.find((r: any) => r.result !== "success")?.result === "failure"
      && o.node.cal.outcomes.at(-1).result === "counter")
    return o && { name: o.node.t, idx: o.idx }
  })
  expect(opt, "authored transition with a failure and a final counter row").toBeTruthy()
  return opt!
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`@curated Inspect and execute are distinct real mouse actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await ready(page), opt = await transition(page)
    const sel = `[data-tech="${opt.name}"]`
    await page.locator(sel).scrollIntoViewIfNeeded()
    const printed = await page.locator(`${sel} .ngodds`).textContent()
    const before = await commits(page)
    await j.clickByMouse(`${sel} [data-choice-inspect]`, "Inspect")
    await expect(page.locator("[data-go]")).toBeVisible()
    expect(await commits(page)).toBe(before)
    await page.keyboard.press("Escape")
    await expect.poll(() => page.evaluate(() => {
      const a = (window as any).__neural
      return !a._detailCtx && a.optionsRef.current.style.transform === "none"
    })).toBe(true)
    await page.locator(sel).scrollIntoViewIfNeeded()
    const groups = await page.evaluate(() => {
      const root = (window as any).__neural.optionsRef.current
      const own = root.querySelector('[data-choice-group="you"]').getBoundingClientRect()
      const other = root.querySelector('[data-choice-group="opponent"]').getBoundingClientRect()
      return { ownRight: own.right, opponentLeft: other.left }
    })
    expect(groups.ownRight, "Inspect must not collapse whole hand groups into a card slot")
      .toBeLessThanOrEqual(groups.opponentLeft)
    await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
    const click = await page.locator(`${sel} .ngchoice-title`).boundingBox()
    expect(click).toBeTruthy()
    await j.clickByMouse(`${sel} .ngchoice-title`, "execute the technique")
    const status = page.locator("[data-executing-tech]")
    await expect(status).toHaveAttribute("data-execution-status", "executing")
    await expect(status.locator(".ngodds")).toHaveText(printed!)
    expect(await commits(page)).toBe(before + 1)
    expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
    await expect(page.locator("[data-tech]")).toHaveCount(0)
    await page.mouse.click(click!.x + click!.width / 2, click!.y + click!.height / 2)
    await page.keyboard.press("1")
    expect(await commits(page)).toBe(before + 1)
    await expect(status).toHaveAttribute("data-execution-status", "executing")
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(1081)
    await expect(status).toHaveAttribute("data-execution-status", "landed")
    await expect(page.locator(".ng-evtoast")).toContainText("Transition lands")
    await j.nextHand()
    await expect(status).toHaveCount(0)
  })
}

test("@curated shifted digits inspect, plain digits commit, and hidden hands ignore both", async ({ page }) => {
  const j = await ready(page), before = await commits(page)
  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator("[data-go]")).toBeVisible()
  expect(await commits(page)).toBe(before)
  await page.keyboard.press("Escape")
  await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "test"))
  await page.keyboard.press("1"); await page.keyboard.press("Shift+Digit1")
  expect(await commits(page)).toBe(before)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
  await page.evaluate(() => (window as any).__neural.setLayer("hand", true, "test"))
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
  await page.keyboard.press("1")
  expect(await commits(page)).toBe(before + 1)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(1)
})

for (const [outcome, result] of [[0, "failed"], [.999, "countered"]] as const) {
  test(`@curated the card reports the actual ${result} outcome and yields at opponent handoff`, async ({ page }) => {
    const j = await ready(page), opt = await transition(page)
    await j.rig("resolve", [.999]); await j.rig("outcome", [outcome, ...Array(32).fill(0)])
    await j.pick(opt.name)
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(1081)
    await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", result)
    await expect(page.locator(".ng-evtoast")).toContainText(result === "failed" ? "Failed" : "Countered")
    await j.nextHand()
    await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  })
}

test("@curated pause holds the sweep and teardown prevents a stale verdict", async ({ page }) => {
  const j = await ready(page), opt = await transition(page)
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
  await j.pick(opt.name)
  await j.advanceUntil("sweep_start", 20000, 40)
  const elapsed = await page.evaluate(() => {
    const a = (window as any).__neural
    a.setPaused(true)
    return a.sweepElapsed(a._sweep)
  })
  await j.advance(5000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a.sweepElapsed(a._sweep)
  })).toBe(elapsed)
  await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", "executing")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.rollFromPosition(a.currentPos, true, a.playerRole)
  })
  await j.advance(3000)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  expect((await j.beats()).filter(b => b.beat === "sweep_land")).toHaveLength(0)
})

test("@curated a modal owns digits and Enter until dismissed", async ({ page }) => {
  await ready(page)
  const before = await commits(page)
  await page.evaluate(() => (window as any).__neural.openModal())
  await page.keyboard.press("1"); await page.keyboard.press("Shift+Digit1"); await page.keyboard.press("Enter")
  expect(await commits(page)).toBe(before)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => (window as any).__neural.modalRef.current.style.display)).toBe("none")
})

test("@curated submission entry retains its printed odds and reaches Finish without a resolution draw", async ({ page }) => {
  const j = await ready(page)
  const name = await page.evaluate(() => (window as any).__neural._optList.find((o: any) => o.node.ty === "submissions").node.t)
  const card = page.locator(`[data-tech="${name}"]`), printed = await card.locator(".ngodds").textContent()
  await page.evaluate(() => {
    const a = (window as any).__neural, rng = a.rng.bind(a)
    a._phase1Draws = []
    a.rng = (tag: string) => { a._phase1Draws.push(tag); return rng(tag) }
  })
  await j.pick(name)
  await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-execution-status", "entering")
  await expect(page.locator("[data-executing-tech] .ngodds")).toHaveText(printed!)
  await j.nextHand()
  await expect(page.locator('[data-choice-group="you"] [data-choice-action="finish"]')).toHaveCount(1)
  await expect(page.locator("[data-executing-tech]")).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__neural._phase1Draws.filter((t: string) => t === "resolve" || t === "outcome"))).toEqual([])
})

for (const [width, height, pane] of [[390, 844, false], [1440, 900, false], [1440, 900, true]] as const) {
for (const reduced of [false, true]) {
  test(`@curated execution camera frames the technique at ${width}px; pane ${pane}; reduced motion ${reduced}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await ready(page), opt = await transition(page)
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0))
    await j.pick(opt.name)
    await j.advanceUntil("sweep_start", 20000, 40)
    await j.advance(350)
    if (pane) {
      await j.clickByMouse(".ng-logo", "open the learning pane during execution")
      await j.advance(1500); await j.advance(1500)
      expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
    }
    const point = await page.evaluate((idx) => {
      const a = (window as any).__neural, n = a.nodes[idx], s = a.W / a.cam.vw
      const toast = document.querySelector(".ng-evtoast")!.getBoundingClientRect()
      const card = document.querySelector("[data-executing-tech]")!.getBoundingClientRect()
      const pane = a.deckShown && !a.isMobile() ? a.drillRef.current.getBoundingClientRect().right : 0
      return { x: a.W / 2 + (n.x - a.cam.cx) * s, y: a.H / 2 + (a._LY(n) - a.cam.cy) * s,
        left: pane, width: a.W, top: toast.bottom, bottom: card.top }
    }, opt.idx)
    expect(point.x).toBeGreaterThan(point.left); expect(point.x).toBeLessThan(point.width)
    expect(point.y).toBeGreaterThan(point.top); expect(point.y).toBeLessThan(point.bottom)
    // Pan the actual graph; a newly earned patch can cover a fixed screen point.
    const drag = await page.evaluate(({ left, width, top, bottom }) => {
      const canvas = (window as any).__neural.canvasRef.current
      for (const fy of [.5, .65, .35]) {
        const x = left + (width - left) * .8, y = top + (bottom - top) * fy
        if (document.elementFromPoint(x, y) === canvas
          && document.elementFromPoint(x - 60, y + 25) === canvas) return { x, y }
      }
      return null
    }, point)
    expect(drag, "a real graph pan starts and ends on unobstructed canvas").toBeTruthy()
    await page.mouse.move(drag!.x, drag!.y); await page.mouse.down()
    await page.mouse.move(drag!.x - 60, drag!.y + 25, { steps: 6 }); await page.mouse.up()
    expect(await page.evaluate(() => (window as any).__neural._execution?.camera)).toBe(false)
  })
}
}
