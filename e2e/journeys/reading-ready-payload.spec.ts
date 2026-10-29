import { test, expect } from "@playwright/test"
import { gzipSync } from "node:zlib"

/** Reading arrives with dormant controls. This separate observation counts every localhost
 * response requested through complete article readiness, including the full HTML
 * documents, bridge, renderer and stylesheet. No payload budget or baseline is
 * changed or inferred from the result. Third parties are blocked, as in the game
 * first-hand gate. It exercises real boot and delivery, without the gameplay DSL.
 */
test("@curated reading-ready payload counts delivery with dormant controls", async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.addInitScript(() => {
    // D-338 retired Focus: the quiet article view is seeded through the game layers it overrode.
    const blob = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {}, updatedAt: 1 }
    localStorage.setItem("bjj-neural-owner:guest:progress", JSON.stringify({ format: "bjj-progress-owner-v1", owner: { kind: "guest" }, blob, savedAt: 1 }))
    performance.setResourceTimingBufferSize(4000)
    new MutationObserver((_, observer) => {
      if (!document.querySelector('[data-reader-ready="true"]')) return
      ;(window as any).__readingReadyAt = performance.now()
      observer.disconnect()
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-reader-ready"] })
  })
  await page.route("**/*", route => {
    const url = route.request().url()
    if (/^(http:\/\/(localhost|127\.)|data:|blob:|about:)/.test(url)) return route.continue()
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ contentType: "text/css", body: "" })
    return route.abort()
  })
  const requested = new Set<string>()
  const bodies: Promise<{ url: string, raw: number, gzip: number, status: number, method: string } | null>[] = []
  let noticed = false
  page.on("request", request => { if (!noticed && /^http:\/\/(localhost|127\.)/.test(request.url())) requested.add(request.url()) })
  page.on("response", response => {
    if (!/^http:\/\/(localhost|127\.)/.test(response.url())) return
    const method = response.request().method()
    // The local-only snapshot probe is HEAD: HTTP sends no body. Record it,
    // including its 404 on this static server, instead of silently dropping it.
    if (method === "HEAD") {
      bodies.push(Promise.resolve({ url: response.url(), raw: 0, gzip: 0, status: response.status(), method }))
      return
    }
    bodies.push(response.body().then(body => ({ url: response.url(), raw: body.length,
      gzip: gzipSync(body, { level: 9 }).length, status: response.status(), method })).catch(() => null))
  })
  await page.goto("/Transitions/Knee-Slice-Pass", { waitUntil: "commit" })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 60000 })
  noticed = true
  await page.waitForTimeout(500)
  const measured = await page.evaluate(() => {
    const a = (window as any).__neural
    return { readyAt: (window as any).__readingReadyAt as number,
      starts: performance.getEntriesByType("resource").map(e => [e.name, e.startTime] as const),
      hand: document.querySelectorAll("[data-tech]").length, current: a.currentPos ?? null, played: !!a._played, staged: !!a._staged,
      question: !!a._landQ, intent: !!a._readerIntent, paused: a.paused, clock: a._decision?.remaining ?? null }
  })
  expect(measured.readyAt).toBeGreaterThan(0)
  expect(measured).toMatchObject({ played: false, intent: true, paused: true, clock: null })
  for (const [url, start] of measured.starts) if (start > measured.readyAt) requested.delete(url)
  const byUrl = new Map((await Promise.all(bodies)).filter(row => row && requested.has(row.url)).map(row => [row!.url, row!]))
  expect([...requested].filter(url => !byUrl.has(url)), "no requested response is scored as free").toEqual([])
  const rows = [...byUrl.values()].map(row => ({ ...row, url: new URL(row.url).pathname })).sort((a, b) => b.gzip - a.gzip)
  expect(rows.filter(row => row.status < 200 || row.status >= 400)).toEqual([
    { url: "/__snapshot/ping", raw: 0, gzip: 0, status: 404, method: "HEAD" },
  ])
  for (const path of ["/static/neural/app/reader.js", "/static/neural/app/reading.css", "/Transitions/Knee-Slice-Pass", "/Transitions/Knee-Slice-Pass/Attacker"]) {
    expect(rows.some(row => row.url === path), `delivery includes ${path}`).toBe(true)
  }
  const report = { note: "Observed reading-ready delivery; dormant controls and no threshold change.",
    reading_ready_ms: measured.readyAt, request_count: rows.length,
    reading_ready_raw_bytes: rows.reduce((sum, row) => sum + row.raw, 0),
    reading_ready_gzip_bytes: rows.reduce((sum, row) => sum + row.gzip, 0), rows }
  await info.attach("reading-ready-payload.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" })
  console.log("[reading-ready] " + JSON.stringify(report))
})
