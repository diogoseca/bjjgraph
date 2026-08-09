import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

async function openChallenges(page: any) {
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  });
  await expect(page.locator(".ng-knowledge-header")).toBeVisible();
}

// This file's subject is the SCORE, not deck residency, so it takes full residency explicitly:
// decks arrive on demand since v1.80.4, and picking "the first deck with >= 3 cards" out of a
// manifest of stubs finds nothing.
const soloDeck = async (page: any) => {
  await page.evaluate(() => {
    const a = (window as any).__neural;
    return a.hydrateDecks(Object.keys((a.flashcards || {}).decks || {}));
  });
  return page.evaluate(() => {
    const app = (window as any).__neural;
    const key = Object.keys(app.flashcards.decks).find(
      (candidate: string) =>
        ((app.flashcards.decks[candidate] || {}).cards || []).length >= 3,
    )!;
    app.curriculum.weights = { [key]: 1 };
    app.stage = {};
    app._stageVer = (app._stageVer || 0) + 1;
    const cold = app.gameScore();
    const cards = app.flashcards.decks[key].cards;
    for (const card of cards) app._bumpStage(key, card.q, 2, 2);
    const recognised = app.gameScore();
    for (const card of cards) app._bumpStage(key, card.q, 1);
    const recalled = app.gameScore();
    return { key, cold, recognised, recalled };
  });
};

const setMastery = (page: any, key: string, stage: number) =>
  page.evaluate(
    ([deckKey, nextStage]) => {
      const app = (window as any).__neural;
      app.stage = {};
      app._stageVer = (app._stageVer || 0) + 1;
      for (const card of app.flashcards.decks[deckKey as string].cards) {
        app._bumpStage(
          deckKey as string,
          card.q,
          nextStage as number,
          nextStage as number,
        );
      }
      return app.gameScore();
    },
    [key, stage] as const,
  );

test.describe("Game Knowledge @curated", () => {
  test("the score is frequency-weighted mastery from zero to full recall", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const scores = await soloDeck(page);

    expect(scores.cold.score).toBe(0);
    expect(scores.recalled.score).toBeCloseTo(1, 3);
  });

  test("recognition reaches two thirds while recall is required for the highest bands", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const scores = await soloDeck(page);

    expect(scores.recognised.score).toBeCloseTo(2 / 3, 3);
    expect(scores.recognised.belt).toBe("purple");
    expect(scores.recognised.next).toBe("brown");
    expect(scores.recalled.belt).toBe("black");
  });

  test("knowledge bands remain thresholds on one score", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    const bands = await page.evaluate(
      () => (window as any).__neural.BELT_SCORE,
    );
    expect(bands).toEqual([
      ["white", 0.2],
      ["blue", 0.4],
      ["purple", 0.6],
      ["brown", 0.7],
      ["black", 0.8],
    ]);
  });

  test("Game Knowledge never gates content tracks or lessons", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await page.evaluate(() => {
      const app = (window as any).__neural;
      app.stage = {};
      app.rec = {};
      app._stageVer = (app._stageVer || 0) + 1;
    });
    await openChallenges(page);

    expect(
      await page.evaluate(() => (window as any).__neural.gameScore().score),
    ).toBe(0);
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
    await page.locator("[data-track='black']").click();
    await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
  });

  test("the persistent header exposes the score as an accessible meter", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const { key } = await soloDeck(page);
    const game = await setMastery(page, key, 2);
    await openChallenges(page);

    await expect(page.locator(".ng-knowledge-header")).toContainText(
      "YOUR GAME KNOWLEDGE",
    );
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-valuenow",
      (game.score * 100).toFixed(1),
    );
    await expect(page.locator(".ng-knowledge-header")).toContainText("Purple");
  });

  test("forgetting lowers the meter without taking content away", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const { key } = await soloDeck(page);
    const peak = await setMastery(page, key, 3);
    const lower = await page.evaluate((deckKey) => {
      const app = (window as any).__neural;
      for (const card of app.flashcards.decks[deckKey].cards) {
        app._bumpStage(deckKey, card.q, -1);
      }
      return app.gameScore();
    }, key);
    expect(lower.score).toBeLessThan(peak.score);

    await openChallenges(page);
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-valuenow",
      (lower.score * 100).toFixed(1),
    );
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
  });

  test("lesson crowns visualize the same deck mastery used by Game Knowledge", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await openChallenges(page);
    const lesson = page.locator(".ng-challenge-lesson").first();
    const deckKey = await lesson.getAttribute("data-lesson");
    expect(deckKey).toBeTruthy();
    await expect(lesson.locator("[data-crown]")).toHaveAttribute(
      "data-crown",
      "0",
    );

    // grade every card of that lesson's deck — which means asking for its cards first
    await page.evaluate(async (key) => {
      const app = (window as any).__neural;
      await app.hydrateDeck(key);
      for (const card of app._cardsOf(app.flashcards.decks[key]) || []) {
        app._bumpStage(key, card.q, 3, 3);
      }
      app.renderExplorer();
    }, deckKey);
    await expect(
      page
        .locator(`.ng-challenge-lesson[data-lesson="${deckKey}"]`)
        .locator("[data-crown]"),
    ).toHaveAttribute("data-crown", "4");
  });

  test("the shipped curriculum weights every attacker deck as one distribution", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    const weights = await page.evaluate(
      () => ((window as any).__neural.curriculum || {}).weights || null,
    );
    expect(weights).toBeTruthy();
    const keys = Object.keys(weights);
    expect(keys.length).toBeGreaterThan(1000);
    expect(keys.every((key) => key.endsWith("|Attacker"))).toBe(true);
    const sum = keys.reduce((total, key) => total + weights[key], 0);
    expect(sum).toBeCloseTo(1, 4);
  });
});
