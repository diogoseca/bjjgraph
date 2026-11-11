import { expect, test, type Page } from "@playwright/test"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../../e2e/dsl"

/** PEEK LATENCY PROBE (v1.256.7, movesrow). NOT a gate: evidence for the commit and the report. The gate is
 *  e2e/journeys/hidden-moves.spec.ts ("hover: the card turns up the moment the pointer is on it"). It answers,
 *  for ONE build at a time:
 *    1. pointer-enter -> the first frame that shows the name, the film's picture, its play button and the strip;
 *       and whether the picture was already fetched while the card was face down (resource timing);
 *    2. what a sweep along the row changes (peeks, the touch latch, strips left open, the record, the saved blob,
 *       tracked events, effects);
 *    3. every animation running on the card after the reveal, read by PAUSING and SEEKING, never by eye;
 *  and, with PEEK_OUT set, shoots the frame row (pointer outside, +0, +100, +300 ms) at 1440.
 *  Unlike a journey it serves the REAL dossier chunks and lets YouTube's thumbnails through, so the cards carry
 *  their curated films as in production.
 *
 *    PEEK_BUILD=before PEEK_BEFORE_DIR=<a copy of the pre-change neural/dist> | PEEK_BUILD=after
 *    TMPDIR=/home/user/tmp-pw PW_PORT=<free> PW_TESTDIR=../tests/artifacts \
 *      npx playwright test -c e2e/playwright.private.config.ts _peek_latency_probe
 *  PEEK_FRAMES_ONLY=1 shoots the frame row alone (no trials, no sweeps).
 *  Results: JSON on stdout (PEEK_RESULT ...), and $PEEK_OUT/<build>-*.jpg. */

type W = any
const BUILD = process.env.PEEK_BUILD || "after"
const BEFORE = process.env.PEEK_BEFORE_DIR || ""
const OUT = process.env.PEEK_OUT || ""
const TRIALS = Number(process.env.PEEK_TRIALS || 10)
const PUB = resolve(__dirname, "../../source/public/static/neural")
const seed = { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 } }

test.use({ viewport: { width: 1440, height: 900 } })
test.setTimeout(240_000)

async function boot(page: Page) {
  const j = journey(page)
  await j.boot("/", { initialState: seed, beforeNavigate: async (p) => {
    await p.route("**/static/neural/content/*.json", (r) => r.fulfill({ path: resolve(PUB, "content", new URL(r.request().url()).pathname.split("/").pop()!) }))
    await p.route("https://i.ytimg.com/**", (r) => r.continue())
    if (BUILD === "before") await p.route("**/static/neural/app/*", (r) => {
      const f = resolve(BEFORE, new URL(r.request().url()).pathname.split("/").pop()!)
      return existsSync(f) ? r.fulfill({ path: f }) : r.continue()
    })
  } })
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length)).toBeGreaterThan(3)
  // the films land two at a time after the deal; wait (20 s at most) until the queue drains and every picture
  // inserted so far has answered, then go on and RECORD what was in, rather than fail
  const t0 = Date.now()
  while (Date.now() - t0 < 20_000) {
    const settled = await page.evaluate(() => {
      const a = (window as W).__neural
      return !(a._choiceMediaActive > 0) && !(a._choiceMediaQueue || []).length
        && [...document.querySelectorAll('[data-choice-group="you"] [data-choice-media] img')].every((i: any) => i.complete)
    })
    if (settled) break
    await page.waitForTimeout(250)
  }
  return j
}

const mediaState = (page: Page) => page.evaluate(() => (window as W).__neural._optionCards.filter((c: W) => !c.opt.threat).map((c: W) => {
  const i = c.card.querySelector("[data-choice-media] img") as HTMLImageElement | null, r = c.card.getBoundingClientRect()
  return { name: c.opt.node.t, front: c.card.dataset.choiceFront, img: !!i, complete: i ? i.complete : null, w: i ? i.naturalWidth : null, inView: r.right > 0 && r.left < innerWidth }
}))

