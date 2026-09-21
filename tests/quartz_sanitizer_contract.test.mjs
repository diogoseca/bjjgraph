// ── stripDangerousHtml: ITS FIRST TEST, EVER ──────────────────────────────────────────────────
//
// `stripDangerousHtml` (`source/quartz/plugins/transformers/ofm.ts:552-583`) is project-authored
// and, until this file, had **no test of any kind**. Measured on this tree: `stripDangerousHtml`
// and `DANGEROUS_URL` appear **0 times** outside `ofm.ts` itself.
//   grep -rEn 'stripDangerousHtml|DANGEROUS_URL' tests/ e2e/ scripts/ .github/ source/ | grep -v ofm.ts
// (Recon §2.7 states "0 hits for `stripDangerousHtml|DANGEROUS_URL|sanitiz`". That third alternate
// now matches 4 lines in 2 files — `tests/principle_clips.test.mjs:16` and `scripts/dev-serve.mjs`
// — but neither is about this sanitizer, so the UNGATED verdict stands and only the count drifted.)
//
// WHY IT MATTERS MORE THAN ITS SIZE SUGGESTS. The pipeline converts with
// `remark-rehype { allowDangerousHtml: true }` and then runs `rehype-raw` with **no allowlist
// schema** (`ofm.ts:584`). Raw HTML in content therefore reaches the DOM verbatim. This corpus is
// 4,600 generated pages fed daily by an LLM content bot, plus community PRs, plus Jinja templates
// rendered with autoescape OFF. This function is the only thing between that and stored XSS on
// every page of the site. Re-adopting a stock remark/rehype chain during the migration silently
// removes it — no error, no visual difference, 4,600 pages still render.
//
// WHAT THIS FILE COVERS: the real function, through the real pipeline, on markdown fixtures — not
// a re-implementation of the regex (CLAUDE.md §6.3). It asserts both halves of every rule: the
// dangerous thing is REMOVED **and** the benign thing beside it SURVIVES. A sanitizer that strips
// everything passes half a test suite and breaks every page.
//
// WHAT IT DOES NOT COVER, stated so nobody reads it as broader (CLAUDE.md §6.9):
//  · It is not a security audit and it is not a claim that the allowlist is complete. `ofm.ts:534`
//    itself says a full `rehype-sanitize` schema is the stronger follow-up. This file pins the
//    CURRENT behaviour so the migration cannot lose it — P1-P4 reproduces, it does not improve
//    (D-03). Anything this function misses today it will still miss after the re-host, by design.
//  · It does not exercise the browser. Whether a surviving attribute is exploitable in a real DOM
//    is not asserted here.
//  · MEASURED NON-KILL, recorded: removing `noscript` from the tag check leaves every assertion
//    below green except the one that names it. There is no corpus `<noscript>` to catch it.
//  · KNOWN INCUMBENT GAP, now swept and pinned at the foot of this file: one of the twelve
//    `URL_ATTRS` members — `ping` — is NOT sanitised, and this file reproduces that rather than
//    fixing it (D-03). Read that test before quoting this suite as "dangerous URLs are stripped".
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { harnessAvailable, runPipeline, sourceRequire, REPO } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) {
  console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")
}

const page = (body) => `---\ntitle: Sanitizer Fixture\n---\n\n${body}\n`

/** Run one body through the real pipeline and hand back the emitted HTML. */
async function emit(body, slug = "Sanitizer") {
  const { html } = await runPipeline(page(body), { slug })
  return html
}

