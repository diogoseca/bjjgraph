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
import { classify, ANALYTICS_SITE_HOST, proxyHost, redactor, report } from "../scripts/check_deployed_console.mjs"

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
