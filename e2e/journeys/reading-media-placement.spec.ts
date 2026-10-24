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
// D-338 retired Focus (its reading* overrides are no longer read). QUIET seeds the same closed
// Questions and Moves and silent Feedback through the game layers; the map stays shown, as
// leaving Focus showed it for the other-half tap.
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }
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

// Review B1: the published Frames article has four videos but no game seat.
// The built corpus currently has no Learning/System embeds; those two cases add
// explicit video fixtures to real articles to cover their seatless media path.
// Only provider transport is stubbed; Play, ownership and teardown are real.
// reference-videos-removed restores unconditional source iframe removal with no
// replacement: the published Frames Play-ID set is empty instead of four (B1).
for (const [path, width, fixture] of [
  ['/Principles/Frames', 1440, false], ['/Principles/Frames', 390, false],
  ['/Learning/Position-Over-Submission', 1440, true],
  ['/Systems/Danaher-Pin-Escape-Fundamentals-System', 1440, true],
] as const) {
  test(`@curated published reference videos remain playable without a seat: ${path} ${width}px${fixture ? ' (video fixture)' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot(path, { keepTutorial: true, initialState: QUIET, beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      await page.route(/https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Source transport fixture</title>' }))
      if (fixture) await page.route(url => url.pathname === path, async route => {
        const response = await route.fetch(), html = await response.text()
        expect(html).not.toContain('<iframe')
        const film = '<section id="film-study"><h2>Film Study</h2>' + ['92lqcDuaiOw', 'F0XCE0lFIG8'].map(id =>
          `<div class="film-clip"><p><iframe src="https://www.youtube.com/embed/${id}"></iframe></p><p class="clip-credit"><strong>Reference video fixture ${id}</strong></p></div>`).join('') + '</section>'
        await route.fulfill({ response, body: html.replace('</article>', film + '</article>') })
      })
    } })
    await expect(page.locator(READY)).toBeVisible()
    const before = await page.evaluate(async path => {
      const a = (window as any).__neural, doc = new DOMParser().parseFromString(await (await fetch(path)).text(), 'text/html')
      const sources = [...doc.querySelectorAll('article iframe')].map(f => new URL(f.getAttribute('src')!).pathname.split('/').pop())
      const clips = [...a._reader.root.querySelectorAll('.ng-clip')].map((c: any) => new URL(c.querySelector('img').src).pathname.split('/')[2])
      return { sources, clips, seat: a._nodeAndRoleForPath(path).idx, owner: a._landFilmEl?.dataset.referenceFilm }
    }, path)
    expect(before.sources).toHaveLength(fixture ? 2 : 4)
    expect(before.clips, 'every published reference video has an in-app Play control').toEqual(before.sources)
    expect(before).toMatchObject({ seat: -1, owner: path })
    await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
    await expect(page.locator('[data-land-film]')).toHaveCount(1)
    const dormant = () => page.evaluate(() => {
      const a = (window as any).__neural
      return { current: a.currentPos, land: a._landIdx, hand: a._optList?.length || 0,
        played: !!a._played, paused: a.paused, clock: a._decision ?? null,
        beats: (a.beats || []).filter((b: any) => ['options_dealt', 'engaged', 'commit', 'land_q_shown', 'short_watched'].includes(b.beat)) }
    })
    const resting = await dormant()
    expect(resting).toMatchObject({ hand: 0, played: false, paused: true, clock: null, beats: [] })
    await installTransport(page)
    await page.evaluate(() => { (window as any).__referenceHost = (window as any).__neural._landFilmEl })
    for (const index of [0, 1]) {
      const play = page.locator('[data-land-film] .ng-clip').nth(index)
      await play.scrollIntoViewIfNeeded()
      await play.evaluate(el => el.setAttribute('data-reference-play', ''))
      await j.clickByMouse('[data-reference-play]', 'play the published reference through its media owner')
      await play.evaluate(el => el.removeAttribute('data-reference-play'))
      await expect(page.locator('[data-reader] iframe')).toHaveCount(1)
      // STALE CONTRACT (v1.230.0, feat/video-cards): the player opens on its own controls and never autoplays;
      // the viewer's Play is the provider's own control, made here through the player.
      await expect.poll(() => page.evaluate(() => !!(window as any).__neural._expandedClip?._playerReady), 'premise: the player is ready').toBe(true)
    await page.evaluate(() => (window as any).__neural._expandedClip._player.playVideo())
      await expect.poll(() => page.evaluate(() => {
        const f = document.querySelector('[data-land-film] iframe') as HTMLIFrameElement
        return f?.contentDocument?.querySelector('video')?.currentTime || 0
      })).toBeGreaterThan(.1)
      expect(await dormant(), 'reference playback cannot borrow a seat or award gameplay').toEqual(resting)
      expect(await page.evaluate(() => (window as any).__referenceHost === (window as any).__neural._landFilmEl)).toBe(true)
    }
    expect(await page.evaluate(() => (window as any).__mediaEvents.filter((x: string) => x === 'destroy').length)).toBe(1)
    // STALE CONTRACT (D-338, no View menu): the article view cannot hide Book, so "hidden audio"
    // is reached through the one remaining hide path, the Videos ✕, while the clip still plays.
    expect(await page.evaluate(() => (document.querySelector('[data-land-film] iframe') as HTMLIFrameElement).contentDocument!.querySelector('video')!.paused), 'the clip is playing before its section closes').toBe(false)
    await page.locator('[data-section-toggle=videos]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-section-toggle=videos]', 'closing a seatless article\'s videos cannot leave hidden audio playing')
    await expect(page.locator('[data-section-type=videos] .ng-section-body')).toBeHidden()
    expect(await page.evaluate(() => (window as any).__mediaEvents.filter((x: string) => x === 'destroy').length)).toBe(1)
    expect(await page.evaluate(() => (document.querySelector('[data-land-film] iframe') as HTMLIFrameElement).contentDocument!.querySelector('video')!.paused)).toBe(true)
    if (!fixture) {
      const link = page.locator('[data-reader-body] a[href*="/Principles/Distance-Control"]').first()
      await link.scrollIntoViewIfNeeded(); await link.evaluate(el => el.setAttribute('data-reference-next', ''))
      await j.clickByMouse('[data-reference-next]')
      await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Principles/Distance-Control')
      expect(await page.evaluate(() => (window as any).__referenceHost.isConnected)).toBe(false)
      await expect(page.locator('[data-land-film]')).toHaveCount(1)
      await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
      expect(await dormant()).toEqual(resting)
    }
  })
}

for (const width of [1366, 390]) for (const native of [true, false]) {
  test(`@curated ${width}px media identity and ${native ? 'native playback continuity' : 'pause-before-append fallback'}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
    const j = journey(page)
    await j.boot(PATH, { beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      if (!native) await page.addInitScript(() => Object.defineProperty(Element.prototype, 'moveBefore', { configurable: true, value: undefined }))
    } })
    await expect(page.locator(READY)).toBeVisible()
    // STALE CONTRACT (D-338): Focus is gone, and with the article shown the film's one home is
    // its Videos section, so the clip is already in the slot without any entry action.
    // STALE CONTRACT (D-368, layout C): a game node's current card keeps the game's media home, beside or
    // above the question, so the clip is already there; the Videos section's slot is its other home, and
    // the move below goes there and back. STALE CONTRACT (v1.230.0, feat/video-cards): the player opens on
    // its own controls and never autoplays; the viewer's Play is the provider's, made through the player.
    if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]')
    await expect(page.locator('[data-land-film] .ng-clip').first()).toBeVisible()
    await page.locator('[data-land-film] .ng-clip').first().scrollIntoViewIfNeeded()
    await installTransport(page)
    await page.evaluate(() => {
      const w = window as any, a = w.__neural
      w.__mediaHost = a._landFilmEl
      w.__canvasPicks = 0
      const wrap = a.wrapRef.current, capture = wrap.setPointerCapture
      wrap.setPointerCapture = function (id: number) { w.__canvasPicks++; return capture.call(this, id) }
    })
    await j.clickByMouse('[data-land-film] .ng-clip:first-child', 'open the existing clip using its real handler')
    await expect.poll(() => page.evaluate(() => !!(window as any).__neural._expandedClip?._playerReady), 'premise: the player is ready').toBe(true)
    await page.evaluate(() => (window as any).__neural._expandedClip._player.playVideo())
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
      const target = a._reader.mediaSlot, append = target.appendChild
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
    expect(proof).toMatchObject({ same: true, frame: true, hosts: 1, frames: 1, total: 1, slot: true, player: native })
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
    await page.evaluate(() => { const a = (window as any).__neural; a._reader.place(a._reader.mediaHome); a._reader.place(a._reader.mediaHome); a._dockLandFilm() })
    expect(await snapshot(page)).toMatchObject({ same: true, frame: true, player: native, hosts: 1, frames: 1, total: 1, slot: false })
    await page.locator('[data-section-toggle=videos]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-section-toggle=videos]', 'collapse pauses without deleting the owner')
    await expect(page.locator('[data-section-type=videos] .ng-section-body')).toBeHidden()
    expect(await snapshot(page)).toMatchObject({ same: true, frame: true, player: native, hosts: 1, frames: 1, total: 1, paused: true })
    // STALE SPEC (D10-B1): syncSections hides Videos before the requested layout writes the game's
    // smaller height. Observe that layout before measuring the reopen control's new mouse point.
    await j.readerLayoutSettled()
    // U11 (D-355): where the index shows, the closed Videos section leaves no placeholder; its row reopens it.
    const indexed = await page.locator('[data-reader][data-indexed]').count() > 0
    await j.clickByMouse(indexed ? '[data-toc-type=videos] a' : '[data-section-toggle=videos]', 'reopen Videos')
    await expect(page.locator('[data-section-type=videos] .ng-section-body')).toBeVisible()
    expect((await snapshot(page)).paused).toBe(true)
    expect(await page.evaluate(() => (window as any).__pauseCalls)).toBeGreaterThan(0)
    expect((await snapshot(page)).events).not.toContain('destroy')
    expect((await snapshot(page)).events.filter((e: string) => e.startsWith('STALE:'))).toEqual([])
    expect(await page.evaluate(() => (window as any).__canvasPicks)).toBe(0)
    expect(await page.evaluate(() => { const a = (window as any).__neural; return { drag: !!a.dragging, played: !!a._played, paused: a.paused } })).toMatchObject({ drag: false, played: false, paused: true })
    // D-368 (layout C): the film sits in the stage at the top while the Videos toggle reads with the article,
    // so the reader scrolls back up to the film to resume it.
    await page.locator('[data-film-resume]').scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await j.clickByMouse('[data-film-resume]', 'only deliberate play resumes or rebinds the stopped clip')
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false)
    expect((await snapshot(page)).events.filter((e: string) => e.startsWith('STALE:'))).toEqual([])
    if (!native) expect(await snapshot(page)).toMatchObject({ frame: false, player: false, hosts: 1, frames: 1, stale: false })
  })
}

