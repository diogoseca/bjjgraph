import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

const progressBlob = (overrides: Record<string, unknown> = {}) => ({
  v: 2,
  prep: {},
  rec: {},
  stage: {},
  units: {},
  belts: { won: {} },
  tut: { done: {} },
  challenges: {},
  badges: {},
  coins: {},
  days: {},
  settings: {},
  settingsAt: {},
  updatedAt: 100,
  ...overrides,
});

test.describe("Challenges UI @curated", () => {
  test("all content tracks and lessons are open while capstones require evidence", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    await page.locator(".ng-logo").click();
    await expect(page.locator(".ng-knowledge-header")).toContainText(
      "YOUR GAME KNOWLEDGE",
    );
    // tab titles live in each button's <b>; the second line is a subtitle (v1.95.0 —
    // History is displayed as "Last rolls"; the internal view id stays `history`)
    await expect(page.locator(".ng-learning-nav button b")).toHaveText([
      "Explore",
      "Challenges",
      "Last rolls",
    ]);

    const tracks = page.locator(".ng-track-card");
    await expect(tracks).toHaveCount(5);
    await expect(tracks.filter({ hasText: "Black Breadth" })).toBeEnabled();
    await tracks.filter({ hasText: "Black Breadth" }).click();
    await expect(page.locator(".ng-challenge-detail h2")).toHaveText(
      "Black Breadth",
    );
    await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
    await expect(
      page.locator(".ng-challenge-checkpoint").first(),
    ).toBeDisabled();
    await expect(page.locator("[data-capstone='black'] button")).toBeDisabled();
    await expect(page.locator(".ng-challenge-curriculum").first()).toContainText(
      "Every lesson is open",
    );
  });

  test("pinning an advanced track updates the persistent cue and reopens its detail", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    await page.locator(".ng-logo").click();
    await page.locator("[data-track='purple']").click();
    await page.locator(".ng-pin-track").click();
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await page.locator(".ng-explorer-close").click();
    await expect(page.locator("[data-challenge-cue]")).toContainText(
      "PURPLE CHALLENGES",
    );
    await page.locator("[data-challenge-cue-open]").click();

    await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-track='purple']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".ng-pin-track")).toHaveText("Pinned to my roll");
  });

  test("the rewards shelf distinguishes meaningful patches from mint-once joke coins", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({
        badges: { "clean-checkpoint": { t: 100 } },
        coins: { houdini: { t: 100 } },
      }),
    });

    // Collection retired as a tab (v1.76.0) — the same items live on a shelf inside Challenges
    await page.locator(".ng-logo").click();
    await page.locator("[data-view='challenges']").click();
    const shelf = page.locator("[data-rewards-shelf]");
    await expect(shelf.locator("summary")).toContainText(
      "Mat Coins are just for laughs. They do not buy anything.",
    );
    await shelf.locator("summary").click();
    await expect(page.locator(".ng-patch-badge")).toHaveCount(7);
    await expect(page.locator(".ng-mat-coin")).toHaveCount(8);
    await expect(
      page.locator(".ng-patch-badge[data-earned='true']"),
    ).toHaveCount(1);
    await expect(page.locator(".ng-mat-coin[data-earned='true']")).toHaveCount(
      1,
    );
    await expect(
      page.locator(".ng-patch-badge[data-earned='false']").first(),
    ).toContainText("Available to earn");
  });

  test("legacy progress receives one quiet migration explanation", async ({
    page,
  }) => {
    const j = journey(page);
    const done = Object.fromEntries(
      ["coach1", "coach2", "coach3", "answer", "sheet", "commit", "sweep"].map(
        (id) => [id, 1],
      ),
    );
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({ tut: { done } }),
    });

    await page.locator(".ng-logo").click();
    await expect(page.locator(".ng-challenge-distinction")).toHaveText(
      "Tutorial is now White Challenges - same progress, more to collect.",
    );
    // 7 seeded tut steps + white.pane-open: opening the merged pane IS opening the flashcards
    // pane (pane_paused fires on every open since v1.76.0), so the count lands at 8
    await expect(page.locator("[data-track='white'] strong")).toHaveText(
      "8 of 20",
    );
    await page.locator("[data-view='explore']").click();
    await page.locator("[data-view='challenges']").click();
    await expect(page.locator(".ng-challenge-distinction")).not.toContainText(
      "Tutorial is now",
    );
  });

  test("guest and offline challenge progress stays explicit", async ({
    page,
    context,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await page.locator(".ng-logo").click();

    const notice = page.locator(".ng-challenge-distinction");
    await expect(notice).toHaveAttribute("data-challenge-state", "signed-out");
    await expect(notice).toHaveText(
      "Playing as guest - progress is saved on this device.",
    );

    await context.setOffline(true);
    await expect(notice).toHaveAttribute("data-challenge-state", "offline");
    await expect(notice).toHaveText(
      "Offline - completions stay on this device and sync later.",
    );

    await context.setOffline(false);
    await expect(notice).toHaveAttribute("data-challenge-state", "signed-out");
  });

  test("legacy tree, path, and collection preferences migrate to Explore and Challenges", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });

    const setLegacyView = async (view: "path" | "tree" | "collection") => {
      await page.evaluate((legacyView) => {
        const app = (window as any).__neural;
        delete app.settings.challengeView;
        delete app._settingsAt.challengeView;
        app._flushSave();
        localStorage.setItem("bjj_view_mode", legacyView);
      }, view);
    };

    await setLegacyView("path");
    await j.boot("/", { keepTutorial: true, preserveStorage: true });
    await page.locator(".ng-logo").click();
    await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.locator(".ng-explorer-close").click();
    await setLegacyView("tree");
    await j.boot("/", { keepTutorial: true, preserveStorage: true });
    await page.locator(".ng-logo").click();
    await expect(page.locator("[data-view='explore']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // the retired Collection tab lands on Challenges (its content lives on the rewards shelf)
    await page.locator(".ng-explorer-close").click();
    await setLegacyView("collection");
    await j.boot("/", { keepTutorial: true, preserveStorage: true });
    await page.locator(".ng-logo").click();
    await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a Mat Coin acknowledgement links to its permanent rewards-shelf entry", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await page.evaluate(() => {
      const app = (window as any).__neural;
      app.fx("escape", { via: "Elbow Escape" });
      app.fx("escape", { via: "Elbow Escape" });
      app.fx("escape", { via: "Elbow Escape" });
    });

    const reward = page.locator(".ng-challenge-reward[data-reward='coin']");
    await expect(reward).toContainText("MAT COIN MINTED");
    await expect(reward).toContainText("Houdini");
    await reward.locator("[data-reward-collection]").click();
    await expect(page.locator("[data-view='challenges']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-rewards-shelf]")).toHaveAttribute("open", "");
    await expect(
      page
        .locator(".ng-mat-coin[data-earned='true']")
        .filter({ hasText: "Houdini" }),
    ).toHaveCount(1);
  });

  test("keyboard navigation reaches advanced tracks and restores focus on close", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    const opener = page.locator(".ng-logo");
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ng-explorer")).toBeVisible();

    const black = page.locator("[data-track='black']");
    await black.focus();
    await page.keyboard.press("Enter");
    await expect(black).toHaveAttribute("aria-pressed", "true");
    await page.locator(".ng-explorer-close").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ng-explorer")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("reward feedback stays polite, focus-safe, and softly deduplicated", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    const transport = page.locator("[title='Pause']");
    await transport.focus();
    await page.evaluate(() => {
      const app = (window as any).__neural;
      for (let i = 0; i < 6; i += 1) app.fx("escape", { via: "Elbow Escape" });
    });

    const reward = page.locator(".ng-challenge-reward");
    await expect(reward).toHaveAttribute("role", "status");
    await expect(reward).toHaveAttribute("aria-live", "polite");
    await expect(transport).toBeFocused();
    const sounds = await page.evaluate(
      () =>
        (window as any).__neural.sound.soundLog.filter(
          (entry: any) =>
            entry.beat === "coin_earned" && entry.patch === "coin-mint",
        ).length,
    );
    expect(sounds).toBe(1);
  });

  test("reduced motion removes reward animation without removing acknowledgement", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await page.evaluate(() => {
      const app = (window as any).__neural;
      for (let i = 0; i < 3; i += 1) app.fx("escape", { via: "Elbow Escape" });
    });

    const reward = page.locator(".ng-challenge-reward");
    await expect(reward).toContainText("Houdini");
    await expect
      .poll(() =>
        reward.evaluate((element) => getComputedStyle(element).animationName),
      )
      .toBe("none");
  });

  test("the mobile cue stays clear of the option hand and transport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 875 });
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });

    const opener = page.locator(".ng-logo");
    await expect(opener).toBeVisible();
    const openerBox = await opener.boundingBox();
    expect(openerBox?.width).toBeGreaterThanOrEqual(44);
    expect(openerBox?.height).toBeGreaterThanOrEqual(44);
    await opener.click();
    await expect(page.locator(".ng-explorer")).toBeVisible();
    await page.locator(".ng-explorer-close").click();

    await j.land("Mount Top");

    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect
          ? {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
            }
          : null;
      };
      const overlap = (a: any, b: any) =>
        a &&
        b &&
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      const cue = box("[data-challenge-cue]");
      const option = box(".ng-optionrow > *");
      const transport = box("[title='Pause']");
      return {
        cue,
        overlapsOption: overlap(cue, option),
        overlapsTransport: overlap(cue, transport),
        height: cue ? cue.bottom - cue.top : 0,
        detailDisplay: getComputedStyle(
          document.querySelector(".ng-cue-detail") as Element,
        ).display,
      };
    });

    expect(geometry.cue).not.toBeNull();
    expect(geometry.overlapsOption).toBe(false);
    expect(geometry.overlapsTransport).toBe(false);
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(geometry.detailDisplay).toBe("none");
  });
});
