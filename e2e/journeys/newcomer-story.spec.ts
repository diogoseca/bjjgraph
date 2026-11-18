// v1.230.0 reverses v1.218.1 / v1.220.0 Inspect: D-318 replaces the sheet with the video viewer; the card commits.
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * CAPSTONE C — THE NEWCOMER'S FIRST SESSION (one continuous journey).
 *
 * Everything a brand-new player meets, in the order they meet it, as one story rather than as
 * isolated assertions. If this passes, the front door works:
 *
 *   fresh boot → the landing state introduces
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

test("newcomer's first session: question → execute → pane → roam → Challenges → persists", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });

  // ── 1. they land ──
  // v1.104.0: the 3-panel coach that used to greet them here is DELETED (owner). What it
  // guarded — a frozen clock while a newcomer reads — was real and was measured true on the way
  // out; it just cost the first screen a floating explainer nobody asked for. The first landing
  // now opens straight on the card, its question, and the hand.
  await j.land("Mount Top");

  // ── 2. the state introduces itself and asks exactly one question ──
  await expect(page.locator("[data-landcard]"), "identity card").toBeVisible();
  // v1.175.0: the graph owns identity; the deck count is a quiet line in the card's corner.
  await expect(page.locator("[data-land-id]")).toHaveCount(0);
  await expect(page.locator(".ng-landmore [data-land-count]")).toHaveCount(0);
  const idText = (await page.locator("[data-landcard] [data-land-corner] [data-land-count]").textContent()) || "";
  // Since v1.181.0 the visible counter is the card's page number, not mastery.
  expect(idText, "the deck opens on its first card").toMatch(/^1\/\d+$/);
  await expect(page.locator("[data-landcard] [data-land-count]"),
    "nothing answered yet").toHaveAttribute("aria-label", /; 0 answered this visit$/);
  await expect(page.locator("[data-landcard] [data-land-count]"),
    "nothing proven yet").toHaveAttribute("data-land-count", /^0\/\d+$/);
  await expect(page.locator("[data-land-q]"), "one question").toHaveCount(1);
  await j.openQuestion(); // U47 d: the newcomer takes the question up with Answer for Points

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
  // v1.133.0: answering disarms the question window — no refund exists any more
  expect(
    await page.evaluate(() => (window as any).__neural.decisionRemaining()),
    "the window is spent by the answer",
  ).toBe(0);
  void clockBefore;

  // ── 4. peek the move, then execute; the needle decides it ──
  await j.watchChoice(target);
  await expect(page.locator(`[data-tech="${target}"] .ng-choice-title-button`)).toBeVisible();
  await j.rig("resolve", [0.01]);
  await j.rig("outcome", [0.01]);
  await j.pick(target);
  await j.advanceUntil("sweep_land", 12000);
  await j.expectBeat("impact_success");
  await j.nextHand();

  // ── 5. the pane stops the game, is a history in Q&A, and resuming is closing it ──
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "roll live",
  ).toBe(false);
  // "Study this state" is the pane's Last rolls tab (v1.175.0 — the corner count opens nothing);
  // the same rail pane-history.spec.ts drives.
  // v1.282.0 (rulings R2, SET1-GO; the reader of #423, D3): a newcomer has nothing stored, so this story runs on the default
  // throughout. Written when that meant Classic recall in the sidebar ("question, then the answer"); under Auto, Last rolls'
  // deck asked a newcomer's new card as multiple choice, on its own surface, until the deck left the row in v1.293.0 (below).
  await page.locator(".ng-logo").click();
  await page.locator('[data-view="history"]').click();
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "the pane stopped it",
  ).toBe(true);
  await j.expectBeat("pane_paused");
  expect(
    await page.locator("[data-hist]").count(),
    "a row per state visited",
  ).toBeGreaterThan(1);
  await expect(page.locator("[data-hist-current]"), "the latest roll row is focused").toBeVisible();
  // v1.293.0 (L3): RE-POINTED. A row is a place the newcomer went through: a click shows its two actions and no card (its
  // inline deck, whose new card asked multiple choice here, left the row; that claim is answer-mode.spec.ts's, on the card
  // "Practise here" opens). The step keeps what it was for: the pane is a history the newcomer can act on, and the full-pane
  // study view stays shut. "Practise here" opens that place in Master the game (a newcomer knows no move there yet, so its
  // moves are asked first, as bars), and the brand leads back. Mutant, this build: "Practise here" opens nothing → red at
  // "Practise here opens the place in Master the game"; on dev's build the step's own mutant (the inline deck never asks
  // multiple choice) was red at the assertion this replaces.
  await page.locator("[data-hist-current]").click();
  await expect(page.locator("[data-hist-show]"), "the row's first action: Show on the map").toBeVisible();
  await expect(page.locator("[data-hist-go]"), "and its second: Practise here").toBeVisible();
  await expect(page.locator(".ng-drill [data-mini-deck]"), "no card in the row").toHaveCount(0);
  await expect(
    page.locator(".ng-drill [data-mc-opt]"),
    "and the full-pane study view stays shut",
  ).toHaveCount(0);
  const place = await page.locator("[data-hist-current]").getAttribute("data-hist");
  await page.locator("[data-hist-go]").click();
  await expect(page.locator("[data-practice-page]"), "Practise here opens the place in Master the game").toHaveCount(1);
  await expect.poll(() => page.evaluate(() => { const a = (window as any).__neural, s = a._session; return s && !s.list ? (s.czOpen != null ? s.czOpen : a._masterSeatOf(s, s.keys[s.idx])) : null; }),
    { timeout: 30_000, message: "at the place the row holds" }).toBe(place);
  await page.locator(".ng-drawer-brand").click();
  await expect(page.locator(".ng-drawer-brand"), "the brand leads back to Last rolls").toHaveText("‹ Last rolls");
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
      // Retired control-position aliases redirect into submissions (v1.176.0);
      // this part of the story is about roaming to a normal, available position.
      if (n.ty !== "positions" || n.idx === a.currentPos || !a.rsAllows(n)) continue;
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
  await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's, opened by its row (the DSL's one door)
  await expect(page.locator(".ng-drawer-head")).toBeVisible(); // the knowledge belt lives in Explore since v1.96.0
  await expect(page.locator(".ng-belt-section")).toHaveCount(5);
  const challengeDone = await page.evaluate(
    () => (window as any).__neural.challengeTrackProgress("white").done,
  );
  expect(
    challengeDone,
    "White Challenges have been ticking off what they actually did",
  ).toBeGreaterThan(3);
  // (the DOM half of this check retired with the Tutorial section in v1.137.0 — the White
  // objectives tick in the ledger and render nowhere, so `challengeTrackProgress` above is
  // the whole claim. NON-KILL: nothing on screen now shows a newcomer what he ticked off.)
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
    };
  });
  expect(back.whiteChallenges, "Challenge progress persisted").toBe(
    snapshot.whiteChallenges,
  );
  expect(back.score, "score persisted").toBeCloseTo(snapshot.score, 6);
  // v1.104.0: `bjj-neural-coached` has no writer any more (the coach is deleted), so "were they
  // coached" is not a question a returning visitor can answer. What still matters is that the
  // explainer never appears — on ANY visit, first or fifth.
  await expect(page.locator("[data-coach]"), "the coach is gone for good").toHaveCount(
    0,
  );
  await j.keyframe("capstone-c-newcomer");
});
