import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * PRACTICE IS ONE MIXED SESSION (owner U56 e, 2026-10-28, v1.242.0): "Practice is flashcards reviewing
 * which included past + new (new = gaps) okay? Similar to how Anki mixes known + new cards", and "The
 * goal today is to do 20 flashcards". Three claims, each read off the mounted session the player opens,
 * never recomputed here:
 *   1. a fresh player's Practice holds new gap cards (the weak-spots ranking, D1);
 *   2. a player with due cards gets BOTH, interleaved: reviews first, a new deck before the last review;
 *   3. the 20-card goal shows progress and never blocks: past the goal, reviews still deal and grade.
 * The ratio and the quota are pinned at the planner by tests/gameplan.test.mjs; this file pins that the
 * session the player sees is the planner's queue, and that the goal line moves with real grades.
 *
 * Harness: the DSL serves `{}` for dossier chunks, which no claim here reads; deck chunks are real.
 * No gameplay rng branch is used: the roll is paused before any fixture is seeded.
 *
 * Mutants (tests/artifacts/sidebar_mutants.md has the table): the session dealt as reviews-then-new
 * (`plan.due` + `plan.fresh` in place of `plan.queue`) is red at claim 2; a planner that only fills
 * the goal from reviews' share is red at claim 1; a goal line that does not count today's answers is red
 * at claim 3's first read; a session that deals nothing once the goal is met is red at claim 3's rows.
 */
async function setup(page: any, seed: { due: number, answered: number }) {
  const j = journey(page);
  await j.boot("/");
  const fx = await page.evaluate(async ({ due, answered }: { due: number, answered: number }) => {
    const a = (window as any).__neural;
    if (!await a._ensureGameplanRuntime()) throw Error("Study runtime did not load");
    a.setPaused(true);
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.cardDone = new Set(); a._miniGraded = new Set();
    a._gameplanProvider = null;   // no study comparison: new cards come from the weak-spots ranking (D1)
    const day = a._epochDay();
    // reviews: ONE owed card in each of `due` real decks, so the planner's card ratio has rows to space
    const keys = Object.keys(a.flashcards.decks).filter((k) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 3).slice(0, due + 2);
    await a.hydrateDecks(keys);
    const dueKeys = [] as string[];
    for (const k of keys) {
      if (dueKeys.length >= due) break;
      const c = (a._cardsOf(a.flashcards.decks[k]) || [])[0];
      if (!c) continue;
      a.srs[k] = { [a.qhash(c.q)]: [day - 1 - dueKeys.length, 3, day - 4 - dueKeys.length] };
      dueKeys.push(k);
    }
    // answered today: distinct questions graded today count toward the goal whatever deck they sit in
    if (answered) a.srs["Seed|Top"] = Object.fromEntries(Array.from({ length: answered }, (_, i) => ["s" + i, [day + 1, 1, day]]));
    a.setViewMode("explore"); a.openExplorer(); a.renderExplorer();
    return { dueKeys, day, goal: a.practiceToday().goal };
  }, seed);
  return { j, fx };
}

/** The Practice door the player has today: the stat row's due cell (the sidebar's Practice row later). */
async function openPractice(j: any) {
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice");
}

/** A measured mouse press on a deck control, scrolled into the pane first: the pane chose the row. */
async function press(page: any, j: any, sel: string, what: string) {
  await expect(page.locator(sel)).toHaveCount(1, { timeout: 5_000 });
  await page.locator(sel).scrollIntoViewIfNeeded();
  await j.clickByMouse(sel, what);
}

/** What the session dealt: one entry per row, in screen order, by the row's own markers. */
async function readQueue(page: any) {
  let rows: { key: string, kind: string }[] = [];
  await expect.poll(async () => {
    rows = await page.evaluate(() => [...document.querySelectorAll("[data-session] [data-session-row]")]
      .map((r) => ({ key: r.getAttribute("data-session-row") as string, kind: r.getAttribute("data-practice-kind") || "" })));
    return rows.length;
  }, { message: "the Practice session mounts its rows" }).toBeGreaterThan(0);
  return rows;
}

test("Practice: a fresh player's session is new gap cards from the weak-spots ranking @curated", async ({ page }) => {
  const { j, fx } = await setup(page, { due: 0, answered: 0 });
  expect(fx.goal, "the default daily goal is 20 cards").toBe(20);
  await openPractice(j);
  const rows = await readQueue(page);
  console.log(`[practice] fresh: ${rows.length} rows, kinds ${rows.map((r) => r.kind).join(",")}`);
  expect(rows.every((r) => r.kind === "new"), "every row is a new gap deck").toBe(true);
  const ranking = await page.evaluate(() => (window as any).__neural.weakSpots().keys as string[]);
  expect(rows.every((r) => ranking.includes(r.key)), "each comes from the weak-spots ranking").toBe(true);
  await expect(page.locator('[data-session-section="Practice"]')).toContainText("weakest first");
  await expect(page.locator("[data-practice-goal]")).toHaveText("Daily goal: 0 of 20 today");
});

test("Practice: a player with due cards gets reviews and new decks, interleaved @curated", async ({ page }) => {
  const { j, fx } = await setup(page, { due: 8, answered: 0 });
  await openPractice(j);
  const rows = await readQueue(page);
  const kinds = rows.map((r) => r.kind);
  console.log(`[practice] mixed: ${kinds.join(",")}`);
  const dueRows = rows.filter((r) => r.kind === "due").map((r) => r.key);
  expect(dueRows.sort(), "every owed deck is dealt").toEqual([...fx.dueKeys].sort());
  expect(kinds[0], "the most overdue review comes first").toBe("due");
  expect(rows[0].key).toBe(fx.dueKeys[fx.dueKeys.length - 1]);
  const firstNew = kinds.indexOf("new");
  expect(firstNew, "new gap decks are dealt beside the reviews").toBeGreaterThan(0);
  expect(firstNew, "and mixed in before the last review, not appended after it").toBeLessThan(kinds.lastIndexOf("due"));
  expect(firstNew, "one new card for every four reviews: four one-card reviews come first").toBe(4);
  await expect(page.locator('[data-session-section="Practice"]')).toContainText("8 cards to review");
});

test("Practice: the daily goal shows progress and never blocks a review @curated", async ({ page }) => {
  const { j } = await setup(page, { due: 3, answered: 19 });
  await openPractice(j);
  await readQueue(page);
  await expect(page.locator("[data-practice-goal]")).toHaveText("Daily goal: 19 of 20 today");
  // grade the open review: the goal line counts it, and reaches the goal
  await press(page, j, "[data-mini-reveal]", "Reveal");
  await press(page, j, "[data-mini-got]", "Got it");
  await expect(page.locator("[data-practice-goal]")).toHaveText("Daily goal: 20 of 20 today ✓");
  // past the goal, the next review still deals and still grades: a goal, never a cap
  // the queue walks on by itself (`_sessionGraded`): wait for the NEXT review's deck to be the open one
  const open = '[data-session-row][data-practice-kind="due"][aria-expanded="true"]:not([data-session-done]) + div';
  await expect(page.locator(open), "the queue moves on to the next review").toHaveCount(1, { timeout: 5_000 });
  await press(page, j, open + " [data-mini-reveal]", "Reveal past the goal");
  await press(page, j, open + " [data-mini-got]", "Got it past the goal");
  await expect(page.locator("[data-practice-goal]")).toHaveText("Daily goal: 21 of 20 today ✓");
  const left = await page.evaluate(() => (window as any).__neural.dueCount());
  expect(left, "two of the three reviews were graded; one still owed, still on offer").toBe(1);
});
