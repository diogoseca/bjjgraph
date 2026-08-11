import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

const whiteProgress = (page: any) =>
  page.evaluate(() => (window as any).__neural.challengeTrackProgress("white"));

test.describe("White Challenges @curated", () => {
  test("the first-roll coach feeds the permanent White Challenge cue", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await j.land("Mount Top", { keepCoach: true });

    await expect(page.locator("[data-coach]")).toBeVisible();
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    expect((await whiteProgress(page)).done).toBeGreaterThanOrEqual(1);
    await j.expectBeat("challenge_completed");

    await page.evaluate(() => (window as any).__neural.advanceCoach());
    await page.evaluate(() => (window as any).__neural.advanceCoach());
    await page.evaluate(() => (window as any).__neural.advanceCoach());
    await j.expectBeat("coach_done");

    const progress = await whiteProgress(page);
    expect(progress.done).toBe(3);
    expect(progress.total).toBe(20);
    await expect(page.locator("[data-challenge-cue]")).toBeVisible();
    await expect(page.locator("[data-challenge-cue]")).toContainText(
      "WHITE CHALLENGES",
    );
    await expect(page.locator("[data-tut-count]")).toHaveText("3/20");
  });

  test("doing an objective records durable Challenge progress", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await j.land("Mount Top");
    expect(
      await page.evaluate(
        () => (window as any).__neural.challengeProgress("white.answer").done,
      ),
    ).toBe(false);

    const question = await page.evaluate(() => {
      const mc = (window as any).__neural._mc;
      return mc ? { correct: mc.correct } : null;
    });
    expect(question).toBeTruthy();
    await page.keyboard.press("abcd"[question!.correct]);
    expect(
      await page.evaluate(
        () => (window as any).__neural.challengeProgress("white.answer").done,
      ),
    ).toBe(true);

    const before = await whiteProgress(page);
    await j.boot("/", { preserveStorage: true, keepTutorial: true });
    const after = await whiteProgress(page);
    expect(after.done).toBe(before.done);
    expect(
      await page.evaluate(
        () => (window as any).__neural.challengeProgress("white.answer").done,
      ),
    ).toBe(true);
  });

  test("the cue can be hidden persistently and restored by pinning a track", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await j.land("Mount Top");
    await expect(page.locator("[data-challenge-cue]")).toBeVisible();

    await page.locator("[data-tut-hide]").click();
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        (window as any).__neural.get("challengeCueVisible", true),
      ),
    ).toBe(false);

    await j.boot("/", { preserveStorage: true, keepTutorial: true });
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await page.locator(".ng-logo").click();
    await page.locator("[data-track='white']").click();
    await page.locator(".ng-pin-track").click();
    await page.locator(".ng-explorer-close").click();
    await expect(page.locator("[data-challenge-cue]")).toBeVisible();
  });

  test("White Foundations exposes twenty evidence objectives without a Tutorial row", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await page.locator(".ng-logo").click();

    await expect(page.locator("[data-track='white']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // the twenty objectives ARE the Getting started section (v1.96.0) — they ride above
    // the belt corridor, and no legacy Tutorial row exists anywhere
    await expect(page.locator(".ng-challenge-row")).toHaveCount(20);
    await expect(
      page.locator("[data-tutorial] .ng-challenge-row"),
    ).toHaveCount(20);
    await expect(page.locator("[data-tut-row]")).toHaveCount(0);
    await expect(page.locator(".ng-challenge-detail h2")).toHaveText(
      "White Foundations",
    );
  });

  test("the Journey DSL can pre-complete foundational objectives without changing Game Knowledge", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      return {
        progress: app.challengeTrackProgress("white"),
        score: app.gameScore().score,
      };
    });
    expect(state.progress).toMatchObject({
      done: 20,
      total: 20,
      complete: true,
    });
    expect(state.score).toBe(0);
  });
});
