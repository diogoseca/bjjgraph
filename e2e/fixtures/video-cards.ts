import { expect, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

// Hermetic editorial/player fixtures. Real dossier text stays intact; clip fixtures do not assert curation coverage.
export const NAME = "Consolidate Mount"
export const CARD = `[data-tech="${NAME}"]`
export type Front = "approved" | "later" | "opposite" | "none"

export async function bootVideoCards(page: Page, front: Front = "approved", {
  crossOriginPlayer = false, revealChoice = true, currentClips = 2,
}: { crossOriginPlayer?: boolean; revealChoice?: boolean; currentClips?: 1 | 2 } = {}) {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: async p => {
    await p.route("**/static/neural/content/*.json", async route => {
      const file = new URL(route.request().url()).pathname.split("/").pop()!
      const data = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", file), "utf8"))
      for (const [name, raw] of Object.entries(data)) {
        const d = raw as any
        // Exercise wire ownership, not editorial matching: curation is the authority.
        for (const block of [d, ...Object.values(d.perspectives || {})] as any[]) for (const c of block.clips || []) delete c.front
        if (name === "Mount|Top") d.clips = [{ id: "ddddddddddd", title: "Mount Top", duration: 600 }, { id: "eeeeeeeeeee", title: "Another Mount Top view", duration: 20 }].slice(0, currentClips)
        if (name === NAME) {
          const a = d.perspectives.attacker.clips = [{ id: "aaaaaaaaaaa", title: NAME, duration: 600 }, { id: "bbbbbbbbbbb", title: "Second clip", duration: 20 }], b = d.perspectives.defender.clips = [{ id: "ccccccccccc", title: "Defending clip" }]
          if (front === "approved") { a[0].front = true; a[0].duration = 600; a[1].duration = 20 }
          if (front === "later") a[1].front = true
          if (front === "opposite") b[0].front = true
        }
      }
      await route.fulfill({ json: data })
    })
    if (crossOriginPlayer) await p.route("https://www.youtube-nocookie.com/embed/**", route => route.fulfill({
      contentType: "text/html", body: '<!doctype html><title>Cross-origin player fixture</title><button id="play">Play video</button><script>document.querySelector("button").onclick=()=>parent.postMessage("fixture-play","*")</script>',
    }))
    await p.addInitScript(installPlayerStub, crossOriginPlayer)
  } })
  await j.land("Mount Top")
  await expect(page.locator(CARD)).toBeVisible()
  if (revealChoice) {
    await page.locator(CARD).scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => {
      const a = (window as any).__neural
      return !!(window as any).NG_CONTENT?.decks["Consolidate Mount"] && !(a._choiceMediaActive > 0)
    })).toBe(true)
  }
  return j
}


export function installPlayerStub(crossOrigin = false) {
  const w = window as any
  w.__players = []
  w.YT = { PlayerState: { ENDED: 0 }, Player: function (host: HTMLElement, opts: any) {
    const frame = document.createElement("iframe"); frame.dataset.testPlayer = ""
    // VID1: `state` is the player's own (getPlayerState: 1 playing, 2 paused), `mute` counts mute() calls.
    const record = { vars: opts.playerVars, id: opts.videoId, play: 0, pause: 0, destroy: 0, mute: 0, state: -1, events: opts.events }
    let muted = false
    w.__players.push(record)
    const onMessage = (event: MessageEvent) => {
      if (event.source === frame.contentWindow && event.origin === (crossOrigin ? "https://www.youtube-nocookie.com" : "null") && event.data === "fixture-play") this.playVideo()
    }
    window.addEventListener("message", onMessage)
    if (crossOrigin) {
      frame.src = "https://www.youtube-nocookie.com/embed/" + opts.videoId
    } else {
      // Like the real provider, the fixture cannot access the app's storage.
      // An unsandboxed srcdoc reruns boot init scripts on the parent's origin,
      // reseeding its guest progress on each viewer open and erasing saved coins.
      frame.setAttribute("sandbox", "allow-scripts")
      frame.srcdoc = '<button style="width:100%;height:100vh" id="play">Play video</button><script>document.querySelector("button").onclick=()=>parent.postMessage("fixture-play","*")</script>'
    }
    // Set origin/sandbox before insertion: even the initial about:blank document
    // must not run the harness's storage seed on the parent origin.
    host.replaceWith(frame)
    this.getIframe = () => frame
    this.playVideo = () => {
      // VID1: a browser that refuses a played-by-script start with sound (iPhone Safari) answers through the
      // player's OWN report, as YouTube's API does (onAutoplayBlocked). Off unless a spec sets __refuseSound.
      if (w.__refuseSound && !muted) { setTimeout(() => opts.events.onAutoplayBlocked?.({ target: this }), 0); return }
      record.play++; record.state = 1; opts.events.onStateChange?.({ target: this, data: 1 })
    }
    this.pauseVideo = () => { record.pause++; record.state = 2 }
    this.mute = () => { record.mute++; muted = true }
    this.getPlayerState = () => record.state
    this.destroy = () => { record.destroy++; window.removeEventListener("message", onMessage); frame.remove() }
    setTimeout(() => opts.events.onReady({ target: this }), 0)
  } }
}

