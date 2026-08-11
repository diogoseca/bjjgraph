import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

// ══════════════════════════════════════════════════════════════════════════════════════
// THE BELT METER — the Game Knowledge meter rendered as a real BJJ belt (v1.90.0).
//
// Display-only, by canon: the belt READS gameScore() and nothing reads the belt. These
// journeys pin the contract:
//   · WHITE IS THE FLOOR, NOT A TARGET (v1.95.0, owner's rule): "everybody starts as
//     white — there is never 0% to white. It's always 0% to blue." gameScore() still
//     reports belt:null below the first threshold (its math is untouched); the DISPLAY
//     wears the white belt from score 0 and its road spans the whole 0 → blue stretch.
//     White's tape stripes are quarter-marks of that displayed road (gameScore's internal
//     pre-white/white split would reset the tape count mid-road);
//   · held belts from blue up wear gameScore().stripes, exactly — no re-derivation;
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

// the belt lives at the top of EXPLORE since v1.96.0 ([data-knowledge]) — the
// .ng-knowledge-header section above the tabs is gone (owner: one home per fact)
const openPane = async (page: Page) => {
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.setViewMode("explore");
    app.openExplorer();
  });
  await expect(page.locator("[data-knowledge]")).toBeVisible();
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
  test("held belts wear gameScore().stripes; the white floor derives quarter-marks of its road", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    const profiles: Array<{ seed: Score; rendered: number; why: string }> = [
      {
        // white floor: displayed road is 0→0.4, so tape = floor(0.21 / 0.4 * 4) = 2 —
        // NOT the seeded gameScore().stripes (which counts the internal 0.2→0.4 band)
        seed: { score: 0.21, belt: "white", next: "blue", stripes: 0 },
        rendered: 2,
        why: "white derives its tape from the displayed 0→blue road",
      },
      {
        seed: { score: 0.5, belt: "blue", next: "purple", stripes: 2 },
        rendered: 2,
        why: "held belts wear gameScore().stripes",
      },
      {
        // stripes:4 while score-derivation would say floor((0.79-0.7)/0.1*4)=3 — held
        // belts honor gameScore().stripes exactly, they never re-derive from the score
        seed: { score: 0.79, belt: "brown", next: "black", stripes: 4 },
        rendered: 4,
        why: "held belts honor gameScore().stripes even against the arithmetic",
      },
    ];
    for (const profile of profiles) {
      const game = await seatBelt(page, profile.seed);
      expect(game.stripes).toBe(profile.seed.stripes);
      await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
        "data-belt",
        profile.seed.belt!,
      );
      expect(await stripesRendered(page), profile.why).toBe(profile.rendered);
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
    await expect(page.locator("[data-knowledge]")).toContainText(
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

    // the floor: no band earned yet (gameScore says belt:null, next:"white") — the display
    // wears white and roads to BLUE. Seeded stripes:2 is gameScore's internal 0→0.2 count;
    // the display derives 1 from the 0→0.4 road (floor(0.1/0.4*4)) — never "to white".
    await seatBelt(page, { score: 0.1, belt: null, next: "white", stripes: 2 });
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-label",
      "White belt, 1 stripe — 25% to blue",
    );
  });

  test("a cold start wears the white belt on the road to blue — 0% to white never exists", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await openPane(page);

    // no seeded cache: this is the real fresh-boot gameScore (score 0, belt null)
    const block = page.locator("[data-knowledge]");
    await expect(
      page.locator(".ng-knowledge-header"),
      "the old header section no longer exists anywhere (v1.96.0)",
    ).toHaveCount(0);
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "data-belt",
      "white",
    );
    // the belt name lives in the meter's aria (rank, stripes, road) — the kicker line is
    // gone, so the block's TEXT is just the road
    await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute(
      "aria-label",
      "White belt, 0 stripes — 0% to blue",
    );
    await expect(block).toContainText("% to blue");
    await expect(block, "white is the floor, never a target").not.toContainText(
      "to white",
    );
    // the band road: white owns the whole first 40% of the score axis (no pre-white
    // lead-in segment), then blue/purple/brown/black as BELT_SCORE earns them
    await expect(page.locator(".ng-belt-road > span")).toHaveCount(5);
    const first = await page
      .locator(".ng-belt-road > span")
      .first()
      .getAttribute("style");
    expect(first, "the first band is white and spans 0→40").toContain("40%");
    expect(first).toContain("#d8dde8");
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
    // display rule: black no ladder; the white floor derives from the 0→blue road;
    // held belts wear gameScore().stripes
    const expected =
      game.belt === "black"
        ? 0
        : !game.belt || game.belt === "white"
          ? Math.max(0, Math.min(4, Math.floor((game.score / 0.4) * 4)))
          : game.stripes;
    expect(await stripesRendered(page)).toBe(expected);
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
