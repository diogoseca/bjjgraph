import { test, expect } from "@playwright/test"

/**
 * STATIC-ARTICLE LAYOUT — the no-JS / crawler / failed-bundle fallback must LAY OUT, not just
 * exist (v1.80.2). @curated
 *
 * WHY THIS FILE EXISTS. The legacy excision (v1.80.0) deliberately kept Quartz as the SSG so
 * every one of ~4,600 URLs still ships a real <article>. crawlable-homepage.spec.ts already
 * gates that the prose is THERE. It is not enough: the excision also deleted three
 * `#quartz-body` grid overrides from custom.scss and only the mobile one came back, so the
 * fallback still rendered — into a ~450px gutter with a 320px void beside it. Present but
 * unreadable passed every gate we had.
 *
 * THE MECHANISM, because an assertion about CSS text would not have caught this. Quartz's
 * stock grids (styles/variables.scss) budget a 320px `grid-sidebar-left` track on tablet and
 * desktop. This site has no left grid column: CategoryNav lives inside `#sidebar-overlay`,
 * emitted by renderPage.tsx as a SIBLING of `#quartz-root`, so `.sidebar.left`'s
 * `grid-area: grid-sidebar-left` never resolves against #quartz-body. The track is reserved
 * and nothing ever fills it.
 *
 * SO THESE TESTS MEASURE GEOMETRY WITH JAVASCRIPT DISABLED. `javaScriptEnabled: false` is
 * load-bearing twice over: it is the surface under test, and it means `html[data-variant]` is
 * never set, so variant.inline.ts's `display:none` hide rule cannot match and the article is
 * the visible page. A width ratio cannot be satisfied by re-adding a rule that happens to be
 * spelled the way the reviewer expected — only by the article actually getting the room.
 *
 * Not a snapshot: the bounds are deliberately loose (fractions, not pixels) so gutters, ToC
 * width and shell max-width stay free to change.
 */

/** The archetype that carried the whole legacy stack, and a hub, and the site root. */
const ROUTES = ["/", "/Positions/Mount/Top", "/Positions/Mount"] as const

/**
 * Load a route and measure it — but only once the stylesheet is provably APPLIED.
 *
 * This guard is the difference between a real gate and a false green, and it was caught by
 * measuring twice and getting different numbers. With JavaScript disabled, `DOMContentLoaded`
 * does not wait for external stylesheets, so a cold-cache load can be measured BEFORE index.css
 * arrives. An unstyled page is a single full-width column — which satisfies every assertion below
 * (ratio ≈ 1.0, inset 0, no horizontal scroll). The broken layout would have passed. Observed:
 * the same route measured `{ratio: 1, shell: 1424, columns: "none"}` cold and
 * `{ratio: 0.7, shell: 1102, columns: "775px 320px"}` warm.
 *
 * So: `waitUntil: "load"` (which does wait for stylesheets), then assert two sentinels that only
 * hold once custom.scss is live — `#quartz-root`'s max-width cap, and `#quartz-body` actually
 * being a grid. If the CSS ever fails to load, these fail loudly instead of quietly passing.
 */
type P = import("@playwright/test").Page

/** Assert the stylesheet is live, then measure. Navigation-free, so a test that has already
 *  driven the page into a particular state (e.g. bundle-failure reveal) can reuse it. */
async function measureStyled(page: P, route: string) {
  const applied = await page.evaluate(() => {
    const qr = document.querySelector("#quartz-root")
    const qb = document.querySelector("#quartz-body")
    return {
      maxWidth: qr ? getComputedStyle(qr).maxWidth : null,
      display: qb ? getComputedStyle(qb).display : null,
    }
  })
  expect(
    applied.maxWidth,
    `${route}: #quartz-root has no max-width — custom.scss is NOT applied, so any geometry ` +
      `measured here is meaningless (an unstyled page trivially satisfies this whole spec)`,
  ).not.toBe("none")
  expect(applied.display, `${route}: #quartz-body is display:${applied.display}, not grid`).toBe(
    "grid",
  )

  return page.evaluate(() => {
    const rect = (sel: string) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, width: r.width, height: r.height }
    }
    const body = document.querySelector("#quartz-body") as HTMLElement | null
    return {
      shell: rect("#quartz-root"),
      article: rect("article"),
      header: rect(".page-header"),
      // The USED track list (px, because it is a live grid container) is the direct evidence:
      // a leading "320px" track means the empty left column is back.
      columns: body ? getComputedStyle(body).gridTemplateColumns : null,
      docScrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }
  })
}

async function load(page: P, route: string) {
  await page.goto(route, { waitUntil: "load" })
  return measureStyled(page, route)
}

/** The reserved-but-empty left track, stated as the track list the bug produced. */
const BUG_TRACKS = /^320px\s/