/** the own card with a curated picture nearest the row's start (but not the first, so it has neighbours) */
const pickCard = (page: Page) => page.evaluate(() => {
  const own = (window as W).__neural._optionCards.filter((c: W) => !c.opt.threat).map((c: W) => c.card)
  own.forEach((c: HTMLElement, i: number) => c.setAttribute("data-pk", String(i)))
  const withPic = own.filter((c: HTMLElement) => { const i = c.querySelector("[data-choice-media] img") as HTMLImageElement | null; return !!i && i.naturalWidth > 0 })
  const pick = withPic.find((c: HTMLElement) => own.indexOf(c) >= 1) || withPic[0] || own[1]
  return { sel: `[data-pk="${own.indexOf(pick)}"]`, index: own.indexOf(pick), withPicture: withPic.length, cards: own.length, name: pick.getAttribute("data-tech") }
})

const centre = (page: Page, sel: string) => page.evaluate((sel) => {
  const c = document.querySelector(sel) as HTMLElement
  c.scrollIntoView({ inline: "nearest", block: "nearest" })
  const r = c.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + 22, top: r.top, left: r.left, right: r.right, bottom: r.bottom }
}, sel)

async function rest(page: Page, sel: string, away: { x: number; y: number }) {
  await page.mouse.move(away.x, away.y)
  await expect.poll(() => page.evaluate((sel) => document.querySelector(sel)!.hasAttribute("data-revealed"), sel)).toBe(false)
  await page.waitForTimeout(400)
}

/** one entry: arm a recorder on the card, move in, read the first frame each part of the card is shown */
async function enterOnce(page: Page, sel: string, at: { x: number; y: number }) {
  const rec = page.evaluate((sel) => new Promise<any>((done) => {
    const c = document.querySelector(sel) as HTMLElement
    const title = c.querySelector(".ngchoice-title")!, back = c.querySelector(".ng-choice-back") as HTMLElement | null
    const img = c.querySelector("[data-choice-media] img") as HTMLImageElement | null
    const r: any = { name: null, picture: null, button: null, strip: null, frames: 0 }
    c.addEventListener("pointerenter", () => {
      const t0 = performance.now()
      r.pictureReadyAtEnter = !!img && img.complete && img.naturalWidth > 0
      const ent = img ? (performance.getEntriesByName(img.currentSrc || img.src)[0] as PerformanceResourceTiming | undefined) : undefined
      r.pictureFetchedMsBeforeEnter = ent ? Math.round(t0 - ent.responseEnd) : null
      const loop = () => {
        const t = Math.round((performance.now() - t0) * 10) / 10
        r.frames++
        const watch = c.querySelector("[data-choice-watch]")
        if (r.name == null && getComputedStyle(title).visibility === "visible") r.name = t
        if (r.picture == null && (!back || getComputedStyle(back).display === "none") && img && img.naturalWidth > 0 && getComputedStyle(img).visibility !== "hidden") r.picture = t
        if (r.button == null && watch && getComputedStyle(watch).visibility === "visible") r.button = t
        if (r.strip == null && c.hasAttribute("data-asking")) r.strip = t
        if (t > 700) return done(r)
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    }, { capture: true, once: true })
  }), sel)
  await page.waitForTimeout(30)
  await page.mouse.move(at.x, at.y)
  return rec
}

/** every animation on the card and inside it right after the reveal, paused and sought to 0 and to its end */
const animations = (page: Page, sel: string) => page.evaluate((sel) => {
  const c = document.querySelector(sel) as HTMLElement
  return c.getAnimations({ subtree: true }).map((a: any) => {
    const el = a.effect.target as HTMLElement, end = a.effect.getComputedTiming().endTime
    a.pause()
    const read = () => ({ transform: getComputedStyle(el).transform, title: getComputedStyle(c.querySelector(".ngchoice-title")!).visibility, back: getComputedStyle(c.querySelector(".ng-choice-back")!).display })
    a.currentTime = 0; const at0 = read()
    a.currentTime = Math.max(0, end - 1); const atEnd = read()
    a.play()
    return { property: a.transitionProperty || a.animationName, on: el === c ? "card" : el.className, ms: end, at0, atEnd }
  })
}, sel)

async function sweep(page: Page) {
  const pts = []
  for (let i = 0; i < 4; i++) pts.push(await centre(page, `[data-pk="${i}"]`))
  await page.mouse.move(pts[0].x, pts[0].top - 160)
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => {
    const a = (window as W).__neural
    a._handTouched = false
    a.__tracked = []; a.__fx = []
    if (!a.__pkWrapped) {
      a.__pkWrapped = true
      const t = a.track, f = a.fx
      a.track = function (n: string, p: any) { a.__tracked.push(n); return t.apply(this, arguments as any) }
      a.fx = function (n: string) { a.__fx.push(n); return f.apply(this, arguments as any) }
    }
    a.__upDuringSweep = new Set()
    a.__mo?.disconnect()
    a.__mo = new MutationObserver((ms) => { for (const m of ms) if ((m.target as HTMLElement).hasAttribute("data-revealed")) a.__upDuringSweep.add((m.target as HTMLElement).getAttribute("data-pk")) })
    for (const c of document.querySelectorAll("[data-pk]")) a.__mo.observe(c, { attributes: true, attributeFilter: ["data-revealed"] })
    a._hmPeeks = new Set()
    return { blob: localStorage.getItem("bjj-neural-owner:guest:progress"), moves: JSON.stringify(a.moves || {}) }
  })
  for (const p of pts) { await page.mouse.move(p.x, p.y, { steps: 2 }); await page.waitForTimeout(60) }
  await page.mouse.move(pts[3].x, pts[3].top - 160)
  await page.waitForTimeout(2500)
  return page.evaluate((before) => {
    const a = (window as W).__neural
    a.__mo.disconnect()
    return {
      cardsTurnedUpDuringSweep: [...a.__upDuringSweep].sort(),
      faceUpAfter: document.querySelectorAll('[data-pk][data-revealed]').length,
      stripsLeftOpen: document.querySelectorAll("[data-asking]").length,
      peeks: a._hmPeeks ? a._hmPeeks.size : 0,
      touchedTheHand: !!a._handTouched,
      mapNamesLitAfter: a._hmLit ? a._hmLit.size : 0,
      recordChanged: JSON.stringify(a.moves || {}) !== before.moves,
      savedBlobChanged: localStorage.getItem("bjj-neural-owner:guest:progress") !== before.blob,
      tracked: a.__tracked, effects: a.__fx,
    }
  }, before)
}

