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
 *      next to Settings/Terms/Privacy. The stat row (mastered/due/new) moved to
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
  // v1.104.5: the stat band sits at the pane FOOT (owner), but as its OWN element ABOVE the
  // anchor — never INSIDE it, because the anchor collapses entirely for a signed-in user and
  // three progress numbers must not disappear along with a save nudge.
  await expect(anchor.locator(".ngStat"), "not inside the anchor").toHaveCount(0)
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
  // THE BAND IS FOOT CHROME NOW: it rides EVERY tab, Challenges included.
  await expect(page.locator("[data-explore-stats]"), "the band rides Challenges too").toBeVisible()

  await j.clickByMouse('.ng-learning-nav [data-view="explore"]', "the Explore tab")
  await expect(anchor, "anchor on Explore").toBeVisible()
  const stats = page.locator("[data-explore-stats]")
  await expect(stats).toBeVisible()
  await expect(stats.locator(".ngStat")).toHaveCount(3)
  // MASTERED / DUE / NEW (v1.138.0). The third cell used to name a tier of the old prep rule
  // ("N very weak spots"); it now names today's DOSE off the FLOW ranking, so the row reads as
  // the three states any card is in. The count is the card budget left after maintenance, which
  // is why it can legitimately be 0 on a day you owe a lot.
  await expect(stats).toContainText("new")
  await expect(page.locator('.ngStat[data-b="new"]')).toBeVisible()
  await expect(page.locator('.ngStat[data-b="new"]')).toHaveAttribute("data-new", /^\d+$/)
  // EVENLY SPACED, NOT PINNED TO THE EDGES (v1.138.0, owner: "the space between these items is
  // so large that they seem overglued to their edges in a weird way").
  //
  // This assertion REPLACES the v1.104.5 one, which pinned `display: grid` and `spread/width >
  // 0.85`. That contract WAS the edge-hugging: three `1fr` columns with justify-self
  // start/centre/end distribute the BOXES evenly and then park the outer two on the padding
  // edge, so the ink ends hard against both walls with a hole in the middle (measured: 12px
  // gaps at the edges, 56px between). `space-evenly` distributes the GAPS instead, so the
  // differential to assert is that all four gaps are equal — which is the opposite of a high
  // spread ratio, and is why the old numeric floor could not simply be relaxed.
  const s = await page.evaluate(() => {
    const r = document.querySelector("[data-explore-stats]") as HTMLElement
    const rb = r.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    const anc = document.querySelector(".ng-pane-anchor")!.getBoundingClientRect()
    const cells = [...r.querySelectorAll(".ngStat")].map((c) => c.getBoundingClientRect())
    const oneLine = cells.every((c) => Math.abs(c.top - cells[0].top) < 2)
    return {
      top: rb.top, navBottom: nav.bottom, anchorTop: anc.top, bottom: rb.bottom,
      display: getComputedStyle(r).display,
      justify: getComputedStyle(r).justifyContent,
      oneLine,
      gaps: [
        cells[0].left - rb.left,
        cells[1].left - cells[0].right,
        cells[2].left - cells[1].right,
        rb.right - cells[2].right,
      ].map((g) => Math.round(g)),
      width: Math.round(rb.width),
      inFoot: !!r.closest(".ng-pane-stats"),
    }
  })
  expect(s.inFoot, "it lives in the foot band").toBe(true)
  expect(s.top, "at the FOOT, far below the tab bar").toBeGreaterThan(s.navBottom + 200)
  expect(Math.round(s.bottom), "directly above the save nudge").toBeLessThanOrEqual(Math.round(s.anchorTop) + 2)
  expect(s.display, "a flex band, not a three-column grid").toBe("flex")
  expect(s.justify, "the GAPS are what is distributed").toBe("space-evenly")
  // the differential: every gap equal, and the outer ones no longer the small ones
  expect(s.oneLine, "one line at desktop width — the wrap valve is for the drawer").toBe(true)
  const [l, a, b, rgt] = s.gaps
  expect(Math.max(l, a, b, rgt) - Math.min(l, a, b, rgt),
    `all four gaps equal, got ${s.gaps.join("/")}`).toBeLessThanOrEqual(4)
  expect(l, "and the outer gap is real breathing room, not a 12px padding edge").toBeGreaterThan(14)

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

  // and the converse: prove white units (lessons + checkpoints) SHORT of the whole belt —
  // stripes fill while white stays the corridor's frontier; the seeded score is untouched
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.curriculum))
    .toBe(true)
  const seeded = await page.evaluate(() => {
    const a = (window as any).__neural
    const belt = a.curriculum.belts.find((b: any) => b.id === "white")
    a.units = a.units || {}
    a.prep = a.prep || {}
    const provable = belt.units.slice(0, belt.units.length - 1) // the last unit stays open
    for (const u of provable) {
      for (const l of u.lessons) a.prep[l.deckKey] = 3
      a.units["white/" + u.id] = { checkpoint: true, t: Date.now() }
    }
    a.renderTabSubtitles()
    return {
      expected: Math.max(
        0,
        Math.min(4, Math.floor((provable.length / belt.units.length) * 4)),
      ),
    }
  })
  await expect(tabBelt, "proven units = stripes").toHaveAttribute(
    "data-tab-stripes",
    String(seeded.expected),
  )
  // completing the WHOLE belt advances the corridor (v1.99.2: the tab belt tracks the
  // frontier belt, not a pin): a fresh blue belt, zero stripes, blue dye
  await page.evaluate(() => {
    const a = (window as any).__neural
    const belt = a.curriculum.belts.find((b: any) => b.id === "white")
    for (const u of belt.units) {
      for (const l of u.lessons) a.prep[l.deckKey] = 3
      a.units["white/" + u.id] = { checkpoint: true, t: Date.now() }
    }
    a.renderTabSubtitles()
  })
  await expect(tabBelt, "new belt, no stripes yet").toHaveAttribute("data-tab-stripes", "0")
  expect(
    await tabBelt.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--tb")),
    "the tab belt wears blue now",
  ).toBe("#78a2f5")
  // and the score (and the subtitle reading it) never moved through any of it
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
  // Explore's body now opens with Lists; the stat band is foot chrome below everything (v1.104.5)
  const g = await page.evaluate(() => {
    const s = document.querySelector("[data-explore-stats]")!.getBoundingClientRect()
    const l = document.querySelector("[data-lists-section]")!.getBoundingClientRect()
    const nav = document.querySelector(".ng-learning-nav")!.getBoundingClientRect()
    return { stats: s.top, lists: l.top, navBottom: nav.bottom }
  })
  expect(g.lists, "Lists leads the body, right under the tab bar / search").toBeLessThan(g.navBottom + 190)
  expect(g.stats, "and the stat band is below it, at the foot").toBeGreaterThan(g.lists)

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

