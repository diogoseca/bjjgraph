import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * PANE & CHROME POLISH (v1.93.0, re-pinned for the v1.94.0 chrome):
 *
 *   1. EVERY pane-open path wires the tabs. The direct-assign openers (openHomeToLatest —
 *      today the drill pill; formerly the account chip) used to open a pane whose
 *      Explore/Challenges buttons were dead — wiring lived only in openPane(). It now
 *      lives at the choke point (applyDeckVisibility).
 *   2. The stat row + the guest save nudge are ONE block at the pane's BOTTOM, visible on
 *      all three tabs, next to Settings/Terms/Privacy — not mid-History-content.
 *   3. The knowledge header shows no pedagogical filler ("Building foundations" is gone);
 *      the woven belt gains a quiet band line — white→blue→purple→brown→black on the score
 *      axis with your position dotted — and the sub-line is a plain "N% to blue".
 *   4. v1.94.0 RETIRES the "no account menu" canon: the chip now opens `.ng-account-menu`
 *      (account-menu.spec.ts owns that contract) and the PANE opener is the top-left logo.
 *   5. Settings carries Terms · Privacy links (the "Learn More" submenu that never was).
 *   6. The drill pill is QUIET: no infinite pulse, no "Drill to boost your odds" — the
 *      landing card already asks the question. Medal tier + share cue jobs remain.
 *   7. The pane anchors the LEFT edge (v1.94.0 — it opens from the top-left logo, so it
 *      lives on the logo's side). The account chip stays bottom-right and, on desktop, no
 *      longer fades under a pane that no longer covers it; the phone drawer still does.
 *
 * Mouse claims go through clickByMouse (no scroll-into-view, no interception amnesty).
 */

// the direct-assign open path (openHomeToLatest → History): today that is the drill pill
const openViaPill = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.clickByMouse(".ng-drilltab", "the drill pill")
  await expect(page.locator(".ng-drill")).toBeVisible()
}

test("the pill opens History with LIVE tabs — every open path wires the pane", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  await expect(
    page.locator('.ng-learning-nav [data-view="history"]'),
    "the pill lands on History",
  ).toHaveAttribute("aria-pressed", "true")

  // the bug: these two clicks did nothing when the pane's FIRST open came through a
  // direct-assign opener (deckOpen set without openPane)
  await j.clickByMouse('.ng-learning-nav [data-view="challenges"]', "the Challenges tab")
  await expect(page.locator(".ng-challenge-ladder"), "Challenges renders").toBeVisible()
  await expect(
    page.locator('.ng-learning-nav [data-view="challenges"]'),
  ).toHaveAttribute("aria-pressed", "true")

  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(
    page.locator(".ng-explorer-search input"),
    "Explore renders its search",
  ).toBeVisible()
})

test("stats + save nudge are ONE bottom-anchor block, visible on all three tabs", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  const anchor = page.locator(".ng-pane-anchor")
  await expect(anchor).toBeVisible()
  await expect(anchor.locator(".ngStat"), "the stat row moved into the anchor").toHaveCount(3)
  await expect(
    anchor.locator("[data-anchor-auth]"),
    "the guest nudge, in the owner's words",
  ).toContainText("Create an account to save your progress")
  await expect(anchor.locator("[data-anchor-login]"), "with a quieter log in").toContainText(
    "or log in",
  )
  await expect(
    page.locator(".ng-pane-drillhead .ngStat"),
    "and History's head no longer carries stats",
  ).toHaveCount(0)

  // geometry: the block sits at the pane's BOTTOM, above the Settings/Terms/Privacy row
  const g = await page.evaluate(() => {
    const a = document.querySelector(".ng-pane-anchor")!.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    return { anchorTop: a.top, anchorBottom: a.bottom, navBottom: nav.bottom, vh: innerHeight }
  })
  expect(g.anchorTop, "below the tab bar, not mid-content").toBeGreaterThan(g.navBottom + 100)
  expect(g.vh - g.anchorBottom, "hugging the pane's foot").toBeLessThan(90)

  // it supersedes tabs: same block on Challenges and Explore
  await j.clickByMouse('.ng-learning-nav [data-view="challenges"]', "the Challenges tab")
  await expect(anchor, "anchor on Challenges").toBeVisible()
  await expect(anchor.locator("[data-anchor-auth]")).toBeVisible()
  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(anchor, "anchor on Explore").toBeVisible()

  // the quiet line is a real login path
  await j.clickByMouse("[data-anchor-login]", "the or-log-in line")
  await expect(page.locator("body"), "log-in mode, not sign-up").toContainText("Welcome back")
})

