import { expect, test } from "@playwright/test";

/**
 * Section rhythm of the emitted (static) System guide — the crawler / no-JS / failed-bundle
 * surface, styled by scripts/system_guide.css.
 *
 * Same rule as the Neural pane (systems-rhythm.spec.ts): the token is the guide body's
 * line-height (`--system-body-lh` on `.system-guide`) and every top-level block from the
 * overview down to Sources starts TWO LINES below the block before it. The hero
 * (title → intro → View course) is one unit and is not measured. The ratio is pinned, never the
 * px, and a second pass moves the token and re-measures so a hard-coded px gap goes red.
 *
 * The bundle is refused so the article is what renders; provider media is never requested.
 */
const ROUTE = "/Systems/Danaher-Leg-Lock-System";
const RATIO = 2;
const STARTS = "#overview, #fit, #coverage, [data-course-placement='end'], #related-content, #sources";
const rhythm = (starts: string) => {
  const main = document.querySelector("main.system-guide") as HTMLElement;
  const visible = [...main.children].filter(el => el.getClientRects().length && el.getBoundingClientRect().height > 0) as HTMLElement[];
  const token = parseFloat(getComputedStyle(main).lineHeight);
  const boundaries: { name: string; gap: number }[] = [];
  visible.forEach((el, i) => {
    if (!el.matches(starts) || i === 0) return;
    const prev = visible[i - 1].getBoundingClientRect(), cur = el.getBoundingClientRect();
    boundaries.push({ name: el.id || el.className, gap: cur.top - prev.bottom });
  });
  return { token, boundaries };
};

for (const width of [1440, 390]) {
  test(`@curated static System sections sit two body lines apart at ${width}px, as a ratio of the line-height token`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/static/neural/app/neural.js*", route => route.fulfill({ status: 404, body: "Bundle unavailable" }));
    await page.route(/mediadelivery\.net|youtube/, route => route.abort());
    await page.goto(ROUTE, { waitUntil: "load" });
    await expect(page.locator("main.system-guide")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await page.evaluate(rhythm, STARTS);
    expect(before.token).toBeGreaterThan(10);
    expect(before.boundaries.length).toBe(6); // overview, fit, coverage, closing course, related, sources
    for (const b of before.boundaries) expect(b.gap / before.token, b.name).toBeCloseTo(RATIO, 1);

    await page.evaluate(() => (document.querySelector("main.system-guide") as HTMLElement).style.setProperty("--system-body-lh", "2.4"));
    const moved = await page.evaluate(rhythm, STARTS);
    expect(moved.token).toBeGreaterThan(before.token * 1.2);
    expect(moved.boundaries.length).toBe(6);
    for (const b of moved.boundaries) expect(b.gap / moved.token, "moved token: " + b.name).toBeCloseTo(RATIO, 1);
  });
}
