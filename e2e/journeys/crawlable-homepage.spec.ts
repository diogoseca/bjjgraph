import { test, expect } from "@playwright/test"

/**
 * CRAWLABLE HOMEPAGE (v1.80.0).
 *
 * Before the legacy excision, `/` rendered NO article shell at all: renderPage.tsx branched
 * on slug === "index" and emitted a bare `#home-hero` (an h1 + a two-line tagline) instead of
 * `<Body>/#quartz-root/.center/<Content>`. That was survivable only because the legacy chrome
 * filled the page for humans; for a crawler the site root carried ~172 characters of text.
 *
 * Deleting the legacy chrome without fixing that would have left `/` an essentially empty
 * <body> — an SEO catastrophe on the single most valuable route of a 4,600-URL site. So the
 * homepage now renders the same article shell every other page renders, fed by real authored
 * copy in content/index.md.
 *
 * This is a floor, not a snapshot: the copy may be rewritten freely, but the root must never
 * again go thin. `#quartz-root` is asserted because it is the shell whose absence was the
 * original bug — a page can have prose and still be missing the shell, which is how the
 * layout regressed in the first place.
 */

test("the homepage renders the article shell with real crawlable copy", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })

  // the shell itself — its absence was the original defect
  await expect(page.locator("#quartz-root")).toHaveCount(1)
  await expect(page.locator("article").first()).toHaveCount(1)

  const text = (await page.locator("article").first().innerText()).trim()
  expect(
    text.length,
    `homepage <article> has only ${text.length} chars of text — the site root must carry real copy`,
  ).toBeGreaterThanOrEqual(400)

  // …and it must be prose about the actual subject, not boilerplate padding.
  expect(text.toLowerCase()).toContain("jiu-jitsu")
})

test("the homepage exposes crawlable internal links into the graph", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })

  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => h && !/^(https?:)?\/\//.test(h) && !h.startsWith("#") && !h.startsWith("mailto:")),
  )
  const unique = Array.from(new Set(hrefs))
  expect(
    unique.length,
    `homepage has only ${unique.length} internal links: ${JSON.stringify(unique)}`,
  ).toBeGreaterThanOrEqual(6)
})

test("the homepage is readable with JavaScript disabled", async ({ browser }) => {
  // The static-article fallback is the whole point of keeping Quartz as the SSG: a JS-less
  // visitor (or a failed bundle fetch) must still get readable, crawlable prose rather than
  // the dark canvas backdrop.
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const p = await ctx.newPage()
  await p.goto("/", { waitUntil: "domcontentloaded" })

  const text = (await p.locator("article").first().innerText()).trim()
  expect(text.length, "no-JS homepage has no readable article text").toBeGreaterThanOrEqual(400)
  // no-JS never gets data-variant, so the neural hide rule must never have applied
  expect(await p.evaluate(() => document.documentElement.dataset.variant)).toBeUndefined()
  await ctx.close()
})