test("a study takeover hides the anchor; leaving the study restores it", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)
  await expect(page.locator(".ng-pane-anchor")).toBeVisible()

  // a direct-assign study entry (openStudy) — the same family of paths the wiring fix covers
  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    a.openStudy(key)
  })
  await expect(page.locator(".ng-pane-anchor"), "study owns the pane").toBeHidden()

  await j.clickByMouse("[data-pane-back]", "the study's ‹ Back")
  await expect(page.locator(".ng-pane-anchor"), "tabs mode returns the anchor").toBeVisible()
})

test("knowledge header: no pedagogy — a belt road with five bands and your dot", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  const header = page.locator(".ng-knowledge-header")
  await expect(header).toBeVisible()
  await expect(header, "the filler label is dead").not.toContainText("Building foundations")
  await expect(header, "the meter-philosophy line is dead too").not.toContainText(
    "Proven recall",
  )
  await expect(header, "plain road wording").toContainText("% to white")

  // the band line: pre-white lead-in + the five belt bands, dot at the score
  await expect(page.locator(".ng-belt-road > span")).toHaveCount(6)
  const fresh = await page.evaluate(() => ({
    left: (document.querySelector(".ng-belt-you") as HTMLElement).style.left,
    now: document.querySelector(".ng-knowledge-meter")!.getAttribute("aria-valuenow"),
  }))
  // numeric compare — the style engine normalizes "0.0%" to "0%"
  expect(parseFloat(fresh.left), "the dot IS the score").toBeCloseTo(
    parseFloat(fresh.now!),
    1,
  )

  // a seeded blue profile moves the dot and speaks rank (not pedagogy)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._scoreCache = {
      v: a._stageVer || 0,
      out: { score: 0.5, belt: "blue", next: "purple", stripes: 2 },
    }
    a.renderKnowledgeHeader()
  })
  await expect(header).toContainText("Blue")
  await expect(header).toContainText("50% to purple")
  expect(
    await page.evaluate(
      () => (document.querySelector(".ng-belt-you") as HTMLElement).style.left,
    ),
  ).toBe("50%")
})

test("settings carries Terms · Privacy — the Learn More submenu that never was", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  await j.clickByMouse('.ng-drill [title="Settings"]', "the pane footer gear")
  await expect(page.locator("[data-settings-legal]"), "legal links in the first overlay").toBeVisible()
  await j.clickByMouse('[data-settings-legal] [data-legal="terms"]', "the Terms link")
  await expect(page.locator("body")).toContainText("Terms of Use")
  await expect(page.locator("body"), "the real terms, not a stub").toContainText("Safety first")
})

test("the drill pill is quiet: no infinite pulse, no drill prompt — medal + name only", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const pill = page.locator(".ng-drilltab")
  await expect(pill).toBeVisible()
  expect(
    await pill.evaluate((el) => getComputedStyle(el).animationName),
    "no infinite pulse on the pill",
  ).toBe("none")
  await expect(pill, "no drill-prompt copy").not.toContainText("Drill to boost your odds")
  await expect(pill).not.toContainText("cards to master")
  const txt = (await pill.innerText()).trim()
  expect(txt.length, "it still names the state (medal + family)").toBeGreaterThan(0)

  // and it still opens the pane (its one remaining tap job on desktop)
  await j.clickByMouse(".ng-drilltab", "the quiet pill")
  await expect(page.locator(".ng-drill")).toBeVisible()
})

