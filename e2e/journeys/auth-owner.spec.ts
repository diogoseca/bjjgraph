import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { journey } from '../dsl'
import { installNeuralAuthSDK } from '../fixtures/neural-auth-sdk'

// Actual emitted app + owner host + SSG facade; synthetic SDK identities/database.
// No __bjjAuth replacement, direct _applyUser injection, raw account-blob seeding,
// production auth bypass or real backend traffic. Native model work is orthogonal.
const A = 'auth-owner-a', B = 'auth-owner-b'
const observed = new WeakMap<Page, { errors: string[], forbidden: string[] }>()

test.beforeAll(async ({ request }) => {
  for (const [url, path] of [
    ['/static/neural/app/neural.js', 'neural/dist/neural.js'],
    ['/static/neural/app/neural.css', 'neural/dist/neural.css'],
    ['/postscript.js', 'source/public/postscript.js'],
    ['/prescript.js', 'source/public/prescript.js'],
  ]) {
    const response = await request.get(url)
    expect(response.ok(), url).toBe(true)
    const bytes = await response.body(), sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
    expect(sha(bytes), 'served checkout artifact ' + url).toBe(sha(readFileSync(path)))
    if (url === '/postscript.js') expect(bytes.toString(), 'fresh SSG auth facade is required; do not inject a replacement').toContain('resolveNeuralUser')
    if (url === '/prescript.js') expect(bytes.toString(), 'current recovery visibility rule is required').toContain('#neural-progress-recovery')
  }
})

test.afterEach(async ({ page }) => {
  const seen = observed.get(page)
  if (seen) {
    expect(seen.errors, 'page errors').toEqual([])
    expect(seen.forbidden, 'SDK/backend/CDN or production model worker must not be requested').toEqual([])
  }
})

async function bootOwner(page: Page) {
  const seen = { errors: [] as string[], forbidden: [] as string[] }
  observed.set(page, seen)
  page.on('pageerror', error => seen.errors.push(error.message))
  page.on('request', request => {
    const url = request.url()
    if (/supabase|\/app\/game-model\.worker\.js(?:\?|$)/.test(url)) seen.forbidden.push(url)
  })
  const j = journey(page)
  await j.boot('/', {
    keepTutorial: true,
    beforeNavigate: async page => {
      await installNeuralAuthSDK(page)
      // Registered after the DSL catch-all, before the first navigation/import.
      await page.route(/\/app\/game-values\.js(?:\?|$)/, route => route.abort('failed'))
    },
  })
  await expect.poll(() => page.evaluate(() => {
    const auth = (window as any).__bjjAuth
    return { version: auth?.neuralSyncVersion, resolve: typeof auth?.resolveNeuralUser }
  })).toEqual({ version: 2, resolve: 'function' })
  await waitOwner(page, null)
  return j
}

async function waitOwner(page: Page, id: string | null) {
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural
    return { owner: a?._progressOwner?.id || null, kind: a?._progressOwner?.kind,
      loaded: !!a?._progressLoaded && !!a?.nodes?.length, current: !!a?._progressCurrent?.(),
      subscribed: !!a?._authSubscribed, user: a?._authUserId || null }
  }), { timeout: 30_000 }).toEqual({ owner: id, kind: id ? 'account' : 'guest', loaded: true, current: true, subscribed: true, user: id })
  await expect(page.locator('#neural-progress-recovery')).toHaveCount(0)
}

async function emitOwner(page: Page, id: string | null, event = id ? 'SIGNED_IN' : 'SIGNED_OUT') {
  await page.evaluate(({ id, event }) => (window as any).__authOwnerFixture.emit(event, id), { id, event })
  await waitOwner(page, id)
}

async function addList(page: Page, name: string) {
  // Use the same app list methods as its controls, never seed an owner envelope.
  const added = await page.evaluate(name => {
    const a = (window as any).__neural
    const node = a.nodes.find((n: any) => n.o != null && n.ty === 'positions')
    if (!node) throw new Error('No authored listable position')
    const id = a.newList(name), result = a.addToList(node.id, id)
    a._flushSave()
    return { id, added: result.added }
  }, name)
  expect(added.added).toBe(true)
  return added.id
}

