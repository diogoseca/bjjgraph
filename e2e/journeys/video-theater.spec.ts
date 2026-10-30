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

async function boot(page: Page, vertical = false, enforceCsp = false) {
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async p => {
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
    await p.route("https://www.youtube.com/iframe_api", route => route.fulfill({ contentType: "text/javascript", body: api }))
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
    padding: getComputedStyle(a._landEl).padding, free: a._paneLayout().width, layout: a._reader.game.dataset.mediaLayout,
    nested: !!film.closest(".ng-landcard,[data-land-q]"), token: parseFloat(getComputedStyle(ask).getPropertyValue("--section-gap")) }
})

for (const [width, height] of [[390, 631], [390, 844], [768, 1024], [1024, 768], [1152, 900], [1440, 900]]) {
  test(`@curated VIDEO1 gap and card width ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await boot(page)
    const g = await layout(page)
    if (width < 1152) {
      expect(g.gap, "VIDEO1 ask gap is 5–6px below the visible Moves cards").toBeGreaterThanOrEqual(5)
      expect(g.gap, "VIDEO1 ask gap is 5–6px below the visible Moves cards").toBeLessThanOrEqual(6.1)
      expect(g.gap, "VIDEO1 gap uses the existing section spacing token").toBeCloseTo(g.token, 1)
      expect(g.film.width, "VIDEO1 mobile/tablet film fills the column").toBeCloseTo(Math.min(680, g.free - 32), 1)
      expect(g.film.top, "VIDEO1 own film follows the ask").toBeGreaterThan(g.askBottom)
      expect(g.layout).toBe("stacked")
    } else {
      expect(g.film.width, "VIDEO1 desktop film is a portion of the column").toBe(400)
      expect(g.layout).toBe("side-by-side")
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
  await page.mouse.move(700, 400); await page.mouse.down(); await page.mouse.move(760, 440, { steps: 8 }); await page.mouse.up()
  await page.locator(THEATER + " .ngClipX").focus()
  for (const key of ["1", "Shift+Digit1", "a", "ArrowRight", "/"]) await page.keyboard.press(key)
  expect(await state(), "VIDEO1 native gestures cannot reach the map or Moves").toEqual(before)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => (window as any).__neural._graphInputOn())).toBe(true)
  await j.readingOtherHalf()
  await expect(page).toHaveURL(/\/Knee-Slice-Pass\/Defender$/)
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
