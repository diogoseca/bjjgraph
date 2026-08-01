import { expect, test } from "@playwright/test"

test.describe("Forward Components development library", () => {
  test("components expose reusable variants and device frames", async ({ page }) => {
    await page.goto("/dev/components/")

    await expect(page.getByRole("heading", { name: "Brand & explorer trigger" })).toBeVisible()
    await expect(page.locator(".catalog-item")).toHaveCount(46)

    await page.getByRole("button", { name: "Question-first landing card" }).click()
    await page.getByLabel("Preview variant").selectOption({ label: "Compact" })
    await page.getByRole("button", { name: "400", exact: true }).click()

    await expect(page.locator(".device-frame")).toHaveAttribute("data-device", "compact")
    await expect(page.locator(".landing-card")).toHaveAttribute("data-density", "compact")
    await expect(page).toHaveURL(/item=landing-card.*viewport=compact.*variant=Compact/)

    await page.setViewportSize({ width: 600, height: 900 })
    await expect(page.locator(".catalog-sidebar")).toBeHidden()
    await expect(page.locator(".mobile-item-select")).toBeVisible()
    await page.locator(".mobile-item-select").selectOption("dossier-seo")
    await expect(page.getByRole("heading", { name: "Node dossier · SEO / AI" })).toBeVisible()
  })

  test("screens enumerate gameplay states and protect the constrained mobile hand", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    await page.goto("/dev/screens/")
    await expect(page.locator(".catalog-item")).toHaveCount(78)

    await page.getByRole("button", { name: "Stress · screenshot recreation" }).click()
    await expect(page.locator(".device-frame")).toHaveAttribute("data-device", "compact")
    await page.getByLabel("Preview variant").selectOption({ label: "Full detail" })
    await expect(page.locator(".landing-definition")).toBeVisible()
    await page.getByLabel("Preview variant").selectOption({ label: "Priority fit" })

    const fit = await page.locator(".landing-card").evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        bottom: box.bottom,
      }
    })
    const optionTop = await page
      .locator(".option-card")
      .first()
      .evaluate((element) => element.getBoundingClientRect().top)

    expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight)
    expect(fit.bottom).toBeLessThanOrEqual(optionTop)
    await expect(page.locator(".landing-definition")).toBeHidden()
    await expect(page.locator(".film-strip")).toBeHidden()
    await expect(page.locator(".question-block")).toBeVisible()
    await expect(page.locator(".option-card").first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("every registered preview renders without a runtime error", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    for (const route of ["components", "screens"]) {
      await page.goto(`/dev/${route}/`)
      const ids = await page
        .locator(".catalog-item")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("data-id")).filter(Boolean),
        )
      for (const id of ids) {
        await page.locator(`.catalog-item[data-id="${id}"]`).click()
        expect(
          await page.locator(".forward-preview > *").count(),
          `${route}/${id} did not render a preview root`,
        ).toBeGreaterThan(0)
      }
    }

    expect(errors).toEqual([])
  })
})