const names = (page: Page) => page.evaluate(() => Object.values((window as any).__neural.lists || {}).map((row: any) => row.name).sort())
const fixture = (page: Page) => page.evaluate(() => (window as any).__authOwnerFixture.snapshot())

// QREV7 M1 (quartz-cto, 2026-09-29): a GUEST NEVER LOADS THE SDK. The fixture supplies a keyed
// config, so `isConfigured()` is true exactly as on a deploy; a signed-out arrival must still create
// no client, because loading the SDK to learn "guest" put a third-party fetch on every visitor's
// boot with mount waiting on it. Mutant, recorded: dropping the `!isAuthenticated() && !_sdkLoading`
// gate in supabase.ts `resolveNeuralUser` turns this red on `clients` (0 -> 1).
test('@curated a signed-out guest on a keyed config never creates an SDK client', async ({ page }) => {
  await bootOwner(page)
  expect((await fixture(page)).clients, 'a guest boot must not load or create the Supabase client').toBe(0)
})

// QREV7 M2: VERSION SKEW. postscript.js and neural.js are both cached 4 h + 1 d SWR at stable names,
// so a fresh neural.js can meet a cached v1 façade with no `resolveNeuralUser`. A guest is decided
// on the neural side (`ngAuthIsGuest`: `isAuthenticated()`, present on v1, plus authUI's redirect
// rule) and boots the app; only a stored session on a v1 façade may hold. Mutant, recorded: dropping
// `if (ngAuthIsGuest(auth)) return null` from build.mjs's resolveUser turns this red on the hold screen.
test('@curated a guest meeting a cached v1 facade boots the app, never the hold screen', async ({ page }) => {
  const seen = { errors: [] as string[], forbidden: [] as string[] }
  observed.set(page, seen)
  page.on('pageerror', error => seen.errors.push(error.message))
  page.on('request', request => { if (/supabase|\/app\/game-model\.worker\.js(?:\?|$)/.test(request.url())) seen.forbidden.push(request.url()) })
  const j = journey(page)
  await j.boot('/', {
    keepTutorial: true,
    beforeNavigate: async page => {
      await installNeuralAuthSDK(page)
      await page.route(/\/app\/game-values\.js(?:\?|$)/, route => route.abort('failed'))
      // The v1 façade shape: the real emitted façade, minus its two v2 members.
      await page.addInitScript(() => {
        let v1: any
        Object.defineProperty(window, '__bjjAuth', { configurable: true, get: () => v1,
          set: (value: any) => { const { resolveNeuralUser, neuralSyncVersion, ...rest } = value; v1 = rest } })
      })
    },
  })
  await waitOwner(page, null)
  expect(await page.evaluate(() => typeof (window as any).__bjjAuth?.resolveNeuralUser), 'v1 façade in force').toBe('undefined')
  expect((await fixture(page)).clients).toBe(0)
})

test('@curated guest boots through the real facade and persists only a guest-owned cache', async ({ page }) => {
  await bootOwner(page)
  await expect(page.locator('.ngAcctChip')).toContainText('Guest')
  await addList(page, 'Guest practice')
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('bjj-neural-owner:guest:progress')
    return { envelope: raw && JSON.parse(raw), legacy: localStorage.getItem('bjj-neural-progress') }
  })
  expect(saved.envelope.owner).toEqual({ kind: 'guest' })
  expect(saved.envelope.format).toBe('bjj-progress-owner-v1')
  expect(Object.values(saved.envelope.blob.lists).map((row: any) => row.name)).toEqual(['Guest practice'])
  expect(saved.legacy).toBeNull()
  expect((await fixture(page)).writes).toEqual([])
})

