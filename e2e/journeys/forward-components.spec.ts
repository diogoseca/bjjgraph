import { expect, test } from "@playwright/test";

test.describe("Forward Components development library", () => {
  test("components expose reusable variants and device frames", async ({
    page,
  }) => {
    await page.goto("/dev/components/");

    await expect(
      page.getByRole("heading", { name: "Brand & explorer trigger" }),
    ).toBeVisible();
    await expect(page.locator(".catalog-item")).toHaveCount(53);

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
    await expect(page.locator(".catalog-sidebar")).toBeHidden();
    await expect(page.locator(".mobile-item-select")).toBeVisible();
    await page.locator(".mobile-item-select").selectOption("dossier-seo");
    await expect(
      page.getByRole("heading", { name: "Node dossier · SEO / AI" }),
    ).toBeVisible();
  });

  test("screens enumerate gameplay states and protect the constrained mobile hand", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dev/screens/");
    await expect(page.locator(".catalog-item")).toHaveCount(102);

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

    await expect(page.locator(".detail-sheet")).toContainText("Waiter Sweep");
    await expect(page.locator(".detail-sheet")).toContainText("DEFENDER");
  });

  test("pane, restart, terminal, and progression compositions are explicit", async ({
    page,
  }) => {
    await page.goto("/dev/screens/");

    await page
      .getByRole("button", { name: "Panes · Belt Path + study" })
      .click();
    await expect(page.locator(".side-panel")).toHaveCount(2);
    await expect(page.locator(".side-panel--left")).toBeVisible();
    await expect(page.getByLabel("Flashcards pane")).toBeVisible();

    await page
      .getByRole("button", { name: "Restart · defense disarmed" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Restart roll" }),
    ).toContainText("Clearing the exchange");
    await expect(page.locator(".panic-card")).toHaveCount(0);
    await expect(page.locator(".vignette")).toHaveCount(0);

    await page
      .getByRole("button", { name: "Game over · study pane preserved" })
      .click();
    await expect(page.locator(".verdict")).toContainText("Match ended");
    await expect(page.getByLabel("Flashcards pane")).toBeVisible();

    await page
      .getByRole("button", { name: "Belt Path · recall-proven" })
      .click();
    await expect(page.locator(".belt-meter")).toBeVisible();
    await expect(
      page.locator(".proof-stripes i[data-filled='true']"),
    ).toHaveCount(4);
    await expect(page.locator(".crown-badge")).not.toHaveCount(0);

    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.getByLabel("Preview node")).toBeVisible();
    await expect(page.getByLabel("Preview role")).toBeVisible();
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
      }
    }

    expect(errors).toEqual([]);
  });
});
