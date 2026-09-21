// ── stripDangerousHtml: ARRAY-VALUED URL ATTRIBUTES (`ping`) ──────────────────────────────────
//
// `stripDangerousHtml` (source/quartz/plugins/transformers/ofm.ts, the sanitizer that runs right
// after rehype-raw) tests a URL-bearing attribute against DANGEROUS_URL only when
// `typeof val === "string"`. hast stores every attribute property-information marks
// space-separated as an ARRAY of tokens — and `ping` is the one member of URL_ATTRS it marks that
// way (asserted below from the package, not from a list). So an anchor carrying
// `ping="javascript:…"` was never tested and reached the emitted HTML intact. A ping fires a POST
// to every listed URL on click: a tracking and exfiltration vector, latent on a corpus that
// LLM bots rewrite daily (regenerate:json, content-improvement-bot.yml).
//
// WHAT THIS FILE COVERS — the real function through the real pipeline (tests/_quartz_pipeline.mjs
// bundles source/quartz.config.ts and takes its transformer list verbatim), on raw-HTML fixtures:
//  · a ping whose only token is a javascript: URL is DROPPED (positive control A);
//  · a ping holding one safe and one dangerous token is DROPPED WHOLE — the safe token is not
//    kept, because a partially sanitised ping is still a ping (positive control B);
//  · the C0-control evasion DANGEROUS_URL's `.replace(/[\u0000- ]/g, "")` exists to defeat
//    is defeated per token too (control C);
//  · the SPARE half: a benign ping and the href beside it survive untouched, so the fix is
//    targeted and emits the same bytes for every safe page (control D);
//  · the MECHANISM: the set of URL_ATTRS members hast stores as arrays is derived from
//    property-information every run and must be exactly what this file has fixtures for. A new
//    array-valued member turns this red instead of quietly joining the gap.
//
// Every case first asserts the probe element REACHED the output. A probe that never arrived reads
// exactly like a clean strip (CLAUDE.md §6.6), so absence fails rather than passes.
//
// WHAT IT DOES NOT COVER (CLAUDE.md §6.9):
//  · the browser. Whether a surviving attribute is exploitable in a real DOM is not asserted.
//  · the other eleven URL_ATTRS members. They take the string path, which this change does not
//    touch; the programme's `quartz_sanitizer_contract.test.mjs` sweeps all twelve and, once it
//    merges, its final assertion (`survivors == ["ping"]`, pinned as INCUMBENT) must become
//    `survivors == []` — its own header says a shrink means "the sanitizer got fixed".
//  · a `ping` written into content as the WHOLE attribute value being whitespace-obfuscated
//    (`java<TAB>script:`): hast's tokenizer splits it into two harmless tokens, and browsers
//    tokenize ping on the same ASCII whitespace, so neither side sees a javascript: URL. Not a
//    gap, just not this file's claim.
//
// RED-FIRST RECORD (dev tip b06afd135, ofm.ts blob 58186c1b, before the change): controls A, B
// and C FAILED with the probe element present and `ping="javascript:…"` still in it — 3 of 5
// red; D and the mechanism test passed. MUTANTS run against the fixed ofm.ts (blob 3e67558a),
// each restored byte-identical afterwards, all four killed:
//   M1  revert to the string-only guard                          -> RED (A, B, C)
//   M2  keep the safe tokens (filter instead of delete)          -> RED (A, B, C — an emptied
//                                                                   array still serialises a ping)
//   M3  test only the first token                                -> RED (B, C)
//   M4  drop the per-token control-character strip               -> RED (C)
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

const page = (body) => `---\ntitle: Ping Fixture\n---\n\n${body}\n`

/** Emit one body through the real pipeline and return the probe element's opening tag. */
async function probe(body, slug) {
  const { html } = await runPipeline(page(body), { slug })
  const el = (html.match(/<a[^>]*id="P"[^>]*>/) || [null])[0]
  assert.ok(el, `${slug}: the probe <a id="P"> is absent from the output, so this case proves nothing`)
  return el
}