/**
 * THE PANE IS IN FRONT OF THE GAME CARD, AT EVERY WIDTH.
 *
 * The card is `min(520px, 100vw - 32px)` and CENTRED; the pane is 360px on the left. At 1440
 * they miss each other, at 1024 they overlap by 108px — and the card wins, because the pane's
 * own `z-index:8` is trapped inside the `position:fixed` app wrap (its own stacking context)
 * while the card is a root-plane child at z:5. Owner: "the left side pane should always appear
 * in front of the current node's dialog, not hidden behind it — the game pauses when the left
 * pane is open." That second clause is the argument: nothing is running, so nothing is lost by
 * standing the card down until the pane closes.
 */
for (const width of [1440, 1024]) {
  test(`the pane paints over the game card at ${width}px, and the roll is paused behind it`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await j.advance(1200);

    const card = await page.evaluate(() => {
      const a = (window as any).__neural;
      const r = a._landEl ? a._landEl.getBoundingClientRect() : null;
      return { left: r ? Math.round(r.left) : null, right: r ? Math.round(r.right) : null, paused: a.paused };
    });
    expect(card.left, "premise: the game card is up").not.toBeNull();
    expect(card.paused, "premise: the roll is running").toBe(false);

    await page.evaluate(() => (window as any).__neural.openPane("explore"));
    await j.advance(600);

    const st = await page.evaluate(() => {
      const a = (window as any).__neural;
      const pane = a.drillRef.current as HTMLElement;
      const pr = pane.getBoundingClientRect();
      // the pane's own middle: whatever is there is what a click reaches
      const at = document.elementFromPoint(
        Math.round(pr.left + pr.width / 2),
        Math.round(pr.top + pr.height / 2),
      );
      const cs = a._landEl ? getComputedStyle(a._landEl) : null;
      const fs = a._landFilmEl ? getComputedStyle(a._landFilmEl) : null;
      return {
        overlap: Math.max(0, Math.round(pr.right) - (a._landEl ? Math.round(a._landEl.getBoundingClientRect().left) : 1e9)),
        hitInPane: !!(at && pane.contains(at)),
        cardVisibility: cs ? cs.visibility : null,
        filmVisibility: fs ? fs.visibility : null,
        paused: a.paused,
      };
    });

    expect(st.hitInPane, "the pane owns its own middle").toBe(true);
    expect(st.cardVisibility, "the card stands down while the pane is up").toBe("hidden");
    if (st.filmVisibility) expect(st.filmVisibility, "and so does its film strip").toBe("hidden");
    expect(st.paused, "pane law: open = paused").toBe(true);

    // ...and it comes back, unchanged, on close
    await page.evaluate(() => (window as any).__neural.setDeckOpen(false));
    await j.advance(600);
    const back = await page.evaluate(() => {
      const a = (window as any).__neural;
      const cs = a._landEl ? getComputedStyle(a._landEl) : null;
      return { visibility: cs ? cs.visibility : null, paused: a.paused };
    });
    expect(back.visibility, "the card returns when the pane closes").toBe("visible");
    expect(back.paused, "and the roll resumes with it").toBe(false);
  });
}
