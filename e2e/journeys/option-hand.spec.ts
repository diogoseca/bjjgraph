import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE HAND — what gets dealt, in what order, printing what (v1.119.0; uncapped v1.123.0).
 *
 * `option-edge.spec.ts` pins the VALUE (EDGE = 100 × (Q(s,a) − B(s)), and that the card prints the
 * integer the solver published). This file pins the HAND: EVERY legal move is dealt, the
 * order must be the app's own ranking under a total order that never falls through to node index,
 * the printed integer must be the same quantity the order was made from, the order must survive a
 * mid-decision JIT grade, and a submission's odds must be its AUTHORED rate.
 *
 * Every corpus claim walks all 272 role-hands through `optionsFor` — the same seam `enterLand`
 * deals from — rather than sampling one state and generalising.
 */

/** All 272 role-hands, each with an INDEPENDENTLY re-derived pool.
 *
 *  The pool is rebuilt here from `adj` + the two documented filters (v1.103.0 role, v1.103.0
 *  origin). It began as a way to see what the cap was hiding; with the cap gone it is a second
 *  implementation of the app's own filter, kept deliberately — every caller below asserts
 *  POOL ⊇ DEALT (and the first asserts SET EQUALITY), which fails loudly the day the app's filter
 *  and this one disagree. A copy that is checked against the original on every run is a gate. */
const HANDS = `(() => {
  const a = window.__neural;
  a.aiSkill = 0.13; a.userMods = null;
  const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
  a._posKey = "__handsweep__";
  const out = [];
  for (let pi = 0; pi < a.nodes.length; pi++) {
    const p = a.nodes[pi];
    if (p.ty !== "positions" || !p.posId || p.cal?.stateAlias) continue;
    // ONE ENTRY PER SITE (v1.125.0). A state is two nodes now — Top and Bottom halves of the same
    // site — and both answer for the same two role-hands (adjacency and the EDGE table are
    // site-level by construction), so walking members would run all 272 hands twice and call it
    // 544. \`rep\` is the half that speaks for the site, and is true for every unpaired node.
    if (p.rep === false) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = pi; a.playerRole = role;
      const seen = new Set(); const pool = [];
      for (const k of a.adj[pi]) {
        const n = a.nodes[k];
        if (n.ty === "positions" || seen.has(n.t)) continue; seen.add(n.t);
        if (n.fromRole && n.fromRole !== role) continue;
        // ORIGIN, with its one authored exception (v1.212.0): a listing flagged deal_here deals the
        // technique at that position too, carried on the wire as the technique's alsoFrom posIds.
        if (n.fromPositionId && p.posId && n.fromPositionId !== p.posId
          && !(Array.isArray(n.alsoFrom) && n.alsoFrom.includes(p.posId))) continue;
        pool.push({ t: n.t, ty: n.ty });
      }
      const dealt = a.optionsFor(pi);
      if (!dealt.length) continue;
      out.push({
        st: p.posId + "/" + role,
        pool: pool,
        cards: dealt.map((o) => ({
          t: o.node.t, ty: o.node.ty, ord: o.ord, ordOdds: o.ordOdds,
          att: (o.ev && o.ev.att) || 0,
          e0: o.ev ? o.ev.e0 : null, c1: o.ev ? o.ev.c1 : null,
          raw: a.moveEdge(o), print: a.edgeMark(o) ? a.edgeMark(o).i : null,
        })),
        // permute the input and re-sort with the app's own comparator: an order that depends on
        // insertion (i.e. on node index, which is what \`adj\` iterates in) cannot survive this
        resorted: dealt.slice().reverse().sort((x, y) => a._cmpDealt(x, y)).map((o) => o.node.t),
        zeroPairs: (() => {
          let z = 0;
          for (let i = 0; i < dealt.length; i++) for (let j = i + 1; j < dealt.length; j++)
            if (a._cmpDealt(dealt[i], dealt[j]) === 0) z++;
          return z;
        })(),
        // pairs that tie on all three NUMERIC keys — the population the name tiebreak exists for
        numericTies: (() => {
          let t = 0;
          for (let i = 0; i < dealt.length; i++) for (let j = i + 1; j < dealt.length; j++) {
            const x = dealt[i], y = dealt[j];
            if (x.ord === y.ord && x.ordOdds === y.ordOdds
              && ((x.ev && x.ev.att) || 0) === ((y.ev && y.ev.att) || 0)) t++;
          }
          return t;
        })(),
      });
    }
  }
  a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
  return out;
})()`

const sweep = (page: any) => page.evaluate(HANDS)

