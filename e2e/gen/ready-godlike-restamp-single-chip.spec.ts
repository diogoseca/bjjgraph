/* @hyperspace {"theme":"momentum-and-economy","L":"belt-ready","F":"graph-canvas","B":"idempotence"} @invariant "The heat HUD is one element re-stamped, never a stack: climbing ×5→×8 re-stamps the SAME single [data-momentum] chip (count stays 1, attribute tracking _combo) and each announcer pop replaces its predecessor so [data-combo-pop] never exceeds 1 concurrently after each answer settles." */
import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady } from "./personas"

/**
 * ONE CHIP, RE-STAMPED — the momentum HUD is idempotent under the climb.
 *
 * A belt-ready player rides a perfect streak from ×1 all the way to ×8 (GODLIKE ×8). Eight
 * climbs means eight chances for a naive HUD to APPEND a fresh chip or stack announcer pops;
 * the app's contract is the opposite, and this spec pins it structurally at every rung:
 *
 *   - _updateComboChip (app.src.jsx :4370) creates this._comboChip ONCE at n>=2 and thereafter
 *     only sets data-momentum/data-heat + innerHTML on that same node — identity-stable.
 *     Below ×2 there is NO chip at all (the n<2 branch removes it).
 *   - _comboPop (:4355) synchronously removes _comboPopEl before appending the new pop, so
 *     [data-combo-pop] can never exceed 1 at any instant; each pop self-removes via
 *     after(n>=5 ? 1.7 : 1.2) — pop presence is SIM-TIME-scoped: ===1 inside the settle
 *     window right after an answer, <=1 anywhere else (hops pump seconds, expiring it).
 *   - past ×6 the name ladder degenerates to GODLIKE re-stamps (comboName :4330):
 *     n=7 -> comboName(7), n=8 -> comboName(8), and comboName(8) contains comboName(7) as a
 *     prefix (the ×8 suffix is appended) — asserted against the app's OWN comboName, never a
 *     hardcoded string.
 *
 * Determinism (probe 3x green 14.4s/14.9s/16.7s, then deleted): beltReady()'s stage map is
 * EMPTY, so questionFor (cardStage < 2) asks on every deck — the probe reached ×8 in 8
 * straight question-bearing landings from Mount Top with zero carries on this route. Answers
 * go through the real keyboard (A/B/C/D); truth is read from this._mc gated on
 * _landPending && [data-land-q] (the reliable ask-detector — a stale _mc survives an answered
 * block). Hops ride the first transition option with resolve/outcome rigged [0.01]
 * (transitions never hit game-over, so the roll — and per-roll momentum — survives all
 * seven legs). The landing MC draws only its surface-scoped land-mc-pick/land-mc-shuffle
 * tags, pre-rigged DEEP so no draw ever falls through to wall randomness. The carry branch
 * (a silent landing) is tolerated structurally but was never needed in any probe run.
 */

const PICKQ = Array.from({ length: 200 }, (_, i) => ((i * 37 + 11) % 97) / 97)
const SHUFQ = Array.from({ length: 60 }, (_, i) => ((i * 53 + 7) % 89) / 89)

/** One-evaluate census of the whole HUD: counts, attributes, node identity, live combo. */
const census = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const chips = document.querySelectorAll("[data-momentum]")
    const pops = document.querySelectorAll("[data-combo-pop]")
    const chip = chips[0] || null
    const pop = pops[0] || null
    return {
      combo: a._combo || 0,
      chips: chips.length,
      chipAttr: chip ? chip.getAttribute("data-momentum") : null,
      chipHeat: chip ? chip.getAttribute("data-heat") : null,
      // identity: the DOM's only chip IS the app's tracked _comboChip AND the node captured at ×2
      chipIsTracked: !!(chip && a._comboChip === chip),
      chipIsSameNode: !!(chip && (window as any).__probeChip === chip),
      pops: pops.length,
      popAttr: pop ? pop.getAttribute("data-combo-pop") : null,
      popHeat: pop ? pop.getAttribute("data-heat") : null,
    }
  })

