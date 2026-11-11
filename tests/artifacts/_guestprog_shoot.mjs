#!/usr/bin/env node
/**
 * GUESTPROG SHOOT (v1.262.0): the badge menu before and after, and the moment of sign-in, at 390x844 and 1440x900, for
 * the owner. NOT a gate and NOT a test. It serves a finished tree (scripts/e2e-serve.mjs, a private port) with the real
 * wall clock, presses with a real mouse or a touch tap at measured coordinates, and signs in through the REAL facade
 * with a stub SDK (the shape of e2e/fixtures/neural-auth-sdk.ts): never a real account, and the only address on screen
 * is player@example.com. Every request off localhost is aborted, so a shoot sends no analytics.
 *
 * A guest practises (four position decks learned and recall-proven, then the app's own save), signs in, and the
 * frames are: the moment of sign-in (after the first landing), then the badge menu.
 *
 *   node tests/artifacts/_guestprog_shoot.mjs <outDir> <publicDir> <label> [port]
 *   label "before" names frames 01-02, "after" 03-04 (NN-what-WIDTH.jpg).
 */
import { chromium } from "playwright"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const [OUT = "/tmp/guestprog", PUBLIC, LABEL = "after", PORT_ARG] = process.argv.slice(2)
const PORT = +(PORT_ARG || 18793)
const BASE = "http://localhost:" + PORT
const ROOT = new URL("../..", import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const AT = "/Positions/Mount/Top"
const EMAIL = "player@example.com"
const VIEWPORTS = [
  { tag: "390", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { tag: "1440", width: 1440, height: 900, deviceScaleFactor: 1 },
]

function stubSdk() {
  const w = window
  const listeners = new Set(), tokenKey = "sb-shoot-fixture-auth-token", cloudKey = "__shootCloud"
  const cloud = new Map(Object.entries(JSON.parse(sessionStorage.getItem(cloudKey) || "{}")))
  let user = null
  try { const s = JSON.parse(localStorage.getItem(tokenKey) || "null"); if (s && s.user && s.user.id) user = s.user } catch (e) {}
  const session = () => (user ? { user: JSON.parse(JSON.stringify(user)), access_token: "synthetic-token-only" } : null)
  const emit = (event, id, profile) => {
    user = id ? { id, email: (profile && profile.email) || id + "@example.invalid", user_metadata: { full_name: (profile && profile.name) || id } } : null
    if (user) localStorage.setItem(tokenKey, JSON.stringify(session())); else localStorage.removeItem(tokenKey)
    for (const l of [...listeners]) l(event, session())
  }
  const client = {
    auth: {
      getSession: async () => ({ data: { session: session() }, error: null }),
      getUser: async () => ({ data: { user: user && JSON.parse(JSON.stringify(user)) }, error: null }),
      onAuthStateChange: (l) => { listeners.add(l); return { data: { subscription: { unsubscribe: () => listeners.delete(l) } } } },
      signOut: async () => { emit("SIGNED_OUT", null); return { error: null } },
    },
    from: () => {
      let uid = null, pending = null
      const q = {
        select: () => q, eq: (_c, v) => { uid = v; return q },
        maybeSingle: async () => ({ data: uid && cloud.has(uid) ? { neural: cloud.get(uid) } : null, error: null }),
        upsert: (row) => { pending = JSON.parse(JSON.stringify(row)); return q },
        single: async () => { cloud.set(pending.user_id, pending.neural); sessionStorage.setItem(cloudKey, JSON.stringify(Object.fromEntries(cloud))); return { data: null, error: null } },
      }
      return q
    },
  }
  Object.defineProperty(w, "__SUPABASE_URL", { configurable: true, get: () => "https://shoot-fixture.supabase.invalid", set: () => {} })
  Object.defineProperty(w, "__SUPABASE_ANON_KEY", { configurable: true, get: () => "synthetic-public-key", set: () => {} })
  w.supabase = { createClient: () => client }
  w.__shootAuth = { emit }
}

async function serve() {
  const p = spawn(process.execPath, [path.join(ROOT, "scripts/e2e-serve.mjs"), PUBLIC || path.join(ROOT, "source/public"), "-l", String(PORT)], { stdio: "ignore" })
  for (let i = 0; i < 100; i++) { try { const r = await fetch(BASE + "/"); if (r.ok) return p } catch (e) {} await sleep(200) }
  p.kill(); throw new Error("server did not start on " + PORT)
}
const appState = (page) => page.evaluate(() => {
  const a = window.__neural
  return a ? { kind: a._progressOwner && a._progressOwner.kind, ready: !!a._progressLoaded && !!(a.nodes && a.nodes.length) && !!(a.flashcards && a.flashcards.decks),
    user: a._authUserId || null, landed: !!a._decision } : null
})
async function until(page, ok, what, ms = 90000) {
  const t0 = Date.now()
  for (;;) { const s = await appState(page); if (s && ok(s)) return s; if (Date.now() - t0 > ms) throw new Error("timed out waiting for " + what + ": " + JSON.stringify(s)); await sleep(250) }
}
async function settle(page, ms = 2500) { await sleep(ms); for (let i = 0; i < 4; i++) { await page.evaluate(() => document.body.getBoundingClientRect().top); await sleep(150) } }
async function press(page, sel, vp) {
  const hit = await page.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return { why: "no " + s }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.width < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { why: "off screen " + s }
    const top = document.elementFromPoint(x, y)
    return el === top || el.contains(top) ? { x, y } : { why: s + " covered by " + (top && (top.className || top.tagName)) }
  }, sel)
  if (hit.why) throw new Error(hit.why)
  if (vp.hasTouch) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y)
  await sleep(500)
}
async function openMenu(page, vp) {
  if (!(await page.locator(".ngAcctChip").isVisible())) { await press(page, ".ng-logo", vp); await sleep(600) }
  await press(page, ".ngAcctChip", vp)
}
async function practise(page) {
  await page.evaluate(() => {
    const a = window.__neural
    for (const k of ["Mount|Top", "Closed Guard|Bottom", "Side Control|Top", "Back Control|Top"]) {
      const d = a.flashcards.decks[k]; if (!d) continue
      const cards = a._cardsOf(d) || [], n = d.n || cards.length || 4, st = (a.stage[k] = a.stage[k] || {})
      for (let i = 0; i < n; i++) st[cards[i] ? a.qhash(cards[i].q) : "shoot" + i] = 3
      a.prep[k] = n; a.rec[k] = 3
    }
    a._publishKnowledge("shoot"); a._flushSave()
  })
}
const facts = (page) => page.evaluate(() => {
  const a = window.__neural, m = document.querySelector(".ng-account-menu"), box = a.evRef.current, t = a.evTextRef.current
  const range = document.createRange(); range.selectNodeContents(t)
  const lines = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)])
  return { owner: a._progressOwner.kind, menu: m && m.style.display !== "none" ? [...m.querySelectorAll("button,[data-menu-email],[data-menu-moves]")].map((b) => b.textContent.trim()).filter(Boolean) : null,
    line: box.style.opacity === "1" ? (t.textContent || "").trim() : "", lineRects: lines, mastered: a.masteredCount() }
})

