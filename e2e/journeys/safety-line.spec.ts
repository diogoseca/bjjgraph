import { expect, test, type Page } from '@playwright/test'
import { journey } from '../dsl'

// S1 a (owner, 2026-11-06): "A: the guide last, one line above the steps". On a submission the full
// Safety Guide is the last teaching section and the one rule sits directly above what it governs. S2 b: the
// rule is plain text and only its "↓" label is the link; U113 b (2026-11-09) names it "Injury risks ↓", as the section now is. S3 a: a family page carries no line. The
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
const LABEL = 'Injury\u00a0risks\u00a0↓'
const ATTACKER_LINE = 'Release immediately upon tap. ' + LABEL, DEFENDER_LINE = 'Tap early and often. ' + LABEL
const BODY = '[data-reader-body]', GUIDE_LINK = BODY + ' blockquote a[data-reader-anchor="safety-considerations"]'
// U112 a (owner, 2026-11-09): the guide itself now ends in a quoted line, so the rule lines are the quotes OUTSIDE it.
const GUIDE = '[data-source-id="safety-considerations"]'
const CLOSING = 'Go slow. Apply this gradually, with a partner who knows it is coming, and let go the moment they tap, by hand, foot or voice.'

async function open(page: Page, path: string, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  const j = journey(page)
  await j.boot(path, { initialState: QUIET })
  await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
  await j.readerLayoutSettled()
  return j
}
// RED4 (PR #372 shard 4). WAS: every tile directly in the body, since a close MOVED its tile into the "Hidden sections" fold.
// NOW (U131 b2, owner 2026-11-11): a closed tile stays where it is, holding only its message for 5s and then hidden, so it never
// leaves the body. A tile is open when it AND its content are rendered (no client rect = hidden, display:none or under one).
const openTypes = (page: Page) => page.locator(BODY + ' > .ng-section-card').evaluateAll(cards => cards
  .filter(c => c.getClientRects().length > 0 && [...c.querySelectorAll(':scope > .ng-section-body')].some(b => b.getClientRects().length > 0))
  .map(c => c.getAttribute('data-section-type')!))
const tile = (type: string) => BODY + ` > .ng-section-card[data-section-type="${type}"]`
/** b2: a closed tile first holds its message, then leaves nothing. Move the mouse off it: a hovered message never leaves. */
async function messageGoes(page: Page, type: string) {
  await expect(page.locator(tile(type) + ' [data-hidesec-notice]'), 'only its message stands in its place').toHaveCount(1)
  await page.mouse.move(page.viewportSize()!.width - 8, 8)
  await expect(page.locator(tile(type)), 'and nothing is left once its message has gone').toBeHidden({ timeout: 15000 })
}
const indexTypes = (page: Page) => page.locator('.ng-reader-toc-row[data-toc-type]').evaluateAll(rows => rows.map(r => r.getAttribute('data-toc-type')!))
function guideIsLast(types: string[], what: string) {
  expect(types, `${what}: the guide exists`).toContain('safety')
  expect(types.filter(t => t !== 'related').at(-1), `${what}: nothing teaches after the guide`).toBe('safety')
  if (types.includes('related')) expect(types.at(-1), `${what}: Related stays below the guide`).toBe('related')
}

/** The click lands on the link's OWN box: a wrapped link's centre is not on the link. */
async function clickOwnBox(page: Page, j: ReturnType<typeof journey>, selector: string) {
  const link = page.locator(selector).first()
  // Fail here, at a claim: a missing link would otherwise wait out the whole test timeout, and a timeout is no kill.
  await expect(link, 'the line is a reader anchor').toBeAttached()
  await link.evaluate(a => a.scrollIntoView({ block: 'center' }))
  // A settling layout can move the box between reading it and pressing it.
  await j.readerLayoutSettled()
  const hit = await link.evaluate(a => {
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
    // WAS: a close moved the tile into the fold and syncSections re-sorted the body from this.sections (a DOM move survives idle and
    // resize, then snapped back here). NOW (U131 b2): nothing moves on a close, so the order is read at both of b2's moments: while
    // the message stands, and once the place is gone. The closed section's content leaves at once.
    await j.clickByMouse('[data-section-toggle="overview"]', 'close a section')
    await j.readerLayoutSettled()
    const held = await openTypes(page)
    expect(held, 'the closed section left').not.toContain('overview')
    guideIsLast(held, 'while its message stands')
    await messageGoes(page, 'overview')
    const open_ = await openTypes(page)
    expect(open_, 'the closed section stays gone').not.toContain('overview')
    guideIsLast(open_, 'once its place is gone')
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
      const quotes = [...body.querySelectorAll('blockquote')].filter(q => !q.closest('[data-source-id="safety-considerations"]'))
      return { closing: [...body.querySelectorAll('[data-source-id="safety-considerations"] blockquote')].map(q => (q.textContent || '').replace(/\s+/g, ' ').trim()),
        lines: quotes.map(q => (q.textContent || '').trim()), links: quotes.map(q => q.querySelector('a')?.textContent),
        next: quotes.map(q => q.nextElementSibling?.getAttribute('data-source-id')),
        sections: quotes.map(q => q.closest('.ng-section-card')?.getAttribute('data-section-type')),
        callouts: body.querySelectorAll('.callout.danger').length, text: (body.textContent || '').replace(/\s+/g, ' ') }
    })
    const attacker = await seat()
    expect(attacker).toMatchObject({ lines: [ATTACKER_LINE], links: [LABEL], next: ['execution-steps'], sections: ['options'], callouts: 0 })
    expect(attacker.text).not.toMatch(/SAFETY:|Primary risk:|Risk: /)
    // J6 / S1 item 6: this page's guide no longer contradicts its own "release on any tap". U112 a: the guide no longer lists
    // tap signals at all; its one closing line names every tap, and nothing on the page asks for two.
    expect(attacker.closing, 'U112 a: the guide closes with its one line').toEqual([CLOSING])
    expect(attacker.text).not.toMatch(/minimum (2|two) (distinct )?taps/i)

    await open(page, DEFENDER, width)
    const defender = await seat()
    expect(defender).toMatchObject({ lines: [DEFENDER_LINE], links: [LABEL], next: ['defensive-options'], sections: ['options'], callouts: 0, closing: [CLOSING] })
    expect(defender.text).not.toMatch(/SAFETY:|Primary risk:/)
    // The defender's own words, never the attacker's rule.
    expect(defender.lines[0]).not.toMatch(/release/i)
  })
}

