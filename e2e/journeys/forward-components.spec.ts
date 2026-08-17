import { expect, test } from "@playwright/test";

test.describe("Forward Components development library @curated", () => {
  test("components expose reusable variants and device frames", async ({
    page,
  }) => {
    await page.goto("/dev/components/");

    await expect(
      page.getByRole("heading", { name: "Brand & explorer trigger" }),
    ).toBeVisible();
    await expect(page.locator(".catalog-item")).toHaveCount(60);

    await page
      .getByRole("button", { name: "Question-first landing card" })
      .click();
    await page.getByLabel("Preview variant").selectOption({ label: "Compact" });
    await page.getByRole("button", { name: "400", exact: true }).click();

    await expect(page.locator(".device-frame")).toHaveAttribute(
      "data-device",
      "compact",
    );
    await expect(page.locator(".landing-card")).toHaveAttribute(
      "data-density",
      "compact",
    );
    await expect(page).toHaveURL(
      /item=landing-card.*viewport=compact.*variant=Compact/,
    );

    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.locator(".catalog-sidebar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator(".mobile-item-select")).toHaveCount(0);
    await page.getByRole("button", { name: /Browse components/ }).click();
    await expect(page.locator(".catalog-sidebar")).toHaveAttribute(
      "data-open",
      "true",
    );
    await page
      .getByRole("button", { name: "Node dossier · SEO / AI output only" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Node dossier · SEO / AI output only",
      }),
    ).toBeVisible();
    await expect(page.locator(".catalog-sidebar")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  test("screens enumerate gameplay states and protect the constrained mobile hand", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Reduced motion BEFORE navigation: the catalog scrolls the preview into view with
    // scrollIntoView({behavior:"smooth"}), and this test used to read the card's bottom
    // and the hand's top in TWO round-trips — straddling that live scroll. One CI run
    // failed by exactly 11.0000px (an integer scrollTop) for that reason alone.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/screens/");
    await expect(page.locator(".catalog-item")).toHaveCount(114); // +1: Account · menu (signed in), v1.94.0

    await page
      .getByRole("button", { name: "Stress · screenshot recreation" })
      .click();
    await expect(page.locator(".device-frame")).toHaveAttribute(
      "data-device",
      "compact",
    );
    await page
      .getByLabel("Preview variant")
      .selectOption({ label: "Full detail" });
    await expect(page.locator(".landing-definition")).toBeVisible();
    // The fit POLICY is only meaningfully tested if the full variant actually overflows:
    // both geometry edges are CSS constants shared by both variants and the card is
    // bottom-anchored, so `scrollHeight <= clientHeight` is the one assertion below that
    // can tell them apart. Measured here: 425 vs 295 (overflows) -> 241 vs 241 (fits).
    const full = await page
      .locator(".landing-card")
      .evaluate((el) => ({ s: el.scrollHeight, c: el.clientHeight }));
    expect(
      full.s,
      "Full detail must overflow, else the Priority fit assertion proves nothing",
    ).toBeGreaterThan(full.c);
    await page
      .getByLabel("Preview variant")
      .selectOption({ label: "Priority fit" });
    await page.evaluate(() => document.fonts.ready);

    // ONE round-trip => ONE layout flush. Page scroll, the device-frame scale() and any
    // sizeFrame() rAF are common-mode to all three rects and cancel in the difference.
    // The gap is reported in AUTHORED CSS px (frame scale divided out) so the threshold
    // is a design number, not a viewport artefact.
    //
    // Wait for the elements AND the frame transform first: a raw page.evaluate has none of
    // a locator's implicit auto-waiting, and reading pre-transform yields nonsense.
    await expect(page.locator(".landing-card")).toBeVisible();
    await expect(page.locator(".option-card").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = document.querySelector(".game-stage") as HTMLElement | null;
          return el ? el.getBoundingClientRect().height / el.offsetHeight : 0;
        }),
      )
      .toBeLessThan(1);
    const geo = await page.evaluate(() => {
      const stage = document.querySelector(".game-stage") as HTMLElement;
      const card = document.querySelector(".landing-card") as HTMLElement;
      const opt = document.querySelector(".option-card") as HTMLElement;
      const s = stage.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const o = opt.getBoundingClientRect();
      const scale = s.height / stage.offsetHeight; // device-frame scale(): 680/875
      return {
        scale,
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
        gapCss: (o.top - c.bottom) / scale,
      };
    });
    expect(geo.scrollHeight).toBeLessThanOrEqual(geo.clientHeight);
    // The hand must keep real slack, not merely touch. --ng-hand-gap is the design
    // margin; fail if a regression erodes it past 8 authored px.
    expect(
      geo.gapCss,
      `landing card vs option hand gap in authored CSS px (frame scale ${geo.scale.toFixed(4)})`,
    ).toBeGreaterThanOrEqual(8);
    await expect(page.locator(".landing-definition")).toBeHidden();
    await expect(page.locator(".film-strip")).toBeHidden();
    await expect(page.locator(".question-block")).toBeVisible();
    await expect(page.locator(".option-card").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("node and role controls drive position, transition, and submission previews", async ({
    page,
  }) => {
    await page.goto(
      "/dev/screens/#item=land-met&viewport=responsive&variant=Default",
    );

    await page.getByLabel("Preview node").selectOption("position:mount");
    await page.getByLabel("Preview role").selectOption("top");
    await expect(page.locator(".landing-identity")).toContainText("Mount");
    await expect(page.locator(".landing-identity")).toContainText("Top");

    await page.getByLabel("Preview role").selectOption("bottom");
    await expect(page.locator(".landing-identity")).toContainText("Bottom");

    await page
      .getByLabel("Preview node")
      .selectOption("transition:waiter-sweep");
    await page.getByLabel("Preview role").selectOption("attacker");
    await expect(page.locator(".landing-identity")).toContainText(
      "Waiter Sweep",
    );
    await expect(page.locator(".landing-identity")).toContainText("Attacker");
    await page.getByLabel("Preview role").selectOption("defender");
    await expect(page.locator(".landing-identity")).toContainText("Defender");

    await page
      .getByLabel("Preview node")
      .selectOption("submission:rear-naked-choke-from-back-control");
    await page.getByLabel("Preview role").selectOption("attacker");
    await expect(page.locator(".landing-identity")).toContainText(
      "Rear Naked Choke from Back Control",
    );
    await expect(page.locator(".landing-identity")).toContainText("Attacker");

    const hash = new URL(page.url()).hash;
    expect(hash).toContain(
      "entity=submission%3Arear-naked-choke-from-back-control",
    );
    expect(hash).toContain("role=attacker");
    await page.reload();
    await expect(page.getByLabel("Preview node")).toHaveValue(
      "submission:rear-naked-choke-from-back-control",
    );
    await expect(page.getByLabel("Preview role")).toHaveValue("attacker");
  });

  test("curated selector fallbacks remain usable when generated graph fixtures fail", async ({
    page,
  }) => {
    await page.route("**/shared/entities.json", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.goto("/dev/components/#item=dossier-expanded");
    await page
      .getByLabel("Preview node")
      .selectOption("transition:waiter-sweep");
    await page.getByLabel("Preview role").selectOption("defender");

    await expect(page.locator(".ng-dossier")).toContainText("Waiter Sweep");
    await expect(page.locator(".ng-dossier")).toContainText("Defender");
  });

  test("pane, restart, terminal, and progression compositions are explicit", async ({
    page,
  }) => {
    await page.goto("/dev/screens/");

    await page
      .getByRole("button", { name: "Panes · Challenges + study" })
      .click();
    await expect(page.locator(".side-panel")).toHaveCount(2);
    await expect(page.locator(".side-panel--left")).toBeVisible();
    await expect(page.getByLabel("Flashcards pane")).toBeVisible();

    await page
      .getByRole("button", { name: "Restart · defense disarmed" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".restart-card")).toContainText(
      "Restarting the roll",
    );
    await expect(page.locator(".panic-card")).toHaveCount(0);
    await expect(page.locator(".vignette")).toHaveCount(0);

    await page
      .getByRole("button", { name: "Game over · study pane preserved" })
      .click();
    await expect(page.locator(".verdict")).toContainText("Match ended");
    await expect(page.getByLabel("Flashcards pane")).toBeVisible();

    await page
      .getByRole("button", { name: "Challenges · track cleared" })
      .click();
    await expect(page.locator(".knowledge-meter")).toBeVisible();
    await expect(page.locator(".track-card")).toHaveCount(5);
    await expect(
      page.locator(".track-card[data-complete='true']"),
    ).toHaveCount(1);
    await expect(page.locator(".track-card:disabled")).toHaveCount(0);

    // v1.94.0 retired the "no account menu" canon: the chip opens a compact menu now.
    // Guest: create/login above ONE separator; settings, shortcuts, legal below — no filler.
    await page.getByRole("button", { name: "Account · menu (guest)" }).click();
    await expect(page.locator(".ng-account-menu")).toHaveCount(1);
    await expect(page.locator(".ngAcctChip")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      page.locator(".ng-account-menu [data-menu-create]"),
    ).toContainText("Create account");
    await expect(
      page.locator(".ng-account-menu [data-menu-login]"),
    ).toContainText("Log in");
    await expect(page.locator(".ng-account-menu [data-menu-sep]")).toHaveCount(
      1,
    );
    await expect(
      page.locator(".ng-account-menu [data-menu-shortcuts]"),
    ).toContainText("Keyboard shortcuts");
    await expect(
      page.locator(".ng-account-menu [data-menu-privacy]"),
    ).toContainText("Privacy");
    await expect(
      page.locator(".ng-account-menu [data-menu-email]"),
      "guest menu carries no identity row",
    ).toHaveCount(0);
    // the menu is chrome: the mock roll is NOT paused under it
    await expect(page.locator(".paused-chip")).toHaveCount(0);

    // Signed in: the auth rows become email (non-interactive) + Log out.
    await page
      .getByRole("button", { name: "Account · menu (signed in)" })
      .click();
    await expect(
      page.locator(".ng-account-menu [data-menu-email]"),
    ).toBeVisible();
    await expect(
      page.locator(".ng-account-menu [data-menu-logout]"),
    ).toContainText("Log out");
    await expect(
      page.locator(".ng-account-menu [data-menu-create]"),
    ).toHaveCount(0);
    await expect(page.locator(".ng-account-menu [data-menu-sep]")).toHaveCount(
      1,
    );

    await page
      .getByRole("button", { name: "Progress · tested demotion" })
      .click();
    await expect(page.locator(".ng-explorer [data-score-row]")).toBeVisible();
    await expect(page.locator(".progress-center")).toHaveCount(0);

    await page.getByRole("button", { name: "Dossier · expanded" }).click();
    await page
      .getByLabel("Preview node")
      .selectOption("transition:waiter-sweep");
    await expect(page.locator(".ng-dossier")).toHaveAttribute(
      "data-dossier-shape",
      "transition",
    );

    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.getByLabel("Preview node")).toBeVisible();
    await expect(page.getByLabel("Preview role")).toBeVisible();
  });

  test("challenge tracks stay open and rewards remain acknowledgements", async ({
    page,
  }) => {
    await page.goto(
      "/dev/screens/#item=challenges-above-level&viewport=responsive&variant=Default",
    );

    await expect(page.locator(".knowledge-header")).toContainText(
      "YOUR GAME KNOWLEDGE",
    );
    await expect(page.locator(".knowledge-header")).toContainText("28%");
    await expect(page.locator(".track-card")).toHaveCount(5);
    await expect(page.locator(".track-card:disabled")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /Black Breadth content track, 0 of 6 complete/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".challenge-distinction")).toContainText(
      "Tracks label the material",
    );
    await expect(page.locator(".track-card[data-track='black']")).toContainText(
      "Advanced material - swing away.",
    );

    await page.locator(".learning-nav button").first().focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(".learning-nav button").nth(1)).toBeFocused();

    await page
      .getByRole("button", { name: "Collection · earned and available" })
      .click();
    await expect(page.getByLabel("Collection")).toContainText(
      "Mat Coins are just for laughs. They do not buy anything.",
    );
    await expect(
      page.locator(".patch-badge[data-earned='false']").first(),
    ).toContainText("Available to earn");

    await page
      .getByRole("button", { name: "Challenge migration · 7 of 20" })
      .click();
    await expect(
      page.getByRole("button", { name: /Open pinned White challenge/ }),
    ).toContainText("7/20");
    await expect(page.locator(".event-toast")).toContainText(
      "Tutorial is now White Challenges",
    );
  });

  test("mobile challenge cue clears the option hand and rewards honor reduced motion", async ({
    page,
  }) => {
    await page.goto(
      "/dev/screens/#item=challenge-mobile-collision&viewport=compact&variant=Default",
    );

    // Same bug class as the landing-card gap above: two rects read in two round-trips can
    // straddle a layout change, and this one has NO tolerance at all. It has never flaked
    // only because it navigates by URL hash (no scrollIntoView runs). Measure atomically
    // and normalise out the device-frame scale so the threshold is authored CSS px.
    //
    // The visibility waits are load-bearing: a raw page.evaluate has none of the implicit
    // auto-waiting a locator gives, so without them the read can land before sizeFrame()
    // has applied the frame transform — observed as scale=1.0 and a -100px "gap".
    await expect(page.locator(".challenge-cue")).toBeVisible();
    await expect(page.locator(".option-card").first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const el = document.querySelector(".game-stage") as HTMLElement | null;
          return el ? el.getBoundingClientRect().height / el.offsetHeight : 0;
        }),
      )
      .toBeLessThan(1); // frame transform applied
    const cue = await page.evaluate(() => {
      const stage = document.querySelector(".game-stage") as HTMLElement;
      const cueEl = document.querySelector(".challenge-cue") as HTMLElement;
      const opt = document.querySelector(".option-card") as HTMLElement;
      const s = stage.getBoundingClientRect();
      const scale = s.height / stage.offsetHeight;
      return {
        scale,
        gapCss:
          (opt.getBoundingClientRect().top - cueEl.getBoundingClientRect().bottom) / scale,
      };
    });
    expect(
      cue.gapCss,
      `challenge cue vs option hand gap in authored CSS px (frame scale ${cue.scale.toFixed(4)})`,
    ).toBeGreaterThanOrEqual(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("button", { name: "Reward · reduced motion" })
      .click();
    const motion = await page.locator(".reward-toast").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animation: style.animationName,
        transition: style.transitionDuration,
      };
    });
    expect(motion.animation).toBe("none");
    expect(Number.parseFloat(motion.transition)).toBeLessThanOrEqual(0.00001);
    await expect(page.locator(".reward-toast")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  test("the dev hub links all four libraries and the production sound lab", async ({
    page,
  }) => {
    await page.goto("/dev/");

    await expect(
      page.getByRole("heading", { name: /From one control/ }),
    ).toBeVisible();
    await expect(page.locator(".hub-card")).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: /Components/ }),
    ).toHaveAttribute("href", "/dev/components/");
    await expect(page.getByRole("link", { name: /Screens/ })).toHaveAttribute(
      "href",
      "/dev/screens/",
    );
    await expect(page.getByRole("link", { name: /Use Cases/ })).toHaveAttribute(
      "href",
      "/dev/use-cases/",
    );
    await expect(
      page.getByRole("link", { name: /User Journeys/ }),
    ).toHaveAttribute("href", "/dev/user-journeys/");
    await expect(
      page.getByRole("link", { name: /Neural Sound Lab/ }),
    ).toHaveAttribute("href", "/dev/sounds/");
  });

  test("the sound lab catalogs, filters, and previews the production palette", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dev/sounds/");

    await expect(
      page.getByRole("heading", { name: /Electric current/ }),
    ).toBeVisible();
    const cues = page.locator(".sound-cue");
    expect(await cues.count()).toBeGreaterThanOrEqual(40);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    await expect(page.locator(".catalog-routes a")).toHaveCount(5);

    const payload = await page.evaluate(() =>
      fetch("./sound-catalog.json").then((response) => response.json()),
    );
    expect(payload.cues.length).toBe(await cues.count());

    const search = page.getByLabel("Filter sounds");
    await search.fill("star-jump victory");
    await expect(cues).toHaveCount(1);
    await search.fill("");

    await page
      .getByRole("button", { name: "Preview Star-jump victory" })
      .click();
    await expect(page.locator('[data-beat="victory_cascade"]')).toHaveAttribute(
      "data-playing",
      "",
    );
    await expect(page.getByRole("status")).toContainText("Transmitting");
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("status")).toContainText("Playback stopped");
    expect(errors).toEqual([]);
  });

  test("use cases expose important motion as a playable screen timeline", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dev/use-cases/");

    // +15 (v1.106): the cold start, the one pane and its tabs/study takeover, the
    // opponent turn, the JIT drill, the knowledge arc, MC-to-recall, the ignored
    // question, advanced browsing, the returner, the keyboard, gi/no-gi, guest-to-
    // account, and the three sharing use cases.
    await expect(page.locator(".sequence-nav .catalog-item")).toHaveCount(38);
    await page
      .getByRole("button", { name: /Gameplay animation timepoints/ })
      .click();
    await expect(page.locator(".sequence-frame")).toHaveCount(15);
    expect(
      await page
        .locator(".sequence-frame .game-stage")
        .evaluateAll(
          (stages) =>
            new Set(stages.map((stage) => stage.getAttribute("data-motion")))
              .size,
        ),
    ).toBeGreaterThan(10);

    await page
      .getByLabel("Preview node")
      .selectOption("transition:waiter-sweep");
    await page.getByLabel("Preview role").selectOption("defender");
    await page.getByLabel("Preview viewport").selectOption("compact");
    await page.getByLabel("Playback speed").selectOption("2");
    await expect(page.locator(".sequence-device")).toHaveAttribute(
      "data-device",
      "compact",
    );
    await expect(page).toHaveURL(/speed=2/);

    await page
      .getByRole("button", { name: /Question-first landing reveal/ })
      .click();
    await page.getByRole("button", { name: "Show Question appears" }).click();
    await expect(
      page.locator(".sequence-focus .landing-identity"),
    ).toContainText("Waiter Sweep");
    await expect(
      page.locator(".sequence-focus .landing-identity"),
    ).toContainText("Defender");
    await expect(page.locator("button button")).toHaveCount(0);
    await expect(page.locator(".sequence-frame > .detail-sheet")).toHaveCount(
      0,
    );
    await expect(
      page.locator(".sequence-frame-visual:not([inert])"),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const before = await page.locator(".sequence-position").textContent();
    await page.getByRole("button", { name: /Play timeline/ }).click();
    await page.waitForTimeout(450);
    const after = await page.locator(".sequence-position").textContent();
    expect(after).not.toBe(before);

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".sequence-position")).toContainText("5 / 6");
    await page.reload();
    await expect(page.getByLabel("Preview node")).toHaveValue(
      "transition:waiter-sweep",
    );
    await expect(page.getByLabel("Preview role")).toHaveValue("defender");
    await expect(page.getByLabel("Preview viewport")).toHaveValue("compact");
    await expect(page.getByLabel("Playback speed")).toHaveValue("2");
    await expect(page.locator(".sequence-position")).toContainText("5 / 6");
    expect(errors).toEqual([]);
  });

  test("user journeys compose chapters and preserve configuration", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dev/user-journeys/");

    // +14 (v1.106): the approved catalog expansion — A1-A9, B1, B2, B3, B5, B6, B7.
    // B4 (Systems to affiliate purchase) is owner-deferred, not dropped.
    await expect(page.locator(".sequence-nav .catalog-item")).toHaveCount(19);
    // first-roll gained the opponent-turn chapter (J1 repair): it was "two moves and
    // a win", with no opponent ever taking a turn in it.
    await expect(page.locator(".sequence-chapters button")).toHaveCount(6);
    expect(await page.locator(".sequence-frame").count()).toBeGreaterThan(25);

    await page
      .getByRole("button", { name: /Bad roll, defeat, and recovery/ })
      .click();
    await expect(page.locator(".sequence-chapters button")).toHaveCount(4);
    await page.locator(".sequence-chapters button").nth(2).click();
    await expect(page.locator(".sequence-caption")).toContainText(
      "Reach game over",
    );

    await page
      .getByLabel("Preview node")
      .selectOption("submission:rear-naked-choke-from-back-control");
    await page.getByLabel("Preview role").selectOption("attacker");
    await page.getByLabel("Preview viewport").selectOption("phone");
    await expect(page).toHaveURL(
      /entity=submission%3Arear-naked-choke-from-back-control/,
    );
    await expect(page).toHaveURL(/role=attacker/);

    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.getByLabel("Preview user journey")).toHaveCount(0);
    await page.getByRole("button", { name: /Browse User journeys/ }).click();
    await page
      .getByRole("button", { name: /Study to challenge capstone/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Study to challenge capstone" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("every use case and user journey renders all timeline frames", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    for (const route of ["use-cases", "user-journeys"]) {
      await page.goto(`/dev/${route}/`);
      const ids = await page
        .locator(".sequence-nav .catalog-item")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => button.getAttribute("data-id"))
            .filter(Boolean),
        );
      for (const id of ids) {
        await page
          .locator(`.sequence-nav .catalog-item[data-id="${id}"]`)
          .click();
        expect(
          await page.locator(".sequence-frame .game-stage").count(),
          `${route}/${id} rendered no timeline screens`,
        ).toBeGreaterThan(0);
        await expect(page.locator(".sequence-focus .game-stage")).toBeVisible();
      }
    }

    expect(errors).toEqual([]);
  });

  test("undashed timeline aliases redirect to canonical routes", async ({
    page,
  }) => {
    await page.goto(
      "/dev/usecases/#item=animation-reel&viewport=compact&step=3&speed=0.5",
    );
    await expect(page).toHaveURL(/\/dev\/use-cases\//);
    await expect(page).toHaveURL(/item=animation-reel/);
    await expect(page).toHaveURL(/step=3/);
    await expect(page).toHaveURL(/speed=0.5/);
    await page.goto(
      "/dev/userjourneys/#item=expert-momentum&viewport=phone&step=2",
    );
    await expect(page).toHaveURL(/\/dev\/user-journeys\//);
    await expect(page).toHaveURL(/item=expert-momentum/);
    await expect(page).toHaveURL(/step=2/);
  });

  test("timeline shortcuts respect forms, reduced motion, and Escape", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/dev/use-cases/#item=defense-panic&viewport=desktop&entity=position%3Adeep-half-guard&role=top&step=3&speed=0.5",
    );
    await expect(page.getByLabel("Playback speed")).toHaveValue("0.5");

    const search = page.getByLabel("Filter use cases");
    await search.fill("panic");
    await search.press("Space");
    await expect(search).toHaveValue("panic ");
    await expect(
      page.getByRole("button", { name: /Play timeline/ }),
    ).toBeVisible();

    await search.blur();
    await page.getByRole("button", { name: /Play timeline/ }).click();

    // Measure the playing step's animation IMMEDIATELY after Play: the heartbeat step lasts
    // (240*2)/0.5 = 960ms of playback, and a polling expect in between (Pause-button, below)
    // can eat that whole window on a loaded runner — the timeline advances to "card-enter"
    // and the vignette honestly reports animation "none". Same assertions, race removed.
    const motion = await page
      .locator(".sequence-focus .vignette")
      .evaluate((element) => ({
        duration: getComputedStyle(element).animationDuration,
        name: getComputedStyle(element).animationName,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      }));
    await expect(
      page.getByRole("button", { name: /Pause timeline/ }),
    ).toBeVisible();
    expect(motion.reduced).toBe(true);
    expect(motion.name).toBe("sequence-heartbeat");
    expect(parseFloat(motion.duration)).toBeLessThanOrEqual(0.001);

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Play timeline/ }),
    ).toBeVisible();
    await expect(page.locator(".sequence-position")).toContainText("4 / 7");
  });

  test("all development routes keep the browsable rail on narrow viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    for (const route of [
      "components",
      "screens",
      "use-cases",
      "user-journeys",
      "sounds",
    ]) {
      await page.goto(`/dev/${route}/`);
      const rail = page.locator("#catalog-rail");
      const toggle = page.locator(".catalog-rail-toggle");
      await expect(rail).toHaveCount(1);
      await expect(rail).toHaveAttribute("aria-hidden", "true");
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(rail).toHaveAttribute("data-open", "true");
      expect(await rail.locator(".catalog-item").count()).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(rail).toHaveAttribute("data-open", "false");
      await expect(toggle).toBeFocused();
    }
  });

  test("every registered preview renders without a runtime error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    for (const route of ["components", "screens"]) {
      await page.goto(`/dev/${route}/`);
      const ids = await page
        .locator(".catalog-item")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => button.getAttribute("data-id"))
            .filter(Boolean),
        );
      for (const id of ids) {
        await page.locator(`.catalog-item[data-id="${id}"]`).click();
        expect(
          await page.locator(".forward-preview > *").count(),
          `${route}/${id} did not render a preview root`,
        ).toBeGreaterThan(0);
        await expect(page.locator(".production-provenance")).toHaveAttribute(
          "data-production-classification",
          /runtime|output-only/,
        );
      }
    }

    expect(errors).toEqual([]);
  });
});