/** the hand swept BEFORE its win chances land: does it still sort itself once? */
async function sweepBeforeChances(page: Page) {
  const j = journey(page)
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")
  const early = await page.evaluate(() => { const a = (window as W).__neural; return { sortedYet: a._autoSortedHand === a._choiceHandId } })
  await page.evaluate(() => (window as W).__neural._optionCards.filter((c: W) => !c.opt.threat).forEach((c: W, i: number) => c.card.setAttribute("data-pk", String(i))))
  const pts = []
  for (let i = 0; i < 4; i++) pts.push(await centre(page, `[data-pk="${i}"]`))
  await page.evaluate(() => { (window as W).__neural._handTouched = false })
  for (const p of pts) { await page.mouse.move(p.x, p.y, { steps: 2 }); await page.waitForTimeout(60) }
  await page.mouse.move(pts[3].x, pts[3].top - 160)
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-pk] [data-choice-value]')].every((v) => ["ready", "bounded"].includes(v.getAttribute("data-status") || ""))), { timeout: 60_000 }).toBe(true)
  await page.waitForTimeout(500)
  return page.evaluate((early) => {
    const a = (window as W).__neural, sort = document.querySelector("[data-choice-value-sort]") as HTMLElement | null
    return { ...early, touched: !!a._handTouched, sortedOnce: a._autoSortedHand === a._choiceHandId, sortButtonOffered: !!sort && sort.style.display !== "none" }
  }, early)
}

const median = (xs: number[]) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }

