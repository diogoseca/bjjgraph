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
    // THE STAT BAND MOVED TO THE PANE FOOT (v1.104.5, owner: "I would prefer to be closer to the
    // bottom"). It was Explore-only at the top of that tab's body from v1.95.0; it is now its own
    // element above the save nudge, so it is visible on EVERY tab — including the restored
    // History one — and it must not vanish for a signed-in user the way the nudge does.
    await expect(page.locator(".ngStat[data-b='mastered']")).toBeVisible();
    expect(
      await page.evaluate(() => !!document.querySelector(".ng-pane-stats [data-explore-stats]")),
      "it lives in the foot band, not in a tab body",
    ).toBe(true);
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

  test("a lesson row reads INLINE and locates its node — it never takes the pane over", async ({
    page,
  }) => {
    // v1.105.2 (owner): "we don't want content that opens in the sidebar and takes over the
    // whole sidebar, nor do we want the sidebar to close" — the row click is now the ▸'s inline
    // Q&A plus a PANE-AWARE camera flight. This test used to assert the takeover (deckOpen +
    // _session) and read camTarget±60 — the exact assertion style share-camera canon forbids.
    // It now PROJECTS the node through the draw transform and asserts it landed in the VISIBLE
    // region (right of the 360px pane), which is what "navigate but keep the sidebar open" means.
    const j = journey(page);
    await j.boot("/");
    await j.hydrateAll();
    await j.land("Mount Top");
    await openChallenges(page);

    const lesson = UNIT1.lessons[0];
    await page
      .locator(`.ng-challenge-lesson[data-lesson="${lesson.deckKey}"]`)
      .click();
    await j.advance(2500); // let the camera converge on its target

    const state = await page.evaluate((deckKey) => {
      const app = (window as any).__neural;
      const node = app.nodes[app._lessonNodeIdx(deckKey)];
      const cam = app.cam;
      const W = app.W || 1200;
      const scale = W / cam.vw;
      const sx = (node.x - cam.cx) * scale + W / 2;
      const sy = (node.y - cam.cy) * scale + (app.H || 800) / 2;
      return {
        sx, sy, W, H: app.H || 800,
        paneOpen: !!app.deckShown,
        takeover: !!app._paneStudyActive(),
        miniOpen: !!document.querySelector(`[data-mini-deck="${deckKey}"]`),
        navVisible: !!(app.viewToggleRef.current && app.viewToggleRef.current.style.display !== "none"),
      };
    }, lesson.deckKey);

    expect(state.paneOpen, "the pane STAYS open").toBe(true);
    expect(state.takeover, "and is never taken over by the row click").toBe(false);
    expect(state.navVisible, "the tab nav survives — you can still see where you are").toBe(true);
    expect(state.miniOpen, "the inline Q&A opened in place").toBe(true);
    // the node is in the VISIBLE region: right of the pane, inside the viewport, roughly centred
    expect(state.sx, "right of the 360px pane").toBeGreaterThan(360);
    expect(state.sx).toBeLessThan(state.W);
    expect(state.sy).toBeGreaterThan(0);
    expect(state.sy).toBeLessThan(state.H);
    const visCentre = 360 + (state.W - 360) / 2;
    expect(Math.abs(state.sx - visCentre), "centred in the VISIBLE half, not the viewport").toBeLessThan(120);
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

  test("the ladder explains itself once, not once per belt", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await openChallenges(page);

    // ONE plain line for the whole ladder; the per-track prose block is display-retired
    await expect(page.locator(".ng-ladder-note")).toHaveCount(1);
    await expect(page.locator(".ng-ladder-note")).toContainText(
      "Every lesson is open",
    );
    await expect(
      page
        .locator(".ng-challenge-curriculum")
        .filter({ hasText: "OPEN CURRICULUM PRACTICE" }),
    ).toHaveCount(0);
  });

  test("a finished lesson wears an edge check and its deck opens inline on the ladder", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: unit1DoneBlob() });
    await openChallenges(page);

    const doneKey = UNIT1.lessons[0].deckKey;
    const done = page.locator(`.ng-challenge-lesson[data-lesson="${doneKey}"]`);
    await expect(done.locator(".ng-lesson-check")).toBeVisible();

    // a lesson without evidence wears no check
    const fresh = CURRICULUM.belts[0].units[1].lessons[0].deckKey;
    await expect(
      page
        .locator(`.ng-challenge-lesson[data-lesson="${fresh}"]`)
        .locator(".ng-lesson-check"),
    ).toHaveCount(0);

    // the row's disclosure reveals the mini deck INLINE — the ladder stays put (no takeover)
    await page.locator(`[data-lesson-deck-toggle="${doneKey}"]`).click();
    await expect(
      page.locator(`.ng-challenge-lessons [data-mini-deck="${doneKey}"]`),
    ).toBeVisible();
    await expect(page.locator(".ng-track-card").first()).toBeVisible();
    expect(
      await page.evaluate(() => !!(window as any).__neural._paneStudyActive()),
    ).toBe(false);
  });

  test("technique lesson rows carry their category tint", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await openChallenges(page);

    // every lesson row declares its category; a position row and a technique row differ
    const cats = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll(
          "[data-track-curriculum='white'] .ng-challenge-lesson[data-cat]",
        ),
      );
      return {
        total: document.querySelectorAll(
          "[data-track-curriculum='white'] .ng-challenge-lesson",
        ).length,
        tagged: rows.length,
        kinds: Array.from(
          new Set(rows.map((r) => r.getAttribute("data-cat"))),
        ).sort(),
        borders: Array.from(
          new Set(rows.map((r) => getComputedStyle(r).borderLeftColor)),
        ).length,
      };
    });
    expect(cats.tagged).toBe(cats.total);
    expect(cats.kinds.length).toBeGreaterThan(1);
    expect(cats.borders).toBeGreaterThan(1);
  });

  test("a belt renders its principles group only when curriculum data provides one", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openChallenges(page);

    // no curriculum data ships principles yet — the slot stays silent
    await expect(page.locator("[data-principles]")).toHaveCount(0);

    // the moment a belt carries a principles array, the group renders ahead of its units
    await page.evaluate(() => {
      const app = (window as any).__neural;
      app.curriculum.belts[0].principles = [
        { name: "Base", blurb: "Stay heavy through your hips." },
        { name: "Frames" },
      ];
      app.renderExplorer();
    });
    const group = page.locator("[data-principles='white']");
    await expect(group).toBeVisible();
    await expect(group).toContainText("Principles of this level");
    await expect(group.locator(".ng-principle-row")).toHaveCount(2);
    await expect(group).toContainText("Stay heavy through your hips.");
    expect(
      await page.evaluate(() => {
        const g = document.querySelector("[data-principles='white']");
        const u = document.querySelector(
          "[data-track-curriculum='white'] .ng-challenge-group",
        );
        return !!(
          g &&
          u &&
          g.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING
        );
      }),
    ).toBe(true);
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
