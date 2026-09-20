import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const adapter = readFileSync(new URL('../neural/src/system-preview.src.js', import.meta.url), 'utf8').replace(/^export /gm, '')
const source = readFileSync(new URL('../scripts/system_guide_media.js', import.meta.url), 'utf8').replace(/^import .*\n/, '')
const bunny = 'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&muted=false&preload=false'
function harness({ url = bunny, provider = 'bunny', visible = true, autoReady = true, youtubeReady = true, bunnySDK = true, youtubeSDK = true } = {}) {
  const created = [], scripts = [], docEvents = {}, windowEvents = {}, observers = [], timers = new Map(), calls = [], bunnyCalls = []
  let timerId = 0, ytEvents, bunnyEvents = {}
  const sections = [0, 1].map(() => {
    const target = { appendChild: frame => { frame.mounted = true; frame.parentNode = target; frame.isConnected = true; if (autoReady) frame.onload?.() } }
    const fallback = { hidden: false }
    return {
      dataset: { systemKey: 'fixture', embedUrl: url, verifiedOrigins: '[]', provider, previewTitle: 'Official intro — fixture' },
      visible, getClientRects() { return this.visible ? [1] : [] },
      querySelector: selector => selector === '[data-preview-fallback]' ? fallback : target,
      fallback, target,
    }
  })
  const document = {
    hidden: false, querySelectorAll: () => sections,
    getElementById: id => scripts.find(script => script.id === id && !script.removed),
    head: { appendChild: script => { scripts.push(script); script.mounted = true } },
    addEventListener: (name, fn) => { docEvents[name] = fn },
    createElement: tag => {
      const frame = { tag, style: {}, events: {}, addEventListener(name, fn) { this.events[name] = fn },
        remove() { this.removed = true; this.mounted = this.isConnected = false; this.parentNode = null } }
      if (tag === 'iframe') created.push(frame); return frame
    },
  }
  const location = { origin: 'http://localhost:8133', pathname: '/Systems/Fixture', href: 'http://localhost:8133/Systems/Fixture' }
  const youtube = { mute: () => calls.push('mute'), playVideo: () => calls.push('play'), destroy: () => calls.push('destroy') }
  const window = { addEventListener: (name, fn) => { windowEvents[name] = fn }, YT: { Player: function(frame, { events }) {
    ytEvents = events; if (youtubeReady) events.onReady({ target: youtube }); return youtube
  } }, playerjs: { Player: function() {
    bunnyEvents = {}
    return { on(name, callback) { bunnyEvents[name] = callback; if (name === 'ready' && autoReady) callback() },
      off(name) { bunnyCalls.push('off:' + name) } }
  } } }
  const readyBunnySDK = window.playerjs
  if (!bunnySDK) delete window.playerjs
  if (!youtubeSDK) delete window.YT
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this) }
    observe(target) { this.targets.add(target) }
    unobserve(target) { this.targets.delete(target) }
    disconnect() { this.targets.clear() }
    resize() { this.callback([...this.targets].map(target => ({ target }))) }
  }
  const context = vm.createContext({ document, window, location, URL, ResizeObserver,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id) })
  vm.runInContext(adapter, context)
  const run = () => vm.runInContext('(function(){' + source + '\n})()', context)
  run()
  return { sections, created, scripts, docEvents, windowEvents, location, document, context, observers, calls, bunnyCalls, timers, run,
    settle: async () => { await Promise.resolve(); await Promise.resolve() },
    bunnySDKReady: () => { window.playerjs = readyBunnySDK; scripts[0].events.load() },
    bunnyReady: () => bunnyEvents.ready(), bunnyError: () => bunnyEvents.error(),
    youtubeReady: () => ytEvents.onReady({ target: youtube }), youtubeError: () => ytEvents.onError() }
}

