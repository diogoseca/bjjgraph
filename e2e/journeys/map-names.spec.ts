import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** NAMES ON THE MAP NEVER SIT ON EACH OTHER, ARE NEVER CUT BY THE SCREEN, NEVER RUN UNDER A CONTROL (v1.275.0).
 *
 * The owner, 13 Nov 2026, looking at the map pulled back: "dunno why in the graph there are many techniques showing but
 * they are unreadable like this you know, when they overlap, avoid that pls". Until v1.275.0 every dealt move within 60 px
 * of the screen was named at one fixed place and nothing tested a name against another name, the screen's edge or a
 * control; the rule now (`_planNames`, app.src.jsx): a name is written only where it can be read, in order of claim
 * (the position's own label, then what the pointer is on, then the names already written, then the rest in the row's
 * order), each at the first of eight places beside its orb that clears every name, control, the edge and the other
 * dealt orbs; a name already written keeps its place down to 3 px of air, a new one needs 6.
 *
 * WHAT IS READ: what the frame PUBLISHED (`_lastNameBoxes`, every ink box it wrote, in order of claim; `_lastOptLabels`;
 * `_lastHoverLabel` / `_lastPairLabel`; `_LY`, `_nodeK`, `_lodK`), never the rule recomputed (CLAUDE.md §6.3). "Under a
 * control" is NOT the app's own list of controls (`_nameBlocks`): it is every PAINTED element of the app's root over the
 * box (text by its own line boxes, an element with a background, border, image or icon by its box), each cut by its
 * clipping ancestors — the browser's layout, measured here, so the app's list cannot agree with itself by construction.
 * The camera moves the way the app's zoom does: a `wheel` on the canvas at the position's drawn point (the handler zooms
 * about the pointer), from the follow camera's settled framing.
 *
 * MUTANTS, each one exact replacement in app.src.jsx, rebuilt and this spec run in full (the brief's six first):
 *   M1  the test removed (`fits` always true)                red 4 tests, first at "no name off the map" (Mount x1)
 *   M2  the order of claim reversed (the row read backwards) red 2, at "the moves claimed their room in the row's order"
 *   M3  the edge check removed                               red 3, at "no name off the map"
 *   M4  the pointer's single label dropped                   red 1, at "merged: the orb under the mouse is named by the
 *                                                            single label" (survived until the merged check was added)
 *   M4c both pointer labels dropped (pair group and single)  red 1, at "the orb under the mouse is named"
 *   M5  `n.y` for `LY(n)` (a move's anchor)                  red 2, at "every name starts just beyond its own orb's drawn width"
 *   M6  widths from `n.r * scale`, not `halfW`               red 2, at the same assertion
 *   M7  what is acted on not first                           red 2, at "the card under the mouse names its orb" and "the map
 *                                                            names the card just turned up"
 *   M8  written names treated as new (no incumbency)         red 2, at "moves are still named": a frame right after the
 *                                                            wheel's jump deals nothing new and keeps nothing
 *   M9  the controls ignored                                 red 2, at "no name under a control"
 *   M10 no plan reused                                       red 2, at "60 held frames reuse one plan"
 *   M11 names under the phone's open drawer                  red 1, at "nothing is written on the map under the drawer"
 *   M12 other dealt orbs ignored                             red 2, at "no move's name across another dealt orb" (survived
 *                                                            until that assertion was added)
 * NON-KILLS, so nobody reads them as covered: M4b, the pointer's PAIR GROUP alone dropped, is the designed fallback (the
 * single label names the orb instead: `_hovPairDrawn` false); M8b, a written name needing 6 px like a new one (no 3 px
 * stay margin), changes nothing a recorded ease here can see: the camera-state rule (no new name while the zoom moves) and
 * the reused plan at rest hold the names, and the stay margin only decides a name sitting between 3 and 6 px of a neighbour
 * at rest. Table and run times in docs/Changelog-Archive.md (v1.275.0).
 */

type W = any
const NO_GAP = 3   // the air a written name keeps (`_planNames`: 3 to keep a place, 6 to take one)

/** Seat the roll at `title`, side `role`, the way `land()` does (rigged start and draws), and let the camera settle. */
async function seat(page: Page, title: string, role: "top" | "bottom", initialState?: Record<string, unknown>) {
  const j = journey(page)
  await j.boot("/", initialState ? { initialState } : {})
  await j.rig("ai-skill", [0.5]); await j.rig("role", [role === "bottom" ? 0.9 : 0]); await j.rig("max-moves", [0.5])
  await page.evaluate((t) => { const a = (window as W).__neural; a.rigStart(a.nodes.findIndex((n: W) => n.ty === "positions" && n.t === t)) }, title)
  for (let i = 0; i < 16; i++) {
    await j.advance(1000)
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null })) break
  }
  await j.landQuestion()
  await j.engage()
  await j.advance(3000)   // the follow camera settles on the seat
  // NOT SERVED AS A PLAYER SEES IT, so put right: the arrival's centre block fades on the WALL clock (NG_ARRIVE_HANDOFF,
  // a CSS transition) while this harness pumps the game clock, so wait for the fade a player's eye would have seen end;
  // and the badge toast the DSL's tutorial skip raises (White Foundations) is not part of the map: removed.
  await expect.poll(() => page.evaluate(() => +getComputedStyle((window as W).__neural.evCenterRef.current).opacity), { message: "the arrival heading has faded" }).toBeLessThan(0.05)
  await page.evaluate(() => { document.querySelectorAll("[data-reward]").forEach((e) => e.remove()); (window as W).__neural._handTouched = true })   // the row keeps its order (no re-sort when win chances land)
  await j.advance(34)
  expect(await page.evaluate(() => { const a = (window as W).__neural, n = a.nodes[a.currentPos]; return n.t + "/" + a.playerRole }), "seated where asked").toBe(title + "/" + role)
  return j
}

