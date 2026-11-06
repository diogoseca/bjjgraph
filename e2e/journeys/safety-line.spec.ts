import { expect, test, type Page } from '@playwright/test'
import { journey } from '../dsl'

// S1 a (owner, 2026-11-06): "A: the guide last, one line above the steps". On a submission the full
// Safety Guide is the last teaching section and the one rule sits directly above what it governs. S2 b: the
// rule is plain text and only "Safety guide ↓" is the link. S3 a: a family page carries no line. The
// measured study is orchestrator reports/safety-placement-ux.md; the wording's line counts are in
// reports/safety-last.md. Controls and their kills are recorded at the foot of this file.
// FONT: e2e/dsl.ts stubs Google Fonts, so every journey here lays out in a fallback face. Only the one
// test that loads the real font says anything about a break width. It needs the network and fails loud
// without it, which is why it is not @curated: a font CDN outage must not stop a deploy.
const READY = '[data-reader][data-reader-ready="true"]'
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }
const HUB = '/Submissions/Americana/from-Side-Control'
const ATTACKER = HUB + '/Attacker', DEFENDER = HUB + '/Defender', FAMILY = '/Submissions/Americana'
// U+00A0 keeps the link's label whole, so a wrap can never leave the arrow alone on a line.
const LABEL = 'Safety\u00a0guide\u00a0↓'
const ATTACKER_LINE = 'Release immediately upon tap. ' + LABEL, DEFENDER_LINE = 'Tap early and often. ' + LABEL
const BODY = '[data-reader-body]', GUIDE_LINK = BODY + ' blockquote a[data-reader-anchor="safety-considerations"]'

async function open(page: Page, path: string, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  const j = journey(page)
  await j.boot(path, { initialState: QUIET })
  await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
  await j.readerLayoutSettled()
  return j
}
const openTypes = (page: Page) => page.locator(BODY + ' > .ng-section-card').evaluateAll(cards => cards.map(c => c.getAttribute('data-section-type')!))
const indexTypes = (page: Page) => page.locator('.ng-reader-toc-row[data-toc-type]').evaluateAll(rows => rows.map(r => r.getAttribute('data-toc-type')!))
function guideIsLast(types: string[], what: string) {
  expect(types, `${what}: the guide exists`).toContain('safety')
  expect(types.filter(t => t !== 'related').at(-1), `${what}: nothing teaches after the guide`).toBe('safety')
  if (types.includes('related')) expect(types.at(-1), `${what}: Related stays below the guide`).toBe('related')
}

/** The click lands on the link's OWN box: a wrapped link's centre is not on the link. */
async function clickOwnBox(page: Page, selector: string) {
  // Fail here, at a claim: a missing link would otherwise wait out the whole test timeout, and a timeout is no kill.
  await expect(page.locator(selector).first(), 'the line is a reader anchor').toBeAttached()
  const hit = await page.locator(selector).first().evaluate(a => {
    a.scrollIntoView({ block: 'center' })
    const box = a.getClientRects()[0], x = box.left + box.width / 2, y = box.top + box.height / 2
    return { x, y, width: box.width, boxes: a.getClientRects().length, own: document.elementFromPoint(x, y) === a }
  })
  expect(hit.width, 'the link has a box').toBeGreaterThan(0)
  expect(hit.own, 'the point is on the link').toBe(true)
  await page.mouse.click(hit.x, hit.y)
  return hit
}
const guideInView = (page: Page) => page.evaluate(() => {
  const guide = document.querySelector('[data-section-type="safety"] [data-source-id="safety-considerations"]')
  const root = document.querySelector('[data-reader]')!
  if (!guide) return { found: false, top: 0, rootTop: 0, rootBottom: 0, focused: false }
  const g = guide.getBoundingClientRect(), r = root.getBoundingClientRect()
  return { found: true, top: g.top, rootTop: r.top, rootBottom: Math.min(r.bottom, innerHeight), focused: document.activeElement === guide }
})