/** Give an existing persona/hand an approved exact-role test clip, then use its real Watch action. */
export async function openChoiceVideo(page: Page, technique: string, id = "aaaaaaaaaaa") {
  if (await page.locator(".ng-video-theater").count()) {
    // Playback focuses the provider iframe, whose keys do not bubble to the
    // app. The theater's one ✕ remains a real, reachable parent control (VID1).
    await journey(page).clickByMouse(".ng-video-theater .ngClipX", "Close the playing video")
    await expect(page.locator(".ng-video-theater")).toHaveCount(0)
  }
  if (!await page.evaluate(() => !!(window as any).__players)) await page.evaluate(installPlayerStub)
  await expect.poll(() => page.evaluate(() => !((window as any).__neural._choiceMediaActive > 0))).toBe(true)
  const target = await page.evaluate(technique => {
    const a = (window as any).__neural
    const opt = a._optList.find((o: any) => o.node.t === technique), target = a._choiceMediaTarget(opt)
    if (!target?.exact) throw new Error("Film economy fixture requires an exact technique choice")
    return { key: target.key, role: target.role, position: target.node.ty === "positions", file: a.qhash(target.key) + ".json" }
  }, technique)
  // The default journey harness suppresses dossiers. Serve an explicit approved
  // front through the real fetch path, retaining the rest of its authored data.
  const data = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", target.file), "utf8"))
  const block = target.position ? data[target.key] : data[target.key].perspectives[target.role]
  block.clips = [{ id, title: technique, front: true, duration: 42 }]
  await page.route("**/static/neural/content/" + target.file, route => route.fulfill({ json: data }))
  await page.evaluate(({ technique, key }) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]; delete (a._contentWaits || {})[key]
    const card = [...a.optionsRef.current.querySelectorAll("[data-tech]")].find((c: any) => c.dataset.tech === technique)
    a._queueChoiceMedia(card, card._choiceTarget, a._choiceHandId)
  }, { technique, key: target.key })
  await expect.poll(() => page.evaluate(() => !((window as any).__neural._choiceMediaActive > 0))).toBe(true)
  const watch = page.locator(`[data-tech="${technique}"] [data-choice-watch]`)
  await expect(watch).toBeVisible()
  await watch.scrollIntoViewIfNeeded()
  await journey(page).clickByMouse(`[data-tech="${technique}"] [data-choice-watch]`, "Watch " + technique)
  // VID1: the play circle opens the current node's theater (WAS, to v1.280.0: the move's own modal, [data-choice-viewer]).
  await expect(page.locator(".ng-video-theater [data-test-player]")).toHaveCount(1)
  // The theater zooms in over 360ms. A press measured mid-zoom lands where the ✕ no longer is (on the video, which takes
  // it), so callers that close it next would leave it open: every press below is sampled at rest (video-theater.spec).
  await page.locator(".ng-video-theater").evaluate(async d => { await Promise.all(d.getAnimations().map(a => a.finished)) })
}

/** A real click in the hermetic player. VID1: the press that opened the theater already asked it to play (and the
 *  provider's "playing" report earns the once-per-technique film look); this press is the player's own Play again. */
export async function playChoiceVideo(page: Page) {
  const before = await page.evaluate(() => (window as any).__players.at(-1).play)
  const play = page.frameLocator(".ng-video-theater [data-test-player]").locator("button")
  await expect(play).toBeVisible()
  const box = await play.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect.poll(() => page.evaluate(() => (window as any).__players.at(-1).play)).toBeGreaterThan(before)
}
