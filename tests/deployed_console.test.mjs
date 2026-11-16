// scripts/check_deployed_console.mjs's verdict, pinned without a browser.
//
// The deployed check runs after both deploys against the real site. Its browser half cannot run in
// ci-validate, but its VERDICT (what is an offender, and the one exception) is a pure function, and
// that is where a quiet loosening would hide: a broadened exception, a skipped category, or a run
// that saw nothing and called it clean (CLAUDE.md §6.6). Each case below is one of those.
//
// MUTANTS (2026-10-05, each red by the test named): the RUM exception applied on production too ->
// "on production the RUM exception does not apply"; any CORS error discounted -> "...and nothing
// else is"; the never-navigated check removed -> "a run that never navigated..."; the missing-CSP
// check removed -> "no policy on the document..."; a third-party 404 counted -> "a same-origin 404
// fails...". No surviving mutant.
import { test } from "node:test"
import assert from "node:assert/strict"
import { classify, ANALYTICS_SITE_HOST, proxyHost, redactor, report, readyVerdict, waitForReady, READY_MARKER } from "../scripts/check_deployed_console.mjs"

const CSP = "default-src 'self'; script-src 'self'; connect-src 'self'"
const clean = (origin, extra = {}) => ({
  origin,
  responses: [],
  hosts: [],
  csp: CSP,
  navigated: true,
  played: true,
  headChecked: 4,
  finalPath: "/Positions/Mount",
  ...extra,
})
const RUM = "https://cloudflareinsights.com/cdn-cgi/rum"
const rumErrors = (origin) => [
  { text: `Access to XMLHttpRequest at '${RUM}' from origin '${origin}' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`, at: `${origin}/` },
  { text: "Failed to load resource: net::ERR_FAILED", at: RUM },
]

test("a clean run is clean", () => {
  assert.deepEqual(classify(clean("https://bjjgraph.org")).offenders, [])
})

test("each CSP violation is named by its blocked URL and directive", () => {
  const r = classify(clean("https://dev.bjjgraph.pages.dev", {
    violations: [{ dir: "script-src-elem", blocked: "https://proxy.example/static/array.js", src: "" }],
  }))
  assert.equal(r.offenders.length, 1)
  assert.match(r.offenders[0], /script-src-elem: https:\/\/proxy\.example\/static\/array\.js/)
})

test("no policy on the document is a failure, not a clean run", () => {
  assert.match(classify(clean("https://bjjgraph.org", { csp: "" })).offenders.join("\n"), /no CSP on the document/)
})

test("a same-origin 404 fails; a third-party 404 is not ours", () => {
  const r = classify(clean("https://bjjgraph.org", {
    responses: [
      { status: 404, url: "https://bjjgraph.org/Positions/static/icon.png" },
      { status: 404, url: "https://i.ytimg.com/vi/x/hqdefault.jpg" },
    ],
  }))
  assert.deepEqual(r.offenders, ["HTTP 404: https://bjjgraph.org/Positions/static/icon.png"])
})

test("a page-relative resource URL and a head fetch failure are named", () => {
  const r = classify(clean("https://bjjgraph.org", {
    relative: ['<link href="../static/icon.png"> resolves to /Positions/static/icon.png at /Positions/Side-Control/Bottom'],
    headFetch: ["404 /Positions/static/icon.png (from /Positions/Side-Control/Bottom)"],
  }))
  assert.equal(r.offenders.length, 2)
})

test("the Cloudflare RUM CORS errors are discounted off production, counted, and nothing else is", () => {
  const origin = "https://abc123.bjjgraph.pages.dev"
  const r = classify(clean(origin, { console: [...rumErrors(origin), { text: "TypeError: x is undefined", at: `${origin}/postscript.js` }] }))
  assert.equal(r.discounted.length, 2)
  assert.equal(r.offenders.length, 1)
  assert.match(r.offenders[0], /TypeError/)
  // the exception names the RUM endpoint: an unrelated CORS failure is NOT discounted
  const other = classify(clean(origin, { console: [{ text: "Access to fetch at 'https://api.example/x' has been blocked by CORS policy", at: `${origin}/` }] }))
  assert.equal(other.discounted.length, 0)
  assert.equal(other.offenders.length, 1)
})

test("on production the RUM exception does not apply", () => {
  const origin = `https://${ANALYTICS_SITE_HOST}`
  const r = classify(clean(origin, { console: rumErrors(origin) }))
  assert.equal(r.discounted.length, 0)
  assert.equal(r.offenders.length, 2)
})

