import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * HIDESEC2 (owner, U131, 2026-11-11): "b2, Settings own it, with the message in place", and his note: "This is also valid for other
 * sections that are closed ... the name of the section should be bold or some other style to differentiate it". A part's ✕ (Moves,
 * Questions, the video, any article section) hides it and leaves nothing behind; a message stands in its place for five seconds,
 * the part's name bold, "Settings" a press that opens Settings at that part's switch, and Undo. Settings > Rolling owns the way back.
 * This REVERSES the shipped rule (D-338, U11, U25 a): a closed part left a label with a slashed eye, and a closed section waited in a
 * "Hidden sections" fold at the article's end. The journeys that pinned those were rewritten to this rule in the same PR.
 *
 * THE PRESS RULE (reader.src.js): a press aimed at a message never lands on something else. HIDESEC1 measured the first build: when the
 * message left, what was under it moved up a line, and a press aimed at Undo closed the film that moved there.
 *
 * Every press is a player's: a touch tap at 390 and a real mouse at 1440, at a measured centre that elementFromPoint resolves to the
 * control (CLAUDE.md §6.1, §6.3). The message's timers are wall-clock, not the game's pumped clock, so these journeys wait on the
 * message's own phase (data-phase) rather than on a guessed delay.
 *
 * Harness: the DSL serves {} for dossier chunks, so there is no film; these journeys route the real chunks, as reading-mode does.
 *
 * MUTANTS: tests/artifacts/article_sections_mutants.mjs, the hidesec2-* rows (one per claim, each red at its own assertion).
 */
const NODE = "/Positions/Mount/Top"
const READY = '[data-reader][data-reader-ready="true"]'
const SENTENCE = (name: string) => name + " hidden. You can show it again in Settings."
type Part = { key: string, name: string, close: string, body: string, on: string }
const PARTS: Part[] = [
  { key: "card", name: "Questions", close: "[data-land-close]", body: ".ng-landcard", on: "landCard" },
  { key: "hand", name: "Moves", close: "[data-hand-close]", body: ".ng-optionrow", on: "landHand" },
  { key: "videos", name: "Video", close: "[data-film-close]", body: "[data-land-media-slot]", on: "readerSection.videos" },
  { key: "principles", name: "Essential principles", close: "[data-section-toggle=principles]", body: ".ng-section-card[data-section-type=principles]", on: "readerSection.principles" },
]
const VIEWPORTS = [{ width: 390, height: 844, touch: true }, { width: 1440, height: 900, touch: false }]

async function boot(page: Page) {
  const j = journey(page)
  await j.boot(NODE, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", r => r.continue()) } })
  await j.advance(5000)
  await expect(page.locator(READY)).toBeVisible({ timeout: 20000 })
  await expect(page.locator("[data-film-close]"), "premise: this node has its film").toHaveCount(1, { timeout: 20000 })
  await j.readerLayoutSettled()
  // Every press and click from here on, as the page saw it (document capture, after the window's shield).
  await page.evaluate(() => {
    const w = window as any; w.__presses = []
    for (const type of ["pointerdown", "click"]) document.addEventListener(type, e => w.__presses.push({ type, target: e.target as Element }), true)
  })
  return j
}
const box = (page: Page, sel: string) => page.evaluate(s => {
  const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
  if (!e) return null
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, left: r.left, width: r.width, height: r.height }
}, sel)
/** A player's press at a control's measured centre: the point must resolve to the control, then a tap (390) or a mouse click (1440). */
async function press(page: Page, j: any, sel: string, touch: boolean, what: string) {
  if (!touch) return j.clickByMouse(sel, what)
  const b = await box(page, sel)
  expect(b, `${what}: on screen`).not.toBeNull()
  const hit = await page.evaluate(([x, y, s]) => !!document.elementFromPoint(x as number, y as number)?.closest(s as string), [b!.x, b!.y, sel])
  expect(hit, `${what}: a tap at its centre reaches it`).toBe(true)
  await page.touchscreen.tap(b!.x, b!.y)
}
const tapOrClick = (page: Page, x: number, y: number, touch: boolean) => touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
/** Brings a part on screen: the hand's ✕ docks only beside a visible tray, a section sits under the stage. */
async function reveal(page: Page, j: any, p: Part) {
  await page.evaluate(sel => {
    const root = document.querySelector("[data-reader]") as HTMLElement, el = document.querySelector(sel) as HTMLElement
    root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - 120
  }, p.body)
  await j.readerLayoutSettled(); await j.advance(40); await j.readerLayoutSettled()
}
const setting = (page: Page, key: string) => page.evaluate(k => (window as any).__neural.get(k, true), key)
const phase = (page: Page, key: string) => page.evaluate(k => (document.querySelector(`[data-hidesec-notice="${k}"]`) as HTMLElement | null)?.dataset.phase ?? null, key)

