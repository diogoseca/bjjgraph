import { expect, test, type Page } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"
import { bootVideoCards, CARD, installPlayerStub } from "../fixtures/video-cards"

/** VID1 (owner, 15 Nov 2026): "when i click to see a video ... i'd rather show the video only on top of everything,
 *  and dim the rest, and start it immediately, and have a discrete x on the corner, and people can either click the
 *  suroundings or the x or press esc to close it ... use the same mechanism the video card for the current node uses,
 *  it's perfect". Every press that opens a video now opens the current node's theater.
 *
 *  Four surfaces, each opened by the player's own press (a mouse at 1440x900, a touch tap at 390x631):
 *   - move     a move's play circle in the row (was a 620px modal that waited for Play, with two ✕);
 *   - current  the current node's own video card (the theater since VIDEO1: the control group);
 *   - reader   a Principle page's published clip in the reader's Videos section (played inside its card);
 *   - drawer   a Principle's clip in the drawer (Explore; grew inside the drawer).
 *  Each: the video plays without a second press (the player's OWN state), one ✕, no band, the video as large as the
 *  screen allows; then each way out (Esc, the ✕, a press on the dim) closes it, destroys the player (the sound stops)
 *  and leaves the pause, the roll, the row's scroll, the reader's scroll, the drawer and the camera as they were, with
 *  focus back on the control that opened it. The dim exit presses OVER a real control where one lies outside the video,
 *  so it also proves nothing under the dim takes the press.
 *
 *  WHAT THE HARNESS DOES NOT SERVE (CLAUDE.md §6.4): no YouTube. The player is `installPlayerStub`
 *  (e2e/fixtures/video-cards.ts): it records what the app asked (vars, play, mute, destroy) and reports the player's
 *  own state. A refusing browser is that stub answering playVideo with onAutoplayBlocked, the player's own report
 *  (`__refuseSound`); no real iPhone or Safari runs here. Posters are aborted (each img is hidden by its onerror).
 *
 *  Mutants (tests/artifacts/video_viewer_mutants.json, each against a green baseline of this file): no-autoplay-request,
 *  no-play-on-ready, esc-ignored, dim-not-closing, second-x, dim-removed, not-modal, old-modal-from-move,
 *  muted-start-lost, pause-not-restored. Measured 16 Nov 2026 (head ab71d940e): all ten red at their named test with
 *  their named assertion, each control green; no survivors. VID1-R1 (the reader of #427) adds close-always-unpauses (its
 *  R2: every close un-pauses), dim-press-falls-through (its R1: a dim press also clicks what is under it) and
 *  zoom-guard-removed (a player that takes a press during its zoom). Results in docs/Changelog-Archive.md (VID1).
 */

const THEATER = ".ng-video-theater"
type Surface = "move" | "current" | "reader" | "drawer"
const OPEN: Record<Surface, string> = {
  move: `${CARD} [data-choice-watch]`,
  current: '[data-land-film]:not([data-reference-film]) .ng-clip[data-i="0"] [data-film-play]',
  reader: '[data-land-film][data-reference-film] .ng-clip[data-i="0"] [data-film-play]',
  drawer: '[data-concept-film] .ng-clip[data-i="0"] [data-film-play]',
}
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }
// Principles/Base, read from the SERVED payload first (a CI shard has only the built site, under source/public), then
// the emitted one (a worktree whose build has not copied it across), as concepts-surface.spec.ts reads it; and only when
// a drawer test asks. VID1-CI: the first version read only source/quartz/static/neural/concepts.json, at module load:
// generated and gitignored, absent from every e2e-full shard, so the throw failed collection and every shard ran nothing.
let BASE_CONCEPT: any = null
function base() {
  if (BASE_CONCEPT) return BASE_CONCEPT
  const file = ["../../source/public/static/neural/concepts.json", "../../source/quartz/static/neural/concepts.json"]
    .map(rel => resolve(__dirname, rel)).find(path => existsSync(path))
  if (!file) throw Error("concepts.json is in neither source/public nor source/quartz: build or emit the neural payload")
  BASE_CONCEPT = JSON.parse(readFileSync(file, "utf8")).concepts.find((c: any) => c.id === "Principles/Base")
  if (!BASE_CONCEPT) throw Error("Principles/Base is not in concepts.json")
  return BASE_CONCEPT
}
// The reader's clip is Frames' first published clip, a vertical Short in the source: the theater fits it at 9:16
// (video-theater.spec pins that portrait fit), so its expected box is read from the content, never from the dialog.
const FRAMES_FIRST = JSON.parse(readFileSync(resolve(__dirname, "../../content/Principles/Frames.json"), "utf8")).clips[0]
const DRAWER_CLIPS = [
  { id: "abcdefghijk", title: "Balance in one minute", by: "Fixture instructor", start: 3 },
  { id: "bcdefghijkl", title: "Recover your base", by: "Fixture instructor" },
]

