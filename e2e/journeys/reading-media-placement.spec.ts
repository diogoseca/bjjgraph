import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// Shared seam: sections owns place(target), videos owns the live host/contents.
// The real published clip row and app's expansion/lifecycle are exercised. Only
// the external YouTube transport is replaced: its iframe plays a real local
// canvas MediaStream. This proves browser move continuity, not YouTube service uptime.
// All nine seam mutants killed (2026-10-16): orchestrator scratch/article-sections/
// verification-{2,3}-mutants. Initial non-kill: identical CSSOM writes produced no
// MutationObserver records. The owned-style call counter below rejects that
// style-churn mutant (53 sets vs 0); both unmodified viewport cases pass.
const PATH = '/Transitions/Knee-Slice-Pass/Attacker'
const READY = '[data-reader][data-reader-ready="true"]'
const FOCUS = { v: 2, settings: { readingFocus: true, readingCard: false, readingHand: false, readingMap: true, readingFeedback: false }, settingsAt: {} }
async function installTransport(page: Page) {
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    w.__mediaEvents = []
    a.ytApiReady = async () => ({ PlayerState: { ENDED: 0 }, Player: class {
      frame: HTMLIFrameElement
      constructor(host: HTMLElement, config: any) {
        this.frame = document.createElement('iframe')
        this.frame.title = 'Local playback fixture'
        this.frame.srcdoc = `<video ${config.playerVars.autoplay ? 'autoplay' : ''} muted playsinline></video><script>
          window.identity = {}; const v = document.querySelector('video'), c = document.createElement('canvas');
          c.width = c.height = 32; v.srcObject = c.captureStream(20);
          setInterval(() => { c.getContext('2d').fillRect(0, 0, 32, 32); }, 50);
        </script>`
        this.frame.style.cssText = 'width:100%;height:100%;border:0;pointer-events:none'
        this.frame.onload = () => config.events.onReady({ target: this })
        host.replaceWith(this.frame)
      }
      video() { return this.frame.contentDocument?.querySelector('video') }
      playVideo() { w.__mediaEvents.push('play'); this.video()?.play().catch(() => {}) }
      pauseVideo() { w.__mediaEvents.push('pause'); this.video()?.pause() }
      getIframe() { return this.frame }
      getCurrentTime() { return this.video()?.currentTime || 0 }
      seekTo() {}
      mute() {}
      unMute() {}
      setVolume() {}
      destroy() { w.__mediaEvents.push('destroy'); this.frame.remove() }
    } })
  })
}
const snapshot = (page: Page) => page.evaluate(() => {
  const w = window as any, a = w.__neural, host = a._landFilmEl, frame = host?.querySelector('iframe')
  const video = frame?.contentDocument?.querySelector('video')
  return { same: host === w.__mediaHost, frame: frame === w.__mediaFrame, player: a._expandedClip?._player === w.__mediaPlayer,
    document: frame?.contentWindow?.identity === w.__mediaDocument, stale: !!a._expandedClip?._mediaStale, hosts: document.querySelectorAll('[data-land-film]').length,
    frames: document.querySelectorAll('[data-land-film] iframe').length, total: document.querySelectorAll('[data-reader] iframe').length,
    paused: video ? video.paused : frame?.getAttribute('src') === 'about:blank', source: frame?.getAttribute('src'), time: video?.currentTime,
    slot: host?.parentElement === a._reader.mediaSlot, events: w.__mediaEvents.slice() }
})

