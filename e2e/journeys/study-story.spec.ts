import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * CHALLENGE STUDY STORY (one continuous gameplay journey).
 *
 * A brand-new player walks through White Challenges to their first completed unit:
 * Challenges → open unit 1's first lesson → answer a real card WRONG then RIGHT (MC) →
 * finish the lesson (lesson_done) → graduate that card to recall and prove recall credit →
 * complete the remaining lessons → pass the checkpoint quiz → unit_done → reload →
 * everything persisted. One boot + one preserveStorage reload, kept well under the 240s
 * ceiling by driving bulk steps through the same rails the UI uses.
 */

const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);
const WHITE = CURRICULUM.belts[0];
const UNIT1 = WHITE.units[0];

test("White Challenge study story: lesson → MC → recall → checkpoint → evidence persists", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // v1.68.0: MC is the in-roll format; the sidebar reads back as recall by default. This story
  // is about the MC → recall graduation ladder inside a lesson, so it opts into MC.
  await page.evaluate(() => (window as any).__neural.set("mcMode", "auto"));

  // ── the front door: Challenges is the default learning view ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer());
  await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const firstLesson = UNIT1.lessons[0];

  // ── open lesson 1: camera flies, the unit becomes the study session ──
  await page.evaluate((dk) => {
    const a = (window as any).__neural;
    const e = a._lessonIndex[dk];
    a.openLessonStudy({ deckKey: dk, nodeId: e.nodeId }, { name: e.unit, lessons: [{ deckKey: dk, nodeId: e.nodeId }] }, { id: e.belt }); // v1.105.2: the row reads inline now; study opens via the seam
  }, firstLesson.deckKey);
  await j.advance(1000);
  expect(await page.evaluate(() => !!(window as any).__neural.deckOpen)).toBe(
    true,
  );

  // ── first real card: wrong first (learn), then right (earn) ──
  const qh = await page.evaluate(() => {
    const a = (window as any).__neural;
    for (const c of a.deck || [])
      if (a.mcClip(c.a)) {
        a.presentCard(a.qhash(c.q));
        return a.qhash(c.q);
      }
    return null;
  });
  expect(qh).toBeTruthy();
  let mc = await page.evaluate(() => (window as any).__neural._mc);
  await page
    .locator("[data-mc-opt]")
    .nth((mc.correct + 1) % 4)
    .click(); // wrong: no credit
  await j.expectBeat("mc_wrong");
  await page.evaluate((q) => (window as any).__neural.presentCard(q), qh);
  mc = await page.evaluate(() => (window as any).__neural._mc);
  await page.locator("[data-mc-opt]").nth(mc.correct).click(); // right: credit + stage
  await j.expectBeat("mc_correct");
  await j.expectBeat("bonus_pumped");

  // ── finish lesson 1 through the drill rail → lesson_done ──
  await j.drill(3, firstLesson.deckKey);
  await j.expectBeat("lesson_done");

  // ── graduate that card (stage 2) and prove recall is what mints mastery credit ──
  await page.evaluate((q) => {
    const a = (window as any).__neural;
    a.presentCard(q);
    if (a._mc) {
      // one more MC correct reaches the recall gate
      const btns = a.drillListRef.current.querySelectorAll("[data-mc-opt]");
      btns[a._mc.correct].click();
    }
  }, qh);
  await j.advance(800);
  const rec0 = await page.evaluate(
    (dk) => (window as any).__neural.rec[dk] || 0,
    firstLesson.deckKey,
  );
  await page.evaluate((q) => {
    const a = (window as any).__neural;
    a.presentCard(q);
    a.revealed = true;
    a.recallGrade(true);
  }, qh);
  const rec1 = await page.evaluate(
    (dk) => (window as any).__neural.rec[dk] || 0,
    firstLesson.deckKey,
  );
  expect(rec1).toBe(rec0 + 1);

  // ── complete the remaining live lessons via the same drill choke the UI uses ──
  const liveLessons = UNIT1.lessons; // curriculum default frame is live for white belt
  for (const l of liveLessons.slice(1)) await j.drill(3, l.deckKey);
  const doneCount = (await j.beats()).filter(
    (b: any) => b.beat === "lesson_done",
  ).length;
  expect(doneCount).toBe(liveLessons.length);

  // ── the checkpoint quiz: first-try everything via the truth rail ──
  await j.rig("checkpoint-pick", [0.1, 0.3, 0.5, 0.7, 0.9, 0.2]);
  // v1.76.0: the pane is still open in study takeover here — return to the Challenges tab
  // (the ‹ Back path) instead of toggling the pane shut
  await page.evaluate(() => (window as any).__neural.openLearningView("challenges"));
  await page
    .locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`)
    .first()
    .click();
  await j.advance(400);
  await j.decksSettled();   // the quiz pool is this unit's decks, fetched when the quiz starts
  for (let i = 0; i < UNIT1.checkpoint.cards; i++) {
    // each question's MC block mounts once its distractor pool is resident (v1.80.4)
    await page
      .waitForFunction(
        () => {
          const a = (window as any).__neural;
          return !!a._mc || !a._checkpoint;
        },
        null,
        { timeout: 20_000 },
      )
      .catch(() => {});
    const t = await page.evaluate(() => (window as any).__neural._mc);
    if (!t) break;
    await page.locator("[data-mc-opt]").nth(t.correct).click();
    await j.advance(500);
  }
  await j.expectBeat("checkpoint_passed");
  await j.expectBeat("unit_done");

  // ── Challenges shows the proof; later units were open throughout ──
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  });
  await expect(
    page.locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`),
  ).toHaveText("Checkpoint cleared");
  await expect(page.locator(".ng-challenge-group").nth(1)).toBeVisible();
  await page.locator(".ng-challenge-group").nth(1).locator("summary").click();
  await expect(
    page
      .locator(".ng-challenge-group")
      .nth(1)
      .locator(".ng-challenge-lesson")
      .first(),
  ).toBeEnabled();
  await j.keyframe("capstone-a-unit-complete");

  // ── reload: the story survives ──
  await j.boot("/", { preserveStorage: true });
  await j.land("Mount Top");
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  });
  await expect(
    page.locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`),
  ).toHaveText("Checkpoint cleared");
  const persisted = await page.evaluate((dk) => {
    const a = (window as any).__neural;
    return { rec: a.rec[dk] || 0, blobV: a._progressBlob().v };
  }, firstLesson.deckKey);
  expect(persisted.rec).toBeGreaterThanOrEqual(1);
  expect(persisted.blobV).toBe(2);
});