for (const vp of VIEWPORTS) test.describe(`${vp.width}`, () => {
  test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch })
  const how = vp.touch ? "by touch" : "by mouse"
  test(`@curated every part closes into its message in place, bold name, and returns by Undo and by Settings (${vp.width}, ${how})`, async ({ page }) => {
    const j = await boot(page)
    for (const p of PARTS) {
      // 1. Close it: nothing is left in its place but the message, which stands where the part stood.
      await reveal(page, j, p)
      const was = await box(page, p.body)
      expect(was, `premise: ${p.name} is open`).not.toBeNull()
      await press(page, j, p.close, vp.touch, `${p.name}'s close`)
      await j.readerLayoutSettled()
      expect(await setting(page, p.on), `${p.name}: the ✕ turns its own setting off`).toBe(false)
      const msg = `[data-hidesec-notice="${p.key}"]`
      const at = await box(page, msg)
      expect(at, `${p.name}: its message shows`).not.toBeNull()
      expect(Math.abs(at!.top - was!.top), `${p.name}: in place (its top within one step of the part's)`).toBeLessThanOrEqual(16)
      // WAS (D-338, U11): a closed Moves or Questions left a label with a slashed eye; a closed section moved to "Hidden sections".
      await expect(page.locator(`.ng-reader-closed-part [data-game-open="${p.key}"]`), `${p.name}: no label left behind`).toBeHidden()
      await expect(page.locator(".ng-reader-hidden"), "no Hidden sections fold").toBeHidden()
      // 2. The name stands out: bold, and brighter than the sentence around it. The live region says the plain sentence.
      const look = await page.evaluate(sel => {
        const m = document.querySelector(sel)!, b = m.querySelector("b")!, line = b.parentElement!
        return { name: b.textContent, text: line.textContent, weight: Number(getComputedStyle(b).fontWeight), lineWeight: Number(getComputedStyle(line).fontWeight),
          bright: getComputedStyle(b).color !== getComputedStyle(line).color, live: document.querySelector(".ng-sr-only[role=status]")?.textContent }
      }, msg)
      expect(look.name, `${p.name}: the name is its own word`).toBe(p.name)
      expect(look.text, `${p.name}: the sentence`).toBe(SENTENCE(p.name))
      expect(look.weight - look.lineWeight, `${p.name}: the name is bolder than the sentence`).toBeGreaterThanOrEqual(300)
      expect(look.bright, `${p.name}: and set in another light`).toBe(true)
      await expect.poll(() => page.evaluate(() => document.querySelector(".ng-sr-only[role=status]")?.textContent), { message: "the screen reader's sentence is plain" }).toBe(SENTENCE(p.name))
      // 3. Undo brings it back, and the message goes with nothing left.
      await press(page, j, `${msg} [data-hidesec-undo]`, vp.touch, `${p.name}'s Undo`)
      await j.readerLayoutSettled()
      expect(await setting(page, p.on), `${p.name}: Undo turns it back on`).toBe(true)
      await expect(page.locator(msg), `${p.name}: its message goes`).toHaveCount(0)
      expect(await box(page, p.body), `${p.name}: and the part is back`).not.toBeNull()
      // 4. Settings: the press in the sentence opens Settings at this part's switch, and that switch brings it back.
      await reveal(page, j, p)
      await press(page, j, p.close, vp.touch, `${p.name}'s close, again`)
      await j.readerLayoutSettled()
      await press(page, j, `${msg} [data-hidesec-settings]`, vp.touch, `${p.name}'s Settings`)
      const aimed = page.locator("[data-settings-aimed]")
      await expect(aimed, `${p.name}: Settings opens at its switch`).toBeVisible({ timeout: 10000 })
      const control = p.key === "videos" ? '[data-layer-toggle="film"]' : ["card", "hand"].includes(p.key) ? `[data-layer-toggle="${p.key}"]` : `[data-section-setting="${p.key}"]`
      await expect(aimed.locator(control), `${p.name}: the aimed row is its own`).toHaveCount(1)
      await expect(page.locator(control), `${p.name}: focused`).toBeFocused()
      const inView = await page.evaluate(sel => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }, control)
      expect(inView, `${p.name}: in view`).toBe(true)
      await press(page, j, control, vp.touch, `${p.name}'s switch`)
      await expect.poll(() => setting(page, p.on), { message: `${p.name}: the switch brings it back` }).toBe(true)
      await expect(page.locator(msg), `${p.name}: and its message goes`).toHaveCount(0)
      await page.keyboard.press("Escape")
      await expect(page.locator("[data-settings-aimed]"), "Escape closes Settings").toBeHidden()
      await page.evaluate(() => { (document.querySelector("[data-reader]") as HTMLElement).scrollTop = 0 })
    }
    // 5. Once the messages have gone, nothing is left in their places: no label, no tile, no "Hidden sections" fold.
    await reveal(page, j, PARTS[3])
    await press(page, j, PARTS[3].close, vp.touch, "Essential principles' close, last")
    await page.evaluate(() => { (document.querySelector("[data-reader]") as HTMLElement).scrollTop = 0 })
    await j.readerLayoutSettled()
    await press(page, j, "[data-land-close]", vp.touch, "Questions' close, last")
    if (!vp.touch) await page.mouse.move(vp.width - 8, 8)
    await page.waitForFunction(() => !document.querySelector("[data-hidesec-notice]"), null, { timeout: 15000 })
    await j.readerLayoutSettled()
    // WAS (D-338, U25 a): the label "Questions" with a slashed eye, and a "Hidden sections (1)" fold at the article's end.
    await expect(page.locator('[data-game-open="card"]'), "no Questions label").toBeHidden()
    await expect(page.locator(".ng-section-card[data-section-type=principles]"), "no principles tile, open or closed").toBeHidden()
    await expect(page.locator(".ng-reader-hidden"), "no Hidden sections fold").toBeHidden()
    expect({ card: await setting(page, "landCard"), principles: await setting(page, "readerSection.principles") }, "both stay hidden").toEqual({ card: false, principles: false })
    if (!vp.touch) {
      // 1440: the index still shows a closed part and its row still reopens it (HIDESEC2, item 8).
      await expect(page.locator('[data-toc-type="card"]'), "the closed Questions row reads closed").toHaveAttribute("data-collapsed", "true")
      await j.clickByMouse('[data-toc-type="card"] a', "the Questions index row")
      await expect.poll(() => setting(page, "landCard")).toBe(true)
    }
  })

  test(`@curated the press rule: a press aimed at the message never lands on something else (${vp.width}, ${how})`, async ({ page }) => {
    // The phone runs without motion (no fade), the desktop with it: both paths of leaving.
    await page.emulateMedia({ reducedMotion: vp.touch ? "reduce" : "no-preference" })
    const j = await boot(page)
    const away = async () => { if (!vp.touch) await page.mouse.move(vp.width - 8, 8) }
    const presses = () => page.evaluate(() => { const w = window as any, out = w.__presses.map((p: any) => ({ type: p.type, inMessage: !!p.target.closest?.("[data-hidesec-notice]"), what: p.target.tagName + "." + String(p.target.className).slice(0, 24) })); w.__presses = []; return out })
    await press(page, j, "[data-land-close]", vp.touch, "Questions' close")
    await away()
    const undo = (await box(page, '[data-hidesec-notice="card"] [data-hidesec-undo]'))!
    await presses()
    // A. It stays while it holds a mouse (1440): over it for longer than its five seconds, it does not leave.
    if (!vp.touch) {
      await page.mouse.move(undo.x - 40, undo.y)
      await page.waitForTimeout(6500)
      expect(await phase(page, "card"), "a mouse over it holds it").toBe("on")
      await away()
    }
    // B. The moment it starts to leave, a press at Undo lands on the message: by mouse the hover brings it back and Undo takes the press;
    // by touch the press on its place brings it back (Undo had stopped taking presses, so it does not fire). Never on the film below.
    await page.waitForFunction(() => (document.querySelector('[data-hidesec-notice="card"]') as HTMLElement)?.dataset.phase === "leaving", null, { polling: "raf", timeout: 10000 })
    await tapOrClick(page, undo.x, undo.y, vp.touch)
    const atLeave = await presses()
    expect(atLeave.length, "premise: the press was seen").toBeGreaterThan(0)
    expect(atLeave.filter(p => !p.inMessage), "a press at the moment of leaving lands on the message").toEqual([])
    if (vp.touch) {
      expect(await phase(page, "card"), "the press brings the message back").toBe("on")
      expect(await setting(page, "landCard"), "and Undo did not fire").toBe(false)
      // The tap's click lands on (and focuses) the button under it; a finger never takes focus back, so focus must not hold it.
      await expect.poll(() => phase(page, "card"), { message: "after the finger lifts it leaves again (a tap's focus does not hold it)", timeout: 6000, intervals: [50] }).not.toBe("on")
    } else {
      expect(await setting(page, "landCard"), "by mouse the hover brought it back and Undo took the press").toBe(true)
      await press(page, j, "[data-land-close]", false, "Questions' close, again"); await away()
    }
    // C. When the place closes, what was under the message moves up into it. A press at Undo in that moment is swallowed whole.
    const filmShown = () => setting(page, "readerSection.videos")
    await page.waitForFunction(() => !document.querySelector('[data-hidesec-notice="card"]'), null, { polling: "raf", timeout: 12000 })
    await presses()
    const moved = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x as number, y as number); return e ? e.tagName + "." + String(e.className).slice(0, 30) : null }, [undo.x, undo.y])
    await tapOrClick(page, undo.x, undo.y, vp.touch)
    expect(await presses(), `a press in the closed place, just after it closes, reaches nothing (under it now: ${moved})`).toEqual([])
    expect({ film: await filmShown(), card: await setting(page, "landCard"), settings: await page.locator("[data-settings-aimed],[data-settings-load]").count() },
      "and changes nothing").toEqual({ film: true, card: false, settings: 0 })
    // D. The control: a moment later the same press reaches what moved there, so the claim above is not about an empty spot.
    await page.waitForTimeout(700)
    await tapOrClick(page, undo.x, undo.y, vp.touch)
    const later = await presses()
    expect(later.length, `later, the press reaches what moved there (${moved})`).toBeGreaterThan(0)
    expect(later.some(p => p.inMessage), "and that is not a message").toBe(false)
  })
})

