import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SHOW EVERY OPTION — the three things uncapping the hand had to pay for (v1.123.0).
 *
 * `option-hand.spec.ts` pins that every legal move is DEALT. This file pins the consequences the
 * owner would feel: the decision clock must not scale with the hand, the deck warm-up must not
 * scale with it either (it is on the first-hand payload bill), and the "see more" affordance must
 * sit ABOVE the hand rather than on top of the account chip — and must not appear on a small
 * screen at all.
 *
 * Owner: "show all, fold the overflow, we currently have a 'see more' suggestion already, but
 * should be shown ABOVE the options row, rather than on bottom of it cos in mobile that see more
 * overlaps user icon and text, and in mobile screens or small screens i mean dont show it."
 */

/** Stage a roll at a NAMED state through the app's OWN navigation path.
 *
 *  DELIBERATELY `rollFromPosition`, not `currentPos = i; enterLand()`. The direct poke deals the
 *  hand fine but leaves `focusIdx`/`pulse`/`activeMove` and the camera un-aimed, and the very
 *  next frame throws `createRadialGradient ... non-finite` out of `draw()` — VERIFIED to do so on
 *  the pre-v1.123.0 bundle too (10 cards dealt, same crash), so it is a harness misuse and not a
 *  regression. The sweeps below never pump a frame, so they may still use the fast poke; anything
 *  that needs the app to RENDER has to arrive the way a user does. */
const STAGE = (posId: string, role: string) => `(() => {
  const a = window.__neural;
  let idx = -1;
  for (let i = 0; i < a.nodes.length; i++) { const n = a.nodes[i]; if (n.ty === "positions" && n.posId === ${JSON.stringify(posId)}) { idx = i; break; } }
  if (idx < 0) throw new Error("no such position: " + ${JSON.stringify(posId)});
  a.rollFromPosition(idx, true, ${JSON.stringify(role)});
  return idx;
})()`

const TRAY = `(() => {
  const a = window.__neural, row = a.optionsRef.current;
  return {
    cards: row.querySelectorAll("[data-tech]").length,
    dsec: a._decisionDsec,
    scrollW: row.scrollWidth, clientW: row.clientWidth,
  };
})()`

/** Every live role-hand, with the clock the app actually armed for it. */
const CLOCKS = `(async () => {
  const a = window.__neural;
  const real = a.hydrateDecks.bind(a);
  let keys = null;
  a.hydrateDecks = (k) => { keys = (k || []).slice(); return Promise.resolve([]); };
  const out = [];
  for (let i = 0; i < a.nodes.length; i++) {
    const n = a.nodes[i];
    if (n.ty !== "positions" || !n.posId) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = i; a.playerRole = role;
      keys = null;
      let cards = 0;
      try {
        cards = (a.optionsFor(i) || []).length;
        if (!cards) continue;
        a.enterLand(false);
      } catch (e) { continue }
      await new Promise((r) => setTimeout(r, 0));
      out.push({ st: n.posId + "/" + role, cards: cards, dsec: a._decisionDsec, warmed: keys ? new Set(keys).size : 0 });
    }
  }
  a.hydrateDecks = real;
  return out;
})()`

const OLD_LINEAR = (n: number) => 9 + (n - 1) * 0.8