test("@curated every legal move is dealt — the hand IS the pool", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const hands = await sweep(page)
  expect(hands.length, "every distinct position seat was walked").toBe(242) // census:positionChoiceSeats

  // v1.119.0 asked the weaker question — "did the cap erase a CATEGORY" — because a cap existed
  // and some truncation was accepted. With NG_HAND_CAP gone the invariant is the strongest one
  // available: this spec's INDEPENDENT copy of the two filters (role, and origin with its
  // deal_here exception) and the app's own
  // `optionsFor` must agree on the exact SET, every time. Withheld cards and phantom cards are
  // one assertion now, and the category floor is not needed to state it.
  const withheld: string[] = []
  for (const h of hands) {
    const poolT = new Set(h.pool.map((p: any) => p.t))
    const dealtT = new Set(h.cards.map((c: any) => c.t))
    for (const c of h.cards)
      expect(poolT.has(c.t), `${h.st}: ${c.t} was dealt but is not in this spec's pool`).toBe(true)
    const missing = [...poolT].filter((t) => !dealtT.has(t))
    if (missing.length) withheld.push(`${h.st}: ${missing.length} of ${poolT.size} not dealt — ${missing.slice(0, 4).join(", ")}`)
  }
  expect(withheld.join("\n"), "a legal move survived both filters and was still not dealt").toBe("")

  // The hand the retired floor was written for, now the proof that it is unnecessary. Side
  // control top survives 24 cards — 16 submissions and 8 transitions — and the ten best by EDGE
  // are all submissions, so the old cap left the sport's most common top position unable to
  // ADVANCE position at all. All 24 are dealt, so all 8 transitions are simply there, including
  // `Side Control to Mount` (23% attempt, the largest authored anywhere from that state) which
  // the floor did NOT admit — it scores −2 and lost the floor's slot to a +3 card.
  // (25 → 24 and 9 → 8 in v1.171.0: `Side Control to Scarf Hold Position` was a twin of
  // `Side Control to Kesa Gatame` — one position filed twice — and collapsed into it.)
  const sct = hands.find((h: any) => h.st === "side-control/top")!
  expect(sct.pool.length, "side-control/top survivor pool").toBe(24)
  expect(sct.cards.length, "and every one of them is dealt").toBe(24)
  expect(sct.cards.filter((c: any) => c.ty === "transitions").length, "all 8 transitions, not one admitted card").toBe(8)
  const names = sct.cards.map((c: any) => c.t)
  expect(names, "the most-attempted move from side control is on screen").toContain("Side Control to Mount")
  expect(names, "so is the card the retired floor used to admit in its place").toContain("Side Control to Kesa Gatame")

  // and the biggest hand in the corpus is dealt whole
  const stand = hands.find((h: any) => h.st === "standing-position/top")!
  expect(stand.cards.length, "standing-position/top — the largest hand there is").toBe(34)
})

test("@curated the hand is ranked by EDGE, under a total order that is not node index", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const hands = await sweep(page)

  let numericTies = 0
  for (const h of hands) {
    // descending by the app's own ranking value; unvalued cards LAST, never mixed in as 0
    const vals = h.cards.map((c: any) => c.ord)
    const valued = vals.filter((v: any) => v != null)
    for (let i = 1; i < valued.length; i++)
      expect(valued[i], `${h.st}: card ${i + 1} outranks card ${i}`).toBeLessThanOrEqual(valued[i - 1])
    const firstNull = vals.indexOf(null)
    if (firstNull >= 0)
      expect(vals.slice(firstNull).every((v: any) => v == null), `${h.st}: a valued card sits below an unvalued one`).toBe(true)

    // THE TIEBREAK IS NOT INSERTION ORDER. `optionsFor` builds its list by walking `adj`, i.e. in
    // node-index order, and Array#sort is stable — so a comparator that can return 0 hands the
    // decision to the node index. Reversing the input and re-sorting reproduces the dealt order
    // ONLY if the comparator is a strict total order on this hand.
    expect(h.resorted.join("|"), `${h.st}: the order moved when the input was permuted`).toBe(
      h.cards.map((c: any) => c.t).join("|"),
    )
    expect(h.zeroPairs, `${h.st}: the comparator called two cards equal`).toBe(0)
    numericTies += h.numericTies
  }
  // ...and the name tiebreak is load-bearing, not decoration: without it these pairs tie
  expect(numericTies, "pairs that tie on EDGE, odds AND attempt% — what the name break decides").toBeGreaterThan(10)
})

