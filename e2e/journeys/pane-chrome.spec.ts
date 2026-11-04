import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/**
 * PANE & CHROME (v1.93.0, re-pinned for the v1.242.0 drawer, owner A5 / E1 / T-b):
 *
 *   1. One drawer icon (top-left) opens the drawer, and its rows are live: Path opens the corridor,
 *      the brand ("‹ Path") leads back to the list and its search. The tabs are gone.
 *   2. The score belt is RETIRED as a visual: no .ng-knowledge-header, no [data-knowledge], no
 *      meter anywhere; the score's one exposure is the badge menu's "Mastered" line.
 *   3. A study takeover owns the drawer body; its ‹ Back hands the list back.
 *   4. Settings (from the badge's menu) carries Terms · Privacy, and is the GI/NO-GI choice's one home.
 *   5. The drill pill stays DELETED; the share cue is a standalone conditional control.
 *   6. The drawer anchors the LEFT edge, and no account chip sits on the map: the badge is in the drawer.
 *   7. THE Z LADDER: deliberate temporary screens (the modal, the account menu) render above ambient
 *      gameplay overlays; Esc closes the topmost deliberate screen first.
 *   8. The open drawer leaves a readable game card beside it at desktop widths.
 * The drawer's order, badge, Practice and swipe claims are sidebar.spec.ts's; the badge's menu is
 * account-menu.spec.ts's. Mouse claims go through clickByMouse (no scroll-into-view, no amnesty).
 */

// The drawer icon is the one user-facing opener.
const openViaLogo = async (page: Page, j: Journey) => {
  await j.clickByMouse(".ng-logo", "the drawer icon")
  await expect(page.locator(".ng-drill")).toBeVisible()
}

test("the drawer icon opens a drawer whose rows are live", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaLogo(page, j)

  await expect(page.locator(".ng-learning-nav"), "the tab bar is gone").toHaveCount(0)
  await j.clickByMouse('[data-view="challenges"]', "the Path row")
  await expect(page.locator(".ng-challenge-ladder"), "Path renders the corridor").toBeVisible()
  await expect(page.locator(".ng-drawer-brand")).toHaveText("\u2039 Path")

  await j.clickByMouse('[data-view="explore"]', "the brand, home")
  await expect(
    page.locator(".ng-explorer-search input"),
    "the list renders its search",
  ).toBeVisible()
})

test("the GI/NO-GI choice lives in Settings → Rolling and nowhere else", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaLogo(page, j)

  // v1.95.3, owner: the pill rendered on BOTH Explore and Challenges (`.ng-explorer-tools`,
  // hidden only on History) — one fact, one home. The pane carries no pill on any tab.
  await expect(page.locator(".ng-gi-toggle"), "no pill on History").toHaveCount(0)
  await j.clickByMouse('[data-view="challenges"]', "the Challenges tab")
  await expect(page.locator(".ng-gi-toggle"), "no pill on Challenges").toHaveCount(0)
  await j.clickByMouse('[data-view="explore"]', "the Explore tab")
  await expect(page.locator(".ng-gi-toggle"), "no pill on Explore").toHaveCount(0)

  await j.openAccountMenu()
  await j.clickByMouse("[data-menu-settings]", "Settings, from the badge")
  // Settings is a DEFERRED bundle since v1.207.0 (`app/settings-ui.js`, imported on first open;
  // settings-lazy.spec.ts owns the loading/late-completion contract). The gear first paints
  // "Loading settings…", so the tab exists only once the presentation installs. Wait for it —
  // clickByMouse deliberately does not wait — and then the claim is the same: a real mouse at
  // the tab's measured centre reaches it.
  await expect(page.locator('[data-settings-tab="rolling"]'), "the lazy Settings UI has loaded").toBeVisible()
  await j.clickByMouse('[data-settings-tab="rolling"]', "the Rolling tab")
  const gi = page.locator("[data-settings-gi]")
  await expect(gi, "the one home: Settings → Rolling").toBeVisible()
  // placement only — the same behavior seam still flips the whole app's frame
  await gi.locator("button", { hasText: "No-gi" }).click()
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")
})

test("a study takeover owns the drawer body; its ‹ Back hands the list back", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaLogo(page, j)
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()

  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    a.openStudy(key)
  })
  await expect(page.locator("[data-drawer-explore]"), "study owns the body").toBeHidden()
  await expect(page.locator(".ng-drawer-head"), "the drawer head stays").toBeVisible()

  await j.clickByMouse("[data-pane-back]", "the study's ‹ Back")
  await expect(page.locator("[data-drawer-explore]"), "the list returns").toBeVisible()
})

