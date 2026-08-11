import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * PANE & CHROME POLISH (v1.93.0, re-pinned for the v1.94.0 chrome):
 *
 *   1. EVERY pane-open path wires the tabs. The direct-assign openers (openHomeToLatest —
 *      today the drill pill; formerly the account chip) used to open a pane whose
 *      Explore/Challenges buttons were dead — wiring lived only in openPane(). It now
 *      lives at the choke point (applyDeckVisibility).
 *   2. The guest save nudge is ONE block at the pane's BOTTOM, visible on all three tabs,
 *      next to Settings/Terms/Privacy. The stat row (mastered/today/weak spots) moved to
 *      the TOP of Explore in v1.95.0 — the weak-spots count is Explore's call to action.
 *   3. The knowledge header shows no pedagogical filler ("Building foundations" is gone);
 *      the woven belt gains a quiet band line — the five bands on the score axis with your
 *      position dotted — and the sub-line is a plain "N% to blue". White is the FLOOR
 *      (v1.95.0): the cold state wears the white belt and roads to blue, never "to white".
 *   3b. Tabs are two-line (v1.95.0): Explore over "N% mastered", Challenges over a mini
 *      belt striped by LADDER progress (not the score), and History is labeled "Last
 *      rolls" (internal ids unchanged).
 *   4. v1.94.0 RETIRES the "no account menu" canon: the chip now opens `.ng-account-menu`
 *      (account-menu.spec.ts owns that contract) and the PANE opener is the top-left logo.
 *   5. Settings carries Terms · Privacy links (the "Learn More" submenu that never was).
 *   6. The drill pill is QUIET: no infinite pulse, no "Drill to boost your odds" — the
 *      landing card already asks the question. Medal tier + share cue jobs remain.
 *   7. The pane anchors the LEFT edge (v1.94.0 — it opens from the top-left logo, so it
 *      lives on the logo's side). The account chip stays bottom-right and, on desktop, no
 *      longer fades under a pane that no longer covers it; the phone drawer still does.
 *   8. THE Z LADDER (v1.95.1): DELIBERATE temporary screens (the settings/legal/auth modal,
 *      the account menu) always render above AMBIENT gameplay overlays (landing card,
 *      coach, combo pop, toasts). The modal portals to the app root at z:95 — the fixed
 *      wrap is its own stacking context, so anything left inside it loses to every
 *      root-level overlay regardless of z. Its scrim takes the input; Esc closes the
 *      topmost deliberate screen first.
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

test("the anchor keeps the guest save nudge; the stat row lives at the top of Explore", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  const anchor = page.locator(".ng-pane-anchor")
  await expect(anchor).toBeVisible()
  await expect(
    anchor.locator("[data-anchor-auth]"),
    "the guest nudge, in the owner's words",
  ).toContainText("Create an account to save your progress")
  await expect(anchor.locator("[data-anchor-login]"), "with a quieter log in").toContainText(
    "or log in",
  )
  // v1.95.0: the stat row moved OUT of the anchor and into Explore's body top — the
  // weak-spots count is a call to action for browsing, not chrome for every tab
  await expect(anchor.locator(".ngStat"), "no stats in the anchor").toHaveCount(0)
  await expect(
    page.locator(".ng-pane-drillhead .ngStat"),
    "and History's head still carries none",
  ).toHaveCount(0)

  // geometry: the nudge still hugs the pane's BOTTOM, above the Settings/Terms/Privacy row
  const g = await page.evaluate(() => {
    const a = document.querySelector(".ng-pane-anchor")!.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    return { anchorTop: a.top, anchorBottom: a.bottom, navBottom: nav.bottom, vh: innerHeight }
  })
  expect(g.anchorTop, "below the tab bar, not mid-content").toBeGreaterThan(g.navBottom + 100)
  expect(g.vh - g.anchorBottom, "hugging the pane's foot").toBeLessThan(90)

  // the nudge survives tab switches: same block on Challenges and Explore
  await j.clickByMouse('.ng-learning-nav [data-view="challenges"]', "the Challenges tab")
  await expect(anchor, "anchor on Challenges").toBeVisible()
  await expect(anchor.locator("[data-anchor-auth]")).toBeVisible()
  await expect(page.locator("[data-explore-stats]"), "no stats row on Challenges").toHaveCount(0)

  // THE STATS ROW RIDES THE TOP OF EXPLORE — "the 30 weak spots are the call to action"
  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(anchor, "anchor on Explore").toBeVisible()
  const stats = page.locator("[data-explore-stats]")
  await expect(stats).toBeVisible()
  await expect(stats.locator(".ngStat")).toHaveCount(3)
  await expect(stats).toContainText("weak spots")
  const s = await page.evaluate(() => {
    const r = document.querySelector("[data-explore-stats]")!.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    return { top: r.top, navBottom: nav.bottom }
  })
  expect(s.top, "at the top of Explore's body, not the foot").toBeLessThan(s.navBottom + 180)

  // the quiet line is a real login path
  await j.clickByMouse("[data-anchor-login]", "the or-log-in line")
  await expect(page.locator("body"), "log-in mode, not sign-up").toContainText("Welcome back")
})

