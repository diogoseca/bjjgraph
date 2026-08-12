import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * PANE & CHROME POLISH (v1.93.0, re-pinned for the v1.94.0 chrome):
 *
 *   1. EVERY pane-open path wires the tabs. The direct-assign openers (openHomeToLatest —
 *      today the landing card's familiarity chip; formerly the drill pill and the account
 *      chip) used to open a pane whose Explore/Challenges buttons were dead — wiring lived
 *      only in openPane(). It now lives at the choke point (applyDeckVisibility).
 *   2. The guest save nudge is ONE block at the pane's BOTTOM, visible on all three tabs,
 *      next to Settings/Terms/Privacy. The stat row (mastered/today/weak spots) moved to
 *      the TOP of Explore in v1.95.0 — the weak-spots count is Explore's call to action.
 *   3. The score belt is RETIRED as a visual (v1.98.1 — header died v1.96.0, the Explore
 *      mount died on the owner's word): no .ng-knowledge-header, no [data-knowledge], no
 *      meter anywhere. The score's one exposure is the Explore tab subtitle
 *      ("Mastered N%"); belt-meter.spec.ts pins the absence.
 *   3b. Tabs are two-line (v1.95.0): Explore over "Mastered N%" (word first, integer
 *      percent — owner, v1.95.2), Challenges over a mini belt striped by LADDER progress
 *      (not the score), and History is labeled "Last rolls" (internal ids unchanged).
 *   4. v1.94.0 RETIRES the "no account menu" canon: the chip now opens `.ng-account-menu`
 *      (account-menu.spec.ts owns that contract) and the PANE opener is the top-left logo.
 *   5. Settings carries Terms · Privacy links (the "Learn More" submenu that never was).
 *   6. The drill pill is DELETED (v1.99.0, owner): no pill on any form factor. The share
 *      cue is a standalone conditional band control (.ng-sharecue, above the chip); the
 *      chip holds the phone's bottom-right band seat; the logo is the one pane opener.
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

// the direct-assign open path (openHomeToLatest → History): since the pill's deletion
// (v1.99.0) that is the landing card's familiarity chip — "study this state"
const openViaPill = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.clickByMouse("[data-land-count]", "the landing card's familiarity chip")
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
    "the chip's study-this-state lands on History",
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
  // v1.98.1 (owner's final design): a three-level stack that reads as ONE unit —
  // caption (the why) over a full-width primary button over a quiet escape line
  const caption = anchor.locator("[data-anchor-caption]")
  await expect(caption).toHaveText("Save your progress")
  await expect(anchor.locator("[data-anchor-auth]"), "the one visual anchor").toHaveText(
    "Create account",
  )
  const escapeLine = anchor.locator("[data-anchor-alt]")
  await expect(escapeLine).toContainText("Already have one?")
  await expect(anchor.locator("[data-anchor-login]")).toHaveText("Log in")
  const stack = await page.evaluate(() => {
    const anchorEl = document.querySelector(".ng-pane-anchor")!.getBoundingClientRect()
    const c = document.querySelector("[data-anchor-caption]")!.getBoundingClientRect()
    const b = document.querySelector("[data-anchor-auth]")!.getBoundingClientRect()
    const l = document.querySelector("[data-anchor-login]")!.getBoundingClientRect()
    const alt = document.querySelector("[data-anchor-alt]")!.getBoundingClientRect()
    return {
      order: c.bottom <= b.top + 1 && b.bottom <= alt.top + 1,
      buttonFull: b.width >= anchorEl.width - 52,
      buttonH: b.height,
      loginH: l.height,
      centered: Math.abs(alt.left + alt.width / 2 - (anchorEl.left + anchorEl.width / 2)) < 30,
      tight: alt.bottom - c.top < 150,
    }
  })
  expect(stack.order, "caption above button above escape line").toBe(true)
  expect(stack.buttonFull, "the button spans the block").toBe(true)
  expect(stack.buttonH, "44px primary").toBeGreaterThanOrEqual(44)
  expect(stack.loginH, "44px hit area on the link").toBeGreaterThanOrEqual(40)
  expect(stack.centered, "escape line centered").toBe(true)
  expect(stack.tight, "reads as one unit, not three strays").toBe(true)
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
  await j.clickByMouse("[data-anchor-login]", "the quiet Log in link")
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
  ).toContainText(/Mastered \d+%/)
  await expect(nav.locator('[data-view="challenges"] > b')).toHaveText("Challenges")
  const tabBelt = nav.locator('[data-view="challenges"] .ng-tab-belt')
  await expect(tabBelt, "Challenges' second line is a belt").toBeVisible()
  // v1.95.3: stripes are the pinned track's PROVEN UNITS (lessons + checkpoint), not
  // objectives — the boot's auto-completed white objectives (tutorial skip; the same
  // auto-ticks a real guest accrues) earn NO stripes. A guest wears 0.
  await expect(tabBelt, "objectives alone earn no stripes").toHaveAttribute(
    "data-tab-stripes",
    "0",
  )
  // "History can be confused with the history of BJJ" — the label is Last rolls now
  // (internal ids and settings keys stay `history`)
  await expect(nav.locator('[data-view="history"] > b')).toHaveText("Last rolls")
  await expect(nav.locator('[data-view="history"] [data-tab-sub]')).toHaveText(
    "Your last rolls",
  )
  expect(await nav.innerText(), "the old tab label is gone").not.toContain("History")

  // THE TWO METERS ARE DIFFERENT: the Explore subtitle is the SCORE, the tab belt is
  // LADDER progress (proven units of the pinned track) — NOT gameScore().stripes. Seed a
  // purple score: the subtitle follows it, the tab belt does not move. (The woven meter
  // itself is gone since v1.98.1 — the subtitle is the score's one visual.)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._scoreCache = {
      v: a._stageVer || 0,
      out: { score: 0.65, belt: "purple", next: "brown", stripes: 2 },
    }
    a.renderTabSubtitles()
  })
  await expect(nav.locator('[data-view="explore"] [data-tab-sub]')).toHaveText("Mastered 65%")
  await expect(tabBelt, "score moved, ladder did not").toHaveAttribute("data-tab-stripes", "0")

  // and the converse: prove every white unit (lessons done + checkpoint) — the belt fills
  // to 4 stripes while the seeded score (and the subtitle reading it) is untouched
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
    .toBe(true)
  await page.evaluate(() => {
    const a = (window as any).__neural
    const belt = a.curriculum.belts.find((b: any) => b.id === "white")
    a.units = a.units || {}
    a.prep = a.prep || {}
    for (const u of belt.units) {
      for (const l of u.lessons) a.prep[l.deckKey] = 3
      a.units["white/" + u.id] = { checkpoint: true, t: Date.now() }
    }
    a.renderTabSubtitles()
  })
  await expect(tabBelt, "proven units = stripes").toHaveAttribute("data-tab-stripes", "4")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.units = {}
    a.renderTabSubtitles()
  })
  await expect(tabBelt, "ladder moved, score did not").toHaveAttribute("data-tab-stripes", "0")
  await expect(nav.locator('[data-view="explore"] [data-tab-sub]')).toHaveText("Mastered 65%")
})