async function boot(page: Page, surface: Surface) {
  const j = journey(page)
  if (surface === "move" || surface === "current") {
    await bootVideoCards(page)
  } else if (surface === "reader") {
    await j.boot("/Principles/Frames", { keepTutorial: true, initialState: QUIET, beforeNavigate: async p => {
      await p.addInitScript(installPlayerStub, false)
    } })
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  } else {
    await j.boot("/", { keepTutorial: true, beforeNavigate: async p => { await p.addInitScript(installPlayerStub, false) } })
    // The DSL serves `{}` for every dossier chunk; this journey is about a Principle's clips, so it serves that body.
    await page.route("**/static/neural/content/*.json", route => route.fulfill({ json: {
      [base().key]: { overview: "Adjust your supports as pressure changes.", clips: DRAWER_CLIPS } } }))
    await page.evaluate(() => (window as any).__neural._ensureConcepts())
    await expect.poll(() => page.evaluate(() => ((window as any).__neural.concepts || []).length)).toBeGreaterThan(0)
    await page.evaluate(id => (window as any).__neural.openConcept(id), base().id)
    await expect(page.locator(`[data-concept-film="${base().id}"] .ng-clip`)).toHaveCount(2)
  }
  const open = page.locator(OPEN[surface])
  await expect(open).toBeVisible()
  await open.scrollIntoViewIfNeeded()
  if (surface !== "drawer") await j.readerLayoutSettled() // the drawer's boot has no reader page to wait for
  await page.mouse.move(1, 1)
  return j
}

/** Everything a way out must leave as it was (VID1-GO ruling 7). The camera is the frame's own `cam`, which is
 *  what the map draws from (CLAUDE.md §6.2: never `camTarget`). */
const scene = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return {
    paused: !!a.paused, current: a.currentPos ?? null, landing: a._landIdx ?? null, hand: a._choiceHandId ?? null,
    moves: a.moveCount, commits: (a.beats || []).filter((b: any) => b.beat === "commit").length, played: !!a._played,
    row: Math.round(a.optionsRef.current?.scrollLeft || 0), reader: Math.round(a._reader?.root?.scrollTop || 0),
    drawer: { open: !!a.deckShown, view: a._viewMode ?? null, concept: a._conceptId ?? null,
      scroll: Math.round(a.explorerListRef.current?.scrollTop || 0) },
    camera: { ...a.cam },
  }
})

/** A touch tap at the target's measured centre, refused unless the target (or a child) owns that point. */
async function tap(page: Page, selector: string, what: string) {
  const hit = await page.evaluate(sel => {
    const el = document.querySelector(sel)!, r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { x, y, ok: !!top && (top === el || el.contains(top)), who: top ? top.tagName + "." + String((top as HTMLElement).className) : "nothing" }
  }, selector)
  expect(hit.ok, `${what} is reachable by touch where it sits (elementFromPoint is ${hit.who})`).toBe(true)
  await page.touchscreen.tap(hit.x, hit.y)
}

async function press(page: Page, touch: boolean, selector: string, what: string) {
  if (touch) await tap(page, selector, what)
  else await journey(page).clickByMouse(selector, what)
}