test("tabs carry a title over a plain subtitle: mastered %, ladder belt, Last rolls", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  const nav = page.locator(".ng-learning-nav")
  await expect(nav.locator('[data-view="explore"] > b')).toHaveText("Explore")
  await expect(
    nav.locator('[data-view="explore"] [data-tab-sub]'),
    "Explore's second line is the game knowledge, plainly",
  ).toContainText("% mastered")
  await expect(nav.locator('[data-view="challenges"] > b')).toHaveText("Challenges")
  const tabBelt = nav.locator('[data-view="challenges"] .ng-tab-belt')
  await expect(tabBelt, "Challenges' second line is a belt").toBeVisible()
  // the journey boot completes the white (pinned) track's challenges to skip the first-roll
  // coach — 20 of 20 done IS full ladder progress, so the tab belt wears all four stripes
  await expect(tabBelt, "ladder complete = four stripes").toHaveAttribute(
    "data-tab-stripes",
    "4",
  )
  // "History can be confused with the history of BJJ" — the label is Last rolls now
  // (internal ids and settings keys stay `history`)
  await expect(nav.locator('[data-view="history"] > b')).toHaveText("Last rolls")
  await expect(nav.locator('[data-view="history"] [data-tab-sub]')).toHaveText(
    "Your last rolls",
  )
  expect(await nav.innerText(), "the old tab label is gone").not.toContain("History")

  // THE TWO BELTS ARE DIFFERENT METERS: the tab belt is LADDER progress (challenges
  // completed on the pinned track), NOT gameScore().stripes. Seed a purple score — the
  // header belt turns purple and the Explore subtitle follows it, but the tab belt's
  // stripes do not move (no challenge completion changed).
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._scoreCache = {
      v: a._stageVer || 0,
      out: { score: 0.65, belt: "purple", next: "brown", stripes: 2 },
    }
    a.renderKnowledgeHeader()
  })
  await expect(page.locator(".ng-knowledge-meter")).toHaveAttribute("data-belt", "purple")
  await expect(nav.locator('[data-view="explore"] [data-tab-sub]')).toHaveText("65% mastered")
  await expect(tabBelt, "score moved, ladder did not").toHaveAttribute("data-tab-stripes", "4")

  // and the converse: wipe the challenge ledger — the ladder empties to 0 stripes while
  // the seeded score (and the Explore subtitle reading it) is untouched
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.challenges = {}
    a.renderTabSubtitles()
  })
  await expect(tabBelt, "ladder moved, score did not").toHaveAttribute("data-tab-stripes", "0")
  await expect(nav.locator('[data-view="explore"] [data-tab-sub]')).toHaveText("65% mastered")
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
  // v1.95.0, owner's rule: everybody starts as white — the cold road leads to BLUE
  await expect(header, "plain road wording").toContainText("% to blue")
  await expect(header, "white is the floor, never a target").not.toContainText("to white")

  // the band line: five belt bands (white owns 0→40 — no pre-white lead-in), dot at the score
  await expect(page.locator(".ng-belt-road > span")).toHaveCount(5)
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

// ─────────────────────────────────────────────────────────────────────────────────────
// THE Z LADDER (v1.95.1). Deliberate temporary screens (settings/legal/auth modal,
// account menu) always render above ambient gameplay overlays (landing card, coach,
// combo pop, toasts). Third stacking bug of this family: the modal lived INSIDE the
// fixed wrap — its own stacking context — so the landing card (a root-level overlay at
// z:5) painted over the modal's z:9 and ate its clicks. The fix is structural, not a
// number bump: the modal portals to the app root and takes the deliberate band (95).
// ─────────────────────────────────────────────────────────────────────────────────────

test.describe("deliberate screens outrank ambient overlays", () => {
  const hitReport = (page: Page) =>
    page.evaluate(() => {
      const c = document.querySelector(".ng-landcard") as HTMLElement
      const r = c.getBoundingClientRect()
      const el = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      ) as HTMLElement | null
      return {
        inModal: !!(el && el.closest(".ng-modal")),
        inLandcard: !!(el && el.closest(".ng-landcard")),
        who: el ? `${el.tagName}.${el.className}` : "nothing",
      }
    })

  test("Settings covers the landing card: the card is not hit-testable, the modal is — same for Terms", async ({
    page,
  }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await expect(page.locator(".ng-landcard"), "an ambient overlay is up").toBeVisible()

    // the user's own path: account chip → menu → Settings
    await j.clickByMouse(".ngAcctChip", "the account chip")
    await j.clickByMouse("[data-menu-settings]", "the Settings row")
    await expect(page.locator(".ng-modal"), "the modal is up").toBeVisible()

    let hit = await hitReport(page)
    expect(
      hit.inLandcard,
      `the landing card must not be hit-testable under Settings (elementFromPoint says: ${hit.who})`,
    ).toBe(false)
    expect(hit.inModal, "the point over the card belongs to the modal/scrim").toBe(true)

    // the modal's own controls take the mouse (clickByMouse refuses intercepted clicks)
    await j.clickByMouse('[data-settings-legal] [data-legal="terms"]', "Terms inside Settings")
    await expect(page.locator("body")).toContainText("Terms of Use")
    hit = await hitReport(page)
    expect(hit.inLandcard, "same rule under the Terms screen").toBe(false)
    expect(hit.inModal).toBe(true)
  })

  test("Esc closes the modal first; the pane and its pause latch stay as they were", async ({
    page,
  }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await openViaPill(page, j)
    await expect(page.locator(".ng-drill")).toBeVisible()
    expect(
      await page.evaluate(() => (window as any).__neural.paused),
      "pane law: open = the game stops",
    ).toBe(true)

    await j.clickByMouse('.ng-drill [title="Settings"]', "the pane footer gear")
    await expect(page.locator(".ng-modal")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.locator(".ng-modal"), "Esc takes the topmost screen").toBeHidden()
    await expect(page.locator(".ng-drill"), "the pane under it survives").toBeVisible()
    expect(
      await page.evaluate(() => (window as any).__neural.paused),
      "closing a modal ABOVE the pane must not resume the game the pane stopped",
    ).toBe(true)

    await page.keyboard.press("Escape")
    await expect(page.locator(".ng-drill"), "the next Esc closes the pane (law unchanged)").toBeHidden()
  })
})