test("MECHANISM: the URL_ATTRS members hast stores as arrays are exactly the ones fixtured here", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const ofmSrc = await fs.readFile(
    path.join(REPO, "source/quartz/plugins/transformers/ofm.ts"),
    "utf8",
  )
  const block = ofmSrc.match(/const URL_ATTRS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(block, "URL_ATTRS is no longer a literal Set in ofm.ts — this file can no longer derive its members")
  const names = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.ok(names.length >= 12, `URL_ATTRS holds ${names.length} members; it held 12 when this was written`)

  // `find(html, name)` resolves an ATTRIBUTE name the way hast does ("srcset" -> srcSet,
  // "xlinkhref" -> xLinkHref). Indexing `html.property[name]` with the lowercase member misses
  // every camelCased key and silently surveys 8 of 12 — measured on the first run of this file.
  const { html: propertyInfo, find } = await import(
    pathToFileURL(sourceRequire().resolve("property-information")).href
  )
  let looked = 0
  const arrayValued = names.filter((n) => {
    const info = find(propertyInfo, n)
    if (info && info.defined) looked += 1
    return !!info && (info.spaceSeparated || info.commaSeparated || info.commaOrSpaceSeparated)
  })
  console.log(`  coverage: ${looked} of ${names.length} URL_ATTRS members found in property-information; array-valued: ${arrayValued.join(",") || "(none)"}`)
  assert.equal(looked, names.length, "property-information does not define every URL_ATTRS member — the survey is incomplete, and an unsurveyed member is an unchecked one")
  assert.deepEqual(
    arrayValued,
    ["ping"],
    "the array-valued members of URL_ATTRS changed. Every one needs a fixture below: an " +
      "attribute nobody drove through the pipeline is an attribute nobody checked",
  )
})

test("CONTROL A: a ping whose only token is javascript: is dropped", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const el = await probe(`<a id="P" href="/ok" ping="javascript:window.__pwned=1">x</a>`, "PingA")
  assert.doesNotMatch(el, /javascript:/i, `a javascript: ping survived sanitising: ${el}`)
  assert.doesNotMatch(el, /\sping=/i, `the ping attribute must be removed, not emptied: ${el}`)
  assert.match(el, /href="[^"]*ok"/, "the safe href beside it must survive")
})

test("CONTROL B: a ping with one safe and one dangerous token is dropped WHOLE", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const el = await probe(
    `<a id="P" href="/ok" ping="https://example.com/ok javascript:window.__pwned=1">x</a>`,
    "PingB",
  )
  assert.doesNotMatch(el, /javascript:/i, `the dangerous token survived: ${el}`)
  assert.doesNotMatch(
    el,
    /\sping=/i,
    `the safe token was kept — a partially sanitised ping is still a ping: ${el}`,
  )
  assert.match(el, /href="[^"]*ok"/, "the safe href beside it must survive")
})

test("CONTROL C: a C0-control-obfuscated token is still recognised per token", async (t) => {
  if (skip) return t.skip("harness unavailable")
  // &#1; decodes to U+0001 inside the token; the URL parser in a browser strips leading C0
  // controls, so this IS a javascript: URL to the browser. Not ASCII whitespace, so hast's
  // tokenizer keeps it inside the token — exactly the case the per-token strip must handle.
  const el = await probe(
    `<a id="P" href="/ok" ping="https://example.com/ok &#1;javascript:window.__pwned=1">x</a>`,
    "PingC",
  )
  assert.doesNotMatch(el, /javascript:/i, `the obfuscated dangerous token survived: ${el}`)
  assert.doesNotMatch(el, /\sping=/i, `the ping attribute must be removed whole: ${el}`)
})

test("CONTROL D (the spare half): a benign ping and its href survive byte-for-byte", async (t) => {
  if (skip) return t.skip("harness unavailable")
  const el = await probe(
    `<a id="P" href="https://example.com/ok" ping="https://example.com/beacon https://example.org/b2">x</a>`,
    "PingD",
  )
  assert.match(el, /ping="https:\/\/example\.com\/beacon https:\/\/example\.org\/b2"/, `a safe ping must survive untouched: ${el}`)
  assert.match(el, /href="https:\/\/example\.com\/ok"/, `the href must survive: ${el}`)
})
