// U111, U112 a (owner, 2026-11-09): "Show only the injury risks, and a disclaimer with a sensible warning to go slow and watch out
// for the tap at the end of the article". The cut is in the three Submission templates, so every built Submission page, its
// markdown export and the app's reader show the guide as the injury-risk table and one closing line. Application speed, tap
// signals, release protocol and training restrictions stay authored in the source JSON and reach no page.
//
// This pins the template side, over what regenerate:md EMITTED (the committed content/*.md), plus the templates and the source:
//   - every Submission page with an Injury risks guide (U113 b's name) has its injury table, ends the guide with the closing line, and has none of the
//     four dropped parts; a positive count, so a scan that read nothing cannot pass;
//   - each of the three templates carries the line once and none of the four heads;
//   - every Submission source that authors a safety object still authors all four parts, non-empty.
// The md-only `Cross Collar Choke/Finish` page has no source and was cut by hand; it is scanned like the rest.
// Red-proof (v1.252.0, each mutant applied by hand to one file, run, restored):
//   tap-signals-back-in-a-page .... "**Tap Signals**:" re-inserted into one generated page ...... killed: still has **Tap Signals**
//   line-lost-from-a-template ..... the closing line removed from TEMPLATE-DUAL ................. killed: the closing line, once
//   source-part-dropped ........... one source's tap_signals emptied ............................. killed: tap_signals
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = new URL("..", import.meta.url).pathname
const LINE = "> **Go slow.** Apply this gradually, with a partner who knows it is coming, and let go the moment they tap, by hand, foot or voice."
const DROPPED = ["**Application Speed**", "**Tap Signals**", "**Release Protocol**", "**Training Restrictions**"]
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const submissions = walk(join(root, "content/Submissions"))
const guide = text => {
  const start = text.indexOf("## Injury risks")  // U113 b (owner, 2026-11-09): the section is named for what it holds
  return start < 0 ? null : text.slice(start, text.indexOf("</section>", start))
}

test("every built Submission guide is its injury risks, then the closing line", () => {
  const bad = []
  let pages = 0
  for (const file of submissions.filter(f => f.endsWith(".md"))) {
    const section = guide(readFileSync(file, "utf8"))
    if (section === null) continue
    pages++
    const lines = section.split("\n").map(l => l.trim()).filter(Boolean)
    const why = [
      section.includes("**Injury Risks**") && "U113 b: the heading says it, so no label says it again",
      !/\| Injury \| Severity \| Recovery Time \|\n\|[-|]+\|\n\|/.test(section) && "no injury table rows",
      lines.at(-1) !== LINE && "does not end with the closing line",
      section.split(LINE).length !== 2 && "the closing line is not there exactly once",
      ...DROPPED.filter(head => section.includes(head)).map(head => "still has " + head),
    ].filter(Boolean)
    if (why.length) bad.push(relative(root, file) + ": " + why.join(", "))
  }
  assert.ok(pages >= 300, `scanned only ${pages} Submission guides`)
  assert.deepEqual(bad, [])
  console.log(`submission_safety_pages: ${pages} guides, each the injury risks and the closing line`)
})

test("each Submission template renders the guide that way", () => {
  for (const name of ["templates/Submissions.md.jinja2", "templates/Submissions/TEMPLATE-DUAL.md.jinja2", "templates/Submissions/TEMPLATE-FAMILY.md.jinja2"]) {
    const section = guide(readFileSync(join(root, name), "utf8"))
    assert.ok(section && section.includes("safety_considerations.injury_risks"), name + ": the injury loop")
    assert.ok(!section.includes("**Injury Risks**"), name + ": U113 b, said once")
    assert.equal(section.split(LINE).length, 2, name + ": the closing line, once")
    assert.deepEqual(DROPPED.filter(head => section.includes(head)), [], name + ": none of the four dropped heads")
  }
})

test("the source still authors every safety part the pages leave out", () => {
  const thin = []
  let sources = 0
  for (const file of submissions.filter(f => f.endsWith(".json"))) {
    const sc = JSON.parse(readFileSync(file, "utf8")).safety_considerations
    if (!sc || typeof sc !== "object") continue
    sources++
    const missing = ["application_speed", "tap_signals", "release_protocol", "training_restrictions"].filter(k => !(sc[k] && sc[k].length))
    if (missing.length) thin.push(relative(root, file) + ": " + missing.join(", "))
  }
  assert.ok(sources >= 300, `read only ${sources} Submission safety objects`)
  assert.deepEqual(thin, [])
})