for (const path of [ATTACKER, DEFENDER, HUB, FAMILY]) {
  test(`@curated the guide is the last teaching section, in the page and its index: ${path}`, async ({ page }) => {
    const j = await open(page, path, 1440)
    guideIsLast(await openTypes(page), 'page')
    guideIsLast(await indexTypes(page), 'index')
    // A DOM move survives idle and resize, then snaps back here: syncSections re-sorts from this.sections.
    await j.clickByMouse('[data-section-toggle="overview"]', 'close a section so syncSections re-sorts')
    await j.readerLayoutSettled()
    const open_ = await openTypes(page)
    expect(open_, 'the closed section left').not.toContain('overview')
    guideIsLast(open_, 'after a re-sort')
  })
}

test('@curated a transition shares the section id and keeps its guide in place', async ({ page }) => {
  await open(page, '/Transitions/Knee-Slice-Pass/Attacker', 1440)
  const types = await openTypes(page)
  expect(types).toEqual(expect.arrayContaining(['options', 'safety', 'mistakes']))
  expect(types.indexOf('safety'), 'directly after the options').toBe(types.indexOf('options') + 1)
  expect(types.indexOf('safety'), 'and above the mistakes').toBeLessThan(types.indexOf('mistakes'))
})

for (const width of [390, 1440]) {
  test(`@curated neither top notice survives and the seat's line sits on its steps at ${width}`, async ({ page }) => {
    await open(page, ATTACKER, width)
    const seat = () => page.locator(BODY).evaluate(body => {
      const quotes = [...body.querySelectorAll('blockquote')]
      return { lines: quotes.map(q => (q.textContent || '').trim()), links: quotes.map(q => q.querySelector('a')?.textContent),
        next: quotes.map(q => q.nextElementSibling?.getAttribute('data-source-id')),
        sections: quotes.map(q => q.closest('.ng-section-card')?.getAttribute('data-section-type')),
        callouts: body.querySelectorAll('.callout.danger').length, text: (body.textContent || '').replace(/\s+/g, ' ') }
    })
    const attacker = await seat()
    expect(attacker).toMatchObject({ lines: [ATTACKER_LINE], links: [LABEL], next: ['execution-steps'], sections: ['options'], callouts: 0 })
    expect(attacker.text).not.toMatch(/SAFETY:|Primary risk:|Risk: /)
    // J6 / S1 item 6: this page's guide no longer contradicts its own "release on any tap".
    expect(attacker.text).toMatch(/Physical hand tap on opponent or mat/)
    expect(attacker.text).not.toMatch(/minimum (2|two) taps/i)

    await open(page, DEFENDER, width)
    const defender = await seat()
    expect(defender).toMatchObject({ lines: [DEFENDER_LINE], links: [LABEL], next: ['defensive-options'], sections: ['options'], callouts: 0 })
    expect(defender.text).not.toMatch(/SAFETY:|Primary risk:/)
    // The defender's own words, never the attacker's rule.
    expect(defender.lines[0]).not.toMatch(/release/i)
  })
}

test('@curated the hub carries each seat\'s line, and a family carries none', async ({ page }) => {
  await open(page, HUB, 1440)
  const hub = await page.locator(BODY + ' blockquote').evaluateAll(quotes => quotes.map(q => ({
    text: (q.textContent || '').trim(), next: q.nextElementSibling?.getAttribute('data-source-id'),
    section: q.closest('.ng-section-card')?.getAttribute('data-section-type') })))
  // The old hub notice spoke to both seats, so the hub keeps a line for each. The attacker's shows twice in the
  // app, once above the guide's steps and once above the hub's own, and it is the only line the no-JS hub has there.
  expect(hub).toEqual([
    { text: ATTACKER_LINE, next: 'execution-steps', section: 'options' },
    { text: ATTACKER_LINE, next: 'execution-steps', section: 'attacker-summary' },
    { text: DEFENDER_LINE, next: 'escape-paths', section: 'defender-summary' },
  ])
  await open(page, FAMILY, 1440)
  await expect(page.locator(BODY + ' .callout.danger')).toHaveCount(0)
  await expect(page.locator(GUIDE_LINK)).toHaveCount(0)
})