test("the GI/NO-GI choice lives in Settings → Rolling and nowhere else", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  // v1.95.3, owner: the pill rendered on BOTH Explore and Challenges (`.ng-explorer-tools`,
  // hidden only on History) — one fact, one home. The pane carries no pill on any tab.
  await expect(page.locator(".ng-gi-toggle"), "no pill on History").toHaveCount(0)
  await j.clickByMouse('.ng-learning-nav [data-view="challenges"]', "the Challenges tab")
  await expect(page.locator(".ng-gi-toggle"), "no pill on Challenges").toHaveCount(0)
  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(page.locator(".ng-gi-toggle"), "no pill on Explore").toHaveCount(0)

  await j.clickByMouse('.ng-drill [title="Settings"]', "the pane footer gear")
  await j.clickByMouse(".t-rl", "the Rolling tab")
  const gi = page.locator("[data-settings-gi]")
  await expect(gi, "the one home: Settings → Rolling").toBeVisible()
  // placement only — the same behavior seam still flips the whole app's frame
  await gi.locator("button", { hasText: "No-gi" }).click()
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")
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

test("no score belt anywhere: Explore is subtitle + stats + lists, nothing else on top", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaPill(page, j)

  // v1.98.1 (owner): the woven belt + band road left Explore too — the header died in
  // v1.96.0, the Explore mount dies now. The score's ONLY visuals are the Explore tab
  // subtitle ("Mastered N%"); the only belt visual is the Challenges tab's ladder belt.
  await expect(page.locator(".ng-knowledge-header"), "the header stays gone").toHaveCount(0)
  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(page.locator("[data-knowledge]"), "the Explore block is gone").toHaveCount(0)
  await expect(page.locator(".ng-knowledge-meter"), "no woven meter anywhere").toHaveCount(0)
  await expect(page.locator(".ng-belt-road"), "no band road anywhere").toHaveCount(0)
  // Explore's body opens with the stats row, then Lists
  const g = await page.evaluate(() => {
    const s = document.querySelector("[data-explore-stats]")!.getBoundingClientRect()
    const l = document.querySelector("[data-lists-section]")!.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    return { stats: s.top, lists: l.top, navBottom: nav.bottom }
  })
  expect(g.stats, "stats right under the tab bar / search").toBeLessThan(g.navBottom + 130)
  expect(g.lists, "then Lists").toBeGreaterThan(g.stats)

  // the score stays exposed, in one place: the tab subtitle
  const sub = await page.locator('[data-tab-sub="explore"]').innerText()
  const score = await page.evaluate(() => (window as any).__neural.gameScore().score)
  expect(sub).toBe("Mastered " + Math.round(score * 100) + "%")
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

test("the drill pill is GONE on every form factor; the share cue renders only with a cue", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // v1.99.0 (owner): the pill must not appear anywhere — desktop…
  await expect(page.locator(".ng-drilltab")).toHaveCount(0)
  // …and its old right-edge seat is live graph, not a dead overlay
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth - 8, Math.round(innerHeight / 2))
    return el ? el.tagName : "none"
  })
  expect(hit, "the pill's old seat hit-tests to the canvas").toBe("CANVAS")
  // the share cue is CONDITIONAL: no cue, no control
  await expect(page.locator(".ng-sharecue")).toBeHidden()
  await expect(page.locator("[data-share-open]")).toHaveCount(0)
  await expect(page.locator("[data-share-cue]")).toHaveCount(0)

  // …and with a cue, the standalone band control renders at 44px and works by mouse
  await page.evaluate(() => {
    const a = (window as any).__neural
    const id = a.newList()
    a.addToList(a.nodes[a.currentPos].id, id)
    a._setShareCue({ kind: "class", target: id, n: 1 })
  })
  await expect(page.locator(".ng-sharecue")).toBeVisible()
  const cue = (await page.locator("[data-share-cue]").boundingBox())!
  expect(cue.height, "44px re-light").toBeGreaterThanOrEqual(44)
  const open = (await page.locator("[data-share-open]").boundingBox())!
  expect(open.height, "44px opener").toBeGreaterThanOrEqual(44)
  await j.clickByMouse("[data-share-open]", "the standalone Class ▸")
  await expect(page.locator(".ng-drill"), "it opens the pane on the class").toBeVisible()
  // pane open = the cue yields its corner
  await expect(page.locator(".ng-sharecue")).toBeHidden()
  // clearing the cue removes the control entirely
  await page.evaluate(() => (window as any).__neural.setDeckOpen(false))
  await page.evaluate(() => (window as any).__neural._setShareCue(null))
  await expect(page.locator(".ng-sharecue")).toBeHidden()
  await expect(page.locator("[data-share-open]")).toHaveCount(0)
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

test("phone: the chip holds the pill's old band seat; drawer via the logo fades it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // v1.99.0: the pill is gone on the phone too — the account chip takes its seat in the
  // thumb band (bottom-right, exactly like desktop's corner ownership)
  await expect(page.locator(".ng-drilltab")).toHaveCount(0)
  const chip = (await page.locator(".ng-acctwrap").boundingBox())!
  expect(Math.round(844 - (chip.y + chip.height)), "chip bottom gap = the pill's old 28").toBe(28)
  expect(Math.round(390 - (chip.x + chip.width)), "chip right gap").toBe(14)

  // the LOGO opens the drawer (the one pane opener), from the LEFT
  await j.clickByMouse(".ng-logo", "the logo")
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
