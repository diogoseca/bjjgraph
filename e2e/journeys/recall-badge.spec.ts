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
 *  · (until v1.270.0; U163 c made Recall Mode a switch anyone turns on, and the mint no longer flips it — the tests below
 *    say what each claimed before) setting `recallInPlay` — LOCKED row in Settings → Flashcards until the WORN belt is black
 *    (v1.211.0, owner ruling 2026-09-30: the belt is earned in the Challenges — every unit of a
 *    belt proven promotes you — and a Game Knowledge band unlocks NOTHING); the badge
 *    `recall-in-play` mints on the `belt_reached` beat (`_noteBlackBelt`, fired at the promotion
 *    and post-grade while black-and-unminted) and the AUTO-FLIP lives inside the mint loop ONLY —
 *    turning it off later must stick (settings LWW would otherwise re-enable forever).
 *  · with the toggle on, a stage-2+ landing card renders `_recallBlock` ([data-land-recall])
 *    instead of MC; stage-0/1 cards stay MC (recognition first). The warm gate is format-aware.
 *  · a self-graded recall NEVER refunds the clock or ticks the combo — "Show answer → Got it"
 *    is unverifiable, and +2.5s per landing would be a free-time button. Odds/mastery credit
 *    still flows through gradeRecall.
 *  · the Black corridor section advertises the reward ([data-recall-reward]).
 * v1.282.0 (rulings R2, SET1-GO): the Recall Mode switch left Settings; the answer mode decides a roll's format (Auto asks
 * a card right twice front and back: answer-mode.spec.ts, landcard-modes.spec.ts 5c). What stays here: a score decides
 * nothing, the patch mints at black and writes nothing, a self-grade earns no refund and no combo, the Black row.
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

/** answer ONE card through the real recall choke — every grade publishes, and the publish syncs the belt */
const answerOne = (page: any, i = 0) =>
  page.evaluate((n: number) => {
    const a = (window as any).__neural;
    const key = Object.keys(a.flashcards.decks)[0];
    const card = a._cardsOf(a.flashcards.decks[key])[n];
    a.gradeRecall(key, card, true);
  }, i);

// Until v1.270.0: "locked below black; a black SCORE unlocks nothing; proving every unit to black mints the badge and
// auto-flips the toggle ON" — the row was a locked teaser below black and the mint switched the toggle on. U163 c (owner,
// 13 Nov, "everything opens"): Recall Mode is a switch anyone turns on and no belt switches it on, so the first and the
// last claims are reversed; the middle one (a score decides nothing) stands.
test("U163 c: Recall Mode is a switch for everyone; a black SCORE decides nothing; reaching black mints the patch and leaves the switch alone", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  // the one-time grandfather (v1.211.0) reads the score ONCE: let it run on this fresh profile
  // before the score is staged, or the staged band would legitimately become the belt
  await expect.poll(() => page.evaluate(() => { const a = (window as any).__neural; return !!(a.curriculum && a.belts && a.belts.gf); })).toBe(true);

  // fresh profile: no Recall Mode row at all since v1.282.0 (the answer mode's Auto does its job, R2); a switch for everyone
  // from v1.270.0, the LOCKED teaser before ("Unlocks at black belt")
  await page.evaluate(() => (window as any).__neural.openSettings("flashcards"));
  await page.waitForTimeout(300);
  await expect(page.locator("[data-answer-mode]"), "precondition: the Flashcards tab is drawn").toBeVisible();
  await expect(page.locator("[data-recall-mode]"), "v1.282.0: no Recall Mode row").toHaveCount(0);
  await expect(page.locator("[data-recall-locked]")).toHaveCount(0);
  await page.evaluate(() => (window as any).__neural.closeModal());

  // A BLACK GAME KNOWLEDGE SCORE ON A WHITE BELT (v1.211.0): the score is a percentage and
  // decides no belt, so nothing unlocks — not the badge, not the row, not recall in play.
  const band = await stageEverything(page, 4);
  expect(band, "non-trivial: staging everything to 4 reaches the black band").toBe("black");
  await answerOne(page, 0);
  await page.waitForTimeout(300);
  const below = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { worn: a.wornBelt().id, badge: !!(a.badges && a.badges["recall-in-play"]), stored: a.settings.recallInPlay ?? null };
  });
  expect(below, "a black score on a white belt: no belt, no patch, nothing written").toEqual({ worn: "white", badge: false, stored: null });

  // PROVE EVERY UNIT OF EVERY BELT (lessons + checkpoints), then answer ONE card through the real
  // choke: the grade publishes, the publish syncs the belt to black, and the badge mints with it
  await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const belt of a.curriculum.belts)
      for (const u of belt.units) {
        for (const l of u.lessons) a.prep[l.deckKey] = 3;
        a.units[belt.id + "/" + u.id] = { checkpoint: true, t: Date.now() };
      }
  });
  await answerOne(page, 1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__neural.wornBelt().id), "every unit proven: black").toBe("black");

  const st = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { badge: !!(a.badges && a.badges["recall-in-play"]), on: a.get("recallInPlay", false) };
  });
  expect(st.badge, "the badge minted").toBe(true);
  expect(st.on, "U163 c: the mint leaves the switch where it was (until v1.270.0 it flipped it ON)").toBe(false);
  // at black too, the patch is a patch: Settings has no Recall Mode row to turn on (v1.282.0); until then the player turned
  // the switch on here
  await page.evaluate(() => (window as any).__neural.openSettings("flashcards"));
  await page.waitForTimeout(300);
  await expect(page.locator("[data-recall-mode]"), "no Recall Mode row at black either").toHaveCount(0);
  await page.evaluate(() => (window as any).__neural.closeModal());

  // flipping it OFF sticks across more answers at black
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.set("recallInPlay", false);
    const key = Object.keys(a.flashcards.decks)[0];
    const card = a._cardsOf(a.flashcards.decks[key])[2];
    a.gradeRecall(key, card, true); // another answer at black — must NOT re-flip
  });
  expect(
    await page.evaluate(() => (window as any).__neural.get("recallInPlay", false)),
    "OFF sticks: no belt switches it on",
  ).toBe(false);
});

