import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** v1.230.0 — feedback_owner_rules_reverse_shipped_contracts.
 * Reverses v1.220.0's 0.6 Win hierarchy and v1.218.1 / v1.220.0 Inspect anatomy.
 * The approved face uses equal 18px values under equal 10px labels; category shape with shortcut.
 * The chosen face's 1/12 lift over 440ms, reduced motion and stable hit box stay.
 * D-318 removes Choose/Read. Only the separate play circle opens the video viewer.
 */

const LIFT = 1 / 12 // NG_CARD_LIFT: the chosen card's rise, of its own height
const LIFT_MS = 440 // NG_CARD_LIFT_MS

const a = (page: Page, fn: string) => page.evaluate(fn)

async function seat(page: Page, where: "Mount Top" | "Attacker" | "Defender") {
  const j = journey(page)
  if (where === "Mount Top") { await j.boot("/"); await j.land("Mount Top") }
  else { await j.boot(`/Submissions/Triangle-Choke/from-Triangle-Control/${where}`); await j.advance(4000) }
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).length)).toBeGreaterThan(0)
  return j
}

/** Tag one dealt card (own by kind, or a threat) and return its title. The hand is marked touched so
 *  it never re-sorts under the measurement (CLAUDE.md §5). */
async function mark(page: Page, kind: "transition" | "entry" | "escape" | "threat") {
  return page.evaluate((kind) => {
    const a = (window as any).__neural
    a._handTouched = true
    document.querySelectorAll("[data-cp-target]").forEach((e) => e.removeAttribute("data-cp-target"))
    const hit = (a._optionCards || []).find((c: any) => kind === "threat" ? c.opt.threat
      : !c.opt.threat && (kind === "escape" ? c.opt.action === "escape" : kind === "entry" ? c.opt.node.ty === "submissions" && !c.opt.action : c.opt.node.ty === "transitions"))
    if (!hit) throw new Error("no " + kind + " card")
    hit.card.setAttribute("data-cp-target", "1")
    hit.card.scrollIntoView({ inline: "nearest", block: "nearest" })
    return hit.card.querySelector(".ngchoice-title").textContent.trim() as string
  }, kind)
}

async function atRest(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const m = getComputedStyle(document.querySelector("[data-cp-target]") as HTMLElement).transform
    return m === "none" || m === "matrix(1, 0, 0, 1, 0, 0)"
  }), { message: "the marked card has finished its deal-in ease" }).toBe(true)
}