test('static intro mounts once with muted autoplay even without origin verification history', async () => {
  const h = harness(), frame = h.created[0]
  await h.settle()
  assert.equal(h.created.length, 1)
  assert.equal(frame.mounted, true)
  assert.equal(frame.title, 'Official intro — fixture')
  assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin')
  assert.equal(frame.allow.includes('autoplay'), true)
  const u = new URL(frame.src)
  for (const key of ['autoplay', 'muted', 'preload', 'playsinline']) assert.equal(u.searchParams.get(key), 'true')
  assert.equal(u.searchParams.get('loop'), 'false')
  assert.equal(h.sections[0].fallback.hidden, true)
  h.docEvents.nav(); h.run(); h.observers[0].resize()
  assert.equal(h.created.length, 1)
  assert.equal(h.observers.length, 1)
  h.sections.shift(); h.docEvents.nav()
  assert.equal(h.created.length, 1)
  assert.equal(frame.parentNode, h.sections[0].target)
  h.docEvents.click({ target: { closest: () => ({ href: '#sources' }) } }); h.windowEvents.popstate()
  assert.equal(frame.mounted, true)
  h.docEvents.click({ target: { closest: () => ({ href: '/Systems/Another' }) } })
  assert.equal(frame.mounted, false)
  assert.equal(h.sections[0].fallback.hidden, false)
})

test('changed System, browser navigation, and backgrounding remove old playback', async () => {
  const h = harness(), first = h.created[0]
  await h.settle()
  h.sections[0].dataset.systemKey = 'another'; h.docEvents.nav()
  await h.settle()
  assert.equal(first.mounted, false)
  assert.equal(h.created.length, 2)
  h.location.pathname = '/Systems/Another'; h.windowEvents.popstate()
  assert.equal(h.created[1].mounted, false)
  h.docEvents.nav(); h.document.hidden = true; h.docEvents.visibilitychange()
  assert.equal(h.created.at(-1).mounted, false)
  h.document.hidden = false; h.docEvents.visibilitychange()
  await h.settle()
  assert.equal(h.created.at(-1).mounted, true)
  h.windowEvents.pagehide()
  assert.equal(h.created.at(-1).mounted, false)
})

test('hidden, malformed and foreign players retain their cover without making a frame', async () => {
  for (const options of [
    { visible: false }, { provider: 'arbitrary' },
    { url: bunny.replace('iframe.mediadelivery.net', 'iframe.mediadelivery.net.evil.test') },
    { url: bunny.replace('https://', 'https://user@') },
    { url: bunny + '#hash' }, { url: 'javascript:alert(1)' },
  ]) {
    const h = harness(options)
    assert.equal(h.created.length, 0)
    assert.equal(h.sections[0].fallback.hidden, false)
  }
  const h = harness({ url: bunny.replace('iframe.', 'player.') }); await h.settle()
  assert.equal(h.created[0].mounted, true)
})

test('late static reveal mounts once; hiding stops playback and revealing can recover', async () => {
  const h = harness({ visible: false }), observer = h.observers[0]
  assert.equal(h.created.length, 0)
  assert.equal(observer.targets.size, 2)
  observer.resize(); assert.equal(h.created.length, 0)
  h.sections[0].visible = true; observer.resize()
  await h.settle()
  assert.equal(h.created.length, 1)
  observer.resize(); assert.equal(h.created.length, 1)
  h.sections[0].visible = false; observer.resize()
  assert.equal(h.created[0].mounted, false)
  h.sections[0].visible = true; observer.resize()
  await h.settle()
  assert.equal(h.created.length, 2)
  h.sections.length = 0; observer.resize()
  assert.equal(h.created[1].mounted, false)
  assert.equal(observer.targets.size, 0)
})

test('navigation suspends queued visibility callbacks until arrival', async () => {
  const h = harness(), observer = h.observers[0], frame = h.created[0]
  await h.settle()
  h.docEvents.click({ target: { closest: () => ({ href: '/Systems/Another' }) } }); observer.resize()
  assert.equal(frame.mounted, false); assert.equal(h.created.length, 1); assert.equal(observer.targets.size, 0)
  h.docEvents.nav(); assert.equal(h.created.length, 2)
  h.windowEvents.pagehide(); observer.resize()
  assert.equal(h.created.at(-1).mounted, false); assert.equal(h.created.length, 2)
  h.windowEvents.pageshow(); assert.equal(h.created.length, 3)
})

test('loaded iframe without provider ready keeps its cover; timeout falls back without a retry loop', async () => {
  const h = harness({ autoReady: false })
  await h.settle()
  // This is also the HTTP 403 case: iframe load is not a playback handshake.
  h.created[0].onload?.()
  assert.equal(h.sections[0].fallback.hidden, false)
  h.observers[0].resize()
  assert.equal(h.sections[0].fallback.hidden, false)
  const timer = [...h.timers.values()][0]; timer()
  assert.equal(h.created[0].mounted, false)
  assert.equal(h.sections[0].fallback.hidden, false)
  h.observers[0].resize()
  assert.equal(h.created.length, 1)
  assert.equal(h.created[0].mounted, false)
})