/** The theater's rectangle at rest (the 360ms zoom finished), the player inside it, its ✕ and the dim. */
async function opened(page: Page) {
  await expect(page.locator(THEATER + " iframe")).toHaveCount(1)
  await page.locator(THEATER).evaluate(async d => { await Promise.all(d.getAnimations().map(a => a.finished)) })
  return page.evaluate(sel => {
    const d = document.querySelector(sel)!, box = d.getBoundingClientRect(), host = d.querySelector(".ngPlayerHost")!.getBoundingClientRect()
    const x = d.querySelector(".ngClipX")!, xr = x.getBoundingClientRect()
    const xHit = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2)
    const closes = [...document.querySelectorAll("button")].filter(b => /✕|×/.test(b.textContent || "") && b.getClientRects().length && d.contains(b))
    const players = (window as any).__players
    return {
      modal: d.matches(":modal"), dialogs: document.querySelectorAll(sel).length, old: document.querySelectorAll("[data-choice-viewer], .ng-choice-viewer").length,
      box: box.toJSON(), host: host.toJSON(), vw: innerWidth, vh: innerHeight, band: d.querySelectorAll("header, strong, h1, h2, h3").length,
      x: xr.toJSON(), xHit: xHit === x || x.contains(xHit), closes: closes.length,
      player: players.at(-1) && { id: players.at(-1).id, autoplay: players.at(-1).vars.autoplay, state: players.at(-1).state, play: players.at(-1).play, mute: players.at(-1).mute },
      label: d.getAttribute("aria-label"),
    }
  }, THEATER)
}

function expectTheater(o: Awaited<ReturnType<typeof opened>>, where: string, vertical = false) {
  expect(o.modal, where + ": the video is a modal over everything").toBe(true)
  expect(o.dialogs, where + ": one viewer").toBe(1)
  expect(o.old, where + ": the move's old modal is gone").toBe(0)
  expect(o.player, where + ": the press asked the player to play").toMatchObject({ autoplay: 1 })
  expect(o.player!.state, where + ": the video is playing without a second press (the player's own state)").toBe(1)
  expect(o.closes, where + ": ONE ✕").toBe(1)
  expect(o.band, where + ": no title band above or below the video").toBe(0)
  for (const k of ["x", "y", "width", "height"] as const)
    expect(Math.abs((o.host as any)[k] - (o.box as any)[k]), where + ": the video fills its box, no band " + k).toBeLessThan(.5)
  // Width first, capped at 95% of the height, at the clip's own shape: 16:9, or 9:16 for a vertical clip (video-theater.spec
  // pins the zoom and the portrait).
  const ratio = vertical ? 9 / 16 : 16 / 9, w = Math.min(.95 * o.vw, .95 * o.vh * ratio)
  expect(o.box.width, where + ": as wide as the screen allows").toBeCloseTo(w, 0)
  expect(o.box.height, where + ": at the video's own shape").toBeCloseTo(w / ratio, 0)
  // A real hit target: the ✕ owns its centre, is 44px, sits at the video's top-right corner and inside the screen.
  expect(o.xHit, where + ": the ✕ is a real hit target (elementFromPoint)").toBe(true)
  expect([o.x.width, o.x.height], where + ": the ✕ is 44px").toEqual([44, 44])
  expect(Math.abs(o.x.right - o.box.right) + Math.abs(o.x.top - o.box.top), where + ": the ✕ is at the corner").toBeLessThan(1)
  expect(o.x.left >= 0 && o.x.top >= 0 && o.x.right <= o.vw && o.x.bottom <= o.vh, where + ": the ✕ is on screen").toBe(true)
}

/** A point on the dim: over a real control (a move card, the play circle, the reader, the drawer) when one lies outside
 *  the video, else the dim's largest free band. The press must land on the dialog, i.e. on nothing underneath. */
const dimPoint = (page: Page) => page.evaluate(sel => {
  const d = document.querySelector(sel)!, box = d.getBoundingClientRect(), vw = innerWidth, vh = innerHeight
  const outside = (x: number, y: number) => x > 2 && y > 2 && x < vw - 2 && y < vh - 2 && (x < box.left - 2 || x > box.right + 2 || y < box.top - 2 || y > box.bottom + 2)
  const a = (window as any).__neural
  const controls = [...document.querySelectorAll("[data-tech] .ng-choice-title-button, [data-choice-watch], [data-film-play], [data-concept-link], [data-reader-body] a, .ng-logo")]
  for (const el of controls) {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.width && outside(x, y)) return { x, y, over: el.tagName + "." + String((el as HTMLElement).className).slice(0, 40), dialog: document.elementFromPoint(x, y) === d }
  }
  const x = box.left > vh - box.bottom && box.left > box.top ? box.left / 2 : vw / 2
  const y = x === vw / 2 ? (box.top > vh - box.bottom ? box.top / 2 : (box.bottom + vh) / 2) : vh / 2
  return { x, y, over: a ? "the map" : "the page", dialog: document.elementFromPoint(x, y) === d }
}, THEATER)

