import { expect, test, type Page } from "@playwright/test"
import { journey } from "../../e2e/dsl"

/** ESCAPE SEAT PROBE (RED367, movesrow). NOT a gate: evidence for card-click-contract.spec.ts's escape test (1440).
 *  PR #367's shard 1 read the escape card at x 260 and its stand-in at x 236. The stand-in is seated from the card's rect
 *  AT THE PICK (`executionCard`), against the row's left padding, which the app writes in `updateUiShift` from the
 *  reader's `trayFlush` (0 at 1440, else the 24px tray inset); under the harness that write runs only inside
 *  `advance()`, while the reader decides on a real animation frame. PROBE_MODE:
 *    natural     the spec's old steps as they were; logs the padding, `trayFlush` and the reader's pending frame at the
 *                "before" reading and at the pick, and the stand-in's offset from the card
 *    forced-old  the late reader layout FORCED (the row padded as before the reader's first decision, then the decision
 *                made without the app's tick), then the spec's old steps: the offset the race produces
 *    forced-new  the same forced window, then the spec's new steps (settle, one 17 ms tick, settle): its offset
 *  Prints ESCAPE_PROBE <json> per run.
 *    PROBE_MODE=forced-old PROBE_RUNS=5 TMPDIR=/home/user/tmp-pw PW_PORT=<free> PW_TESTDIR=../tests/artifacts \
 *      npx playwright test -c e2e/playwright.private.config.ts _escape_seat_probe */

const RUNS = Number(process.env.PROBE_RUNS || 10), MODE = process.env.PROBE_MODE || "natural"
test.use({ viewport: { width: 1440, height: 900 } })
test.setTimeout(600_000)

const at = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, row = a.optionsRef.current as HTMLElement, r = a._reader
  const t = document.querySelector("[data-cc-target]") as HTMLElement | null
  return { card: t ? Math.round(t.getBoundingClientRect().left * 10) / 10 : null, padL: getComputedStyle(row).paddingLeft,
    trayFlush: r ? r.trayFlush : "no reader", layoutPending: r ? !!r.layoutFrame : null, rowLeft: Math.round(row.getBoundingClientRect().left) }
})

for (let run = 0; run < RUNS; run++) test(`escape seat ${MODE} ${run}`, async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Defender"); await j.advance(4000)
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => !c.opt.threat).length)).toBeGreaterThan(0)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._handTouched = true
    const hit = (a._optionCards || []).find((c: any) => !c.opt.threat && c.card.querySelector(".ngchoice-title").textContent.trim() === "Posture up")
    hit.card.setAttribute("data-cc-target", "1"); hit.card.scrollIntoView({ inline: "nearest", block: "nearest" })
  })
  await expect.poll(() => page.evaluate(() => { const m = getComputedStyle(document.querySelector("[data-cc-target]")!).transform; return m === "none" || m === "matrix(1, 0, 0, 1, 0, 0)" })).toBe(true)
  let forced = null
  if (MODE !== "natural") {
    await j.readerLayoutSettled(); await j.advance(17); await j.readerLayoutSettled()
    const clean = await at(page)
    // the late reader layout: the row padded as before the reader's first decision, then the decision made, no app tick
    await page.evaluate(() => { const a = (window as any).__neural, r = a._reader; r.trayFlush = false; a.updateUiShift(0); r.trayFlush = true })
    forced = { clean, window: await at(page) }
    if (MODE === "forced-new") { await j.readerLayoutSettled(); await j.advance(17); await j.readerLayoutSettled() }
  }
  await j.rig("escape", [0])
  const before = await at(page)
  await page.evaluate(() => {
    const a = (window as any).__neural, row = a.optionsRef.current as HTMLElement, w = window as any
    w.__pick = null
    const f = a.executionCard
    a.executionCard = function (opt: any) {
      const shown = (this._optionCards || []).find((c: any) => c.opt === opt)
      if (shown) w.__pick = { card: Math.round(shown.card.getBoundingClientRect().left * 10) / 10, padL: getComputedStyle(row).paddingLeft, trayFlush: a._reader?.trayFlush }
      return f.apply(this, arguments as any)
    }
  })
  await j.clickByMouse("[data-cc-target] .ngchoice-title", "the escape")
  const stand = await page.evaluate(() => { const e = document.querySelector("[data-executing-tech]") as HTMLElement | null; return e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : null })
  const pick = await page.evaluate(() => (window as any).__pick)
  const padAfter = await page.evaluate(() => getComputedStyle((window as any).__neural.optionsRef.current).paddingLeft)
  console.log("ESCAPE_PROBE " + JSON.stringify({ mode: MODE, run, forced, before, pick, stand, padAfter, off: stand == null || before.card == null ? null : Math.round((stand - before.card) * 10) / 10 }))
})
