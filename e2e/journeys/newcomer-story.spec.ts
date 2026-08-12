import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * CAPSTONE C — THE NEWCOMER'S FIRST SESSION (one continuous journey).
 *
 * Everything a brand-new player meets, in the order they meet it, as one story rather than as
 * isolated assertions. If this passes, the front door works:
 *
 *   fresh boot → the coach greets them with the clock frozen → the landing state introduces
 *   itself and asks ONE question → they answer it with a letter → the odds visibly rise and the
 *   clock is refunded → they peek a move's sheet → they execute → the needle decides it →
 *   they open the flashcards pane and the GAME STOPS → the pane is a history in Q&A →
 *   they close it and the game RESUMES → they click a node on the graph and roam there, paused →
 *   they press play and only then does a session begin → they open Challenges and find their
 *   Game Knowledge beside White objective evidence → it all survives a reload.
 *
 * Deliberately one boot + one preserveStorage reload, driving bulk steps through the same rails
 * the UI uses, to stay well inside the 240s ceiling.
 */

test("newcomer's first session: coach → question → execute → pane → roam → Challenges → persists", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });

  // ── 1. the coach greets them, and the clock does not run while they read ──
  await j.land("Mount Top", { keepCoach: true });
  await expect(page.locator("[data-coach]"), "a first-run coach").toBeVisible();
  const clock0 = await page.evaluate(() =>
    (window as any).__neural.decisionRemaining(),
  );
  await j.advance(3000);
  expect(
    Math.abs(
      (await page.evaluate(() =>
        (window as any).__neural.decisionRemaining(),
      )) - clock0,
    ),
    "frozen while the coach talks",
  ).toBeLessThan(0.5);
  await page.evaluate(() => (window as any).__neural.dismissCoach());
  await j.expectBeat("coach_done");

  // ── 2. the state introduces itself and asks exactly one question ──
  await expect(page.locator("[data-landcard]"), "identity card").toBeVisible();
  await expect(page.locator("[data-land-id]")).toBeVisible();
  await expect(page.locator("[data-land-q]"), "one question").toHaveCount(1);
  const idText = (await page.locator("[data-land-id]").textContent()) || "";
  expect(idText, "marked as new to them").toContain("○");

  // ── 3. answering right raises the odds and buys clock ──
  const target = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const i of a.optionIdxs || []) {
      const odds = Math.round(a.moveChance(a.nodes[i]) * 100);
      if (a.nodes[i].ty === "transitions" && odds >= 20 && odds <= 70)
        return a.nodes[i].t;
    }
    return (a.nodes[(a.optionIdxs || [])[0]] || {}).t || "";
  });
  expect(target, "a transition to aim at").toBeTruthy();
  const oddsBefore = await j.displayedOdds(target);
  const clockBefore = await page.evaluate(() =>
    (window as any).__neural.decisionRemaining(),
  );
  const mc = await page.evaluate(() => (window as any).__neural._mc);
  await page.keyboard.press("abcd"[mc.correct]);
  expect(await j.displayedOdds(target), "odds rose").toBeGreaterThan(
    oddsBefore,
  );
  expect(
    await page.evaluate(() => (window as any).__neural.decisionRemaining()),
    "and the clock was refunded",
  ).toBeGreaterThan(clockBefore);

  // ── 4. peek the move, then execute; the needle decides it ──
  await page.locator(`[data-tech="${target}"]`).first().click();
  await expect(
    page.locator("[data-go]"),
    "the sheet, with what it wins you",
  ).toBeVisible();
  await j.rig("resolve", [0.01]);
  await j.rig("outcome", [0.01]);
  await page.locator("[data-go]").click();
  await j.advanceUntil("sweep_land", 12000);
  await j.expectBeat("impact_success");
  await j.nextHand();

  // ── 5. the pane stops the game, is a history in Q&A, and resuming is closing it ──
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "roll live",
  ).toBe(false);
  // the pill is deleted (v1.99.0): "study this state" lives on the landing card's chip,
  // which opens the pane straight onto Last rolls with the current row's deck open
  await page.locator("[data-land-count]").click();
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "the pane stopped it",
  ).toBe(true);
  await j.expectBeat("pane_paused");
  expect(
    await page.locator("[data-hist]").count(),
    "a row per state visited",
  ).toBeGreaterThan(1);
  const deck = page.locator("[data-mini-deck]").first();
  await expect(deck.locator("[data-mini-q]"), "question").toBeVisible();
  await deck.locator("[data-mini-reveal]").click();
  await expect(deck.locator("[data-mini-a]"), "then the answer").toBeVisible();
  await expect(
    page.locator(".ng-drill [data-mc-opt]"),
    "never options in here",
  ).toHaveCount(0);
  await page.locator(".ng-explorer-close").click();
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "closing resumed it",
  ).toBe(false);
  await j.expectBeat("pane_resumed");

  // ── 6. roaming: click a node, arrive paused, and nothing is spent until they press play ──
  const elsewhere = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const n of a.nodes) {
      if (n.ty !== "positions" || n.idx === a.currentPos) continue;
      if (a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions"))
        return n.idx;
    }
    return -1;
  });
  await page.evaluate(
    (i) => (window as any).__neural.stageRollAt(i),
    elsewhere,
  );
  await j.expectBeat("roll_staged");
  await j.advance(1500);
  expect(
    await page.evaluate(() => (window as any).__neural.currentPos),
    "we are there",
  ).toBe(elsewhere);
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "and held",
  ).toBe(true);
  expect(
    await page.evaluate(() => !!(window as any).__neural._played),
    "nothing spent yet",
  ).toBe(false);
  await page.evaluate(() => (window as any).__neural.setPaused(false));
  await j.advance(600);
  expect(
    await page.evaluate(() => !!(window as any).__neural._played),
    "play starts the session",
  ).toBe(true);

  // ── 7. Challenges: objective evidence stays separate from Game Knowledge ──
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.setViewMode("challenges");
    a.openExplorer();
    a.showExplorerList();
  });
  await expect(page.locator(".ng-learning-nav")).toBeVisible(); // the knowledge belt lives in Explore since v1.96.0
  await expect(page.locator(".ng-track-card")).toHaveCount(5);
  const challengeDone = await page.evaluate(
    () => (window as any).__neural.challengeTrackProgress("white").done,
  );
  expect(
    challengeDone,
    "White Challenges have been ticking off what they actually did",
  ).toBeGreaterThan(3);
  expect(
    await page.locator(".ng-challenge-row[data-complete='true']").count(),
  ).toBe(challengeDone);
  expect(
    await page.locator("[data-crown]").count(),
    "every lesson wears a crown",
  ).toBeGreaterThan(10);

  // ── 8. it all survives coming back ──
  const snapshot = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      whiteChallenges: a.challengeTrackProgress("white").done,
      score: a.gameScore().score,
      stages: Object.keys(a.stage || {}).length,
    };
  });
  expect(snapshot.stages, "their answer was written down").toBeGreaterThan(0);

  await j.boot("/", { preserveStorage: true, keepTutorial: true });
  await j.land("Mount Top");
  const back = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      whiteChallenges: a.challengeTrackProgress("white").done,
      score: a.gameScore().score,
      coached: !!localStorage.getItem("bjj-neural-coached"),
    };
  });
  expect(back.whiteChallenges, "Challenge progress persisted").toBe(
    snapshot.whiteChallenges,
  );
  expect(back.score, "score persisted").toBeCloseTo(snapshot.score, 6);
  expect(back.coached, "and they are not coached at again").toBe(true);
  await expect(page.locator("[data-coach]"), "no second first-run").toHaveCount(
    0,
  );
  await j.keyframe("capstone-c-newcomer");
});
