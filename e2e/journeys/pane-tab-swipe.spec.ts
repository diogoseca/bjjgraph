import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type W = Window & { __neural: any }

/**
 * THE PANE'S TABS ARE A PAGER (v1.147.0, owner: "users try to scroll left and right").
 *
 * Explore ‹ Challenges ‹ Last rolls is a three-tab nav on a drawer that covers a phone's whole
 * screen, so visitors swipe it whether or not anybody wired one. This file pins the wiring, and
 * above all the DIRECTION — the one decision here that is invisible when it is wrong, because a
 * pager that runs backwards still pages.
 *
 * THE DIRECTION RULE: the CONTENT FOLLOWS THE FINGER. A leftward drag pulls the tab on the RIGHT
 * into view. That is UIPageViewController / ViewPager2, and it is already this app's own landing
 * card (`_landPageTo(dx < 0 ? 1 : -1)`, v1.130.0) — two pagers in one drawer disagreeing about
 * forward would be the defect. The only device signal that exists is WRITING DIRECTION (there is
 * no swipe-direction or natural-scrolling API anywhere on the platform), so RTL is pinned too.
 *
 * Rails: __neural._viewMode · ._paneTabPageTo() · ._paneGestureDir() · .deckIdx
 * Journey 6 repeats journey 1's direction claim at 390x844 — the form factor the ask was about.
 * Beats: pane_tab_paged {from, to, dir}
 *
 * Mutants run against the built bundle, and their results:
 *   M1 — the direction inverts (`dx < 0 ? -1 : 1` in `_paneGestureDir`)  KILLED, journeys 1-3,5
 *   M2 — the dominant-axis check goes (`Math.abs(dx) <= Math.abs(dy)`)   KILLED, journey 1
 *   M3 — the clamp is replaced by a wrap                                 KILLED, journey 2
 *   M4 — the capture-phase click suppressor goes (a swipe is a tap)      KILLED, journey 2
 *   M4b — the 16px threshold drops under the browser's own tap slop
 *         (back to the landing card's 6), eating shaky presses          KILLED, journey 2
 *   M5 — the `inHScroller` guard goes (a film drag pages the nav)        KILLED, journey 3
 *   M7 — the RTL flip goes                                               KILLED, journey 5
 *   M6 — the study branch stops `return`ing, so a card swipe falls
 *        through into the tab pager                                      SURVIVED — EQUIVALENT
 *
 * And for journey 7's latch (v1.151.1), the same way:
 *   M8 — the latch reverts to v1.147.0's 350ms cooldown              KILLED, journey 7
 *   M9 — the latch is never cleared, so the pager dies after one     KILLED, journey 7
 *   M10 — `wLast = now` moves BELOW the latch check, so the momentum
 *         tail's own silence unlatches the flick mid-gesture         KILLED, journey 7
 *
 * M6 SURVIVES BECAUSE IT IS NOT A DEFECT, and that is worth writing down rather than papering
 * over: `_paneTabPageTo` refuses on `_paneStudyActive()` itself, so the fall-through reaches a
 * closed door. The DOUBLE mutant — that `return` gone AND the pager's own study guard gone —
 * IS killed by journey 4. So journey 4 gates the behaviour ("a swipe with a deck open pages the
 * deck and never the tab bar") but cannot tell you which of the two guards is holding it up; do
 * not read a green journey 4 as evidence about either one alone. (A THIRD spelling of the same
 * rule, in the wheel handler, was measured redundant this way and deleted — §6.5.)
 *
 * NON-KILLS, recorded so nobody reads this file as covering them (§6.3):
 *   · `_paneSlideBody` — asserted only through "the tab changed"; NOTHING here fails if the
 *     slide animation is deleted, and nothing here fails if it is left mid-transform.
 *   · the trackpad `wheel` pager shares `_paneTabPageTo` and `_paneGestureDir` with the touch
 *     path, so M1/M3 cover its direction and its clamp, and journey 7 pins its GESTURE BOUNDARY
 *     (M8-M10) — but the 60px trip threshold and the deltaX dominance test are still unpinned,
 *     and nothing here fails if the 300ms idle window is retuned.
 *   · the landing card's own wheel pager (`_landPageTo`, `app.src.jsx`) still carries the
 *     cooldown SHAPE journey 7 rejects for the pane. Different pager, different (unbounded)
 *     list, and no journey here touches it — do not read journey 7 as evidence about it.
 */

