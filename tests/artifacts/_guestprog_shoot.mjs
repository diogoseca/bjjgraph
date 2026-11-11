#!/usr/bin/env node
/**
 * GUESTPROG SHOOT (2026-11-11): today / a / b / c of "guest practice at sign-in", at 390x844 and 1440x900, for the
 * owner to pick from. NOT a gate and NOT a test. It drives this worktree's own built site (`source/public`, served by
 * scripts/e2e-serve.mjs on a private port) with the real wall clock, a real mouse at measured coordinates, and a
 * SYNTHETIC sign-in: a stub SDK under the real facade, as e2e/fixtures/neural-auth-sdk.ts does. Never a real account;
 * the address on screen is player@example.com. Every request off localhost is aborted, so a shoot sends no analytics.
 *
 * The guest's practice is written through the app (prep, card stages and recall proof on four position decks, then
 * the app's own save), so the guest copy on the device is what a guest who practised would leave.
 *
 *   node tests/artifacts/_guestprog_shoot.mjs <outDir> [port]
 */
import { chromium } from "playwright"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const OUT = process.argv[2] || "/tmp/guestprog"
const PORT = +(process.argv[3] || 18793)
const BASE = "http://localhost:" + PORT
const ROOT = new URL("../..", import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const AT = "/Positions/Mount/Top"
const EMAIL = "player@example.com"

const ONLY = process.env.SHOOT_ONLY || ""   // a dry run: "390:today"
const VIEWPORTS = [
  { tag: "390", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { tag: "1440", width: 1440, height: 900, deviceScaleFactor: 1 },
]

// the stub SDK, under the REAL facade (the shape of e2e/fixtures/neural-auth-sdk.ts, cut to what a sign-in needs)
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
  // SHOOT_PUBLIC: serve another finished tree read-only (a dry run of the script's mechanics); default this worktree's
  const p = spawn(process.execPath, [path.join(ROOT, "scripts/e2e-serve.mjs"), process.env.SHOOT_PUBLIC || path.join(ROOT, "source/public"), "-l", String(PORT)], { stdio: "ignore" })
  for (let i = 0; i < 100; i++) { try { const r = await fetch(BASE + "/"); if (r.ok) return p } catch (e) {} await sleep(200) }
  p.kill(); throw new Error("server did not start on " + PORT)
}

const appState = (page) => page.evaluate(() => {
  const a = window.__neural
  return a ? { kind: a._progressOwner && a._progressOwner.kind, ready: !!a._progressLoaded && !!(a.nodes && a.nodes.length) && !!(a.flashcards && a.flashcards.decks),
    user: a._authUserId || null, landed: !!a._decision, pulled: a._pulledUserId || null } : null
})
async function until(page, ok, what, ms = 60000) {
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
  await sleep(400)
}
async function openMenu(page, vp) {
  if (!(await page.locator(".ngAcctChip").isVisible())) await press(page, ".ng-logo", vp)
  await sleep(600)
  await press(page, ".ngAcctChip", vp)
  await sleep(500)
}

// a guest who practised: four position decks fully learned and recall-proven, saved by the app itself
async function practise(page) {
  await page.evaluate(() => {
    const a = window.__neural, keys = ["Mount|Top", "Closed Guard|Bottom", "Side Control|Top", "Back Control|Top"]
    for (const k of keys) {
      const d = a.flashcards.decks[k]; if (!d) continue
      const n = d.n || (a._cardsOf(d) || []).length || 4, cards = a._cardsOf(d)
      const st = (a.stage[k] = a.stage[k] || {})
      for (let i = 0; i < n; i++) st[cards && cards[i] ? a.qhash(cards[i].q) : "shoot" + i] = 3
      a.prep[k] = n; a.rec[k] = 3
    }
    a._publishKnowledge("shoot"); a._flushSave()
  })
}
async function signIn(page, id) {
  await page.evaluate(async ({ id, email }) => { await window.__bjjAuth.ensureClientInitialized(); window.__shootAuth.emit("SIGNED_IN", id, { email, name: "Player" }) }, { id, email: EMAIL })
  await until(page, (s) => s.kind === "account" && s.user === id && s.ready, "the account")
}
async function signOut(page) {
  await page.evaluate(async () => { await window.__bjjAuth.signOut() })
  await until(page, (s) => s.kind === "guest" && s.ready, "the guest")
}

async function scene(browser, vp, variant, { shared = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, reducedMotion: "reduce" })
  await ctx.route((u) => !/^https?:\/\/localhost(:\d+)?\//.test(u.href), (r) => r.abort())
  await ctx.addInitScript(stubSdk)
  await ctx.addInitScript((v) => { try { if (v) localStorage.setItem("bjj-guestprog-variant", v); else localStorage.removeItem("bjj-guestprog-variant") } catch (e) {} }, variant === "today" ? null : variant)
  const page = await ctx.newPage()
  await page.goto(BASE + AT, { waitUntil: "domcontentloaded" })
  await until(page, (s) => s.kind === "guest" && s.ready && s.landed, "the guest's first landing", 90000)
  if (shared) { await signIn(page, "someone-else"); await signOut(page) }   // another account used this browser first
  await practise(page)
  await signIn(page, "player-1")
  await until(page, (s) => s.landed, "the account's first landing", 90000)
  await settle(page)
  return { ctx, page }
}
async function shot(page, name) {
  const file = path.join(OUT, name + ".jpg")
  await page.screenshot({ path: file, type: "jpeg", quality: 82 })
  console.log("  " + path.basename(file))
}
const facts = (page) => page.evaluate(() => {
  const a = window.__neural, m = document.querySelector(".ng-account-menu")
  return { variant: localStorage.getItem("bjj-guestprog-variant") || "today", owner: a._progressOwner.kind,
    menuRows: m ? [...m.querySelectorAll("button,[data-menu-email],[data-menu-moves]")].map((b) => b.textContent.trim()).filter(Boolean) : null,
    question: (document.querySelector("[data-guest-join] p") || {}).textContent || null,
    dialog: (document.querySelector("[data-progress-import] p") || {}).textContent || null,
    event: [a.evKickerRef.current && a.evKickerRef.current.textContent, a.evTextRef.current && a.evTextRef.current.textContent],
    mastered: a.masteredCount(), guestCopy: !!localStorage.getItem("bjj-neural-owner:guest:progress") }
})

// one scene failing must not cost the others: log it, close its context, go on
async function guarded(name, fn) {
  try { await fn() } catch (e) { console.log("  SCENE FAILED " + name + ": " + (e && e.message)); log.push([name, "failed", String(e && e.message)]) }
}
const server = await serve()
const browser = await chromium.launch()
const log = []
try {
  for (const vp of VIEWPORTS) {
    if (ONLY && !ONLY.startsWith(vp.tag + ":")) continue
    console.log(vp.tag)
    let n = 0
    const nn = () => String(++n).padStart(2, "0")
    // TODAY: the menu with the row, then the dialog it opens
    await guarded("today-" + vp.tag, async () => { const { ctx, page } = await scene(browser, vp, "today")
      await openMenu(page, vp); log.push(["today-menu", vp.tag, await facts(page)]); await shot(page, nn() + "-today-menu-" + vp.tag)
      await press(page, "[data-menu-import-guest]", vp); await settle(page, 800); log.push(["today-dialog", vp.tag, await facts(page)]); await shot(page, nn() + "-today-dialog-" + vp.tag)
      await ctx.close() })
    if (ONLY.endsWith(":today")) continue
    // A: the moment of sign-in (one line), then the menu
    await guarded("a-" + vp.tag, async () => { const { ctx, page } = await scene(browser, vp, "a")
      log.push(["a-signin", vp.tag, await facts(page)]); await shot(page, nn() + "-a-signin-" + vp.tag)
      await openMenu(page, vp); log.push(["a-menu", vp.tag, await facts(page)]); await shot(page, nn() + "-a-menu-" + vp.tag)
      await ctx.close() })
    // B: the question at sign-in, then (after Add it) the menu
    await guarded("b-" + vp.tag, async () => { const { ctx, page } = await scene(browser, vp, "b")
      log.push(["b-signin", vp.tag, await facts(page)]); await shot(page, nn() + "-b-signin-" + vp.tag)
      await press(page, "[data-guest-join-yes]", vp); await settle(page, 1200)
      await openMenu(page, vp); log.push(["b-menu", vp.tag, await facts(page)]); await shot(page, nn() + "-b-menu-" + vp.tag)
      await ctx.close() })
    // C: a browser only this account has used (adds, one line), and one another account used first (asks)
    await guarded("c-alone-" + vp.tag, async () => { const { ctx, page } = await scene(browser, vp, "c")
      log.push(["c-signin-alone", vp.tag, await facts(page)]); await shot(page, nn() + "-c-signin-alone-" + vp.tag)
      await ctx.close() })
    await guarded("c-shared-" + vp.tag, async () => { const { ctx, page } = await scene(browser, vp, "c", { shared: true })
      log.push(["c-signin-shared", vp.tag, await facts(page)]); await shot(page, nn() + "-c-signin-shared-" + vp.tag)
      await ctx.close() })
  }
} finally {
  await browser.close(); server.kill()
  fs.writeFileSync(path.join(OUT, "shoot-facts.json"), JSON.stringify(log, null, 1))
}