test('@curated pauseLandFilm pauses every owner player without destroying or collapsing', async ({ page }) => {
  const j = journey(page)
  await j.boot(PATH, { initialState: QUIET, beforeNavigate: async () => {
    await page.route('**/static/neural/content/*.json', route => route.continue())
  } })
  // STALE CONTRACT (D-368, layout C): the game's current card lives in the media home, not the Videos slot.
  await expect(page.locator('[data-land-film] .ng-clip').first()).toBeVisible()
  const proof = await page.evaluate(() => {
    const a = (window as any).__neural
    // PR 305 curated Knee Slice to one clip. This owner-wide pause claim needs
    // two players regardless of today's content; build both through its real owner.
    a._clearLandFilm()
    a._renderLandFilm([{ id: 'yj_6xcl2emA', title: 'First pause fixture' }, { id: 'RvIIpXaPyJM', title: 'Second pause fixture' }])
    const host = a._landFilmEl, cards = [...host.querySelectorAll('.ng-clip')] as any[]
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
  await j.boot(PATH, { initialState: QUIET, beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      // The hidden source article's external embeds are transport fixtures. The
      // app still owns only its single adopted host; no provider network is needed.
      await page.route(/https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Source embed fixture</title>' }))
      await page.route('**/i.ytimg.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"/>' }))
      // The localhost-only snapshot probe is not implemented by the static harness.
      await page.route('**/__snapshot/ping', route => route.fulfill({ status: 204 }))
    } })
  await expect(page.locator(READY)).toBeVisible()
  // STALE CONTRACT (D-368, layout C): the game's current card lives in the media home, not the Videos slot.
  await expect(page.locator('[data-land-film] .ng-clip').first()).toBeVisible()
  await page.evaluate(() => {
    const w = window as any, a = w.__neural; w.__mediaHost = a._landFilmEl
    a.onContentReady(a.nodes[a._landIdx].t)
    a._renderLandFilm(a._landFilmClips(a.nodes[a._landIdx])); a._reader.sync()
  })
  expect(await page.evaluate(() => (window as any).__mediaHost === (window as any).__neural._landFilmEl)).toBe(true)
  await j.readingOtherHalf() // D-318 U6a: the native paired half replaces the retired switch.
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Transitions/Knee-Slice-Pass/Defender')
  expect(await page.evaluate(() => (window as any).__mediaHost.isConnected)).toBe(false)
  await expect(page.locator('[data-land-film]')).toHaveCount(1)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural; return { role: a._landFilmEl._ngMediaRole, home: a._landFilmEl.parentElement === a._reader.mediaHome }
  })).toEqual({ role: 'defender', home: true })
})


