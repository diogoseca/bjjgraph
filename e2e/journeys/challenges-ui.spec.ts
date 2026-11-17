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

async function earnedTracks(page: any) {
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.belts = { ...a.belts, held: { id: "black", t: 1 }, gf: 1 };
    a.settings.challengeSelectedTrack = "white";
    a.set("challengeOpenSections", { white: true, black: false });
    a._saveProgress();
  });
}

test.describe("Challenges UI", () => {
  test("earned content tracks and lessons open while capstones still require evidence", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await earnedTracks(page);
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
    // the knowledge header is gone (v1.96.0 — the belt lives at the top of Explore)
    await expect(page.locator(".ng-drawer-head")).toBeVisible();
    await expect(page.locator(".ng-knowledge-header")).toHaveCount(0);
    // v1.242.0: the tabs became the drawer's rows; the view holding this corridor says where you are in the brand (the
    // Path's until v1.287.0, Master the game's since)
    await expect(page.locator(".ng-drawer-brand")).toHaveText("\u2039 Master the game");

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
    // v1.162.0 (owner): NOTHING renders above the corridor — the two prose lines that used to open the tab are gone,
    // and the sticky maintenance band that rode above it left with the Path (v1.287.0) — so the belt sections are the
    // first thing in the corridor's slot.
    await expect(page.locator(".ng-ladder-note")).toHaveCount(0);
    await expect(page.locator(".ng-challenge-distinction")).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const list = document.querySelector(".ng-challenge-ladder");
        const host = list && (list.parentElement as HTMLElement);
        if (!host || !list) return null;
        const before: string[] = [];
        for (const el of Array.from(host.children)) {
          if (el === list) break;
          before.push(el.className || el.tagName.toLowerCase());
        }
        return before;
      }),
      "no prose sits between the top of the tab and the first belt",
    ).toEqual([]);
  });

  test("pinning is gone: the corridor opens at the worn belt after earned advancement", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)

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
      for (const unit of beltDef.units) {
        a.units["white/" + unit.id] = { checkpoint: true, t: 1 };
        for (const lesson of unit.lessons) a.prep[lesson.deckKey] = 99;
      }
      a._syncBelt();
    });
    await page.locator(".ng-explorer-close").click();
    // the cue follows the frontier belt too
    // v1.133.0: the cue card is retired — the corridor's frontier shows in the pane, not a cue
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
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
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
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
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
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

  test("legacy progress migrates into White challenges without a notice", async ({
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

    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
    // v1.162.0 (owner): the one-off "Tutorial is now White Challenges" line is retired
    // along with the rest of the tab's head prose — the migration is silent, and the
    // ledger below is the only thing that has to be true.
    await expect(page.locator(".ng-challenge-distinction")).toHaveCount(0);
    // ── 8 -> 9, AND THAT MOVE IS THE POINT ──────────────────────────────────────────────
    // 7 seeded tut steps + white.pane-open (opening the merged pane IS opening the flashcards
    // pane; pane_paused fires on every open since v1.76.0) + white.challenges.
    //
    // That last one is NEW here and it is the migration notice's last side effect. The notice
    // gated the `challenges_opened` fx in noteLearningViewOpen — a legacy user opening this tab
    // fired no beat, so `white.challenges` never completed for the one population that had most
    // obviously done the thing it asks for. The gate existed only to keep the beat quiet while
    // the notice was on screen; the notice went in v1.162.0 and the gate went with it, so this
    // user now earns the objective on the same open as everybody else.
    //
    // If this ever reads 8 again, the suppression is back. Do not "fix" it by lowering the
    // number (CLAUDE.md §6.3 — if a change should have moved a count and did not, that is the
    // finding).
    expect(
      await page.evaluate(
        () => (window as any).__neural.challengeTrackProgress("white").done,
      ),
      "the seeded legacy steps migrated, plus pane-open and challenges-opened",
    ).toBe(9);
    await page.locator("[data-view='explore']").click();
    await j.openCorridor();
    await expect(page.locator(".ng-challenge-distinction")).toHaveCount(0);
  });

  // The guest/offline notice test left with the paragraph it asserted (v1.162.0). Guest
  // and offline progress still behave identically — they were never explained anywhere
  // but that line, and `challengeEnvironmentNotice()` is deleted, not merely unrendered.

  // O2 (v1.287.0, SET1 slice B): until v1.287.0 a stored `path` or `collection` restored onto the Path, and the restore wrote the
  // migrated `challengeView` back at boot. The Path left the drawer: every legacy value lands on the drawer's list, and the
  // retired Path values are NOT written back: both keys stay exactly as the player left them (a settings key is never
  // rewritten to retire a value, CLAUDE.md 6.6). `tree` keeps its old migration to `explore`, written as before.
  test("legacy tree, path, and collection preferences land on the drawer's list; the retired Path ones are not written back", async ({
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
    const restored = () => page.evaluate(() => {
      const app = (window as any).__neural;
      return { view: app._viewMode, setting: app.settings.challengeView ?? null, local: localStorage.getItem("bjj_view_mode") };
    });

    for (const legacy of ["path", "collection"] as const) {
      await setLegacyView(legacy);
      await j.boot("/", { keepTutorial: true, preserveStorage: true });
      await expect.poll(() => page.evaluate(() => !!(window as any).__neural.curriculum)).toBe(true);
      expect(await restored(), `a stored ${legacy} lands on the list and nothing is written back`)
        .toEqual({ view: "explore", setting: null, local: legacy });
      await j.clickByMouse(".ng-logo", "open the drawer");
      await expect(page.locator("[data-drawer-explore]"), `${legacy}: the drawer opens on its list`).toBeVisible();
      await expect(page.locator(".ng-drawer-brand"), `${legacy}: no Path to name`).not.toContainText("Path");
      await j.clickByMouse(".ng-explorer-close", "close the drawer");
    }

    await setLegacyView("tree");
    await j.boot("/", { keepTutorial: true, preserveStorage: true });
    await expect.poll(() => page.evaluate(() => !!(window as any).__neural.curriculum)).toBe(true);
    expect(await restored(), "tree keeps its migration to explore, written as before").toEqual({ view: "explore", setting: "explore", local: "tree" });
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
    // v1.280.0 (GOLD1-R3): the card's close draws the map AFTER View Collection's own work, and never before the frame clock's
    // first tick (this journey closes it there: a frame drawn inside `dismiss` threw and stopped the handler, and the Path did
    // not open). Mutant R3m (that draw back inside `dismiss`) is red here; R3g (the clock precondition removed) is a non-kill:
    // the frame then throws after the handler's work, and nothing here reads the page error.
    // O1 (v1.287.0, SET1 slice B): View Collection opened the Path with the shelf open; the Path left the drawer, and the same
    // shelf sits at the foot of Master the game's corridor, open and scrolled into view
    await reward.locator("[data-reward-collection]").click();
    await expect(page.locator(".ng-drawer-brand"), "View Collection opens Master the game").toHaveText("\u2039 Master the game");
    await expect(page.locator("[data-practice-page] [data-rewards-shelf]")).toHaveAttribute("open", "");
    await expect.poll(() => page.evaluate(() => {
      // Master the game scrolls in the drawer's study list (`drillListRef`), not the home list: read the shelf off the screen
      const shelf = document.querySelector("[data-rewards-shelf]")!.getBoundingClientRect();
      return shelf.height > 0 && shelf.top >= 0 && shelf.top < innerHeight;
    }), { message: "the shelf is scrolled into view" }).toBe(true);
    // ...and it STAYS there once Master the game has opened its first card: that card's own scroll (`_scrollFocusedDeck`)
    // yields while View Collection's is pending (v1.287.0). A poll above passes on the first moment the shelf is in view,
    // so this is one read after the card is open. Mutant B5 (the yield removed) is red in this test: on 17 Nov at the poll above
    // (that run's first card scrolled first); this read is for the run where the shelf is in view at first and then leaves it.
    await expect(page.locator("[data-practice-page] [data-mini-deck]").first(), "premise: Master the game opened its first card").toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await page.evaluate(() => {
      const shelf = document.querySelector("[data-rewards-shelf]")!.getBoundingClientRect();
      return shelf.height > 0 && shelf.top >= 0 && shelf.top < innerHeight;
    }), "the shelf is still in view after the first card opened").toBe(true);
    await expect(
      page
        .locator(".ng-mat-coin[data-earned='true']")
        .filter({ hasText: "Houdini" }),
    ).toHaveCount(1);
  });

  // SIDECX4: real Tab/Enter from the opener through Master the game (the Path row until it left the drawer, v1.287.0), Black
  // belt and Close. Hold both cold indexes, then land each while the row has focus; fire the old 80ms search timer in that gap.
  // The DSL's empty dossier bodies are irrelevant: this reads real index and curriculum controls.
  // Source controls and kill receipts: sidebar_keyboard_mutants.json / sidebar_mutants.md.
  // No new non-kills; this does not claim keyboard reachability of every lesson or reference page.
  for (const entry of ["drawer", "search shortcut"]) test(`keyboard navigation reaches advanced tracks and restores focus on close${entry === "drawer" ? "" : " via search shortcut"}`, async ({
    page,
  }) => {
    await page.clock.install();
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await earnedTracks(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const releases: (() => void)[] = [], held: string[] = [];
    for (const name of ["systems-index", "concepts"]) {
      const gate = new Promise<void>(resolve => { releases.push(resolve); });
      await page.route(`**/${name}.json`, async route => { held.push(name); await gate; await route.continue(); });
    }
    const tabTo = async (selector: string, label: string) => {
      const target = page.locator(selector);
      // Black's expanded curriculum adds hundreds of stops. Bound one whole traversal by the
      // rendered candidate count, not an assumed lesson count; native Tab decides the order.
      const limit = await page.locator("button, a[href], input, select, textarea, summary, [tabindex]").count() + 2;
      for (let n = 0; n < limit; n++) {
        if (await target.evaluate(el => el === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(target, `${label} is reachable with Tab`).toBeFocused();
      return target;
    };
    try {
      const opener = page.locator(".ng-logo");
      await opener.focus(); // only the starting point is placed programmatically
      await page.keyboard.press(entry === "drawer" ? "Enter" : "/");
      await expect(page.locator(".ng-explorer")).toBeVisible();
      await expect.poll(() => [...held].sort(), { message: "both real cold index requests are held" }).toEqual(["concepts", "systems-index"]);
      const path = await tabTo('[data-explore-stats] [data-b="due"]', "Master the game");
      await page.clock.runFor(100);
      await expect(path, "opening search cannot steal the next key from the row").toBeFocused();
      for (const [i, field] of ["systems", "concepts"].entries()) {
        releases[i]();
        await expect.poll(() => page.evaluate(key => (window as any).__neural[key]?.length || 0, field), { message: `${field} landed` }).toBeGreaterThan(0);
        await expect(path, `${field} landing preserves the keyboard-selected row`).toBeFocused();
      }
      await page.keyboard.press("Enter");
      // Master the game's corridor opens at the belt you wear (Black here), the earlier ones one press away; the Path drew all five
      await expect(page.locator("[data-practice-page] .ng-track-card[data-track='black']"), "Enter on the row opens the corridor").toHaveCount(1);
      const black = await tabTo("[data-track='black']", "Black belt");
      await expect(black).toHaveAttribute("aria-pressed", "false");
      await page.keyboard.press("Enter");
      await expect(black, "Enter selects the advanced track").toHaveAttribute("aria-pressed", "true");
      await tabTo(".ng-explorer-close", "Close");
      await page.keyboard.press("Enter");
      await expect(page.locator(".ng-explorer")).toBeHidden();
      await page.clock.runFor(1);
      await expect(opener, "closing the pane returns focus to its keyboard opener").toBeFocused();
    } finally {
      for (const release of releases) release();
      await page.clock.resume();
    }
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

  // v1.287.0: on a fresh (white) player, so Master the game's corridor draws the five in order on one rail; a black belt
  // holder's earlier belts sit below the worn one there (until v1.287.0 this ran on `earnedTracks`, in the Path's corridor)
  test("belt headers read as plain belts riding one corridor with a knot at each boundary", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)

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
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
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

  // v1.287.0 (SET1 slice B): until then this pinned the PATH's arrival scroll (P18): opening it scrolled the drawer's list to the
  // frontier belt's header, kept the frontier row in view, and a re-render kept the reading position. The Path left the drawer,
  // and its scroll went with it: Master the game's corridor STARTS at the belt you wear, so there is nothing to scroll to. What
  // stands is what the scroll was for: the frontier's belt is the corridor's first section, its frontier row marked, and the
  // earlier belts one press away.
  test("Continue is gone; Master the game's corridor starts at the frontier's belt section with the earlier tests won", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);

    // complete everything above BLACK so the frontier lives at the far end of the belts, their tests WON: an earlier belt whose
    // test can still be started is drawn in the first draw (PATH-R1, ruling 3; corridor-reach pins it), and this journey's
    // subject is where the corridor starts, so the earlier belts here are finished ones (the seed changed, no assertion did)
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a.prep = a.prep || {};
      a.belts = a.belts || { won: {} };
      a.belts.won = a.belts.won || {};
      for (const belt of a.curriculum.belts) {
        if (belt.id === "black") continue;
        for (const unit of belt.units) {
          a.units[belt.id + "/" + unit.id] = { checkpoint: true, t: 1 };
          for (const lesson of unit.lessons) a.prep[lesson.deckKey] = 99;
        }
        a.belts.won[belt.id] = { moves: 12, dominance: 5, byPoints: false };
      }
      a._syncBelt();
    });
    await j.openCorridor({ allBelts: false });
    await expect(page.locator(".ng-challenge-ladder")).toBeVisible();

    // the button is dead (v1.98.1)
    await expect(page.locator("[data-challenge-continue]")).toHaveCount(0);
    expect(
      await page.evaluate(() => [...document.querySelectorAll(".ng-challenge-ladder > .ng-belt-section")].map((el) => el.getAttribute("data-belt"))),
      "the corridor starts at the frontier's belt, and the belts above it are not drawn",
    ).toEqual(["black"]);
    await expect(page.locator(".ng-belt-section[data-belt='black'] .ng-challenge-lesson[data-frontier]"), "its frontier row is marked").toHaveCount(1);
    await expect(page.locator("[data-earlier-belts]"), "the earlier belts are one press away").toHaveText("Show earlier belts");
  });

  test("belt sections collapse independently and the choice survives a reload", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await earnedTracks(page);
    await expect
      .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
      .toBe(true);
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)

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
    await j.openCorridor(); // v1.287.0: the Path row left the drawer; its corridor is Master the game's (the DSL's one door)
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

    // v1.242.0 (owner A5/U46): one drawer icon, no "Menu" label, still a 44px target
    const opener = page.getByRole("button", { name: "Open the sidebar" });
    await expect(opener).toBeVisible();
    await expect(opener.getByText("Menu")).toHaveCount(0);
    const openerBox = await opener.boundingBox();
    expect(openerBox?.width).toBeGreaterThanOrEqual(44);
    expect(openerBox?.height).toBeGreaterThanOrEqual(44);
    await j.clickByMouse(".ng-logo", "the mobile drawer icon");
    await expect(page.locator(".ng-explorer")).toBeVisible();
    await j.clickByMouse(".ng-explorer-close", "the panel close button");
    await expect(page.locator(".ng-explorer")).toBeHidden();

    await j.land("Mount Top");

    // v1.133.0: the cue card is retired — on the phone it used to fight the option hand and the
    // transport for the same band (the repo's old STILL OPEN collision). Now nothing mounts.
    await expect(page.locator("[data-challenge-cue]")).toHaveCount(0);
    await expect(page.locator(".ng-tut")).toHaveCount(0);
  });
});

