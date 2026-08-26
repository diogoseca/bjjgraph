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

  test("pinning is gone: the corridor opens itself at the topmost incomplete belt", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();

    // v1.99.2 (owner: "what's that pinning about?") — no pin affordance anywhere; the
    // corridor derives its one target from progress instead
    await expect(page.locator("[data-belt-pin]")).toHaveCount(0);
    await expect(page.locator(".ng-pin-track")).toHaveCount(0);

    // fresh: white is the topmost incomplete belt — it rides open, wears no stamp
    const white = page.locator(".ng-belt-section[data-belt='white']");
    const blue = page.locator(".ng-belt-section[data-belt='blue']");
    await expect(white).toHaveAttribute("data-collapsed", "false");
    await expect(blue).toHaveAttribute("data-collapsed", "true");
    await expect(white.locator(".ng-belt-stamp")).toHaveCount(0);

    // the dye is PRONOUNCED (owner): each card's tint carries real alpha, not a hint
    const tint = await page.evaluate(() => {
      const sec = document.querySelector(
        ".ng-belt-section[data-belt='blue']",
      ) as HTMLElement;
      const soft = sec.style.getPropertyValue("--ng-track-soft");
      const m = soft.match(/,\s*([\d.]+)\)/);
      return m ? parseFloat(m[1]) : 0;
    });
    expect(tint, "belt color owns the card").toBeGreaterThanOrEqual(0.3);

    // complete White -> on the next open, BLUE is the corridor's target: open, glowing,
    // and White wears the subtle completion stamp and folds away
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a.prep = a.prep || {};
      const beltDef = a.curriculum.belts.find((b: any) => b.id === "white");
      for (const unit of beltDef.units)
        for (const lesson of unit.lessons) a.prep[lesson.deckKey] = 99;
    });
    await page.locator(".ng-explorer-close").click();
    // the cue follows the frontier belt too
    // v1.133.0: the cue card is retired — the corridor's frontier shows in the pane, not a cue
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await page.locator(".ng-logo").click();
    await expect(white).toHaveAttribute("data-collapsed", "true");
    await expect(blue).toHaveAttribute("data-collapsed", "false");
    await expect(
      blue.locator(".ng-challenge-lesson[data-frontier]"),
      "the glow moved into blue",
    ).toHaveCount(1);
    // the stamp: a gray boxed check INSIDE the white header card, watermark-subtle
    await expect(white).toHaveAttribute("data-belt-complete", "1");
    const stamp = white.locator(".ng-track-card .ng-belt-stamp");
    await expect(stamp).toHaveCount(1);
    const subtle = await stamp.evaluate((el) => {
      const m = getComputedStyle(el).color.match(/,\s*([\d.]+)\)/);
      return m ? parseFloat(m[1]) : 1;
    });
    expect(subtle, "a watermark, not a badge").toBeLessThanOrEqual(0.4);
    await expect(blue.locator(".ng-belt-stamp"), "incomplete belts wear none").toHaveCount(0);
  });

  test("the rewards shelf shows only what is earned — and does not exist before that", async ({
    page,
  }) => {
    const j = journey(page);
    // v1.99.1 (owner: "I don't see the point" of the zero-state): a fresh player sees NO
    // shelf — no "0 patches · 0 mat coins", no placeholder grid spoiling the joke coins
    await j.boot("/", { keepTutorial: true });
    await page.locator(".ng-logo").click();
    await expect(page.locator(".ng-challenge-ladder")).toBeVisible();
    await expect(page.locator("[data-rewards-shelf]")).toHaveCount(0);
    await expect(page.locator(".ng-drill")).not.toContainText("Available to earn");

    // with something earned the shelf appears, carrying ONLY the earned items
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({
        badges: { "clean-checkpoint": { t: 100 } },
        coins: { houdini: { t: 100 } },
      }),
    });
    await page.locator(".ng-logo").click();
    const shelf = page.locator("[data-rewards-shelf]");
    await expect(shelf.locator("summary")).toContainText("1 patch · 1 mat coin");
    await expect(shelf.locator("summary")).toContainText(
      "Mat Coins are just for laughs. They do not buy anything.",
    );
    await shelf.locator("summary").click();
    await expect(page.locator(".ng-patch-badge")).toHaveCount(1);
    await expect(page.locator(".ng-mat-coin")).toHaveCount(1);
    await expect(page.locator(".ng-patch-badge")).toHaveAttribute(
      "data-earned",
      "true",
    );
    await expect(page.locator(".ng-mat-coin")).toContainText("Houdini");
    await expect(shelf).not.toContainText("Available to earn");
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
    // pane (pane_paused fires on every open since v1.76.0), so the count lands at 8. The
    // Tutorial section that used to PRINT that count left in v1.137.0, so the migration is
    // asserted where it now lives — the ledger the notice is about.
    expect(
      await page.evaluate(
        () => (window as any).__neural.challengeTrackProgress("white").done,
      ),
      "the seeded legacy steps migrated, plus the one this open earned",
    ).toBe(8);
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
    // v1.134.0: the transport is deleted — any surviving focusable chrome proves the claim
    const transport = page.locator(".ng-logo");
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

  test("the Tutorial section is gone — the corridor is the whole tab", async ({
    page,
  }) => {
    const j = journey(page);
    // keepTutorial leaves the twenty White objectives UNCOMPLETED, which is the state that
    // used to render the section at its largest — 20 rows, chips, a count. Nothing renders.
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await page.locator(".ng-logo").click();
    await expect(page.locator(".ng-challenge-ladder")).toBeVisible();

    // v1.137.0, owner: "we should remove the whole tutorial section". Renderer, card, head,
    // chips and body all left together — the handles, not just the visibility.
    await expect(page.locator("[data-tutorial]")).toHaveCount(0);
    await expect(page.locator(".ng-tutorial-section")).toHaveCount(0);
    await expect(page.locator(".ng-tutorial-head")).toHaveCount(0);
    await expect(page.locator("[data-tutorial-toggle]")).toHaveCount(0);
    await expect(page.locator("[data-tutorial-remainder]")).toHaveCount(0);
    expect(
      await page.evaluate(() => typeof (window as any).__neural.renderTutorialSection),
    ).toBe("undefined");
    // the White objectives have no surface anywhere now: the ladder never carried them,
    // and White's detail block was already suppressed (v1.98.1's double-title fix)
    await expect(page.locator(".ng-challenge-row")).toHaveCount(0);
    expect(await page.locator(".ng-learning-list").innerText()).not.toContain("Tutorial");

    // ...but the EVIDENCE still accrues. Deleting a surface must not delete the ledger the
    // White patch is minted from (CLAUDE.md §6.7 — a deleted component takes its capability
    // with it unless you check). A fresh keepTutorial boot owes all twenty.
    const prog = await page.evaluate(() =>
      (window as any).__neural.challengeTrackProgress("white"),
    );
    expect(prog.total, "the twenty definitions are still live in the engine").toBe(20);
  });

  test("Continue is gone; opening Challenges lands on the frontier's belt section", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    // complete everything above BLACK so the frontier lives far down the corridor —
    // the scroll must be earned (pinning is gone, v1.99.2: progress IS the target)
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a.prep = a.prep || {};
      for (const belt of a.curriculum.belts) {
        if (belt.id === "black") continue;
        for (const unit of belt.units)
          for (const lesson of unit.lessons) a.prep[lesson.deckKey] = 99;
      }
    });
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

    // defaults: the frontier belt (white, topmost incomplete) rides open, the rest fold
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

  test("the mobile cue is gone — nothing fights the hand for the phone band", async ({
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

    // v1.133.0: the cue card is retired — on the phone it used to fight the option hand and the
    // transport for the same band (the repo's old STILL OPEN collision). Now nothing mounts.
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await expect(page.locator(".ng-tut")).toHaveCount(0);
  });
});