const view = (page: Page) => page.evaluate(() => (window as W).__neural._viewMode)
const count = (bs: Array<{ beat: string }>, b: string) => bs.filter((x) => x.beat === b).length

/** A touch drag, dispatched on `sel` and bubbling to the pane — the landcard-modes idiom. */
const swipe = (page: Page, sel: string, x1: number, y1: number, x2: number, y2: number) =>
  page.evaluate(
    ([s, a, b, c, d]) => {
      const el = document.querySelector(s as string) as HTMLElement
      if (!el) throw new Error(`no element for ${s}`)
      const mk = (x: number, y: number) =>
        new Touch({ identifier: 1, target: el, clientX: x as number, clientY: y as number })
      el.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [mk(a as number, b as number)], bubbles: true }))
      el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(c as number, d as number)], bubbles: true }))
    },
    [sel, x1, y1, x2, y2] as const,
  )

/**
 * A TRACKPAD FLICK, as the OS actually delivers one: a burst of `wheel` events at ~60Hz whose
 * deltaX decays, running ~900ms — most of it the momentum tail that arrives after the fingers
 * have already lifted. `sign` is -1 for a rightward two-finger swipe (the content follows the
 * fingers, so the browser reports a negative deltaX). Dispatching one big delta instead would
 * make journey 7 pass on the build it exists to fail.
 */
const wheelFlick = (page: Page, sel: string, sign: number) =>
  page.evaluate(
    async ([s, sg]) => {
      const el = document.querySelector(s as string) as HTMLElement
      if (!el) throw new Error(`no element for ${s}`)
      let d = 22
      for (let i = 0; i < 55; i++) {
        el.dispatchEvent(new WheelEvent("wheel", { deltaX: (sg as number) * d, deltaY: 0, bubbles: true }))
        d = Math.max(1, d * 0.94)
        await new Promise((r) => setTimeout(r, 16))
      }
    },
    [sel, sign] as const,
  )

const openPane = async (page: Page) => {
  await page.locator(".ng-logo").click()
  await expect(page.locator(".ng-drill")).toBeVisible()
  // a fresh guest lands on Challenges — the MIDDLE tab, so both directions are reachable
  expect(await view(page), "a fresh visitor's pane opens on Challenges").toBe("challenges")
}

// ── 1. the content follows the finger, and only the horizontal axis is ours ───────────────────
test("swipe left goes RIGHT along the nav, swipe right goes back, vertical scrolls @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  // M1: leftward drag → the tab to the RIGHT. An inverted build lands on `explore` here, and
  // the aria-pressed assertion is what a user would actually see.
  const b0 = await j.beats()
  await swipe(page, ".ng-drill", 300, 420, 190, 424)
  expect(await view(page), "a leftward drag pulls the NEXT tab in from the right").toBe("history")
  await expect(
    page.locator('.ng-learning-nav [data-view="history"]'),
    "and the nav says so",
  ).toHaveAttribute("aria-pressed", "true")
  const b1 = await j.beats()
  expect(count(b1, "pane_tab_paged") - count(b0, "pane_tab_paged"), "one page, one beat").toBe(1)
  expect(
    await page.evaluate(
      () => ((window as W).__neural.beats || []).filter((b: any) => b.beat === "pane_tab_paged").pop(),
    ),
    "the beat carries the crossing it made",
  ).toMatchObject({ from: "challenges", to: "history", dir: 1 })

  // rightward drag → back the way we came, and once more to the left edge
  await swipe(page, ".ng-drill", 190, 420, 300, 418)
  expect(await view(page), "a rightward drag walks back").toBe("challenges")
  await swipe(page, ".ng-drill", 190, 420, 300, 418)
  expect(await view(page)).toBe("explore")

  // M2: a VERTICAL-dominant gesture belongs to the pane's own scroller. dx is deliberately 60 —
  // past the 40px floor — so a build that lost the dominance check cannot hide behind the floor.
  const b2 = await j.beats()
  await swipe(page, ".ng-drill", 300, 520, 240, 380)
  expect(await view(page), "a vertical drag does not page").toBe("explore")
  expect(count(await j.beats(), "pane_tab_paged") - count(b2, "pane_tab_paged")).toBe(0)

  // and a drag too small to mean anything is nothing at all
  await swipe(page, ".ng-drill", 300, 420, 275, 421)
  expect(await view(page), "a 25px twitch is not a swipe").toBe("explore")
})

