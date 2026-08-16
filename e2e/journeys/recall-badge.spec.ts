import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE RECALL FORMAT IS A BLACK-BELT BADGE (v1.105.1, owner): "after the player gets the MC
 * right, the second time we show the card… Q and A, hide the answer like typical flashcards" —
 * but in GAMEPLAY "only for a user who is now black belt in our app… we flip it off and he can
 * flip it back on — it's a badge he wins, a toggle disabled until he becomes black belt", and
 * "we can see it in the challenges".
 *
 * Mechanics under test:
 *  · setting `recallInPlay` — LOCKED row in Settings → Flashcards until the knowledge band is
 *    black; the badge `recall-in-play` mints on the `belt_reached` beat (fired post-grade from
 *    noteCardAnswered while black-and-unminted) and the AUTO-FLIP lives inside the mint loop
 *    ONLY — turning it off later must stick (settings LWW would otherwise re-enable forever).
 *  · with the toggle on, a stage-2+ landing card renders `_recallBlock` ([data-land-recall])
 *    instead of MC; stage-0/1 cards stay MC (recognition first). The warm gate is format-aware.
 *  · a self-graded recall NEVER refunds the clock or ticks the combo — "Show answer → Got it"
 *    is unverifiable, and +2.5s per landing would be a free-time button. Odds/mastery credit
 *    still flows through gradeRecall.
 *  · the Black corridor section advertises the reward ([data-recall-reward]).
 */

/** stage every card of every RESIDENT deck to `st`, then recompute the score memo */
const stageEverything = (page: any, st: number) =>
  page.evaluate((stage: number) => {
    const a = (window as any).__neural;
    const decks = (a.flashcards && a.flashcards.decks) || {};
    for (const k of Object.keys(decks)) {
      const cards = a._cardsOf(decks[k]);
      if (!cards) continue;
      a.stage[k] = a.stage[k] || {};
      for (const c of cards) a.stage[k][a.qhash(c.q)] = stage;
    }
    a._bumpStageVer();
    return a.gameScore().belt;
  }, st);

test("locked before black; the badge mints at the crossing and auto-flips the toggle ON @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();

  // fresh profile: the settings row is the LOCKED teaser
  await page.evaluate(() => (window as any).__neural.openSettings("flashcards"));
  await page.waitForTimeout(300);
  await expect(page.locator("[data-recall-locked]")).toBeVisible();
  await expect(page.locator("[data-recall-locked]")).toContainText("Unlocks at black belt");
  await page.evaluate(() => (window as any).__neural.closeModal());

  // cross to black, then answer ONE card through a real choke — the beat fires post-grade
  const belt = await stageEverything(page, 4);
  expect(belt, "staging everything to 4 reaches black").toBe("black");
  await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = Object.keys(a.flashcards.decks)[0];
    const card = a._cardsOf(a.flashcards.decks[key])[0];
    a.gradeRecall(key, card, true);
  });
  await page.waitForTimeout(300);

  const st = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { badge: !!(a.badges && a.badges["recall-in-play"]), on: a.get("recallInPlay", false) };
  });
  expect(st.badge, "the badge minted").toBe(true);
  expect(st.on, "and the toggle auto-flipped ON").toBe(true);

  // the settings row is now interactive, and flipping it OFF sticks across more answers
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.set("recallInPlay", false);
    const key = Object.keys(a.flashcards.decks)[0];
    const card = a._cardsOf(a.flashcards.decks[key])[1];
    a.gradeRecall(key, card, true); // another answer at black — must NOT re-flip
  });
  expect(
    await page.evaluate(() => (window as any).__neural.get("recallInPlay", false)),
    "OFF sticks — the flip lives on the MINT, not on the belt",
  ).toBe(false);
});

test("with the badge on, a proven card lands as pure recall — and stays MC below the gate", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");

  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const cards = a._cardsOf(a.flashcards.decks[key]);
    // make card[0] proven, everything else unseen, then turn the badge's toggle on directly
    a.stage[key] = { [a.qhash(cards[0].q)]: 3 };
    // due, so due-first selection picks the PROVEN card — the exact composition W1+W2 create
    const today = a._epochDay();
    a.srs[key] = { [a.qhash(cards[0].q)]: [today - 1, 3, today - 4] };
    a.settings.recallInPlay = true;
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
    return { q: cards[0].q };
  });
  await page.waitForTimeout(300);

  // the landing block is the recall surface: reveal + self-grade handles, no MC options
  await expect(page.locator("[data-land-recall]")).toBeVisible();
  await expect(page.locator("[data-land-reveal]")).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll("[data-land-mc-opt]").length)).toBe(0);

  // grading through it: no clock refund, no combo — odds credit only
  const before = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { rem: a._decision ? a._decision.remaining : null, combo: a._combo || 0 };
  });
  await j.clickByMouse("[data-land-reveal]", "Show answer");
  await page.waitForTimeout(200);
  await j.clickByMouse("[data-land-got]", "Got it");
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { rem: a._decision ? a._decision.remaining : null, combo: a._combo || 0, answered: a._landQ && a._landQ.answered };
  });
  expect(after.answered, "the question scored").toBe(true);
  expect(after.combo, "no combo tick for a self-grade").toBe(before.combo);
  if (before.rem != null && after.rem != null)
    expect(after.rem, "no +2.5s refund for a self-grade").toBeLessThanOrEqual(before.rem);

  // and an UNPROVEN card still lands as MC with the toggle on
  const mc = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    a.stage[key] = {}; a.srs[key] = {};
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
    return true;
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => !!document.querySelector("[data-land-recall]"))).toBe(false);
});

test("the Black corridor section advertises the reward, locked and earned", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await page.evaluate(() => (window as any).__neural.openPane("challenges"));
  await page.waitForTimeout(500);

  const locked = page.locator('[data-recall-reward="locked"]');
  await expect(locked).toHaveCount(1);
  await expect(locked).toContainText("Recall Mode");

  // mint the badge, re-render: the row reads earned
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.badges = a.badges || {};
    a.badges["recall-in-play"] = { t: Date.now() };
    a.openPane("challenges");
  });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-recall-reward="earned"]')).toHaveCount(1);
});
