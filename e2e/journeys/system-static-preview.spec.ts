import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Exercise the emitted article and its shipped media modules. Only the external
// provider is simulated: these tests do not claim to verify live video playback.
const ROUTE = "/Systems/Danaher-Leg-Lock-System";
const source = JSON.parse(readFileSync(resolve(__dirname, "../../content/Systems/Danaher Leg Lock System.json"), "utf8"));
const COVER = source.products[0].image;
const COURSE = source.products[0].course_url;
const SDK = "https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js";
const PLAYER = /https:\/\/(?:iframe|player)\.mediadelivery\.net\/embed\//;
const IMAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#59406d"/></svg>';
const SDK_STUB = `window.playerjs = { Player: class {
  constructor() { this.callbacks = {}; }
  on(name, callback) {
    this.callbacks[name] = callback;
    if (name === "ready") window.__staticPreviewReady = () => this.callbacks.ready?.();
  }
  off(name) { delete this.callbacks[name]; }
} };`;

async function staticFallback(page: Page) {
  await page.route("**/static/neural/app/neural.js*", route => route.fulfill({ status: 404, body: "Bundle unavailable" }));
  await page.route(url => url.href === COVER, route => route.fulfill({ contentType: "image/svg+xml", body: IMAGE }));
}

async function geometry(page: Page) {
  return page.locator("[data-system-guide]").evaluate(guide => {
    const media = guide.querySelector("[data-system-preview]")!;
    const rect = media.getBoundingClientRect();
    const course = guide.querySelector('[data-course-placement="top"]')!.getBoundingClientRect();
    const player = media.querySelector("iframe")?.getBoundingClientRect();
    return { width: rect.width, height: rect.height, courseTop: course.top, mediaBottom: rect.bottom,
      positioned: getComputedStyle(media).position, ratio: rect.width / rect.height,
      playerWidth: player?.width, playerHeight: player?.height,
      overflow: guide.scrollWidth > guide.clientWidth };
  });
}

for (const width of [390, 1440]) {
  test(`@curated static intro keeps its cover until provider ready and reserves one video box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await staticFallback(page);
    let releaseSDK!: () => void;
    const pendingSDK = new Promise<void>(resolve => { releaseSDK = resolve; });
    const activity = { sdk: 0, frames: 0 };
    await page.route(SDK, async route => {
      activity.sdk++;
      await pendingSDK;
      await route.fulfill({ contentType: "application/javascript", body: SDK_STUB });
    });
    await page.route(PLAYER, route => {
      activity.frames++;
      return route.fulfill({ contentType: "text/html", body: "<p>Official player fixture</p>" });
    });
    try {
      await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
      const guide = page.locator("[data-system-guide]");
      const cover = guide.locator("[data-preview-fallback] img");
      const player = guide.locator("[data-preview-player] iframe");
      await expect(guide).toBeVisible();
      await expect(cover).toBeVisible();
      await expect(cover).toHaveAttribute("src", COVER);
      await expect.poll(() => activity.sdk).toBe(1);
      expect(await page.evaluate(() => document.documentElement.dataset.variant)).toBeUndefined();
      await expect(player).toHaveCount(0);

      // Cause real ResizeObserver deliveries while the SDK is pending. They
      // must neither reveal a hidden frame nor prematurely hide the cover.
      await page.setViewportSize({ width: width + 8, height: 900 });
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      await expect(cover).toBeVisible();
      await expect(player).toHaveCount(0);
      expect(activity.frames).toBe(0);
      await page.evaluate(() => document.fonts.ready);
      const before = await geometry(page);
      expect(before.positioned).toBe("relative");
      expect(before.ratio).toBeCloseTo(16 / 9, 2);
      expect(before.width).toBeGreaterThan(200);

      releaseSDK();
      await expect(player).toHaveCount(1);
      await expect.poll(() => activity.frames).toBe(1);
      await page.waitForFunction(() => typeof (window as any).__staticPreviewReady === "function");
      await expect(cover).toBeVisible();
      await expect(player).not.toBeVisible();
      const url = new URL((await player.getAttribute("src"))!);
      for (const key of ["autoplay", "muted", "preload", "playsinline"]) expect(url.searchParams.get(key)).toBe("true");
      await expect(player).toHaveAttribute("allow", /autoplay/);

      await page.evaluate(() => (window as any).__staticPreviewReady());
      await expect(player).toBeVisible();
      await expect(cover).not.toBeVisible();
      const after = await geometry(page);
      expect(after.height).toBeCloseTo(before.height, 1);
      expect(after.courseTop).toBeCloseTo(before.courseTop, 1);
      expect(after.playerWidth).toBeCloseTo(after.width, 1);
      expect(after.playerHeight).toBeCloseTo(after.height, 1);
      expect(after.mediaBottom).toBeLessThanOrEqual(after.courseTop);
      expect(after.overflow).toBe(false);
      await expect(guide.locator("[data-course-url]")).toHaveCount(2);
      await expect(guide.locator("[data-load-preview], [data-system-preview-load], .affiliate-disclosure")).toHaveCount(0);
      await expect(guide).not.toContainText(/commission/i);
      expect(activity.frames).toBe(1);
    } finally { releaseSDK(); }
  });
}

test("static provider HTTP 403 retains the cover and removes the failed iframe after its watchdog", async ({ page }) => {
  await page.clock.install();
  await staticFallback(page);
  await page.route(SDK, route => route.fulfill({ contentType: "application/javascript", body: SDK_STUB }));
  await page.route(PLAYER, route => route.fulfill({ status: 403, contentType: "text/html", body: "Forbidden: origin not allowed" }));
  const failure = page.waitForResponse(response => PLAYER.test(response.url()) && response.status() === 403);
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await failure;
  const guide = page.locator("[data-system-guide]");
  await expect(guide.locator("[data-preview-fallback] img")).toBeVisible();
  await expect(guide.locator("[data-preview-player] iframe")).toHaveCount(1);
  await page.clock.fastForward(20_001);
  await expect(guide.locator("[data-preview-player] iframe")).toHaveCount(0);
  await expect(guide.locator("[data-preview-fallback] img")).toBeVisible();
  await expect(guide.locator('[data-course-placement="top"] [data-course-url]')).toBeVisible();
});

test("without JavaScript the emitted System shows its exact cover and working course link", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  try {
    await context.route(url => url.href === COVER, route => route.fulfill({ contentType: "image/svg+xml", body: IMAGE }));
    await context.route(url => url.origin + url.pathname === COURSE, route => route.fulfill({ contentType: "text/html", body: "<h1>Official course destination</h1>" }));
    const page = await context.newPage();
    await page.goto(ROUTE, { waitUntil: "load" });
    const guide = page.locator("[data-system-guide]");
    await expect(guide).toBeVisible();
    await expect(guide.locator(".system-cover")).toBeVisible();
    await expect(guide.locator(".system-cover")).toHaveAttribute("src", COVER);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(guide).not.toContainText(/commission/i);
    const primary = guide.locator('[data-course-placement="top"] [data-course-url]');
    const href = new URL((await primary.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe(COURSE);
    const popup = context.waitForEvent("page");
    await primary.click();
    await expect((await popup).getByRole("heading", { name: "Official course destination" })).toBeVisible();
  } finally { await context.close(); }
});
