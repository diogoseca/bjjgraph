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
// WHAT IT DOES. First wait until the deployment URL answers like this site three times in a row
// (HTTP 200, a CSP header, /postscript.js; five seconds apart, bounded at 180 s, every attempt printed), because Cloudflare
// serves a fresh per-deploy URL a little after wrangler prints it. Then boot `/`, wait for the app to move
// the address bar itself, play one move, then
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
// TWO NAMED EXCEPTIONS, each as narrow as its evidence; nothing else is discounted.
//
// 1. Cloudflare's, and it can only apply off production. Cloudflare Web Analytics posts to
// cloudflareinsights.com/cdn-cgi/rum, which answers CORS only for the analytics site's own host,
// bjjgraph.org. Measured 2026-10-05: on dev.bjjgraph.pages.dev that post fails with a CORS console
// error; on bjjgraph.org it succeeds. A `*.pages.dev` deploy URL therefore always logs it, whatever
// this repo does (the beacon is a dashboard setting). Off production those errors are discounted,
// COUNTED and printed; on production nothing is discounted.
//
// 2. YouTube's player, on EVERY origin (16 Nov 2026, the push-run of PR #422 on ed701b3b5: run 43870539526, attempt 1,
// deploy-preview). Its only offender was `Permissions policy violation: compute-pressure is not allowed in this document.
// @ https://www.youtube.com/s/player/fad7e4e9/player_embed.vflset/en_US/base.js`: YouTube's own player script, inside its
// cross-origin embed, asking for a browser feature that frame is not granted. The same build passed this script 3 of 3
// from the orchestrator's machine, the player loading each time, so the line comes with whichever player build YouTube
// serves, not with our code, and it will come back on dev and production deploys as YouTube rolls a player out. RULED:
// we do not grant the embed a feature to silence a log (no `compute-pressure` in any `allow` attribute, nor in the
// Permissions-Policy header). Discounted (`ytPlayerPolicy`, both conditions): the LOCATION is the player's own base.js
// (https://www.youtube.com/s/player/<build>/<variant>.vflset/<locale>/base.js) AND the text names a RULED feature,
// "Permissions policy violation: <feature> is not allowed" (`YT_PLAYER_DENIED_FEATURES`, one entry per ruling, never a
// pattern); counted and printed with this reason. NARROWED by the reader of #424 (STAR3-R1, ruled): the first version took
// ANY feature, and the reader removed picture-in-picture from OUR header and the player logged "Permissions policy violation:
// picture-in-picture is not allowed in this document." from its base.js, twice, and the gate passed. We write the embed's
// `allow` (autoplay, encrypted-media, picture-in-picture, fullscreen) and the Permissions-Policy header: a regression of ours
// that denies the player a feature must fail here. Nor the widget API (/s/player/<build>/www-widgetapi.vflset/...): it runs
// in OUR document, under our own header. Not discounted either: the same text from any other location (ours included), any
// other error from the player, a CSP violation, a failed request of ours.
//
// A blocker extension (the owner's Brave Shields: ERR_BLOCKED_BY_CLIENT for PostHog's recorder) is
// not present in CI's Chromium, so that line cannot appear here by construction. It is not a defect
// any page can fix: the browser logs a request it blocked itself.
//
// Read-only: GET requests and one OAuth-free roll. PostHog drops HeadlessChrome user agents, so
// this sends no analytics events.
//
// Usage: node scripts/check_deployed_console.mjs <origin>       e.g. https://bjjgraph.org
// It reads POSTHOG_API_HOST (both deploy jobs export it) ONLY to print that host as <posthog-proxy>:
// its logs are public, and the proxy's name stays out of this repo (see report()).
// Exit: 0 clean · 1 offenders (each printed), or the deployment URL never became ready · 2 could not run.
import { pathToFileURL } from "node:url"

export const ANALYTICS_SITE_HOST = "bjjgraph.org"
const RUM = "https://cloudflareinsights.com/cdn-cgi/rum"
export const YT_PLAYER_ORIGIN = "https://www.youtube.com"
// The player's own script, the file the line fired from: /s/player/fad7e4e9/player_embed.vflset/en_US/base.js.
export const YT_PLAYER_BASE = /^\/s\/player\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.vflset\/[A-Za-z0-9_-]+\/base\.js$/
// RULED, ONE ENTRY PER RULING, each with its reason. Never a feature WE grant the embed (its `allow`) or set in our header.
export const YT_PLAYER_DENIED_FEATURES = [
  // compute-pressure (16 Nov 2026, run 43870539526): YouTube's player asks for it inside its cross-origin embed; we grant it
  // nowhere, and ruled we will not, to silence a log
  "compute-pressure",
]

