import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A SUBMISSION'S HAND DOES NOT GLOW (v1.214.1). Owner, 2026-10-01: "there's this strange glowing
 * effect of [the] choices row of a submission" (attacking Suloev Stretch from Half Guard, Dark Reader on).
 *
 * THE GLOW SOURCES ON THAT ROW, named:
 *  - the coaching BEACON: `setBeacon("options", row)` on every deal (v1.57.0) gives the row
 *    `.ng-beacon`, a pulsing green box-shadow up to `0 0 22px 5px`. The row also carried a constant
 *    edge mask from 2026-07-12, which clips an element's own box-shadow, so this light was never
 *    seen. v1.213.2 made the mask earned (none on a hand that fits) and a fitting hand — most often a
 *    submission's — began pulsing a full-width green band. THIS is the defect; it is now off.
 *  - the staged card's border and shadow (`_highlightStagedCard`, "FINISH IT", owner v1.134.0): the
 *    staged technique's card is the go on ANY hand. Unchanged: intended, and every staged hand has it.
 *  - every card glyph's `drop-shadow(0 0 4px)`: on every card of every hand. Unchanged.
 *  - Dark Reader recolours the cards' inline borders and shadows (blue -> navy) but passes the
 *    beacon's keyframes through, so under it the green band stood out more. Measured on the owner
 *    screen with Dark Reader's own engine (darkreader 4.9.133), outside this suite.
 *
 * THE ESCAPES' "Odds" (the owner's second suspicion: all four read 40%). Not a code constant: an
 * opponent escape card prints `1 - the submission's authored rate`, because no defensive option
 * carries a rate of its own (0 of 290 submissions' options do). Four escapes of one submission are
 * therefore equal by construction; another submission prints its own complement. Pinned below with
 * two submissions whose rates differ. (Whether the card should print a percentage at all is the
 * owner's call: in the live game an opponent's escape is certain once they act, `opponentDefend`.)
 *
 * Mutants, recorded 2026-10-01 on the built bundle: the row's beacon light restored (the
 * `.ng-optionrow.ng-beacon` rule removed) — red at the computed animation; a glow that passes the
 * style checks (`filter: drop-shadow` on the row, no animation, no box-shadow) — red only at the
 * pixel differential (it first SURVIVED a strip that sampled above the row's left side, so the
 * differential now covers the whole row and its margin); the escape base made a constant 0.4 — red on
 * the triangle (40 != 35).
 */

const URL_SULOEV = "/Submissions/Suloev-Stretch/from-Half-Guard/Attacker"
const URL_TRIANGLE = "/Submissions/Triangle-Choke/from-Triangle-Control/Attacker"

async function attack(page: Page, url: string) {
  const j = journey(page)
  await j.boot(url)
  await j.advance(4000)
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).length)).toBeGreaterThan(0)
  return j
}

/** Mean |RGB difference| (0-255) over the row and a 30px margin round it, live vs with the beacon
 *  class removed: any light the beacon adds — a box-shadow band outside the row, or a filter round the
 *  cards — shows up here, whatever property draws it. */
async function regionDelta(page: Page) {
  const box = (await page.locator(".ng-optionrow").boundingBox())!, vw = page.viewportSize()!.width
  const clip = { x: 0, y: Math.max(0, Math.round(box.y - 30)), width: vw, height: Math.round(box.height + 60) }
  const shot = async () => (await page.screenshot({ clip })).toString("base64")
  const live = await shot()
  await page.evaluate(() => document.querySelector(".ng-optionrow")!.classList.remove("ng-beacon"))
  const control = await shot()
  await page.evaluate(() => document.querySelector(".ng-optionrow")!.classList.add("ng-beacon"))
  return page.evaluate(async ([a, b]) => {
    const px = async (b64: string) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode()
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height
      const x = c.getContext("2d")!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data
    }
    const p = await px(a), q = await px(b); let s = 0, n = 0
    for (let i = 0; i < p.length; i += 4) { s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); n += 3 }
    return s / n
  }, [live, control])
}

test("a submission's hand keeps its beacon state but not its light, like every other hand", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await attack(page, URL_SULOEV)
  const row = await page.evaluate(() => {
    const a = (window as any).__neural, el = document.querySelector(".ng-optionrow") as HTMLElement, cs = getComputedStyle(el)
    return { at: a.nodes[a.currentPos].t, beacon: a.beaconState()?.target, attr: el.getAttribute("data-beacon"), cls: el.classList.contains("ng-beacon"),
      overflow: el.scrollWidth - el.clientWidth, fade: el.getAttribute("data-fade"), anim: cs.animationName, shadow: cs.boxShadow }
  })
  expect(row.at).toBe("Suloev Stretch from Half Guard")
  // the precondition that exposed the glow: the hand fits, so no edge mask clips anything
  expect(row.overflow, "the submission's hand fits the tray").toBeLessThanOrEqual(0)
  expect(row.fade, "and earns no edge mask").toBeNull()
  // the one-beacon law is untouched: the row still holds the beacon
  expect([row.beacon, row.attr, row.cls], "beacon state kept").toEqual(["options", "options", true])
  // ...and gives off no light
  expect(row.anim, "the row does not run the beacon animation").toBe("none")
  expect(row.shadow, "the row casts no shadow").toBe("none")
  // values settled first, so nothing repaints between the two shots but the beacon itself
  await expect.poll(() => page.evaluate(() => { const a = (window as any).__neural, s = a._choiceValues?.snapshot()
    return !!(s && s.handId === a._choiceHandId && ["ready", "bounded"].includes(s.status)) }), { timeout: 120_000 }).toBe(true)
  const delta = await regionDelta(page)
  expect(delta, "the row and its surroundings look the same with and without the beacon (mean channel delta)").toBeLessThan(0.5)
})

test("an opponent escape's Odds is its submission's own complement, not a constant", async ({ page }) => {
  const read = () => page.evaluate(() => {
    const a = (window as any).__neural, here = a.submissionNode(a.nodes[a.currentPos])
    return { rate: Math.round(a.calSuccess(here) * 100),
      odds: [...document.querySelectorAll('[data-choice-group="opponent"] [data-choice-action="escape"]')]
        .map((c) => ({ label: (c.querySelector("[data-immediate-label]")?.textContent || "").trim(), odds: (c.querySelector(".ngodds")?.textContent || "").trim() })) }
  })
  const seen: Record<string, number> = {}
  for (const url of [URL_SULOEV, URL_TRIANGLE]) {
    await attack(page, url)
    const r = await read()
    expect(r.odds.length, url + ": the opponent's escapes are dealt as threats").toBeGreaterThanOrEqual(2)
    for (const o of r.odds) expect(o, url).toEqual({ label: "Odds", odds: `${100 - r.rate}%` })
    seen[url] = 100 - r.rate
  }
  // two authored rates, two printed numbers: a constant would print one
  expect(seen[URL_SULOEV], "Suloev Stretch from Half Guard is authored at 60%").toBe(40)
  expect(seen[URL_TRIANGLE], "and the triangle at its own rate: " + JSON.stringify(seen)).not.toBe(seen[URL_SULOEV])
})
