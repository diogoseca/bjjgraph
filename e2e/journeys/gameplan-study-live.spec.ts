import { expect, test, type Page, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { verifySharedCoreArtifact, isSharedCoreRequest, type SharedCoreArtifact } from '../fixtures/game-worker-core';

let sharedCore: SharedCoreArtifact;

// Real emitted graph/index/mechanics, real browser installer, isolated real study
// Worker and production certificates. Controlled physical/debt setup is expressly
// NOT a learned-event or random-next-roll coverage claim. No result routes/stubs.
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const studyImport = (url: string) => /\/game-study\.js(?:\?|$)/.test(url);
const studyWorker = (url: string) => /\/game-study\.worker\.js(?:\?|$)/.test(url);
const form = '[data-game-study-controls="1"]';
const control = (name: string) => `${form} [data-study-control="${name}"]`;
const mountTop = `${form} [data-study-action="select"][data-study-key="Mount|Top"]`;

test.beforeAll(async ({ request }) => {
  sharedCore = await verifySharedCoreArtifact(request);
  for (const file of ['neural.js', 'neural.css', 'game-values.js', 'game-model.worker.js', 'gameplan.js', 'game-study.js', 'game-study.worker.js']) {
    const response = await request.get('/static/neural/app/' + file);
    expect(response.ok(), file).toBe(true);
    expect(digest(await response.body()), 'served artifact must match current dist: ' + file).toBe(digest(readFileSync('neural/dist/' + file)));
  }
});

async function hit(page: Page, target: Locator, touch: boolean) {
  await expect(target).toBeVisible(); await expect(target).toBeEnabled();
  await target.scrollIntoViewIfNeeded();
  const point = await target.evaluate((element: HTMLElement) => {
    const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const front = document.elementFromPoint(x, y);
    return { x, y, reachable: front === element || !!(front && element.contains(front)), height: r.height };
  });
  expect(point.reachable).toBe(true);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
}

async function chooseMountTop(page: Page, touch: boolean) {
  // Broad search intentionally matches multiple pages of real Mount techniques.
  // Reach the exact role through the same paging controls a player uses.
  const target = page.locator(mountTop);
  for (let pages = 0; !(await target.count()) && pages < 30; pages++) {
    await hit(page, page.locator(control('next')), touch);
  }
  await hit(page, target, touch);
}

async function boot(page: Page) {
  const requested: string[] = [], errors: string[] = [], workers: string[] = [];
  page.on('request', request => requested.push(request.url()));
  page.on('worker', worker => workers.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    // Existing first-hand RNG rail only; no odds, solver or host replacement.
    (window as any).__NEURAL_RIG = { 'start-pos': [0], role: [0], 'ai-skill': [0.5], 'max-moves': [0.5] };
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(url)) return route.continue();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-tech]').first()).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural;
    return !!a?._progressCurrent?.() && a?._gameValueGraph?.status === 'verified';
  }), { timeout: 45_000 }).toBe(true);
  expect(requested.filter(url => studyImport(url) || studyWorker(url))).toEqual([]);
  expect(workers.filter(studyWorker)).toEqual([]);
  return { requested, errors, workers };
}

async function openPlan(page: Page, touch: boolean, withDebt = false) {
  await page.evaluate(async (withDebt) => {
    const a = (window as any).__neural; a.setPaused(true);
    if (withDebt) {
      // Controlled old review debt, not a claimed grade or recommendation.
      await a.hydrateDecks(['Mount|Top', 'Mount|Bottom']);
      const day = a._epochDay();
      for (const key of ['Mount|Top', 'Mount|Bottom']) {
        const card = a._cardsOf(a.flashcards.decks[key])?.[0];
        if (!card) throw Error('missing real Mount review fixture');
        a.srs[key] = { ...(a.srs[key] || {}), [a.qhash(card.q)]: [day - 1, 3, day - 4] };
      }
    }
    a.setViewMode('explore'); a.openExplorer(); a.renderPaneAnchor();
  }, withDebt);
  await hit(page, page.locator('[data-explore-stats] [data-b="new"]').first(), touch);
  await expect(page.locator(form)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural; return !!a._gameStudyHost && !a._gameStudyLoading;
  })).toBe(true);
}