for (const width of [1366, 390]) for (const native of [true, false]) {
  test(`@curated ${width}px media identity and ${native ? 'native playback continuity' : 'pause-before-append fallback'}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
    const j = journey(page)
    await j.boot(PATH, { beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      if (!native) await page.addInitScript(() => Object.defineProperty(Element.prototype, 'moveBefore', { configurable: true, value: undefined }))
    } })
    await expect(page.locator(READY)).toBeVisible()
    // Enter Focus through the real control in both engines. This also avoids
    // relying on the harness's separate wipe/seed init-script ordering in Firefox.
    if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]')
    await page.locator('[data-reading-focus]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-reading-focus]')
    await expect(page.locator('[data-reader-media-slot] .ng-clip').first()).toBeVisible()
    await page.locator('[data-reader-media-slot] .ng-clip').first().scrollIntoViewIfNeeded()
    await installTransport(page)
    await page.evaluate(() => {
      const w = window as any, a = w.__neural
      w.__mediaHost = a._landFilmEl
      w.__canvasPicks = 0
      const wrap = a.wrapRef.current, capture = wrap.setPointerCapture
      wrap.setPointerCapture = function (id: number) { w.__canvasPicks++; return capture.call(this, id) }
    })
    await j.clickByMouse('[data-reader-media-slot] .ng-clip:first-child', 'play the existing clip using its real handler')
    await expect.poll(() => page.evaluate(() => {
      const f = document.querySelector('[data-land-film] iframe') as HTMLIFrameElement
      return f?.contentDocument?.querySelector('video')?.currentTime || 0
    })).toBeGreaterThan(0.1)
    await page.evaluate(() => {
      const w = window as any, a = w.__neural, f = a._landFilmEl.querySelector('iframe')
      w.__mediaFrame = f; w.__mediaPlayer = a._expandedClip._player; w.__mediaDocument = f.contentWindow.identity
      w.__mediaEvents = []; w.__pauseCalls = 0
      const pause = a.pauseLandFilm
      a.pauseLandFilm = function () { w.__pauseCalls++; return pause.call(this) }
      const target = a._reader.mediaHome, append = target.appendChild
      target.appendChild = function (node: Node) { if (node === w.__mediaHost) w.__mediaEvents.push('append'); return append.call(this, node) }
      a._reader.place(target)
      if (a._expandedClip._mediaStale) {
        const stale = w.__mediaPlayer
        for (const key of ['playVideo', 'pauseVideo', 'seekTo', 'getCurrentTime', 'mute', 'unMute', 'getIframe', 'setVolume', 'destroy']) {
          const fn = stale[key]; stale[key] = function (...args: any[]) { w.__mediaEvents.push('STALE:' + key); return fn.apply(this, args) }
        }
      }
    })
    let proof = await snapshot(page)
    expect(proof).toMatchObject({ same: true, frame: true, hosts: 1, frames: 1, total: 1, slot: false, player: native })
    if (native) {
      expect(proof).toMatchObject({ document: true, paused: false })
      expect(proof.events).toEqual([])
      await expect.poll(async () => (await snapshot(page)).time || 0).toBeGreaterThan(proof.time! + .1)
    } else {
      expect(proof.events.slice(0, 2)).toEqual(['pause', 'append'])
      expect(proof).toMatchObject({ stale: true, source: 'about:blank' })
      await page.waitForTimeout(350)
      expect((await snapshot(page)).paused).toBe(true)
      expect((await snapshot(page)).events).not.toContain('play')
      expect((await snapshot(page)).events.filter((e: string) => e.startsWith('STALE:'))).toEqual([])
    }
    await page.evaluate(() => { const a = (window as any).__neural; a._reader.place(a._reader.mediaSlot); a._reader.place(a._reader.mediaSlot); a._dockLandFilm() })
    expect(await snapshot(page)).toMatchObject({ same: true, frame: true, player: native, hosts: 1, frames: 1, total: 1, slot: true })
    await page.locator('[data-section-toggle=videos]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-section-toggle=videos]', 'collapse pauses without deleting the owner')
    await expect(page.locator('[data-section-type=videos] .ng-section-body')).toBeHidden()
    expect(await snapshot(page)).toMatchObject({ same: true, frame: true, player: native, hosts: 1, frames: 1, total: 1, paused: true })
    await j.clickByMouse('[data-section-toggle=videos]')
    await expect(page.locator('[data-section-type=videos] .ng-section-body')).toBeVisible()
    expect((await snapshot(page)).paused).toBe(true)
    expect(await page.evaluate(() => (window as any).__pauseCalls)).toBeGreaterThan(0)
    expect((await snapshot(page)).events).not.toContain('destroy')
    expect((await snapshot(page)).events.filter((e: string) => e.startsWith('STALE:'))).toEqual([])
    expect(await page.evaluate(() => (window as any).__canvasPicks)).toBe(0)
    expect(await page.evaluate(() => { const a = (window as any).__neural; return { drag: !!a.dragging, played: !!a._played, paused: a.paused } })).toMatchObject({ drag: false, played: false, paused: true })
    await j.clickByMouse('[data-film-resume]', 'only deliberate play resumes or rebinds the stopped clip')
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false)
    expect((await snapshot(page)).events.filter((e: string) => e.startsWith('STALE:'))).toEqual([])
    if (!native) expect(await snapshot(page)).toMatchObject({ frame: false, player: false, hosts: 1, frames: 1, stale: false })
  })
}

test('@curated pauseLandFilm pauses every owner player without destroying or collapsing', async ({ page }) => {
  const j = journey(page)
  await j.boot(PATH, { initialState: FOCUS, beforeNavigate: async () => {
    await page.route('**/static/neural/content/*.json', route => route.continue())
  } })
  await expect(page.locator('[data-reader-media-slot] .ng-clip').first()).toBeVisible()
  const proof = await page.evaluate(() => {
    const a = (window as any).__neural, host = a._landFilmEl, cards = [...host.querySelectorAll('.ng-clip')].slice(0, 2) as any[]
    let pauses = 0, destroys = 0, collapses = 0
    const collapse = a.collapseClip
    a.collapseClip = () => { collapses++ }
    for (const card of cards) card._player = { pauseVideo() { pauses++ }, destroy() { destroys++ } }
    a.pauseLandFilm()
    const result = { count: cards.length, pauses, destroys, collapses, same: host === a._landFilmEl && cards.every(c => host.contains(c)), stopped: cards.every(c => c._mediaPaused) }
    for (const card of cards) { card._player = null; card.querySelector('[data-film-resume]')?.remove() }
    a.collapseClip = collapse
    return result
  })
  expect(proof).toEqual({ count: 2, pauses: 2, destroys: 0, collapses: 0, same: true, stopped: true })
})

test('@curated same-seat hydration retains the host; a role change retires it', async ({ page }) => {
  const j = journey(page)
  await j.boot(PATH, { initialState: FOCUS, beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      // The hidden source article's external embeds are transport fixtures. The
      // app still owns only its single adopted host; no provider network is needed.
      await page.route(/https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Source embed fixture</title>' }))
      await page.route('**/i.ytimg.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"/>' }))
      // The localhost-only snapshot probe is not implemented by the static harness.
      await page.route('**/__snapshot/ping', route => route.fulfill({ status: 204 }))
    } })
  await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator('[data-reader-media-slot] .ng-clip').first()).toBeVisible()
  await page.evaluate(() => {
    const w = window as any, a = w.__neural; w.__mediaHost = a._landFilmEl
    a.onContentReady(a.nodes[a._landIdx].t)
    a._renderLandFilm(a._landFilmClips(a.nodes[a._landIdx])); a._reader.sync()
  })
  expect(await page.evaluate(() => (window as any).__mediaHost === (window as any).__neural._landFilmEl)).toBe(true)
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Transitions/Knee-Slice-Pass/Defender')
  expect(await page.evaluate(() => (window as any).__mediaHost.isConnected)).toBe(false)
  await expect(page.locator('[data-land-film]')).toHaveCount(1)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural; return { role: a._landFilmEl._ngMediaRole, slot: a._reader.ownsMedia() }
  })).toEqual({ role: 'defender', slot: true })
})


for (const width of [1366, 390]) {
  test(`@curated ${width}px normal media home shares the game scrollport without fixed overlap or resize loops`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text() + ' [' + m.location().url + ']') })
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
    const j = journey(page)
    await j.boot(PATH, { initialState: FOCUS, beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      // The hidden source article's external embeds are transport fixtures. The
      // app still owns only its single adopted host; no provider network is needed.
      await page.route(/https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Source embed fixture</title>' }))
      await page.route('**/i.ytimg.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"/>' }))
      // The localhost-only snapshot probe is not implemented by the static harness.
      await page.route('**/__snapshot/ping', route => route.fulfill({ status: 204 }))
    } })
    await expect(page.locator('[data-reader-media-slot] .ng-clip').first()).toBeVisible()
    await page.evaluate(width => {
      const w = window as any, a = w.__neural; w.__placementHost = a._landFilmEl
      // Explicit future-owner height fixture on today's same host, not a second renderer.
      a._landFilmEl.style.minHeight = (width > 640 ? 241.421875 : 219.9375) + 'px'
      a.currentFilmHeight = () => a._landFilmEl.getBoundingClientRect().height
      const observer = new ResizeObserver(() => a._reader.layout()); observer.observe(a._landFilmEl)
      a._reader.leaveReading(); a._applyLayers()
    }, width)
    await j.advance(500)
    await page.waitForTimeout(400) // the existing clip/card entry transitions settle
    const geometry = () => page.evaluate(() => {
      const w = window as any, a = w.__neural, home = document.querySelector('[data-land-media-slot]')!, card = a._landEl
      const m = home.getBoundingClientRect(), c = card.getBoundingClientRect(), h = a.optionsRef.current.getBoundingClientRect()
      return { same: a._landFilmEl === w.__placementHost, hosts: document.querySelectorAll('[data-land-film]').length,
        together: home.parentElement === card.parentElement && home.parentElement === a.optionsRef.current.parentElement,
        layout: home.parentElement!.getAttribute('data-media-layout'), media: { x: m.x, y: m.y, w: m.width, h: m.height, bottom: m.bottom },
        card: { x: c.x, y: c.y, w: c.width, bottom: c.bottom }, handTop: h.top,
        gap: card.classList.contains('ng-land-deck') ? 16 : a.isMobile() ? 8 : 12, position: getComputedStyle(a._landFilmEl).position }
    })
    const g = await geometry()
    expect(g).toMatchObject({ same: true, hosts: 1, together: true, layout: width > 640 ? 'side-by-side' : 'stacked', position: 'relative' })
    expect(g.media.w).toBe(width > 640 ? 400 : 358)
    expect(g.media.h).toBeCloseTo(width > 640 ? 241.42 : 219.94, 1)
    if (width > 640) { expect(g.card.x - g.media.x - g.media.w).toBeCloseTo(60, 0); expect(g.card.w).toBe(390) }
    else { expect(g.card.y - g.media.bottom).toBeCloseTo(12, 0); expect(g.card.w).toBe(286) }
    expect(g.handTop).toBeGreaterThan(Math.max(g.card.bottom, g.media.bottom))
    expect(g.handTop - g.card.bottom, 'media height never adds another gap below the practice card').toBeCloseTo(g.gap, 1)
    await page.evaluate(() => { const a = (window as any).__neural; delete a.currentFilmHeight; a._reader.layoutNow() })
    expect(await geometry(), 'until videos lands, the host rect supplies identical geometry').toEqual(g)
    await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame) })
    const churn = await page.evaluate(async () => {
      const a = (window as any).__neural, reader = a._reader, now = reader.layoutNow
      let calls = 0, writes = 0, sets = 0
      reader.layoutNow = function () { calls++; return now.call(this) }
      const elements = [reader.root, reader.game, reader.mediaHome, reader.articleEl, reader.head,
        reader.dock, reader.contents, a._landEl, a._landStackEl, a._landNavEl, a.optionsRef.current].filter(Boolean) as HTMLElement[]
      // Chromium can suppress MutationObserver records for an identical CSSOM
      // assignment. Count the owned style calls too: the first style-churn mutant
      // survived the observer alone even though layout rewrote every property.
      const styles = new Set(elements.map(el => el.style)), set = CSSStyleDeclaration.prototype.setProperty
      CSSStyleDeclaration.prototype.setProperty = function (this: CSSStyleDeclaration, ...args: Parameters<typeof set>) {
        if (styles.has(this)) sets++
        return set.apply(this, args)
      }
      const observer = new MutationObserver(ms => { writes += ms.length })
      for (const el of elements) {
        observer.observe(el, { attributes: true, attributeFilter: ['style'] })
      }
      try {
        for (let i = 0; i < 20; i++) reader.layout()
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
        return { calls, writes, sets }
      } finally {
        observer.disconnect(); reader.layoutNow = now
        CSSStyleDeclaration.prototype.setProperty = set
      }
    })
    expect(churn).toEqual({ calls: 1, writes: 0, sets: 0 })
    for (const size of [{ width: 768, height: 1024 }, { width, height: width === 390 ? 844 : 768 }]) {
      await page.setViewportSize(size); await j.advance(100)
    }
    expect((await geometry()).same).toBe(true)
    expect(errors).toEqual([])
  })
}
