#!/usr/bin/env node
// check_deployed_console.mjs — open a DEPLOYED site in a real browser, with its real headers and
// its real third parties, and fail naming every URL that leaves the console dirty.
//
// WHY THIS EXISTS (CONSOLE0, 2026-10-05). The owner opened the dev preview in Brave and saw a 404
// for /Positions/static/icon.png and 33 report-only CSP violations. Every gate was green, because
// none of them can see a deployed page: the e2e harness aborts every non-localhost request
// (CLAUDE.md 6.4), the local build is keyless (no PostHog), and Cloudflare injects its analytics
// beacon at the EDGE, so it is in no built file. This runs after the deploy, against the deploy.
//
// WHAT IT DOES. Boot `/`, wait for the app to move the address bar itself, play one move, then
// check four things and print every offender:
//   1. CSP: no `securitypolicyviolation` event (report-only today, so these are exactly the lines
//      the owner saw), and the document must CARRY a CSP, or "no violations" means "no policy";
//   2. same-origin responses: no 4xx/5xx, and no same-origin request that failed outright;
//   3. resource URLs: none may be page-relative. Checked STRUCTURALLY, by resolving each against a
//      three-segment address, because the app picks its own landing here (it cannot be rigged on a
//      deploy) and a relative URL only breaks at depth three (see console-clean.spec.ts). The head
//      resources are also fetched at the address the app actually reached;
//   4. console errors in the page.
//
// ONE NAMED EXCEPTION, and it can only apply off production. Cloudflare Web Analytics posts to
// cloudflareinsights.com/cdn-cgi/rum, which answers CORS only for the analytics site's own host,
// bjjgraph.org. Measured 2026-10-05: on dev.bjjgraph.pages.dev that post fails with a CORS console
// error; on bjjgraph.org it succeeds. A `*.pages.dev` deploy URL therefore always logs it, whatever
// this repo does (the beacon is a dashboard setting). Off production those errors are discounted,
// COUNTED and printed; on production nothing is discounted.
//
// A blocker extension (the owner's Brave Shields: ERR_BLOCKED_BY_CLIENT for PostHog's recorder) is
// not present in CI's Chromium, so that line cannot appear here by construction. It is not a defect
// any page can fix: the browser logs a request it blocked itself.
//
// Read-only: GET requests and one OAuth-free roll. PostHog drops HeadlessChrome user agents, so
// this sends no analytics events.
//
// Usage: node scripts/check_deployed_console.mjs <origin>       e.g. https://bjjgraph.org
// Exit: 0 clean · 1 offenders (each printed) · 2 could not run.
import { pathToFileURL } from "node:url"

export const ANALYTICS_SITE_HOST = "bjjgraph.org"
const RUM = "https://cloudflareinsights.com/cdn-cgi/rum"
export const DEEP_PROBE_PATH = "/Positions/Side-Control/Bottom"

/** Pure: everything the browser saw -> offenders, discounted exceptions, coverage. */
export function classify(log) {
  const origin = new URL(log.origin)
  const offenders = []
  const discounted = []
  const sameOrigin = (u) => {
    try {
      return new URL(u).origin === origin.origin
    } catch {
      return false
    }
  }
  if (!log.csp || !/script-src/.test(log.csp))
    offenders.push(`no CSP on the document: every violation check is vacuous (${log.csp ? "no script-src" : "header absent"})`)
  for (const v of log.violations ?? []) offenders.push(`CSP ${v.dir}: ${v.blocked}${v.src ? ` (loaded by ${v.src})` : ""}`)
  for (const r of log.responses ?? [])
    if (r.status >= 400 && sameOrigin(r.url)) offenders.push(`HTTP ${r.status}: ${r.url}`)
  for (const f of log.failed ?? []) if (sameOrigin(f.url)) offenders.push(`request failed (${f.err}): ${f.url}`)
  for (const m of log.relative ?? []) offenders.push(`page-relative resource URL: ${m}`)
  for (const m of log.headFetch ?? []) offenders.push(`head resource at the reached address: ${m}`)
  const offProduction = origin.hostname !== ANALYTICS_SITE_HOST
  for (const c of log.console ?? []) {
    const rum = c.at === RUM || (c.text.includes(RUM) && /CORS|Access-Control-Allow-Origin/.test(c.text))
    if (offProduction && rum) discounted.push(`${c.text.slice(0, 120)} @ ${c.at}`)
    else offenders.push(`console error: ${c.text.slice(0, 300)}${c.at ? ` @ ${c.at}` : ""}`)
  }
  for (const e of log.pageErrors ?? []) offenders.push(`uncaught page error: ${e}`)
  if (!log.navigated) offenders.push(`the app never moved the address bar (still ${log.finalPath ?? "?"}): the client-side navigation was not exercised`)
  if (!log.played) offenders.push(`no move was played (${log.playError ?? "no hand dealt"}): the roll was not exercised`)
  if (!(log.headChecked >= 4)) offenders.push(`only ${log.headChecked ?? 0} same-origin head resources were checked; expected >= 4`)
  return { offenders, discounted, offProduction }
}