test('explicit plan loads controls without a study worker; paging, touch and status repaint preserve the active queue', async ({ page, isMobile }, info) => {
  const net = await boot(page);
  await openPlan(page, isMobile, true);
  expect(net.requested.some(studyImport)).toBe(true);
  expect(net.requested.filter(studyWorker)).toEqual([]);
  expect(net.workers.filter(studyWorker)).toEqual([]);
  await expect(page.locator(control('scope'))).toHaveValue('');
  await expect(page.locator(control('compare'))).toBeDisabled();
  await expect(page.locator(control('count'))).toContainText('Page 1 of');
  await hit(page, page.locator(control('next')), isMobile);
  await expect(page.locator(control('count'))).toContainText('Page 2 of');
  await page.locator(control('search')).fill('Mount');
  await expect(page.locator(control('count'))).toContainText('Page 1 of');
  await chooseMountTop(page, isMobile);
  await page.locator(control('scope')).selectOption('current-position');
  const before = await page.evaluate(() => {
    const a = (window as any).__neural, input = document.querySelector('[data-game-study-controls] [data-study-control="search"]') as HTMLInputElement;
    (window as any).__studyFormRef = document.querySelector('[data-game-study-controls]');
    (window as any).__studyQueueRef = a._session;
    input.focus(); input.setSelectionRange(1, 3);
    return { keys: a._session.keys.slice(), idx: a._session.idx, srs: JSON.stringify(a.srs), revision: a._knowledgeRevision };
  });
  // The first Mount question is shared across both roles. The real planner
  // freezes one qhash review rather than charging the same question twice.
  expect(before.keys).toHaveLength(1);
  expect(['Mount|Top', 'Mount|Bottom']).toContain(before.keys[0]);
  await page.evaluate(() => {
    const a = (window as any).__neural;
    // Exercise the actual host status repaint path without fabricated results.
    a._gameStudyHost.reconcile('browser-controls-repaint'); a._refreshGameplanUI();
    a._paintGameStudyPanel(); a._paintGameStudyPanel();
  });
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-study-control'))).toBe('search');
  const after = await page.evaluate(() => {
    const a = (window as any).__neural, input = document.activeElement as HTMLInputElement;
    return { sameForm: (window as any).__studyFormRef === document.querySelector('[data-game-study-controls]'),
      sameQueue: (window as any).__studyQueueRef === a._session, keys: a._session.keys.slice(), idx: a._session.idx,
      srs: JSON.stringify(a.srs), revision: a._knowledgeRevision, search: input.value, selection: [input.selectionStart, input.selectionEnd] };
  });
  expect(after.sameForm).toBe(true); expect(after.sameQueue).toBe(true);
  expect({ keys: after.keys, idx: after.idx, srs: after.srs, revision: after.revision }).toEqual(before);
  expect(after.search).toBe('Mount'); expect(after.selection).toEqual([1, 3]);
  await expect(page.locator(`${form} [data-study-action="remove"][data-study-key="Mount|Top"]`)).toBeVisible();
  const geometry = await page.locator(form).evaluate(element => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, viewport: innerWidth,
      heights: Array.from(element.querySelectorAll('button,input,select')).map(e => e.getBoundingClientRect().height) };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.heights.every(height => height >= 44)).toBe(true);
  expect(net.workers.filter(studyWorker)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__neural._gameplanStudyDeclaration || null)).toBeNull();
  expect(net.errors).toEqual([]);
  await info.attach('controls-and-queue', { body: JSON.stringify({ before, after, geometry, requested: net.requested }, null, 2), contentType: 'application/json' });
});

