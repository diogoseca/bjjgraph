import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../scripts/system_guide_media.js', import.meta.url), 'utf8')
function harness({ origins = ['https://bjjgraph.org'], url = 'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&preload=false', provider = 'bunny', visible = true } = {}) {
  const created = [], docEvents = {}, windowEvents = {}, observers = []
  const sections = [0, 1].map(i => {
    const target = { appendChild: frame => { frame.mounted = true; frame.parentNode = target } }
    const fallback = { hidden: false }
    return {
      dataset: { systemKey: 'fixture', embedUrl: url, verifiedOrigins: JSON.stringify(origins), provider, previewTitle: 'Official sample — fixture' },
      visible,
      getClientRects() { return this.visible ? [1] : [] },
      querySelector: selector => selector === '[data-preview-fallback]' ? fallback : target,
      fallback, target,
    }
  })
  const document = {
    querySelectorAll: () => sections,
    addEventListener: (name, fn) => { docEvents[name] = fn },
    createElement: tag => {
      const frame = { tag, style: {}, remove() { this.mounted = false; this.parentNode = null } }
      created.push(frame)
      return frame
    },
  }
  const location = { origin: 'https://bjjgraph.org', pathname: '/Systems/Fixture', href: 'https://bjjgraph.org/Systems/Fixture' }
  const window = { addEventListener: (name, fn) => { windowEvents[name] = fn } }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this) }
    observe(target) { this.targets.add(target) }
    unobserve(target) { this.targets.delete(target) }
    disconnect() { this.targets.clear() }
    resize() { this.callback([...this.targets].map(target => ({ target }))) }
  }
  const context = { document, window, location, URL, ResizeObserver }
  vm.runInNewContext('(function(){' + source + '\n})()', context)
  return { sections, created, docEvents, windowEvents, location, context, observers }
}

test('verified static preview mounts immediately without autoplay, once across hydration and scroll', () => {
  const h = harness()
  assert.equal(h.created.length, 1)
  const frame = h.created[0]
  assert.equal(frame.mounted, true)
  assert.equal(frame.title, 'Official sample — fixture')
  assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin')
  assert.equal(frame.allow.includes('autoplay'), false)
  assert.equal(h.sections[0].fallback.hidden, true)
  h.docEvents.nav()
  vm.runInNewContext('(function(){' + source + '\n})()', h.context)
  assert.equal(h.created.length, 1)
  assert.equal(h.observers.length, 1)
  h.observers[0].resize()
  assert.equal(h.created.length, 1)
  h.sections.shift() // Same-System replacement markup reuses the live frame.
  h.docEvents.nav()
  assert.equal(h.created.length, 1)
  assert.equal(frame.parentNode, h.sections[0].target)
  h.docEvents.click({ target: { closest: () => ({ href: '#sources' }) } })
  h.windowEvents.popstate()
  assert.equal(frame.mounted, true)
  h.docEvents.click({ target: { closest: () => ({ href: '/Systems/Another' }) } })
  assert.equal(frame.mounted, false)
  assert.equal(h.sections[0].fallback.hidden, false)
})

test('changed System and browser navigation stop old playback', () => {
  const h = harness(), first = h.created[0]
  h.sections[0].dataset.systemKey = 'another'
  h.docEvents.nav()
  assert.equal(first.mounted, false)
  assert.equal(h.created.length, 2)
  h.location.pathname = '/Systems/Another'
  h.windowEvents.popstate()
  assert.equal(h.created[1].mounted, false)
  h.docEvents.nav()
  h.windowEvents.pagehide()
  assert.equal(h.created.at(-1).mounted, false)
})

test('unverified, hidden, malformed and foreign previews keep honest fallback without any frame', () => {
  for (const options of [
    { origins: [] }, { visible: false },
    { origins: ['https://dev.bjjgraph.pages.dev'] },
    { url: 'https://iframe.mediadelivery.net.evil.test/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&preload=false' },
    { url: 'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=true&preload=false' },
    { url: 'javascript:alert(1)' },
  ]) {
    const h = harness(options)
    assert.equal(h.created.length, 0)
    assert.equal(h.sections[0].fallback.hidden, false)
  }
  const youtube = harness({ provider: 'youtube', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=0' })
  assert.equal(youtube.created[0].mounted, true)
})


test('late static reveal mounts once; subsequent hiding stops playback and reveal can recover', () => {
  const h = harness({ visible: false }), observer = h.observers[0]
  assert.equal(h.created.length, 0)
  assert.equal(observer.targets.size, 2)
  observer.resize()
  assert.equal(h.created.length, 0)
  h.sections[0].visible = true // revealStaticArticle after Neural failed to load
  observer.resize()
  assert.equal(h.created.length, 1)
  assert.equal(h.created[0].mounted, true)
  assert.equal(h.sections[0].fallback.hidden, true)
  observer.resize()
  assert.equal(h.created.length, 1)
  h.sections[0].visible = false
  observer.resize()
  assert.equal(h.created[0].mounted, false)
  assert.equal(h.sections[0].fallback.hidden, false)
  h.sections[0].visible = true
  observer.resize()
  assert.equal(h.created.length, 2)
  h.sections.length = 0 // removed article also receives a zero-size notification
  observer.resize()
  assert.equal(h.created[1].mounted, false)
  assert.equal(observer.targets.size, 0)
})

test('navigation suspends observation so queued callbacks cannot remount the departing guide', () => {
  const h = harness(), observer = h.observers[0], frame = h.created[0]
  h.docEvents.click({ target: { closest: () => ({ href: '/Systems/Another' }) } })
  observer.resize() // a delivery queued before disconnect must remain harmless
  assert.equal(frame.mounted, false)
  assert.equal(h.created.length, 1)
  assert.equal(observer.targets.size, 0)
  h.docEvents.nav()
  assert.equal(h.created.length, 2)
  assert.equal(observer.targets.size, 2)
  h.windowEvents.pagehide()
  observer.resize()
  assert.equal(h.created.at(-1).mounted, false)
  assert.equal(h.created.length, 2)
  assert.equal(observer.targets.size, 0)
  h.windowEvents.pageshow() // back-forward cache restoration resumes observation
  assert.equal(h.created.length, 3)
  assert.equal(observer.targets.size, 2)
})

test('back navigation suspends a still-hidden guide before it can reveal', () => {
  const h = harness({ visible: false }), observer = h.observers[0]
  h.location.pathname = '/Systems/Another'
  h.windowEvents.popstate()
  h.sections[0].visible = true
  observer.resize()
  assert.equal(h.created.length, 0)
  assert.equal(observer.targets.size, 0)
  h.docEvents.nav()
  assert.equal(h.created.length, 1)
})

test('late reveal still rejects unverified origins and invalid provider URLs', () => {
  for (const options of [{ origins: [] }, { url: 'https://foreign.test/embed/video' }]) {
    const h = harness({ ...options, visible: false })
    h.sections[0].visible = true
    h.observers[0].resize()
    assert.equal(h.created.length, 0)
    assert.equal(h.sections[0].fallback.hidden, false)
  }
})