test("@curated the static article fills its shell with JS disabled (desktop)", async ({
  browser,
}) => {
  // 1440px wide → past the 1200px breakpoint, where the stock 320px|auto|320px grid applied.
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  })
  const p = await ctx.newPage()

  for (const route of ROUTES) {
    const m = await load(p, route)

    expect(m.shell, `${route}: #quartz-root missing — no static shell to lay out`).not.toBeNull()
    expect(m.article, `${route}: no <article> rendered`).not.toBeNull()

    // THE REGRESSION ASSERTION. Article + a 320px ToC share a 1100px shell, so the article must
    // hold well over half of it. Measured: 0.29 broken, 0.70 fixed (775px of a 1102px shell on a
    // route with a ToC; 1.0 where the ToC is empty and its track collapses).
    const ratio = m.article!.width / m.shell!.width
    expect(
      ratio,
      `${route}: <article> is ${Math.round(m.article!.width)}px inside a ${Math.round(
        m.shell!.width,
      )}px shell (${ratio.toFixed(2)}) — an empty grid column is eating the page. ` +
        `grid-template-columns: ${m.columns}`,
    ).toBeGreaterThan(0.55)

    // The track list itself, asserted directly — the leading 320px track IS the bug.
    expect(
      m.columns,
      `${route}: grid-template-columns is "${m.columns}" — a leading 320px track is the ` +
        `reserved-but-empty grid-sidebar-left column`,
    ).not.toMatch(BUG_TRACKS)

    // No empty track ahead of the content: the article must start at the shell's left edge
    // (plus its own gutter), not 320px into it.
    const inset = m.article!.x - m.shell!.x
    expect(
      inset,
      `${route}: <article> starts ${Math.round(inset)}px inside the shell — that is the ` +
        `reserved-but-empty grid-sidebar-left track, not a gutter`,
    ).toBeLessThan(120)

    // The title and the body must share one left edge; they sit in different grid areas, so a
    // broken track list pulls them apart even when each is individually plausible.
    if (m.header) {
      expect(
        Math.abs(m.header.x - m.article!.x),
        `${route}: .page-header and <article> disagree on the left edge by ` +
          `${Math.round(Math.abs(m.header.x - m.article!.x))}px`,
      ).toBeLessThan(4)
    }

    // Real content, not a collapsed box.
    expect(m.article!.height, `${route}: <article> is ${m.article!.height}px tall`).toBeGreaterThan(
      200,
    )

    // And the page must not scroll sideways.
    expect(
      m.docScrollWidth,
      `${route}: document scrolls horizontally (${m.docScrollWidth}px > ${m.viewport}px)`,
    ).toBeLessThanOrEqual(m.viewport + 1)
  }

  await ctx.close()
})

test("the static article fills its shell with JS disabled (tablet + mobile)", async ({
  browser,
}) => {
  // 1000px is the tablet tier (801–1200px) where the ToC is display:none, and 390px is mobile.
  // Both were separate overrides; the tablet one was also lost in the excision.
  for (const width of [1000, 390]) {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    })
    const p = await ctx.newPage()
    const m = await load(p, "/Positions/Mount/Top")

    // No sidebar renders at these widths, so the article owns nearly the whole shell.
    const ratio = m.article!.width / m.shell!.width
    expect(
      ratio,
      `@${width}px: <article> is ${Math.round(m.article!.width)}px of a ${Math.round(
        m.shell!.width,
      )}px shell (${ratio.toFixed(2)}) — grid-template-columns: ${m.columns}`,
    ).toBeGreaterThan(0.8)

    expect(
      m.docScrollWidth,
      `@${width}px: document scrolls horizontally (${m.docScrollWidth}px > ${width}px)`,
    ).toBeLessThanOrEqual(width + 1)

    await ctx.close()
  }
})

test("a failed Neural bundle fetch reveals a correctly laid-out article", async ({ browser }) => {
  // The third consumer of this surface, and the one a crawler test cannot cover: JS runs, the
  // bundle 404s, variant.inline.ts calls revealStaticArticle() and clears `data-variant`. The
  // article becomes the page — with the same layout obligation. Blocking the bundle rather
  // than disabling JS is what makes this distinct from the tests above.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const p = await ctx.newPage()
  await p.route("**/static/neural/app/neural.js", (r) => r.abort())

  await p.goto("/Positions/Mount/Top", { waitUntil: "load" })
  // wait for the loader to give up and un-hide the article
  await expect(p.locator("article").first()).toBeVisible({ timeout: 30_000 })
  expect(await p.evaluate(() => document.documentElement.dataset.variant)).toBeUndefined()

  const m = await measureStyled(p, "/Positions/Mount/Top (bundle aborted)")
  const ratio = m.article!.width / m.shell!.width
  expect(
    ratio,
    `bundle-failure fallback: <article> is ${ratio.toFixed(2)} of the shell — ` +
      `grid-template-columns: ${m.columns}`,
  ).toBeGreaterThan(0.55)

  await ctx.close()
})
