import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"
import { installPlayerStub } from "../fixtures/video-cards"

/** v1.247.0 — escape fronts are keyed by submission + exact card label.
 * The harness normally serves EMPTY dossiers and aborts YouTube: explicitly
 * serve a fixture through the dossier route and record the player arguments.
 * This guards app selection/playback, not availability or correctness of real videos.
 * No content JSON or submission choice identities are changed by this fixture.
 *
 * Named source mutants in tests/artifacts/escape_clips_mutants.py:
 * escape_target / escape_queue / escape_label / escape_first / escape_start
 *   -> "escape clips: own cards ...";
 * defender_reel_fallback -> "escape clips: no label entry ...";
 * escape_front -> "escape clips: unapproved first ...";
 * escape_later -> "escape clips: approved later ...";
 * escape_truthy -> "escape clips: truthy front ...";
 * threat_escape_excluded -> "escape clips: opponent threats ...".
 */
const NAME = "Triangle Choke from Triangle Control"
const POSTURE = "Posture up", STACK = "Stack escape"
const POSTURE_CLIP = { id: "aaaaaaaaaaa", title: POSTURE, start: 123, duration: 559, front: true }
const STACK_CLIP = { id: "bbbbbbbbbbb", title: STACK, start: 47, duration: 310, front: true }
const REEL = { id: "ccccccccccc", title: "General defender reel", front: true }
const OPPOSITE = { id: "ddddddddddd", title: "Attacker decoy", start: 9, front: true }
const LATER = { id: "eeeeeeeeeee", title: "Later alternate", duration: 10, front: true }
type Case = "approved" | "no escapes" | "no label entry" | "unapproved first" | "approved later" | "truthy front"

function escapesFor(kind: Case) {
  const escapes: Record<string, any[]> = {
    [POSTURE]: [{ ...POSTURE_CLIP }, { ...LATER }],
    [STACK]: [{ ...STACK_CLIP }],
  }
  if (kind === "no label entry") {
    delete escapes[POSTURE]
    escapes[POSTURE.toLowerCase()] = [{ ...POSTURE_CLIP }]
  }
  if (kind === "unapproved first") escapes[POSTURE] = [{ ...POSTURE_CLIP, front: false }]
  if (kind === "approved later") escapes[POSTURE] = [{ ...POSTURE_CLIP, front: false }, { ...LATER }]
  if (kind === "truthy front") escapes[POSTURE] = [{ ...POSTURE_CLIP, front: "true" }]
  return escapes
}

async function bootEscapes(page: Page, role: "Attacker" | "Defender", kind: Case = "approved") {
  const j = journey(page), errors: string[] = []
  let served = 0
  page.on("pageerror", error => errors.push(error.message))
  await j.boot(`/Submissions/Triangle-Choke/from-Triangle-Control/${role}`, {
    beforeNavigate: async p => {
      await p.addInitScript(installPlayerStub, false)
      await p.route("**/static/neural/content/*.json", async route => {
        const file = new URL(route.request().url()).pathname.split("/").pop()!
        const data = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", file), "utf8"))
        if (data[NAME]) {
          served++
          const { defender, attacker } = data[NAME].perspectives
          defender.authored = true
          defender.clips = [{ ...REEL }]
          if (kind === "no escapes") delete defender.escapes
          else defender.escapes = escapesFor(kind)
          // Both reels and even an attacker escape entry are plausible decoys.
          attacker.clips = [{ ...OPPOSITE }]
          attacker.escapes = { [POSTURE]: [{ ...OPPOSITE }], [STACK]: [{ ...OPPOSITE }] }
        }
        await route.fulfill({ json: data })
      })
    },
  })
  await j.advance(4000)
  const group = role === "Defender" ? "you" : "opponent"
  const cards = page.locator(`[data-choice-group="${group}"] [data-choice-action="escape"]`)
  await expect(cards).toHaveCount(2)
  // A missed route must fail even a negative case; '{}' alone is not evidence.
  await expect.poll(() => served, { message: "submission dossier fixture was served" }).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(name => {
    const a = (window as any).__neural
    return (window as any).NG_CONTENT?.decks[name]?.perspectives?.defender?.clips?.[0]?.id === "ccccccccccc"
      && !(a._choiceMediaActive > 0) && !a._choiceMediaQueue?.length
  }, NAME)).toBe(true)
  const card = (label: string) => cards.filter({ has: page.locator(".ngchoice-title", { hasText: new RegExp(`^${label}$`) }) })
  return { j, group, cards, card, errors }
}

