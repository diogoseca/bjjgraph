import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE HAND CENTRES IN A SUBMISSION TOO (v1.213.1). Owner, 2026-10-01: "the choices row when in
 * submissions nodes are not centered but left aligned. pls fix".
 *
 * CAUSE. `startExecution` sets the row to `flex-start` so the chosen card stays under the pointer
 * while it executes. Picking a submission ENTRY goes straight from that execution into the next deal,
 * with no `clearOptions` between them, so the submission's hand inherited `flex-start`. Measured before
 * the fix, 1440px, after entering Triangle Choke from Closed Guard: a 5-card hand spanning 24-813 in a
 * row whose visible area is 24-1440 — its centre 313px left of the row's. A URL arrival centred
 * correctly, which is why only play showed it. `renderChoiceGroups` now owns the alignment of every
 * hand it deals; the pick's `flex-start` belongs to the execution card alone.
 *
 * THE CLAIM, per width (1440, 1024, 390) and pane state (shut, open), for the attacker's finish hand
 * and the defender's escape hand, both reached by PLAYING into them: the hand sits in the SAME visible
 * area as the ordinary hand at that width and pane state (the row's content box: its left inset is
 * the measured pane plus the row's own inset), and inside it the hand centres when it fits, or starts
 * at the leading inset when it overflows, which is the ordinary hand's own rule (`safe center`).
 * A positive count requires the fitting case to occur at the desktop widths, so "it always overflows"
 * cannot pass this vacuously.
 *
 * Mutants, recorded 2026-10-01 on the built bundle: removing the deal's own alignment (the
 * `justifyContent` line in `renderChoiceGroups`, i.e. the pre-fix build) turns the attacker case red
 * at 1440 and 1024 ("a hand that fits is centred": 24-813 in 24-1440). Non-kill, recorded: at 390
 * every hand overflows, so that width cannot see it; it is kept for the overflow half. An UNSAFE
 * `center` is red at all three widths, but by a click timeout (the clipped first card is
 * unreachable), not at the inset assertion — so that half's own assertion is not mutant-proven.
 */

type Box = { left: number; right: number }
const measure = (page: Page) => page.evaluate(() => {
  const row = document.querySelector(".ng-optionrow") as HTMLElement, a = (window as any).__neural
  const r = row.getBoundingClientRect(), cs = getComputedStyle(row)
  // in scroll-origin coordinates, so a scrolled overflowing hand still reads where it starts
  const kids = [...row.children].map((k) => k.getBoundingClientRect()).filter((b) => b.width > 0)
  const L = Math.min(...kids.map((b) => b.left)) + row.scrollLeft, R = Math.max(...kids.map((b) => b.right)) + row.scrollLeft
  return { at: a.nodes[a.currentPos].t, escape: !!a._handEscape, groups: kids.length,
    box: { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight) },
    content: { left: L, right: R } }
})

async function paneTo(page: Page, j: ReturnType<typeof journey>, open: boolean) {
  await page.evaluate((o) => (window as any).__neural.setDeckOpen(o), open)
  // the inset rides `updateUiShift`'s eased frame: pump until it stops moving
  let last = -1
  for (let i = 0; i < 20; i++) {
    await j.advance(300)
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".ng-optionrow")!).paddingLeft))
    if (Math.abs(pad - last) < 0.05) break
    last = pad
  }
}

async function dealtAfter(page: Page, j: ReturnType<typeof journey>, ok: string) {
  for (let i = 0; i < 60; i++) {
    await j.advance(250)
    const ready = await page.evaluate((want) => {
      const a = (window as any).__neural
      if (a._execution || !(a._optionCards || []).some((c: any) => !c.opt.threat)) return false
      return want === "escape" ? !!a._handEscape : a.nodes[a.currentPos].ty === "submissions" && !a._handEscape
    }, ok)
    if (ready) return
  }
  throw new Error("no " + ok + " hand was dealt")
}

for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
  test(`a submission's hand centres where the ordinary hand does, attacker and defender, pane shut and open, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    const ordinary: Record<string, Box> = {}
    for (const open of [false, true]) { await paneTo(page, j, open); ordinary[String(open)] = (await measure(page)).box }
    await paneTo(page, j, false)

    let fits = 0, checked = 0
    const check = async (what: string) => {
      for (const open of [false, true]) {
        await paneTo(page, j, open)
        const m = await measure(page), o = ordinary[String(open)], tag = `${what} · pane ${open ? "open" : "shut"} · ${width}px`
        checked++
        expect(Math.abs(m.box.left - o.left), tag + ": same visible area as the ordinary hand (left)").toBeLessThanOrEqual(1)
        expect(Math.abs(m.box.right - o.right), tag + ": same visible area as the ordinary hand (right)").toBeLessThanOrEqual(1)
        const fit = m.content.right - m.content.left <= m.box.right - m.box.left + 1
        if (fit) {
          fits++
          expect(Math.abs((m.content.left + m.content.right) / 2 - (m.box.left + m.box.right) / 2),
            tag + ": a hand that fits is centred " + JSON.stringify(m)).toBeLessThanOrEqual(1.5)
        } else {
          expect(Math.abs(m.content.left - m.box.left), tag + ": an overflowing hand starts at the leading inset " + JSON.stringify(m)).toBeLessThanOrEqual(1)
        }
      }
      await paneTo(page, j, false)
    }

    // ATTACKER: enter a submission from the hand, the way a player does
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural
      return (a._optList || []).map((o: any) => o.node).find((n: any) => n.ty === "submissions")?.t
    })
    expect(sub, "mount top deals a submission to enter").toBeTruthy()
    // rig every draw that can end the exchange early (CLAUDE.md §6.3): the finish below must fail,
    // and the opponent must then go for a submission of their own
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.pick(sub)
    await dealtAfter(page, j, "attacker")
    expect((await measure(page)).escape).toBe(false)
    await check("attacker in " + sub)

    // DEFENDER: the finish fails and the opponent catches you; your escapes are dealt
    await j.pick(sub)
    await j.advanceUntil("caught", 20000)
    await dealtAfter(page, j, "escape")
    await check("defender")

    expect(checked, "all four measurements ran").toBe(4)
    if (width > 390) expect(fits, "a fitting hand was measured at this desktop width, so centring was tested").toBeGreaterThan(0)
  })
}