/** The settled camera, and a pull back `f` times through the app's own wheel handler, about the position's drawn point. */
const camOf = (page: Page) => page.evaluate(() => { const c = (window as W).__neural.cam; return { cx: c.cx, cy: c.cy, vw: c.vw } })
async function pullBack(page: Page, f: number, cam0: { cx: number; cy: number; vw: number }) {
  await page.evaluate(([f, c]) => {
    const a = (window as W).__neural
    Object.assign(a.cam, c, { lvw: Math.log(c.vw) }); Object.assign(a.camTarget, c); a.advance(17)
    if (f === 1) return
    const m = a.pairMid(a.nodes[a.focusIdx]), s = a.W / a.cam.vw, r = a.canvas.getBoundingClientRect()
    a.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(f) / 0.0012, clientX: (m.x - a.cam.cx) * s + a.W / 2 + r.left, clientY: (m.y - a.cam.cy) * s + a.H / 2 + r.top, bubbles: true, cancelable: true }))
  }, [f, cam0] as const)
  await journey(page).advance(34)
}

/** One frame's names, as published, with what lies over each (see the header: the browser's painted boxes). */
const audit = (page: Page) => page.evaluate((NO_GAP) => {
  const a = (window as W).__neural, W_ = a.W, H_ = a.H, root = a.__ngRoot || a.wrapRef.current, cv = a.canvas, cr = cv.getBoundingClientRect()
  const boxes = (a._lastNameBoxes || []).map((b: W) => ({ ...b }))
  const labels = boxes.filter((b: W) => b.w !== "star")
  // painted elements over the map (canvas px), each cut by its clipping ancestors
  const clips = new Map<Element, W>()
  const clipOf = (el: Element | null): W => {
    if (!el || el === root || el === document.documentElement) return { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }
    if (clips.has(el)) return clips.get(el)
    const up = clipOf(el.parentElement), cs = getComputedStyle(el)
    let c = up
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const r = el.getBoundingClientRect(); c = { l: Math.max(up.l, r.left), t: Math.max(up.t, r.top), r: Math.min(up.r, r.right), b: Math.min(up.b, r.bottom) } }
    clips.set(el, c); return c
  }
  const eff = (el: Element) => { let o = 1; for (let q: Element | null = el; q && q !== document.documentElement; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity } return o }
  const painted: W[] = []
  const put = (r: DOMRect, el: Element, what: string) => {
    const c = clipOf(el), l = Math.max(r.left, c.l) - cr.left, t = Math.max(r.top, c.t) - cr.top, rr = Math.min(r.right, c.r) - cr.left, b = Math.min(r.bottom, c.b) - cr.top
    if (rr - l >= 2 && b - t >= 2) painted.push({ l, t, r: rr, b, what, star: !!el.closest("[data-seat-star]") })
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node === cv || node === root || node.contains(cv)) continue
    const el = (node.nodeType === 3 ? node.parentElement : node) as Element
    if (!el || el.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING) continue   // before the canvas: under it
    if (node.nodeType === 3) {
      if (!node.textContent!.trim() || eff(el) < 0.05) continue
      const rg = document.createRange(); rg.selectNodeContents(node)
      for (const r of rg.getClientRects()) put(r, el, "text:" + node.textContent!.trim().slice(0, 20))
      continue
    }
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    if (!(r.width > 0 && r.height > 0)) continue
    const bg = !/rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== "transparent"
    const bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0 && !/rgba\([^)]*,\s*0\)$/.test(cs.borderTopColor)
    const media = /^(IMG|svg|VIDEO|CANVAS|INPUT|SELECT|TEXTAREA)$/i.test(el.tagName) || cs.backgroundImage !== "none"
    if ((bg || bd || media) && eff(el) >= 0.05) put(r, el, el.tagName + "." + String(el.className).split(" ")[0])
  }
  const hit = (p: W, q: W, m = 0) => p.l < q.r + m && p.r > q.l - m && p.t < q.b + m && p.b > q.t - m
  const close: string[] = [], outside: string[] = [], under: string[] = []
  const name = (b: W) => b.w + ":" + (a.nodes[b.i] ? a.graphName(a.nodes[b.i]) : b.i)
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const p = boxes[i], q = boxes[j]
    if (p.g !== q.g && hit(p, q, NO_GAP - 0.01)) close.push(name(p) + " ~ " + name(q))
  }
  for (const b of labels) {
    if (b.l < 0 || b.t < 0 || b.r > W_ || b.b > H_) outside.push(name(b) + " [" + [b.l, b.t, b.r, b.b].map(Math.round) + "]")
    const over = painted.filter((p) => hit(b, p) && !(p.star && (b.w === "position" || b.w === "hover")))
    if (over.length) under.push(name(b) + " under " + over.slice(0, 2).map((p) => p.what).join(", "))
  }
  // a move's name across ANOTHER dealt orb (or the position's pair), as the frame drew it: the silhouette from the app's own
  // `_nodeHalfW` (bare) with the frame's published `_nodeK` / `_lodK`, at `_LY`; a pair's twin counts once split (`_lodK` 0.5)
  const s = W_ / a.cam.vw, f = a.focusIdx, hand = new Set((a.optionIdxs || []).concat(f >= 0 ? [f, a.nodes[f].pi] : []))
  const orbs = [...hand].map((i: number) => a.nodes[i]).filter((n: W) => n && !(n.z && !n.rep && a._lodK < 0.5))
    .map((n: W) => ({ i: n.idx, x: (n.x - a.cam.cx) * s + W_ / 2, y: (a._LY(n) - a.cam.cy) * s + H_ / 2, R: a._nodeHalfW(n, s, a._nodeK, a._lodK, true) }))
  const crossing: string[] = []
  for (const b of labels.filter((b: W) => b.w === "move")) for (const o of orbs) {
    if (o.i === b.i || o.i === a.nodes[b.i].pi) continue
    const dx = Math.max(b.l - o.x, 0, o.x - b.r), dy = Math.max(b.t - o.y, 0, o.y - b.b)
    if (dx * dx + dy * dy < o.R * o.R) crossing.push(name(b) + " across " + a.graphName(a.nodes[o.i]))
  }
  return { close, outside, under, crossing, moves: labels.filter((b: W) => b.w === "move").length, position: labels.filter((b: W) => b.w === "position").length, W: W_, H: H_ }
}, NO_GAP)