for (const [role, title] of [["Defender", "own cards"], ["Attacker", "opponent threats"]] as const) {
  test(`@curated escape clips: ${title} show the exact first clip and watch its start`, async ({ page }) => {
    const { j, group, card, errors } = await bootEscapes(page, role)
    const before = await page.evaluate(() => {
      const a = (window as any).__neural
      return { hand: a._choiceHandId, pos: a.currentPos, moves: a.moveCount, commits: a.beats.filter((b: any) => b.beat === "commit").length }
    })
    for (const [label, clip] of [[POSTURE, POSTURE_CLIP], [STACK, STACK_CLIP]] as const) {
      const choice = card(label)
      await expect(choice).toHaveCount(1)
      await choice.scrollIntoViewIfNeeded()
      await expect(choice).toHaveAttribute("data-choice-front", "approved")
      await expect(choice.locator("[data-choice-media] img")).toHaveAttribute("src", `https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`)
      await expect(choice.locator("[data-choice-media]")).not.toContainText("Video unavailable")
      await expect(choice.locator("[data-choice-watch]")).toBeVisible()
      await j.clickByMouse(`[data-choice-group="${group}"] [data-choice-watch][aria-label="Play video: ${label}"]`, `Watch ${label}`)
      await expect(page.locator("[data-choice-viewer]")).toBeVisible()
      await expect.poll(() => page.evaluate(() => {
        const p = (window as any).__players.at(-1)
        return p && { id: p.id, start: p.vars.start, autoplay: p.vars.autoplay }
      })).toEqual({ id: clip.id, start: clip.start, autoplay: 0 })
      await j.clickByMouse("[data-watch-close]", "Close the escape video")
      await expect(page.locator("[data-choice-viewer]")).toHaveCount(0)
      await expect(choice.locator("[data-choice-watch]")).toBeFocused()
    }
    expect(await page.evaluate(() => {
      const a = (window as any).__neural
      return { hand: a._choiceHandId, pos: a.currentPos, moves: a.moveCount, commits: a.beats.filter((b: any) => b.beat === "commit").length }
    })).toEqual(before)
    expect(errors).toEqual([])
  })
}

for (const kind of ["no escapes", "no label entry", "unapproved first", "approved later", "truthy front"] as const) {
  test(`@curated escape clips: ${kind} keeps the placeholder, never the defender reel`, async ({ page }) => {
    const { card, errors } = await bootEscapes(page, "Defender", kind)
    const choice = card(POSTURE)
    await expect(choice).toHaveCount(1)
    await choice.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    // Wait until this mounted card's actual hydration job has finished, not just
    // the landing's dossier request, before asserting that no media was mounted.
    await expect.poll(() => page.evaluate(() => {
      const a = (window as any).__neural
      return !(a._choiceMediaActive > 0) && !a._choiceMediaQueue?.length
    })).toBe(true)
    await expect(choice).toHaveAttribute("data-choice-front", "suppressed")
    await expect(choice.locator("[data-choice-media]")).toHaveText("Video unavailable")
    await expect(choice.locator("[data-choice-media] img, [data-choice-watch]")).toHaveCount(0)
    // A sibling with its own approved label still hydrates from the same dossier.
    if (kind !== "no escapes") {
      await card(STACK).scrollIntoViewIfNeeded()
      await expect(card(STACK).locator("[data-choice-media] img")).toHaveAttribute("src", `https://i.ytimg.com/vi/${STACK_CLIP.id}/hqdefault.jpg`)
    }
    expect(errors).toEqual([])
  })
}
