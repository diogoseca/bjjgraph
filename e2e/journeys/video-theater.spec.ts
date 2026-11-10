import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

// VIDEO1: native input through the published technique's own card. Only the
// provider transport is hermetic: its API still loads on click, replaces its
// host with a cross-origin iframe and reports ready asynchronously. Playback
// assertions prove our autoplay request, not YouTube's service availability.
// Source mutants and exact named assertions: tests/artifacts/video_theater_mutants.json.
// Browser boundary, measured with the cross-origin fixture: Escape pressed inside
// the provider does not reach the parent dialog. The native Shift+Tab -> Close ->
// Escape path below is covered; direct provider-key dismissal is not claimed.
// Recorded non-kill: _readOwnScroll's theater guard. Its wheel path needs _readMax, which is
// 0 in the book view and in the map view (measured with a revealed card at 390x631), because
// the reader has adopted the card. It can only matter before the deferred reader adopts it,
// a window no journey here holds open, so no spec can turn a mutant of that line red.
const PATH = "/Transitions/Knee-Slice-Pass/Attacker"
const FILM = "[data-land-film]:not([data-reference-film])"
const PLAY = FILM + " [data-film-play]"
const THEATER = ".ng-video-theater"
const api = `window.__players=[]; window.YT={Player:function(host,opts){
  const f=document.createElement('iframe'), r={vars:opts.playerVars,play:0,destroy:0};
  window.__players.push(r); f.src='https://www.youtube.com/embed/'+opts.videoId;
  this.getIframe=()=>f; this.playVideo=()=>{r.play++}; this.pauseVideo=()=>{};
  this.destroy=()=>{r.destroy++; f.remove()}; f.onload=()=>opts.events.onReady({target:this});
  host.replaceWith(f);
}}; window.onYouTubeIframeAPIReady();`

