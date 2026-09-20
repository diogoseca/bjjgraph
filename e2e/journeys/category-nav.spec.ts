import { test, expect, type Browser } from "@playwright/test"

/**
 * CATEGORY NAV — the site's only persistent internal link scaffold, and until this file its
 * first-ever assertion. @curated
 *
 * WHY THIS FILE EXISTS.
 *
 * `CategoryNav.tsx` renders the only `<nav>` the static site emits, on every page. It replaced
 * the Explorer, which rendered ~4,600 links into every page (3.7 GB of a 4.7 GB build). Deep
 * navigation moved to Search, the graph and these six category hubs — so these six links ARE
 * the crawlable internal link graph outside each page's own prose.
 *
 * NOTHING GUARDED IT. A repo-wide grep for `CategoryNav|category-nav|sidebar-overlay` across
 * e2e/ tests/ scripts/ .github/ returned exactly THREE lines and all three were comments
 * (static-article-layout.spec.ts:16, check_seo_parity.py:56 and :58). Zero assertions.
 *
 * And the reason is structural, not an oversight: `check_seo_parity.py` extracts from the
 * `<article>`, and this nav is emitted by renderPage.tsx into `#sidebar-overlay`, which is a
 * SIBLING of `#quartz-root` — outside the article, outside every gate. So if the nav stopped
 * being emitted, the site would lose its whole internal link scaffold and every gate would stay
 * green. This spec asserts that structural fact directly (test 1) rather than assuming it, so
 * the reason the nav is ungatable elsewhere is itself pinned here.
 *
 * NOT TO BE CONFUSED WITH THE SEAM GOLDEN. `scripts/seam_golden.py`'s selftest pins "a lost
 * CategoryNav exits 1". That is a MIGRATION instrument: it proves the Quartz replacement did
 * not drop the nav while the replacement is being built. It is not a permanent gate and it goes
 * away with the programme. Reading a green seam as coverage for the nav is exactly CLAUDE.md
 * §6.9's coverage-claim trap. This file is the permanent gate; the seam is not.
 *
 * ── WHY JAVASCRIPT IS DISABLED ──────────────────────────────────────────────────────────
 *
 * This nav's consumers are the crawler, the no-JS visitor and the failed-bundle fallback — the
 * same surface static-article-layout.spec.ts measures, and for the same reason. With JS on, the
 * Neural app owns the screen and the static shell is hidden: measured, `nav.category-nav` is
 * present in the DOM but lays out 0×0, and the page carries TWO `<nav>` elements (the neural
 * app adds its own). Measuring geometry with JS on would therefore assert nothing. With JS off
 * the page carries exactly one `<nav>` and it is this one, 1200×223 at 1440px.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ──────────────────────────────────────
 *
 * ASSERTED: that the nav exists, sits outside `<article>` inside `#sidebar-overlay[data-persist]`,
 * carries the six categories in order, lays out at desktop, is still IN THE HTML at widths where
 * `desktop-only` hides it (a crawler has no viewport — hidden must never become removed), and
 * that all six of its links RESOLVE.
 *
 * NOT ASSERTED — the trailing-slash FORM of the hrefs. `CategoryNav.tsx:24` builds
 * `resolveRelative(slug, cat + "/")`, so the links point at `../Learning/` rather than
 * `../Learning`. Measured against production (D-04): where both `X.html` and `X/index.html`
 * exist — which is the case for all six categories — Cloudflare Pages serves 200 for BOTH
 * forms with no redirect. So the form is not load-bearing and pinning it would redden a
 * correct change. What matters is that the target resolves, which test 3 checks by fetching it.
 *
 * ── WHY EACH TEST EARNS ITS PLACE (mutants in tests/artifacts/_presentation_mutants.sh) ──
 *
 * MEASURED, not predicted. Each mutant declares what must go red AND what must stay green:
 *
 *   M6  the nav element removed from the emitted page       → 1,2,3,4 RED
 *   M7  one category dropped (five links, not six)          → 2,3,4 RED · 1 GREEN
 *   M8  `class="category-nav"` renamed by a replacement     → 1,2,3,4 RED
 *   M9  the six hrefs point at a path that does not exist   → 3 RED · 1,2,4 GREEN
 *   M10 the nav emitted but display:none at desktop         → 1 RED · 2,3,4 GREEN
 *
 * M9 IS WORTH READING BEFORE YOU WRITE A SIMILAR MUTANT. The obvious version — prefixing the
 * existing href with a junk segment — SURVIVED, because the hrefs are `../../../Learning/` and
 * `__gone__/../../../Learning/` normalises straight back to a real page. The mutant has to
 * replace the href, not decorate it. A self-cancelling mutant reads exactly like a missing gate.
 *
 * ── NON-KILLS (CLAUDE.md §6.9) ──────────────────────────────────────────────────────────
 *
 *  1. This spec does NOT assert the nav is REACHABLE BY MOUSE. `locator.click()` is not a mouse
 *     (CLAUDE.md §6.3) and with JS on the nav is 0×0 anyway. The nav's job here is the crawlable
 *     link scaffold, not a clickable control, and that is all this file claims.
 *  2. It runs on four routes, not on all 6,138 pages. It asserts the nav is emitted by the
 *     shared shell, not that no single page has lost it.
 *  3. It says nothing about `#sidebar-overlay`'s OTHER responsibility — being persisted across
 *     SPA navigations by `data-persist` — only that the attribute is emitted.
 */