test("×1→×8 perfect streak: one identity-stable chip re-stamped per climb, pops replace (never stack), GODLIKE re-stamps, chip outlives the last pop", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // belt-ready: prep/rec seeded across every white deck but stage:{} is EMPTY — every landing
  // deck still holds an unproven card, so the question-first landing asks at every arrival.
  await j.boot("/", { initialState: beltReady() })
  await j.rig("land-mc-pick", PICKQ)
  await j.rig("land-mc-shuffle", SHUFQ)
  await j.land("Mount Top")

  // answer the live landing question correctly via the keyboard. Ask-detector is
  // _landPending && [data-land-q] — _mc itself lingers after an answered block.
  const answerLanding = async (): Promise<boolean> => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending &&
        document.querySelector("[data-land-q]") &&
        m &&
        m.surface === "land" &&
        typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    if (!mc) return false // silent landing: the streak carries, nothing to answer
    await page.keyboard.press("abcd"[mc.correct])
    const pending = await page.evaluate(() => !!(window as any).__neural._landPending)
    expect(pending, "answer registered — nothing left on the table for the next pick to ignore").toBe(false)
    return true
  }

  // rigged-successful hop on the first transition option (never game-over → the roll survives)
  const hop = async () => {
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const idx = typeof o === "number" ? o : o.idx
        if (a.nodes[idx] && a.nodes[idx].ty === "transitions") return a.nodes[idx].t
      }
      return null
    })
    expect(t, "a transition option in the tray to hop on").toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(t as string)
    await j.nextHand(30000)
  }

  // ── the climb: 8 correct answers, per-rung HUD census after each settles ──
  let n = 0 // == _combo on this route (no breaks: every asked question is answered right)
  for (let arrival = 1; arrival <= 12 && n < 8; arrival++) {
    if (arrival > 1) {
      await hop()
      // between climbs the pop window has been pumped past expiry — <=1 everywhere else,
      // and the chip (from ×2 on) rides the hop untouched: same count, same stamp, same node
      const h = await census(page)
      expect(h.pops, `hop to arrival ${arrival}: pops never exceed 1 outside the settle window`).toBeLessThanOrEqual(1)
      expect(h.combo, `hop to arrival ${arrival}: the streak carried at ×${n}`).toBe(n)
      expect(h.chips, `hop to arrival ${arrival}: chip count unchanged by travel`).toBe(n >= 2 ? 1 : 0)
      if (n >= 2) {
        expect(h.chipAttr, `hop to arrival ${arrival}: chip still stamped ×${n}`).toBe(String(n))
        expect(h.chipIsSameNode, `hop to arrival ${arrival}: still the ×2 node — travel re-stamps nothing`).toBe(true)
      }
    }
    if (!(await answerLanding())) continue // probe: never taken on this route — carry & go around
    n++
    await j.advance(250) // settle inside the pop's 1.2/1.7s sim window
    if (n === 2) {
      // capture the chip's identity the moment it is BORN — every later rung must be this node
      await page.evaluate(() => {
        ;(window as any).__probeChip = document.querySelector("[data-momentum]")
      })
    }
    const c = await census(page)
    expect(c.combo, `rung ×${n}: _combo climbed`).toBe(n)
    if (n < 2) {
      // the silent tier: NO chip, NO announcer below ×2
      expect(c.chips, "×1: chip absent below ×2 (the n<2 branch keeps the DOM empty)").toBe(0)
      expect(c.pops, "×1: no announcer pop at the silent tier").toBe(0)
    } else {
      expect(c.chips, `rung ×${n}: exactly ONE [data-momentum] in the document — never a stack`).toBe(1)
      expect(c.chipAttr, `rung ×${n}: the single chip's attribute tracks _combo`).toBe(String(n))
      expect(c.chipHeat, `rung ×${n}: chip heat = min(5, n-1)`).toBe(String(Math.min(5, n - 1)))
      expect(c.chipIsTracked, `rung ×${n}: the DOM's only chip IS the app's _comboChip`).toBe(true)
      expect(c.chipIsSameNode, `rung ×${n}: the SAME node captured at ×2 — re-stamped, not replaced`).toBe(true)
      expect(c.pops, `rung ×${n}: exactly one pop inside its settle window`).toBe(1)
      expect(c.popAttr, `rung ×${n}: the pop is the NEWEST n — its predecessor was replaced`).toBe(String(n))
      expect(c.popHeat, `rung ×${n}: pop heat = min(5, n-1)`).toBe(String(Math.min(5, n - 1)))
    }
  }
  expect(n, "×8 reached — 8 question-bearing landings answered right").toBe(8)

  // ── the GODLIKE re-stamp, against the app's OWN name ladder (structure, not prose) ──
  const beats = (await j.beats()) as Array<{ beat: string; n?: number; name?: string }>
  expect(
    beats.filter((b) => b.beat === "combo_break").length,
    "a perfect streak: zero combo_break end to end",
  ).toBe(0)
  const combos = beats.filter((b) => b.beat === "combo")
  expect(combos.map((b) => b.n), "one combo beat per rung ×2..×8 (×1 is the silent tier)").toEqual([2, 3, 4, 5, 6, 7, 8])
  expect(
    beats.filter((b) => b.beat === "combo_big").map((b) => b.n),
    "the loud patch fires from ×5 up",
  ).toEqual([5, 6, 7, 8])
  const ladder = await page.evaluate(() => {
    const a = (window as any).__neural
    return [2, 3, 4, 5, 6, 7, 8].map((k) => a.comboName(k))
  })
  expect(combos.map((b) => b.name), "every beat's name is the app's own comboName(n)").toEqual(ladder)
  const name7 = combos.find((b) => b.n === 7)!.name as string
  const name8 = combos.find((b) => b.n === 8)!.name as string
  expect(name8, "×8 is not a frozen ×7 name — GODLIKE re-stamps with its count").not.toBe(name7)
  expect(name8.includes(name7), "structurally, comboName(8) is comboName(7) plus the ×8 suffix").toBe(true)

  // ── the last pop dies alone; the chip persists, still the one born at ×2 ──
  await j.advance(2500) // past the ×8 pop's 1.7s sim window
  const end = await census(page)
  expect(end.pops, "the ×8 pop expired under sim time — zero pops left").toBe(0)
  expect(end.chips, "the chip persists alone at count 1").toBe(1)
  expect(end.chipAttr, "still stamped ×8").toBe("8")
  expect(end.chipIsSameNode, "and it is STILL the ×2 node — one element for the whole climb").toBe(true)
  expect(end.combo, "the meter itself unmoved by the pop's expiry").toBe(8)

  expect(errors, "zero pageerror across the whole ×1→×8 climb").toEqual([])
})
