/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"defense-panic","B":"economy-math"} @invariant "escapeChance carries momentumMod exactly like moveChance does: with the same live defense, toggling _combo 0→5 raises the displayed escape odds by exactly +10 points (inside the [8,92] clamp) — momentum defends as it attacks." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * MOMENTUM DEFENDS AS IT ATTACKS — the v1.70.0 combo meter's +2.5%/tier bonus (cap +10%
 * at ×5, `momentumMod`) is added inside `escapeChance`'s [0.08, 0.92] clamp exactly as it
 * is inside `moveChance`'s [0.05, 0.95] one (neural/src/app.src.jsx — cited by symbol; the
 * line numbers this header used to carry had drifted by ~10,000 lines). This journey pins
 * the defense half: same live defense, same escape option, _combo 0 vs 5 must differ by
 * exactly +0.10 of escapeChance and +10 displayed points, and `refreshEscapeOdds` (which
 * renders through `choiceChance` → `escapeChance`) must re-render every escape card's
 * .ngodds to Math.round(escapeChance*100)+"%" in lockstep — hot AND after cooling back down.
 *
 * HOW THE CATCH IS REACHED (re-targeted 2026-10-01, gen-suite triage): since v1.176.0
 * (cdc35cefe, "Give submission states their own choices") picking a SUBMISSION card only
 * ENTERS its state — deterministic travel, no resolve draw, so nothing fails and the
 * opponent never moves. The rigged failure now lands on the state's "Finish" card, the
 * second pick of the same title, exactly as the core journeys restart-hygiene /
 * panic-drill-defender-deck do. Mount Top's EDGE-ranked hand leads with a submission today
 * (Americana from Mount); a transition at [0] fails on its first pick, so both are handled.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; resolve 0.99 > the 0.95
 * moveChance ceiling (the Finish always fails), outcome 0.99 draws the LAST cell of the
 * failure branch (the counter → closed-guard/bottom; v1.121.0 draws inside the branch),
 * opp-finish 0.01 < the 0.18 pFinish floor (the opponent always hunts the sub),
 * opp-sub-pick 0.01 pins which one (measured: Ezekiel Choke from Closed Guard). All 1-deep
 * queues, all consumed by the catch. The measurement passes only two 100 ms frame steps of sim
 * time (the card repaints one frame after the change since v1.207.0 — see the measurement). Since
 * v1.133.0 the escapes are untimed anyway — only the panic DRILL carries a question clock, and
 * nothing here reads it.
 *
 * Probe facts leaned on:
 *   - _combo is reliably 0 at the catch: a fresh match starts cold and nothing here answers
 *     a question. (It used to be "the ignored landing question breaks it"; since v1.133.0
 *     committing past an open question is a FREE SKIP — `land_q_ignored` fires, momentum is
 *     untouched — so 0 now means "never earned", which is still asserted.)
 *   - the measurement targets _optList[0] only — the same entry escapeOddsSnapshot reads —
 *     and never asserts distinctness across cards.
 *   - escape cards are registered in `_optionCards` like every dealt card, so the card is
 *     found by the OPTION's identity, (_optionCards||[]).find(c => c.opt === opt), never by
 *     [data-tech] title text. (It used to match `c.node === opt.node`; since v1.176.0 every
 *     escape from one submission carries the SAME node — the defender member — so node
 *     identity can no longer tell escape cards apart, and the option object is the key.)
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
  const firstIsSub = await page.evaluate(
    (t) => ((window as any).__neural.nodes.find((n: any) => n.t === t) || {}).ty === "submissions",
    options[0],
  )
  await j.pick(options[0])
  if (firstIsSub) {
    // v1.176.0: the first pick ENTERS the submission state; the rigged fail is its Finish
    await j.advance(3000)
    await j.pick(options[0])
  }
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
  // THE CARD REPAINTS ON THE NEXT FRAME since v1.207.0 (83908ffce, PR #231, "Win chance is the one
  // number on the card"). A player's own escape card no longer has its .ngodds written by
  // refreshEscapeOdds (which now repaints THREAT cards only): its corner number is the stamped
  // choice view's `immediateExecutionChance`, re-captured from the live escapeChance after the
  // `_gameValueChanged("escape-odds")` that refreshEscapeOdds emits, and painted on the next frame.
  // Read in the same synchronous turn, the card still showed the COLD stamp (44% for a 54% hot
  // chance — the red this spec carried after the merge). So each toggle pumps one short frame step
  // before the card is read; the claim — the card renders Math.round(escapeChance*100)+"%", hot
  // and cold, exactly +10 points apart — is unchanged. ~0.2 s of sim time passes, far inside the
  // defense window.
  const m0 = await page.evaluate(() => {
    const a = (window as any).__neural
    const opt = a._optList[0]
    const comboAtCatch = a._combo || 0

    a._combo = 0
    const modCold = a.momentumMod()
    const cold = a.escapeChance(opt)

    a._combo = 5
    const modHot = a.momentumMod()
    const hot = a.escapeChance(opt)
    a.refreshEscapeOdds() // hot: emits the change the choice view re-captures on the next frame
    return { comboAtCatch, modCold, modHot, cold, hot }
  })
  const readCard = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      const oc = (a._optionCards || []).find((c: any) => c.opt === a._optList[0])
      return oc ? (oc.card.querySelector(".ngodds")?.textContent || "").trim() : null
    })
  await j.advance(100)
  const hotDom = await readCard()
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._combo = 0
    a.refreshEscapeOdds() // cool back down — leave the app in the found state
  })
  await j.advance(100)
  const coldDom = await readCard()
  const snapshotRestored = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  const m = { ...m0, hotDom, coldDom, snapshotRestored }

  // combo state at the catch: a fresh match, nothing answered — cold (skipping is free since v1.133.0)
  expect(m.comboAtCatch, "momentum is cold at the catch — nothing was earned this match").toBe(0)

  // the shared modifier both moveChance and escapeChance consume
  expect(m.modCold, "momentumMod is 0 at _combo=0").toBe(0)
  expect(m.modHot, "momentumMod caps at +0.10 at _combo=5").toBeCloseTo(0.1, 6)

  // THE INVARIANT: same defense, same option — the full momentum cap lands in escapeChance
  expect(m.hot - m.cold, "escapeChance heats by exactly the +0.10 momentum cap").toBeCloseTo(0.1, 6)
  expect(m.cold, "cold chance inside the clamp").toBeGreaterThan(0.08)
  expect(m.hot, "hot chance inside the clamp").toBeLessThan(0.92)
  expect(Math.round(m.cold * 100), "snapshot == rounded escapeChance of _optList[0]").toBe(cold0)

  // displayed points: exactly +10, and the card's .ngodds is Math.round(escapeChance*100)+"%"
  // in BOTH directions of the toggle (since v1.207.0 the stamped choice view repaints it, one frame on)
  expect(m.hotDom, "hot card renders the rounded hot chance").toBe(`${Math.round(m.hot * 100)}%`)
  expect(m.coldDom, "cooled card renders the rounded cold chance again").toBe(`${Math.round(m.cold * 100)}%`)
  expect(parseInt(m.hotDom!) - parseInt(m.coldDom!), "displayed escape odds rose by exactly +10 points").toBe(10)

  // restoration proof: the probe leaves the app exactly as it found it
  expect(m.snapshotRestored, "escape odds snapshot back at the found value").toBe(cold0)
})
