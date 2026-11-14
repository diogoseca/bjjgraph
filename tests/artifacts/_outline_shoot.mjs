#!/usr/bin/env node
/**
 * THE MAP'S GOLD OUTLINES: THE OWNER'S PICTURES (v1.280.0, GOLD1; NOT a gate, NOT a test: the gates are
 * e2e/journeys/map-gold.spec.ts, the ink, and known-move-seal.spec.ts, the place and the gates).
 *
 * The same seat (Mount top) and the same knowledge on dev's bundle (`--app DIR`, "before": the dot, and the filled / hollow
 * seal) and on the build ("after": the outlines, and the ring / disc / both seal). The knowledge is REAL: a Yes through the
 * app's own grade (`_gradeMove`), a deck learned by its real cards at stage 3 and the app's own publish. Three dealt orbs on
 * the free map (centre under no control, 34 px apart, nearest the middle) are recalled / answered / both; a fourth dealt
 * orb stays bare. Each shot is the camera at rest, then one more drawn frame. Shots: phone 390x844 dpr 3 at the landing
 * zoom and pulled back 4 times (the app's own wheel), desktop 1440x900 dpr 2 at the landing zoom; the four cards' seals,
 * each where it sits; with --overlap, a position pair at mitosis (kLOD near 0.62: the partner half is drawn at alpha kLOD and wears a mark above 0.55) with both halves marked both ways (set on
 * the instance: a seat's outside line needs every one of its dealt moves a Yes), cropped at device pixels. `meta-<tag>.json`
 * records each frame's published marks (`_lastMapMarks`, or the dot's `_lastMapSeals`) with their `rs`.
 * Serve a built tree first (node scripts/e2e-serve.mjs source/public -l 8196), then:
 *
 *   node tests/artifacts/_outline_shoot.mjs <outDir> --tag before --app <dev's neural/dist> --overlap
 *   node tests/artifacts/_outline_shoot.mjs <outDir> --tag after --overlap
 *   node tests/artifacts/_outline_shoot.mjs <outDir> --tag perorb --app <a per-orb variant's dist> --overlap --only overlap
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const [OUT] = process.argv.slice(2), args = process.argv.slice(3), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d }
const BASE = opt("base", "http://localhost:8196"), APP = opt("app", null), TAG = opt("tag", "after"), ONLY = opt("only", null), OVERLAP = args.includes("--overlap")
const APP_FILES = APP ? new Set(fs.readdirSync(APP)) : null
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const meta = { tag: TAG, app: APP, shots: {} }
const browser = await chromium.launch()

async function boot(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.dpr })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.clear() } catch {}; window.__NEURAL_TEST__ = true })
  await page.route("**/*", (r) => {
    const u = r.request().url()
    if (/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) {
      const p = new URL(u).pathname, f = path.basename(p)
      if (APP_FILES && p === "/static/neural/app/" + f && APP_FILES.has(f)) return r.fulfill({ path: path.join(APP, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
      return /\/static\/neural\/content\//.test(u) ? r.fulfill({ body: "{}", contentType: "application/json" }) : r.continue()
    }
    if (/fonts\./.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: "" })
    return r.abort()
  })
  await page.goto(BASE + "/?ngb=1", { waitUntil: "commit" })
  await page.waitForFunction(() => { const a = window.__neural; return a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks }, null, { timeout: 120000 })
  await page.evaluate(() => { const a = window.__neural; if (a.TUTORIAL) { a.tut = { done: {} }; for (const s of a.TUTORIAL) a.tut.done[s.id] = 1; a._syncWhiteChallengeCompatibility(Date.now()); a.tutHidden = true; a.renderTutorial() } a.rig("ai-skill", [0.5]); a.rig("role", [0]); a.rig("max-moves", [0.5]); a.rigStart(a.nodes.findIndex((n) => n.ty === "positions" && n.t === "Mount Top")) })
  for (let i = 0; i < 16; i++) { await page.evaluate(() => window.__neural.advance(1000)); if (await page.evaluate(() => (window.__neural.optionIdxs || []).length > 0 && window.__neural._arriveGlideUntil == null)) break }
  await page.evaluate(() => window.__neural.advance(3000)); await sleep(1800)
  await page.evaluate(() => document.querySelectorAll("[data-reward]").forEach((e) => e.remove()))
  return { ctx, page }
}

/** settle: the camera at rest, the wall-clock fades done, then one more drawn frame */
async function rest(page) {
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__neural.advance(250))
  await sleep(700)
  await page.evaluate(() => window.__neural.advance(17))
  await sleep(120)
}

