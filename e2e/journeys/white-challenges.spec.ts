import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

const whiteProgress = (page: any) =>
  page.evaluate(() => (window as any).__neural.challengeTrackProgress("white"));

test.describe("White Challenges @curated", () => {
  // v1.104.0: the 3-panel first-roll coach is DELETED (owner). Its three White objectives were
  // not deleted with it — they were re-keyed to the actions they are NAMED for, so White stays at
  // 20 and the evidence got stricter: "Preview a move" now needs a move sheet actually opened,
  // where the coach ticked it for pressing Next on a tooltip.
  test("the first roll feeds the permanent White Challenge cue — on real actions now", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await j.land("Mount Top");

    // the coach card is gone from the DOM entirely
    await expect(page.locator("[data-coach]")).toHaveCount(0);

    // landing alone proves two of them: a hand was dealt (options_dealt) and the state asked
    // its question (land_q_shown).
    expect(
      await page.evaluate(() => (window as any).__neural.challengeProgress("white.coach1").done),
      "Read your hand — a hand of options is on the table",
    ).toBe(true);
    expect(
      await page.evaluate(() => (window as any).__neural.challengeProgress("white.coach3").done),
      "Read a landing question — the landing asked one",
    ).toBe(true);
    await j.expectBeat("challenge_completed");

    // ...and the third is NOT free: it needs a move sheet actually opened.
    expect(
      await page.evaluate(() => (window as any).__neural.challengeProgress("white.coach2").done),
      "Preview a move must not tick until a sheet is opened",
    ).toBe(false);

    // open a real move sheet: the option cards are the hand, and the sheet is what a card opens
    await page.locator("[data-tech]").first().click();
    await page.waitForTimeout(250);
    await j.expectBeat("sheet_opened");
    expect(
      await page.evaluate(() => (window as any).__neural.challengeProgress("white.coach2").done),
      "opening the sheet is the evidence",
    ).toBe(true);

    const progress = await whiteProgress(page);
    expect(progress.done).toBeGreaterThanOrEqual(3);
    expect(progress.total).toBe(20);
    await expect(page.locator("[data-challenge-cue]")).toBeVisible();
    await expect(page.locator("[data-challenge-cue]")).toContainText("WHITE CHALLENGES");
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

  test("the cue can be hidden persistently and restored from Settings", async ({
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
    // pinning is gone (v1.99.2) — Settings → Rolling → Challenge cue is the restore path
    await page.locator(".ngAcctChip").click();
    await page.locator("[data-menu-settings]").click();
    await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
    await page.locator("[data-challenge-cue-toggle]").click();
    await expect(page.locator("[data-challenge-cue-toggle]")).toHaveText("Hide");
    await page.evaluate(() => (window as any).__neural.closeModal());
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
    // the twenty objectives ARE the Tutorial section (renamed v1.98.1) — they ride above
    // the belt corridor, and no legacy Tutorial row exists anywhere
    await expect(page.locator(".ng-challenge-row")).toHaveCount(20);
    await expect(
      page.locator("[data-tutorial] .ng-challenge-row"),
    ).toHaveCount(20);
    await expect(page.locator("[data-tut-row]")).toHaveCount(0);
    // the detail head died in v1.98.1 (the double title) — White renders no detail at all;
    // its section head reads "Tutorial" in the belt headers' lettering
    await expect(page.locator(".ng-challenge-detail h2")).toHaveCount(0);
    await expect(page.locator(".ng-tutorial-head b")).toHaveText("Tutorial");
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