for (const width of [360, 390, 1440]) for (const path of [ATTACKER, DEFENDER]) {
  test(`@curated the line's real click reaches the guide and keeps the seat at ${width}: ${path}`, async ({ page }) => {
    await open(page, path, width, width === 390 ? 631 : 900)
    const before = await page.evaluate(() => history.length)
    await clickOwnBox(page, GUIDE_LINK)
    await expect.poll(() => new URL(page.url()).hash).toBe('#safety-considerations')
    await expect.poll(() => guideInView(page).then(g => g.focused), 'the click reached the guide').toBe(true)
    const guide = await guideInView(page)
    expect(guide.top, 'the guide is on screen').toBeGreaterThanOrEqual(guide.rootTop - 1)
    expect(guide.top, 'the guide is on screen').toBeLessThan(guide.rootBottom)
    expect(new URL(page.url()).pathname, 'the seat stays').toBe(path)
    await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
    expect(await page.evaluate(() => history.length), 'an anchor adds no history').toBe(before)
  })
}

test('@curated the line opens a closed guide, and a reload lands on it', async ({ page }) => {
  const j = await open(page, ATTACKER, 1440)
  const close = page.locator('[data-section-toggle="safety"]')
  await close.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
  await j.clickByMouse('[data-section-toggle="safety"]', 'close the guide')
  await j.readerLayoutSettled()
  expect(await openTypes(page)).not.toContain('safety')
  await clickOwnBox(page, GUIDE_LINK)
  await expect.poll(() => openTypes(page), 'the click reopened it').toContain('safety')
  guideIsLast(await openTypes(page), 'reopened')
  await expect.poll(() => guideInView(page).then(g => g.focused)).toBe(true)
  // The seat's own URL with the hash arrives on the guide, which lives in the hub's fragment.
  await page.reload()
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', ATTACKER)
  await expect.poll(() => guideInView(page).then(g => g.focused), 'the reload landed on the guide').toBe(true)
  await j.readerLayoutSettled()
  // A reload settles in one of two stable places, 18px apart (5 of 14 runs at 1440): a late layout moves the page
  // after anchor() has scrolled. A click never does this. The guide's top is at most 12px past the reader's top then,
  // so the claim is "landed on the guide", within 24px, not the click's exact landing.
  const guide = await guideInView(page)
  expect(guide.top, 'the guide is on screen').toBeGreaterThanOrEqual(guide.rootTop - 24)
  expect(guide.top, 'the guide is on screen').toBeLessThan(guide.rootBottom)
})

test('@curated the hub line reaches the guide from the hub', async ({ page }) => {
  await open(page, HUB, 390, 631)
  await clickOwnBox(page, GUIDE_LINK)
  await expect.poll(() => new URL(page.url()).hash).toBe('#safety-considerations')
  await expect.poll(() => guideInView(page).then(g => g.focused)).toBe(true)
  expect(new URL(page.url()).pathname).toBe(HUB)
})

const lineBoxes = (page: Page) => page.locator(BODY + ' blockquote').first().evaluate(q => {
  const p = q.querySelector('p')!, a = q.querySelector('a')!, r = document.createRange(); r.selectNodeContents(p)
  // The rule is the p's text and the label the a's, and Quartz sets hyphens:auto on each, so read both.
  return { text: (q.textContent || '').trim(), lines: new Set([...r.getClientRects()].filter(b => b.width > 0).map(b => Math.round(b.top))).size,
    linkBoxes: a.getClientRects().length, hyphens: [getComputedStyle(p).hyphens, getComputedStyle(a).hyphens] }
})