test("a run that never navigated, never played, or checked too few head resources is not clean", () => {
  const r = classify(clean("https://bjjgraph.org", { navigated: false, played: false, headChecked: 1, finalPath: "/" }))
  assert.equal(r.offenders.length, 3)
})

// ── THE YOUTUBE PLAYER'S PERMISSIONS-POLICY LINE (v1.281.1, 2026-11-16, run 43870539526) ─────────────
// The exception is the conjunction of a LOCATION (a script under https://www.youtube.com/s/player/) and a TEXT prefix
// ("Permissions policy violation:"), on every origin. MUTANTS, each red by the test named (v1.281.1): the location
// test dropped (any such text discounted) -> "...the same text from OUR origin is an offender"; the text test dropped
// (anything the player logs discounted) -> "...any other error from the player is an offender"; the origin compared by
// substring (`at.includes("youtube.com/s/player/")`) -> "...a lookalike host is an offender"; the exception applied
// off production only -> "...discounted on production too"; report() not printing it -> "...counted and printed".
const YT_LINE = { text: "Permissions policy violation: compute-pressure is not allowed in this document.", at: "https://www.youtube.com/s/player/fad7e4e9/player_embed.vflset/en_US/base.js" }

test("the YouTube player's Permissions-Policy line is discounted, on production too, and nothing is hidden by it", () => {
  for (const origin of ["https://abc123.bjjgraph.pages.dev", `https://${ANALYTICS_SITE_HOST}`]) {
    const r = classify(clean(origin, { console: [YT_LINE] }))
    assert.deepEqual(r.offenders, [], `${origin}: the player's line is not an offender`)
    assert.equal(r.playerPolicy.length, 1, `${origin}: ...and it is COUNTED`)
    assert.equal(r.discounted.length, 0, `${origin}: ...as the player's, not as Cloudflare's`)
  }
})

test("the YouTube exception: the same text from OUR origin is an offender", () => {
  const origin = `https://${ANALYTICS_SITE_HOST}`
  for (const at of [`${origin}/static/neural/app/neural.js`, `${origin}/`, ""]) {
    const r = classify(clean(origin, { console: [{ text: YT_LINE.text, at }] }))
    assert.equal(r.offenders.length, 1, `the text alone is not the exception (at "${at}")`)
    assert.equal(r.playerPolicy.length, 0)
  }
})

test("the YouTube exception: any other error from the player is an offender, and so is a lookalike host", () => {
  const origin = "https://abc123.bjjgraph.pages.dev"
  const others = [
    { text: "Uncaught TypeError: Cannot read properties of undefined (reading 'x')", at: YT_LINE.at },
    { text: "Failed to load resource: the server responded with a status of 403 ()", at: YT_LINE.at },
    { text: YT_LINE.text, at: "https://www.youtube.com/embed/abcdefghijk" },
    { text: YT_LINE.text, at: "https://www.youtube.com.evil.test/s/player/fad7e4e9/base.js" },
    { text: YT_LINE.text, at: "https://evil.test/www.youtube.com/s/player/fad7e4e9/base.js" },
  ]
  const r = classify(clean(origin, { console: others }))
  assert.equal(r.offenders.length, others.length, r.offenders.join("\n"))
  assert.equal(r.playerPolicy.length, 0)
  // and a CSP violation from the player is not a console line at all: still an offender
  const csp = classify(clean(origin, { violations: [{ dir: "frame-src", blocked: "https://www.youtube.com/embed/x", src: YT_LINE.at }], console: [YT_LINE] }))
  assert.equal(csp.offenders.length, 1)
  assert.match(csp.offenders[0], /^CSP frame-src/)
})

test("the YouTube exception is counted and printed with its reason, and says so when it matched nothing", () => {
  const log = clean("https://bjjgraph.org", { console: [YT_LINE, YT_LINE] })
  const res = report(log, {})
  assert.equal(res.code, 0)
  const out = res.out.join("\n")
  assert.match(out, /discounted 2 console error\(s\) from YouTube's own player script \(a third party's line, not ours\)/)
  assert.ok(out.includes(YT_LINE.at), "each discounted line is printed with its location")
  assert.match(report(clean("https://bjjgraph.org"), {}).out.join("\n"), /the YouTube player Permissions-Policy exception matched nothing/)
  // and an offender beside it still fails the run
  assert.equal(report(clean("https://bjjgraph.org", { console: [YT_LINE, { text: "TypeError: x", at: "https://bjjgraph.org/x.js" }] }), {}).code, 1)
})