const cardSizes = (page: Page) => page.evaluate(() => {
  const px = (el: Element | null) => el ? parseFloat(getComputedStyle(el).fontSize) : null
  return [...document.querySelectorAll("[data-choice-group] [data-tech], [data-choice-group] [data-threat-tech]")].map((c) => ({
    threat: c.hasAttribute("data-threat-tech"), title: (c.querySelector(".ngchoice-title") as HTMLElement).textContent!.trim(),
    moveNum: px(c.querySelector(".ngodds")), moveLabel: px(c.querySelector(".ng-choice-stat > span")),
    winLabel: px(c.querySelector(".ng-choice-stat + .ng-choice-stat > span")), winNum: px(c.querySelector("[data-choice-win]")),
    threatWin: px(c.querySelector("[data-threat-win]")), h: Math.round(c.getBoundingClientRect().height),
  }))
})

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    test("@curated equal score columns, direct title and fixed media space on every card", async ({ page }) => {
      let own = 0, threats = 0
      for (const where of ["Mount Top", "Attacker", "Defender"] as const) {
        await seat(page, where)
        for (const c of await cardSizes(page)) {
          const at = `${where} · ${c.title}`
          expect(c.h, `${at}: the shortened 176px card`).toBe(176)
          expect([c.moveLabel, c.moveNum, c.winLabel, c.threat ? c.threatWin : c.winNum], at).toEqual([10, 18, 10, 18])
          if (c.threat) threats++; else own++
        }
        await expect(page.locator("[data-choice-group] [data-cat], [data-choice-inspect]")).toHaveCount(0)
      }
      expect(own).toBeGreaterThan(10)
      expect(threats).toBeGreaterThan(1)
    })

    test("@curated item 4: the chosen card rises a twelfth of its height and settles, its rectangle never moves", async ({ page }) => {
      const j = await seat(page, "Mount Top")
      // a submission ENTRY: certain, no roll, and the one path whose next deal follows the stand-in
      // with no clearOptions between (choice-row-centre's case), so only the deal can restore the row
      const title = await mark(page, "entry")
      await atRest(page)
      const before = await page.evaluate(() => { const r = document.querySelector("[data-cp-target]")!.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
      await j.clickByMouse("[data-cp-target] .ngchoice-title", `the card "${title}"`)
      const lift = await page.evaluate(() => {
        // whatever the app animates under the stand-in, measured as it renders (a lift that moved the
        // HOLDER must be measured, not missed)
        const holder = document.querySelector("[data-executing-tech]") as HTMLElement
        const an = holder.getAnimations({ subtree: true })[0]
        if (!an) return null
        const face = (an.effect as KeyframeEffect).target as HTMLElement
        an.pause()
        const dur = Number(an.effect!.getTiming().duration)
        // the peak, found from what the animation RENDERS, not from its keyframes
        let peak = { t: 0, ty: 0 }
        for (let t = 0; t <= dur; t += 5) { an.currentTime = t; const ty = new DOMMatrix(getComputedStyle(face).transform).m42; if (ty < peak.ty) peak = { t, ty } }
        an.currentTime = peak.t
        const hr = holder.getBoundingClientRect(), row = (window as any).__neural.optionsRef.current
        const hit = document.elementFromPoint(hr.left + hr.width / 2, hr.bottom - 3)
        const out = { dur, peak, holder: [hr.left, hr.top, hr.width, hr.height], hole: !(hit && (hit === holder || holder.contains(hit))), rowOverflowY: getComputedStyle(row).overflowY,
          faceTop: face.getBoundingClientRect().top, end: "" }
        an.currentTime = dur - 1   // the last rendered moment (at `dur` an unfilled animation applies nothing)
        const m = new DOMMatrix(getComputedStyle(face).transform)
        out.end = Math.abs(m.m42) < 0.5 && Math.abs(m.m11 - 1) < 0.01 ? "settled" : `ty ${m.m42.toFixed(2)} scale ${m.m11.toFixed(3)}`
        an.play()
        return out
      })
      expect(lift, "the chosen card animates").not.toBeNull()
      expect(lift!.dur, `the lift takes NG_CARD_LIFT_MS (${LIFT_MS} ms)`).toBe(LIFT_MS)
      expect(Math.abs(-lift!.peak.ty / before[3] - LIFT), `it rises ${LIFT.toFixed(3)} of its height (${-lift!.peak.ty}px of ${before[3]})`).toBeLessThan(0.005)
      expect(lift!.faceTop, "...past the row's top: the row does not clip the rising card").toBeLessThan(before[1] - 2)
      expect(lift!.rowOverflowY, "...because the row holding the stand-in does not clip").toBe("visible")
      for (let i = 0; i < 4; i++) expect(Math.abs(lift!.holder[i] - before[i]), `the stand-in's rectangle stays where the card was (${lift!.holder} vs ${before})`).toBeLessThanOrEqual(1)
      expect(lift!.hole, "at the peak, the bottom of the card's rectangle still belongs to the stand-in (no click hole onto the graph)").toBe(false)
      expect(lift!.end, "it settles back where it was").toBe("settled")
      // the next deal scrolls again: it restores the row's clipping
      await j.nextHand()
      expect(await a(page, "(() => { const s = getComputedStyle(window.__neural.optionsRef.current); return s.overflowX + '/' + s.overflowY })()"), "the next deal restores the row's scrolling").toBe("auto/hidden")
    })

    test("@curated item 4: under reduced motion the chosen card does not rise", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      const j = await seat(page, "Mount Top")
      const title = await mark(page, "transition")
      await atRest(page)
      await j.clickByMouse("[data-cp-target] .ngchoice-title", `the card "${title}"`)
      const still = await page.evaluate(() => { const f = (document.querySelector("[data-executing-tech]") as HTMLElement).firstElementChild as HTMLElement; return { anims: f.getAnimations().length, tf: getComputedStyle(f).transform } })
      expect(still.anims, "no animation on the chosen card").toBe(0)
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(still.tf)
    })

    test("@curated all four choice roles keep their shape, without Read or a footer", async ({ page }) => {
      for (const [where, kind] of [["Mount Top", "transition"], ["Mount Top", "entry"], ["Defender", "escape"], ["Attacker", "threat"]] as const) {
        const j = await seat(page, where)
        await mark(page, kind)
        await expect(page.locator("[data-cp-target] [data-choice-shape]")).toHaveCount(1)
        await expect(page.locator("[data-cp-target] footer, [data-cp-target] a, [data-cp-target] [data-choice-read]")).toHaveCount(0)
        await expect(page.locator("[data-cp-target] [data-choice-inspect]")).toHaveCount(0)
        if (kind === "threat") await expect(page.locator("[data-cp-target] [data-choice-execute]")).toHaveCount(0)
      }
    })
  })
}