async function run(originArg) {
  const { chromium } = await import("playwright")
  const origin = new URL(originArg).origin
  const log = { origin, violations: [], responses: [], failed: [], console: [], pageErrors: [] }
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await ctx.addInitScript(() => {
      window.__cspSeen = []
      document.addEventListener(
        "securitypolicyviolation",
        (e) => window.__cspSeen.push({ dir: e.effectiveDirective, blocked: e.blockedURI, src: e.sourceFile }),
        true,
      )
    })
    const page = await ctx.newPage()
    page.on("response", (r) => log.responses.push({ status: r.status(), url: r.url() }))
    page.on("requestfailed", (r) => log.failed.push({ url: r.url(), err: r.failure()?.errorText ?? "?" }))
    page.on("console", (m) => {
      if (m.type() === "error") log.console.push({ text: m.text(), at: m.location().url || "" })
    })
    page.on("pageerror", (e) => log.pageErrors.push(String(e).slice(0, 300)))
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const drain = async () => {
      try {
        log.violations.push(...(await page.evaluate(() => window.__cspSeen.splice(0))))
      } catch {}
    }

    const doc = await page.goto(origin + "/", { waitUntil: "load", timeout: 60000 })
    log.csp = doc?.headers()["content-security-policy-report-only"] ?? doc?.headers()["content-security-policy"] ?? ""
    const loadUrl = page.url()
    for (let i = 0; i < 45 && new URL(page.url()).pathname === "/"; i++) await sleep(1000)
    log.navigated = new URL(page.url()).pathname !== "/"
    log.finalPath = new URL(page.url()).pathname
    await drain()
    try {
      const card = page.locator("[data-tech]").first()
      await card.waitFor({ state: "visible", timeout: 30000 })
      await card.click()
      log.played = true
      await sleep(10000)
    } catch (e) {
      log.playError = String(e).split("\n")[0].slice(0, 160)
    }
    await drain()
    const dom = await page.evaluate(
      async ({ loadUrl, deep }) => {
        const SKIP = /^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i
        const relative = []
        const sel = "link[href],script[src],img[src],source[src],iframe[src],video[src],audio[src],embed[src],object[data],use[href]"
        for (const el of document.querySelectorAll(sel)) {
          const attr = el.hasAttribute("src") ? "src" : el.hasAttribute("data") ? "data" : "href"
          const raw = el.getAttribute(attr) || ""
          if (!raw || SKIP.test(raw)) continue
          if (new URL(raw, loadUrl).href !== new URL(raw, new URL(deep, loadUrl)).href)
            relative.push(`<${el.tagName.toLowerCase()} ${attr}="${raw}"> resolves to ${new URL(raw, new URL(deep, loadUrl)).pathname} at ${deep}`)
        }
        const heads = []
        for (const el of document.querySelectorAll('link[rel~="icon"][href],link[rel="stylesheet"][href],link[rel="manifest"][href],link[rel~="preload"][href],script[src]')) {
          const url = new URL(el.getAttribute(el.tagName === "SCRIPT" ? "src" : "href"), location.href)
          if (url.origin === location.origin) heads.push(url.href)
        }
        return { relative, heads, at: location.pathname }
      },
      { loadUrl, deep: DEEP_PROBE_PATH },
    )
    log.relative = dom.relative
    // Fetched OUTSIDE the page (page.request emits no page events), so a broken head resource is
    // reported once, here, and not again as a page response and a console error of our own making.
    log.headFetch = []
    log.headChecked = dom.heads.length
    for (const href of dom.heads) {
      const res = await page.request.get(href, { headers: { "cache-control": "no-cache" } })
      if (res.status() !== 200) log.headFetch.push(`${res.status()} ${new URL(href).pathname} (from ${dom.at})`)
    }
    await drain()
    log.hosts = [...new Set(log.responses.map((r) => new URL(r.url).host))].sort()
  } finally {
    await browser.close()
  }
  return log
}

async function main() {
  const originArg = process.argv[2]
  if (!originArg) {
    console.error("usage: node scripts/check_deployed_console.mjs <origin>")
    process.exit(2)
  }
  let log
  try {
    log = await run(originArg)
  } catch (e) {
    console.error(`[deployed-console] could not run against ${originArg}: ${e?.message ?? e}`)
    process.exit(2)
  }
  const { offenders, discounted, offProduction } = classify(log)
  console.log(
    `[deployed-console] ${log.origin}: ${log.responses.length} responses from ${log.hosts.length} hosts ` +
      `(${log.hosts.join(" ")}); navigated to ${log.finalPath}; move played: ${!!log.played}; ` +
      `${log.headChecked} head resources fetched; CSP ${log.csp ? `present (${log.csp.split(";").length} directives)` : "ABSENT"}`,
  )
  if (discounted.length)
    console.log(`[deployed-console] discounted ${discounted.length} console error(s): Cloudflare Web Analytics answers CORS only on ${ANALYTICS_SITE_HOST}, and this is ${new URL(log.origin).hostname}:\n  ${discounted.join("\n  ")}`)
  else if (offProduction) console.log("[deployed-console] the off-production RUM exception matched nothing")
  if (offenders.length) {
    console.error(`[deployed-console] FAIL — ${offenders.length} offender(s):\n  ${offenders.join("\n  ")}`)
    process.exit(1)
  }
  console.log("[deployed-console] OK — clean console, no CSP violation, no broken same-origin URL")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main()