// ── REDACTION (CONSOLE5, 2026-10-05) ───────────────────────────────────────────────────────────
// The first green deploy printed the PostHog proxy's hostname into a public Actions log. A FAKE host
// stands in for it here, never the real one. MUTANTS, each red by the test named: report() returns
// its lines unredacted -> "no line of the whole output..."; stderr left unredacted -> same test, the
// offender line; the redactor case-sensitive -> "the redactor replaces whole hosts..."; proxyHost
// returning the raw secret instead of its host -> "proxyHost reads every form...". No survivor.
const FAKE = "telemetry.example.org"
const PROXY_ENV = { POSTHOG_API_HOST: `https://${FAKE}/` }

test("proxyHost reads every form the secret may take, and nothing when unset", () => {
  assert.equal(proxyHost(PROXY_ENV), FAKE)
  assert.equal(proxyHost({ POSTHOG_API_HOST: "Telemetry.Example.org" }), FAKE)
  assert.equal(proxyHost({ POSTHOG_API_HOST: `${FAKE}:8443` }), FAKE)
  assert.equal(proxyHost({}), "")
  assert.equal(proxyHost({ POSTHOG_API_HOST: "  " }), "")
})

test("the redactor replaces whole hosts, any case, and nothing else", () => {
  const r = redactor(FAKE)
  assert.equal(r(`https://${FAKE}/static/array.js`), "https://<posthog-proxy>/static/array.js")
  assert.equal(r("TELEMETRY.example.org"), "<posthog-proxy>")
  assert.equal(r(`x${FAKE} ${FAKE}.evil.test`), `x${FAKE} <posthog-proxy>.evil.test`)
  assert.equal(r("fonts.gstatic.com bjjgraph.org"), "fonts.gstatic.com bjjgraph.org")
  assert.equal(redactor("")("anything at all"), "anything at all")
})

test("no line of the whole output carries the proxy host: hosts list, offenders, discounted errors", () => {
  const origin = "https://abc123.bjjgraph.pages.dev"
  const log = clean(origin, {
    responses: [{ status: 200, url: `https://${FAKE}/static/array.js` }],
    hosts: ["abc123.bjjgraph.pages.dev", FAKE, "fonts.gstatic.com"],
    violations: [{ dir: "connect-src", blocked: `https://${FAKE}/flags/?v=2`, src: `https://${FAKE}/static/array.js` }],
    console: [{ text: `TypeError at https://${FAKE.toUpperCase()}/x.js`, at: `https://${FAKE}/x.js` }],
  })
  const res = report(log, PROXY_ENV)
  const all = [...res.out, ...res.err].join("\n")
  assert.equal(res.code, 1, "the offenders still fail the check")
  assert.doesNotMatch(all, /telemetry\.example\.org/i, "the proxy host leaked into the output")
  assert.match(res.out.join("\n"), /<posthog-proxy>/, "the hosts line names the proxy only as <posthog-proxy>")
  assert.match(res.err.join("\n"), /<posthog-proxy>/, "the offender lines name the proxy only as <posthog-proxy>")
  // control: the same log without the secret DOES print the host, so the assertion above is not vacuous
  assert.match([...report(log, {}).out, ...report(log, {}).err].join("\n"), /telemetry\.example\.org/)
})

// ── READINESS (CONSOLE-FLAKE, 2026-10-07) ──────────────────────────────────────────────────────
// 4 of 5 dev deploys hit the fresh per-deploy URL before Cloudflare served it: one 404, no CSP. These
// cases drive waitForReady with a SIMULATED server and a fake clock, so no network and no real waiting.
// MUTANTS, each red by the test named: waitForReady returning ready on its first attempt whatever the
// answer ("no wait"), or READY_STREAK = 1 -> "flapping readiness waits for three consecutive good answers"; readyVerdict ignoring the CSP header ->
// "a 200 without a CSP header is not ready"; the timeout never firing -> the run times out INSIDE "never ready gives up, by name" (an endless
// wait is that claim failing; node:test then reports the file, not the case).
const CSP_H = { "content-security-policy-report-only": "default-src 'self'" }
const OUR_DOC = `<html><head><script src="${READY_MARKER}"></script></head></html>`
function fakeServer(answers) {
  let i = 0
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const a = answers[Math.min(i++, answers.length - 1)]
    if (a instanceof Error) throw a
    return { status: a.status, headers: new Map(Object.entries(a.headers ?? {})), text: async () => a.body ?? "" }
  }
  return { fetchImpl, calls }
}
function fakeClock() {
  let t = 0
  return { now: () => t, sleep: async (ms) => { t += ms } }
}

