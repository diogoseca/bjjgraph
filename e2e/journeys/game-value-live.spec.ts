import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { verifySharedCoreArtifact, isSharedCoreRequest, type SharedCoreArtifact } from '../fixtures/game-worker-core'

let sharedCore: SharedCoreArtifact

// Actual app, real graph/metadata, real classic Worker and production solver.
// Only the pre-existing RNG draw pin and external-font isolation are used.
// Controlled consumer fixtures live separately in choice-value.spec.ts.
test.beforeAll(async ({ request }) => {
  sharedCore = await verifySharedCoreArtifact(request)
  for (const file of ['neural.js', 'neural.css', 'game-values.js', 'game-model.worker.js', 'choice-values.js']) {
    const response = await request.get('/static/neural/app/' + file)
    expect(response.ok()).toBe(true)
    const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    expect(sha(await response.body()), 'fresh served ' + file).toBe(sha(readFileSync('neural/dist/' + file)))
  }
})

for (const width of [1440, 390]) {
  test(`@curated real MDP values reach the first playable hand at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.addInitScript(() => {
      ;(window as any).__NEURAL_RIG = { 'start-pos': [0], role: [0], 'ai-skill': [0.5], 'max-moves': [0.5] }
    })
    await page.route('**/*', route => {
      const url = route.request().url()
      if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(url)) return route.continue()
      if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
      return route.abort()
    })
    const errors: string[] = [], requested: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requested.push(request.url()))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.evaluate(() => {
      const app = (window as any).__neural
      return app?._choiceValues?.snapshot()?.status || app?._gameValueState || 'boot'
    }), { timeout: 45_000, intervals: [100, 250, 500] }).toMatch(/^(ready|bounded)$/)
    const receipt = await page.evaluate(() => {
      const app = (window as any).__neural, snapshot = app._choiceValues.snapshot()
      const ids = (app._optionCards || []).filter((card: any) => !card.opt.threat).map((card: any) => card.opt.node.id)
      return { graph: app._gameValueGraph, state: app._gameValueState, snapshot,
        firstHand: app._gameValueFirstHandAt, activation: app._gameValueActivationAt,
        firstValues: app._gameValueFirstValuesAt, role: app.playerRole, ruleset: app._giMode,
        cap: app.maxMoves, count: app.moveCount, ids, hasFixture: !!app._choiceFixture }
    })
    expect(receipt.graph.status).toBe('verified')
    expect(receipt.graph.hash).toBe(createHash('sha256').update(readFileSync('source/quartz/static/neural/graph-data.json')).digest('hex'))
    expect(receipt.hasFixture).toBe(false)
    expect(receipt.snapshot.actions.length).toBe(receipt.ids.length)
    expect(receipt.snapshot.actions.length).toBeGreaterThan(0)
    expect(receipt.firstHand).toBeGreaterThanOrEqual(0)
    expect(receipt.activation).toBeGreaterThanOrEqual(receipt.firstHand)
    expect(receipt.firstValues).toBeGreaterThanOrEqual(receipt.activation)
    expect(requested.some(url => /\/game-model\.worker\.js\?/.test(url))).toBe(true)
    expect(requested.some(url => isSharedCoreRequest(url, sharedCore)), 'real live Worker requested this build core').toBe(true)
    expect(requested.some(url => /\/mdp\/manifest-[a-f0-9]{64}\.json/.test(url))).toBe(true)
    const own = page.locator('[data-choice-group="you"]')
    const displayed = await own.locator('[data-choice-win]').allTextContents()
    expect(displayed.length).toBe(receipt.ids.length)
    expect(displayed.every(value => value !== '—' && /%/.test(value))).toBe(true)
    await expect(own.locator('[data-choice-value-status]')).toHaveText('This roll · your practice')
    await expect(own.locator('[data-choice-inspect]').first()).toBeEnabled()
    expect(errors).toEqual([])
    writeFileSync(info.outputPath('actual-game-value-receipt.json'), JSON.stringify(receipt, null, 2))
    console.log('[real-values-timing]', JSON.stringify({ width, handToValuesMs: receipt.firstValues - receipt.firstHand, activationToValuesMs: receipt.firstValues - receipt.activation }))
    await info.attach('actual-game-value-receipt', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('real-values.png') })

    // Complete the actual visible MC question through its public keyboard action.
    // No fabricated grade, injected profile or substitute worker is used.
    const question = await page.evaluate(() => {
      const app = (window as any).__neural, mc = app._mc
      return mc?.surface === 'land' ? { correct: mc.correct, profileHash: app._choiceValues.snapshot().request.profileHash, handId: app._choiceHandId } : null
    })
    expect(question).not.toBeNull()
    const beforeImmediate = await own.locator('.ngodds').allTextContents()
    await page.keyboard.press('ABC'[question!.correct])
    await expect.poll(() => page.evaluate((oldHash) => {
      const app = (window as any).__neural, value = app._choiceValues?.snapshot()
      return !!value && ['ready', 'bounded'].includes(value.status) && value.request.profileHash !== oldHash
    }, question!.profileHash), { timeout: 45_000, intervals: [100, 250, 500] }).toBe(true)
    const learned = await page.evaluate(() => {
      const app = (window as any).__neural
      return { handId: app._choiceHandId, snapshot: app._choiceValues.snapshot(), ids: (app._optionCards || []).filter((card: any) => !card.opt.threat).map((card: any) => card.opt.node.id) }
    })
    expect(learned.handId).toBe(question!.handId)
    expect(learned.ids).toEqual(receipt.ids)
    expect(await own.locator('.ngodds').allTextContents()).not.toEqual(beforeImmediate)
    expect(learned.snapshot.request.state.snapshotId).not.toBe(receipt.snapshot.request.state.snapshotId)
    writeFileSync(info.outputPath('after-real-mc.json'), JSON.stringify(learned, null, 2))
    expect(errors).toEqual([])

    // Changing the verified live graph identity must reject cached model values.
    // This is an explicit invalidation probe after real successful integration.
    await page.evaluate(() => {
      const app = (window as any).__neural
      app._gameValueGraph = Object.freeze({ status: 'verified', hash: '0'.repeat(64) })
      app._gameValueChanged('test-stale-graph')
    })
    await expect.poll(() => page.evaluate(() => (window as any).__neural._gameValueReason)).toBe('live-graph-mismatch')
    await expect(own.locator('[data-choice-value-status]')).toHaveText('Win chance unavailable')
    expect((await own.locator('[data-choice-win]').allTextContents()).every(value => value === '—')).toBe(true)
    await expect(own.locator('[data-choice-inspect]').first()).toBeEnabled()
    await expect(own.locator('[data-choice-value-retry]')).toBeHidden()
  })
}

// This case fails the actual importScripts dependency. It never replaces Worker,
// the native provider, the profile, a worker reply, or a displayed model value.
test('@curated failed shared-core startup retires its worker; explicit retry restores real values and usable controls', async ({ page }, info) => {
  const workers: { url: string; closed: boolean }[] = []
  const coreRequests: string[] = [], errors: { message: string; stack: string }[] = []
  let failCore = true
  page.on('worker', worker => {
    if (!/\/game-model\.worker\.js(?:\?|$)/.test(worker.url())) return
    const row = { url: worker.url(), closed: false }; workers.push(row)
    worker.on('close', () => { row.closed = true })
  })
  page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack || '' }))
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear()
    ;(window as any).__NEURAL_RIG = { 'start-pos': [0], role: [0], 'ai-skill': [0.5], 'max-moves': [0.5] }
  })
  await page.route('**/*', route => {
    const url = route.request().url()
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(url)) return route.continue()
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    return route.abort()
  })
  // Registered after the catch-all so the real core dependency is intercepted.
  await page.route(url => isSharedCoreRequest(url.href, sharedCore), route => {
    coreRequests.push(route.request().url())
    return failCore ? route.abort('failed') : route.continue()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const own = page.locator('[data-choice-group="you"]')
  await expect.poll(() => coreRequests.length, { timeout: 45_000 }).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as any).__neural?._gameValueReason)).toBe('worker-error')
  await expect.poll(() => workers.map(worker => worker.closed)).toEqual([true])
  await expect(own.locator('[data-choice-value-status]')).toHaveText('Win chance unavailable')
  const retry = own.locator('[data-choice-value-retry]')
  await expect(retry).toBeVisible(); await expect(retry).toBeEnabled()
  const failed = await page.evaluate(() => {
    const app = (window as any).__neural
    // Retain a reference solely to inspect its real retirement guard after retry.
    ;(window as any).__failedCoreProvider = app._choiceValueSource
    return { handId: app._choiceHandId, attempt: app._gameValueImportAttempt || 0,
      ids: (app._optionCards || []).filter((card: any) => !card.opt.threat).map((card: any) => card.opt.node.id),
      hasFixture: !!app._choiceFixture, graph: app._gameValueGraph }
  })
  expect(failed.hasFixture).toBe(false); expect(failed.graph.status).toBe('verified')
  const immediate = await own.locator('.ngodds').allTextContents()
  expect(immediate.length).toBeGreaterThan(0)
  expect((await own.locator('[data-choice-win]').allTextContents()).every(value => value === '—')).toBe(true)
  await expect(own.locator('[data-choice-execute]').first()).toBeEnabled()
  await page.keyboard.press('Shift+Digit1')
  await expect(page.locator('[data-choice-value-detail]')).toContainText('You can still choose this move.')
  await expect(page.locator('[data-go]')).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await own.locator('.ngodds').allTextContents()).toEqual(immediate)
  expect(coreRequests).toHaveLength(1); expect(workers).toHaveLength(1)

  // Merely restoring the network must not replace the failed provider or retry.
  failCore = false
  expect(await page.evaluate(() => (window as any).__neural._gameValueImportAttempt || 0)).toBe(failed.attempt)
  await retry.click()
  await expect.poll(() => page.evaluate(() => {
    const app = (window as any).__neural
    return app?._choiceValues?.snapshot()?.status || app?._gameValueState
  }), { timeout: 45_000, intervals: [100, 250, 500] }).toMatch(/^(ready|bounded)$/)
  await expect.poll(() => coreRequests.length).toBe(2)
  expect(workers).toHaveLength(2); expect(workers[0].closed).toBe(true)
  expect(new URL(workers[1].url).searchParams.get('attempt')).toBe(String(failed.attempt + 1))
  const recovered = await page.evaluate(() => {
    const app = (window as any).__neural, snapshot = app._choiceValues.snapshot()
    const old = (window as any).__failedCoreProvider
    return { handId: app._choiceHandId, attempt: app._gameValueImportAttempt,
      ids: (app._optionCards || []).filter((card: any) => !card.opt.threat).map((card: any) => card.opt.node.id),
      snapshot, providerReplaced: old !== app._choiceValueSource,
      oldCanPublish: old.isCurrent(app, snapshot.request, app._choiceHandId), hasFixture: !!app._choiceFixture }
  })
  expect(recovered.providerReplaced).toBe(true); expect(recovered.oldCanPublish).toBe(false)
  expect(recovered.hasFixture).toBe(false); expect(recovered.handId).toBe(failed.handId)
  expect(recovered.ids).toEqual(failed.ids); expect(recovered.attempt).toBe(failed.attempt + 1)
  expect(recovered.snapshot.handId).toBe(recovered.handId)
  expect(recovered.snapshot.actions.map((action: any) => action.actionId)).toEqual(recovered.snapshot.request.requestedActionIds)
  expect(recovered.snapshot.actions.length).toBe(failed.ids.length)
  expect(await own.locator('.ngodds').allTextContents()).toEqual(immediate)
  await expect(own.locator('[data-choice-value-status]')).toHaveText('This roll · your practice')
  expect((await own.locator('[data-choice-win]').allTextContents()).every(value => value !== '—' && /%/.test(value))).toBe(true)
  await expect(retry).toBeHidden()

  // A real commit remains possible and retires this hand's value publication.
  await page.keyboard.press('1')
  await expect(page.locator('[data-executing-tech]')).toHaveCount(1)
  expect(await page.evaluate(() => (window as any).__neural._choiceValues.snapshot())).toBeNull()
  // Some browsers surface the expected failed importScripts as a page error.
  // Admit only that exact named resource; all unrelated errors still fail.
  const unexpected = errors.filter(error => !error.message.includes('importScripts') || !(error.message + error.stack).includes(sharedCore.file))
  expect(unexpected).toEqual([])
  await info.attach('shared-core-retry-receipt', { body: JSON.stringify({ sharedCore, failed, recovered, workers, coreRequests, errors }, null, 2), contentType: 'application/json' })
})