/** One of each archetype the shell renders, at three URL depths so relative-link resolution
 *  (`../`, `../../`, `../../../`) is exercised rather than assumed. */
const ROUTES = ["/", "/Systems", "/Positions/Mount", "/Positions/Mount/Top"] as const

/** CategoryNav.tsx:9-16, in source order. The order is user-visible and is asserted as a list,
 *  not as a set: a reordering is a real change to the page and should be a deliberate one. */
const CATEGORIES = [
  "Learning",
  "Principles",
  "Positions",
  "Transitions",
  "Submissions",
  "Systems",
] as const

type NavShape = {
  navCount: number
  totalNavs: number
  insideArticle: boolean
  inOverlay: boolean
  overlayPersist: string | null
  overlaySiblingOfRoot: boolean
  cats: string[]
  texts: string[]
  hrefs: string[]
  box: { w: number; h: number } | null
  display: string | null
  /** internal (same-site, non-anchor) links that sit OUTSIDE <article> */
  outsideArticleInternal: string[]
}

/** Read the shape from the real rendered page. Nothing here recomputes what the component
 *  would emit — it reads what it DID emit (CLAUDE.md §6.3). */
async function shapeOf(browser: Browser, route: string, width: number, baseURL: string) {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width, height: 900 },
  })
  const page = await ctx.newPage()
  await page.goto(baseURL + route, { waitUntil: "load" })

  const shape: NavShape = await page.evaluate(() => {
    const nav = document.querySelector("nav.category-nav")
    const article = document.querySelector("article")
    const overlay = document.querySelector("#sidebar-overlay")
    const root = document.querySelector("#quartz-root")
    const links = nav ? Array.from(nav.querySelectorAll("a")) : []
    const r = nav ? nav.getBoundingClientRect() : null
    const isInternal = (h: string | null) => !!h && !/^(https?:|mailto:|tel:|#)/.test(h)
    return {
      navCount: document.querySelectorAll("nav.category-nav").length,
      totalNavs: document.querySelectorAll("nav").length,
      insideArticle: !!(nav && article && article.contains(nav)),
      inOverlay: !!(nav && overlay && overlay.contains(nav)),
      overlayPersist: overlay ? overlay.getAttribute("data-persist") : null,
      overlaySiblingOfRoot: !!(overlay && root && overlay.parentElement === root.parentElement),
      cats: links.map((a) => a.getAttribute("data-cat") ?? ""),
      texts: links.map((a) => (a.textContent ?? "").trim()),
      hrefs: links.map((a) => a.getAttribute("href") ?? ""),
      box: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
      display: nav ? getComputedStyle(nav).display : null,
      outsideArticleInternal: Array.from(document.querySelectorAll("a[href]"))
        .filter((a) => isInternal(a.getAttribute("href")) && !(article && article.contains(a)))
        .map((a) => a.getAttribute("href") ?? ""),
    }
  })

  await ctx.close()
  return shape
}

test("@curated the category nav is emitted, sits outside <article>, and lays out at desktop", async ({
  browser,
  baseURL,
}) => {
  let checked = 0 // POSITIVE COVERAGE COUNT (CLAUDE.md §6.6): zero routes must never read as a pass.

  for (const route of ROUTES) {
    const m = await shapeOf(browser, route, 1440, baseURL!)

    expect(
      m.navCount,
      `${route}: expected exactly one <nav class="category-nav"> — the site's only persistent ` +
        `internal nav. Found ${m.navCount}. If a replacement renamed the wrapper, every gate ` +
        `except this one stays green.`,
    ).toBe(1)

    // With JS off the static shell is the whole page, so this nav is the only <nav> on it.
    expect(m.totalNavs, `${route}: expected one <nav> with JS disabled, found ${m.totalNavs}`).toBe(
      1,
    )

    // THE STRUCTURAL FACT THAT MAKES IT UNGATABLE ELSEWHERE, asserted rather than assumed:
    // check_seo_parity.py extracts from the <article>, so anything outside it is invisible to it.
    expect(
      m.insideArticle,
      `${route}: the nav is INSIDE <article>. That is a real structural change — it moves the ` +
        `nav into check_seo_parity.py's extraction scope and changes every page's article bytes.`,
    ).toBe(false)
    expect(
      m.inOverlay,
      `${route}: the nav is not inside #sidebar-overlay — renderPage.tsx's shell changed shape`,
    ).toBe(true)
    expect(
      m.overlayPersist,
      `${route}: #sidebar-overlay lost data-persist, so the SPA router will re-render it on ` +
        `every navigation instead of keeping it`,
    ).toBe("true")
    expect(
      m.overlaySiblingOfRoot,
      `${route}: #sidebar-overlay is no longer a sibling of #quartz-root. ` +
        `static-article-layout.spec.ts's whole mechanism note depends on this: it is why ` +
        `.sidebar.left never resolves against #quartz-body's grid.`,
    ).toBe(true)

    // LAID OUT, not merely present. A nav that renders into a zero box is not a nav; the loose
    // bounds are deliberate so padding, gutters and shell width stay free to change.
    expect(
      m.display,
      `${route}: the nav computes display:${m.display} at 1440px — desktop-only is hiding it at ` +
        `a width where it must show`,
    ).not.toBe("none")
    expect(
      m.box!.w,
      `${route}: the nav is ${m.box!.w}px wide at 1440px — present but not laid out`,
    ).toBeGreaterThan(100)
    expect(
      m.box!.h,
      `${route}: the nav is ${m.box!.h}px tall at 1440px — present but collapsed`,
    ).toBeGreaterThan(50)

    checked++
  }

  expect(checked, "no route was measured — this test checked nothing and reported clean").toBe(
    ROUTES.length,
  )
})