/** the map's four (recalled, answered, both, bare) on the free map (centre under no control, 34 px apart, nearest the middle):
 *  recalled and both are dealt orbs (a Yes is given to a dealt move); answered and bare are dealt orbs when enough are free,
 *  else the nearest other orbs (a learned deck marks any orb). The cards' four are dealt cards: the same where the map's
 *  are dealt, else other dealt cards (a card's seal shows wherever its orb is). */
const choose = (page) => page.evaluate(() => {
  const a = window.__neural, W = a.W, H = a.H, scale = W / a.cam.vw, cv = a.canvas.getBoundingClientRect()
  const at = (n) => { const x = (n.x - a.cam.cx) * scale + W / 2, y = (a._LY(n) - a.cam.cy) * scale + H / 2; const el = document.elementFromPoint(x + cv.left, y + cv.top); return { x, y, free: x > 30 && x < W - 30 && y > 60 && y < H - 30 && el === a.canvas } }
  const mid = (p, q) => Math.hypot(p.x - W / 2, p.y - H * 0.42) - Math.hypot(q.x - W / 2, q.y - H * 0.42)
  const cards = (a._optionCards || []).filter((c) => !c.opt.threat && c.opt.node && c.opt.node.role !== "defender" && c.opt.action !== "escape")
  const dealt = cards.map((c) => ({ c, idx: c.opt.idx, ...at(c.opt.node) })).filter((o) => o.free).sort(mid)
  const map = []
  for (const o of dealt) if (map.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > 34)) { map.push(o); if (map.length === 4) break }
  if (map.length < 2) return { error: "only " + map.length + " dealt orbs on the free map" }
  const mask = a._rulesetMask(), seat = a.focusIdx, taken = new Set(map.map((o) => o.idx))
  const role = { top: "Top", bottom: "Bottom", attacker: "Attacker" }
  const deckOf = (n) => (n.ty === "positions" ? n.t.replace(/\s+(Top|Bottom)\s*$/i, "") : n.t) + "|" + role[n.role]
  const others = a.nodes.filter((n) => mask[n.idx] && (n.rep || !n.z) && role[n.role] && n.idx !== seat && (a.nodes[seat] || {}).pi !== n.idx && !taken.has(n.idx) && (a.flashcards.decks[deckOf(n)] || {}).n > 0)
    .map((n) => ({ n, idx: n.idx, ...at(n) })).filter((o) => o.free).sort(mid)
  const more = () => { const o = others.find((o) => !taken.has(o.idx) && map.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > 34)); if (o) { taken.add(o.idx); map.push(o) } return o }
  // the map: [recalled, answered, both, bare]
  const m = [map[0], map[2] || more(), map[1], map[3] || more()]
  if (m.some((o) => !o)) return { error: "no free orb for every state" }
  const used = new Set(m.filter((o) => o.c).map((o) => o.idx)), spare = cards.filter((c) => !used.has(c.opt.idx))
  const card = (o) => o.c ? o.c.opt.idx : (spare.shift() || {}).opt?.idx
  const pick = m.map((o, i) => ({ k: ["recalled", "answered", "both", "bare"][i], idx: o.idx, name: a.graphName(a.nodes[o.idx]), dealt: !!o.c, card: card(o) }))
  return { pick }
})

async function know(page, pick) {
  // a Yes on the recalled and both cards; the decks of the answered and both orbs learned, and of the answered card when it is
  // another (so its seal shows the disc). The decks hydrate fire-and-forget, then one SYNCHRONOUS evaluate writes: a long
  // async evaluate can be collected under load and reads as "Execution context was destroyed" (a navigation that never was)
  const keys = await page.evaluate((pick) => {
    const a = window.__neural, idx = [pick[1].idx, pick[2].idx].concat(pick[1].card !== pick[1].idx ? [pick[1].card] : [])
    const keyOf = (n) => (n.ty === "positions" ? n.t.replace(/\s+(Top|Bottom)\s*$/i, "") : n.t) + "|" + { top: "Top", bottom: "Bottom", attacker: "Attacker" }[n.role]
    const ks = idx.map((i) => keyOf(a.nodes[i]))
    for (const k of ks) if (!a._deckHasCards(k)) void a.hydrateDeck(k)
    return ks
  }, pick)
  await page.waitForFunction((ks) => ks.every((k) => window.__neural._deckHasCards(k)), keys, { timeout: 60000 })
  return page.evaluate(([pick, keys]) => {
    const a = window.__neural, byIdx = (i) => (a._optionCards || []).find((c) => c.opt.idx === i)
    for (const p of [pick[0], pick[2]]) { const c = byIdx(p.card); a._gradeMove(c.opt, true, c.card) }
    for (const k of keys) a.stage[k] = Object.fromEntries(a._cardsOf(a.flashcards.decks[k]).map((c) => [a.qhash(c.q), 3]))
    pick[1].key = keys[0]; pick[2].key = keys[1]; if (keys[2]) pick[1].cardKey = keys[2]
    a._publishKnowledge("pictures:knowledge")
    return pick.map((p) => ({ ...p, mastery: p.key ? a.deckMastery(p.key) : null }))
  }, [pick, keys])
}

