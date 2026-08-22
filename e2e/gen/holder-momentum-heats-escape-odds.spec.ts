/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"defense-panic","B":"economy-math"} @invariant "escapeChance carries momentumMod exactly like moveChance does: with the same live defense, toggling _combo 0→5 raises the displayed escape odds by exactly +10 points (inside the [8,92] clamp) — momentum defends as it attacks." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * MOMENTUM DEFENDS AS IT ATTACKS — the v1.70.0 combo meter's +2.5%/tier bonus (cap +10%
 * at ×5, momentumMod, app.src.jsx:4331) is added inside escapeChance's [0.08, 0.92] clamp
 * (app.src.jsx:4421) exactly as it is inside moveChance's [0.05, 0.95] one (:4946). This
 * journey pins the defense half: same live defense, same escape option, _combo 0 vs 5 must
 * differ by exactly +0.10 of escapeChance and +10 displayed points, and refreshEscapeOdds
 * (:4428) must re-render every escape card's .ngodds to Math.round(escapeChance*100)+"%"
 * in lockstep — hot AND after cooling back down.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; resolve 0.99 > the 0.95
 * moveChance ceiling (our move always fails), opp-finish 0.01 < the pFinish floor (the
 * opponent always hunts the sub), opp-sub-pick 0.01 pins which one. All 1-deep queues —
 * the journey ends inside the defense window. The measurement itself is evaluate-only:
 * no sim time passes in testMode, so the 4-9s defense clock never moves under it.
 *
 * Probe facts leaned on:
 *   - _combo is reliably 0 at the catch: picking past the unanswered landing question
 *     breaks momentum with reason "ignored" (:4912) — no pre-clear needed, but asserted.
 *   - all four Mount-Top escapes had identical cold odds (myVal diffs matched), so the
 *     measurement targets _optList[0] only — the same entry escapeOddsSnapshot reads —
 *     and never asserts distinctness across cards.
 *   - escape cards share the tray builder (buildOptionCard mode "escape"), so the card
 *     is found via (_optionCards||[]).find(c => c.node === opt.node), never [data-tech]
 *     title text (content waves rewrite titles; the node identity is structural).
 *   - _combo is restored to 0 + refreshEscapeOdds re-run at the end, so the DOM leaves
 *     the journey exactly as the catch left it.
 */

test("caught: _combo 0→5 heats the live escape's odds by exactly +0.10, cards render it, and cooling restores the found state", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // ── get CAUGHT deterministically: our move fails, the opponent goes for the finish ──
  const options = await j.optionTitles()
  expect(options.length, "a hand of options was dealt").toBeGreaterThan(0)
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)

  // beat spine in order: our failure → the catch → the panic surface
  const bs = (await j.beats()).map((b: any) => b.beat)
  const iFail = bs.indexOf("impact_fail")
  const iCaught = bs.indexOf("caught")
  const iPanic = bs.indexOf("panic_drill_opened")
  expect(iFail, "our rigged move failed").toBeGreaterThanOrEqual(0)
  expect(iCaught, "opponent caught a submission after the failure").toBeGreaterThan(iFail)
  expect(iPanic, "panic drill opened on the catch").toBeGreaterThan(iCaught)
  await expect(page.locator("[data-panic]"), "inline panic drill visible while caught").toBeVisible()

  // ── mid-band precondition: the cold snapshot must leave +10 points of headroom on BOTH
  // sides of the [8,92] clamp, or the "exactly +0.10" arithmetic stops being a fair test
  // (probe observed 22 cold / 32 hot). Snapshot > 0 also proves the defense is live. ──
  const cold0: number = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  expect(cold0, "cold escape odds clear of the 8% floor with +10 headroom").toBeGreaterThan(9)
  expect(cold0, "cold escape odds leave +10 headroom under the 92% ceiling").toBeLessThan(81)

  // ── the core measurement: one live defense, one escape option, two combo states.
  // Evaluate-only — no advance() calls, so no decision-clock pressure. ──
  const m = await page.evaluate(() => {
    const a = (window as any).__neural
    const opt = a._optList[0]
    const comboAtCatch = a._combo || 0

    a._combo = 0
    const modCold = a.momentumMod()
    const cold = a.escapeChance(opt)

    a._combo = 5
    const modHot = a.momentumMod()
    const hot = a.escapeChance(opt)
    a.refreshEscapeOdds() // hot re-render of every escape card's .ngodds
    const oc = (a._optionCards || []).find((c: any) => c.node === opt.node)
    const hotDom = oc ? (oc.card.querySelector(".ngodds")?.textContent || "").trim() : null

    a._combo = 0
    a.refreshEscapeOdds() // cool back down — leave the DOM in the found state
    const coldDom = oc ? (oc.card.querySelector(".ngodds")?.textContent || "").trim() : null
    const snapshotRestored = a.escapeOddsSnapshot()

    return { comboAtCatch, modCold, modHot, cold, hot, hotDom, coldDom, snapshotRestored }
  })

  // combo state at the catch: walking past the unanswered landing question broke it ("ignored")
  expect(m.comboAtCatch, "momentum is cold at the catch — the ignored landing question broke it").toBe(0)

  // the shared modifier both moveChance and escapeChance consume
  expect(m.modCold, "momentumMod is 0 at _combo=0").toBe(0)
  expect(m.modHot, "momentumMod caps at +0.10 at _combo=5").toBeCloseTo(0.1, 6)

  // THE INVARIANT: same defense, same option — the full momentum cap lands in escapeChance
  expect(m.hot - m.cold, "escapeChance heats by exactly the +0.10 momentum cap").toBeCloseTo(0.1, 6)
  expect(m.cold, "cold chance inside the clamp").toBeGreaterThan(0.08)
  expect(m.hot, "hot chance inside the clamp").toBeLessThan(0.92)
  expect(Math.round(m.cold * 100), "snapshot == rounded escapeChance of _optList[0]").toBe(cold0)

  // displayed points: exactly +10, and the card's .ngodds is Math.round(escapeChance*100)+"%"
  // in BOTH directions of the toggle (refreshEscapeOdds is the single re-render seam)
  expect(m.hotDom, "hot card renders the rounded hot chance").toBe(`${Math.round(m.hot * 100)}%`)
  expect(m.coldDom, "cooled card renders the rounded cold chance again").toBe(`${Math.round(m.cold * 100)}%`)
  expect(parseInt(m.hotDom!) - parseInt(m.coldDom!), "displayed escape odds rose by exactly +10 points").toBe(10)

  // restoration proof: the probe leaves the app exactly as it found it
  expect(m.snapshotRestored, "escape odds snapshot back at the found value").toBe(cold0)
})
