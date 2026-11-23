import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * AN APP AND ITS READER LEAVE NOTHING BEHIND (LEAK1, v1.298.1). The reader of PR #456 counted 22 listeners on document and
 * window, the app's and the reader's, growing 1 → 2 → 3 over two remounts (69 → 91 → 113 in all), each keeping a dead app or
 * reader alive with its graph. Since v1.298.1 every page-wide listener of an app goes through `_on` (one AbortController a
 * life, aborted in `componentWillUnmount`) and every one of a reader through its `life` (aborted in `destroy()`), and
 * tests/page_listeners.test.mjs fails on a direct add in instance code. A heap walk then found two more holders, each enough
 * alone to keep a dead app: the reading stylesheet's link (spa-preserve, so it outlives its app; its `onload` kept the app,
 * and every app added another link) and the mount glue's `__ngRefs` (every ref every app made, read by nothing).
 *
 * What is read, by real navigation (Quartz's own router to a page, then Back: each mounts a new app):
 *   - every listener on document and window that our own scripts added (`/static/neural/app/`, told by the script's address
 *     through CDP), keyed by where it was added (target, type, capture, the handler's code place): never two at one place,
 *     and the same places at the end as at the start (a page's own listeners and Quartz's are not ours, and not counted);
 *   - the reading stylesheet's link: one;
 *   - the first app and its reader, held by a WeakRef: gone after a forced collection (CDP `HeapProfiler.collectGarbage`).
 *
 * MUTANTS, each built alone into the served bundle after a neutral control (the table and its date: docs/Changelog-Archive.md,
 * v1.298.1), each RED at the step named:
 *   L1 the app's teardown keeps its listeners (`_life` not aborted)    → at "never two of our listeners at one place"
 *   L2 the reader's destroy keeps its listeners (`life` not aborted)  → at "never two of our listeners at one place"
 *   L3 a link of the reading stylesheet an app                         → at "one link of the reading stylesheet"
 *   L4 the glue keeps every ref (`__ngRefs` back)                      → at "the first app is collected"
 *   L5 the link's `onload` kept (as it was)                            → at "the first app is collected"
 * NOT SEEN HERE: a listener left only in a state this walk does not reach (the local-only bar's `online`, a drag's
 * visibilitychange, a never-fired once): they go through `_on` like the rest, and the unit holds that.
 */

type W = any

test.describe("1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("two remounts leave nothing of the old apps: our listeners stay one a place, one reading link, the first app and its reader collected", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page)
    const urls = new Map<string, string>()
    cdp.on("Debugger.scriptParsed", (e: W) => urls.set(e.scriptId, e.url))
    await cdp.send("Debugger.enable")
    const j = journey(page)
    await j.boot("/Positions/Mount")
    await j.advance(3000)
    const ours = async () => {
      const at = new Map<string, number>()
      for (const target of ["document", "window"]) {
        const { result } = await cdp.send("Runtime.evaluate", { expression: target })
        const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId! })
        for (const l of listeners as W[]) {
          const u = urls.get(l.scriptId) || ""
          if (!/\/static\/neural\/app\//.test(u)) continue
          const k = `${target} ${l.type}${l.useCapture ? " capture" : ""} ${u.replace(/^.*\/app\//, "").replace(/\?.*$/, "")}:${l.lineNumber}:${l.columnNumber}`
          at.set(k, (at.get(k) || 0) + 1)
        }
      }
      return at
    }
    const links = () => page.evaluate(() => document.querySelectorAll('link[href*="/static/neural/app/reading.css"]').length)
    const start = await ours()
    expect(start.size, "premise: our listeners on document and window are read (a count that ran on nothing would read none)").toBeGreaterThanOrEqual(20)
    expect(await page.evaluate(() => !!(window as W).__neural._reader), "premise: the page's reader is up").toBe(true)
    await page.evaluate(() => { const a = (window as W).__neural; (window as W).__lkApp = new WeakRef(a); (window as W).__lkReader = new WeakRef(a._reader) })
    for (const step of ["to a page", "Back"] as const) {
      await page.evaluate(() => { (window as W).__neural.__lkOld = true })
      if (step === "to a page") await page.evaluate(() => (window as W).spaNavigate(new URL("/Positions/Side-Control", location.href)))
      else await page.goBack()
      await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return !!a && !a.__lkOld && !!a.nodes && !!a.cam }), { message: `premise: ${step} mounted a new app`, timeout: 30_000 }).toBe(true)
      await page.evaluate(() => (window as W).__neural.advance(3000))
      const now = await ours()
      expect([...now].filter(([, n]) => n > 1), `${step}: never two of our listeners at one place (L1, L2)`).toEqual([])
    }
    const end = await ours()
    expect([[...start.keys()].filter((k) => !end.has(k)), [...end.keys()].filter((k) => !start.has(k))], "back on the first page: the same places as at the start, none gone, none added").toEqual([[], []])
    const n = await links()
    expect(n, "premise: the reading stylesheet was asked for").toBeGreaterThanOrEqual(1)
    expect(n, "one link of the reading stylesheet, whatever the number of apps (L3)").toBe(1)
    for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage")
    expect(await page.evaluate(() => [!!(window as W).__lkApp.deref(), !!(window as W).__lkReader.deref()]), "the first app is collected, and its reader (L4, L5)").toEqual([false, false])
  })
})