/** Exception 2 (header): YouTube's own player script logging a ruled feature its embed is not granted. Pure. */
export function ytPlayerPolicy(c) {
  let at
  try {
    at = new URL(c.at)
  } catch {
    return false
  }
  if (at.origin !== YT_PLAYER_ORIGIN || !YT_PLAYER_BASE.test(at.pathname)) return false
  const text = String(c.text)
  return YT_PLAYER_DENIED_FEATURES.some((f) => text.startsWith(`Permissions policy violation: ${f} is not allowed`))
}
export const DEEP_PROBE_PATH = "/Positions/Side-Control/Bottom"

/** Pure: everything the browser saw -> offenders, discounted exceptions, coverage. */
export function classify(log) {
  const origin = new URL(log.origin)
  const offenders = []
  const discounted = []
  const playerPolicy = []
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
    else if (ytPlayerPolicy(c)) playerPolicy.push(`${c.text.slice(0, 160)} @ ${c.at}`)
    else offenders.push(`console error: ${c.text.slice(0, 300)}${c.at ? ` @ ${c.at}` : ""}`)
  }
  for (const e of log.pageErrors ?? []) offenders.push(`uncaught page error: ${e}`)
  if (!log.navigated) offenders.push(`the app never moved the address bar (still ${log.finalPath ?? "?"}): the client-side navigation was not exercised`)
  if (!log.played) offenders.push(`no move was played (${log.playError ?? "no hand dealt"}): the roll was not exercised`)
  if (!(log.headChecked >= 4)) offenders.push(`only ${log.headChecked ?? 0} same-origin head resources were checked; expected >= 4`)
  return { offenders, discounted, playerPolicy, offProduction }
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

/** The PostHog proxy's host, from the same POSTHOG_API_HOST the build's PostHog snippet uses, in any
 *  form the secret takes ("https://h/", "h"); "" when unset. */
export function proxyHost(env = process.env) {
  const raw = String(env.POSTHOG_API_HOST ?? "").trim()
  if (!raw) return ""
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase()
  } catch {
    return ""
  }
}

/** Replaces every whole occurrence of `host` with <posthog-proxy>, case-insensitively. */
export function redactor(host) {
  if (!host) return (text) => String(text)
  const re = new RegExp(`(?<![A-Za-z0-9.-])${host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9-])`, "gi")
  return (text) => String(text).replace(re, "<posthog-proxy>")
}

/** EVERY line this check prints, already redacted, plus its exit code. Pure, so a test can hold
 *  the whole output to the rule.
 *
 *  REDACTED (CONSOLE5, 2026-10-05): the first green run printed the hosts it saw, and the PostHog
 *  proxy's hostname went into a public Actions log. The repo keeps that name out on purpose (the
 *  CSP allows `*.bjjgraph.org` instead), and GitHub masks a secret only where its EXACT value
 *  appears, never the bare host inside it. So every line, offenders included, goes through one
 *  redactor here, and `main` prints nothing it did not get from this function. */
export function report(log, env = process.env) {
  const r = redactor(proxyHost(env))
  const { offenders, discounted, playerPolicy, offProduction } = classify(log)
  const out = [
    `[deployed-console] ${log.origin}: ${log.responses.length} responses from ${log.hosts.length} hosts ` +
      `(${log.hosts.join(" ")}); navigated to ${log.finalPath}; move played: ${!!log.played}; ` +
      `${log.headChecked} head resources fetched; CSP ${log.csp ? `present (${log.csp.split(";").length} directives)` : "ABSENT"}`,
  ]
  const err = []
  if (discounted.length)
    out.push(`[deployed-console] discounted ${discounted.length} console error(s): Cloudflare Web Analytics answers CORS only on ${ANALYTICS_SITE_HOST}, and this is ${new URL(log.origin).hostname}:\n  ${discounted.join("\n  ")}`)
  else if (offProduction) out.push("[deployed-console] the off-production RUM exception matched nothing")
  if (playerPolicy.length)
    out.push(`[deployed-console] discounted ${playerPolicy.length} console error(s) from YouTube's own player script (a third party's line, not ours): a ruled Permissions-Policy feature (${YT_PLAYER_DENIED_FEATURES.join(", ")}) its cross-origin embed is not granted, and we grant none to silence a log:\n  ${playerPolicy.join("\n  ")}`)
  else out.push("[deployed-console] the YouTube player Permissions-Policy exception matched nothing")
  if (offenders.length) err.push(`[deployed-console] FAIL — ${offenders.length} offender(s):\n  ${offenders.join("\n  ")}`)
  else out.push("[deployed-console] OK — clean console, no CSP violation, no broken same-origin URL")
  return { out: out.map(r), err: err.map(r), code: offenders.length ? 1 : 0 }
}