const players = (page: Page) => page.evaluate(() => (window as any).__players.map((p: any) => ({ play: p.play, destroy: p.destroy, mute: p.mute })))

/** One of the three ways out, by real input: Esc, the ✕ (mouse or touch at its measured centre), or the dim (at a point
 *  the dialog owns, over a control where one lies outside the video). */
async function closeBy(page: Page, touch: boolean, exit: "Esc" | "✕" | "dim") {
  if (exit === "Esc") await page.keyboard.press("Escape")
  else if (exit === "✕") await press(page, touch, THEATER + " .ngClipX", "the theater's ✕")
  else {
    const p = await dimPoint(page)
    expect(p.dialog, `the dim owns the press over ${p.over}: nothing under it takes it`).toBe(true)
    if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
  }
}

/** A control's measured centre, refused unless the control (or a child) owns that point. */
const centre = (page: Page, selector: string) => page.evaluate(sel => {
  const el = document.querySelector(sel)!, r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
  const top = document.elementFromPoint(x, y)
  return { x, y, ok: !!top && (top === el || el.contains(top)) }
}, selector)

for (const [width, height, touch] of [[1440, 900, false], [390, 631, true]] as const) {
  test.describe(`${width}x${height} ${touch ? "touch" : "mouse"}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch })
    for (const surface of ["move", "current", "reader", "drawer"] as Surface[]) {
      for (const exit of ["Esc", "✕", "dim"] as const) {
        test(`VID1 ${surface}: one press plays it in the theater, ${exit} closes it and leaves everything as it was (${width}x${height})`, async ({ page }) => {
          const errors: string[] = []; page.on("pageerror", e => errors.push(e.message))
          await boot(page, surface)
          const before = await scene(page)
          await press(page, touch, OPEN[surface], `the ${surface} video's play control`)
          const o = await opened(page)
          if (surface === "reader") expect(o.player?.id, "the reader's press opened Frames' first clip").toBe(FRAMES_FIRST.id)
          expectTheater(o, surface, surface === "reader" && FRAMES_FIRST.vertical === true)
          if (surface === "move") expect(o.label, "the theater names the move").toBe("Watch Consolidate Mount")
          expect(await players(page), "one player, playing").toEqual([{ play: 1, destroy: 0, mute: 0 }])
          await expect(page.locator(THEATER + " .ngClipX"), "focus enters the theater on its ✕").toBeFocused()
          if (exit === "Esc") await page.keyboard.press("Escape")
          else if (exit === "✕") await press(page, touch, THEATER + " .ngClipX", "the theater's ✕")
          else {
            const p = await dimPoint(page)
            expect(p.dialog, `the dim owns the press over ${p.over}: nothing under it takes it`).toBe(true)
            if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
          }
          await expect(page.locator(THEATER), exit + " closes the video").toHaveCount(0)
          expect(await players(page), exit + " destroys the player: the sound stops").toEqual([{ play: 1, destroy: 1, mute: 0 }])
          await expect(page.locator("iframe[data-test-player]"), "no player is left anywhere").toHaveCount(0)
          await expect(page.locator(OPEN[surface]), exit + " gives focus back to the control that opened it").toBeFocused()
          expect(await scene(page), exit + " leaves the pause, the roll, the row, the reader, the drawer and the camera as they were").toEqual(before)
          expect(errors).toEqual([])
        })
      }
    }

    // VID1-GO ruling 3: a browser that refuses a played-by-script start with sound. Detected from the player's own report;
    // the app mutes and plays at once, YouTube's own unmute control showing; never a second Play. Every surface, the
    // current node's included (before VID1 it showed YouTube's Play there).
    for (const surface of ["move", "current"] as Surface[]) {
      test(`VID1 ${surface}: a refused start plays muted at once, never a second Play (${width}x${height})`, async ({ page }) => {
        await boot(page, surface)
        await page.evaluate(() => { (window as any).__refuseSound = true })
        await press(page, touch, OPEN[surface], `the ${surface} video's play control`)
        await expect(page.locator(THEATER + " iframe")).toHaveCount(1)
        await expect.poll(() => page.evaluate(() => (window as any).__players.at(-1).state), { message: "the refused start still plays, muted" }).toBe(1)
        expect(await players(page), "muted once, then played").toEqual([{ play: 1, destroy: 0, mute: 1 }])
        expect(await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "video_autoplay_muted").length), "the muted start says it fired").toBe(1)
        await page.keyboard.press("Escape")
        await expect(page.locator(THEATER)).toHaveCount(0)
      })
    }

    // VID1-R1 (the reader of #427, fix 1): every test above starts from a RUNNING game, so the pause was proven given back
    // one way only; the reader's mutant R2 (every close un-pauses, close-always-unpauses in the manifest) turned nothing
    // red. These start PAUSED: a close must leave a paused game paused, read again 2s of game time later.
    for (const surface of ["move", "current"] as Surface[]) {
      for (const exit of ["Esc", "✕", "dim"] as const) {
        test(`VID1 ${surface}: a game paused before the press stays paused after ${exit} closes it (${width}x${height})`, async ({ page }) => {
          const j = await boot(page, surface)
          await page.evaluate(() => (window as any).__neural.setPaused(true))
          const before = await scene(page)
          expect(before.paused, "premise: the game is paused").toBe(true)
          await press(page, touch, OPEN[surface], `the ${surface} video's play control`)
          await opened(page)
          await closeBy(page, touch, exit)
          await expect(page.locator(THEATER), exit + " closes the video").toHaveCount(0)
          await j.advance(2000)
          expect((await scene(page)).paused, `a game paused before the press is still paused after ${exit}`).toBe(true)
          expect(await scene(page), exit + " leaves everything as it was").toEqual(before)
        })
      }
    }

    // VID1-R1 (fix 2a): a quick double press on a play control put its second press inside the player while it zoomed
    // in; focus went into the provider's frame and Esc no longer closed the video (the reader: 2 of 2, a double click at
    // 1440x900 and two taps 90ms apart at 390x631). The player takes no press until the zoom has settled: one video,
    // played once, focus on the ✕, and Esc closes it. After the zoom a press on the player is the player's (with YouTube,
    // pause or seek); Esc then stays in its frame, which is said in docs/Neural.md, and the ✕ still closes it.
    for (const surface of ["move", "current"] as Surface[]) {
      test(`VID1 ${surface}: a double press opens one video and Esc still closes it; after the zoom the player takes a press (${width}x${height})`, async ({ page }) => {
        await boot(page, surface)
        const c = await centre(page, OPEN[surface])
        expect(c.ok, `the ${surface} video's play control owns its centre`).toBe(true)
        if (touch) { await page.touchscreen.tap(c.x, c.y); await page.waitForTimeout(90); await page.touchscreen.tap(c.x, c.y) }
        else await page.mouse.dblclick(c.x, c.y)
        await expect(page.locator(THEATER + " iframe")).toHaveCount(1)
        await page.locator(THEATER).evaluate(async d => { await Promise.all(d.getAnimations().map(a => a.finished)) })
        await expect.poll(() => page.evaluate(() => (window as any).__players[0]?.play)).toBeGreaterThan(0)
        expect(await page.evaluate(() => ({
          theaters: document.querySelectorAll(".ng-video-theater").length,
          players: (window as any).__players.map((p: any) => ({ play: p.play, destroy: p.destroy })),
          onX: !!document.activeElement?.matches(".ng-video-theater .ngClipX"),
        })), "a double press: one video, played once, focus still on the ✕").toEqual({ theaters: 1, players: [{ play: 1, destroy: 0 }], onX: true })
        await page.keyboard.press("Escape")
        await expect(page.locator(THEATER), "Esc closes it").toHaveCount(0)
        // After the zoom: the player owns its own point, and a press there reaches it (the stub's own Play: play 2).
        await press(page, touch, OPEN[surface], `the ${surface} video's play control`)
        await opened(page)
        const p = await centre(page, THEATER + " iframe")
        expect(p.ok, "after the zoom the player owns its own point").toBe(true)
        if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
        await expect.poll(() => page.evaluate(() => (window as any).__players.at(-1).play), { message: "after the zoom a press on the player is the player's" }).toBe(2)
        await press(page, touch, THEATER + " .ngClipX", "the theater's ✕")
        await expect(page.locator(THEATER), "the ✕ closes it after a press inside the player").toHaveCount(0)
      })
    }
  })
}