test("@curated the decision clock stops scaling with the hand", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const hands: any[] = await page.evaluate(CLOCKS)
  expect(hands.length, "all 272 role-hands were driven through enterLand").toBe(272)

  // 1. BELOW THE KNEE NOTHING MOVED. This is the whole argument for a knee rather than a pure
  //    log curve: 256 of the 272 hands are 10 cards or fewer, and every one of them must keep
  //    the clock it had before the cap was lifted, to the millisecond.
  const under = hands.filter((h) => h.cards <= 10)
  expect(under.length, "hands at or under the knee").toBe(256)
  for (const h of under)
    expect(h.dsec, `${h.st} (${h.cards} cards) must keep its old clock exactly`).toBeCloseTo(OLD_LINEAR(h.cards), 6)

  // 2. AND ABOVE IT, THE CLOCK IS SUBLINEAR. The old formula bought 35.4s at 34 cards; the point
  //    of the change is that no turn is that long. Asserted as a real ceiling, not a ratio.
  const worstOld = Math.max(...hands.map((h) => OLD_LINEAR(h.cards)))
  const worstNew = Math.max(...hands.map((h) => h.dsec))
  expect(worstOld, "the old linear clock's worst turn").toBeCloseTo(35.4, 1)
  expect(worstNew, "no turn may run this long any more").toBeLessThan(21)
  const big = hands.find((h) => h.st === "standing-position/top")!
  expect(big.cards, "the largest hand in the corpus").toBe(34)
  expect(big.dsec, "and its turn").toBeCloseTo(20.1, 1)

  // 3. IT IS STILL MONOTONIC — more cards never means less time. A sublinear curve that dips
  //    would be a worse bug than the linear one it replaced.
  const byN = new Map<number, number>()
  for (const h of hands) byN.set(h.cards, h.dsec)
  const ns = [...byN.keys()].sort((a, b) => a - b)
  for (let i = 1; i < ns.length; i++)
    expect(byN.get(ns[i])!, `${ns[i]} cards must not get less time than ${ns[i - 1]}`).toBeGreaterThan(byN.get(ns[i - 1])!)

  // 4. AND CONTINUOUS AT THE KNEE — the two branches meet, so there is no step for a player to
  //    feel between a 10-card and an 11-card hand.
  const at10 = hands.filter((h) => h.cards === 10)
  const at11 = hands.filter((h) => h.cards === 11)
  expect(at10.length, "hands of exactly 10").toBeGreaterThan(0)
  expect(at11.length, "hands of exactly 11").toBeGreaterThan(0)
  expect(at10[0].dsec).toBeCloseTo(16.2, 6)
  expect(at11[0].dsec - at10[0].dsec, "the step across the knee is a fraction of a second").toBeLessThan(0.5)
})

test("@curated the hand uncapped; the deck warm-up did not", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const hands: any[] = await page.evaluate(CLOCKS)

  // The warm-up is on the first-hand payload bill (payload-first-hand freezes its request set at
  // [data-tech], which resolves after enterLand's one-macrotask deferral — its own report shows
  // five flashcards/*.json rows). Warming every card of an uncapped hand costs +15,819 B gzip on
  // the average first visit against 7,050 B of headroom, so this is the one thing that had to
  // keep counting to ten: NG_PREFETCH_CAP options plus the position's own deck.
  for (const h of hands)
    expect(h.warmed, `${h.st} warmed ${h.warmed} decks for a ${h.cards}-card hand`).toBeLessThanOrEqual(11)

  // and it genuinely bites. 16 hands now deal more than NG_PREFETCH_CAP cards; of those, the 12
  // that deal more than 11 warm strictly fewer decks than they show.
  const overCap = hands.filter((h) => h.cards > 10)
  expect(overCap.length, "hands dealing more than the warm-up cap").toBe(16)
  const strictly = hands.filter((h) => h.cards > 11)
  expect(strictly.length, "hands warming strictly fewer decks than they deal cards").toBe(12)
  for (const h of strictly) {
    expect(h.warmed, `${h.st} caps its warm-up at 10 options + its own deck`).toBe(11)
    expect(h.warmed, `${h.st} warms fewer decks than it deals cards`).toBeLessThan(h.cards)
  }
  const stand = hands.find((h) => h.st === "standing-position/top")!
  expect(stand.cards, "34 cards dealt").toBe(34)
  expect(stand.warmed, "11 decks warmed").toBe(11)
})