test("with the badge on, a proven card lands as pure recall — and stays MC below the gate", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");
  await j.openQuestion() // U47 d: this journey deliberately answers/times the question.

  const r = await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const cards = a._cardsOf(a.flashcards.decks[key]);
    // make card[0] proven, everything else unseen (the badge's toggle was turned on here too, `recallInPlay`, until v1.282.0:
    // the switch decides nothing since, and Auto asks a proven card front and back by itself)
    a.stage[key] = { [a.qhash(cards[0].q)]: 3 };
    // due, so due-first selection picks the PROVEN card — the exact composition W1+W2 create
    const today = a._epochDay();
    a.srs[key] = { [a.qhash(cards[0].q)]: [today - 1, 3, today - 4] };
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
    return { q: cards[0].q };
  });
  await page.waitForTimeout(300);

  await j.openQuestion();
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

// Until v1.270.0: "the Black corridor section advertises the reward, locked and earned" — on a white belt the row sat in
// the LOCKED Black section, which stayed inert. U163 c: the Black section is an ordinary one (folded until opened), and
// the row is the patch's. From v1.270.0 to v1.282 it also said where the Recall Mode switch was ("open to everyone: turn it
// on in Settings → Flashcards"); since v1.282.0 that switch is gone, so the row says only how the patch is earned.
test("U163 c: the Black section shows the patch, unearned and earned, and points at no Settings switch", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await page.evaluate(() => (window as any).__neural.openPane("challenges"));
  await page.waitForTimeout(500);

  await page.locator('[data-belt-toggle="black"]').scrollIntoViewIfNeeded();
  await j.clickByMouse('[data-belt-toggle="black"]', "unfold Black");
  const unearned = page.locator('[data-recall-reward="unearned"]');
  await expect(unearned).toHaveCount(1);
  // named "Black Belt" since v1.282.0 (D6, the reader of #423): "Recall Mode" named the switch that left Settings
  await expect(unearned).toContainText("Black Belt");
  await expect(unearned, "and no longer names that switch").not.toContainText("Recall Mode");
  await expect(unearned, "it says how the patch is earned").toContainText("Reach black belt to earn it.");
  await expect(unearned, "and points at no Settings switch (v1.282.0)").not.toContainText("Settings");
  await expect(unearned, "shown in the open Black section").toBeVisible();

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