// READINESS (CONSOLE-FLAKE, 2026-10-07). wrangler prints the per-deployment URL the moment the upload
// finishes, but Cloudflare serves it a little later: 4 of 5 dev deploys (runs 37556087454, 37562249240,
// 37569156104, 37572736399) read `HTTP 404: https://<hash>.bjjgraph.pages.dev/` with no CSP, and so failed
// all six of their offenders on a URL that answered 200 minutes later. The check was right to fail (it
// never passed on an empty run); it was asked too early. So the browser does not start until the URL
// answers like THIS site: HTTP 200, a CSP header (the not-ready 404 carries none), and the root-absolute
// /postscript.js every page loads. Bounded; every attempt printed; never ready FAILS BY NAME, never passes.
// One good answer still flapped in runs 37771464874 and 37869163633: READY then a browser root 404.
// The ~75.5 s until the failure log includes 45 s waiting for navigation and 30 s for a card.
// Require three consecutive READY verdicts, five seconds apart; any not-ready answer resets the streak.
export const READY_TIMEOUT_MS = 180_000
export const READY_MARKER = "/postscript.js"
const READY_STREAK = 3

/** One response -> is this our deployed document? Pure, so a test can hold it to the rule. */
export function readyVerdict(status, headers, body) {
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]))
  if (status !== 200) return { ready: false, why: `HTTP ${status}` }
  if (!h["content-security-policy-report-only"] && !h["content-security-policy"])
    return { ready: false, why: "HTTP 200 but no CSP header (not this site's document yet)" }
  if (!String(body ?? "").includes(READY_MARKER))
    return { ready: false, why: `HTTP 200 but the body does not load ${READY_MARKER}` }
  return { ready: true, why: "HTTP 200, CSP present, document loads " + READY_MARKER }
}

/** Polls `url` for a READY streak within `timeoutMs`. Injectable fetch, sleep and clock. */
export async function waitForReady(url, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((res) => setTimeout(res, ms)),
  now = () => Date.now(),
  timeoutMs = READY_TIMEOUT_MS,
  intervalMs = 5_000,
  log = (line) => console.log(line),
} = {}) {
  const start = now()
  let attempts = 0
  let streak = 0
  let last = "no attempt made"
  for (;;) {
    attempts++
    let verdict
    try {
      const res = await fetchImpl(url, { redirect: "follow", headers: { "cache-control": "no-cache" } })
      const headers = {}
      res.headers.forEach((v, k) => (headers[k] = v))
      verdict = readyVerdict(res.status, headers, await res.text())
    } catch (e) {
      verdict = { ready: false, why: `request failed: ${e?.message ?? e}` }
    }
    last = verdict.why
    streak = verdict.ready ? streak + 1 : 0
    const waitedMs = now() - start
    const elapsed = Math.round(waitedMs / 1000)
    log(`[deployed-console] readiness attempt ${attempts} at ${elapsed}s: ${verdict.ready ? "READY" : "not ready"} (${streak}/${READY_STREAK}): ${verdict.why}`)
    if (streak >= READY_STREAK && waitedMs <= timeoutMs) return { ready: true, attempts, waitedMs, last }
    if (waitedMs + intervalMs > timeoutMs) return { ready: false, attempts, waitedMs, last }
    await sleep(intervalMs)
  }
}

async function main() {
  const r = redactor(proxyHost())
  const originArg = process.argv[2]
  if (!originArg) {
    console.error("usage: node scripts/check_deployed_console.mjs <origin>")
    process.exit(2)
  }
  const origin = new URL(originArg).origin
  const ready = await waitForReady(origin + "/", { log: (line) => console.log(r(line)) })
  if (!ready.ready) {
    console.error(r(`[deployed-console] FAIL — deployment URL never became ready: ${origin}/ after ${ready.attempts} attempts over ${Math.round(ready.waitedMs / 1000)}s (last: ${ready.last})`))
    process.exit(1)
  }
  let log
  try {
    log = await run(originArg)
  } catch (e) {
    console.error(r(`[deployed-console] could not run against ${originArg}: ${e?.message ?? e}`))
    process.exit(2)
  }
  const { out, err, code } = report(log)
  for (const line of out) console.log(line)
  for (const line of err) console.error(line)
  process.exit(code)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main()