const VPS = [{ width: 390, height: 631, touch: true }, { width: 1440, height: 900, touch: false }]
const SEATS: Array<[string, "top" | "bottom"]> = [["Mount Top", "top"], ["Closed Guard Top", "bottom"], ["Standing Position Top", "top"]]

for (const vp of VPS) {
  test.describe(`map names ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch })

    test(`no two names closer than ${NO_GAP} px, none off the map, none under a control: usual zoom and pulled back 2, 4, 9 times (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      let written = 0
      for (const [title, role] of SEATS) {
        await seat(page, title, role)
        const cam0 = await camOf(page)
        for (const f of [1, 2, 4, 9]) {
          await pullBack(page, f, cam0)
          const r = await audit(page)
          const where = `${title} (${role}) x${f}`
          expect(r.position, `${where}: the position's own name is written`).toBe(1)
          expect(r.close, `${where}: no two names closer than ${NO_GAP} px`).toEqual([])
          expect(r.outside, `${where}: no name off the map`).toEqual([])
          expect(r.under, `${where}: no name under a control`).toEqual([])
          expect(r.crossing, `${where}: no move's name across another dealt orb`).toEqual([])
          written += r.moves
        }
      }
      console.log(`[map-names] ${vp.width}: ${written} move names written over 3 seats x 4 zooms`)
      // NON-TRIVIAL: "zero overlaps" is never bought by writing nothing
      expect(written, "moves are still named: at least 30 names over the twelve frames").toBeGreaterThanOrEqual(30)
    })

    test(`a move's name sits beside its own orb, where the frame drew it (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      let checked = 0
      for (const f of [1, 4]) {
        await pullBack(page, f, cam0)
        const bad = await page.evaluate(() => {
          const a = (window as W).__neural, s = a.W / a.cam.vw, out: string[] = []
          let n = 0
          for (const b of (a._lastNameBoxes || []).filter((b: W) => b.w === "move")) {
            const node = a.nodes[b.i], x = (node.x - a.cam.cx) * s + a.W / 2, y = (a._LY(node) - a.cam.cy) * s + a.H / 2
            const hw = a._nodeHalfW(node, s, a._nodeK, a._lodK)   // the drawn width, rings included: what the name starts beyond
            const d = Math.max(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b))
            n++
            if (d < hw + 3 || d > hw + 10) out.push(`${a.graphName(node)}: ${d.toFixed(1)} px from its orb's centre, drawn ${hw.toFixed(1)} wide`)
          }
          return { n, out }
        })
        checked += bad.n
        expect(bad.out, `x${f}: every name starts just beyond its own orb's drawn width`).toEqual([])
      }
      expect(checked, "names were checked").toBeGreaterThan(5)
    })

    test(`claims go in order: the position first, then the row's order (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      await pullBack(page, 4, cam0)
      const r = await page.evaluate(() => {
        const a = (window as W).__neural
        a._nm = null; a.advance(17)   // a fresh plan: nothing written before, so every move claims in the row's order
        const boxes = a._lastNameBoxes || []
        // the row as the player reads it: the cards' DOM order, left to right
        const cards = (a._optionCards || []).filter((c: W) => !c.opt.threat).sort((p: W, q: W) => p.card.compareDocumentPosition(q.card) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
        const rank = new Map(cards.map((c: W, k: number) => [c.opt.idx, k]))
        const moves = boxes.filter((b: W) => b.w === "move").sort((p: W, q: W) => p.g - q.g).map((b: W) => rank.get(b.i))
        return { first: boxes[0] && boxes[0].w, moves }
      })
      expect(r.first, "the position's own name claims first").toBe("position")
      expect(r.moves.length, "several moves are named").toBeGreaterThan(3)
      expect(r.moves, "the moves claimed their room in the row's order").toEqual([...r.moves].sort((p: number, q: number) => p - q))
    })

    test(`names hold through an ease: none comes in while the zoom moves, none flickers; a held camera does no layout work (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      await pullBack(page, 4, cam0)
      // no input for 4 s of game time: the follow camera takes the map back and eases in. Every frame recorded.
      const rec = await page.evaluate(() => {
        const a = (window as W).__neural, frames: Array<{ vw: number; on: number[] }> = []
        for (let k = 0; k < 400; k++) { a.advance(17); frames.push({ vw: a.cam.vw, on: (a._lastOptLabels || []).slice() }) }
        return frames
      })
      const vws = rec.map((f) => f.vw)
      expect(Math.max(...vws) / Math.min(...vws), "the camera eased (the recording is of a move, not a still)").toBeGreaterThan(2)
      // a frame whose zoom moved more than 0.2% since the one before: names may leave, none may come in
      const came: string[] = []
      for (let k = 1; k < rec.length; k++) {
        if (Math.abs(Math.log(rec[k].vw / rec[k - 1].vw)) < 0.002) continue
        const before = new Set(rec[k - 1].on)
        for (const i of rec[k].on) if (!before.has(i)) came.push(`frame ${k}: ${i}`)
      }
      expect(came, "while the zoom moves no name comes in").toEqual([])
      // ...and none flickers: a name that leaves stays gone at least 30 frames (half a second)
      const flick: string[] = []
      const gone = new Map<number, number>()
      for (let k = 1; k < rec.length; k++) {
        const now = new Set(rec[k].on), was = new Set(rec[k - 1].on)
        for (const i of was) if (!now.has(i)) gone.set(i, k)
        for (const i of now) if (!was.has(i) && gone.has(i) && k - gone.get(i)! < 30) flick.push(`${i}: gone at ${gone.get(i)}, back at ${k}`)
      }
      expect(flick, "no name leaves and comes back within half a second").toEqual([])
      const settled = rec[rec.length - 1].on.length
      console.log(`[map-names] ${vp.width}: ease ${vws[0].toFixed(0)} -> ${vws[vws.length - 1].toFixed(0)}, ${settled} names at rest`)
      expect(settled, "names are dealt again once the camera rests").toBeGreaterThan(2)
      // held: the same camera, frame after frame, reuses the last plan (the same object)
      const held = await page.evaluate(() => { const a = (window as W).__neural; a.advance(17); const p = a._nm && a._nm.move && a._nm.move.plan; let same = 0; for (let k = 0; k < 60; k++) { a.advance(17); if (a._nm.move.plan === p) same++ } return { same, cam: a.cam.vw } })
      expect(held.same, "60 held frames reuse one plan").toBe(60)
    })
  })
}

