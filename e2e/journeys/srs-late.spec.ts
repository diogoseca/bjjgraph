import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE LATE ANSWER, BY A PLAYER'S PRESSES (v1.305.0, LATE1; the owner's rule, 25 Nov 2026, ruled U223 b): a card answered
 * right on or after its due day comes back after the larger of one step and TWICE THE DAYS SINCE ITS LAST ANSWER
 * (`ngKnowledgeLate`, neural/src/knowledge-profile.src.js). Beside srs-due.spec.ts, which drives the writer through its
 * chokes; this one answers in Practice the way a player does: the drawer and its Practice row by the mouse, the card's
 * Reveal by the mouse, Got it by a touch tap at its measured centre (`elementFromPoint` checked first).
 *
 * The card: a 30-day card last answered 75 days ago (due 45 days ago). One step gave 60 days (v1.304.0); the rule gives
 * 150, and the row carries its late mark for the rating, [0, 0, 60, 150] after the three cells (the one-step interval the
 * rating reads, and the row's own as its check; tests/schedule_late_mark.test.mjs). The saved blob holds the same row.
 * What the harness does not serve here: dossiers (the DSL's empty stub); nothing below reads one.
 * The rule's numbers, its edges and its mutants are pinned in the units (tests/schedule_late.test.mjs); this journey is the
 * claim that the app's own Practice, pressed, stores what the rule writes.
 */
test.use({ hasTouch: true });

test("a card answered late in Practice comes back after twice the days since its last answer (LATE1)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const j = journey(page, { answerMode: "classic" });
  await j.boot("/");
  await page.waitForFunction(() => !!(window as any).__neural.curriculum);
  await page.evaluate(() => (window as any).__neural._ensureGameplanRuntime());
  const plant = await page.evaluate(async () => {
    const a = (window as any).__neural;
    a.setPaused(true);
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {};
    a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} };
    a._gameplanProvider = null; a._miniGraded = new Set(); a.settings.dailyGoal = 20;
    const day = a._epochDay();
    const key = a.curriculum.belts.find((b: any) => b.id === "black").units.flatMap((u: any) => u.lessons)
      .filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey)[0];
    await a.hydrateDecks([key]);
    const c = a._cardsOf(a.flashcards.decks[key])[0];
    const qh = a.qhash(c.q);
    a.srs[key] = { [qh]: [day - 45, 30, day - 75] };   // a 30-day card, last answered 75 days ago
    a.stage[key] = { [qh]: 3 };
    a.setViewMode("explore");
    return { key, qh, day, q: c.q };
  });
  await j.knowsPlanMoves();
  await j.clickByMouse(".ng-logo", "open the drawer");
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "open Practice");
  await expect(page.locator("[data-practice-page]")).toHaveCount(1);
  const start = page.locator("[data-master-start]");
  if (await start.count()) {
    await expect.poll(() => start.isEnabled(), { timeout: 10_000 }).toBe(true);
    await j.clickByMouse("[data-master-start]", "Master the game's button");
  }
  await expect(page.locator("[data-mini-q]:visible"), "the due card is asked").toHaveCount(1);
  await expect(page.locator("[data-mini-q]:visible")).toContainText(plant.q.slice(0, 20));
  await j.clickByMouse("[data-master-bar] [data-mini-reveal]", "reveal the answer");
  // Got it, by a touch tap at its measured centre, after checking that point is the button
  const got = page.locator("[data-master-bar] [data-mini-got]");
  await expect(got).toBeVisible();
  const at = await got.evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit === el || (!!hit && el.contains(hit)), inView: y > 0 && y < innerHeight && x > 0 && x < innerWidth };
  });
  expect(at.hit && at.inView, "Got it is the element at its own centre, on screen").toBe(true);
  await page.touchscreen.tap(at.x, at.y);
  await expect.poll(() => page.evaluate((p: any) => JSON.stringify((window as any).__neural.srs[p.key][p.qh]), plant), { message: "the answer was graded" })
    .not.toBe(JSON.stringify([plant.day - 45, 30, plant.day - 75]));
  const r = await page.evaluate((p: any) => {
    const a = (window as any).__neural;
    return { row: a.srs[p.key][p.qh], saved: a._progressBlob().srs[p.key][p.qh] };
  }, plant);
  // twice the 75 days since its last answer: 150 days (one step gave 60), its late mark the one-step 60
  expect(r.row, "the stored row: due in 150 days, cell 120, answered today, its late mark").toEqual([plant.day + 150, 120, plant.day, 0, 0, 60, 150]);
  expect(r.saved, "and the saved blob holds it").toEqual(r.row);
});