async function boot(page: Page, vertical = false, enforceCsp = false, opts: { keepTutorial?: boolean, blockApi?: () => boolean } = {}) {
  const j = journey(page)
  await j.boot(PATH, { keepTutorial: !!opts.keepTutorial, beforeNavigate: async p => {
    if (enforceCsp) {
      const policy = readFileSync(resolve(__dirname, "../../source/public/_headers"), "utf8").match(/^\s*Content-Security-Policy-Report-Only:\s*(.+)$/m)![1]
      await p.route(url => url.pathname === PATH, async route => {
        const response = await route.fetch()
        await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": policy } })
      })
      await p.addInitScript(() => {
        (window as any).__videoCsp = []
        document.addEventListener("securitypolicyviolation", e => {
          if (/youtube|ytimg/.test(e.blockedURI)) (window as any).__videoCsp.push(e.violatedDirective + ":" + e.blockedURI)
        })
      })
    }
    await p.route("**/static/neural/content/*.json", async route => {
      if (!vertical) return route.continue()
      const response = await route.fetch(), data = await response.json()
      for (const d of Object.values(data) as any[]) {
        for (const block of [d, ...Object.values(d.perspectives || {})] as any[])
          for (const clip of block.clips || []) clip.vertical = true
      }
      await route.fulfill({ response, json: data })
    })
    await p.route("https://www.youtube.com/iframe_api", route => opts.blockApi?.() ? route.abort() : route.fulfill({ contentType: "text/javascript", body: api }))
    await p.route("https://www.youtube.com/embed/**", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Provider transport fixture</title><button>Player control</button>' }))
  } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await expect(page.locator(PLAY).first()).toBeVisible()
  await j.readerLayoutSettled()
  return j
}

const layout = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, ask = document.querySelector("[data-land-ask-text]")!, film = a._landFilmEl
  const cards = [...a.optionsRef.current.querySelectorAll("[data-tech]")].map((c: Element) => c.getBoundingClientRect())
  const text = ask.getBoundingClientRect(), media = film.getBoundingClientRect()
  return { gap: text.top - Math.max(...cards.map((r: DOMRect) => r.bottom)), film: media.toJSON(), askBottom: text.bottom,
    padding: getComputedStyle(a._landEl).padding, free: a._paneLayout().width, layout: a._reader.game.dataset.mediaLayout, cardWidth: a._landEl.getBoundingClientRect().width, gridWidth: (document.querySelector("[data-reader-body]") as HTMLElement).getBoundingClientRect().width,
    nested: !!film.closest(".ng-landcard,[data-land-q]"), token: parseFloat(getComputedStyle(ask).getPropertyValue("--section-gap")) }
})

for (const [width, height] of [[390, 631], [390, 844], [768, 1024], [1024, 768], [1152, 900], [1440, 900]]) {
  test(`@curated VIDEO1 gap and card width ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await boot(page)
    const g = await layout(page)
    // U104 and U110 a (owner, 2026-11-09): under 1,024px free everything stacks in one box of at most 496px; from 1,024px the
    // question and the film are the article grid's two columns (replacing VIDEO1's 680px column and the 400px desktop film).
    if (width < 1024) {
      expect(g.gap, "VIDEO1 ask gap is 5–6px below the visible Moves cards").toBeGreaterThanOrEqual(5)
      expect(g.gap, "VIDEO1 ask gap is 5–6px below the visible Moves cards").toBeLessThanOrEqual(6.1)
      expect(g.gap, "VIDEO1 gap uses the existing section spacing token").toBeCloseTo(g.token, 1)
      expect(g.film.width, "VIDEO1 mobile/tablet film fills the column").toBeCloseTo(Math.min(496, g.free - 32), 1)
      expect(g.film.top, "VIDEO1 own film follows the ask").toBeGreaterThan(g.askBottom)
      expect(g.layout).toBe("stacked")
    } else {
      expect(g.layout, "U104: from 1,024px the film is the right column").toBe("side-by-side")
      // v1.253.0 (owner, 2026-11-09): the asking question spans the choices row (the grid); the film is one of its two columns.
      expect(g.film.width, "U104: a column wide").toBeCloseTo((g.gridWidth - 24) / 2, 0)
      expect(g.cardWidth, "v1.253.0: the asking question as wide as the choices row").toBeCloseTo(g.gridWidth, 0)
    }
    expect(g.padding).toBe("0px 0px 0px 3px")
    expect(g.nested, "VIDEO1 own film never enters a question card").toBe(false)
    await expect(page.locator(FILM)).toHaveCount(1)
    await expect(page.locator('[data-land-q] iframe, [data-land-q] [data-film-play]')).toHaveCount(0)
  })
}

for (const [width, height, vertical] of [[390, 631, false], [390, 844, false], [768, 1024, false], [1440, 900, false], [1440, 900, true]] as const) {
  test(`@curated VIDEO1 width-first 95% fit and rectangle zoom ${width}x${height}${vertical ? " portrait" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); const j = await boot(page, vertical)
    await page.locator(PLAY).first().scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    const before = await page.locator(FILM + " .ng-clip").first().boundingBox()
    const card = await page.locator(FILM).boundingBox()
    // Capture in the same task as creation so a slow CI frame cannot miss the zoom.
    await page.evaluate(() => {
      const animate = Element.prototype.animate
      Element.prototype.animate = function (...args: Parameters<typeof animate>) {
        const animation = animate.apply(this, args)
        if (this.matches(".ng-video-theater")) { animation.pause(); (window as any).__zoom = animation }
        return animation
      }
    })
    await j.clickByMouse(PLAY, "Play the technique's own video")
    await expect(page.locator(THEATER)).toBeVisible()
    const frames = await page.evaluate(async () => {
      const d = document.querySelector(".ng-video-theater")!, a = (window as any).__zoom
      if (!a) throw new Error("VIDEO1 zoom animation is missing")
      const duration = Number(a.effect.getTiming().duration), frames = []
      for (const time of [0, duration / 2, duration - 1]) {
        a.currentTime = time; await new Promise(requestAnimationFrame)
        frames.push(d.getBoundingClientRect().toJSON())
      }
      a.finish(); return frames
    })
    expect(frames[0].x, "VIDEO1 zoom starts at the video rectangle").toBeCloseTo(before!.x, 0)
    expect(frames[0].y).toBeCloseTo(before!.y, 0)
    expect(frames[0].width).toBeCloseTo(before!.width, 0)
    expect(frames[0].height).toBeCloseTo(before!.height, 0)
    expect(frames[1].width).toBeGreaterThan(before!.width)
    const ratio = vertical ? 9 / 16 : 16 / 9, w = Math.min(.95 * width, .95 * height * ratio), h = w / ratio
    expect(frames[2].width, "VIDEO1 95% fit uses width first and caps height").toBeCloseTo(w, 0)
    expect(frames[2].height, "VIDEO1 95% fit preserves the video ratio").toBeCloseTo(h, 0)
    expect(frames[2].x).toBeCloseTo((width - w) / 2, 0)
    expect(frames[2].y).toBeCloseTo((height - h) / 2, 0)
    expect(await page.locator(FILM).boundingBox(), "VIDEO1 the surrounding card stays in place").toEqual(card)
    await expect(page.locator(THEATER + " .ng-current-title, " + THEATER + " footer")).toHaveCount(0)
    await expect(page.locator(THEATER + " iframe")).toHaveCount(1)
    await expect(page.locator(FILM + " iframe")).toHaveCount(0)
  })
}