// ── 2. the ends CLAMP, and a swipe is never a tap ─────────────────────────────────────────────
test("the pager stops at both ends, and a swipe that lands on a tab does not press it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  await swipe(page, ".ng-drill", 190, 420, 300, 418) // → explore, the left end
  expect(await view(page)).toBe("explore")

  // M3: past the end is a NO-OP, never a wrap. A wrapping build lands on `history` — the far
  // end of the nav — from a gesture the user meant as "go further left".
  const b0 = await j.beats()
  await swipe(page, ".ng-drill", 190, 420, 320, 422)
  expect(await view(page), "the left end holds").toBe("explore")
  expect(count(await j.beats(), "pane_tab_paged") - count(b0, "pane_tab_paged"), "and stays silent").toBe(0)

  // M4: the pane is built out of buttons, so the click the browser synthesises at the end of a
  // swipe must not press whatever the finger lifted over. This gesture is the clamped no-op
  // above — start on the Explore tab, end over Challenges — so ONLY the suppressor stands
  // between the swipe and a tab change.
  await page.evaluate(() => {
    const nav = document.querySelector(".ng-learning-nav") as HTMLElement
    const from = nav.querySelector('[data-view="explore"]') as HTMLElement
    const to = nav.querySelector('[data-view="challenges"]') as HTMLElement
    const r1 = from.getBoundingClientRect()
    const r2 = to.getBoundingClientRect()
    const y = r1.top + r1.height / 2
    const mk = (x: number, t: HTMLElement) => new Touch({ identifier: 1, target: t, clientX: x, clientY: y })
    from.dispatchEvent(
      new TouchEvent("touchstart", { changedTouches: [mk(r1.left + r1.width / 2, from)], bubbles: true }),
    )
    to.dispatchEvent(
      new TouchEvent("touchend", { changedTouches: [mk(r2.left + r2.width / 2, to)], bubbles: true }),
    )
    to.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
  expect(await view(page), "the swipe pressed nothing").toBe("explore")

  // M4b, the OTHER side of the same threshold: a shaky tap is still a tap. The browser's own
  // slop is ~8px (Chrome) to ~10px (iOS), so a suppressor set under that swallows real presses
  // on a list of rows and shows nothing for it. The case above pins 16px from ABOVE; this pins
  // it from BELOW, and a build that drops back to the landing card's 6 goes red here.
  await page.evaluate(() => {
    const btn = document.querySelector('.ng-learning-nav [data-view="challenges"]') as HTMLElement
    const r = btn.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const mk = (dx: number) => new Touch({ identifier: 1, target: btn, clientX: x + dx, clientY: y })
    btn.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [mk(0)], bubbles: true }))
    btn.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(10)], bubbles: true }))
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
  expect(await view(page), "a 10px wobble is a press, not a swipe").toBe("challenges")

  // …and a PLAIN click still works: the latch lets go of its own accord
  await page.waitForTimeout(750) // past the latch's 700ms lifetime
  await page.locator('.ng-learning-nav [data-view="history"]').click()
  expect(await view(page), "a real tap still changes tab").toBe("history")
})