const marks = (page) => page.evaluate(() => {
  const a = window.__neural
  const scale = a.W / a.cam.vw, orbs = [...new Set([...(a.optionIdxs || []), ...(window.__shootExtra || [])])].map((i) => { const n = a.nodes[i]; return { idx: i, x: (n.x - a.cam.cx) * scale + a.W / 2, y: (a._LY(n) - a.cam.cy) * scale + a.H / 2, R: a._nodeHalfW(n, scale, a._nodeK, a._lodK, true) } })
  return { lod: a._lodK, vw: a.cam.vw, orbs, marks: (a._lastMapMarks || []).map((m) => ({ idx: m.idx, rs: +m.rs.toFixed(2), out: m.out, inK: +(m.inK || 0).toFixed(2), seat: m.seat, x: m.x, y: m.y, ty: m.ty })), dots: (a._lastMapSeals || []).map((s) => ({ idx: s.idx, x: s.x, y: s.y, r: s.r })) }
})

async function shot(page, name, extra) {
  const f = path.join(OUT, `${name}-${TAG}.png`)
  await page.screenshot({ path: f })
  meta.shots[name] = { file: f, ...(await marks(page)), ...(extra || {}) }
  console.log(f)
}

/** the cards of the four, cropped where they sit (scrolled into the row), true size */
async function seals(page, name, pick) {
  const out = []
  for (const [k, p] of [["recalled", pick[0]], ["answered", pick[1]], ["both", pick[2]], ["bare", pick[3]]].filter(([, p]) => p && p.card != null)) {
    await page.evaluate((idx) => {
      const a = window.__neural, c = (a._optionCards || []).find((c) => c.opt.idx === idx).card
      c.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" })
    }, p.card)
    await page.evaluate(() => window.__neural.advance(34)); await sleep(500)
    // measured AFTER the row has settled (its own animator may glide it): the card's box and the seal's own
    const box = await page.evaluate((idx) => {
      const a = window.__neural, c = (a._optionCards || []).find((c) => c.opt.idx === idx).card, r = c.getBoundingClientRect()
      const s = c.querySelector("[data-choice-seal]"), q = s ? s.getBoundingClientRect() : null
      return { x: r.left, y: r.top, w: r.width, h: r.height, seal: c.getAttribute("data-seal"), sealBox: q && { x: q.left - Math.max(0, r.left - 4), y: q.top - Math.max(0, r.top - 4), w: q.width, h: q.height } }
    }, p.card)
    const f = path.join(OUT, `${name}-${k}-${TAG}.png`)
    const vp = page.viewportSize()
    await page.screenshot({ path: f, clip: { x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4), width: Math.min(vp.width - Math.max(0, box.x - 4), box.w + 8), height: Math.min(vp.height - Math.max(0, box.y - 4), box.h + 8) } })
    out.push({ k, file: f, seal: box.seal, sealBox: box.sealBox })
  }
  meta.shots[name] = { cards: out }
  console.log(name, out.map((o) => o.k + "=" + o.seal).join(" "))
}

