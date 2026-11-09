import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * U109 b (owner, 2026-11-09): a move with no video keeps the full film card, and the card asks for one: "maybe even ask the
 * user to add it if he wants, like using the same feedback form we got? so the user can suggest a video?". The card says there
 * is no video of this exact move yet, and its button opens the existing Feedback form about that move, with a placeholder
 * asking for the link and the second it starts. The report keeps the form's own event, `neural_issue_reported`, and says what
 * it is with `kind: "video"`; an ordinary report carries no `kind`.
 *
 * THE CLAIMS, each as a differential against a control:
 *   - the no-video card is the size of a one-clip film card: its media box equals the clip box of the same move with ONE
 *     authored clip, at the same viewport (the control is that authored clip, served through the real dossier fetch);
 *   - it names the move and its seat, and has no ✕ (a clip card keeps its ✕);
 *   - "Suggest a video", pressed by mouse, opens Feedback about THAT move, ticked, with the video placeholder, and Send emits
 *     one `neural_issue_reported` carrying `kind: "video"` and the move's id;
 *   - the menu's Feedback, opened after it, is the ordinary form again and sends no `kind`.
 * HARNESS: the DSL serves every dossier chunk as `{}`, a dossier that never answered, and then no film card shows at all. So
 * both arms serve Mount Top's real dossier and differ only in its clips, and no claim here rests on what the harness omits.
 * UNCOVERED: PostHog delivery (capture is stubbed) and the copy's line breaks in the real font (the DSL stubs Google Fonts).
 * Red-proof is recorded at the foot of this file.
 */

const VIDEO_PLACEHOLDER = "Paste the video's link, and the second the move starts if you know it."
const ISSUE_PLACEHOLDER = "What’s wrong, missing or confusing? Where were you when you noticed?"
const FILM = "[data-land-film]", NONE = FILM + " .ng-film-none", SUGGEST = NONE + " [data-film-suggest]"

// Both arms serve Mount Top's own dossier from the built wire and differ only in its clips: none, or one authored clip (the
// control). The DSL alone serves `{}`, a dossier that never answered, which shows no film card at all, so it cannot stand in.
const CHUNKS = "**/static/neural/content/*.json"
let clips: object[] = []
const authored = async (route: any) => {
  const file = new URL(route.request().url()).pathname.split("/").pop()!
  const data = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", file), "utf8"))
  if (data["Mount|Top"]) data["Mount|Top"].clips = clips
  await route.fulfill({ json: data })
}

async function landMount(page: Page, n: 0 | 1) {
  const j = journey(page)
  clips = n ? [{ id: "ddddddddddd", title: "Mount Top", duration: 600 }] : []
  await j.boot("/", { beforeNavigate: async p => { await p.route(CHUNKS, authored) } })
  await j.land("Mount Top")
  await expect(page.locator(FILM)).toBeVisible()
  await j.readerLayoutSettled()
  return j
}

const box = (page: Page, selector: string) => page.locator(selector).first().evaluate(e => {
  const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }
})

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`@curated U109 b: a move with no video asks for one at a one-clip card's size, and the ask is Feedback about that move at ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp)
    const control = await (async () => {
      await landMount(page, 1)
      await expect(page.locator(FILM + " .ng-clip"), "control: the authored clip is the card's one clip").toHaveCount(1)
      await expect(page.locator(SUGGEST), "control: a move with a video never asks for one").toHaveCount(0)
      await expect(page.locator(FILM + " [data-film-close]"), "control: a clip card keeps its ✕").toHaveCount(1)
      return box(page, FILM + " .ng-clip")
    })()

    const j = await landMount(page, 0)
    const shown = await page.evaluate(() => {
      const a = (window as any).__neural, n = a._landFilmEl._ngVideoNode
      ;(window as any).__phEvents = []
      ;(window as any).posthog = { capture: (e: string, p: any) => (window as any).__phEvents.push({ e, p }) }
      return { id: n.id, name: a.graphName(n) }
    })
    await expect(page.locator(NONE + " b")).toHaveText("No video of this move yet")
    await expect(page.locator(NONE + " span")).toHaveText("We only show a video that teaches exactly this move. Know one?")
    await expect(page.locator(SUGGEST)).toHaveText("Suggest a video")
    await expect(page.locator(FILM + " .ng-current-title"), "the card names the move").toContainText(shown.name)
    await expect(page.locator(FILM + " footer"), "and its seat").toContainText("Top")
    await expect(page.locator(FILM + " [data-film-close]"), "nothing to dismiss: no ✕").toHaveCount(0)
    expect(await box(page, NONE), "the no-video card is the size of a one-clip card").toEqual(control)

    await j.clickByMouse(SUGGEST, "Suggest a video")
    await expect(page.locator("[data-feedback-title]"), "Suggest a video opens Feedback").toHaveText("Feedback")
    const ctx = page.locator("[data-feedback-ctx]")
    await expect(ctx, "the move rides along by default").toBeChecked()
    await expect(ctx.locator("..")).toHaveText("about: " + shown.name)
    await expect(page.locator("[data-feedback-text]"), "the form asks for the link and the second").toHaveAttribute("placeholder", VIDEO_PLACEHOLDER)
    await j.clickByMouse("[data-feedback-text]", "the Feedback text box")
    await page.keyboard.type("  https://youtu.be/ddddddddddd?t=42  ")
    await j.clickByMouse("[data-feedback-send]", "send the suggestion")
    const sent = await page.evaluate(() => (window as any).__phEvents.filter((x: any) => /^neural_(issue_reported|technique_requested)$/.test(x.e)))
    expect(sent, "one report").toHaveLength(1)
    expect(sent[0].e, "the form's own event").toBe("neural_issue_reported")
    expect(sent[0].p, "a video suggestion about the shown move").toMatchObject({ kind: "video", node: shown.id, text: "https://youtu.be/ddddddddddd?t=42" })

    await j.openAccountMenu()
    await j.clickByMouse("[data-menu-feedback]", "the menu's Feedback")
    await expect(page.locator("[data-feedback-text]"), "the menu opens the ordinary form").toHaveAttribute("placeholder", ISSUE_PLACEHOLDER)
    await j.clickByMouse("[data-feedback-text]", "the Feedback text box")
    await page.keyboard.type("An ordinary report")
    await j.clickByMouse("[data-feedback-send]", "send the report")
    const both = await page.evaluate(() => (window as any).__phEvents.filter((x: any) => x.e === "neural_issue_reported"))
    expect(both, "two reports").toHaveLength(2)
    expect("kind" in both[1].p, "an ordinary report says no kind").toBe(false)
  })
}

// Red-proof (v1.252.0, tests/artifacts/neural_app_mutants.mjs on the served neural.js, the 1440 test, each against a green
// baseline of the same test):
//   film-suggest-unwired ........ the button's listener never attached ........... killed
//   film-suggest-node-lost ...... openFeedback() without the move ................ killed
//   film-suggest-kind-lost ...... the report says no kind ........................ killed
//   film-none-close-back ........ the ✕ on the no-video card again (U104) ........ killed
// No surviving controls. NOT COVERED: the card's own CSS (its 16:9 box is the shared `.ng-current-card .ng-choice-media` rule).