test(`peek latency, sweep and frames (${BUILD})`, async ({ page }) => {
  await boot(page)
  await page.waitForTimeout(1500)
  const media = await mediaState(page)
  const card = await pickCard(page)
  const at = await centre(page, card.sel), away = { x: at.x, y: at.top - 160 }
  const result: any = { build: BUILD, card, media }

  // 1. latency, TRIALS entries
  const trials = []
  for (let i = 0; i < (process.env.PEEK_FRAMES_ONLY ? 0 : TRIALS); i++) { await rest(page, card.sel, away); trials.push(await enterOnce(page, card.sel, at)) }
  result.trials = trials
  result.medianMs = Object.fromEntries(["name", "picture", "button", "strip"].map((k) => [k, median(trials.map((t: any) => t[k]))]))
  result.pictureReadyAtEveryEnter = trials.every((t: any) => t.pictureReadyAtEnter)
  result.pictureRequests = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /ytimg/.test(e.name)).length)
  // 3. what animates on the reveal
  await rest(page, card.sel, away)
  await page.mouse.move(at.x, at.y)
  result.animations = await animations(page, card.sel)
  // the frame row
  if (OUT) {
    mkdirSync(OUT, { recursive: true })
    await page.evaluate(() => {
      const d = document.createElement("div"); d.id = "pk-cursor"
      d.style.cssText = "position:fixed;left:0;top:0;width:18px;height:26px;z-index:2147483647;pointer-events:none;"
      d.innerHTML = '<svg viewBox="0 0 18 26" width="18" height="26"><path d="M1 1l0 20 5-5 4 9 3-1.4-4-8.6h7z" fill="#fff" stroke="#000" stroke-width="1.3"/></svg>'
      document.body.appendChild(d)
    })
    // the drawn pointer is PLACED by the probe at the point it moved the mouse to: a pointermove listener on the
    // document never fired here (the app's input takes the events first), so it stayed at 0,0, off the crop
    const cursorAt = (p: { x: number; y: number }) => page.evaluate((p) => { document.getElementById("pk-cursor")!.style.transform = `translate(${p.x}px,${p.y}px)` }, p)
    const row = await page.evaluate(() => {
      const g = document.querySelector('[data-choice-group="you"]')!.getBoundingClientRect()
      const cards = [...document.querySelectorAll("[data-pk]")].slice(0, 5).map((c) => c.getBoundingClientRect())
      return { x: Math.max(0, Math.min(...cards.map((r) => r.left)) - 24), y: Math.max(0, g.top - 12), r: Math.max(...cards.map((r) => r.right)) + 24, b: Math.max(...cards.map((r) => r.bottom)) + 16 }
    })
    const clip = { x: row.x, y: row.y, width: Math.min(1440, row.r) - row.x, height: Math.min(900, row.b) - row.y }
    const outside = { x: at.x, y: at.top - 14 }
    const frames: any[] = []
    const shot = async (n: string, ms: number | null) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await rest(page, card.sel, away)
        await page.mouse.move(outside.x, outside.y)
        await cursorAt(outside)
        await page.waitForTimeout(300)
        let state: any = { ms: null }
        if (ms != null) {
          const armed = page.evaluate((sel) => new Promise<void>((ok) => document.querySelector(sel)!.addEventListener("pointerenter", () => { (window as W).__pkT0 = performance.now(); ok() }, { capture: true, once: true })), card.sel)
          await page.mouse.move(at.x, at.y)
          await armed
          state = await page.evaluate(([sel, ms, x, y]) => new Promise<any>((ok) => {
            document.getElementById("pk-cursor")!.style.transform = `translate(${x}px,${y}px)`
            const c = document.querySelector(sel as string)!, t0 = (window as W).__pkT0
            const go = () => {
              if (performance.now() - t0 < (ms as number)) return requestAnimationFrame(go)
              for (const a of c.getAnimations({ subtree: true }) as any[]) { a.pause(); a.currentTime = Math.min(ms as number, a.effect.getComputedTiming().endTime) }
              ok({ ms: Math.round(performance.now() - t0), up: c.hasAttribute("data-revealed") })
            }
            go()
          }), [card.sel, ms, at.x, at.y] as const)
        }
        const file = resolve(OUT, `${BUILD}-${n}.jpg`)
        await page.screenshot({ path: file, clip, type: "jpeg", quality: 88 })
        const after = await page.evaluate((sel) => { const c = document.querySelector(sel)!; const up = c.hasAttribute("data-revealed"); for (const a of c.getAnimations({ subtree: true })) a.play(); return up }, card.sel)
        if (ms == null || after === state.up) { frames.push({ n, nominal: ms, soughtAt: state.ms, faceUp: after }); return }
      }
      frames.push({ n, nominal: ms, error: "the card turned between the seek and the shot on every attempt" })
    }
    await shot("1-outside", null)
    await shot("2-0ms", 0)
    await shot("3-100ms", 100)
    await shot("4-300ms", 300)
    result.frames = frames
    result.clip = clip
  }
  if (!process.env.PEEK_FRAMES_ONLY) {
    // 2. a sweep, with the hand's win chances already in
    result.sweep = await sweep(page)
    // ...and a sweep before they land
    result.sweepBeforeChances = await sweepBeforeChances(page)
  }
  console.log("PEEK_RESULT " + JSON.stringify(result))
  if (OUT) writeFileSync(resolve(OUT, `${BUILD}-result${process.env.PEEK_FRAMES_ONLY ? "-frames" : ""}.json`), JSON.stringify(result, null, 1))
})
