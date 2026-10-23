import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

// The harness omits dossiers. Author More explicitly so keyboard and pause assertions
// cannot pass merely because the lower reading surface never existed.
// Mutation check: letting a landing render own the shared MC slot under an open pane fails
// the fresh/cached/backfilled case on surface and question identity, before any answer key.
async function addMore(page: Page) {
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = { cat: "Position", role: "Top", lead: "Keep a stable connection.",
      principles: ["Maintain your base while your partner changes direction."] }
    a.onContentReady(key)
  })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
}

async function settle(page: Page, j: Journey) {
  await page.waitForTimeout(350)
  await j.advance(1200)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await settle(page, j)
  return j
}

async function study(page: Page, j: Journey) {
  await j.clickByMouse(".ng-logo", "open the pane")
  // Open the full study surface through the same entry point as a selected lesson.
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.set("mcMode", "auto")
    a.openStudy(a.deckKeyFor(a.nodes[a.currentPos]).key)
  })
  await page.waitForFunction(() => (window as any).__neural._mc?.surface === "deck")
  await expect(page.locator("[data-mc-opt]")).toHaveCount(3)
  await settle(page, j)
}

// STALE CONTRACT (D-338): Focus on reading and Browse are gone. Reading starts with a real reading
// interaction (focusing the prose), and the logo opens the pane above the article, as Browse did.
const read = async (page: Page) => {
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._reader.interacting)).toBe(true)
}
test("@curated Esc closes the pane and leaves the independent article reading", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await read(page)
  await page.locator('[data-reader]').evaluate(e => { e.scrollTop = 0 })
  await j.clickByMouse(".ng-logo", "open the pane above the article")
  await page.keyboard.press("Escape")
  await expect(page.locator(".ng-drill")).toBeHidden()
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { reading: a._reader.interacting, clock: a._decision?.remaining ?? null, paused: a.paused }
  })).toEqual({ reading: true, clock: null, paused: true })
})

test("@curated fresh, cached and backfilled landing pages preserve the pane's answer keys", async ({ page }) => {
  const j = await setup(page)
  await study(page, j)
  const pane = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return { qhash: m.qhash, correct: m.correct }
  })
  for (const dir of ["next", "prev", "next"]) {
    await j.clickByMouse(`[data-land-${dir}]`, `page the exposed landing deck ${dir}`)
    await j.landSettled()
    expect(await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return { surface: m?.surface, qhash: m?.qhash }
    })).toEqual({ surface: "deck", qhash: pane.qhash })
  }
  await addMore(page) // same mounted landing question survives a late dossier backfill
  expect(await page.evaluate(() => (window as any).__neural._mc?.qhash)).toBe(pane.qhash)
  await page.keyboard.press("abc"[pane.correct])
  await expect(page.locator(`[data-mc-opt="${pane.correct}"]`)).toHaveAttribute("data-mc-result", "correct")
  await expect(page.locator("[data-land-q] [data-mc-result]")).toHaveCount(0)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)

  await j.clickByMouse(".ng-explorer-close", "close the study pane")
  const land = await page.evaluate(() => {
    const a = (window as any).__neural
    const m = a._landEl.querySelector("[role=radiogroup]").__ngMc
    return { ownsKeys: a._mc === m, correct: m.correct }
  })
  expect(land.ownsKeys, "the mounted landing block receives its keys back").toBe(true)
  await page.keyboard.press("abc"[land.correct])
  await expect(page.locator(`[data-land-mc-opt="${land.correct}"]`)).toHaveAttribute("data-mc-result", "correct")
})

test("@curated a recall page mounted under the pane receives Space when the pane closes", async ({ page }) => {
  const j = await setup(page)
  await page.evaluate(() => {
    const a = (window as any).__neural, key = a._landQ.key
    a.set("recallInPlay", true)
    const card = a._landDeckCards(key)[1]
    a.stage[key] ||= {}; a.stage[key][a.qhash(card.q)] = 2
  })
  await study(page, j)
  for (const dir of ["next", "prev", "next"]) {
    await j.clickByMouse(`[data-land-${dir}]`, `page the exposed landing deck ${dir}`)
    await j.landSettled()
  }
  await expect(page.locator("[data-land-reveal]")).toBeVisible()
  await j.clickByMouse(".ng-explorer-close", "close the study pane")
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a._recall === a._landEl.querySelector("[data-land-recall]").__ngRecall
  })).toBe(true)
  // Space activates a focused button before any app shortcut. Put focus back in
  // the reading area with a real click, rather than activating the pane's close button again.
  await j.clickByMouse("[data-land-q] > div:first-child", "the landing reading area")
  await page.keyboard.press("Space")
  await expect(page.locator("[data-land-answer]")).toBeVisible()
})

// D-354 (review-claude Delta 8, B1): this PR's app race. Since D-318 the landing card and its deck
// arrows are the reader's parts, and the reader laid them out a frame after the pane's slide had moved
// the column, so a click measured just after the pane opened landed on the moved card: the next arrow's
// point became an MC answer (the test above, isolated: head 10 of 75 red, dev 0 of 100). They now follow
// the pane in the same frame. Read inside one evaluate, with no frame between, the arrows already sit
// where the reader's own layout puts them. THIS journey is the gate (D9-N4): its control d354-pane-follow-lag
// is killed at its claim. Later isolated greens of the test above are not evidence of the fix.
test("D-354: the landing deck and its arrows follow the pane in the same frame", async ({ page }) => {
  await setup(page)
  const r = await page.evaluate(() => {
    const a = (window as any).__neural, at = (el: any) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)] }
    const next = () => document.querySelector("[data-land-next]") as HTMLElement
    const premise = { adopted: !!a._landEl?.hasAttribute("data-reader-game-part"), arrow: !!next(), shift: a.uiShift }
    a.openPane("explore")
    a.advance(4000)   // the pane's slide (1 - e^(-t/0.4), snapping within 0.001), pumped: no real frame between
    const slid = { card: at(a._landEl), next: at(next()), shift: a.uiShift }
    a._reader.layoutNow()
    return { premise, slid, laidOut: { card: at(a._landEl), next: at(next()) } }
  })
  expect(r.premise, "premise: the reader owns the landing card and its arrows, the pane shut").toEqual({ adopted: true, arrow: true, shift: 0 })
  expect(r.slid.shift, "premise: the pane slid open").toBe(1)
  expect({ card: r.slid.card, next: r.slid.next }, "the card and its arrows follow the pane in the same frame").toEqual(r.laidOut)
})

// STALE CONTRACT (D-338): "leaving Focus" has no control left; the claim that stopped reading
// waits for a move is kept, entered by the reading interaction itself.
test("@curated stopped reading waits for a move", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await read(page)
  await j.advance(12000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { reading: a._reader.interacting, paused: a.paused, clock: a._decision?.remaining ?? null }
  })).toEqual({ reading: true, paused: true, clock: null })
  await page.evaluate(() => (window as any).__neural._optionCards.find((c: any) => !c.opt.threat).card.setAttribute("data-reading-choice", ""))
  await page.locator("[data-reading-choice]").scrollIntoViewIfNeeded()
  await j.clickByMouse("[data-reading-choice]", "choose a move directly")
  await j.advance(1500)
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { intent: a._readerIntent, reading: a._reader.interacting } })).toEqual({ intent: false, reading: false })
})