// THE OBJECTIVE ROW'S BUTTON OPENS SOMETHING, OR IS NOT DRAWN (v1.287.0, SET1 slice B). A study / checkpoint / capstone action
// whose belt has no live lesson (here: no curriculum, a 404) used to call `openHomeToLatest`, a method deleted in v1.174.0
// and defined nowhere since: the press threw a TypeError and nothing happened (found by another seat, 16 Nov).
// `_challengeActionTarget` now resolves the action once, for the row and for the press, and such a row draws no button; the
// corridor's repaint when the curriculum lands brings it back. The control: with the curriculum, the same row's button opens
// the belt's next lesson in Master the game (Blue's "Complete three lessons": Study the curriculum).
// Mutant: the old branch back (the button drawn, the press calling `openHomeToLatest`) → red at "no button on a row with
// nothing to open".
test.describe("an objective's action", () => {
  // White's twenty objectives are the tutorial and draw no rows; the corridor draws the SELECTED advanced belt's, so the
  // journeys select Blue by its head card, by mouse
  const BLUE = '.ng-track-card[data-track="blue"]';
  const selectBlue = async (page: any, j: any) => {
    await page.locator(BLUE).scrollIntoViewIfNeeded();
    await j.clickByMouse(BLUE, "the Blue belt");
  };
  test("with nothing to open (a curriculum 404), the row draws no button and nothing throws", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const j = journey(page);
    await j.boot("/", { noCurriculum: true });
    await j.openCorridor({ curriculum: false });
    expect(await page.evaluate(() => { const a = (window as any).__neural; return { curriculum: a.curriculum ?? null, blue: a.beltUnlocked("blue") }; }),
      "premise: no curriculum, and the Blue belt open").toEqual({ curriculum: null, blue: true });
    await selectBlue(page, j);
    for (const id of ["blue.lesson-three", "blue.checkpoint"]) {
      const row = page.locator(`[data-challenge-id="${id}"]`);
      await expect(row, `premise: ${id} is drawn without a curriculum`).toHaveCount(1);
      await expect(row.locator(".ng-challenge-action"), "no button on a row with nothing to open").toHaveCount(0);
    }
    // a row whose action needs no lesson keeps its button ("Start a roll here" closes the drawer onto the map)
    await expect(page.locator('[data-challenge-id="blue.roll-three"] .ng-challenge-action'), "the other rows keep their buttons").toHaveCount(1);
    expect(errors, "no pageerror").toEqual([]);
  });

  // THE CORRIDOR REPAINTS ON NEW EVIDENCE, where it lives (v1.287.0): an objective's count moves on screen while Master the
  // game is open, with no other repaint asked for. Mutant B2 (`noteChallenges`' repaint removed) is red here: until this
  // journey no spec pinned it (the slice B mutant run, 17 Nov).
  test("Master the game's corridor repaints when evidence moves an objective", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.openCorridor();
    await selectBlue(page, j);
    const count = page.locator('[data-challenge-id="blue.roll-three"] small');
    await expect(count, "premise: Blue's \"Finish three complete rolls\" at 0").toHaveText("0 of 3");
    await page.evaluate(() => (window as any).__neural.fx("roll_end", { outcome: "win", moves: 5 }));
    await expect(count, "the corridor's row reads the new count in place").toHaveText("1 of 3");
  });

  test("with the curriculum, Study the curriculum opens the belt's next lesson", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const j = journey(page);
    await j.boot("/");
    await j.openCorridor();
    await selectBlue(page, j);
    const sel = '[data-challenge-id="blue.lesson-three"] .ng-challenge-action';
    await expect(page.locator(sel), "the row's button is drawn when it can open a lesson").toHaveCount(1);
    const next = await page.evaluate(() => (window as any).__neural.challengeFrontier("blue")?.lesson?.deckKey ?? null);
    expect(next, "premise: the Blue belt has a next lesson").toBeTruthy();
    await page.locator(sel).scrollIntoViewIfNeeded();
    await j.clickByMouse(sel, "Study the curriculum");
    await expect(page.locator(`[data-mini-deck="${next}"]`).first(), "the next lesson's deck opens in Master the game").toBeVisible({ timeout: 20_000 });
    expect(errors, "no pageerror").toEqual([]);
  });
});