test("no score belt anywhere: the drawer opens on its list, nothing else on top", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaLogo(page, j)

  await expect(page.locator(".ng-knowledge-header"), "the header stays gone").toHaveCount(0)
  await expect(page.locator("[data-knowledge]"), "the Explore block is gone").toHaveCount(0)
  await expect(page.locator(".ng-knowledge-meter"), "no woven meter anywhere").toHaveCount(0)
  await expect(page.locator(".ng-belt-road"), "no band road anywhere").toHaveCount(0)
  const g = await page.evaluate(() => {
    const head = document.querySelector(".ng-drawer-head")!.getBoundingClientRect()
    const ex = document.querySelector("[data-drawer-explore]")!.getBoundingClientRect()
    return { head: head.bottom, explore: ex.top }
  })
  expect(g.explore, "Explore leads the list, right under the head and search").toBeLessThan(g.head + 90)
  await j.openAccountMenu()
  const sub = await page.locator("[data-menu-mastered]").innerText()
  const score = await page.evaluate(() => (window as any).__neural.gameScore().score)
  expect(sub, "the score's one exposure").toMatch(new RegExp(" · " + Math.round(score * 100) + "%$"))
})

test("settings carries Terms · Privacy — the Learn More submenu that never was", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openViaLogo(page, j)

  await j.openAccountMenu()
  await j.clickByMouse("[data-menu-settings]", "Settings, from the badge")
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

test("the drawer anchors LEFT, and no account chip sits on the map", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(".ngAcctChip"), "the badge is in the drawer, not on the map").toBeHidden()
  await openViaLogo(page, j)
  const pane = await j.boxOf(".ng-drill", "the drawer")
  expect(pane.x, "the drawer anchors the LEFT edge").toBeLessThan(2)
  expect(pane.width, "desktop rail width").toBeGreaterThanOrEqual(340)
  const badge = await j.boxOf(".ngAcctChip", "the badge")
  expect(badge.x + badge.width, "the badge sits inside the drawer").toBeLessThanOrEqual(pane.x + pane.width)
})

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
    await j.openAccountMenu()
    await j.clickByMouse("[data-menu-settings]", "the Settings row")
    await expect(page.locator(".ng-modal"), "the modal is up").toBeVisible()

    let hit = await hitReport(page)
    expect(
      hit.inLandcard,
      `the landing card must not be hit-testable under Settings (elementFromPoint says: ${hit.who})`,
    ).toBe(false)
    expect(hit.inModal, "the point over the card belongs to the modal/scrim").toBe(true)

    // the modal's own controls take the mouse (clickByMouse refuses intercepted clicks). Settings
    // renders lazily (v1.207.0: "Loading settings…" first), and clickByMouse does not wait, so wait
    // for the control to exist; the reachability claim itself is unchanged.
    await expect(page.locator('[data-settings-legal] [data-legal="terms"]'), "Settings has rendered").toBeVisible()
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
    await openViaLogo(page, j)
    await expect(page.locator(".ng-drill")).toBeVisible()
    expect(
      await page.evaluate(() => (window as any).__neural.paused),
      "pane law: open = the game stops",
    ).toBe(true)

    await j.openAccountMenu()
  await j.clickByMouse("[data-menu-settings]", "Settings, from the badge")
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

/** The pane shares the viewport with readable gameplay chrome. At desktop widths the
 *  landing shifts into the available space; narrow overlap and populated film/More coverage
 *  live in pane-layout.spec.ts. Opening the pane still pauses and declines the live question. */
for (const width of [1440, 1024]) {
  test(`the pane leaves a readable game card beside it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.openQuestion() // U47 d: the card (and its guides) shows, and the question is live for the pane to decline
    await page.waitForTimeout(350)
    const card = page.locator("[data-landcard]")
    const before = await card.boundingBox()
    expect(before).not.toBeNull()
    expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(false)

    await openViaLogo(page, j)
    await j.advance(100)
    await page.waitForTimeout(450)
    await j.advance(3500)
    await expect(card, "the question remains visible beside the pane").toBeVisible()
    const open = await card.boundingBox()
    expect(open!.x, "the card moves toward the available space").toBeGreaterThan(before!.x + 80)
    expect(open!.width, "opening the pane keeps the readable card width").toBeCloseTo(before!.width, 0)
    expect(open!.x + open!.width, "the card stays on screen").toBeLessThanOrEqual(width)
    const next = await page.locator("[data-land-next]").boundingBox()
    expect(next!.x + next!.width, "the navigation gutter stays on screen too").toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => (window as any).__neural.paused), "pane law still pauses the roll").toBe(true)
    expect(await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null), "the question was declined").toBeNull()

    await j.clickByMouse(".ng-explorer-close", "the pane close button")
    await j.advance(100)
    await page.waitForTimeout(450)
    await j.advance(3500)
    const closed = await card.boundingBox()
    expect(closed!.x, "closing restores the original horizontal position").toBeCloseTo(before!.x, 0)
    expect(closed!.width).toBeCloseTo(before!.width, 0)
    expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(false)
  })
}
