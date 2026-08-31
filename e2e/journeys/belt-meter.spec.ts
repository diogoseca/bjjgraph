import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

// ══════════════════════════════════════════════════════════════════════════════════════
// THE SCORE BELT IS RETIRED AS A VISUAL (v1.98.1) — this file pins its absence.
//
// History: the Game Knowledge meter was a woven belt in the pane header (v1.90.0), gained
// the band road (v1.93.0), learned the white-floor rule — "everybody starts as white,
// there is never 0% to white, always 0% to blue" (v1.95.0) — moved to the top of Explore
// when the header died (v1.96.0), and was removed from Explore by the owner in v1.98.1
// ("we should no longer see this"). The renderer lives in git history (v1.96.0's
// _knowledgeBlock) if a home is ever wanted again (account menu? victory screen?).
//
// What remains, and is pinned here:
//   · NO score-belt visual anywhere — no .ng-knowledge-header, no [data-knowledge], no
//     .ng-knowledge-meter, no .ng-belt-road, on any tab;
//   · the score stays exposed in ONE place: the Explore tab subtitle, "Mastered N%"
//     (word first, integer percent — gameScore() itself is untouched);
//   · the ONLY belt visual left is the Challenges tab's mini ladder belt (.ng-tab-belt,
//     unit-earned stripes — pane-chrome.spec.ts owns that contract) and the corridor's
//     section rails (challenges-ui.spec.ts owns those).
// ══════════════════════════════════════════════════════════════════════════════════════

const openTab = async (page: Page, view: string) => {
  await page.evaluate((v) => {
    const app = (window as any).__neural;
    app.setViewMode(v);
    app.openExplorer();
  }, view);
  await expect(page.locator(".ng-learning-nav")).toBeVisible();
};

test.describe("Score belt retired @curated", () => {
  test("no score-belt visual on any tab; the score lives in the Explore subtitle alone", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");

    for (const view of ["explore", "challenges", "history"]) {
      await openTab(page, view);
      await expect(page.locator(".ng-knowledge-header"), view).toHaveCount(0);
      await expect(page.locator("[data-knowledge]"), view).toHaveCount(0);
      await expect(page.locator(".ng-knowledge-meter"), view).toHaveCount(0);
      await expect(page.locator(".ng-belt-road"), view).toHaveCount(0);
    }

    // the one remaining exposure of the score, and it is live
    const sub = await page.locator('[data-tab-sub="explore"]').innerText();
    const score = await page.evaluate(
      () => (window as any).__neural.gameScore().score,
    );
    expect(sub).toBe("Mastered " + Math.round(score * 100) + "%");

    // the one remaining belt visual: the Challenges tab's ladder belt
    await expect(page.locator(".ng-learning-nav .ng-tab-belt")).toHaveCount(1);
  });

  test("a seeded score moves the subtitle — and conjures no meter back", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openTab(page, "explore");

    await page.evaluate(() => {
      const a = (window as any).__neural;
      // `f` is REQUIRED since v1.146.0: the weights table is per ruleset, so `gameScore`
      // memoises on (_stageVer, frame). A seed without it misses and the real score is
      // recomputed, which reads as "the subtitle ignored my seed". Derived, never hard-coded,
      // so it cannot drift from the app's own default.
      a._scoreCache = {
        v: a._stageVer || 0,
        f: a._giMode === "nogi" ? "nogi" : "gi",
        out: { score: 0.5, belt: "blue", next: "purple", stripes: 2 },
      };
      a.renderTabSubtitles();
    });
    await expect(page.locator('[data-tab-sub="explore"]')).toHaveText(
      "Mastered 50%",
    );
    await expect(page.locator(".ng-knowledge-meter")).toHaveCount(0);
  });
});