test("readyVerdict: only a 200 that carries a CSP and loads /postscript.js is this site", () => {
  assert.equal(readyVerdict(404, {}, "").ready, false)
  assert.equal(readyVerdict(200, {}, OUR_DOC).ready, false)
  assert.equal(readyVerdict(200, CSP_H, "<html>placeholder</html>").ready, false)
  assert.equal(readyVerdict(200, { "Content-Security-Policy-Report-Only": "x" }, OUR_DOC).ready, true, "header names are case-insensitive")
})

test("a 200 without a CSP header is not ready (the not-ready Cloudflare answer carried none)", () => {
  const v = readyVerdict(200, {}, OUR_DOC)
  assert.equal(v.ready, false)
  assert.match(v.why, /no CSP/)
})

test("flapping readiness waits for three consecutive good answers", async () => {
  const good = { status: 200, headers: CSP_H, body: OUR_DOC }
  const srv = fakeServer([{ status: 404 }, good, { status: 404 }, good, good, good])
  const clock = fakeClock(); const lines = []
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...clock, fetchImpl: srv.fetchImpl, log: (l) => lines.push(l) })
  assert.equal(r.ready, true)
  assert.equal(r.attempts, 6, "one good answer must not launch the browser")
  assert.equal(srv.calls.length, 6)
  assert.equal(r.waitedMs, 25_000)
  assert.deepEqual(lines.map((line) => line.match(/(?:not ready|READY) \(\d\/3\)/)?.[0]), [
    "not ready (0/3)", "READY (1/3)", "not ready (0/3)", "READY (1/3)", "READY (2/3)", "READY (3/3)",
  ], "every attempt reports its streak, including the reset")
})

test("a refused connection resets an otherwise ready streak", async () => {
  const good = { status: 200, headers: CSP_H, body: OUR_DOC }
  const srv = fakeServer([good, good, new Error("ECONNRESET"), good])
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...fakeClock(), fetchImpl: srv.fetchImpl, log: () => {} })
  assert.equal(r.ready, true)
  assert.equal(r.attempts, 6)
})

test("an immediately healthy URL needs exactly three attempts", async () => {
  const srv = fakeServer([{ status: 200, headers: CSP_H, body: OUR_DOC }])
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...fakeClock(), fetchImpl: srv.fetchImpl, log: () => {} })
  assert.equal(r.ready, true)
  assert.equal(r.attempts, 3)
  assert.equal(srv.calls.length, 3)
  assert.equal(r.waitedMs, 10_000)
})

test("a streak that never reaches three inside the bound fails even after good answers", async () => {
  const good = { status: 200, headers: CSP_H, body: OUR_DOC }
  const srv = fakeServer([good, good, { status: 404 }, good, good])
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...fakeClock(), fetchImpl: srv.fetchImpl, timeoutMs: 20_000, log: () => {} })
  assert.equal(r.ready, false)
  assert.equal(r.attempts, 5)
  assert.equal(r.waitedMs, 20_000)
})

test("a third good answer arriving after the deadline is not ready", async () => {
  const srv = fakeServer([{ status: 200, headers: CSP_H, body: OUR_DOC }])
  const clock = fakeClock()
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...clock, timeoutMs: 10_000, log: () => {}, fetchImpl: async (url) => {
    if (srv.calls.length === 2) await clock.sleep(1)
    return srv.fetchImpl(url)
  } })
  assert.equal(r.ready, false)
  assert.equal(r.attempts, 3)
})

test("never ready gives up, by name, inside its bound, and never reports ready", async () => {
  const srv = fakeServer([{ status: 404 }])
  const lines = []
  const r = await waitForReady("https://abc.bjjgraph.pages.dev/", { ...fakeClock(), fetchImpl: srv.fetchImpl, timeoutMs: 30_000, intervalMs: 5_000, log: (l) => lines.push(l) })
  assert.equal(r.ready, false)
  assert.ok(r.attempts >= 2 && r.waitedMs <= 30_000, `attempts ${r.attempts}, waited ${r.waitedMs}`)
  assert.equal(r.last, "HTTP 404")
  assert.equal(lines.length, r.attempts, "every attempt is printed")
})