test.describe("390 several", () => {
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test("@curated several closed in a row: one message per part, in place, and none moves while another stands (390, by touch)", async ({ page }) => {
  const j = await boot(page)
  // Each message's removal, stamped as it happens.
  await page.evaluate(() => {
    const w = window as any; w.__gone = {}
    new MutationObserver(list => { for (const m of list) for (const n of m.removedNodes) { const k = (n as HTMLElement).dataset?.hidesecNotice; if (k) w.__gone[k] = performance.now() } })
      .observe(document.body, { childList: true, subtree: true })
  })
  await press(page, j, "[data-hand-close]", true, "Moves' close")
  await page.waitForTimeout(1500)
  await press(page, j, "[data-land-close]", true, "Questions' close")
  await j.readerLayoutSettled()
  const hand = (await box(page, '[data-hidesec-notice="hand"]'))!, card = (await box(page, '[data-hidesec-notice="card"]'))!
  expect(hand && card, "two messages, one per part").toBeTruthy()
  expect(card.top, "each in its own place: Questions under Moves").toBeGreaterThan(hand.top + hand.height - 1)
  // Moves' message leaves first; its place holds, so Questions' message does not move while it stands.
  await page.waitForFunction(() => (document.querySelector('[data-hidesec-notice="hand"]') as HTMLElement)?.dataset.phase === "leaving", null, { polling: "raf", timeout: 10000 })
  // Until Questions' message starts to leave, Moves' place holds, and Questions' message neither moves nor goes.
  for (let i = 0; ; i++) {
    expect(i, "Questions' message leaves in its own time").toBeLessThan(80)
    if (await phase(page, "card") === "leaving") break
    const now = await box(page, '[data-hidesec-notice="card"]')
    expect(await box(page, '[data-hidesec-notice="hand"]'), "Moves' place holds while Questions' message stands").not.toBeNull()
    expect(now, "Questions' message still stands while Moves' leaves").not.toBeNull()
    expect(now!.top, "Questions' message has not moved").toBeCloseTo(card.top, 0)
    await page.waitForTimeout(100)
  }
  // Both places close together, in one step.
  await page.waitForFunction(() => !document.querySelector("[data-hidesec-notice]"), null, { timeout: 12000 })
  const gone = await page.evaluate(() => (window as any).__gone)
  expect(Math.abs(gone.hand - gone.card), "the two places close in the same step").toBeLessThan(1)
  expect(await setting(page, "landHand"), "and both parts stay hidden").toBe(false)
  await expect(page.locator("[data-game-open]:visible"), "with no label left in either place").toHaveCount(0)
  expect(await setting(page, "landCard")).toBe(false)
  // Each Undo brings back its own part only.
  await page.evaluate(() => { const a = (window as any).__neural; a.set("landHand", true); a.set("landCard", true); a._applyLayers() })
  await j.readerLayoutSettled()
  await press(page, j, "[data-land-close]", true, "Questions' close")
  await j.readerLayoutSettled()
  await press(page, j, "[data-hand-close]", true, "Moves' close")
  await j.readerLayoutSettled()
  await press(page, j, '[data-hidesec-notice="hand"] [data-hidesec-undo]', true, "Moves' Undo")
  await j.readerLayoutSettled()
  expect({ hand: await setting(page, "landHand"), card: await setting(page, "landCard") }, "Moves' Undo brings back Moves only").toEqual({ hand: true, card: false })
  await expect(page.locator('[data-hidesec-notice="card"]'), "Questions' message still stands").toHaveCount(1)
})
})

test("@curated Videos during play now switches the video: it writes the Video section's own setting (1440, by mouse)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await boot(page)
  const film = () => page.evaluate(() => { const f = (window as any).__neural._landFilmEl; return !!f && !f.hidden && f.getClientRects().length > 0 })
  expect(await film(), "premise: the film shows").toBe(true)
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"))
  // WAS: the row wrote landFilm, which nothing reads once the reader is up, so the film stayed (measured live, 2026-11-11).
  await page.locator('[data-layer-toggle="film"]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-layer-toggle="film"]', "Videos during play")
  await expect.poll(film, { message: "the film goes" }).toBe(false)
  expect(await setting(page, "readerSection.videos"), "through the Video section's setting").toBe(false)
  await expect(page.locator('[data-layer-toggle="film"]')).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator('[data-section-setting="videos"]'), "the Article sections' Video box agrees").not.toBeChecked()
  await page.locator('[data-layer-toggle="film"]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-layer-toggle="film"]', "Videos during play, again")
  await expect.poll(film, { message: "and comes back" }).toBe(true)
})