test("ACTIVE CONTENT IS REMOVED — script, and the inert data scripts are SPARED", async (t) => {
  if (skip) return t.skip("harness unavailable")
  let checked = 0

  const html = await emit(
    [
      `<script>window.__pwned = 1</script>`,
      `<script type="text/javascript">window.__pwned = 2</script>`,
      `<noscript><img src="tracker.gif"></noscript>`,
      `<script type="application/ld+json">{"@type":"Article","name":"kept"}</script>`,
      `<script type="application/json">{"kept":true}</script>`,
    ].join("\n\n"),
  )

  assert.doesNotMatch(html, /__pwned/, "no executable script body may survive")
  assert.doesNotMatch(html, /<script(?![^>]*application\/(ld\+)?json)/, "no active <script> tag")
  assert.doesNotMatch(html, /<noscript/, "noscript is stripped alongside script")
  checked += 3

  // The SPARE half. `SAFE_SCRIPT_TYPES` exists because SchemaExtractor runs downstream and hoists
  // these into <head>; strip them here and every page silently loses its authored JSON-LD.
  // SchemaExtractor has already consumed the ld+json by this point, so assert on ITS output.
  const { file } = await runPipeline(
    page(`<script type="application/ld+json">{"@type":"Article","name":"kept"}</script>`),
    { slug: "Spared" },
  )
  assert.deepEqual(
    file.data.schemas,
    [{ "@type": "Article", name: "kept" }],
    "ld+json must survive the sanitizer long enough for SchemaExtractor to hoist it — if the " +
      "sanitizer stops sparing it, every page loses its JSON-LD and NOTHING else looks wrong",
  )
  checked += 1

  console.log(`  coverage: ${checked} active-content rules exercised`)
  assert.ok(checked >= 4, "a rule count of zero would mean this test asserted nothing")
})

test("INLINE EVENT HANDLERS ARE REMOVED, and the element survives", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const html = await emit(
    `<img src="ok.png" alt="kept" onerror="window.__pwned=1" ONCLICK="window.__pwned=2">`,
  )
  assert.doesNotMatch(html, /onerror/i, "onerror must go")
  assert.doesNotMatch(html, /onclick/i, "the check is case-insensitive — ONCLICK must go too")
  assert.doesNotMatch(html, /__pwned/, "no handler body may survive")
  // The other half: stripping the handler must not strip the element or its benign attributes.
  assert.match(html, /<img/, "the element itself must survive")
  assert.match(html, /alt="kept"/, "benign attributes must survive")
  // NOTE, and it is why this assertion is shaped the way it is: the emitted src is `../ok.png`,
  // not `ok.png`. `LinkProcessing` (`links.ts:144-162`) rewrites every img/video/audio/iframe src
  // through `transformLink`, and its htmlPlugins run AFTER OFM's in the configured order. Pinning
  // the literal pre-transform bytes here would assert a neighbouring transformer's output and go
  // red on a correct build — CLAUDE.md §6.3. The claim is "a safe URL survives sanitising", so
  // that is what is asserted: the attribute is present and still addresses the same file.
  assert.match(html, /src="[^"]*ok\.png"/, "a safe URL must survive the sanitizer")

  const handlers = ["onerror", "ONCLICK"]
  console.log(`  coverage: ${handlers.length} handler spellings removed, 3 benign attributes kept`)
  assert.equal(handlers.length, 2, "both the lower and upper spellings must be driven")
})

test("DANGEROUS URL SCHEMES ARE REMOVED across every URL-bearing attribute", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // One case per scheme the real DANGEROUS_URL regex names, plus the control-character evasion its
  // `.replace(/[\u0000- ]/g, "")` exists to defeat.
  const cases = [
    [`<a href="javascript:window.__pwned=1">x</a>`, /javascript:/i, "javascript:"],
    [`<a href="vbscript:msgbox">x</a>`, /vbscript:/i, "vbscript:"],
    [`<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>`, /data:text\/html/i, "data:text/html"],
    [`<a href="data:application/x-msdownload,x">x</a>`, /data:application\//i, "data:application/"],
    [`<a href="java\tscript:window.__pwned=1">x</a>`, /__pwned/, "control-char obfuscation"],
    [`<iframe src="javascript:window.__pwned=1"></iframe>`, /javascript:/i, "src, not just href"],
    [`<form action="javascript:window.__pwned=1"></form>`, /javascript:/i, "action"],
    [`<blockquote cite="javascript:1">x</blockquote>`, /javascript:/i, "cite"],
    [`<video poster="javascript:1"></video>`, /javascript:/i, "poster"],
  ]
  let checked = 0
  for (const [body, forbidden, label] of cases) {
    const html = await emit(body, `Url${checked}`)
    assert.doesNotMatch(html, forbidden, `${label} must be stripped`)
    checked += 1
  }
  console.log(`  coverage: ${checked} dangerous-URL cases exercised`)
  assert.ok(checked === cases.length && checked > 0, "every case must actually have run")

  // The SPARE half, in the same shape: ordinary URLs in the same attributes must survive, or the
  // sanitizer would be breaking every link on the site and this suite would not notice.
  const safe = await emit(
    `<a href="https://example.com/ok">x</a>\n\n<a href="/Positions/Mount">y</a>`,
    "SafeUrls",
  )
  assert.match(safe, /https:\/\/example\.com\/ok/, "an https URL must survive")
  assert.match(safe, /\/Positions\/Mount/, "an internal URL must survive")
})

