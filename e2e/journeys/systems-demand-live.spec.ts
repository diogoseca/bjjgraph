import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Real emitted library, loader, graph and auth facade; no Systems response stubs.
// Actual app loads the index on explicit Explore/library entry, not a later topic click.
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const staticRoot = 'source/quartz/static/neural/';
const catalogue = JSON.parse(readFileSync(staticRoot + 'systems-index.json', 'utf8'));
// The full library is build-internal since v1.207.0 (never served); the served route is the index
// plus per-system records, whose bytes must reproduce it exactly.
const legacyBytes = readFileSync('source/quartz/.neural-internal/systems.json');
const legacy = JSON.parse(legacyBytes.toString('utf8'));
const chosen = catalogue.systems[0];
const recordPath = 'content/system-records/' + chosen.detailHash + '.json';
const recordBytes = readFileSync(staticRoot + recordPath);
const record = JSON.parse(recordBytes.toString('utf8'));
const indexRequest = (url: string) => /\/systems-index\.json(?:\?|$)/.test(url);
const recordRequest = (url: string) => /\/content\/system-records\/[a-f0-9]{64}\.json(?:\?|$)/.test(url);
const legacyRequest = (url: string) => /\/systems\.json(?:\?|$)/.test(url);

test.beforeAll(async ({ request }) => {
  expect(catalogue.systems).toHaveLength(83);
  expect(legacy.systems).toHaveLength(83);
  expect(catalogue.systems.map((s: any) => s.id).sort()).toEqual(legacy.systems.map((s: any) => s.id).sort());
  expect(sha(recordBytes)).toBe(chosen.detailHash);
  expect(record).toEqual(legacy.systems.find((s: any) => s.id === chosen.id));
  // RETIRED (owner ruling 2026-09-29): the legacy monolith is no longer served at all.
  expect((await request.get('/static/neural/systems.json')).ok(), 'retired systems.json is not served').toBe(false);
  for (const [path, bytes] of [['systems-index.json', readFileSync(staticRoot + 'systems-index.json')],
    ['app/neural.js', readFileSync('neural/dist/neural.js')]] as [string, Buffer][]) {
    const response = await request.get('/static/neural/' + path);
    expect(response.ok(), path).toBe(true);
    expect(sha(await response.body()), 'fresh served bytes: ' + path).toBe(sha(bytes));
  }
});

test('real library waits for Explore intent, fetches only the selected record and preserves legacy content', async ({ page, isMobile }, info) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    (window as any).__NEURAL_RIG = { 'start-pos': [0], role: [0], 'ai-skill': [.5], 'max-moves': [.5] };
  });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(url)) return route.continue();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-tech]').first()).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__neural?._gameValueGraph?.status), { timeout: 45_000 }).toBe('verified');
  expect(requests.filter(url => indexRequest(url) || recordRequest(url) || legacyRequest(url))).toEqual([]);
  const activate = async (locator: ReturnType<typeof page.locator>) => {
    await expect(locator).toBeVisible(); await locator.scrollIntoViewIfNeeded();
    if (isMobile) await locator.tap(); else await locator.click();
  };
  await activate(page.locator('.ng-logo'));
  // Opening the ordinary menu alone must not warm Systems.
  expect(requests.filter(url => indexRequest(url) || recordRequest(url))).toEqual([]);
  await activate(page.locator('[data-view="explore"]'));
  const header = page.locator('[data-explore-section="Systems"]');
  await expect(header).toBeVisible();
  expect(requests.filter(indexRequest)).toHaveLength(1);
  expect(requests.filter(recordRequest)).toEqual([]);
  if (await header.getAttribute('aria-expanded') !== 'true') await activate(header);
  const category = page.locator(`[data-system-category=${JSON.stringify(chosen.type || 'Uncategorized')}]`);
  await expect(category).toBeVisible();
  if (await category.getAttribute('aria-expanded') !== 'true') await activate(category);
  const selectedRow = page.locator(`[data-system-row=${JSON.stringify(chosen.id)}]`);
  await expect(selectedRow).toBeVisible();
  expect(requests.filter(recordRequest)).toEqual([]);
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/static/neural/' + recordPath);
  await activate(selectedRow);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const loadedBytes = await response.body();
  expect(sha(loadedBytes)).toBe(chosen.detailHash);
  expect(JSON.parse(loadedBytes.toString('utf8'))).toEqual(record);
  await expect(page.locator(`[data-system-detail=${JSON.stringify(chosen.id)}]`)).toBeVisible();
  const state = await page.evaluate(id => {
    const a = (window as any).__neural, s = a._systemsById[id];
    return { id: a._systemId, ready: a._systemReady(s), nodes: s.nodes, glue: s.glue, products: s.products,
      hydrated: a.systems.filter((s: any) => a._systemReady(s)).map((s: any) => s.id), count: a.systems.length };
  }, chosen.id);
  expect(state).toEqual({ id: chosen.id, ready: true, nodes: record.nodes, glue: record.glue, products: record.products, hydrated: [chosen.id], count: 83 });
  expect(requests.filter(recordRequest).map(url => new URL(url).pathname)).toEqual(['/static/neural/' + recordPath]);
  expect(requests.filter(legacyRequest)).toEqual([]);
  expect(errors).toEqual([]);
  await info.attach('actual-systems-demand', { body: JSON.stringify({ state, chosen, requests, legacySHA256: sha(legacyBytes), recordSHA256: sha(loadedBytes) }, null, 2), contentType: 'application/json' });
});