// ── 3. a drag that begins inside a horizontal scroller belongs to that scroller ───────────────
test("a drag started in a horizontally scrollable row scrolls it instead of paging", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  // The guard is written AHEAD of its first instance: `.ng-cliprow` is the app's horizontal
  // scroller, and at v1.147.0 both of `filmStudyHTML`'s mount points are outside the pane, so
  // there is no reachable one to steer the corpus toward. Stand one up instead — the guard tests
  // the ELEMENT's overflow, which is precisely what is built here, so this drives the real rule.
  await page.evaluate(() => {
    const list = (window as W).__neural.explorerListRef.current as HTMLElement
    const row = document.createElement("div")
    row.className = "ng-cliprow"
    row.setAttribute("data-test-hscroll", "1")
    row.style.cssText = "display:flex;gap:8px;overflow-x:auto;height:80px;"
    for (let i = 0; i < 8; i++) {
      const c = document.createElement("div")
      c.style.cssText = "flex:none;width:200px;height:60px;background:#234;"
      row.appendChild(c)
    }
    list.insertBefore(row, list.firstChild)
  })
  const box = await page.locator("[data-test-hscroll]").boundingBox()
  if (!box) throw new Error("the injected film strip did not lay out")
  const cy = box.y + box.height / 2

  // M5: without the guard this pages the nav out from under a finger that was scrubbing film.
  const b0 = await j.beats()
  await swipe(page, "[data-test-hscroll]", box.x + box.width - 20, cy, box.x + 20, cy)
  expect(await view(page), "the film strip kept its own gesture").toBe("challenges")
  expect(count(await j.beats(), "pane_tab_paged") - count(b0, "pane_tab_paged")).toBe(0)

  // the same drag one row lower — outside the scroller — still pages, so the test above is
  // about the GUARD and not about a swipe that stopped working
  await swipe(page, ".ng-drill", 300, cy + 200, 190, cy + 204)
  expect(await view(page), "the pane at large is still a pager").toBe("history")
})

// ── 4. two pagers, one element: a study surface pages CARDS, never tabs ───────────────────────
// Gates the BEHAVIOUR, not either guard — see M6 in this file's header before citing it.
test("with a deck open the swipe pages the deck, and the tab bar does not move", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  // openLessonStudy is the seam sessions/checkpoints use; isDrillOpen() is deckShown && deck,
  // so a HOME open (deck:null) would not exercise the branch at all (landcard-modes' idiom).
  await page.evaluate(() => {
    const a = (window as W).__neural
    const node = a.nodes[a.currentPos]
    const key = a.deckKeyFor(node).key
    a.openLessonStudy(
      { deckKey: key, nodeId: node.id },
      { name: "t", lessons: [{ deckKey: key, nodeId: node.id }] },
      { id: "white" },
    )
  })
  await j.advance(800)
  await j.decksSettled()
  await page.waitForFunction(() => (((window as any).__neural || {}).deck || []).length > 0, null, {
    timeout: 20_000,
  })
  expect(await page.evaluate(() => (window as W).__neural.isDrillOpen()), "the study surface is up").toBe(true)

  const idx0 = await page.evaluate(() => (window as W).__neural.deckIdx)
  const b0 = await j.beats()
  await swipe(page, ".ng-drill", 300, 420, 190, 424)
  expect(await page.evaluate(() => (window as W).__neural.deckIdx), "the DECK paged").toBe(idx0 + 1)
  expect(await view(page), "the tab bar stayed where it was").toBe("challenges")
  expect(count(await j.beats(), "pane_tab_paged") - count(b0, "pane_tab_paged"), "no tab beat").toBe(0)
})

// ── 5. the one device signal that actually exists: writing direction ──────────────────────────
test("under dir=rtl the nav reverses and so does the gesture", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"))
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector(".ng-drill") as HTMLElement).direction),
    "the pane inherited the document's direction",
  ).toBe("rtl")

  // the nav lays itself out history | challenges | explore, so "pull the next one in from the
  // right" is now `explore` — M7: an LTR-only build still answers `history` here.
  await swipe(page, ".ng-drill", 300, 420, 190, 424)
  expect(await view(page), "the finger still pulls in whatever sits to its right").toBe("explore")
})