const server = await serve()
const browser = await chromium.launch()
const log = []
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, reducedMotion: "reduce" })
    await ctx.route((u) => !/^https?:\/\/localhost(:\d+)?\//.test(u.href), (r) => r.abort())
    await ctx.addInitScript(stubSdk)
    const page = await ctx.newPage()
    try {
      await page.goto(BASE + AT, { waitUntil: "domcontentloaded" })
      await until(page, (s) => s.kind === "guest" && s.ready && s.landed, "the guest's first landing")
      await practise(page)
      await page.evaluate(async (email) => { await window.__bjjAuth.ensureClientInitialized(); window.__shootAuth.emit("SIGNED_IN", "player-1", { email, name: "Player" }) }, EMAIL)
      await until(page, (s) => s.kind === "account" && s.user === "player-1" && s.ready && s.landed, "the account's first landing")
      await settle(page)
      const n0 = LABEL === "before" ? 1 : 3, file = (n, what) => path.join(OUT, String(n).padStart(2, "0") + "-" + LABEL + "-" + what + "-" + vp.tag + ".jpg")
      log.push([LABEL, "signin", vp.tag, await facts(page)]); await page.screenshot({ path: file(n0, "signin"), type: "jpeg", quality: 82 })
      await openMenu(page, vp); await settle(page, 600)
      log.push([LABEL, "menu", vp.tag, await facts(page)]); await page.screenshot({ path: file(n0 + 1, "menu"), type: "jpeg", quality: 82 })
      console.log("  " + LABEL + " " + vp.tag + " ok")
    } catch (e) { console.log("  SCENE FAILED " + LABEL + " " + vp.tag + ": " + (e && e.message)); log.push([LABEL, "failed", vp.tag, String(e && e.message)]) }
    await ctx.close()
  }
} finally {
  await browser.close(); server.kill()
  fs.writeFileSync(path.join(OUT, "shoot-facts-" + LABEL + ".json"), JSON.stringify(log, null, 1))
}