test("QUARTZ'S OWN MARKUP SURVIVES — the regression that would break every page", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // The sanitizer deliberately does NOT use an allowlist, because the pipeline's own output is
  // full of SVG, classes and data-* attributes (callouts, the external-link icon, transcludes,
  // heading anchors). A tightened sanitizer that stripped these would pass every assertion above.
  const html = await emit(
    [
      `> [!note] A callout`,
      ``,
      `> its body`,
      ``,
      `<svg viewBox="0 0 24 24" class="icon"><path d="M10 13a5 5 0 0 0 7.54.54"/></svg>`,
      ``,
      `<span class="text-highlight" data-keep="1">kept</span>`,
    ].join("\n"),
    "Benign",
  )
  assert.match(html, /<svg/, "inline SVG must survive")
  assert.match(html, /viewBox="0 0 24 24"/, "SVG attributes must survive")
  assert.match(html, /<path/, "SVG children must survive")
  assert.match(html, /data-keep="1"/, "data-* attributes must survive")
  assert.match(html, /class="text-highlight"/, "classes must survive")
  assert.match(html, /data-callout="note"/, "the callout pipeline's own data attributes survive")

  console.log("  coverage: 6 pipeline-own markup facts kept (svg, viewBox, path, data-*, class, callout)")
})