// A PLAN OPENED WHILE A DECK LANDS STILL MOUNTS (FGGPLAN1, 2026-10-01; `_gameStudyChanged`). The study
// host loads lazily, and a context change during that load abandons it ("The study context changed.
// Open the plan again"). A deck becoming resident, or the plan clock's quiet 30 s tick, is not a change
// the player made. On CI (PR 252) the test above tapped the stat, the session opened, and the plan never
// mounted, ending in exactly that state. Here the load is HELD (the study bundle's request waits), so
// both signals land inside it on every run, not by timing; then the hold is released. The control
// half proves the guard still abandons on a real change, so this cannot pass by never abandoning
// anything. Mutants (FGGPLAN1 PR): residency abandoning again -> the first half red; the tick
// abandoning again -> the first half red.
async function holdStudyLoad(page: Page) {
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  let held = 0;
  await page.route(url => studyImport(url.href), async route => { held++; await released; await route.fallback(); });
  return { release: () => release(), held: () => held };
}
async function tapPlanWithHeldLoad(page: Page, touch: boolean) {
  const hold = await holdStudyLoad(page);
  await page.evaluate(() => { const a = (window as any).__neural; a.setPaused(true); a.setViewMode('explore'); a.openExplorer(); a.renderPaneAnchor(); });
  await hit(page, page.locator('[data-explore-stats] [data-b="new"]').first(), touch);
  await expect.poll(() => hold.held(), { message: 'the study bundle request is held' }).toBeGreaterThan(0);
  expect(await page.evaluate(() => !!(window as any).__neural._gameStudyLoading), 'the plan load is in flight').toBe(true);
  return hold;
}

test('a deck landing or a quiet clock tick while the plan loads does not cost the plan; a real change still does', async ({ page, isMobile }) => {
  await boot(page);
  const hold = await tapPlanWithHeldLoad(page, isMobile);
  const landed = await page.evaluate(async () => {
    const a = (window as any).__neural;
    const before = a._residencyStats?.decks || 0;
    const key = Object.keys(a.flashcards.decks).find((k: string) => !a._cardsOf(a.flashcards.decks[k]) && (a.flashcards.decks[k].n || 0) > 0);
    await a.hydrateDecks([key]);
    await new Promise(resolve => setTimeout(resolve, 600));   // the coalescer's trailing restart, too
    a._gameplanVisible();                                      // the clock's quiet tick (same day)
    return { key, decks: (a._residencyStats?.decks || 0) - before, loading: !!a._gameStudyLoading, phase: a._gameStudyState?.phase };
  });
  expect(landed.decks, `a deck (${landed.key}) really landed during the load`).toBeGreaterThan(0);
  expect(landed.loading, 'the load survived the landing and the tick').toBe(true);
  expect(landed.phase).not.toBe('unavailable');
  hold.release();
  await expect(page.locator(form)).toBeVisible({ timeout: 30_000 });
});

test('control: a real change while the plan loads still abandons it', async ({ page, isMobile }) => {
  await boot(page);
  const hold = await tapPlanWithHeldLoad(page, isMobile);
  const state = await page.evaluate(() => {
    const a = (window as any).__neural;
    a._gameValueChanged('fggplan-control-roll', 'roll');
    return { loading: !!a._gameStudyLoading, phase: a._gameStudyState?.phase, reason: a._gameStudyState?.reason };
  });
  expect(state).toEqual({ loading: false, phase: 'unavailable', reason: 'fggplan-control-roll' });
  hold.release();
  await page.waitForTimeout(1500);
  await expect(page.locator(form)).toHaveCount(0);
});

