import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/** TAP1. A TAP on Practice gets the plan a CLICK gets: the same decks in the same order, and the
 * same count line ("N new across M techniques, weakest first"), which is not empty.
 *
 * The defect (v1.248.0 to v1.256.5, production included): `_afterPress` held Practice's plan while
 * the drawer list matched `:hover`, waiting for a pointerleave. After a tap Chrome keeps `:hover` on
 * the list for about 0.1 s while the finger's pointerleave has already fired, so a tap got the cold
 * one-deck queue and an EMPTY count line for good. A click recovered: its browser fires pointerleave
 * when the list hides under the mouse. The fix asks which pointer last entered the drawer.
 *
 * Both presses are a player's: `j.clickByMouse`, and a touchscreen tap at the measured centre after
 * `elementFromPoint` names the target (no locator click, CLAUDE.md §6.3). The tap runs FIRST, on a
 * page the mouse has never touched, so no resting mouse can fire the leave that rescues it.
 * Each run boots afresh (`j.boot` clears storage): the two plans are a guest's, from the same state.
 * The harness serves the real gameplan.js and decks from this worktree's build, so the plan is the
 * real planner's; dossiers are its empty stub, and no claim here reads one.
 *
 * Mutant (kills here): drop `!this._paneHoverTouch &&` from `_afterPress`, restoring the wait.
 * Both viewports go red at the tap's count line. Receipt: docs/Changelog-Archive.md, v1.256.6. */
test.use({ hasTouch: true });

const PRACTICE = '[data-explore-stats] [data-b="due"]';
const COUNT = '[data-practice-details] [data-session-section="Practice"]';

async function tap(page: Page, selector: string, what: string) {
  const hit = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 };
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (r.width < 1 || r.height < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight)
      return { ok: false, why: "centre off screen " + JSON.stringify(r), x, y };
    const top = document.elementFromPoint(x, y);
    return { ok: !!top && (top === el || el.contains(top)), why: "elementFromPoint is " + (top ? "<" + top.tagName.toLowerCase() + " class=" + JSON.stringify(String(top.className)) + ">" : "nothing"), x, y };
  }, selector);
  expect(hit.ok, `${what} is reachable by a finger where it sits: ${hit.why}`).toBe(true);
  await page.touchscreen.tap(hit.x, hit.y);
}

async function openPractice(page: Page, how: "tap" | "click") {
  const j = journey(page);
  await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  if (how === "tap") await tap(page, ".ng-logo", "the drawer icon");
  else await j.clickByMouse(".ng-logo", "the drawer icon");
  await expect(page.locator(PRACTICE)).toBeVisible();
  if (how === "tap") await tap(page, PRACTICE, "Practice");
  else await j.clickByMouse(PRACTICE, "Practice");
  await expect(page.locator("[data-practice-page]")).toHaveCount(1);
  // Only the planner writes this line; the cold queue a held plan leaves behind writes nothing.
  await expect.poll(() => page.locator(COUNT).evaluate((e) => e.textContent || ""), {
    timeout: 20_000, message: `after a ${how}, Practice's count line is written by the plan`,
  }).not.toBe("");
  return page.evaluate((sel) => ({
    count: document.querySelector(sel)!.textContent || "",
    rows: [...document.querySelectorAll("[data-practice-page] [data-session-row]")].map((r) => r.getAttribute("data-session-row") || ""),
  }), COUNT);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`TAP1: ${viewport.width}×${viewport.height} a tap on Practice gets the plan a click gets`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const tapped = await openPractice(page, "tap");
    const clicked = await openPractice(page, "click");
    expect(clicked.count, "a click's count line names new work").toMatch(/\d+ new across \d+ techniques?/);
    expect(tapped.count, "the count line a tap gives is the count line a click gives").toBe(clicked.count);
    expect(clicked.rows.length, "deck rows compared (a positive count)").toBeGreaterThan(0);
    expect(tapped.rows, "a tap gives the same decks, in the same order").toEqual(clicked.rows);
  });
}