test.describe("what the pointer is on is named (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("an orb under the mouse is named, and a card under the mouse names its orb, even where the map was too full", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    const cam0 = await camOf(page)
    await pullBack(page, 4, cam0)
    // dealt moves whose orb is in the free map (above the row, inside the canvas) and whose name the full map refused
    const pick = (needCard: boolean) => page.evaluate((needCard) => {
      const a = (window as W).__neural, s = a.W / a.cam.vw, written = new Set(a._lastOptLabels || []), out: W[] = []
      const rowTop = a.optionsRef.current.getBoundingClientRect().top
      for (const c of (a._optionCards || []).filter((c: W) => !c.opt.threat)) {
        const n = a.nodes[c.opt.idx], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2
        const cr = c.card.getBoundingClientRect()
        if (written.has(n.idx) || x < 40 || x > a.W - 40 || y < 80 || y > rowTop - 20) continue
        if (needCard && (cr.left < 0 || cr.right > a.W)) continue
        out.push({ idx: n.idx, x, y, card: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } })
      }
      return out
    }, needCard)
    const orbs = await pick(false)
    expect(orbs.length, "dealt moves left unnamed by the full map, their orbs in the free map").toBeGreaterThan(0)
    // the pointer on each in turn until the app's own hit test resolves to that orb (a nearer node can win the pick)
    let orb: W = null
    for (const o of orbs) {
      await page.mouse.move(o.x, o.y)
      await journey(page).advance(34)
      if (await page.evaluate((idx) => { const a = (window as W).__neural; return !!a._hover && (a._hover.idx === idx || a._hover.idx === a.nodes[idx].pi) }, o.idx)) { orb = o; break }
    }
    expect(orb, "the pointer resolves to one of them").not.toBeNull()
    const named = await page.evaluate((idx) => {
      const a = (window as W).__neural, n = a.nodes[idx], h = a._lastHoverLabel, p = a._lastPairLabel
      return !!((h && (h.idx === idx || h.idx === n.pi)) || (p && (p.idx === idx || p.idx === n.pi)))
    }, orb.idx)
    expect(named, "the orb under the mouse is named").toBe(true)
    const r1 = await audit(page)
    expect(r1.close, "...and the other names keep clear of it").toEqual([])
    await page.mouse.move(4, 4); await journey(page).advance(600)   // the hover lapses (0.5 s)
    // ...and pulled back until the pairs merge (`_lodK` under 0.5), where the pointer's label is the single one (YOUR MOVE, name)
    let merged = false
    for (const f of [9, 12, 16, 20]) { await pullBack(page, f, cam0); if (await page.evaluate(() => (window as W).__neural._lodK < 0.5)) { merged = true; break } }
    expect(merged, "pulled back far enough that the pairs merge").toBe(true)
    let single: W = null
    for (const o of await pick(false)) {
      await page.mouse.move(o.x, o.y)
      await journey(page).advance(34)
      if (await page.evaluate((idx) => { const a = (window as W).__neural; return !!a._hover && (a._hover.idx === idx || a._hover.idx === a.nodes[idx].pi) }, o.idx)) { single = o; break }
    }
    expect(single, "the pointer resolves to a dealt orb the merged map left unnamed").not.toBeNull()
    expect(await page.evaluate((idx) => { const a = (window as W).__neural, h = a._lastHoverLabel; return !!h && (h.idx === idx || h.idx === a.nodes[idx].pi) }, single.idx), "merged: the orb under the mouse is named by the single label").toBe(true)
    expect((await audit(page)).close, "...and the other names keep clear of it").toEqual([])
    await page.mouse.move(4, 4); await journey(page).advance(600)
    await pullBack(page, 4, cam0)
    const card = (await pick(true))[0]
    expect(card, "a dealt move left unnamed by the full map, its orb in the free map and its card on screen").toBeTruthy()
    await page.mouse.move(card.card.x, card.card.y)
    await journey(page).advance(34)
    expect(await page.evaluate((idx) => ((window as W).__neural._lastOptLabels || []).includes(idx), card.idx), "the card under the mouse names its orb").toBe(true)
    const r2 = await audit(page)
    expect(r2.close, "...and nothing sits on it").toEqual([])
    // the pointer is over the card, not the map: no node under the card is hovered and named there (it used to be)
    expect(r2.under, "...and nothing is named under the card the pointer is on").toEqual([])
  })
})