test("@curated the printed number is the number the hand was ranked by", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const hands = await sweep(page)

  let printed = 0, exactTies = 0, printTies = 0
  for (const h of hands) {
    for (const c of h.cards) {
      if (c.print == null) { expect(c.raw, `${h.st}/${c.t}: no value means null, not 0`).toBeNull(); continue }
      // ONE quantity, two renderings: the corner integer is Math.round of the ranking value.
      // `+ 0` because Math.round(-0.2) is -0 in JS and edgeMark normalises it — a card must never
      // print "-0", and Object.is(-0, 0) is false, so the expectation has to normalise too.
      expect(c.print, `${h.st}/${c.t}: the corner number is not the sort key`).toBe(Math.round(c.ord) + 0)
      printed++
    }
    // ...so the printed integers can only descend as the eye goes down the hand
    const p = h.cards.map((c: any) => c.print).filter((x: any) => x != null)
    for (let i = 1; i < p.length; i++)
      expect(p[i], `${h.st}: printed ${p[i]} below ${p[i - 1]}`).toBeLessThanOrEqual(p[i - 1])

    // AN EXACT TIE ON SCREEN IS A TIE IN THE DATA, NEVER A CONSTANT IN THE CODE. This is the
    // shape of the bug this whole feature replaced: `movePotential` returned a flat 1 for every
    // submission, so ten side-control cards printed an identical +100 while their wire rows were
    // all different. Two cards may print the same integer as ROUNDING NEIGHBOURS (different raw
    // values) — but when the raw values are bit-identical, the wire rows behind them must be
    // identical too.
    const byRaw: Record<string, any[]> = {}
    const byPrint: Record<string, any[]> = {}
    for (const c of h.cards) {
      if (c.raw == null) continue
      ;(byRaw[String(c.raw)] = byRaw[String(c.raw)] || []).push(c)
      ;(byPrint[String(c.print)] = byPrint[String(c.print)] || []).push(c)
    }
    for (const k in byRaw) {
      const g = byRaw[k]
      if (g.length < 2) continue
      exactTies++
      for (const c of g) {
        expect(c.e0, `${h.st}: ${c.t} and ${g[0].t} print the same value from DIFFERENT wire rows`).toBe(g[0].e0)
        expect(c.c1, `${h.st}: ${c.t} and ${g[0].t} print the same value from DIFFERENT wire slopes`).toBe(g[0].c1)
      }
    }
    for (const k in byPrint) if (byPrint[k].length > 1) printTies++
  }
  expect(printed, "the corpus really does print EDGE").toBeGreaterThan(900)
  expect(exactTies, "exact ties exist, so the data-tie rule has something to bite on").toBeGreaterThan(10)
  expect(printTies, "and so do rounding neighbours").toBeGreaterThan(exactTies)
})

test("@curated a mid-decision JIT grade moves every number and no card", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const dom = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-tech]")].map((c: any) => ({
        t: c.getAttribute("data-tech"),
        valueLabel: c.querySelector("[data-choice-value]")?.textContent || null,
        odds: (c.querySelector(".ngodds") || {}).textContent || null,
      })),
    )

  const before = await dom()
  expect(before.length, "a hand is on the table").toBeGreaterThan(4)
  const order0 = before.map((c: any) => c.t).join("|")
  // drill a card from the MIDDLE of the hand — the promotion a player would actually see, and the
  // one a re-sort would carry past the cards their hand is already over
  const target = before[Math.floor(before.length / 2)].t

  const drill = await page.evaluate(async (t: string) => {
    const a = (window as any).__neural
    const n = a.nodes.find((x: any) => x.t === t)
    const key = a.deckKeyFor(n).key
    await a.hydrateDeck(key) // decks arrive on demand; an unhydrated stub grades nothing
    const cards = a._cardsOf(a.flashcards.decks[key]) || []
    // the real credit path: `prep` + noteCardDone is what mastery() reads and therefore what
    // moves moveChance. `_bumpStage` alone writes the SRS stage and would leave the odds put.
    for (const c of cards) { a.prep[key] = (a.prep[key] || 0) + 1; a.noteCardDone(c, key) }
    // asked BEFORE the refresh, off the untouched list: would a LIVE re-sort have moved this hand?
    const live = a._optList
      .map((o: any) => ({ t: o.node.t, v: a.orderScore(o) }))
      .sort((x: any, y: any) => (y.v == null ? -1 : x.v == null ? 1 : y.v - x.v))
      .map((x: any) => x.t)
      .join("|")
    a.refreshOptionOdds()
    return { cards: cards.length, bonus: a.stateBonus(key), live }
  }, target)

  expect(drill.cards, "the drilled deck was resident").toBeGreaterThan(0)
  expect(drill.bonus, "the grade bought real mastery").toBeGreaterThan(0)
  expect(drill.live, "a LIVE re-sort really would have moved this hand").not.toBe(order0)

  const after = await dom()
  expect(after.map((c: any) => c.t).join("|"), "the tray did not re-sort").toBe(order0)
  expect(
    (await page.evaluate(() => (window as any).__neural._optList.map((o: any) => o.node.t))).join("|"),
    "_optList — which the 1-9 keys index — did not re-sort either",
  ).toBe(order0)
  const moved = after.find((c: any) => c.t === target)!
  const was = before.find((c: any) => c.t === target)!
  expect(parseInt(moved.odds!, 10), "the drilled card's odds moved").toBeGreaterThan(parseInt(was.odds!, 10))
  expect(moved.valueLabel, "future win is a separately named model value").toContain("Win chance")
  // Numerical future-value updates and stale-profile rejection use controlled solver replies
  // in choice-value.spec.ts; this legacy fixture exercises the live immediate odds only.
})