test('@curated A to B to signout restores separate caches and publishes only each account own lists', async ({ page }) => {
  const j = await bootOwner(page)
  await addList(page, 'Guest practice')
  await page.evaluate(() => { (window as any).__outgoingOwner = (window as any).__neural })
  await emitOwner(page, A)
  expect(await page.evaluate(() => (window as any).__outgoingOwner.__ngDestroyed)).toBe(true)
  expect(await names(page)).toEqual([])
  await addList(page, 'A practice')
  await expect.poll(async () => (await fixture(page)).writes.filter((r: any) => r.user_id === A).length).toBeGreaterThan(0)
  await emitOwner(page, B)
  expect(await names(page)).toEqual([])
  await addList(page, 'B practice')
  await expect.poll(async () => (await fixture(page)).writes.filter((r: any) => r.user_id === B).length).toBeGreaterThan(0)
  await j.land('Mount Top')
  await j.decksSettled()
  await j.clickByMouse('.ngAcctChip', 'signed-in account menu')
  await expect(page.locator('[data-menu-email]')).toContainText(B + '@example.invalid')
  await j.clickByMouse('[data-menu-logout]', 'real facade signout')
  await waitOwner(page, null)
  await expect(page.locator('.ngAcctChip')).toContainText('Guest')
  expect(await names(page)).toEqual(['Guest practice'])
  const caches = await page.evaluate(({ A, B }) => [
    ['guest', 'bjj-neural-owner:guest:progress'],
    [A, 'bjj-neural-owner:account:' + encodeURIComponent(A) + ':progress'],
    [B, 'bjj-neural-owner:account:' + encodeURIComponent(B) + ':progress'],
  ].map(([id, key]) => ({ id, envelope: JSON.parse(localStorage.getItem(key)!) })), { A, B })
  expect(caches.map(row => ({ id: row.id, names: Object.values(row.envelope.blob.lists).map((l: any) => l.name) }))).toEqual([
    { id: 'guest', names: ['Guest practice'] }, { id: A, names: ['A practice'] }, { id: B, names: ['B practice'] },
  ])
  for (const row of (await fixture(page)).writes) {
    const listNames = Object.values(row.neural.lists || {}).map((l: any) => l.name)
    expect(listNames).not.toContain('Guest practice')
    expect(listNames).not.toContain(row.user_id === A ? 'B practice' : 'A practice')
    expect([A, B]).toContain(row.user_id)
  }
  await emitOwner(page, A)
  expect(await names(page)).toEqual(['A practice'])
})

test('@curated same-account SDK refresh preserves the real mounted hand and options', async ({ page }) => {
  const j = await bootOwner(page)
  await emitOwner(page, A)
  await expect.poll(() => page.evaluate(() => (window as any).__neural._pulledUserId)).toBe(A)
  await j.land('Mount Top')
  await j.decksSettled()
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    w.__ownerHandBefore = { app: a, hand: a._choiceHandId, decision: a._decision,
      options: a._optList.slice(), cards: a._optionCards.map((c: any) => c.card), session: a._session }
  })
  await emitOwner(page, A, 'TOKEN_REFRESHED')
  const same = await page.evaluate(async () => {
    await Promise.resolve(); await Promise.resolve()
    const w = window as any, a = w.__neural, old = w.__ownerHandBefore
    return { app: old.app === a, hand: old.hand === a._choiceHandId, decision: old.decision === a._decision,
      options: old.options.length > 0 && old.options.length === a._optList.length && old.options.every((o: any, i: number) => o === a._optList[i]),
      cards: old.cards.length > 0 && old.cards.every((card: HTMLElement, i: number) => card.isConnected && card === a._optionCards[i]?.card),
      session: old.session === a._session }
  })
  expect(same).toEqual({ app: true, hand: true, decision: true, options: true, cards: true, session: true })
})

