import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

// ══════════════════════════════════════════════════════════════════════════════════════
// THE BELT METER — the Game Knowledge meter rendered as a real BJJ belt (v1.90.0).
//
// Display-only, by canon: the belt READS gameScore() and nothing reads the belt. These
// journeys pin the contract:
//   · the tape stripes on the rank bar are gameScore().stripes, exactly — no more, no less;
//   · a black belt wears the RED rank bar and the 0-4 stripe ladder does not exist for it
//     (the owner is explicit: stripes end at black);
//   · reduced motion serves the static state — no tape-wrap animation, no hover transition;
//   · the meter's aria label speaks the belt ("Blue belt, 2 stripes — 50% to purple").
//
// Profiles are seeded through gameScore's own memo seam (_scoreCache), the same one the
// renderer reads — so DOM and gameScore() can never be asserted against different numbers.
// One honest-path test seeds no cache at all and checks the fresh boot's real score.
// ══════════════════════════════════════════════════════════════════════════════════════

type Score = {
  score: number;
  belt: string | null;
  next: string | null;
  stripes: number;
};

const openPane = async (page: Page) => {
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("challenges");
    app.openExplorer();
  });
  await expect(page.locator(".ng-knowledge-header")).toBeVisible();
};

// Seed the exact score the renderer will read: gameScore() returns the memoised out while
// _stageVer is unchanged, and renderKnowledgeHeader() consumes gameScore() alone.
const seatBelt = (page: Page, out: Score) =>
  page.evaluate((o) => {
    const app = (window as any).__neural;
    app._scoreCache = { v: app._stageVer || 0, out: o };
    app.renderKnowledgeHeader();
    return app.gameScore();
  }, out);

const stripesRendered = (page: Page) =>
  page.locator(".ng-knowledge-meter .ng-belt-bar > b").count();

test.describe("Belt meter @curated", () => {
  test("tape stripes are gameScore().stripes across seeded belts", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    const profiles: Score[] = [
      { score: 0.21, belt: "white", next: "blue", stripes: 0 },
      { score: 0.5, belt: "blue", next: "purple", stripes: 2 },
      { score: 0.79, belt: "brown", next: "black", stripes: 4 },
    ];
    for (const profile of profiles) {
      const game = await seatBelt(page, profile);
      expect(game.stripes).toBe(profile.stripes);
      await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
        "data-belt",
        profile.belt!,
      );
      expect(await stripesRendered(page)).toBe(profile.stripes);
    }
  });

  test("the aria label speaks the belt, the stripes and the road to the next band", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    await seatBelt(page, {
      score: 0.5,
      belt: "blue",
      next: "purple",
      stripes: 2,
    });
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-label",
      "Blue belt, 2 stripes — 50% to purple",
    );
    // the quiet text version of the same road, outside the belt itself
    await expect(page.locator(".ng-knowledge-header")).toContainText(
      "50% to purple",
    );

    await seatBelt(page, {
      score: 0.72,
      belt: "brown",
      next: "black",
      stripes: 0,
    });
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-label",
      "Brown belt, 0 stripes — 20% to black",
    );
  });

  test("black belt wears the red rank bar and no stripe ladder exists for it", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    // stripes:3 on purpose — whatever the arithmetic says, black renders NO ladder
    await seatBelt(page, { score: 0.85, belt: "black", next: null, stripes: 3 });
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "data-belt",
      "black",
    );
    expect(await stripesRendered(page)).toBe(0);
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-label",
      "Black belt",
    );
    const bar = await page
      .locator(".ng-knowledge-meter .ng-belt-bar")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    // the sleeve's base coat is the red var — authentic dye, decisively red over green/blue
    const [r, g, b] = bar.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(90);
    expect(r).toBeGreaterThan(g * 2);
    expect(r).toBeGreaterThan(b * 2);
  });

  test("a fresh boot renders the real (unseeded) gameScore stripes", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    const game = await page.evaluate(() =>
      (window as any).__neural.gameScore(),
    );
    expect(await stripesRendered(page)).toBe(
      game.belt === "black" ? 0 : game.stripes,
    );
  });

  test("earning a stripe wraps the tape on; reduced motion serves it static", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    await seatBelt(page, { score: 0.45, belt: "blue", next: "purple", stripes: 1 });
    await seatBelt(page, { score: 0.5, belt: "blue", next: "purple", stripes: 2 });
    const fresh = page.locator(".ng-belt-bar > b[data-new]");
    await expect(fresh).toHaveCount(1);
    expect(
      await fresh.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("ngTape");

    // the same earn under reduced motion: the stripe appears, nothing animates
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seatBelt(page, { score: 0.55, belt: "blue", next: "purple", stripes: 3 });
    await expect(page.locator(".ng-belt-bar > b[data-new]")).toHaveCount(1);
    expect(
      await page
        .locator(".ng-belt-bar > b[data-new]")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    expect(
      await page
        .locator(".ng-knowledge-meter")
        .evaluate((el) => getComputedStyle(el).transitionProperty),
    ).not.toContain("filter");
  });
});
