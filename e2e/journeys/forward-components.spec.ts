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

    await page.goto("/dev/screens/");
    await expect(page.locator(".catalog-item")).toHaveCount(113);

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
    await page
      .getByLabel("Preview variant")
      .selectOption({ label: "Priority fit" });

    const fit = await page.locator(".landing-card").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        bottom: box.bottom,
      };
    });
    const optionTop = await page
      .locator(".option-card")
      .first()
      .evaluate((element) => element.getBoundingClientRect().top);

    expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight);
    expect(fit.bottom).toBeLessThanOrEqual(optionTop);
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

    await page
      .getByRole("button", { name: "Account · Flashcards home" })
      .click();
    await expect(page.getByLabel("Flashcards pane")).toBeVisible();
    await expect(page.locator(".ng-account-menu")).toHaveCount(0);

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

    const cueBottom = await page
      .locator(".challenge-cue")
      .evaluate((element) => element.getBoundingClientRect().bottom);
    const optionTop = await page
      .locator(".option-card")
      .first()
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(cueBottom).toBeLessThanOrEqual(optionTop);

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

  test("the dev hub links all four Forward libraries", async ({ page }) => {
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
  });

  test("use cases expose important motion as a playable screen timeline", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/dev/use-cases/");

    await expect(page.locator(".sequence-nav .catalog-item")).toHaveCount(23);
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

    await expect(page.locator(".sequence-nav .catalog-item")).toHaveCount(5);
    await expect(page.locator(".sequence-chapters button")).toHaveCount(5);
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
    await expect(
      page.getByRole("button", { name: /Pause timeline/ }),
    ).toBeVisible();

    const motion = await page
      .locator(".sequence-focus .vignette")
      .evaluate((element) => ({
        duration: getComputedStyle(element).animationDuration,
        name: getComputedStyle(element).animationName,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      }));
    expect(motion.reduced).toBe(true);
    expect(motion.name).toBe("sequence-heartbeat");
    expect(parseFloat(motion.duration)).toBeLessThanOrEqual(0.001);

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Play timeline/ }),
    ).toBeVisible();
    await expect(page.locator(".sequence-position")).toContainText("4 / 7");
  });

  test("all four libraries keep the browsable rail on narrow viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    for (const route of [
      "components",
      "screens",
      "use-cases",
      "user-journeys",
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