test('@curated failed real-facade pull blocks upload until a successful account-pinned read', async ({ page }) => {
  await bootOwner(page)
  await page.evaluate(() => (window as any).__authOwnerFixture.failReads(true))
  await emitOwner(page, A)
  await expect.poll(() => page.evaluate(() => (window as any).__neural._cloudSyncError)).toBe('pull-failed')
  await addList(page, 'Offline A practice')
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._pullToken)).toBe(false)
  // Cross the actual 500ms cloud debounce; a negative assertion before it would be weak.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 600)))
  const held = await page.evaluate(() => {
    const a = (window as any).__neural
    return { pulled: a._pulled, pulledUser: a._pulledUserId, queuedPush: !!a._pushT, error: a._cloudSyncError }
  })
  expect(held).toEqual({ pulled: false, pulledUser: null, queuedPush: false, error: 'pull-failed' })
  expect((await fixture(page)).writes).toEqual([])
  expect((await fixture(page)).reads.some((r: any) => r.userId === A && r.failed)).toBe(true)
  expect(await names(page)).toEqual(['Offline A practice'])
  // Positive control: this fixture can really receive an upload when the real
  // facade returns the expected successful receipt, including authoritative empty.
  await page.evaluate(() => (window as any).__authOwnerFixture.failReads(false))
  await emitOwner(page, A, 'TOKEN_REFRESHED')
  await expect.poll(async () => (await fixture(page)).writes.length).toBeGreaterThan(0)
  const accepted = (await fixture(page)).writes.at(-1)
  expect(accepted.user_id).toBe(A)
  expect(Object.values(accepted.neural.lists).map((l: any) => l.name)).toEqual(['Offline A practice'])
})

test('@curated real identity-read failure keeps recovery visible and progress untouched until successful Retry', async ({ page }) => {
  await bootOwner(page)
  await addList(page, 'Keep recovery practice')
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    a.setPaused(true); a.clearTimers(); a._flushSave()
    // SDK failure only. The real facade resolves identity on the new document.
    w.__authOwnerFixture.failSessions(true)
    sessionStorage.setItem('__ng_keep', '1')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const recovery = page.locator('#neural-progress-recovery')
  await expect(page.locator('html')).toHaveAttribute('data-variant', 'neural')
  await expect(recovery).toBeVisible()
  await expect(recovery).toHaveAttribute('role', 'alert')
  await expect(recovery).toContainText('Your saved progress needs attention')
  const initial = await fixture(page), guestKey = 'bjj-neural-owner:guest:progress'
  expect(initial.sessionReads.some((row: any) => row.failed)).toBe(true)
  expect(typeof initial.initialProgress[guestKey]).toBe('string')
  expect(Object.values(JSON.parse(initial.initialProgress[guestKey]).blob.lists).map((row: any) => row.name)).toEqual(['Keep recovery practice'])
  const progress = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
    .filter(key => key.startsWith('bjj-neural-owner:') || key === 'bjj-neural-progress')
    .sort().map(key => [key, localStorage.getItem(key)])))
  expect(await progress()).toEqual(initial.initialProgress)
  expect(initial.reads).toEqual([]); expect(initial.writes).toEqual([])
  const held = await page.evaluate(() => {
    const w = window as any
    w.__recoveryRealFacade = w.__bjjAuth
    return { version: w.__bjjAuth?.neuralSyncVersion, resolver: typeof w.__bjjAuth?.resolveNeuralUser,
      mounted: !!w.__neural && !w.__neural.__ngDestroyed }
  })
  expect(held).toEqual({ version: 2, resolver: 'function', mounted: false })
  const retry = recovery.getByRole('button', { name: 'Retry', exact: true })
  await retry.scrollIntoViewIfNeeded()
  const geometry = await retry.evaluate(button => {
    const r = button.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { width: r.width, height: r.height, reachable: top === button || !!(top && button.contains(top)) }
  })
  expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.width).toBeGreaterThanOrEqual(44)
  expect(geometry.reachable).toBe(true)
  await retry.click()
  await expect.poll(async () => (await fixture(page)).sessionReads.filter((row: any) => row.failed).length)
    .toBeGreaterThan(initial.sessionReads.filter((row: any) => row.failed).length)
  await expect(recovery).toBeVisible()
  expect(await progress()).toEqual(initial.initialProgress)
  expect((await fixture(page)).reads).toEqual([]); expect((await fixture(page)).writes).toEqual([])
  // Positive control: clear only the SDK error, then use the actual Retry button.
  await page.evaluate(() => (window as any).__authOwnerFixture.failSessions(false))
  await retry.click()
  await waitOwner(page, null)
  expect(await names(page)).toEqual(['Keep recovery practice'])
  expect(await page.evaluate(() => (window as any).__recoveryRealFacade === (window as any).__bjjAuth)).toBe(true)
  expect((await fixture(page)).writes).toEqual([])
})
