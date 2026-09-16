import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../scripts/system_guide_media.js', import.meta.url), 'utf8')
function harness({ origins = ['https://bjjgraph.org'], url = 'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&preload=false', provider = 'bunny' } = {}) {
  const created = [], docEvents = {}, windowEvents = {}
  const sections = [0, 1].map(() => {
    const listeners = {}
    const button = { hidden: true, dataset: {}, addEventListener: (name, fn) => { listeners[name] = fn } }
    const target = { appendChild: frame => { frame.mounted = true } }
    return {
      dataset: { embedUrl: url, verifiedOrigins: JSON.stringify(origins), provider, previewTitle: 'Official sample — fixture' },
      querySelector: selector => selector === '[data-load-preview]' ? button : target,
      button, listeners,
    }
  })
  const document = {
    querySelectorAll: () => sections,
    addEventListener: (name, fn) => { docEvents[name] = fn },
    createElement: tag => {
      const frame = { tag, style: {}, remove() { this.mounted = false } }
      created.push(frame)
      return frame
    },
  }
  vm.runInNewContext(source, { document, window: { addEventListener: (name, fn) => { windowEvents[name] = fn } }, location: { origin: 'https://bjjgraph.org' }, URL })
  return { sections, created, docEvents, windowEvents }
}

test('static player creates no iframe before click, allows one active frame, and stops on navigation', () => {
  const h = harness()
  assert.equal(h.created.length, 0)
  assert.equal(h.sections[0].button.hidden, false)
  h.sections[0].listeners.click()
  const first = h.created[0]
  assert.equal(first.mounted, true)
  assert.equal(first.title, 'Official sample — fixture')
  assert.equal(first.referrerPolicy, 'strict-origin-when-cross-origin')
  assert.equal(first.allow.includes('autoplay'), false)
  h.sections[1].listeners.click()
  assert.equal(first.mounted, false)
  assert.equal(h.sections[0].button.hidden, false)
  assert.equal(h.created[1].mounted, true)
  h.docEvents.nav()
  assert.equal(h.created[1].mounted, false)
  h.sections[0].listeners.click()
  h.windowEvents.pagehide()
  assert.equal(h.created.at(-1).mounted, false)
  h.sections[0].listeners.click()
  h.docEvents.click({ target: { closest: () => ({ target: '' }) } })
  assert.equal(h.created.at(-1).mounted, false)
})

test('unverified origins and malformed/foreign players keep the official-link-only state', () => {
  for (const options of [
    { origins: [] },
    { origins: ['https://dev.bjjgraph.pages.dev'] },
    { url: 'https://iframe.mediadelivery.net.evil.test/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=false&preload=false' },
    { url: 'https://iframe.mediadelivery.net/embed/596460/70f6a194-5a06-4114-b450-292e1373dff8?autoplay=true&preload=false' },
    { url: 'javascript:alert(1)' },
  ]) {
    const h = harness(options)
    assert.equal(h.created.length, 0)
    assert.equal(h.sections[0].button.hidden, true)
    assert.equal(h.sections[0].listeners.click, undefined)
  }
  const youtube = harness({ provider: 'youtube', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=0' })
  assert.equal(youtube.sections[0].button.hidden, false)
  youtube.sections[0].listeners.click()
  assert.equal(youtube.created[0].mounted, true)
})