// A RUNNING game runs again when the move's video closes by the dim (the modal restored `wasPaused`; VID1 keeps that, and
// the current card's theater now does too). VID1-R1: this test was titled "the dim over a card commits nothing" and, at
// 1440x900, pressed at (4,4) on the map (every card there lies under the video); the press over another move's card is
// the 390x631 test below.
test("VID1 a running game is running again after the move's video closes by the dim (1440x900)", async ({ page }) => {
  const j = await boot(page, "move")
  await page.evaluate(() => (window as any).__neural.setPaused(false))
  const before = await scene(page)
  expect(before.paused, "premise: the game runs").toBe(false)
  await j.clickByMouse(OPEN.move, "Watch the move")
  await opened(page)
  expect(await page.evaluate(() => (window as any).__neural.paused), "watching pauses the game").toBe(true)
  await closeBy(page, false, "dim")
  await expect(page.locator(THEATER)).toHaveCount(0)
  expect(await scene(page), "nothing committed, and the game runs again").toEqual(before)
})

// VID1-R1 (the reader of #427, fix 3): the dim over ANOTHER MOVE'S CARD, pressed for real. 390x631 is the size where a
// card lies outside the video (the reader: S-Mount Transition at (12,484), the video's bottom at 420); at 1440x900,
// 1024x768, 1024x600 and 390x844 every card lies under it. The point is measured: before the video opens, a point where
// that card owns `elementFromPoint`; after, the same point outside the video, owned by the dialog. No such point fails
// the test (it would have no subject). The reader's mutant R1 (a dim press that also clicks what is under it,
// dim-press-falls-through in the manifest) is red here.
test.describe("390x631 touch: the dim over another move's card", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })
  test("VID1 the dim over another move's card commits nothing and opens nothing (390x631)", async ({ page }) => {
    await boot(page, "move")
    await page.evaluate(() => (window as any).__neural.setPaused(false))
    const spots = await page.evaluate(sel => {
      const own = document.querySelector(sel)!.closest("[data-tech]"), out: { x: number; y: number; tech: string }[] = []
      for (const card of document.querySelectorAll<HTMLElement>("[data-tech]")) {
        if (card === own) continue
        const r = card.getBoundingClientRect()
        for (const fx of [.2, .5, .8]) for (const fy of [.2, .5, .8]) {
          const x = r.left + fx * r.width, y = r.top + fy * r.height
          if (x > 1 && y > 1 && x < innerWidth - 1 && y < innerHeight - 1 && document.elementFromPoint(x, y)?.closest("[data-tech]") === card)
            out.push({ x, y, tech: card.dataset.tech! })
        }
      }
      return out
    }, OPEN.move)
    const before = await scene(page)
    expect(before.paused, "premise: the game runs").toBe(false)
    await press(page, true, OPEN.move, "the move's play circle")
    await opened(page)
    const spot = await page.evaluate(({ sel, spots }) => {
      const d = document.querySelector(sel)!, b = d.getBoundingClientRect()
      return spots.find(s => {
        const card = document.querySelector(`[data-tech="${CSS.escape(s.tech)}"]`)!.getBoundingClientRect()
        const outside = s.x < b.left - 2 || s.x > b.right + 2 || s.y < b.top - 2 || s.y > b.bottom + 2
        const still = s.x > card.left && s.x < card.right && s.y > card.top && s.y < card.bottom
        return outside && still && document.elementFromPoint(s.x, s.y) === d
      }) || null
    }, { sel: THEATER, spots })
    expect(spot, "another move's card lies under the dim, outside the video, at a point the dim owns").not.toBeNull()
    await page.touchscreen.tap(spot!.x, spot!.y)
    await expect(page.locator(THEATER), "the dim closes the video").toHaveCount(0)
    const after = await scene(page)
    expect({ commits: after.commits - before.commits, videos: (await players(page)).length },
      `the dim over ${spot!.tech}: nothing committed, no second video`).toEqual({ commits: 0, videos: 1 })
    expect(after, "nothing committed, and the game runs again").toEqual(before)
  })
})
