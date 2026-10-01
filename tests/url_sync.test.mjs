// THE ADDRESS BAR FOLLOWS THE NODE, FOR EVERY NODE (v1.212.6, OCURL1).
//
// THE DEFECT. `_syncUrl` pushed "/" + node id. One id, `Transitions/100%-Sweep`, carries a "%", and
// two things went wrong at once:
//   1. The pushed address kept a raw "%", and `_pushUrl` compared `decodeURI(location.pathname)`,
//      which THROWS on it ("URI malformed"). The exception was swallowed as "history unavailable".
//      So after visiting 100% Sweep every later push threw, and the address bar froze until a
//      reload, with no trace.
//   2. The page Quartz builds for that node is /Transitions/100-percent-Sweep (path.ts `sluggify`
//      writes "%" as "-percent"), so even an encoded "%25" form names a page that does not exist,
//      and an arrival on the real page resolved to nothing.
// THE FIX. `_pageSlug` maps an id to its page path with Quartz's own rule. `_idIndex` indexes the page
// spelling too. `_decodePath` is the one decoder for every path reader, and it never throws. A URL
// failure is a counted `url_fault` beat, not a silent catch.
//
// MUTANTS (each turns this file red; measured at v1.212.6):
//   - _pushUrl back on decodeURI(location.pathname): test 3 (the freeze, once a raw "%" is in the
//     address; the app no longer pushes one, so test 1 cannot see this mutant);
//   - _pageSlug as the identity: tests 1 and 2 (the address is not the page);
//   - no page-slug aliases in _idIndex: tests 1 and 2 (the real page resolves to nothing);
//   - _urlFault as a no-op: test 3 (the fault is silent again).
//   Test 4 guards the OTHER drift, path.ts changing under _pageSlug; it reads both sources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const SRC = read("neural/src/app.src.jsx");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + SRC + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const wire = JSON.parse(read("source/quartz/static/neural/graph-data.json"));

/** A browser-faithful address bar: the WHATWG URL parser keeps an invalid "%" escape raw, exactly as
 *  Chromium's location.pathname does, which is what made decodeURI throw. */
function browser(start = "/") {
  let url = new URL(start, "https://bjjgraph.test");
  const location = { get pathname() { return url.pathname; }, get search() { return url.search; }, get origin() { return url.origin; } };
  const history = { state: null, pushes: 0,
    pushState(state, _t, u) { this.state = state; this.pushes++; url = new URL(u, url); },
    replaceState(state, _t, u) { this.state = state; url = new URL(u, url); } };
  globalThis.location = location; globalThis.history = history;
  return { location, history, go: (p) => { url = new URL(p, url); } };
}

function app() {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.get = (_k, d) => d; a.set = a.track = a._saveProgress = () => {};
  a.ingest(structuredClone(wire));
  return a;
}
const faults = (a) => a.beats.filter((b) => b.beat === "url_fault");

test("100% Sweep: its address is its built page, the address resolves back, and the NEXT push still lands", () => {
  const b = browser("/Positions/Mount");
  const a = app();
  const sweep = a.nodes.find((n) => n.t === "100% Sweep" && n.rep);
  assert.ok(sweep && sweep.id.includes("%"), "the corpus still has a node whose id carries %");
  a._syncUrl(sweep.idx);
  assert.equal(b.location.pathname, "/Transitions/100-percent-Sweep", "the page Quartz builds for it");
  assert.equal(a._nodeForPath(b.location.pathname), sweep.idx, "and it resolves back to the node");
  assert.equal(a._nodeAndRoleForPath("/Transitions/100-percent-Sweep/Defender").idx, sweep.pi, "its Defender page resolves to the partner");
  const next = a.nodes.find((n) => n.t === "Knee Slice Pass" && n.rep);
  a._syncUrl(next.idx);
  assert.equal(b.location.pathname, "/Transitions/Knee-Slice-Pass", "the address bar did not freeze");
  assert.equal(faults(a).length, 0, "and nothing failed");
});

test("every node's address resolves back to that node; every id that needs encoding is swept", () => {
  const b = browser("/Positions/Mount");
  const a = app();
  // characters outside RFC 3986's unreserved set, in any segment: the ids a URL treats with care
  const needs = a.nodes.filter((n) => n.id && /[^A-Za-z0-9\-._~\/]/.test(n.id));
  assert.ok(needs.length >= 6, `${needs.length} node seats carry such a character (today: 3 ids, two apostrophes and one %, on both seats)`);
  let swept = 0;
  for (const n of a.nodes) {
    if (!n.id) continue;
    a._syncUrl(n.idx);
    const back = a._nodeAndRoleForPath(b.location.pathname);
    const want = n.idx;
    // a hub page names the rep; the app may canonicalise a control alias to its submission state
    const canon = a.canonicalState(want, n.role);
    assert.ok(back.idx === want || back.idx === canon, `${n.id}: ${b.location.pathname} resolved to ${back.idx}, not ${want}`);
    swept++;
  }
  for (const n of needs) {
    browser("/Positions/Mount");
    a._syncUrl(n.idx);
    assert.notEqual(globalThis.location.pathname, "/Positions/Mount", `${n.id}: the push landed`);
    assert.equal(a._decodePath(globalThis.location.pathname), a._pageSlug(n.id), `${n.id}: the address is its page path`);
  }
  assert.equal(faults(a).length, 0, "no URL fault anywhere in the sweep");
  console.log(`# url sweep: ${swept} nodes round-tripped; ${needs.length} ids needing encoding: ${needs.map((n) => n.id).join(", ")}`);
});

test("a raw % already in the address: decoding never throws, the next push lands, and the fault is COUNTED", () => {
  const b = browser("/Transitions/100%-Sweep");   // an old link, a typed address, the pre-fix app's own push
  const a = app();
  const sweep = a.nodes.find((n) => n.t === "100% Sweep" && n.rep);
  assert.equal(a._nodeForPath(b.location.pathname), sweep.idx, "the raw spelling still resolves (lenient decode)");
  const next = a.nodes.find((n) => n.t === "Knee Slice Pass" && n.rep);
  a._syncUrl(next.idx);
  assert.equal(b.location.pathname, "/Transitions/Knee-Slice-Pass", "the push landed instead of freezing");
  const f = faults(a);
  assert.ok(f.length >= 1, "the malformed address is a named, counted beat, not a silent catch");
  assert.equal(f[0].kind, "decode");
  assert.equal(f[f.length - 1].n, a._urlFaults, "the beat carries the running count");
});

test("_pageSlug applies exactly Quartz's sluggify replacements (source/quartz/util/path.ts)", () => {
  const ts = read("source/quartz/util/path.ts");
  const fn = ts.slice(ts.indexOf("function sluggify("), ts.indexOf("function sluggify(") + 800);
  const pairs = (src) => [...src.matchAll(/\.replace\((\/(?:\\.|[^/])+\/g), "([^"]*)"\)/g)].map((m) => m[1] + " -> " + m[2]);
  const quartz = pairs(fn);
  const app_ = pairs(SRC.slice(SRC.indexOf("  _pageSlug(id) {"), SRC.indexOf("  _pageSlug(id) {") + 400));
  assert.ok(quartz.length >= 5, `read ${quartz.length} replacements from path.ts`);
  assert.deepEqual(app_, quartz, "a drift between the two is an address that 404s on reload");
});