// ── 6. the form factor the ask was actually about ─────────────────────────────────────────────
// The gesture is wired on the pane element, so it does not depend on the viewport — but the
// drawer IS the screen at 390x844 (88vw, per the pane law), and that is where people were
// already swiping. This proves the pager survives the mobile layout rather than assuming it.
test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the drawer's tab bar pages under a thumb @curated", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await openPane(page)

    const w = await page.evaluate(() => (document.querySelector(".ng-drill") as HTMLElement).getBoundingClientRect().width)
    expect(w, "the pane is the phone drawer, not the 360px desktop rail").toBeGreaterThan(300)

    await swipe(page, ".ng-drill", 300, 500, 120, 508) // a thumb's arc, well inside the drawer
    expect(await view(page), "leftward across the drawer goes forward").toBe("history")
    await swipe(page, ".ng-drill", 120, 500, 300, 494)
    expect(await view(page), "and back").toBe("challenges")
  })
})

// ── 7. ONE GESTURE IS ONE TAB — the trackpad's momentum is not extra swipes ────────────────────
// The v1.147.0 defect, fixed in v1.151.1 (owner, on the rightmost tab: "I swipe to go left… what it does instead is
// circle through — I'm passing through the middle tab but never landing on it"). The wheel pager
// shipped with a 350ms COOLDOWN, which rate-limits a stream but never ends a gesture: a trackpad's
// inertia keeps deltas arriving for ~1s after the fingers lift, the accumulator keeps filling
// while the cooldown runs, and the same physical flick pages again the instant it lapses.
// Measured on the built bundle before the fix: one flick off `history` emitted TWO
// `pane_tab_paged` beats and landed on `explore`. `_paneTabPageTo`'s clamp was never the problem
// — it clamped correctly on every one of those steps.
//
// A flick is dispatched as the OS delivers one: ~55 events at ~60Hz with the delta decaying, so a
// build that ends the gesture on the STREAM going idle passes and a build that ends it on a timer
// cannot. The `j.beats()` deltas are the load-bearing assertion — the view alone cannot tell a
// single step from a double step that clamped at the end of the nav.
test("one trackpad flick pages exactly one tab, and the ends hold @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  // start at the RIGHTMOST tab, by click — the pager is not what is under test yet
  await page.locator('.ng-learning-nav [data-view="history"]').click()
  expect(await view(page), "the report starts on Last rolls").toBe("history")

  // A rightward two-finger swipe: the content follows the fingers, so the tab to the LEFT comes
  // in, and a trackpad reports that as a NEGATIVE deltaX. `wheelFlick` carries the momentum tail.
  const b0 = await j.beats()
  await wheelFlick(page, ".ng-drill", -1)
  expect(await view(page), "one flick lands on the ADJACENT tab, not past it").toBe("challenges")
  expect(
    count(await j.beats(), "pane_tab_paged") - count(b0, "pane_tab_paged"),
    "one flick, one step — the momentum tail is the same gesture",
  ).toBe(1)

  // the gesture ENDS when the wheel goes idle, so a second, deliberate flick still works
  await page.waitForTimeout(400)
  const b1 = await j.beats()
  await wheelFlick(page, ".ng-drill", -1)
  expect(await view(page), "a fresh flick pages again").toBe("explore")
  expect(count(await j.beats(), "pane_tab_paged") - count(b1, "pane_tab_paged")).toBe(1)

  // …and at the left end, further flicks stay put: no wrap, no beat
  await page.waitForTimeout(400)
  const b2 = await j.beats()
  await wheelFlick(page, ".ng-drill", -1)
  expect(await view(page), "the left end holds under the trackpad too").toBe("explore")
  expect(count(await j.beats(), "pane_tab_paged") - count(b2, "pane_tab_paged")).toBe(0)

  // the same claim for the finger, stated where the report stated it: from the rightmost tab,
  // ONE drag leftward along the nav lands on the middle tab and stops there
  await page.locator('.ng-learning-nav [data-view="history"]').click()
  await page.waitForTimeout(750) // past the click suppressor's latch
  const b3 = await j.beats()
  await swipe(page, ".ng-drill", 190, 420, 320, 422)
  expect(await view(page), "one drag, one tab").toBe("challenges")
  expect(count(await j.beats(), "pane_tab_paged") - count(b3, "pane_tab_paged")).toBe(1)
})