test("the pane anchors LEFT; the chip stays bottom-right and no longer fades on desktop", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const box = (await page.locator(".ng-acctwrap").boundingBox())!
  const vp = page.viewportSize()!
  expect(box.y + box.height / 2, "chip in the bottom half of the screen").toBeGreaterThan(
    vp.height * 0.8,
  )
  expect(vp.width - (box.x + box.width), "chip hugging the right edge").toBeLessThan(60)

  await j.clickByMouse(".ng-logo", "the logo — the pane opener")
  const pane = (await page.locator(".ng-drill").boundingBox())!
  expect(pane.x, "the pane anchors the LEFT edge").toBeLessThan(2)
  expect(pane.width, "desktop rail").toBeGreaterThanOrEqual(340)
  expect(pane.width).toBeLessThanOrEqual(380)

  // the option tray yields LEFTWARD now — cards keep clear of the pane's side
  let padLeft = 0
  for (let i = 0; i < 30; i++) {
    await j.advance(1000)
    padLeft = await page.evaluate(() =>
      parseFloat((document.querySelector(".ng-optionrow") as HTMLElement).style.paddingLeft || "0"),
    )
    if (padLeft > 300) break
  }
  expect(padLeft, "options padding shifted left of the pane").toBeGreaterThan(300)

  // and the chip does NOT fade: the pane no longer covers its corner on desktop
  const chip = await page.evaluate(() => {
    const el = document.querySelector(".ng-acctwrap") as HTMLElement
    return { o: parseFloat(el.style.opacity || "1"), pe: el.style.pointerEvents }
  })
  expect(chip.o, "chip stays visible beside the left pane").toBeGreaterThan(0.9)
  expect(chip.pe, "and keeps taking clicks").not.toBe("none")
})

test("phone: chip above the thumb-band pill; drawer opens from the LEFT and fades the chip", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const chip = (await page.locator(".ng-acctwrap").boundingBox())!
  const pill = (await page.locator(".ng-drilltab").boundingBox())!
  // v1.81.4 thumb band intact: the pill anchors the band's right seat
  expect(Math.round(844 - (pill.y + pill.height)), "pill bottom gap").toBe(28)
  expect(Math.round(390 - (pill.x + pill.width)), "pill right gap").toBe(14)
  // the chip rides ABOVE the pill, right-aligned, no overlap
  expect(chip.y + chip.height, "chip clears the pill").toBeLessThanOrEqual(pill.y + 1)
  expect(390 - (chip.x + chip.width), "chip on the right edge").toBeLessThan(40)

  // the pill (not the chip — that opens the account menu now) opens the drawer, from the LEFT
  await j.clickByMouse(".ng-drilltab", "the phone drill pill")
  await expect(page.locator(".ng-drill")).toBeVisible()
  const drawer = (await page.locator(".ng-drill").boundingBox())!
  expect(drawer.x, "drawer slides from the LEFT edge").toBeLessThan(2)
  expect(drawer.width, "88vw drawer").toBeGreaterThan(390 * 0.8)
  expect(drawer.width).toBeLessThan(390)
  await expect(page.locator(".ng-pane-anchor [data-anchor-auth]")).toBeVisible()

  // the drawer owns the screen — the chip fades so the dismiss strip stays tappable
  let faded = { o: 1, pe: "auto" }
  for (let i = 0; i < 30; i++) {
    await j.advance(1000)
    faded = await page.evaluate(() => {
      const el = document.querySelector(".ng-acctwrap") as HTMLElement
      return { o: parseFloat(el.style.opacity || "1"), pe: el.style.pointerEvents }
    })
    if (faded.o <= 0.05 && faded.pe === "none") break
  }
  expect(faded.o, "chip fades under the phone drawer").toBeLessThanOrEqual(0.05)
  expect(faded.pe, "and stops taking clicks").toBe("none")
})
