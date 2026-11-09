import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * U111 (owner, 2026-11-09): "Show only the injury risks, and a disclaimer with a sensible warning to go slow and watch out for
 * the tap at the end of the article please". U112 a puts the cut in the page itself: the three Submission templates render the
 * Safety Guide as the injury-risk table and one closing line, so the static page, its markdown export and the app's reader
 * show the same guide. Application speed, tap signals, release protocol and training restrictions stay authored in the source
 * and reach no page. U113 b (owner, 2026-11-09): the section is "Injury risks", said once: the page's heading and the reader's tile
 * and index row, with no "Injury Risks:" label left above the table. Transitions share the section id and keep their whole guide; no other page gets the line.
 *
 * THE CLAIMS, from what the build and the reader EMITTED:
 *   - the built hub's guide is its injury table and, last, the closing line; none of the four dropped parts; and its markdown
 *     export says the same;
 *   - the reader shows that guide whole: the hub's table, row for row, then the line, once, word for word, after the table;
 *   - a Transition's guide in the reader is its page's guide, whole, and it has no closing line.
 * The reader holds no U111 code (0 B), so a reader mutant can only lose what the page published; the template side is pinned
 * by tests/submission_safety_pages.test.mjs over every built Submission guide. HARNESS: the pages are the real built ones; the
 * DSL's `{}` dossiers carry no safety, and the reader never read the dossier's anyway. Red-proof is at the foot of this file.
 */

const READY = '[data-reader][data-reader-ready="true"]'
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }
const NOTE = "Go slow. Apply this gradually, with a partner who knows it is coming, and let go the moment they tap, by hand, foot or voice."
const DROPPED = ["Application Speed", "Tap Signals", "Release Protocol", "Training Restrictions"]

async function read(page: Page, path: string, hub: string) {
  const j = journey(page)
  await j.boot(path, { initialState: QUIET })
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", path)
  await j.readerLayoutSettled()
  return page.evaluate(async ({ hub, NOTE }) => {
    const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim()
    const page = new DOMParser().parseFromString(await (await fetch(hub)).text(), "text/html")
    const built = page.querySelector("#safety-considerations")
    const reader = document.querySelector("[data-reader]")!
    const shown = reader.querySelector('[data-source-id="safety-considerations"]')
    const notes = [...reader.querySelectorAll("p")].filter(p => norm(p.textContent) === NOTE)
    const table = shown?.querySelector("table")
    const md = await fetch("/markdown" + hub + ".md").then(r => r.ok ? r.text() : "")
    return {
      builtRows: [...(built?.querySelector("table")?.querySelectorAll("tr") || [])].map(r => norm(r.textContent)),
      builtHeads: [...(built?.querySelectorAll("strong") || [])].map(s => norm(s.textContent)),
      builtLast: norm(built?.lastElementChild?.textContent), builtTitle: norm(built?.querySelector('h2')?.textContent),
      tileTitle: norm(shown?.closest('.ng-section-card')?.querySelector('.ng-section-title')?.textContent),
      indexRow: norm(document.querySelector('.ng-reader-toc-row[data-toc-type="safety"] a')?.textContent),
      md: { length: md.length, note: md.includes(NOTE.replace("Go slow.", "**Go slow.**")), dropped: /\*\*(Application Speed|Tap Signals|Release Protocol|Training Restrictions)\*\*/.test(md) },
      shownRows: [...(table?.querySelectorAll("tr") || [])].map(r => norm(r.textContent)),
      heads: [...(shown?.querySelectorAll("strong") || [])].map(s => norm(s.textContent)),
      builtText: norm(built?.textContent), shownText: norm(shown?.textContent),
      notes: notes.length,
      afterTable: !!table && notes.length === 1 && !!(table.compareDocumentPosition(notes[0]) & Node.DOCUMENT_POSITION_FOLLOWING),
    }
  }, { hub, NOTE })
}

for (const [path, hub] of [
  ["/Submissions/Armbar/from-Mount/Attacker", "/Submissions/Armbar/from-Mount"],
  ["/Submissions/Americana/from-Side-Control", "/Submissions/Americana/from-Side-Control"],
  ["/Submissions/Americana", "/Submissions/Americana"],
] as const) {
  test(`@curated U111, U112 a: a submission's guide is its injury risks, then one closing line, on the page and in the reader: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const m = await read(page, path, hub)
    expect(m.builtRows.length, "control: the built hub has an injury table").toBeGreaterThan(2)
    expect(m.builtHeads.filter(h => DROPPED.some(d => h.startsWith(d))), "the page publishes none of the four dropped parts").toEqual([])
    expect(m.builtLast, "the page's guide ends with the closing line").toBe(NOTE)
    expect([m.builtTitle, m.tileTitle, m.indexRow], 'U113 b: "Injury risks" on the page, the tile and its index row').toEqual(['Injury risks', 'Injury risks', 'Injury risks'])
    expect(m.builtHeads.filter(h => /^Injury Risks/i.test(h)), 'U113 b: said once, no label above the table').toEqual([])
    expect(m.md, "its markdown export says the same").toEqual({ length: expect.any(Number), note: true, dropped: false })
    expect(m.md.length, "control: the markdown export was read").toBeGreaterThan(1000)
    expect(m.shownRows, "the reader shows the hub's injury table, row for row").toEqual(m.builtRows)
    expect(m.heads.filter(h => DROPPED.some(d => h.startsWith(d))), "none of the guide's other four parts").toEqual([])
    expect(m.notes, "the closing line, once, word for word").toBe(1)
    expect(m.afterTable, "the closing line follows the injury risks").toBe(true)
  })
}

test("@curated U111: a transition keeps its whole guide and gets no closing line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const path = "/Transitions/Knee-Slice-Pass/Attacker"
  const m = await read(page, path, path) // a transition's guide is on its seat's own page
  expect(m.builtText.length, "control: the transition's page has a guide").toBeGreaterThan(200)
  expect(m.shownText, "the transition's guide is whole in the reader").toBe(m.builtText)
  expect(m.notes, "no closing line on a transition").toBe(0)
})

// Red-proof (v1.252.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, against a green baseline):
//   u111-reader-cut-back ... the old reader cut put back (the page's guide re-cut after its table) ... killed: the closing line, once
// The template side's controls are in tests/submission_safety_pages.test.mjs (a page, a template and a source each mutated).
// NOT COVERED by a control here: the page claims (builtHeads, builtLast, md), which only a regenerated, rebuilt page could break.