// STALE CONTRACT (D-338): the article view reads Videos, Moves, Questions, and the film's one home
// there is its Videos section, lifted into the game flow above the hand (no side-by-side normal
// home any more). Kept: one owned host in the shared scrollport, measured one-gap boundaries with
// no extra gap, no fixed overlap, no resize loops. RETIRED with that home: the side-by-side and
// stacked sizes and "until videos lands, the host rect supplies identical geometry".
// STALE CONTRACT (D-368, layout C): nothing is lifted; Moves lead and the current card sits in the game's
// stage, beside the question on a desktop (top-aligned, 60px gap) and above it on a phone (12px gap). The
// kept claims are unchanged; the video cards' A journey pins the stage's sizes.
for (const width of [1366, 390]) {
  test(`@curated ${width}px the current card sits in the game's stage without fixed overlap or resize loops`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text() + ' [' + m.location().url + ']') })
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
    const j = journey(page)
    await j.boot(PATH, { beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      // The hidden source article's external embeds are transport fixtures. The
      // app still owns only its single adopted host; no provider network is needed.
      await page.route(/https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Source embed fixture</title>' }))
      await page.route('**/i.ytimg.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"/>' }))
      // The localhost-only snapshot probe is not implemented by the static harness.
      await page.route('**/__snapshot/ping', route => route.fulfill({ status: 204 }))
    } })
    await expect(page.locator('[data-land-film] .ng-clip').first()).toBeVisible()
    await page.evaluate(width => {
      const w = window as any, a = w.__neural; w.__placementHost = a._landFilmEl
      // Explicit future-owner height fixture on today's same host, not a second renderer.
      a._landFilmEl.style.minHeight = (width > 640 ? 241.421875 : 219.9375) + 'px'
      const observer = new ResizeObserver(() => a._reader.layout()); observer.observe(a._landFilmEl)
      a._reader.leaveReading(); a._applyLayers()
    }, width)
    await j.advance(500)
    await j.readerLayoutSettled()
    const geometry = () => page.evaluate(() => {
      const w = window as any, a = w.__neural, r = a._reader, card = a._landEl, row = a.optionsRef.current
      const m = a._landFilmEl.getBoundingClientRect(), c = card.getBoundingClientRect(), h = row.getBoundingClientRect()
      const meet = (p: DOMRect, q: DOMRect) => p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top
      return { same: a._landFilmEl === w.__placementHost, hosts: document.querySelectorAll('[data-land-film]').length,
        home: a._landFilmEl.parentElement === r.mediaHome, lifted: !!r.videoCard,
        together: r.mediaHome.parentElement === r.game && card.parentElement === r.game && row.parentElement === r.game,
        layout: r.game.getAttribute('data-media-layout'), overlap: meet(m, c) || meet(m, h),
        media: { x: m.x, w: m.width, h: m.height, top: m.top, bottom: m.bottom }, card: { x: c.x, y: c.y, bottom: c.bottom }, hand: { top: h.top, bottom: h.bottom },
        gap: card.classList.contains('ng-land-deck') ? 16 : a.isMobile() ? 8 : 12, position: getComputedStyle(a._landFilmEl).position }
    })
    const g = await geometry()
    expect(g).toMatchObject({ same: true, hosts: 1, home: true, lifted: false, together: true, overlap: false, layout: width > 640 ? 'side-by-side' : 'stacked', position: 'relative' })
    expect(g.media.h).toBeGreaterThanOrEqual(width > 640 ? 241.42 : 219.93)
    if (width > 640) {
      expect(g.card.y - g.hand.bottom, 'Questions follows Moves at one gap, never another').toBeCloseTo(g.gap, 1)
      expect(g.media.top, 'the current card is top-aligned with the question').toBeCloseTo(g.card.y, 1)
      expect(g.card.x - g.media.x - g.media.w, 'beside it at the 60px gap').toBeCloseTo(60, 1)
    } else {
      expect(g.media.top - g.hand.bottom, 'the current card follows Moves at one gap').toBeCloseTo(g.gap, 1)
      expect(g.card.y - g.media.bottom, 'the question follows the card at 12px').toBeCloseTo(12, 1)
    }
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