test("@curated a submission's odds are its AUTHORED rate, not the 45.6% fallback", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  // 294 of 297 submissions used to miss the `cal` join (nested layout ids vs flat graph.json keys)
  // and priced through `moveChance`'s dominance fallback — `0.36 + dom*0.1`, which for a
  // submission's ~+0.9 attacker strength is 45-46% for ALL of them.
  const wire = await page.evaluate(() => {
    const a = (window as any).__neural
    // SITES, not members (v1.125.0): each submission is drawn as an attacker/defender pair, and
    // only the attacker owns the exchange, so only it carries `cal`. 298 since v1.156.0 authored
    // `Achilles Lock from Inside Ashi-Garami` — the first member of the only family hub that had
    // none, so nothing could reach it (an edge may not point at a family hub).
    const subs = a.nodes.filter((n: any) => n.ty === "submissions" && n.rep !== false)
    const cal = subs.map((n: any) => a.calSuccess(n))
    const rates = subs.filter((n: any, i: number) => cal[i] != null).map((n: any) => Math.round(a.calSuccess(n) * 100))
    // what the fallback WOULD have priced each of them at, had the join stayed broken
    const fb = subs.map((n: any) => Math.round((0.36 + n.dom * 0.1) * 100))
    return {
      n: subs.length,
      uncalibrated: cal.filter((c: any) => c == null).length,
      distinct: new Set(rates).size,
      min: Math.min(...rates), max: Math.max(...rates),
      outsideFallbackBand: rates.filter((r: number) => r < 44 || r > 47).length,
      fbDistinct: new Set(fb).size,
    }
  })
  expect(wire.n, "the corpus").toBe(290) // census:submissions
  expect(wire.uncalibrated, "every submission carries a calibrated rate").toBe(0)
  expect(wire.min, "authored rates run from").toBe(10)
  expect(wire.max, "...to").toBe(74)
  expect(wire.distinct, "and they discriminate — 37 distinct values").toBeGreaterThan(20)
  expect(wire.outsideFallbackBand, "270 of them are outside the fabricated 44-47% band").toBeGreaterThan(200)
  // the control: the fallback these replaced is nearly a constant, so this is a real difference
  expect(wire.fbDistinct, "the dominance fallback prices them all the same").toBeLessThan(6)

  // ...and it reaches the card. In the full game (v1.207.0) a submission card dealt on a POSITION
  // is an ENTRY: stepping into the finishing position is certain, so every one of them prints
  // "Entry 100%" — exactly one number, by design (the control below). The authored finishing rate
  // is what the FINISH card prints once you are in the submission, so that is where this claim now
  // lives: under the fallback, those finish cards would all sit inside a 2-point band.
  // Mutants, recorded 2026-09-29: a constant finish chance (choiceChance -> .5 on a finish) turns
  // the finish half red (six 50%s); calSuccess -> null turns the wire half red (uncalibrated).
  // Re-run on the built bundle at v1.212.5 (OCDEP1), each red at its own assertion:
  //   - choiceChance -> .5 on a finish: "do not all print one number" (six 50s);
  //   - moveChance priced through the dominance fallback for submissions: the same (six 33s);
  //   - moveChance + (idx % 4)·.03, a per-state term: distinct and span both PASS; only the
  //     printed − authored check catches it (shift spread 6);
  //   - boot() ignoring window.__NEURAL_RIG: "the pin reached this boot's opponent" (0.063).
  await j.land("Mount Top")
  const hand = await page.evaluate(() =>
    [...document.querySelectorAll('[data-choice-group="you"] [data-tech]')]
      .map((c: any) => ({
        t: c.getAttribute("data-tech"),
        label: ((c.querySelector("[data-immediate-label]") || {}).textContent || "").trim(),
        odds: parseInt(((c.querySelector(".ngodds") || {}).textContent || "0").replace("%", ""), 10),
      }))
      .filter((c: any) => ((window as any).__neural.nodes.find((n: any) => n.t === c.t) || {}).ty === "submissions"),
  )
  expect(hand.length, "mount top deals submissions").toBeGreaterThan(3)
  expect([...new Set(hand.map((c: any) => c.label + " " + c.odds))], "a submission dealt on a position is an Entry, certain").toEqual(["Entry 100"])
  // THE OPPONENT IS PINNED (v1.212.5, OCDEP1). A finish prints `moveChance` = authored rate − aiSkill
  // (the opponent-value term is 0 here: a submission defender's value is negative), and aiSkill =
  // 0.06 + rng("ai-skill")·0.14 is drawn ONCE PER BOOT, by the URL arrival's staged roll. Unpinned,
  // each of the six boots below subtracted its own random 6-20 points from a 16-point authored
  // span (58-74), and closed it to <= 8 on ~1.6% of runs (400,000 simulated draws, through the
  // app's own moveChance). Dev's first phase-2 deploy (run 36857244057) drew one of them: span 6,
  // with Rear Naked Choke at 54 = 74 − 20, the draw's ceiling. Nothing about the build decided it.
  // A post-boot `j.rig` is too late, because the arrival draws during boot, so the pin goes through
  // the production pre-boot rail (`window.__NEURAL_RIG`, read by boot()). The init script runs on
  // every boot below. CLAUDE.md §6.3: a tag the journey leaves unrigged is a lottery ticket.
  await page.addInitScript(() => { (window as any).__NEURAL_RIG = { "ai-skill": [0.5, 0.5, 0.5, 0.5] } })
  const finish: Record<string, number> = {}
  // printed − authored, per card: under one opponent this is ONE number for all six
  const shift: Record<string, number> = {}
  for (const url of [
    "/Submissions/Kimura/from-Mount/Attacker",
    "/Submissions/Armbar/from-Mount/Attacker",
    "/Submissions/Americana/from-Mount/Attacker",
    "/Submissions/Ezekiel-Choke/from-Mount/Attacker",
    "/Submissions/Triangle-Choke/from-Triangle-Control/Attacker",
    "/Submissions/Rear-Naked-Choke/from-Back-Control/Attacker",
  ]) {
    await j.boot(url)
    await j.advance(4000)
    const card = page.locator('[data-choice-group="you"] [data-choice-action="finish"]')
    await expect(card, url + " deals its finish").toHaveCount(1)
    await expect(card.locator("[data-immediate-label]")).toHaveText("Finish")
    finish[url] = parseInt(((await card.locator(".ngodds").textContent()) || "0").replace("%", ""), 10)
    // the authored rate of the node the app DEALT as the finish (its own option list, not a lookup)
    const live = await page.evaluate(() => {
      const a = (window as any).__neural
      const opt = (a._optList || []).find((o: any) => o.action === "finish")
      return { aiSkill: a.aiSkill, authored: opt ? Math.round(a.calSuccess(opt.node) * 100) : null }
    })
    expect(live.aiSkill, url + ": the pin reached this boot's opponent").toBeCloseTo(0.13, 9)
    expect(live.authored, url + ": the dealt finish has an authored rate").not.toBeNull()
    shift[url] = finish[url] - live.authored!
  }
  const odds = Object.values(finish)
  expect(new Set(odds).size, "the finish cards do not all print one number: " + JSON.stringify(finish)).toBeGreaterThan(2)
  expect(Math.max(...odds) - Math.min(...odds), "and they span more than the fallback's whole range").toBeGreaterThan(8)
  // THE CLAIM ITSELF: every printed finish is its authored rate moved by the SAME opponent. A
  // fallback, a constant, or a per-state term would each spread these shifts; 1 point allows only
  // integer rounding of the common shift. This does not re-derive the price: it compares the card
  // with the rate the app dealt it from.
  const shifts = Object.values(shift)
  expect(Math.max(...shifts) - Math.min(...shifts), "printed − authored is one number across the six: " + JSON.stringify(shift)).toBeLessThanOrEqual(1)
})
