import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * Section rhythm of an open System in the Neural pane.
 *
 * The owner's rule for spacing is a RATIO of a token already on the page, never a raw px
 * ("50% more of the left padding"). Here the token is the guide body's line-height
 * (`--ng-system-body-lh` in neural/src/systems.css) and the rule is: every top-level block of
 * the guide body — the course block, the overview, each guide section, the closing course
 * reminder, the references, the technique list and Sources — starts TWO LINES below the block
 * before it. The hero (title → intro video → View course) is one unit and keeps its tighter
 * grouping; the first boundary measured is the one below the top course block.
 *
 * What is pinned is the ratio gap ÷ line-height, read from the RENDERED boxes and the COMPUTED
 * line-height, at 1440 and 390. The px is never asserted. A second pass moves the token itself
 * (inline override of the custom property) and re-measures, so a mutant that hard-codes the gap
 * in px keeps the old ratio at the old token and goes red on the moved one.
 *
 * Fixtures are authored (the DSL serves {} for dossier chunks); the layout is read from the real
 * renderer's DOM. This does not certify provider playback or the authored corpus.
 */

const COURSE = "https://bjjfanatics.com/products/fixture-course";
const COVER = "https://cdn.shopify.com/s/files/1/fixture-course-cover.png";
const RATIO = 2; // lines of guide body between top-level blocks
const product = () => ({ name: "Exact Fixture Course", instructor: "Fixture Instructor", id: "fixture-course", vendor: "bjjfanatics",
  course_url: COURSE, url: COURSE, affiliate: false, image: COVER });
const catalog = () => ({ _meta: { count: 2 }, systems: [
  { id: "Systems/Fixture-Octopus", key: "Fixture Octopus|System", name: "Stable Fixture Octopus System", display_title: "Octopus choices",
    aliases: [], type: "Guard System", difficulty: "Intermediate", nodes: ["Positions/Mount", "Positions/Closed Guard"], glue: [], products: [product()], summary: "Compare the advertised scope with your study question." },
  { id: "Systems/Fixture-Alternative", key: "Fixture Alternative|System", name: "Alternative guard", display_title: "Turtle alternative",
    aliases: [], type: "Guard System", nodes: [], glue: [], products: [], summary: "A different starting position." },
] });
const body = (): any => ({
  overview: "The official listing describes the course scope; it does not establish effectiveness.\n\nA second paragraph keeps the overview two paragraphs tall.",
  guide: {
    kind: "course_companion", display_title: "Octopus choices",
    audience: { fits: ["You want to compare seated-guard options.", "You already play a seated guard."], consider_alternative_if: ["You want a standing-first plan."], prerequisites: ["Recognize the named starting positions."] },
    coverage: { includes: ["Advertised seated-guard topics.", "Entries from the knees."], limits: ["The listing does not demonstrate mechanics."] },
    alternatives: [{ system: "Alternative guard", title: "Turtle alternative", url: "/Systems/Fixture-Alternative", reason: "Choose the turtle guide for a turtle starting point." }],
    sources: [{ id: "listing", url: COURSE, title: "Official fixture course contents", kind: "official_listing", checked_on: "2026-09-16", note: "Listing scope only." }],
  },
  references: [{ name: "Frames reference", type: "Principle", url: "/Principles/Fixture-Frames", relationship: "Related concept." }],
});
const boot = async (page: Page) => {
  const j = journey(page);
  await j.boot("/");
  const data = catalog();
  await page.route("**/systems.json", r => r.fulfill({ json: data }));
  await page.route("**/concepts.json", r => r.fulfill({ json: { concepts: [{ id: "Principles/Fixture-Frames", key: "Fixture Frames|Principle", name: "Frames reference", cat: "Principle", nodes: [] }] } }));
  await page.route("**/static/neural/content/*.json", r => r.fulfill({ json: {
    [data.systems[0].key]: body(),
    [data.systems[1].key]: { guide: { ...body().guide, display_title: "Turtle alternative", kind: "topic_guide" }, references: [] },
    "Fixture Frames|Principle": { overview: "Read this principle as a reference." },
  } }));
  await page.route(COVER, r => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#59406d"/></svg>' }));
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  const hdr = page.locator('[data-explore-section="Systems"]');
  await expect(hdr).toBeVisible();
  if ((await hdr.getAttribute("aria-expanded")) !== "true") await hdr.click();
  for (const category of await page.locator("[data-system-category]").all()) {
    if ((await category.getAttribute("aria-expanded")) !== "true") await category.click();
  }
  await page.locator('[data-system-row="Systems/Fixture-Octopus"]').click();
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  await expect(page.locator("[data-system-sources]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

// Every block that OPENS a section of the guide body. The first course block is the hero's
// foot and is excluded by `after`; everything below it is a section boundary.
const STARTS = '[data-system-courses], [data-system-overview], .ng-system-guide, .ng-system-members-head, [data-system-sources]';
const rhythm = (starts: string) => {
  const detail = document.querySelector("[data-system-detail]")!;
  const list = detail.parentElement!;
  const visible = [...list.children].filter(el => el.getClientRects().length && el.getBoundingClientRect().height > 0) as HTMLElement[];
  const token = parseFloat(getComputedStyle(list.querySelector(".ng-system-guide")!).lineHeight);
  const boundaries: { name: string; gap: number }[] = [];
  let seenCourse = false;
  visible.forEach((el, i) => {
    if (!el.matches(starts) || i === 0) return;
    if (el.matches("[data-system-courses]") && !seenCourse) { seenCourse = true; return; } // the hero's View course block
    const prev = visible[i - 1].getBoundingClientRect(), cur = el.getBoundingClientRect();
    boundaries.push({ name: el.getAttribute("data-system-courses") ? "course:" + el.getAttribute("data-course-placement") : (el.className || el.tagName).toString().slice(0, 40), gap: cur.top - prev.bottom });
  });
  return { token, boundaries };
};

for (const width of [1440, 390]) {
  test(`@curated System sections sit two body lines apart at ${width}px, as a ratio of the line-height token`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    const before = await page.evaluate(rhythm, STARTS);
    expect(before.token).toBeGreaterThan(10);
    expect(before.boundaries.length).toBeGreaterThanOrEqual(6); // positive coverage: overview, fit, alternatives, coverage, closing course, references, members, sources
    for (const b of before.boundaries) expect(b.gap / before.token, b.name).toBeCloseTo(RATIO, 1);

    // Move the token, not the px: the ratio must survive a different line-height.
    await page.evaluate(() => { for (const el of document.querySelectorAll("[data-system-detail] ~ *")) (el as HTMLElement).style.setProperty("--ng-system-body-lh", "2.4"); });
    const moved = await page.evaluate(rhythm, STARTS);
    expect(moved.token).toBeGreaterThan(before.token * 1.2);
    expect(moved.boundaries.length).toBe(before.boundaries.length);
    for (const b of moved.boundaries) expect(b.gap / moved.token, "moved token: " + b.name).toBeCloseTo(RATIO, 1);
  });
}