// D-368 + D-325 (orchestrator D-370 (2)): once a question is published, nothing may mount above it and move its
// answers. Layout C puts a node's current card above the question on a phone and beside it on a desktop (which moves
// the question sideways), and the film rides the node's content chunk, which can land after the article: H132's
// probe moved a live phone question 520 -> 752 when a 2.6s chunk landed. The hold waits for the chunk inside its
// 800ms ceiling, so the question publishes with its film in place; past the ceiling the parts publish pinned and the
// late film waits for the player's own input (D-352 S2). Control: d370-late-film-unheld (app runner).
for (const [label, delay] of [['400ms', 400], ['2.6s, past the ceiling', 2600]] as const) for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  test(`@curated ${width}px a film chunk landing after ${label} never moves the published answers`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height })
    await page.addInitScript(() => {
      const w = window as any, out: any[] = (w.__lateFilm = [])
      const tick = () => {
        const a = w.__neural, c = a?._landEl, f = a?._landFilmEl
        const live = !!c && c.isConnected && !c.hasAttribute('data-reader-pending') && getComputedStyle(c).visibility === 'visible'
        const opt = live ? c.querySelector('[data-land-mc-opt]') : null, b = opt?.getBoundingClientRect()
        if (a) out.push({ answer: b && b.height ? [Math.round(b.left), Math.round(b.top)] : null, card: c || null,
          film: !!f && f.isConnected && !f.hidden && f.getClientRects().length > 0 && getComputedStyle(f).visibility !== 'hidden' })
        if (!w.__lateFilmStop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const j = journey(page)
    let held = 0
    await j.boot('/Positions/Mount/Top', { beforeNavigate: async () => {
      await page.route('**/static/neural/content/*.json', async route => { held++; await new Promise(r => setTimeout(r, delay)); await route.continue() })
    } })
    await expect(page.locator(READY)).toBeVisible()
    await page.waitForTimeout(delay + 1500)
    const T = await page.evaluate(() => { const w = window as any, card = w.__neural._landEl
      return w.__lateFilm.filter((x: any) => x.card === card).map((x: any) => ({ answer: x.answer, film: x.film })) })
    expect(held, 'premise: the content chunk was held').toBeGreaterThan(0)
    const live = T.filter((x: any) => x.answer)
    expect(live.length, 'premise: the question was published').toBeGreaterThan(5)
    expect([...new Set(live.map((x: any) => x.answer.join()))], 'the published answers never move').toHaveLength(1)
    if (delay < 800) {
      expect(live[0].film, 'inside the ceiling the question publishes with its film in place').toBe(true)
      return
    }
    expect(live.some((x: any) => x.film), 'past the ceiling the late film does not mount while the question is live').toBe(false)
    const mc = await j.landQuestion()
    expect(mc, 'premise: a multiple-choice question').not.toBeNull()
    await j.clickByMouse(`[data-land-mc-opt="${mc!.correct}"]`, 'answer the question where it sits')
    await expect.poll(() => page.evaluate(() => { const f = (window as any).__neural._landFilmEl
      return !!f && f.getClientRects().length > 0 && getComputedStyle(f).visibility !== 'hidden' }), 'the late film shows after the player answers').toBe(true)
  })
}
