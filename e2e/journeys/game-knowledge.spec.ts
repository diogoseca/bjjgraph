import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

async function openChallenges(page: any) {
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  });
  await expect(page.locator(".ng-learning-nav")).toBeVisible();
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
    // Make this ONE deck the entire curriculum. The compact `scoreWeights` block and the memo it
    // fills must go with it (v1.145.13): `scoreWeights()` prefers the block and caches on first
    // read, so overwriting only the flat `weights` would leave the real 2,810-deck table in
    // charge and this deck would be a rounding error instead of the whole score.
    delete app.curriculum.scoreWeights;
    app._scoreW = null;
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

    // the score belt visual is retired (v1.98.1) — the score's one exposure is the
    // Explore tab subtitle, and it reads the SAME gameScore()
    await expect(page.locator(".ng-knowledge-meter")).toHaveCount(0);
    await expect(page.locator('[data-tab-sub="explore"]')).toHaveText(
      "Mastered " + Math.round(game.score * 100) + "%",
    );
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
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
    // no meter visual anymore (v1.98.1) — the subtitle reads the lowered score
    await expect(page.locator('[data-tab-sub="explore"]')).toHaveText(
      "Mastered " + Math.round(lower.score * 100) + "%",
    );
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

  test("the shipped curriculum weights the WHOLE corpus as one distribution", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    // Driven through the app's own expander, not by re-reading the payload: since v1.145.13 the
    // wire is compact and there is no flat table to read. This asserted `every key ends |Attacker`
    // until the owner ruled that the score must span the whole corpus -- 1,326 Defender and 272
    // position decks (9,071 cards, 41.4%) used to weigh exactly nothing.
    const w = await page.evaluate(() => (window as any).__neural.scoreWeights());
    expect(w).toBeTruthy();
    const keys = Object.keys(w);
    expect(keys.length).toBeGreaterThan(2500);
    const by = (suffix: string) => keys.filter((k) => k.endsWith(suffix)).length;
    expect(by("|Attacker"), "attacker decks are weighted").toBeGreaterThan(1000);
    expect(by("|Defender"), "SO ARE DEFENDER DECKS").toBe(by("|Attacker"));
    expect(by("|Top") + by("|Bottom"), "AND POSITION DECKS").toBe(272);
    const sum = keys.reduce((total, key) => total + w[key], 0);
    expect(sum, "still one distribution").toBeCloseTo(1, 4);
    // The owner's first constraint, asserted where a user would feel it: the heaviest deck in the
    // whole table is a position, so studying where you ARE is the single best-scoring thing to do.
    const heaviest = keys.reduce((a, b) => (w[a] >= w[b] ? a : b));
    expect(heaviest.endsWith("|Top") || heaviest.endsWith("|Bottom")).toBe(true);
  });
});
