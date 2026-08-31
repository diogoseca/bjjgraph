import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

type W = Window & { __neural: any }

/**
 * TWO SURFACES THAT NAMED A THING WRONG, AND NEITHER HAD A GATE.
 *
 * Both were found by an audit, not by the suite, and both are the same shape: a surface answering
 * a question about IDENTITY — which thing is this, and which half of it am I looking at — from a
 * source that could not know the answer.
 *
 * 1. THE DRILL HEADER PRINTED THE ROLL'S SEAT, NOT THE DECK'S. `renderDrill` passed
 *    `this.roleLabel()` — `playerRole`, i.e. which side YOU are on in the roll currently in play —
 *    where `info.role`, the deck key's own half, belongs. On a position deck the two usually agree,
 *    which is why it survived; on a TECHNIQUE deck the axes are not even the same one
 *    (Attacker/Defender, not Top/Bottom), and 2,652 of the 2,924 shipped decks are technique decks,
 *    so the kicker was wrong on 90.7% of them. With no roll in play `roleLabel()` returns the
 *    constant "Top", so it was a constant dressed as a measurement (CLAUDE.md §6.6).
 *
 * 2. THE SEARCH MODAL LISTED EVERY SITE TWICE. `renderSearch` filtered `this.nodes` with no `rep`
 *    term. `_deriveDualPairs` gives both members of a pair the hub's own title (`t: h.t`), so a
 *    title match resolved to the site twice and the 100-cap then showed 50 sites. The Explore
 *    pane's search has always filtered; this one never did.
 *
 * WHY THE ASSERTIONS ARE SHAPED THIS WAY (CLAUDE.md §6.3):
 *  · The duplicate test asserts a PROPERTY OF THE EMITTED ROWS — that no two carry the same text —
 *    rather than recomputing the expected row set. A spec-side copy of the filter would be written
 *    from the same reading of the code under test and would agree by construction. A non-triviality
 *    floor sits beside it so it cannot pass on an empty list.
 *  · The header test asserts a DIFFERENTIAL against a control: the same deck is read twice with
 *    `playerRole` flipped between the reads. The pre-fix build changes its answer; the fixed build
 *    cannot. Asserting only "it says ATTEMPTING" would also pass on a build that happened to be
 *    standing on a top seat, which is exactly how the bug hid.
 *
 * NON-KILLS, recorded so nobody reads this spec as covering more than it does:
 *  · It does NOT cover the "Defense" category that `buildDrillPanel`'s `deckKeyOverride` branch
 *    stamps in place of the node's real category. That loses the submission/transition distinction,
 *    so a `<name>|Defender` submission deck opened from the panic drill reads DEFENDING where
 *    ESCAPING is right. That is the override's defect and belongs with the Defender-deck work.
 *  · It does NOT cover the search modal's DETAIL pane, only its results column.
 *  · The vocabulary strings themselves are pinned by `dual-pair.spec.ts` on the canvas side; this
 *    spec pins that the DRILL side reads the same table for the same deck.
 */

const CASES: Array<{ key: string; word: string; what: string }> = [
  { key: "Mount to Armbar|Attacker", word: "ATTEMPTING", what: "a transition's attacker" },
  { key: "Americana from 3-4 Mount|Attacker", word: "FINISHING", what: "a submission's attacker" },
  { key: "Mount|Bottom", word: "BOTTOM", what: "a position's bottom seat" },
]

test("@curated the drill header names the DECK's seat, and the roll cannot move it", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.hydrate(CASES.map((c) => c.key))

  for (const c of CASES) {
    // read the SAME deck twice, with the roll's seat flipped between the reads. `playerRole` is the
    // exact input the old code used, so this is the differential the bug lives in.
    const read = async (playerRole: string) =>
      page.evaluate(
        ([key, role]) => {
          const a = (window as unknown as W).__neural
          a.playerRole = role
          a.openStudy(key as string)
          const head = document.querySelectorAll("[data-drill-role]")
          return {
            markers: head.length,
            word: head.length ? (head[0] as HTMLElement).textContent!.trim() : null,
            deckRole: a._deckInfo ? a._deckInfo.role : null,
            cat: a._deckInfo ? a._deckInfo.cat : null,
          }
        },
        [c.key, playerRole] as const,
      )

    const asTop = await read("top")
    const asBottom = await read("bottom")

    expect(asTop.markers, `${c.what}: the role kicker is emitted exactly once`).toBe(1)
    expect(asTop.word, `${c.what} (${c.key}) reads its own seat`).toBe(c.word)
    expect(
      asBottom.word,
      `${c.what}: flipping playerRole to "bottom" must not touch a word about the DECK`,
    ).toBe(asTop.word)
    // and prove the deck really is the one we think, so a silent key miss cannot pass this
    expect(asTop.deckRole, `${c.key} resolved to its own role`).toBe(c.key.split("|")[1])
  }
})

test("@curated the search modal names each site once", async ({ page }) => {
  const j = journey(page)
  await j.boot()

  const rowsFor = (q: string) =>
    page.evaluate((query) => {
      const a = (window as unknown as W).__neural
      a.openSearch()
      a._searchQ = query as string
      a._searchSel = null
      a.renderSearch()
      // read what the RENDER emitted — the results column is the first child of the body row
      const card = a.modalCardRef.current as HTMLElement
      const col = card.querySelectorAll("div")[3] as HTMLElement // top, body, results, detail
      const results = Array.from(card.querySelectorAll("div")).find(
        (d) => (d as HTMLElement).style.width === "312px",
      ) as HTMLElement
      const host = results || col
      const texts = Array.from(host.children).map((r) => (r as HTMLElement).textContent!.trim())
      return { texts, repTotal: a.nodes.filter((n: any) => n.rep).length, nodeTotal: a.nodes.length }
    }, q)

  for (const q of ["mount", "guard", ""]) {
    const { texts, repTotal, nodeTotal } = await rowsFor(q)
    const label = q ? `query "${q}"` : "the empty query"

    // NON-TRIVIALITY FLOOR FIRST — an empty list satisfies "no duplicates" perfectly.
    expect(texts.length, `${label} rendered rows at all`).toBeGreaterThan(3)
    expect(repTotal, "the graph really is paired, so the bug was reachable").toBeLessThan(nodeTotal)

    const seen = new Map<string, number>()
    for (const t of texts) seen.set(t, (seen.get(t) || 0) + 1)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([t, n]) => `${t} x${n}`)
    expect(dupes, `${label}: every row names a different site`).toEqual([])
  }
})
