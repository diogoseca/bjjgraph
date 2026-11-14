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

/** the three marked orbs and a bare one: dealt, own (not a threat), centre on the free map, 34 px apart, nearest the middle */
const choose = (page) => page.evaluate(() => {
  const a = window.__neural, W = a.W, H = a.H, scale = W / a.cam.vw, cv = a.canvas.getBoundingClientRect()
  const on = (c) => { const n = c.opt.node, x = (n.x - a.cam.cx) * scale + W / 2, y = (a._LY(n) - a.cam.cy) * scale + H / 2; const el = document.elementFromPoint(x + cv.left, y + cv.top); return { x, y, free: x > 30 && x < W - 30 && y > 60 && y < H - 30 && el === a.canvas } }
  const own = (a._optionCards || []).filter((c) => !c.opt.threat && c.opt.node && c.opt.node.role !== "defender" && c.opt.action !== "escape").map((c) => ({ c, ...on(c) })).filter((o) => o.free)
  own.sort((p, q) => Math.hypot(p.x - W / 2, p.y - H * 0.42) - Math.hypot(q.x - W / 2, q.y - H * 0.42))
  const pick = []
  for (const o of own) if (pick.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > 34)) { pick.push(o); if (pick.length === 4) break }
  const out = pick.map((o) => ({ id: o.c.opt.node.id, idx: o.c.opt.idx, name: a.graphName(o.c.opt.node), tech: o.c.card.getAttribute("data-tech") }))
  if (out.length === 3) {
    // the phone's row covers the lower map: the bare one is then the nearest other orb on the free map (no mark either way)
    const mask = a._rulesetMask(), seat = a.focusIdx, taken = new Set(out.map((o) => o.idx))
    const bare = a.nodes.filter((n) => mask[n.idx] && (n.rep || !n.z) && n.role !== "defender" && n.idx !== seat && !taken.has(n.idx) && (a.nodes[seat] || {}).pi !== n.idx)
      .map((n) => { const x = (n.x - a.cam.cx) * scale + W / 2, y = (a._LY(n) - a.cam.cy) * scale + H / 2; const el = document.elementFromPoint(x + cv.left, y + cv.top); return { n, x, y, free: x > 30 && x < W - 30 && y > 60 && y < H - 30 && el === a.canvas } })
      .filter((o) => o.free && pick.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > 34))
      .sort((p, q) => Math.hypot(p.x - W / 2, p.y - H * 0.42) - Math.hypot(q.x - W / 2, q.y - H * 0.42))[0]
    if (bare) out.push({ id: bare.n.id, idx: bare.n.idx, name: a.graphName(bare.n), tech: null, notDealt: true })
  }
  return out
})

async function know(page, pick) {
  // recalled = pick[0], answered = pick[1], both = pick[2], bare = pick[3]
  return page.evaluate(async (pick) => {
    const a = window.__neural, byIdx = (i) => (a._optionCards || []).find((c) => c.opt.idx === i)
    for (const p of [pick[0], pick[2]]) { const c = byIdx(p.idx); a._gradeMove(c.opt, true, c.card) }
    const role = { top: "Top", bottom: "Bottom", attacker: "Attacker" }
    for (const p of [pick[1], pick[2]]) {
      const n = a.nodes[p.idx], key = (n.ty === "positions" ? n.t.replace(/\s+(Top|Bottom)\s*$/i, "") : n.t) + "|" + role[n.role]
      if (!a._deckHasCards(key)) await a.hydrateDeck(key)
      const d = a.flashcards.decks[key]
      a.stage[key] = Object.fromEntries(a._cardsOf(d).map((c) => [a.qhash(c.q), 3]))
      p.key = key
    }
    a._publishKnowledge("pictures:knowledge")
    return pick.map((p) => ({ ...p, mastery: p.key ? a.deckMastery(p.key) : null }))
  }, pick)
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
  for (const [k, p] of [["recalled", pick[0]], ["answered", pick[1]], ["both", pick[2]], ["bare", pick[3]]].filter(([, p]) => p && !p.notDealt)) {
    const box = await page.evaluate((idx) => {
      const a = window.__neural, c = (a._optionCards || []).find((c) => c.opt.idx === idx).card
      c.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" })
      const r = c.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height, seal: c.getAttribute("data-seal") }
    }, p.idx)
    await page.evaluate(() => window.__neural.advance(34)); await sleep(350)
    const f = path.join(OUT, `${name}-${k}-${TAG}.png`)
    const vp = page.viewportSize()
    await page.screenshot({ path: f, clip: { x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4), width: Math.min(vp.width - Math.max(0, box.x - 4), box.w + 8), height: Math.min(vp.height - Math.max(0, box.y - 4), box.h + 8) } })
    out.push({ k, file: f, seal: box.seal })
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
    a.draw()
    const W = a.W, H = a.H, scale = W / a.cam.vw, pos = (m) => ({ x: (m.x - a.cam.cx) * scale + W / 2, y: (a._LY(m) - a.cam.cy) * scale + H / 2 })
    return { pair: [n.t, p.t], lod: best, rs: (a._lastMapMarks || []).filter((m) => both.has(m.idx)).map((m) => +m.rs.toFixed(2)), a: pos(n), b: pos(p), vw: a.cam.vw }
  })
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
    const pick = await choose(page)
    if (pick.length < 4) throw Error(vp.key + ": only " + pick.length + " dealt orbs on the free map")
    const known = await know(page, pick)
    meta[vp.key + "-pick"] = known
    await page.evaluate((idx) => { window.__shootExtra = idx }, known.filter((p) => p.notDealt).map((p) => p.idx))
    console.log(vp.key, known.map((p) => p.name + (p.mastery != null ? " m=" + p.mastery : "")).join(" | "))
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
fs.writeFileSync(path.join(OUT, `meta-${TAG}.json`), JSON.stringify(meta, null, 1))