test("@curated the nav carries all six categories, in order, and they are the page's out-of-article link scaffold", async ({
  browser,
  baseURL,
}) => {
  let checked = 0

  for (const route of ROUTES) {
    const m = await shapeOf(browser, route, 1440, baseURL!)

    // The six, in source order, by the attribute the component writes AND by the visible text.
    // Asserting both is what separates "a link is missing" from "a label is wrong".
    expect(m.cats, `${route}: data-cat list is not the six categories in order`).toEqual([
      ...CATEGORIES,
    ])
    expect(m.texts, `${route}: the nav's visible labels are not the six category names`).toEqual([
      ...CATEGORIES,
    ])

    // THE SCAFFOLD CLAIM, stated as the thing that is actually lost. Every category hub must be
    // linked from every page from OUTSIDE its prose — that is the internal link graph a crawler
    // walks. Asserted per-category rather than as a total count, so adding some future
    // out-of-article link (a logo, a skip-link) does not redden a correct build.
    for (const cat of CATEGORIES) {
      const linked = m.outsideArticleInternal.some((h) => h.replace(/\/$/, "").endsWith(`/${cat}`))
      expect(
        linked,
        `${route}: no link to the ${cat} hub outside <article>. Hrefs found outside the ` +
          `article: ${JSON.stringify(m.outsideArticleInternal)}`,
      ).toBe(true)
    }

    checked++
  }

  expect(checked, "no route was measured — this test checked nothing and reported clean").toBe(
    ROUTES.length,
  )
})

test("@curated every category link resolves from the depth it is rendered at", async ({
  browser,
  baseURL,
  request,
}) => {
  // resolveRelative() produces a DIFFERENT href per URL depth (`../Learning/` from the root,
  // `../../../Learning/` from a role page). A scaffold of six links that 404 is worse than no
  // scaffold, and nothing else in the suite resolves them. This fetches each one for real.
  let fetched = 0

  for (const route of ROUTES) {
    const m = await shapeOf(browser, route, 1440, baseURL!)
    expect(m.hrefs.length, `${route}: no hrefs to resolve`).toBe(CATEGORIES.length)

    for (let i = 0; i < m.hrefs.length; i++) {
      const target = new URL(m.hrefs[i], baseURL + route).toString()
      const res = await request.get(target)
      expect(
        res.status(),
        `${route}: the ${CATEGORIES[i]} link resolves to ${target} which returned ` +
          `${res.status()} — the internal link scaffold points at a page that is not emitted`,
      ).toBe(200)
      fetched++
    }
  }

  expect(
    fetched,
    "no category link was fetched — this test resolved nothing and reported clean",
  ).toBe(ROUTES.length * CATEGORIES.length)
})

test("the nav is still in the HTML at widths where desktop-only hides it", async ({
  browser,
  baseURL,
}) => {
  // HIDDEN IS NOT REMOVED. DesktopOnly wraps CategoryNav with displayClass="desktop-only", and
  // base.scss:111 hides that class at and below the tablet tier — measured: display:none at
  // 1000px and 390px, laid out at 1440px. A crawler has no viewport and reads the markup, so the
  // links must be in the document at every width. A replacement that "optimised" the nav out of
  // the mobile HTML would keep test 1 green and quietly halve the crawlable link graph.
  for (const width of [1000, 390]) {
    const m = await shapeOf(browser, "/Positions/Mount/Top", width, baseURL!)
    expect(
      m.navCount,
      `@${width}px: the nav is absent from the emitted HTML. desktop-only must HIDE it, not ` +
        `remove it — a crawler reads the markup and has no viewport.`,
    ).toBe(1)
    expect(m.cats, `@${width}px: the hidden nav is missing categories`).toEqual([...CATEGORIES])
    expect(
      m.display,
      `@${width}px: the nav computes display:${m.display}; desktop-only is expected to hide it ` +
        `here, and this test exists to prove hiding is all it does`,
    ).toBe("none")
  }
})