test('actual worker certifies one controlled GI Triangle cap9 count8 comparison for Mount Top sharpness', async ({ page, isMobile }, info) => {
  const net = await boot(page);
  await page.evaluate(async () => {
    const a = (window as any).__neural;
    if (a._giMode !== 'gi') a.setGiMode('gi');
    const id = 'Submissions/Triangle-Choke/from-Triangle-Control/Defender';
    const idx = a.nodes.findIndex((n: any) => n.id === id);
    if (idx < 0) throw Error('canonical Triangle Defender missing');
    await a.hydrateDecks(['Mount|Top', 'Triangle Choke from Triangle Control|Defender']);
    a.clearTimers(); a.clearOptions(); a.clearExecution(); a.clearEngagement();
    a._beltTest = null; a._staged = null; a._stagedTech = null;
    a.currentPos = idx; a.playerRole = 'top'; a.maxMoves = 9; a.moveCount = 8; a.aiSkill = .07; a._combo = 0; a._qMod = 0;
    // Generate the real defense decision/choice payload, rather than inventing opts.
    a.enterLand(true); a.setPaused(true);
  });
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural;
    return !!a._decision && !a._execution && !a._waitingSubmission && !a._sweep && a.nodes[a.currentPos]?.id === 'Submissions/Triangle-Choke/from-Triangle-Control/Defender';
  }), { timeout: 30_000 }).toBe(true);
  const setup = await page.evaluate(() => {
    const a = (window as any).__neural; a.setPaused(true);
    if (!a._decision) throw Error("controlled defense decision must remain mounted");
    a.maxMoves = 9; a.moveCount = 8; a.aiSkill = .07;
    a._gameValueChanged('controlled-browser-study-context', 'context');
    const p = a.knowledgeProfile();
    return { scope: 'controlled physical scenario, no learned-event claim', node: a.nodes[a.currentPos].id,
      role: a.playerRole, cap: a.maxMoves, count: a.moveCount, ruleset: a._giMode,
      targetSharp: p.sharp['Mount|Top'] || 0, profileHash: p.fingerprint, permanent: p.permanent, sharp: p.sharp, evidence: p.evidenceRevision };
  });
  expect(setup).toMatchObject({ role: 'top', cap: 9, count: 8, ruleset: 'gi', targetSharp: 0 });
  await openPlan(page, isMobile);
  await page.locator(control('search')).fill('Mount');
  await chooseMountTop(page, isMobile);
  await page.locator(control('scope')).selectOption('current-position');
  expect(net.workers.filter(studyWorker)).toEqual([]);
  const coreRequestsBeforeCompare = net.requested.filter(url => isSharedCoreRequest(url, sharedCore)).length;
  await hit(page, page.locator(control('compare')), isMobile);
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural;
    const phase = a._gameStudyState?.phase;
    return ['ready', 'partial', 'unavailable', 'error'].includes(phase) ? phase : 'working';
  }), { timeout: 125_000, intervals: [100, 250, 500] }).not.toBe('working');
  const receipt = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { state: a._gameStudyState, declaration: a._gameplanStudyDeclaration, profile: a.knowledgeProfile(),
      graph: a._gameValueGraph, choiceFixture: !!a._choiceFixture };
  });
  await info.attach('actual-study-receipt', { body: JSON.stringify({ setup, receipt, requested: net.requested, workers: net.workers }, null, 2), contentType: 'application/json' });
  // A refusal is diagnostic evidence and a failed acceptance, never a green fallback.
  expect(['ready', 'partial'], receipt.state.reason || 'complete native study evidence required').toContain(receipt.state.phase);
  expect(receipt.choiceFixture).toBe(false);
  expect(net.workers.filter(studyWorker)).toHaveLength(1);
  expect(net.requested.filter(url => isSharedCoreRequest(url, sharedCore)).length, 'real study startup requested this build core').toBeGreaterThan(coreRequestsBeforeCompare);
  expect(net.requested.some(url => /\/mdp\/manifest-[a-f0-9]{64}\.json/.test(url))).toBe(true);
  expect(receipt.declaration).toEqual({ mode: 'current-position', targets: { kind: 'sharp-refresh', deckKeys: ['Mount|Top'] } });
  expect(receipt.state.sourceProvenance.starts.scope).toBe('current-position');
  const evidence = receipt.state.evidence;
  expect(evidence.status).toBe('ready');
  expect(evidence.receipts.startAdmission).toMatchObject({ declaredStarts: 1, behaviorCompression: false });
  expect(evidence.receipts.startAdmission.registration.ruleset).toBe('gi');
  expect(evidence.receipts.manifest.graphHash).toBe(digest(readFileSync('source/quartz/static/neural/graph-data.json')));
  expect(evidence.receipts.scenarios).toHaveLength(1);
  expect(evidence.receipts.scenarios[0].projection.scenario.changes.records).toEqual([
    { deckKey: 'Mount|Top', role: 'Top', component: 'sharp', from: 0, to: .10 },
  ]);
  expect(evidence.coordinator.baseline.status).toBe('ready');
  expect(receipt.state.provider.study.groups).toHaveLength(1);
  expect(receipt.state.provider.study.groups[0].status).not.toBe('unavailable');
  expect(receipt.profile.permanent).toEqual(setup.permanent); expect(receipt.profile.sharp).toEqual(setup.sharp);
  expect(receipt.profile.evidenceRevision).toBe(setup.evidence);
  expect(net.errors).toEqual([]);
});