test("@curated VIDEO1 click loads autoplay and dims everything by 60 percent", async ({ page }) => {
  const j = await boot(page, false, true)
  expect(await page.locator('#yt-iframe-api').count(), "VIDEO1 API does not load before Play").toBe(0)
  await j.clickByMouse(PLAY)
  await expect(page.locator('#yt-iframe-api')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (window as any).__players?.[0]?.play)).toBe(1)
  expect(await page.evaluate(() => (window as any).__players[0].vars), "VIDEO1 user click requests autoplay").toMatchObject({ autoplay: 1, controls: 1, playsinline: 1 })
  await expect(page.locator(THEATER + " iframe")).toHaveAttribute("allow", /autoplay/)
  const style = await page.locator(THEATER).evaluate(d => ({
    dim: getComputedStyle(d, "::backdrop").backgroundColor, position: getComputedStyle(d).position,
    z: Number(getComputedStyle(d).zIndex), root: d.parentElement === (window as any).__neural.__ngRoot,
    modal: d.matches(":modal"), background: getComputedStyle(d).backgroundColor,
  }))
  expect(style.dim, "VIDEO1 backdrop dims everything by 60 percent").toBe("rgba(0, 0, 0, 0.6)")
  expect(style).toMatchObject({ position: "fixed", z: 96, root: true, modal: true, background: "rgb(0, 0, 0)" })
  expect(await page.evaluate(() => (window as any).__videoCsp), "VIDEO1 YouTube loads under the site's enforced CSP").toEqual([])
})

for (const exit of ["Escape", "dim", "close"] as const) {
  test(`@curated VIDEO1 ${exit} exits and restores play focus`, async ({ page }) => {
    const j = await boot(page); await j.clickByMouse(PLAY)
    const close = page.locator(THEATER + " .ngClipX")
    await expect(close, "VIDEO1 focus enters the theater").toBeFocused()
    await expect(page.locator(THEATER + " iframe")).toBeVisible()
    await expect(page.frameLocator(THEATER + " iframe").getByRole("button")).toBeVisible()
    await page.keyboard.press("Tab")
    await expect(page.frameLocator(THEATER + " iframe").getByRole("button")).toBeFocused()
    await page.keyboard.press("Shift+Tab"); await expect(close).toBeFocused()
    // Native pointer coordinates must be sampled after the moving close settles.
    await page.locator(THEATER).evaluate(async d => { await Promise.all(d.getAnimations().map(a => a.finished)) })
    if (exit === "dim") await page.mouse.click(1, 1)
    else if (exit === "close") await j.clickByMouse(THEATER + " .ngClipX")
    else await page.keyboard.press("Escape")
    await expect(page.locator(THEATER), "VIDEO1 every visible exit closes the theater").toHaveCount(0)
    await expect(page.locator(PLAY).first(), "VIDEO1 exit returns focus to Play").toBeFocused()
    expect(await page.evaluate(() => (window as any).__players[0].destroy)).toBe(1)
  })
}

test("@curated VIDEO1 map gets no pointer wheel or keyboard input during playback", async ({ page }) => {
  const j = await boot(page); await j.clickByMouse(PLAY)
  await expect(page.locator(THEATER + " iframe")).toBeVisible()
  const state = () => page.evaluate(() => {
    const a = (window as any).__neural
    return { focus: a.focusIdx, moves: a.moveCount, hand: a._choiceHandId, played: !!a._played, pane: a.deckShown,
      camera: { ...a.cam }, read: a._reader.root.scrollTop, commits: a.beats.filter((b: any) => b.beat === "commit").length }
  })
  const before = await state()
  expect(await page.evaluate(() => (window as any).__neural._graphInputOn()), "VIDEO1 map input gate closes during theater").toBe(false)
  await page.mouse.move(2, 2); await page.mouse.wheel(0, 180)
  await page.locator(THEATER + " .ngClipX").focus()
  for (const key of ["1", "Shift+Digit1", "a", "ArrowRight", "/"]) await page.keyboard.press(key)
  expect(await state(), "VIDEO1 native gestures cannot reach the map or Moves").toEqual(before)
  // A drag has to start on the dim to mean anything: over the video it belongs to the cross-origin
  // iframe and the app never hears it. Releasing on the dim is a click on the dialog, so this drag
  // also ends the theater. It pans nothing because the modal and _graphInputOn each stop it, so
  // removing either one alone leaves this green; each has its own control above.
  await page.mouse.move(5, 5); await page.mouse.down(); await page.mouse.move(60, 40, { steps: 8 }); await page.mouse.up()
  await expect(page.locator(THEATER)).toHaveCount(0)
  expect(await state(), "VIDEO1 a drag on the dim cannot reach the map").toEqual(before)
  expect(await page.evaluate(() => (window as any).__neural._graphInputOn())).toBe(true)
  await j.readingOtherHalf()
  await expect(page).toHaveURL(/\/Knee-Slice-Pass\/Defender$/)
})

