import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

// A NODE WHOSE ID CARRIES "%" (v1.212.6, OCURL1). `Transitions/100%-Sweep` is built at
// /Transitions/100-percent-Sweep (Quartz writes "%" as "-percent"). The app used to push the raw
// id, and once that raw "%" sat in the address, `_pushUrl`'s decodeURI threw on every later push
// inside a silent catch. So the address bar froze on 100% Sweep for the rest of the session. This
// journey arrives on the real page, opens other nodes, opens 100% Sweep again, and asserts the
// address follows every time, with no `url_fault` beat. tests/url_sync.test.mjs sweeps every node
// and covers a raw "%" already in the address; the harness serves only built pages, so that case
// lives in the unit file.
// MUTANT: _pageSlug as the identity sends the address to /Transitions/100%-Sweep, red here.
test("100% Sweep: arrive on its page, leave it, come back, leave again — the address follows", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Transitions/100-percent-Sweep")
  await j.advance(6500)
  const at = () => page.evaluate(() => decodeURIComponent(location.pathname))
  const seeded = await page.evaluate(() => {
    const a = (window as any).__neural
    return { focus: a.nodes[a.focusIdx] && a.nodes[a.focusIdx].t }
  })
  expect(seeded.focus, "the real page seeds its node").toBe("100% Sweep")
  expect(await at()).toBe("/Transitions/100-percent-Sweep")
  const open = async (t: string) => {
    await page.evaluate((t) => { const a = (window as any).__neural; a.openDossier(a.nodes.find((n: any) => n.t === t && n.rep).idx) }, t)
    await j.advance(3000)
  }
  await open("Knee Slice Pass")
  expect(await at(), "leaving it moves the address").toBe("/Transitions/Knee-Slice-Pass")
  await open("100% Sweep")
  expect(await at(), "coming back names its page, not its raw id").toBe("/Transitions/100-percent-Sweep")
  await open("Fireman's Carry")
  expect(await at(), "and the next push still lands (no freeze)").toBe("/Transitions/Fireman's-Carry")
  const faults = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "url_fault").length)
  expect(faults, "no URL fault along the way").toBe(0)
})
