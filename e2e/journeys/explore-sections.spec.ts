import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * EXPLORE SECTIONS DEFAULT COLLAPSED (v1.99.3, owner: opening the pane showed Systems
 * already expanded — "showing all categories should be collapsed").
 *
 * The contract:
 *  - EVERY top-level Explore section — Systems, Principles, Positions, Transitions,
 *    Submissions, Learning — starts COLLAPSED on a fresh profile. Collapse is
 *    presentation only; nothing locks.
 *  - Expanding persists per section, reload-stable, in ONE settings map
 *    (`exploreOpenSections` — the challengeOpenSections pattern).
 *  - Search must never hide a match behind a fold: a query renders FLAT ranked results
 *    (the pre-existing design), so an item inside a collapsed group is always reachable
 *    by typing its name.
 *
 * Handles: [data-explore-section="<label>"] (header buttons, aria-expanded),
 *          [data-system-row], [data-list-add][data-list-surface="explore"] (leaf rows)
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

const SECTIONS = [
  "Systems",
  "Principles",
  "Positions",
  "Transitions",
  "Submissions",
  "Learning",
];

/** Systems is a deferred payload; the section header only exists once it lands — and its
 *  arrival re-renders the whole Explore body, which can replace an element between a
 *  test's measure and its next step. Settle it before asserting. */
const awaitSystems = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.waitForTimeout(80); // the arrival re-render settles
};

/** Open the pane on Explore the way a user does: the logo, then the tab. */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  await awaitSystems(page);
};

/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise). */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200));
};

test("fresh boot: every Explore section starts collapsed — no rows leak below a folded header @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page); // settles systems — the Systems header exists once it lands

  for (const s of SECTIONS)
    await expect(
      page.locator(`[data-explore-section="${s}"]`),
      `${s} starts collapsed`,
    ).toHaveAttribute("aria-expanded", "false");

  await expect(
    page.locator("[data-system-row]"),
    "no system rows under a folded Systems header",
  ).toHaveCount(0);
  await expect(
    page.locator('[data-list-add][data-list-surface="explore"]'),
    "no technique leaf rows under folded groups",
  ).toHaveCount(0);

  await page
    .locator(".ng-drill")
    .screenshot({ path: resolve(SHOTS, "explore-collapsed-after.png") });
});

test("expanding a section persists across reload; its neighbours stay folded", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  const positions = page.locator('[data-explore-section="Positions"]');
  await j.clickByMouse('[data-explore-section="Positions"]', "the Positions header");
  await expect(positions).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.locator('[data-list-add][data-list-surface="explore"]').count(),
    "expanding really shows the rows",
  ).toBeGreaterThan(0);

  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(
    page.locator('[data-explore-section="Positions"]'),
    "the expansion is remembered (exploreOpenSections, per-key LWW settings)",
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-explore-section="Submissions"]'),
    "…without dragging any other section open",
  ).toHaveAttribute("aria-expanded", "false");

  // and folding it again persists too — the map stores intent, not just first-touch
  await page.locator('[data-explore-section="Positions"]').click();
  await expect(positions).toHaveAttribute("aria-expanded", "false");
  await reloadKeepingStorage(page);
  await openExplore(page);
  await expect(
    page.locator('[data-explore-section="Positions"]'),
  ).toHaveAttribute("aria-expanded", "false");
});

test("search reveals a technique living inside a collapsed group — matches are never hidden by a fold", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  await expect(
    page.locator('[data-explore-section="Submissions"]'),
    "premise: Submissions is folded",
  ).toHaveAttribute("aria-expanded", "false");

  const pick = await page.evaluate(() => {
    const a = (window as any).__neural;
    const n = a.nodes.find((x: any) => x.ty === "submissions");
    return { id: n.id, q: n.t.toLowerCase() };
  });
  await page.locator(".ng-explorer-search input").fill(pick.q);
  await expect(
    page.locator(`[data-list-add="${pick.id}"]`).first(),
    "the match renders flat, straight through the fold",
  ).toBeVisible();

  // clearing the query returns to the folded shelf — the fold state was untouched
  await page.locator(".ng-explorer-search input").fill("");
  await expect(
    page.locator('[data-explore-section="Submissions"]'),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(`[data-list-add="${pick.id}"]`)).toHaveCount(0);
});