test.describe("a card turned up by touch names its orb (390x631)", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("moves hidden: tapping a face-down card turns it up and the map names its orb; the drawer open names nothing", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top", { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 } })
    expect((await page.evaluate(() => (window as W).__neural._lastOptLabels || [])).length, "face down: no move is named").toBe(0)
    // a face-down card whose orb is in the free map, the row swiped to it as a thumb would (the row scrolls sideways)
    const t = await page.evaluate(() => {
      const a = (window as W).__neural, s = a.W / a.cam.vw, rowTop = a.optionsRef.current.getBoundingClientRect().top
      for (const c of (a._optionCards || []).filter((c: W) => !c.opt.threat)) {
        const n = a.nodes[c.opt.idx], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2
        if (!(x > 30 && x < a.W - 30 && y > 80 && y < rowTop - 20)) continue
        c.card.setAttribute("data-mn", "1"); c.card.scrollIntoView({ inline: "center", block: "nearest" })
        return { idx: n.idx }
      }
      return null
    })
    expect(t, "a face-down card whose orb is in the free map").not.toBeNull()
    await journey(page).advance(300)
    const at = await page.evaluate(() => { const r = document.querySelector('[data-mn="1"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, inView: r.left >= 0 && r.right <= innerWidth } })
    expect(at.inView, "the card is on screen").toBe(true)
    await page.touchscreen.tap(at.x, at.y)
    await journey(page).advance(34)
    expect(await page.locator('[data-mn="1"]').getAttribute("data-revealed"), "the tap turned it up").not.toBeNull()
    expect(await page.evaluate((idx) => ((window as W).__neural._lastOptLabels || []).includes(idx), t!.idx), "the map names the card just turned up").toBe(true)
    const r = await audit(page)
    expect([r.close, r.outside, r.under], "and it sits clear of every name, the edge and every control").toEqual([[], [], []])
    // the drawer takes a phone's screen: no name is written under it, the position's own included
    await journey(page).clickByMouse(".ng-logo", "open the drawer")
    await journey(page).advance(600)
    const open = await page.evaluate(() => { const a = (window as W).__neural; return { shown: !!a.deckShown, boxes: (a._lastNameBoxes || []).length, pair: a._lastPairLabel, rich: a._lastRichLabel } })
    expect(open.shown, "the drawer is open").toBe(true)
    expect([open.boxes, open.pair, open.rich], "nothing is written on the map under the drawer").toEqual([0, null, null])
  })
})