test('@curated the hub carries each seat\'s line, and a family carries none', async ({ page }) => {
  await open(page, HUB, 1440)
  const hub = await page.locator(BODY + ' blockquote').evaluateAll(quotes => quotes.filter(q => !q.closest('[data-source-id="safety-considerations"]')).map(q => ({
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
  // U112 a: a family's guide ends in the closing line too; the S3 a rule is about the line above the steps, and it has none.
  await expect(page.locator(BODY + ' blockquote')).toHaveCount(1)
  await expect(page.locator(BODY + ' ' + GUIDE + ' blockquote')).toHaveText(CLOSING)
  // S2 b's rule is plain text, so looking for the link alone would pass a family page that grew the rule.
  const family = ((await page.locator(BODY).textContent()) || '').replace(/\s+/g, ' ')
  expect(family.length, 'this read the family article').toBeGreaterThan(1000)
  expect(family).not.toContain('Release immediately upon tap')
  expect(family).not.toContain('Tap early and often')
})

for (const width of [360, 390, 1440]) for (const path of [ATTACKER, DEFENDER]) {
  test(`@curated the line's real click reaches the guide and keeps the seat at ${width}: ${path}`, async ({ page }) => {
    const j = await open(page, path, width, width === 390 ? 631 : 900)
    const before = await page.evaluate(() => history.length)
    await clickOwnBox(page, j, GUIDE_LINK)
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
  expect(await openTypes(page), 'the guide closed').not.toContain('safety')
  // WAS: the line was pressed at once, the guide sitting closed in the fold. NOW (U131 b2): the closed guide's steady state is
  // its tile hidden, so the line is pressed once the message has gone. Under the old openTypes this reopen was vacuous on b2:
  // the hidden tile was still a child of the body (safety-anchor-no-reopen, foot of this file).
  await messageGoes(page, 'safety')
  expect(await openTypes(page), 'the guide stays closed').not.toContain('safety')
  await clickOwnBox(page, j, GUIDE_LINK)
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

// Three lines show on a hub. The first is the Attacker fragment's, whose link names the hub. The other two are the
// hub's own, in-page links, the only ones the no-JS hub has.
for (const [line, section] of [['guide fragment', 'options'], ['own attacker', 'attacker-summary'], ['own defender', 'defender-summary']] as const) {
  test(`@curated the hub's ${line} line reaches the guide`, async ({ page }) => {
    const j = await open(page, HUB, 390, 631)
    await clickOwnBox(page, j, `${BODY} [data-section-type="${section}"] blockquote a[data-reader-anchor]`)
    await expect.poll(() => new URL(page.url()).hash).toBe('#safety-considerations')
    await expect.poll(() => guideInView(page).then(g => g.focused), 'the click reached the guide').toBe(true)
    const guide = await guideInView(page)
    expect(guide.top, 'the guide is on screen').toBeGreaterThanOrEqual(guide.rootTop - 1)
    expect(guide.top, 'the guide is on screen').toBeLessThan(guide.rootBottom)
    expect(new URL(page.url()).pathname).toBe(HUB)
  })
}

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

// CONTROLS (own built tree, 2026-11-06, v1.250.0, the owner's S2 b): 22 of 22 killed at an assertion, 0 test timeouts,
// and a clean run of all 22 tests before and after. Each named the test below; other reds in the same run do not count.
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
//   family-plain-rule             the hub carries each seat's line, and a family carries none (the rule's own words)
//   hub-attacker-line-removed     the hub carries each seat's line
//   hub-defender-line-removed     the hub carries each seat's line
//   hub-attacker-link-dead        the hub's own attacker line reaches the guide
//   hub-defender-link-dead        the hub's own defender line reaches the guide
//   reload-does-not-anchor        the line opens a closed guide, and a reload lands on it
//   reload-past-the-guide         the line opens a closed guide, and a reload lands on it (the 24px tolerance)
// RED4 (2026-11-11, U131 b2, PR #372 shard 4): the two closed-section tests were red on b2 because openTypes counted a closed tile
// that no longer leaves the body (measured: it holds its 44px message, then is hidden at 0px). Rewritten above (WAS/NOW); the
// controls that reach them now live in tests/artifacts/article_sections_mutants.mjs, each killed at its own assertion against a
// green baseline on the own build:
//   safety-order-removed           order-removed, ported: nothing teaches after the guide
//   safety-closed-content-stays    the closed section left (the guide's content left on screen under its message)
//   safety-closed-tile-stays       nothing is left once its message has gone
//   safety-anchor-no-reopen        the click reopened it (the old openTypes could not tell a reopened guide from a hidden one)
//   safety-reload-does-not-anchor  reload-does-not-anchor, ported: the reload landed on the guide
// Not a control here: article_sections_mutants.mjs defender-hub-leak covers the selector the reader keeps.
// Partially pinned: one DUAL page and one family page. The corpus-wide counts are a grep of the Markdown, not a gate.