test('@curated a wrapped line never hyphenates and keeps its link whole', async ({ page }) => {
  // The reader floors its text box at 198px, so 240 wraps both lines in any face. One box means the label never broke.
  for (const [path, text] of [[ATTACKER, ATTACKER_LINE], [DEFENDER, DEFENDER_LINE]]) {
    await open(page, path, 240, 631)
    const line = await lineBoxes(page)
    expect(line).toMatchObject({ text, linkBoxes: 1, hyphens: ['none', 'none'] })
    expect(line.lines, 'this width really wraps').toBeGreaterThan(1)
  }
})

test('in the real font the lines take the shape the owner chose', async ({ page }) => {
  for (const [width, attacker, defender] of [[360, 2, 2], [390, 2, 1], [1440, 1, 1]] as const) {
    for (const [path, text, lines] of [[ATTACKER, ATTACKER_LINE, attacker], [DEFENDER, DEFENDER_LINE, defender]] as const) {
      await open(page, path, width, 640)
      await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.continue())
      await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap' })
      const loaded = await page.evaluate(async () => {
        await document.fonts.load('16px "Plus Jakarta Sans"')
        await document.fonts.ready
        // document.fonts.check() answers true for a family nobody declared, so read the faces themselves.
        return [...document.fonts].filter(f => /Jakarta/.test(f.family) && f.status === 'loaded').length
      })
      expect(loaded, 'the real font loaded, or this measured nothing').toBeGreaterThan(0)
      expect(await lineBoxes(page), `${path} at ${width}`).toMatchObject({ text, lines, linkBoxes: 1 })
    }
  }
})

for (const path of [ATTACKER, DEFENDER]) {
  test(`@curated without the app the seat's link still reaches the hub's guide: ${path}`, async ({ page }) => {
    await open(page, path, 1440)
    const proof = await page.evaluate(async path => {
      const load = async (p: string) => { const r = await fetch(p); if (r.status !== 200) throw new Error(p + ': ' + r.status); return new DOMParser().parseFromString(await r.text(), 'text/html') }
      const seat = await load(path), links = [...seat.querySelectorAll('article blockquote a')]
      const url = new URL(links[0]!.getAttribute('href')!, location.origin + path), hub = await load(url.pathname)
      return { count: links.length, path: url.pathname, hash: url.hash, guide: !!hub.querySelector('article #safety-considerations'), own: !!seat.querySelector('article #safety-considerations') }
    }, path)
    expect(proof).toEqual({ count: 1, path: HUB, hash: '#safety-considerations', guide: true, own: false })
  })
}

// CONTROLS (own built tree, 2026-11-06, v1.250.0, the owner's S2 b): 17 of 17 killed at an assertion, 0 test timeouts,
// and a clean run of all 20 tests before and after. Each named the test below; other reds in the same run do not count.
//   order-removed                 the guide is the last teaching section
//   order-all-pages               a transition shares the section id
//   anchor-own-fragment-only      the line's real click reaches the guide
//   hub-link-not-recognised       the line's real click reaches the guide
//   hyphens-back                  a wrapped line never hyphenates
//   hyphens-on-the-link-only      a wrapped line never hyphenates (the p, which holds the rule)
//   padding-narrower              in the real font the lines take the shape the owner chose (Defender at 390)
//   label-glue-removed            a wrapped line keeps its link whole
//   rule-inside-the-link          the seat's line sits on its steps (only the label is a link)
//   seat-notice-back              neither top notice survives
//   line-below-the-heading        the seat's line sits on its steps
//   defender-given-attacker-rule  the seat's line sits on its steps
//   two-taps-back                 neither top notice survives
//   seat-link-in-page-only        without the app the seat's link still reaches the hub's guide
//   family-notice-back            the hub carries each seat's line, and a family carries none
//   hub-attacker-line-removed     the hub carries each seat's line
//   hub-defender-line-removed     the hub carries each seat's line
// Not a control here: article_sections_mutants.mjs defender-hub-leak covers the selector the reader keeps.
// Partially pinned: one DUAL page and one family page. The corpus-wide counts are a grep of the Markdown, not a gate.