async function overlap(page, name) {
  // a position pair (not the seat), both halves drawn in this ruleset, the camera on its mid point at the zoom where kLOD ~ 0.5
  const r = await page.evaluate(() => {
    const a = window.__neural, mask = a._rulesetMask(), seat = a.currentPos
    const cand = a.nodes.filter((n) => n.ty === "positions" && n.rep && n.pi >= 0 && n.idx !== seat && n.pi !== seat && mask[n.idx] && mask[n.pi])
    const n = cand.find((n) => /^Side Control/.test(n.t)) || cand[0], p = a.nodes[n.pi]
    const both = new Set([n.idx, p.idx])
    a._movesGold = () => new Map([[n.idx, 1], [p.idx, 1]]); a._answered = (m) => both.has(m.idx); a._movesLearned = () => both
    a.setPaused(true); a.focusIdx = a.focusIdx
    let lo = Math.log(a.graphW * 0.002), hi = Math.log(a.graphW * 3), best = null
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2, m = a.pairMid(n)
      Object.assign(a.cam, { vw: Math.exp(mid), lvw: mid, cx: m.x, cy: m.y }); Object.assign(a.camTarget, { vw: Math.exp(mid), cx: m.x, cy: m.y })
      a.draw()
      best = a._lodK
      if (a._lodK > 0.62) lo = mid; else hi = mid
    }
    // where the canvas is on top: the pair's mid at the first height (from a fifth of the screen down) with no control over
    // it or 40 px around it (the phone's row and card cover the lower half), the camera held there
    const W = a.W, H = a.H, scale = W / a.cam.vw, cv = a.canvas.getBoundingClientRect(), m = a.pairMid(n)
    const free = (x, y) => [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40]].every(([dx, dy]) => document.elementFromPoint(cv.left + x + dx, cv.top + y + dy) === a.canvas)
    let yT = null
    for (let f = 0.2; f <= 0.8 && yT == null; f += 0.02) if (free(W / 2, H * f)) yT = H * f
    if (yT == null) yT = H / 2
    a.cam.cx = m.x; a.cam.cy = m.y - (yT - H / 2) / scale; Object.assign(a.camTarget, { cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw })
    if (a.holdCamera) a.holdCamera(60)
    a.draw()
    const pos = (q) => ({ x: (q.x - a.cam.cx) * scale + W / 2, y: (a._LY(q) - a.cam.cy) * scale + H / 2 })
    return { pair: [n.t, p.t], lod: best, rs: (a._lastMapMarks || []).filter((q) => both.has(q.idx)).map((q) => +q.rs.toFixed(2)), a: pos(n), b: pos(p), vw: a.cam.vw, yT, free: free(W / 2, yT) }
  })
  await page.evaluate(() => window.__neural.advance(17)); await sleep(150)   // one more drawn frame, the camera held
  const x0 = Math.min(r.a.x, r.b.x), x1 = Math.max(r.a.x, r.b.x), y0 = Math.min(r.a.y, r.b.y), y1 = Math.max(r.a.y, r.b.y), pad = 26
  const f = path.join(OUT, `${name}-${TAG}.png`)
  await page.screenshot({ path: f, clip: { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad } })
  meta.shots[name] = { file: f, ...r }
  console.log(f, JSON.stringify(r))
}

const VPS = [{ key: "phone", w: 390, h: 844, dpr: 3, mobile: true }, { key: "desktop", w: 1440, h: 900, dpr: 2, mobile: false }]
for (const vp of VPS) {
  const { ctx, page } = await boot(vp)
  if (ONLY !== "overlap") {
    const ch = await choose(page)
    if (ch.error) throw Error(vp.key + ": " + ch.error)
    const known = await know(page, ch.pick)
    meta[vp.key + "-pick"] = known
    await page.evaluate((idx) => { window.__shootExtra = idx }, known.filter((p) => !p.dealt).map((p) => p.idx))
    console.log(vp.key, known.map((p) => p.k + ": " + p.name + (p.dealt ? "" : " (not dealt)") + (p.mastery != null ? " m=" + p.mastery : "")).join(" | "))
    await page.evaluate(() => { const a = window.__neural, row = a.optionsRef && a.optionsRef.current; if (row) row.scrollTo({ left: 0, behavior: "instant" }) })
    await rest(page)
    await shot(page, vp.key + "-landing")
    if (vp.key === "phone") {
      const cam0 = await page.evaluate(() => ({ ...window.__neural.cam }))
      await page.evaluate(() => {
        const a = window.__neural, n = a.nodes[a.focusIdx], m = a.pairMid(n), scale = a.W / a.cam.vw, r = a.canvas.getBoundingClientRect()
        a.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(4) / 0.0012, clientX: (m.x - a.cam.cx) * scale + a.W / 2 + r.left, clientY: (m.y - a.cam.cy) * scale + a.H / 2 + r.top, bubbles: true, cancelable: true }))
      })
      await rest(page)
      await shot(page, "phone-pulled4", { vw0: cam0.vw })
      await page.evaluate((c) => { const a = window.__neural; Object.assign(a.cam, c); Object.assign(a.camTarget, { cx: c.cx, cy: c.cy, vw: c.vw }) }, cam0)
      await rest(page)
    }
    await seals(page, vp.key + "-seals", known)
  }
  if (OVERLAP) await overlap(page, vp.key + "-overlap")
  await ctx.close()
}
await browser.close()
// a partial run (--only) merges into the meta a full run wrote, so the other shots' records survive
const metaFile = path.join(OUT, `meta-${TAG}.json`)
if (ONLY && fs.existsSync(metaFile)) { const old = JSON.parse(fs.readFileSync(metaFile, "utf8")); meta.shots = { ...old.shots, ...meta.shots }; for (const k of Object.keys(old)) if (!(k in meta)) meta[k] = old[k] }
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1))
