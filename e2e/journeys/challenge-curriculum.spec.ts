import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);
const WHITE = CURRICULUM.belts[0];
const UNIT1 = WHITE.units[0];

function unit1DoneBlob() {
  const prep: Record<string, number> = {};
  for (const lesson of UNIT1.lessons) prep[lesson.deckKey] = 3;
  return { v: 1, prep, days: {}, settings: {} };
}

async function openChallenges(page: any) {
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  });
  await expect(page.locator(".ng-track-card").first()).toBeVisible();
}

test.describe("Challenge curriculum @curated", () => {
  test("Challenges is the default learning view and the three-view choice persists", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openChallenges(page);

    await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.locator("[data-view='history']").click();
    expect(
      await page.evaluate(() => localStorage.getItem("bjj_view_mode")),
    ).toBe("history");

    await j.boot("/", { preserveStorage: true });
    await page.evaluate(() => (window as any).__neural.toggleExplorer());
    await expect(page.locator("[data-view='history']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // the stat row lives at the top of Explore since v1.95.0 (weak spots = Explore's
    // call to action) — switch tabs to see it; the restored History tab has none
    await expect(page.locator(".ngStat[data-b='mastered']")).toHaveCount(0);
    await page.locator("[data-view='explore']").click();
    await expect(page.locator(".ngStat[data-b='mastered']")).toBeVisible();
  });

  test("all content tracks and lessons are open while proof gates checkpoints and capstones", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openChallenges(page);

    const tracks = page.locator(".ng-track-card");
    await expect(tracks).toHaveCount(CURRICULUM.belts.length);
    for (const track of CURRICULUM.belts) {
      const card = page.locator(`.ng-track-card[data-track="${track.id}"]`);
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
      await expect(
        page.locator(".ng-challenge-checkpoint").first(),
      ).toBeDisabled();
      await expect(
        page.locator(`[data-capstone="${track.id}"] button`),
      ).toBeDisabled();
    }
  });

  test("a lesson opens its deck session and moves the camera to its graph node", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await openChallenges(page);

    const lesson = UNIT1.lessons[0];
    await page
      .locator(`.ng-challenge-lesson[data-lesson="${lesson.deckKey}"]`)
      .click();
    await j.advance(1500);
    const state = await page.evaluate((deckKey) => {
      const app = (window as any).__neural;
      const node = app.nodes[app._lessonNodeIdx(deckKey)];
      return {
        cam: app.camTarget
          ? { x: app.camTarget.cx, y: app.camTarget.cy }
          : null,
        node: node ? { x: node.x, y: node.y } : null,
        deckOpen: !!app.deckOpen,
        session: (app._session?.keys || []).slice(),
      };
    }, lesson.deckKey);

    expect(state.node).toBeTruthy();
    expect(Math.abs(state.cam!.x - state.node!.x)).toBeLessThan(60);
    expect(Math.abs(state.cam!.y - state.node!.y)).toBeLessThan(60);
    expect(state.deckOpen).toBe(true);
    expect(state.session).toContain(lesson.deckKey);
  });

  test("finishing a lesson records Challenge evidence without locking other lessons", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const lesson = UNIT1.lessons[0];
    await j.drill(3, lesson.deckKey);
    await j.expectBeat("lesson_done");
    await openChallenges(page);

    await expect(
      page.locator("[data-challenge-id='white.lesson']"),
    ).toHaveAttribute("data-complete", "true");
    await expect(page.locator(".ng-challenge-lesson").nth(1)).toBeEnabled();
  });

  test("a checkpoint starts only after every live lesson has evidence", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: unit1DoneBlob() });
    await j.land("Mount Top");
    await openChallenges(page);

    const checkpoint = page.locator(
      `[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`,
    );
    await expect(checkpoint).toBeEnabled();
    await checkpoint.click();
    await j.advance(400);
    // the quiz pool is this unit's decks, fetched when the quiz starts (v1.80.4)
    await j.decksSettled();
    await j.expectBeat("checkpoint_start");
    expect(
      await page.evaluate(() => !!(window as any).__neural._checkpoint),
    ).toBe(true);
    await expect(page.locator("[data-mc-opt]").first()).toBeVisible();
  });

  test("switching to no-gi filters gi-only lessons without closing their content track", async ({
    page,
  }) => {
    const owner = CURRICULUM.belts
      .flatMap((track: any) =>
        track.units.flatMap((unit: any) =>
          unit.lessons.map((lesson: any) => ({ track, lesson })),
        ),
      )
      .find(
        ({ lesson }: any) =>
          lesson.frames?.length === 1 && lesson.frames[0] === "gi",
      );
    test.skip(!owner, "curriculum has no gi-only lesson");

    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await page.evaluate(() => (window as any).__neural.setGiMode("nogi"));
    await openChallenges(page);
    await page
      .locator(`.ng-track-card[data-track="${owner.track.id}"]`)
      .click();

    await expect(
      page.locator(
        `.ng-challenge-lesson[data-lesson="${owner.lesson.deckKey}"]`,
      ),
    ).toHaveCount(0);
    await expect(
      page.locator(`.ng-track-card[data-track="${owner.track.id}"]`),
    ).toBeEnabled();
  });

  test("Explore restores the full graph instead of carrying Challenge focus", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await openChallenges(page);
    expect(await page.evaluate(() => !!(window as any).__neural._pathDim)).toBe(
      true,
    );

    await page.locator("[data-view='explore']").click();
    expect(await page.evaluate(() => !!(window as any).__neural._pathDim)).toBe(
      false,
    );
    await expect(page.locator(".ng-track-card")).toHaveCount(0);
    await expect(page.locator(".ng-explorer-search")).toBeVisible();
  });

  test("v1 progress migrates to v2 with recall evidence grandfathered", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", {
      initialState: {
        v: 1,
        prep: { "Mount|Top": 3 },
        days: {},
        settings: {},
      },
    });
    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      return {
        rec: app.rec?.["Mount|Top"] ?? null,
        blobV: app._progressBlob().v,
      };
    });
    expect(state.rec).toBe(3);
    expect(state.blobV).toBe(2);
  });

  test("Challenges focuses the graph on curriculum nodes", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await openChallenges(page);
    const focus = await page.evaluate(() => {
      const app = (window as any).__neural;
      const set = app._curriculumIdxSet;
      if (!set || !set.size) return null;
      let outsider = -1;
      for (let index = 0; index < app.nodes.length; index += 1) {
        if (!set.has(index)) {
          outsider = index;
          break;
        }
      }
      return {
        size: set.size,
        hasOutsider: outsider >= 0,
        focusActive: !!app._pathDim,
      };
    });

    expect(focus).toBeTruthy();
    expect(focus!.size).toBeGreaterThan(50);
    expect(focus!.hasOutsider).toBe(true);
    expect(focus!.focusActive).toBe(true);
  });

  test("missing curriculum keeps action Challenges usable and reports the unavailable practice", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { noCurriculum: true });
    await j.land("Mount Top");
    await openChallenges(page);

    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      return {
        curriculum: app.curriculum ?? null,
        mode: app._viewMode,
        nodes: app.nodes.length,
      };
    });
    expect(state.curriculum).toBeNull();
    expect(state.mode).toBe("challenges");
    expect(state.nodes).toBeGreaterThan(1000);
    await expect(page.locator(".ng-challenge-curriculum").first()).toContainText(
      "Curriculum is unavailable right now",
    );
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
  });
});