// ── THE 12-MEMBER SWEEP, and the one member that does not strip ────────────────────────────────
//
// The dangerous-URL test above exercises FIVE of `URL_ATTRS`'s members by hand. A hand-maintained
// enumeration inside a gate is uncovered-by-default for anything added later (CLAUDE.md §6.7) —
// and here the members it happened to omit included the only one that does not work. This sweep
// DERIVES the member list from `ofm.ts` every run and refuses to run on a name it has no fixture
// for, so growing the set turns this RED instead of silently widening the blind spot.
//
// THE FINDING, pinned as INCUMBENT rather than fixed (D-03, Phase P1–P4). `ping` is the only
// member of `URL_ATTRS` that `property-information` marks space-separated, so hast stores its
// value as an ARRAY. `stripDangerousHtml`'s guard is `typeof val === "string"` (`ofm.ts:569`),
// which is false for an array, so the attribute is never tested and a `javascript:` URL in a
// `ping` reaches the DOM. Measured end-to-end through the real pipeline: 11 of 12 strip, `ping`
// does not. Corpus exposure TODAY IS ZERO —
//   grep -rlE '<[a-zA-Z][^>]*\sping=' content --include='*.md' | wc -l   # 0
// — so it is latent, not live, on a corpus an LLM content bot writes to daily. Repairing it would
// change emitted bytes, which makes it a DECISION for the owner and not part of the re-host.
// This test therefore asserts the gap still exists: if it closes, that is a byte change and this
// goes red on purpose, naming it.
//
// MUTANTS RUN AGAINST THIS TEST, all four killed (ofm.ts restored byte-identical afterwards):
//   M1  repair `ping` (coerce an array value to a string before the guard)  -> RED
//   M2  drop `"cite"` from URL_ATTRS                                        -> RED  (see below)
//   M3  add an unfixtured array-valued member (`"rel"`) to URL_ATTRS        -> RED
//   M4  drop `"ping"` from URL_ATTRS                                        -> RED
test("EVERY `URL_ATTRS` MEMBER IS SWEPT — 11 strip, `ping` does not, and that is INCUMBENT", async (t) => {
  if (skip) return t.skip("harness unavailable")

  const ofmSrc = await fs.readFile(
    path.join(REPO, "source/quartz/plugins/transformers/ofm.ts"),
    "utf8",
  )
  const block = ofmSrc.match(/const URL_ATTRS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(
    block,
    "URL_ATTRS is no longer a literal Set in ofm.ts — this sweep can no longer derive its members " +
      "and would otherwise cover NOTHING while still passing",
  )
  const names = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.ok(names.length > 0, "a derived member list of zero would assert nothing")

  // One fixture per member, each carrying the probe id so the element can be found again.
  const FIXTURES = {
    href: `<a id="P" href="javascript:1">x</a>`,
    src: `<img id="P" src="javascript:1" alt="k">`,
    srcset: `<img id="P" src="/ok.png" srcset="javascript:1" alt="k">`,
    xlinkhref: `<svg><use id="P" xlink:href="javascript:1"/></svg>`,
    poster: `<video id="P" poster="javascript:1"></video>`,
    action: `<form id="P" action="javascript:1"></form>`,
    formaction: `<form><button id="P" formaction="javascript:1">b</button></form>`,
    background: `<table id="P" background="javascript:1"><tr><td>c</td></tr></table>`,
    longdesc: `<img id="P" src="/ok.png" longdesc="javascript:1" alt="k">`,
    cite: `<blockquote id="P" cite="javascript:1">x</blockquote>`,
    ping: `<a id="P" href="/ok" ping="javascript:1">x</a>`,
    data: `<object id="P" data="javascript:1"></object>`,
  }
  const missing = names.filter((n) => !(n in FIXTURES))
  assert.deepEqual(
    missing,
    [],
    `URL_ATTRS gained ${missing.join(", ")} — add a fixture. An attribute nobody wrote a case ` +
      "for is an attribute nobody checked, and it reads exactly like one that passed",
  )

  // THE OTHER DIRECTION, and it is the one that nearly got away. This sweep derives its member
  // list from the very Set it is testing, so DELETING a member deletes its own test case with it:
  // measured, dropping `"cite"` from URL_ATTRS left this test GREEN (the hand-written case above
  // caught it, which is the only reason it surfaced). A derived enumeration protects against
  // growth and is blind to shrinkage. FIXTURES is the independent record of what the set held
  // when this was written, so compare against it and name the loss.
  const dropped = Object.keys(FIXTURES).filter((n) => !names.includes(n))
  assert.deepEqual(
    dropped,
    [],
    `URL_ATTRS no longer sanitises ${dropped.join(", ")} — a member was removed from the Set, ` +
      "which un-sanitises that attribute across all 4,600 pages AND silently removes this " +
      "sweep's case for it. If the removal is deliberate, delete its fixture in the same commit",
  )
  assert.ok(
    names.length >= 12,
    `URL_ATTRS is down to ${names.length} members; it held 12 when this sweep was written`,
  )

  const survivors = []
  let probed = 0
  for (const [i, name] of names.entries()) {
    const html = await emit(FIXTURES[name], `UrlAttr${i}`)
    const el = (html.match(/<[a-zA-Z:-]+[^>]*id="P"[^>]*>/) || [null])[0]
    // POSITIVE CONTROL, per case. A probe element that never reached the output reads EXACTLY
    // like a clean strip (CLAUDE.md §6.6) — the absence must fail, not pass.
    assert.ok(el, `${name}: the probe element is absent from the output, so this case proves nothing`)
    probed += 1
    if (/javascript:/i.test(el)) survivors.push(name)
  }
  console.log(`  coverage: ${probed} of ${names.length} URL_ATTRS members swept end-to-end`)
  assert.equal(probed, names.length, "every derived member must actually have been driven")

  // The MECHANISM, asserted rather than described. Pinning the literal list `["ping"]` alone would
  // be a constant with a test around it; this says WHY, so a future array-valued member added to
  // URL_ATTRS is predicted by the same rule instead of quietly joining the gap.
  const { html: propertyInfo } = await import(
    pathToFileURL(sourceRequire().resolve("property-information")).href
  )
  const arrayValued = names.filter((n) => {
    const info = propertyInfo.property[n]
    return !!info && (info.spaceSeparated || info.commaSeparated || info.commaOrSpaceSeparated)
  })
  assert.deepEqual(
    survivors,
    arrayValued,
    "the attributes that survive sanitising must be exactly the attributes hast stores as an " +
      "array — that IS the defect: `typeof val === \"string\"` never fires on them",
  )
  assert.deepEqual(
    survivors,
    ["ping"],
    "INCUMBENT BEHAVIOUR. 11 of 12 URL_ATTRS members strip a javascript: URL; `ping` does not. " +
      "If this went red because the list SHRANK, the sanitizer got fixed — that is an emitted-byte " +
      "change and needs an owner decision, not a silent port. If it GREW, a new array-valued " +
      "attribute joined the gap",
  )
})
