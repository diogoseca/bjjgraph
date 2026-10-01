import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

// EVERY OPENED SEAT CARRIES ITS STAR (v1.212.3, OCSTAR1).
// The seat star is drawn beside the FOCUSED label, so a seat that loses its focus loses its star.
// Opening a transition authored from a control alias put you inside that submission. On the seat
// that DEFENDS it, the landing went straight into the rush: the focus moved to the submission and
// the star vanished. On dev a7bc58ce4 that was 73 of the 204 alias-origin seats in gi, the
// browser half of tests/seat_staging.test.mjs's 74 (the 74th kept its star only because the defense
// frame happened to draw its label).
// This journey opens EVERY such seat (derived in-page from the data: a transition whose origin
// canonicalises to a submission, on the seat that is that submission's defender) plus a 40-seat
// control sample, and asserts focus, URL and a visible star on each. The unit file covers every
// seat of every technique in both rulesets for focus, URL and clock. This file covers the RENDER,
// in gi on desktop. NOT covered: no-gi and phone (both measured identical in the OCSTAR1
// diagnostic; seat-star.spec.ts holds the phone placement).
// It also runs COLD: the first catch seat opened per alias submission waits for that submission's
// choices, which is the second cause (the wait used to drop the staged exchange; 12 seats red here
// until it carried it).
// MUTANTS: enterLand without the staged-transition guard turns every catch seat here red; the wait
// without restoring _stagedTech turns the 12 first-openings red.
test.setTimeout(900_000)
test("every catch seat and a control sample, opened, keep focus, URL and their seat star", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Mount/Top")
  await j.advance(6500)
  const seats = await page.evaluate(() => {
    const a = (window as any).__neural
    const out: any[] = []
    const techs = a.nodes.filter((n: any) => n.ty !== "positions" && n.rep && a.rsAllows(n))
    for (const n of techs) for (const idx of [n.idx, n.pi]) {
      if (n.ty !== "transitions") continue
      const o = a.techniqueOrigin(a.nodes[idx]); if (o.idx < 0) continue
      const pos = a.nodes[a.canonicalState(o.idx, o.role)]
      const sub = pos && pos.ty === "submissions" ? a.submissionNode(pos) : null
      if (sub && o.role !== sub.fromRole) out.push({ idx, t: n.t, kind: "catch" })
    }
    const rest = techs.filter((n: any) => !out.some((s) => s.t === n.t))
    const step = Math.max(1, Math.floor(rest.length / 20))
    for (let i = 0; i < rest.length && out.filter((s) => s.kind === "control").length < 40; i += step)
      out.push({ idx: rest[i].idx, t: rest[i].t, kind: "control" },
        // a submission's escaping seat starts its rush at once (owner, v1.134.0): the clock is not held there
        { idx: rest[i].pi, t: rest[i].t, kind: "control", rush: rest[i].ty === "submissions" })
    return out
  })
  const catches = seats.filter((s: any) => s.kind === "catch").length
  expect(catches, "the catch population this journey exists for").toBeGreaterThanOrEqual(60)
  const bad: string[] = []
  for (const s of seats) {
    await page.mouse.move(2, 2)
    await page.evaluate((idx) => {
      const a = (window as any).__neural
      ;(document.activeElement as HTMLElement)?.blur()
      a._hover = null
      a.openDossier(idx)
    }, s.idx)
    await j.advance(6500)
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(600)
    const r = await page.evaluate((idx) => {
      const a = (window as any).__neural
      const b = document.querySelector(`[data-seat-star="${idx}"]`) as HTMLElement | null
      const box = b && b.getBoundingClientRect()
      return { focus: a.focusIdx === idx, paused: !!a.paused, star: !!(box && box.width > 0 && box.height > 0),
        url: decodeURIComponent(location.pathname).replace(/^\//, "") === a.nodes[idx].id }
    }, s.idx)
    if (!(r.focus && r.star && r.url && (r.paused || s.rush))) bad.push(`${s.kind} ${s.t} [${s.idx}] ${JSON.stringify(r)}`)
  }
  expect(bad, `${bad.length} of ${seats.length} opened seats lost focus, URL, clock or star`).toEqual([])
})
