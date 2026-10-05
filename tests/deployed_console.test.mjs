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
import { classify, ANALYTICS_SITE_HOST } from "../scripts/check_deployed_console.mjs"

const CSP = "default-src 'self'; script-src 'self'; connect-src 'self'"
const clean = (origin, extra = {}) => ({
  origin,
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
