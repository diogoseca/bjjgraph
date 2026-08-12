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
    // the knowledge header is gone (v1.96.0 — the belt lives at the top of Explore)
    await expect(page.locator(".ng-learning-nav")).toBeVisible();
    await expect(page.locator(".ng-knowledge-header")).toHaveCount(0);
    // tab titles live in each button's <b>; the second line is a subtitle (v1.95.0 —
    // History is displayed as "Last rolls"; the internal view id stays `history`)
    await expect(page.locator(".ng-learning-nav button b")).toHaveText([
      "Explore",
      "Challenges",
      "Last rolls",
    ]);

    const tracks = page.locator(".ng-track-card");
    await expect(tracks).toHaveCount(5);
    // headers speak plain belts (v1.96.0); the double title is GONE (v1.98.1) — no
    // "CHALLENGES / <track name> / N of M" head under the belt header, for ANY belt
    const black = page.locator(".ng-track-card[data-track='black']");
    await expect(black).toHaveText(/^Black belt0 of \d+$/);
    await expect(black).toBeEnabled();
    await black.click();
    await expect(page.locator(".ng-challenge-detail-head")).toHaveCount(0);
    await expect(page.locator(".ng-challenge-detail h2")).toHaveCount(0);
    await expect(page.locator(".ng-detail-up")).toHaveCount(0);
    // the selected advanced belt still shows its objectives — headless
    await expect(
      page.locator(".ng-belt-section[data-belt='black'] .ng-challenge-row").first(),
    ).toBeVisible();
    await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
    // and no separator rides between a belt header and its first content row (v1.98.1)
    const seams = await page.evaluate(() => {
      const out: string[] = [];
      for (const sel of [".ng-challenge-detail", ".ng-challenge-curriculum"]) {
        document.querySelectorAll(sel).forEach((el) => {
          const s = getComputedStyle(el);
          if (s.borderTopStyle !== "none" && parseFloat(s.borderTopWidth) > 0)
            out.push(sel);
        });
      }
      return out;
    });
    expect(seams, "no intra-section divider lines").toEqual([]);
    await expect(
      page.locator(".ng-challenge-checkpoint").first(),
    ).toBeDisabled();
    await expect(page.locator("[data-capstone='black'] button")).toBeDisabled();
    // the corridor explains itself once — one plain line above the belts (v1.96.0)
    await expect(page.locator(".ng-ladder-note")).toContainText(
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
    // pinning folded into the belt HEADER row (v1.98.1): a compact 44px pin toggle
    const pin = page.locator("[data-belt-pin='purple']");
    await expect(pin).toHaveAttribute("aria-pressed", "false");
    await pin.click();
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
    // pinned state visibly distinct + spoken: aria-pressed true, and the white pin is not
    await expect(page.locator("[data-belt-pin='purple']")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-belt-pin='white']")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // the old detail-block pin button is gone with the detail head
    await expect(page.locator(".ng-pin-track")).toHaveCount(0);
    // 44px affordance
    const box = (await page.locator("[data-belt-pin='purple']").boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(44);
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
    // pane (pane_paused fires on every open since v1.76.0), so the count lands at 8.
    // The objective count lives on the Getting started section now (v1.96.0) — the White
    // belt header counts lessons instead.
    await expect(page.locator("[data-tutorial] strong")).toHaveText("8 of 20");
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

  test("belt headers read as plain belts riding one corridor with a knot at each boundary", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    // the verbose "White Foundations · WHITE CONTENT TRACK" phrasing is display-retired:
    // ladder headers are the belts themselves (track ids and data names unchanged)
    await expect(page.locator(".ng-track-card b")).toHaveText([
      "White belt",
      "Blue belt",
      "Purple belt",
      "Brown belt",
      "Black belt",
    ]);
    await expect(
      page.locator(".ng-track-card").filter({ hasText: "CONTENT TRACK" }),
    ).toHaveCount(0);

    // the corridor: one woven rail per belt section; a knot marks every belt boundary,
    // so there are exactly four — and none before White, which opens the corridor
    await expect(page.locator(".ng-belt-section .ng-corridor-rail")).toHaveCount(5);
    await expect(page.locator(".ng-corridor-knot")).toHaveCount(4);
    await expect(
      page.locator(".ng-belt-section[data-belt='white'] .ng-corridor-knot"),
    ).toHaveCount(0);
  });

  test("the getting-started tutorial is its own section above the belts", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    const tutorial = page.locator("[data-tutorial]");
    await expect(tutorial).toBeVisible();
    // renamed "Getting started" → "Tutorial" (v1.98.1), belt-header typography
    await expect(tutorial.locator(".ng-tutorial-head b")).toHaveText("Tutorial");
    await expect(tutorial).not.toContainText("Getting started");
    // the twenty White evidence objectives live HERE now, not on the belt ladder
    await expect(tutorial.locator(".ng-challenge-row")).toHaveCount(20);
    await expect(
      page.locator(".ng-challenge-ladder .ng-challenge-row"),
    ).toHaveCount(0);
    // and the tutorial precedes the ladder in reading order
    expect(
      await page.evaluate(() => {
        const t = document.querySelector("[data-tutorial]");
        const l = document.querySelector(".ng-challenge-ladder");
        return !!(
          t &&
          l &&
          t.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING
        );
      }),
    ).toBe(true);
  });

  test("a largely-done tutorial folds down to a compact remainder", async ({
    page,
  }) => {
    const j = journey(page);
    // 14 seeds INCLUDING the two that auto-complete the moment the pane opens
    // (pane_paused -> white.pane-open, challenges_opened -> white.challenges), so the
    // observed count stays exactly 14 of 20
    const doneIds = [
      "white.coach1",
      "white.coach2",
      "white.coach3",
      "white.answer",
      "white.sheet",
      "white.commit",
      "white.sweep",
      "white.win1",
      "white.refund",
      "white.defend",
      "white.escape",
      "white.roll",
      "white.pane-open",
      "white.challenges",
    ];
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({
        challenges: Object.fromEntries(
          doneIds.map((id) => [id, { progress: 1, done: true, t: 100 }]),
        ),
      }),
    });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    // FOLDED BY DEFAULT AT ANY PROGRESS (v1.98.1 — the ≥14 threshold is dead): 14 of 20
    // renders collapsed, rows in DOM but folded away
    const tutorial = page.locator("[data-tutorial]");
    await expect(tutorial).toHaveAttribute("data-collapsed", "true");
    await expect(tutorial).toContainText("14 of 20");
    await expect(tutorial.locator(".ng-challenge-row")).toHaveCount(20);
    await expect(tutorial.locator(".ng-challenge-row").first()).toBeHidden();
    // ...and what he HASN'T seen shows compactly WITHOUT expanding — chips to the RIGHT of
    // the title, ON THE SAME ROW (v1.98.1)
    const remainder = tutorial.locator("[data-tutorial-remainder]");
    await expect(remainder).toBeVisible();
    await expect(remainder).toContainText("Watch a film-study Short");
    const geo = await page.evaluate(() => {
      const b = document.querySelector(".ng-tutorial-head b")!.getBoundingClientRect();
      const r = document.querySelector("[data-tutorial-remainder]")!.getBoundingClientRect();
      const pane = document.querySelector(".ng-drill")!.getBoundingClientRect();
      return {
        sameRow: Math.abs(b.top + b.height / 2 - (r.top + r.height / 2)) < 10,
        rightOfTitle: r.left >= b.right,
        contained: r.right <= pane.right + 1,
      };
    });
    expect(geo.sameRow, "chips share the title's row").toBe(true);
    expect(geo.rightOfTitle, "chips sit to the right of the title").toBe(true);
    expect(geo.contained, "and truncate inside the pane instead of overflowing").toBe(true);
  });

  test("the tutorial defaults folded even on a fresh boot — no progress threshold", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    // v1.98.1 (owner at 11/20 saw it expanded): collapsed regardless of progress
    const tutorial = page.locator("[data-tutorial]");
    await expect(tutorial).toHaveAttribute("data-collapsed", "true");
    // the user's own expansion persists via the existing settings map
    await page.locator("[data-tutorial-toggle]").click();
    await expect(tutorial).toHaveAttribute("data-collapsed", "false");
    await j.boot("/", { preserveStorage: true, keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();
    await expect(page.locator("[data-tutorial]")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
  });

  test("Continue is gone; opening Challenges lands on the frontier's belt section", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    // pin BLACK so the frontier lives far down the corridor — the scroll must be earned
    await page.evaluate(() => (window as any).__neural.pinChallengeTrack("black"));
    await page.locator(".ng-logo").click();
    await expect(page.locator(".ng-challenge-ladder")).toBeVisible();

    // the button is dead (v1.98.1) — arrival positioning replaced it
    await expect(page.locator("[data-challenge-continue]")).toHaveCount(0);

    const arrived = await page.evaluate(() => {
      const list = document.querySelector(".ng-learning-list") as HTMLElement;
      const sec = document.querySelector(
        ".ng-belt-section[data-belt='black']",
      ) as HTMLElement;
      const lr = list.getBoundingClientRect();
      const sr = sec.getBoundingClientRect();
      return {
        scrollTop: list.scrollTop,
        headOffset: sr.top - lr.top,
        secBottom: sr.bottom - lr.top,
      };
    });
    expect(arrived.scrollTop, "the tab opened scrolled, not at the top").toBeGreaterThan(100);
    // the header rides AT the top — or above it only by what the frontier row needs
    // (black's section opens with a principles group taller than one viewport, so header
    // and frontier cannot always share the screen; the row wins, minimally). Never below.
    expect(
      arrived.headOffset,
      "landed inside the pinned belt's section, at or past its header",
    ).toBeLessThanOrEqual(2);
    expect(arrived.secBottom, "and not scrolled past the section").toBeGreaterThan(0);
    // the frontier row is marked (the existing glow) and FULLY in view
    const frontier = page.locator(".ng-challenge-lesson[data-frontier]");
    await expect(frontier).toHaveCount(1);
    expect(
      await frontier.evaluate((el) => {
        const list = document.querySelector(".ng-learning-list")!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return r.top >= list.top - 2 && r.bottom <= list.bottom + 2;
      }),
      "the frontier row is fully inside the viewport",
    ).toBe(true);

    // a re-render (roll beats, evidence refresh) must NOT yank the scroll while reading
    await page.evaluate(() => {
      const list = document.querySelector(".ng-learning-list") as HTMLElement;
      list.scrollTop = list.scrollTop + 120; // the user read further down
      (window as any).__neural.renderExplorer();
    });
    const after = await page.evaluate(
      () => (document.querySelector(".ng-learning-list") as HTMLElement).scrollTop,
    );
    expect(after, "re-renders preserve the reading position").toBeGreaterThan(arrived.scrollTop + 80);
  });

  test("belt sections collapse independently and the choice survives a reload", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    // defaults: the pinned belt (white) rides open, the rest fold — the ladder stays short
    const white = page.locator(".ng-belt-section[data-belt='white']");
    const black = page.locator(".ng-belt-section[data-belt='black']");
    await expect(white).toHaveAttribute("data-collapsed", "false");
    await expect(black).toHaveAttribute("data-collapsed", "true");

    // clicking a folded belt header selects AND opens it
    await page.locator(".ng-track-card[data-track='black']").click();
    await expect(black).toHaveAttribute("data-collapsed", "false");

    // the chevron folds it back without stealing selection (nothing re-locks — fold is display only)
    await page.locator("[data-belt-toggle='black']").click();
    await expect(black).toHaveAttribute("data-collapsed", "true");
    await expect(
      page.locator(".ng-track-card[data-track='black']"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(black.locator(".ng-challenge-group")).toHaveCount(6);

    // fold white too, reload: both choices persist per track
    await page.locator("[data-belt-toggle='white']").click();
    await expect(white).toHaveAttribute("data-collapsed", "true");
    await j.boot("/", { preserveStorage: true, keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();
    await expect(
      page.locator(".ng-belt-section[data-belt='white']"),
    ).toHaveAttribute("data-collapsed", "true");
    await expect(
      page.locator(".ng-belt-section[data-belt='black']"),
    ).toHaveAttribute("data-collapsed", "true");
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
