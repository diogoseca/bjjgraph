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
    if (n.ty !== "positions" || !n.posId || n.cal?.stateAlias) continue;
    if (n.rep === false) continue;   // ONE ENTRY PER SITE (v1.125.0): both halves answer for the same two role-hands
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
      out.push({ st: n.posId + "/" + role, cards: cards, dsec: a._decisionDsec, armed: a._decision ? a._decision.remaining : "none", warmed: keys ? new Set(keys).size : 0 });
    }
  }
  a.hydrateDecks = real;
  return out;
})()`


test("@curated the hand never expires — the clock belongs to the question (v1.133.0)", async ({ page }) => {
  // v1.123.0's Hick's-law knee is retired with the hand clock it shaped. The owner's inversion:
  // "pressure should not be on the choices … the choices are fun to click." Two claims, both
  // corpus-wide and both mutant-killable:
  //   1. every dealt hand's window is DISARMED at deal (CLOCKS stubs deck hydration, so no
  //      question can mount — and without a question there is NO clock at all);
  //   2. the flat per-question window is `decisionSec`, hand size irrelevant — 34 cards get the
  //      same seconds as 3 (the knee's constants are deleted; _decisionDsec IS the setting).
  const j = journey(page)
  await j.boot("/")
  const hands: any[] = await page.evaluate(CLOCKS)
  expect(hands.length, "all 272 role-hands were driven through enterLand").toBe(248)
  for (const h of hands) {
    expect(h.armed, `${h.st} (${h.cards} cards) deals with a disarmed window`).toBe(null)
    expect(h.dsec, `${h.st}'s per-question window is the flat setting`).toBe(9)
  }
  // …and a REAL landing that times out keeps its hand: the reveal is the whole penalty.
  // (Fresh boot first: the CLOCKS sweep drives 272 direct pokes and leaves the camera unaimed —
  // the same reason the spec's own STAGE helper refuses direct pokes.)
  await j.boot("/")
  await j.land("Mount Top")
  const before = await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length)
  await j.advance(30_000)
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return { hand: (a.optionIdxs || []).length, beats: (a.beats || []).map((b: any) => b.beat) }
  })
  expect(after.hand, "the hand survives its question's expiry").toBe(before)
  expect(after.beats, "which is a named reveal, not a hesitation").toContain("land_q_expired")
  expect(after.beats).not.toContain("hesitated")
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

// (the three "overflow hint" describes that lived here — above the hand, click+wheel, not on a
// phone, not in landscape — went with the hint itself in v1.171.1, owner: "it's too much on
// screen to have the see more and the x". The wheel half of the reach test survives below.)
test.describe("reaching the folded cards", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("@curated a wheel over the hand scrolls it to the last card", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(STAGE("standing-position", "top"))
    await j.advance(2500)
    await page.locator("[data-tech]").first().waitFor({ state: "attached" })
    await j.advance(600)

    const left = () => page.evaluate(() => (window as any).__neural.optionsRef.current.scrollLeft)
    expect(await left(), "the tray starts at the beginning").toBe(0)
    expect(await page.locator(".ng-seemore").count(), "no see-more hint exists any more (v1.171.1)").toBe(0)

    // a wheel over the tray scrolls it. A VERTICAL wheel does not scroll a horizontally
    // overflowing element in any browser, so without the v1.123.0 handler a mouse user could not
    // reach card 34 by scrolling at all.
    const box = await page.evaluate(() => {
      const r = (window as any).__neural.optionsRef.current.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    await page.mouse.move(box.x, box.y)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(250)
    expect(await left(), "a wheel over the hand scrolls the hand").toBeGreaterThan(100)

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
