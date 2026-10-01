import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { journey } from '../dsl';

const moduleURL = /\/static\/neural\/app\/settings-ui\.js(?:\?|$)/;
test.beforeAll(async ({ request }) => {
  for (const file of ['neural.js', 'settings-ui.js']) {
    const response = await request.get('/static/neural/app/' + file);
    expect(response.ok()).toBe(true);
    const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
    expect(sha(await response.body()), 'fresh served ' + file).toBe(sha(readFileSync('neural/dist/' + file)));
  }
});

for (const width of [1440, 390]) {
  test(`@curated Settings imports only on intent and a late module cannot reopen Close at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const requested: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await journey(page).boot('/', { beforeNavigate: async () => {
      await page.route(moduleURL, async route => { requested.push(route.request().url()); await gate; await route.continue(); });
    } });
    expect(requested).toEqual([]);
    try {
      await page.evaluate(() => { void (window as any).__neural.openSettings('flashcards'); });
      await expect(page.locator('[data-settings-load="loading"]')).toBeVisible();
      await expect.poll(() => requested.length).toBe(1);
      await page.evaluate(() => { void (window as any).__neural.openSettings('shortcuts'); });
      await page.locator('[data-settings-load-close]').click();
      release();
      await page.evaluate(() => (window as any).__neural._settingsPresentationLoad);
      expect(await page.evaluate(() => (window as any).__neural.modalRef.current.style.display)).toBe('none');
      expect(requested.length).toBe(1);
      await page.evaluate(() => (window as any).__neural.openSettings('shortcuts'));
      await expect(page.locator('[data-settings-tab="shortcuts"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-settings-tab="shortcuts"]')).toBeFocused();
      expect(requested.length).toBe(1);
    } finally { release(); }
  });

  test(`@curated Settings failed import retries the real module and preserves the selected tab at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const requested: string[] = [];
    await journey(page).boot('/', { beforeNavigate: async () => {
      await page.route(moduleURL, async route => {
        requested.push(route.request().url());
        if (requested.length === 1) await route.fulfill({ status: 503, contentType: 'text/javascript', body: '' });
        else await route.continue();
      });
    } });
    expect(requested).toEqual([]);
    await page.evaluate(() => { void (window as any).__neural.openSettings('shortcuts'); });
    await expect(page.locator('[data-settings-load="error"]')).toBeVisible();
    await expect(page.locator('[data-settings-load-close]')).toBeEnabled();
    expect(requested.length).toBe(1);
    await page.locator('[data-settings-retry]').click();
    await expect(page.locator('[data-settings-tab="shortcuts"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-settings-tab="shortcuts"]')).toBeFocused();
    expect(requested.length).toBe(2);
    expect(new URL(requested[1]).searchParams.get('attempt')).not.toBe(new URL(requested[0]).searchParams.get('attempt'));
    await expect(page.locator('[data-settings-load]')).toHaveCount(0);
  });

  test(`@curated Settings late completion cannot replace a real Legal modal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await journey(page).boot('/', { beforeNavigate: async () => {
      await page.route(moduleURL, async route => { await gate; await route.continue(); });
    } });
    try {
      await page.evaluate(() => { void (window as any).__neural.openSettings(); });
      await expect(page.locator('[data-settings-load="loading"]')).toBeVisible();
      const before = await page.evaluate(() => {
        const app = (window as any).__neural;
        app.openLegal('privacy');
        return { html: app.modalCardRef.current.innerHTML, generation: app._modalGeneration };
      });
      expect(before.html).toMatch(/Privacy/i);
      release();
      await page.evaluate(() => (window as any).__neural._settingsPresentationLoad);
      expect(await page.evaluate(() => {
        const app = (window as any).__neural;
        return { html: app.modalCardRef.current.innerHTML, generation: app._modalGeneration };
      })).toEqual(before);
      await expect(page.locator('[data-settings-tab]')).toHaveCount(0);
    } finally { release(); }
  });
}