// REV332 S1, D-326's rule for the theater. A notice shown under the top layer is covered by the video
// and runs out its 4.8 seconds unseen, so it waits. Both ways in: one already showing at Play, one
// raised during playback. Three escapes mint Houdini through the real path.
test("VIDEO1 a reward waits for the theater to close", async ({ page }) => {
  const j = await boot(page, false, false, { keepTutorial: true })
  const reward = page.locator(".ng-challenge-reward")
  await expect(reward, "premise: arrival's own notice has finished").toHaveCount(0, { timeout: 12_000 })
  await page.evaluate(() => { const a = (window as any).__neural; for (let i = 0; i < 3; i++) a.fx("escape", { via: "Elbow Escape" }) })
  await expect(reward, "premise: a notice is showing at Play").toBeVisible()
  const minted = await page.evaluate(() => (window as any).__neural._challengeRewardActive)
  expect(minted, "premise: the notice is a real queued reward").toMatchObject({ kind: "coin" })
  await j.clickByMouse(PLAY)
  await expect(page.locator(THEATER + " iframe")).toBeVisible()
  // Read once, never polled: the notice times itself out at 4.8s, so a 5s retry passes without the hold.
  expect(await reward.count(), "VIDEO1 an open theater holds the notice already showing").toBe(0)
  await page.keyboard.press("Escape")
  await expect(reward, "VIDEO1 a held notice shows once the theater closes").toBeVisible()
  await j.clickByMouse("[data-reward-close]", "dismiss the released notice")
  await expect(reward).toHaveCount(0)
  await j.clickByMouse(PLAY)
  await expect(page.locator(THEATER + " iframe")).toBeVisible()
  await page.evaluate(r => { (window as any).__neural.queueChallengeReward(r.kind, r.id) }, minted)
  await page.waitForTimeout(150)
  expect(await reward.count(), "VIDEO1 no notice opens behind the theater").toBe(0)
  await page.keyboard.press("Escape")
  await expect(reward, "VIDEO1 a notice raised during playback shows once the theater closes").toBeVisible()
  expect(await reward.evaluate(el => { const b = el.querySelector("[data-reward-close]")!.getBoundingClientRect()
    return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) }), "VIDEO1 the released notice is on top").toBe(true)
})

// REV332 S2: a blocked provider script fired nothing, so the theater sat on its poster for good.
// The route aborts the way a content blocker does; the second Play is the same page after it lifts.
test("VIDEO1 a blocked provider says so, and a later Play retries it", async ({ page }) => {
  let blocked = true
  const j = await boot(page, false, false, { blockApi: () => blocked })
  await j.clickByMouse(PLAY)
  const link = page.locator(THEATER + " .ngPlayerHost a")
  await expect(link, "VIDEO1 a blocked provider offers the video on YouTube").toBeVisible()
  await expect(link).toHaveAttribute("href", /youtube\.com\/watch\?v=/)
  expect(await page.evaluate(() => (window as any).__neural.beats.filter((b: any) => b.beat === "video_load_failed").map((b: any) => b.code)), "VIDEO1 a blocked provider says it fired").toEqual(["script"])
  await page.keyboard.press("Escape")
  await expect(page.locator(THEATER)).toHaveCount(0)
  blocked = false
  await j.clickByMouse(PLAY)
  await expect(page.locator(THEATER + " iframe"), "VIDEO1 a later Play retries the provider").toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).__players?.[0]?.play), { message: "VIDEO1 the retried player plays" }).toBe(1)
})

test("@curated VIDEO1 reduced motion opens instantly without a zoom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const j = await boot(page)
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true)
  await page.evaluate(() => {
    const animate = Element.prototype.animate; (window as any).__theaterAnimations = 0
    Element.prototype.animate = function (...args: Parameters<typeof animate>) {
      if (this.matches(".ng-video-theater")) (window as any).__theaterAnimations++
      return animate.apply(this, args)
    }
  })
  await j.clickByMouse(PLAY)
  expect(await page.evaluate(() => (window as any).__theaterAnimations), "VIDEO1 reduced motion creates no zoom animation").toBe(0)
  const r = await page.locator(THEATER).boundingBox()
  expect(r!.width).toBeCloseTo(1368, 1); expect(r!.height).toBeCloseTo(769.5, 1)
})