test.describe("the overflow hint", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("@curated sits above the hand and clear of the account chip", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(STAGE("standing-position", "top"))
    // `updateUiShift` is what writes the hint's opacity, pointer-events AND its dock, and in test
    // mode the frame loop runs on the advance() pump — a wall-clock wait pumps nothing.
    await j.advance(2500)
    await page.locator("[data-tech]").first().waitFor({ state: "attached" })
    await j.advance(600)
    const dealt: any = await page.evaluate(TRAY)
    expect(dealt.cards, "the worst hand is dealt whole").toBe(34)
    expect(dealt.scrollW - dealt.clientW, "and it overflows, so the hint has a job").toBeGreaterThan(1000)

    const m = await page.evaluate(() => {
      const a = (window as any).__neural
      const hint = a.optionHintRef.current, row = a.optionsRef.current
      const chip = document.querySelector(".ng-acctwrap")
      const b = (e: any) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom } }
      return { hint: b(hint), row: b(row), chip: b(chip), disp: getComputedStyle(hint).display, op: getComputedStyle(hint).opacity }
    })
    expect(m.disp, "shown at this width").not.toBe("none")
    expect(Number(m.op), "and actually visible").toBeGreaterThan(0)

    // ABOVE the row — the owner's ask. It used to be bottom:68px against the row's bottom:84px,
    // i.e. UNDER the hand entirely.
    expect(m.hint.b, "the hint's bottom edge clears the tray's top edge").toBeLessThanOrEqual(m.row.t)

    // and therefore nowhere near the chip it used to sit 2px above
    const overlaps = !(m.hint.r <= m.chip.l || m.hint.l >= m.chip.r || m.hint.b <= m.chip.t || m.hint.t >= m.chip.b)
    expect(overlaps, "the hint must not overlap the account chip").toBe(false)
    expect(m.chip.t - m.hint.b, "measured clearance to the chip (was 2px)").toBeGreaterThan(100)

    // it is its own hit target, not something painted under the chip
    const at = await page.evaluate(() => {
      const h = (window as any).__neural.optionHintRef.current.getBoundingClientRect()
      const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2)
      return e ? e.className : null
    })
    expect(String(at), "elementFromPoint at the hint's centre is the hint").toContain("ng-seemore")
  })

  test("@curated reaches the folded cards — click, and wheel", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(STAGE("standing-position", "top"))
    await j.advance(2500)
    await page.locator("[data-tech]").first().waitFor({ state: "attached" })
    await j.advance(600)

    const left = () => page.evaluate(() => (window as any).__neural.optionsRef.current.scrollLeft)
    expect(await left(), "the tray starts at the beginning").toBe(0)

    // a REAL mouse click on the hint, not locator.click() — the hint is a fixed overlay and this
    // repo has a long history of overlays that hit-test to something else (see attachInput)
    await j.clickByMouse(".ng-seemore", "the see-more hint")
    await page.waitForTimeout(700) // tweenScroll is a 420ms tween
    const afterClick = await left()
    expect(afterClick, "clicking see-more scrolls the hand").toBeGreaterThan(100)

    // and a wheel over the tray scrolls it too. A VERTICAL wheel does not scroll a horizontally
    // overflowing element in any browser, so without the v1.123.0 handler a mouse user could not
    // reach card 34 by scrolling at all.
    const box = await page.evaluate(() => {
      const r = (window as any).__neural.optionsRef.current.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    await page.mouse.move(box.x, box.y)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(250)
    expect(await left(), "a wheel over the hand scrolls the hand").toBeGreaterThan(afterClick)

    // the far end is reachable: keep wheeling and the tray bottoms out at its full extent
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(60) }
    await page.waitForTimeout(200)
    const end = await page.evaluate(() => {
      const el = (window as any).__neural.optionsRef.current
      return { l: el.scrollLeft, max: el.scrollWidth - el.clientWidth }
    })
    expect(end.max - end.l, "the last card is reachable").toBeLessThan(4)
  })
})

test.describe("the overflow hint on a small screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("@curated is not rendered on a phone", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(STAGE("standing-position", "top"))
    await j.advance(2500)
    await page.locator("[data-tech]").first().waitFor({ state: "attached" })
    await j.advance(600)
    const m = await page.evaluate(() => {
      const a = (window as any).__neural
      const hint = a.optionHintRef.current, row = a.optionsRef.current
      return { disp: getComputedStyle(hint).display, cls: hint.className, overflow: row.scrollWidth - row.clientWidth, cards: row.querySelectorAll("[data-tech]").length }
    })
    expect(m.cards, "the phone still gets the whole hand").toBe(34)
    expect(m.overflow, "which certainly overflows a 390px screen").toBeGreaterThan(1000)
    expect(m.cls, "the element carries the class the rule targets").toContain("ng-seemore")
    expect(m.disp, "and the rule fires — a thumb drags the tray, it needs no label").toBe("none")
  })
})

test.describe("the overflow hint in landscape", () => {
  // 844x390 — a phone held sideways. This is the case the OLD width-only rule missed: 844px is
  // WIDE, so `@media (max-width:640px)` never fired and the owner saw the hint on their phone.
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true })

  test("@curated is not rendered on a phone held sideways", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(STAGE("standing-position", "top"))
    await j.advance(2500)
    await page.locator("[data-tech]").first().waitFor({ state: "attached" })
    await j.advance(600)
    const m = await page.evaluate(() => {
      const hint = (window as any).__neural.optionHintRef.current
      return { disp: getComputedStyle(hint).display, w: innerWidth, h: innerHeight }
    })
    expect(m.w, "this viewport is wider than the old 640px rule").toBeGreaterThan(640)
    expect(m.disp, "and it is still hidden — the height term is what catches it").toBe("none")
  })
})