test('YouTube is muted through the API before playback, with no autoplay race or playlist', async () => {
  const h = harness({ provider: 'youtube', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&list=BAD&playlist=BAD&t=22' })
  await h.settle()
  const u = new URL(h.created[0].src)
  assert.equal(u.searchParams.get('autoplay'), '0')
  assert.equal(u.searchParams.get('enablejsapi'), '1')
  assert.equal(u.searchParams.get('playsinline'), '1')
  assert.equal(u.searchParams.get('origin'), h.location.origin)
  for (const key of ['list', 'playlist', 't']) assert.equal(u.searchParams.has(key), false)
  assert.deepEqual(h.calls, ['mute', 'play'])
  h.youtubeError()
  assert.equal(h.created[0].mounted, false)
  assert.equal(h.sections[0].fallback.hidden, false)
})

test('a late YouTube ready callback cannot play a departed System', async () => {
  const h = harness({ provider: 'youtube', url: 'https://www.youtube.com/embed/abcdefghijk', youtubeReady: false })
  await h.settle()
  h.windowEvents.pagehide(); h.youtubeReady()
  assert.deepEqual(h.calls, ['destroy'])
  assert.equal(h.created[0].mounted, false)
})

test('Bunny SDK loads before its iframe and observation cannot attach a pending player', async () => {
  const h = harness({ bunnySDK: false })
  assert.equal(h.scripts.length, 1)
  assert.equal(h.scripts[0].src, 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js')
  assert.notEqual(h.created[0].mounted, true)
  h.observers[0].resize(); h.docEvents.nav()
  assert.notEqual(h.created[0].mounted, true)
  assert.equal(h.sections[0].fallback.hidden, false)
  h.bunnySDKReady(); await h.settle()
  assert.equal(h.created[0].mounted, true)
  assert.equal(h.sections[0].fallback.hidden, true)
  assert.equal(h.created.length, 1)
})

test('Bunny SDK failure and provider error keep the course cover visible', async () => {
  const sdk = harness({ bunnySDK: false })
  sdk.scripts[0].events.error(); await sdk.settle()
  assert.equal(sdk.created[0].mounted, false)
  assert.equal(sdk.sections[0].fallback.hidden, false)
  const provider = harness(); await provider.settle(); provider.bunnyError()
  assert.equal(provider.created[0].mounted, false)
  assert.equal(provider.sections[0].fallback.hidden, false)
  assert.deepEqual(provider.bunnyCalls, ['off:ready', 'off:error'])
})

test('departing while Bunny SDK or provider readiness is pending cannot reveal a stale player', async () => {
  const sdk = harness({ bunnySDK: false })
  sdk.windowEvents.pagehide(); sdk.bunnySDKReady(); await sdk.settle()
  assert.equal(sdk.created[0].mounted, false)
  assert.equal(sdk.sections[0].fallback.hidden, false)
  const provider = harness({ autoReady: false }); await provider.settle()
  provider.windowEvents.pagehide(); provider.bunnyReady()
  assert.equal(provider.created[0].mounted, false)
  assert.equal(provider.created[0].src, 'about:blank')
  assert.equal(provider.sections[0].fallback.hidden, false)
  assert.deepEqual(provider.bunnyCalls, ['off:ready', 'off:error'])
})

test('YouTube iframe load alone and SDK failure do not hide the cover', async () => {
  const h = harness({ provider: 'youtube', url: 'https://www.youtube.com/embed/abcdefghijk', youtubeReady: false })
  await h.settle(); h.created[0].onload?.()
  assert.equal(h.sections[0].fallback.hidden, false)
  assert.equal(h.timers.size, 1)
  h.youtubeReady(); assert.equal(h.sections[0].fallback.hidden, true)
  const failed = harness({ provider: 'youtube', url: 'https://www.youtube.com/embed/abcdefghijk', youtubeSDK: false })
  failed.scripts[0].events.error(); await failed.settle()
  assert.equal(failed.created[0].mounted, false)
  assert.equal(failed.sections[0].fallback.hidden, false)
})
