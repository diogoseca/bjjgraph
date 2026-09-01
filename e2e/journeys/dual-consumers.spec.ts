import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type Any = any

/**
 * THE SPLIT IS A MODEL CHANGE, NOT A GAME ONE — AND EVERY ID-KEYED JOIN STILL LANDS (v1.126.0).
 *
 * v1.125.0 made the derived pair the DEFAULT: `ingest()` rewrites 1,467 hub nodes into 2,934
 * members before any index is built. Every consumer that had quietly assumed "one node per state"
 * or "the id in my table is a node id" is therefore joining against a different array — and the
 * dangerous ones fail SILENTLY, because they resolve to *a* node, just the wrong one.
 *
 * The worst of them is the EDGE table. `cal.ev` is keyed by NODE INDEX on both sides: the map key
 * is `<position node index>/<role>` and `blk[0]` is a list of TECHNIQUE node indexes. Nothing in
 * the format is self-describing, so if the remap were wrong the app would still find rows, still
 * print integers on the option cards, and print the WRONG technique's number on every one. No
 * exception, no console warning, no blank card. Journey 1 exists for exactly that, and it is a
 * DIFFERENTIAL — the same build, booted twice, once with `{ noPairs: true }` — because the only
 * trustworthy oracle for "did this join move?" is the graph the join was written against.
 *
 * THE CONTROL GROUP IS THE POINT, and it now has no other reason to exist. Until v1.158.1 it was
 * `?dual=legacy`, a query param that was also the visitor-facing escape hatch; the owner retired
 * the escape hatch and the param read path with it, so the app reads no parameter that can change
 * the render. The pre-split boot survives as `j.boot("/", { noPairs: true })`, reachable only from
 * the DSL. That was deliberate: retiring it outright would have left these journeys to be
 * rewritten against STORED expectations, and a stored expectation is written from the same reading
 * of the code it checks, so it agrees by construction (CLAUDE.md 6.3). A live differential does
 * not.
 *
 * ONE RULE FOR ADDING TO THIS FILE: **never assert a render by re-implementing its filter.** The
 * first pass of this audit measured Explore's search as `nodes.filter(n => n.rep && …)` — a
 * private copy with the fix already in it — and reported "identical" about a path that was
 * doubling every hit. The search journey drives `renderExplorer()` and counts real rows. Same
 * defect class as the six specs that held private copies of the node set in v1.125.0.
 */

/** Every state's identity, reduced to the SITE — the thing that used to be one node. */
const HARVEST = () =>
  (window as Any).__neural &&
  (() => {
    const a = (window as Any).__neural
    const site = (i: number) => (a.nodes[i].rep ? a.nodes[i].id : a.nodes[a.nodes[i].pi].id)
    const out: Any = { nodes: a.nodes.length, reps: a.nodes.filter((n: Any) => n.rep).length }

    // ── the hand, its EDGE rows, and the number each card prints ──────────────────────────
    const savedRole = a.playerRole,
      savedPos = a.currentPos
    const hands: Any = {}
    for (const s of a.nodes.filter((n: Any) => n.ty === "positions" && n.rep)) {
      for (const role of ["top", "bottom"]) {
        const idx = role === "top" || s.pi < 0 ? s.idx : s.pi
        a.playerRole = role
        a.currentPos = idx
        const opts = a.optionsFor(idx)
        if (!opts.length) continue
        hands[(s.posId || s.id) + "/" + role] = opts.map((o: Any) => ({
          id: site(o.idx),
          res: o.res >= 0 ? site(o.res) : null,
          // the raw EDGE row this card was dealt: e0 (value at the authored odds), c1 (slope),
          // att (attempt weight). A misaligned index scrambles these across the hand.
          ev: o.ev ? [o.ev.e0, o.ev.c1, o.ev.att] : null,
          // ...and the integer the card actually prints.
          mark: (() => {
            const m = a.edgeMark(o)
            return m ? m.i : null
          })(),
        }))
      }
    }
    a.playerRole = savedRole
    a.currentPos = savedPos
    out.hands = hands

    // ── every id-keyed table ──────────────────────────────────────────────────────────────
    const ord: Any = {}
    a._ordById.forEach((v: number, k: string) => (ord[k] = v))
    out.ordinals = ord
    out.explorer = (() => {
      const ex = a.buildExplorer()
      const o: Any = {}
      for (const [label, key] of ex.order) {
        const g = ex.groups[key]
        const fams = Object.keys(g).sort()
        o[label] = fams.map((f) => f + ":" + g[f].length)
      }
      return o
    })()
    // SEARCH, DRIVEN THROUGH THE REAL RENDER — not a private copy of its filter, which is exactly
    // how the missing `rep` check survived the first pass of this audit. A query walks
    // `this.nodes` directly (flat ranked results, no sections), so it does NOT inherit
    // buildExplorer's filter, and both halves of a pair carry the same title.
    out.search = (() => {
      const o: Any = {}
      const savedQ = a._exQ,
        savedV = a._viewMode
      a._viewMode = "explore"
      for (const q of ["kimura", "mount", "triangle", "guard"]) {
        a._exQ = q
        a.renderExplorer()
        const list = a.explorerListRef.current
        const head = (list && list.firstChild && list.firstChild.textContent) || ""
        const rows = list ? list.querySelectorAll("[data-list-add]").length : -1
        const titles = list
          ? [...list.querySelectorAll("[data-list-add]")].map((el: Any) =>
              (el.parentElement.textContent || "").trim(),
            )
          : []
        o[q] = { head: head.trim(), rows, dupes: titles.length - new Set(titles).size }
      }
      a._exQ = savedQ
      a._viewMode = savedV
      a.renderExplorer()
      return o
    })()
    out.deckKeys = a.nodes
      .filter((n: Any) => n.rep)
      .map((n: Any) => n.id + "=" + a.deckKeyFor(n).key)
    out.lessons = Object.keys(a._lessonIndex || {})
      .sort()
      .map((k) => {
        const i = a._lessonNodeIdx(k)
        return k + "=" + (i < 0 ? "?" : site(i))
      })
    out.curriculumFog = [...(a._curriculumIdxSet || [])].map(site).sort()
    a._posTraffic = null
    const traf = a.startPosTraffic()
    out.traffic = Object.keys(traf)
      .map((k) => site(+k) + ":" + Math.round(traf[k] * 1e9))
      .sort()
    out.names = a.nodes.filter((n: Any) => n.rep).map((n: Any) => a.displayName(n))
    return out
  })()

const harvest = (page: Page) => page.evaluate(HARVEST)

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. THE EDGE INDEX JOIN
// ══════════════════════════════════════════════════════════════════════════════════════════
test("@curated the EDGE node-index join survives the split: every card prints the same number", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  const pair = await harvest(page)
  await j.boot("/", { noPairs: true })
  const legacy = await harvest(page)

  // the control group really is the old graph, and the subject really is the new one
  // 1462/2924, not 1467/2934: v1.155.0 collapsed five moves authored as BOTH a transition and a
  // submission, so five SITES are gone (their ordinals retired, never reused). The invariant these
  // three lines exist for is untouched — legacy is one node per site, the default is exactly two
  // members per site, and both cover the same rep set.
  expect(legacy.nodes, "the noPairs control group is one node per site").toBe(1462)
  expect(pair.nodes, "the default is two members per site").toBe(2924)
  expect(pair.reps, "…over the same 1,462 sites").toBe(legacy.reps)

  const keys = Object.keys(legacy.hands)
  expect(keys.length, "every role-hand is dealt on both graphs").toBe(272)
  expect(Object.keys(pair.hands).sort()).toEqual(keys.sort())

  // THE JOIN. Card for card, in order: same technique, same landing, same ev row, same integer.
  // A wrong remap keeps the shape and moves the values, so comparing the whole structure is the
  // only assertion that catches it — a count or a null-check would pass on scrambled numbers.
  let cards = 0,
    marked = 0
  for (const k of keys) {
    expect(pair.hands[k], "the hand at " + k).toEqual(legacy.hands[k])
    cards += legacy.hands[k].length
    marked += legacy.hands[k].filter((c: Any) => c.mark !== null).length
  }
  expect(cards, "1,326 dealt cards compared").toBe(1326)
  // …and the table is genuinely being read. Without this the test would pass on a build where
  // `_ev` came back empty on BOTH graphs — every mark null, every comparison trivially equal.
  expect(marked, "…of which most carry a real EDGE from the table").toBeGreaterThan(1200)
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. THE HUB KEEPS ITS IDENTITY
// ══════════════════════════════════════════════════════════════════════════════════════════
test("@curated the hub keeps its identity: ordinals, Explore, deck keys, curriculum, names", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  const pair = await harvest(page)
  await j.boot("/", { noPairs: true })
  const legacy = await harvest(page)

  // ORDINALS ARE THE PROMISE. The rep member IS the hub node, so no ordinal is minted, none moves,
  // and no partner carries one — which is what lets every `/l/<code>` already posted resolve.
  // 1462 LIVE nodes carry an ordinal. node_ordinals.json still holds 1467 ASSIGNED — the five
  // collapsed sites are RETIRED and keep theirs forever so it can never be reissued — but a
  // retired id is not on the wire, so the app's map is the live count.
  expect(Object.keys(pair.ordinals).length, "1,462 live nodes carry a share ordinal").toBe(1462)
  expect(pair.ordinals, "…and not one of them moved").toEqual(legacy.ordinals)

  // EXPLORE LISTS SITES. Both halves carry the same title, so a member-level walk would print
  // every row of all three categories twice.
  expect(pair.explorer).toEqual(legacy.explorer)
  expect(pair.explorer.Positions.length, "136 position families, once each").toBe(136)

  // ...AND SO DOES SEARCH, which is a SEPARATE walk over `this.nodes` and so inherits nothing
  // from buildExplorer. Every hit was doubled, and the 120 cap then halved how many distinct
  // techniques a query could reach: "guard" matches 320 sites and could only ever show 60.
  expect(pair.search, "the same queries return the same results on both graphs").toEqual(legacy.search)
  for (const q of Object.keys(legacy.search)) {
    expect(pair.search[q].dupes, "no duplicate row in the results for “" + q + "”").toBe(0)
    expect(pair.search[q].rows, "“" + q + "” returns results").toBeGreaterThan(0)
  }
  expect(pair.search.guard.rows, "a broad query still fills its 120-row cap with 120 DISTINCT hits").toBe(120)

  // DECK KEYS, CURRICULUM FOG, LESSON NODES, THE FIRST-IMPRESSION DISTRIBUTION, QUALIFIED NAMES.
  expect(pair.deckKeys).toEqual(legacy.deckKeys)
  expect(pair.lessons).toEqual(legacy.lessons)
  expect(pair.lessons.filter((s: string) => s.endsWith("=?")).length, "every lesson resolves").toBe(0)
  expect(pair.curriculumFog).toEqual(legacy.curriculumFog)
  expect(pair.traffic).toEqual(legacy.traffic)
  expect(pair.traffic.length, "the weighted start pool is still 136 POSITIONS").toBe(136)
  // `_ambig` counts sites: counting members puts every short name at >= 2 and `displayName`
  // prints the full qualified name on every card — the exact inverse of the v1.103.0 rule.
  expect(pair.names).toEqual(legacy.names)
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. A LINK POSTED BEFORE THE SPLIT
// ══════════════════════════════════════════════════════════════════════════════════════════
test("a share code minted on the hub graph opens the same class on the paired one", async ({
  page,
}) => {
  const j = journey(page)

  // Mint on the noPairs control group — literally the pre-split app — then open it on the default.
  await j.boot("/", { noPairs: true })
  const minted = await page.evaluate(() => {
    const a = (window as Any).__neural
    const ids = a.nodes
      .filter((n: Any) => n.rep)
      .slice(0, 400)
      .filter((_: Any, i: number) => i % 37 === 0)
      .map((n: Any) => n.id)
    const enc = (window as Any).NGLists.ngListEncodeIds(ids, a._ordinalById())
    return { ids, code: enc.code, missing: enc.missing.length }
  })
  expect(minted.missing, "every id had an ordinal to encode").toBe(0)
  expect(minted.ids.length).toBeGreaterThan(5)

  await j.boot("/")
  const opened = await page.evaluate((code: string) => {
    const a = (window as Any).__neural
    const site = (i: number) => (a.nodes[i].rep ? a.nodes[i].id : a.nodes[a.nodes[i].pi].id)
    const dec = (window as Any).NGLists.ngListDecodeIds(code, a._ordinalIndex())
    return {
      ok: dec.ok,
      ids: dec.ids || [],
      unknown: (dec.unknown || []).length,
      // …and every one of them lands on a node, which is what the recipient path lights
      lit: (dec.ids || [])
        .map((id: string) => a._idIndex.get(id))
        .filter((i: Any) => i != null)
        .map(site),
    }
  }, minted.code)

  // SET, not sequence: the wire is sorted-unique ordinals by construction (that is what makes a
  // code canonical), so a decode returns ordinal order and never the coach's typing order.
  const want = minted.ids.slice().sort()
  expect(opened.ok, "the code decodes on the paired graph").toBe(true)
  expect(opened.unknown, "no ordinal in it is unknown to this build").toBe(0)
  expect(opened.ids.slice().sort(), "…and it names the identical techniques").toEqual(want)
  expect(opened.lit.slice().sort(), "…each of which resolves to its site").toEqual(want)

  // The encoding is canonical, so the same set has exactly one spelling — re-minting it on the
  // paired graph must produce the byte-identical code, or two devices would disagree about a
  // `share_id` and the funnel would split in half.
  const reminted = await page.evaluate(
    (ids: string[]) =>
      (window as Any).NGLists.ngListEncodeIds(ids, (window as Any).__neural._ordinalById()).code,
    minted.ids,
  )
  expect(reminted, "one set of nodes, one spelling, on either graph").toBe(minted.code)
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3b. …AND A LINK MINTED AFTER IT, FROM THE LOWER HALF
// ══════════════════════════════════════════════════════════════════════════════════════════
test("@curated capturing while you play bottom still produces a shareable class", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(() => {
    const a = (window as Any).__neural
    // Stand on the LOWER half of three sites — a coach playing bottom, which is half of
    // jiu-jitsu — and capture from there. `addToList` is the writer every capture surface
    // reaches (the picker's create-and-file included).
    const lower = a.nodes.filter((n: Any) => !n.rep && n.pi >= 0).slice(0, 300)
    const picked = [lower[0], lower[100], lower[200]]
    for (const n of picked) a.addToList(n.id)
    const list = a.activeList()
    const enc = (window as Any).NGLists.ngListEncodeIds(list.items, a._ordinalById())
    return {
      captured: picked.map((n: Any) => n.id),
      stored: list.items.slice(),
      // …and the membership readers agree, or the button would show + on a captured technique
      seenFromMember: picked.map((n: Any) => a.nodeInAnyList(n.id)),
      code: enc.code,
      missing: enc.missing,
      decoded: (() => {
        const d = (window as Any).NGLists.ngListDecodeIds(enc.code, a._ordinalIndex())
        return d.ok ? d.ids : null
      })(),
    }
  })

  // THE DEFECT THIS PINS: a partner id (`<hub>/Bottom`) has no share ordinal — 0 of 1467 do — so
  // storing one drops the technique from the code SILENTLY, and a one-item list of it encodes to
  // the empty string. A list holds SITES; `siteIdOf` is where that is enforced.
  expect(r.captured.every((id: string) => /\/(Bottom|Defender)$/.test(id)), "captured from the lower half").toBe(true)
  expect(r.stored.every((id: string) => !/\/(Bottom|Defender)$/.test(id)), "…stored as sites: " + JSON.stringify(r.stored)).toBe(true)
  expect(r.stored.length, "three techniques, three items").toBe(3)
  expect(r.seenFromMember, "…and the member still reads as captured").toEqual([true, true, true])
  expect(r.missing, "every stored id has an ordinal to encode").toEqual([])
  expect(r.code.length, "…so the class has a real share code").toBeGreaterThan(4)
  expect(r.decoded, "…that round-trips to the same three sites").toEqual(r.stored.slice().sort())
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. WHICH HALF YOU STAND ON IS NOT A GAME STATE
// ══════════════════════════════════════════════════════════════════════════════════════════
test("the hand is identical from either half of a site", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(() => {
    const a = (window as Any).__neural
    const site = (i: number) => (a.nodes[i].rep ? a.nodes[i].id : a.nodes[a.nodes[i].pi].id)
    const savedR = a.playerRole,
      savedP = a.currentPos
    let same = 0
    const differ: Any[] = []
    for (const s of a.nodes.filter((n: Any) => n.ty === "positions" && n.rep)) {
      if (s.pi < 0) continue
      for (const role of ["top", "bottom"]) {
        a.playerRole = role
        const f = (i: number) => {
          a.currentPos = i
          return JSON.stringify(
            a.optionsFor(i).map((o: Any) => [
              site(o.idx),
              o.ev ? [o.ev.e0, o.ev.c1, o.ev.att] : null,
              a.edgeMark(o) ? a.edgeMark(o).i : null,
            ]),
          )
        }
        if (f(s.idx) === f(s.pi)) same++
        else differ.push([s.id, role])
      }
    }
    a.playerRole = savedR
    a.currentPos = savedP
    return { same, differ: differ.slice(0, 5), differCount: differ.length }
  })

  // This is why `adj` must NOT be role-split (see `_deriveDualPairs`, link kind 2). Several
  // readers walk `adj[currentPos]` with no role filter deliberately — `opponentDefend` most of
  // all — so both halves of a site must see the same neighbourhood. Making it true by
  // construction is worth more than making it true by testing, but it is worth testing too.
  expect(r.differCount, "no hand depends on which orb you are standing on: " + JSON.stringify(r.differ)).toBe(0)
  expect(r.same, "…over all 272 role-hands").toBe(272)
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. A TECHNIQUE IS NOT A STATE YOU CAN STAND IN
// ══════════════════════════════════════════════════════════════════════════════════════════
test("@curated every technique seats a roll at its canonical origin, on the side that performs it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(() => {
    const a = (window as Any).__neural
    const site = (i: number) => (a.nodes[i].rep ? a.nodes[i].id : a.nodes[a.nodes[i].pi].id)
    const savedR = a.playerRole,
      savedP = a.currentPos
    const stageTy: Any = {}
    let sideOk = 0,
      sideBad = 0,
      inHand = 0,
      notInHand = 0
    const bad: Any[] = []
    for (const n of a.nodes) {
      if (n.ty === "positions") continue
      const o = a.techniqueOrigin(n)
      const ty = o.idx < 0 ? "NONE" : a.nodes[o.idx].ty
      stageTy[ty] = (stageTy[ty] || 0) + 1
      if (o.idx < 0) continue
      const fr = String(n.fromRole || "").toLowerCase()
      const want = n.role === "defender" ? (fr === "top" ? "bottom" : "top") : fr
      o.role === want ? sideOk++ : sideBad++
      if (n.role === "defender") continue
      a.playerRole = o.role || "top"
      a.currentPos = o.idx
      const hand = a.optionsFor(o.idx).map((x: Any) => site(x.idx))
      if (hand.indexOf(site(n.idx)) >= 0) inHand++
      else {
        notInHand++
        if (bad.length < 6) bad.push([n.id, site(o.idx), o.role])
      }
    }
    a.playerRole = savedR
    a.currentPos = savedP
    return { stageTy, sideOk, sideBad, inHand, notInHand, bad }
  })

  // EVERY technique member — 1,331 attackers and 1,331 defenders — seats at a POSITION. Before
  // v1.126.0 `rollFromPosition` walked `adj[]` for the first position it met, and a defender
  // member has no position in its adjacency at all (its edges live one-for-one on the attacker),
  // so 1,331 of 2,934 nodes staged a roll ON A TECHNIQUE NODE — one graph tap away.
  expect(r.stageTy.NONE, "no technique fails to find an origin").toBeUndefined()
  expect(r.stageTy.transitions, "and none seats you inside a transition").toBeUndefined()
  expect(r.stageTy.submissions, "…or inside a submission").toBeUndefined()
  // 2652 = 2 x 1326 techniques (was 2 x 1331). A COVERAGE FLOOR, not a structural claim: the
  // three assertions above are the gate, and this one proves they were applied to every member.
  expect(r.stageTy.positions, "all 2,652 technique members seat at a position").toBe(2652)
  expect(r.sideBad, "…on the side that performs it, defenders flipped").toBe(0)

  // AND THE POINT OF IT: the technique you tapped is in the hand you are dealt. The adj-walk
  // managed 421 of 1,331 (31.6%) — on the paired graph AND on the pre-split one alike, so this was a
  // pre-existing defect the split exposed rather than caused. The 5 that still miss are content
  // (`from_position_role_mismatch`), not code; the assertion is a floor so a content fix cannot
  // break the gate, but it is far above what a regression would leave.
  expect(r.notInHand, "at most the known content misses: " + JSON.stringify(r.bad)).toBeLessThanOrEqual(5)
  expect(r.inHand, "1,326 of 1,331 techniques are dealt from where they seat you").toBe(1326)
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. THE ADDRESS BAR AND THE GRAPH TAP AGREE
// ══════════════════════════════════════════════════════════════════════════════════════════
test("both perspective pages of a technique resolve, and the Defender page plays the defender", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(() => {
    const a = (window as Any).__neural
    const site = (i: number) => (a.nodes[i].rep ? a.nodes[i].id : a.nodes[a.nodes[i].pi].id)
    const res: Any = { att: { n: 0, ok: 0 }, def: { n: 0, ok: 0 }, mirror: 0, sample: [] }
    for (const n of a.nodes) {
      if (!n.rep || n.ty === "positions" || n.id.indexOf("%") >= 0) continue
      const fr = String(n.fromRole || "").toLowerCase()
      const flip = fr === "top" ? "bottom" : "top"
      const A = a._nodeAndRoleForPath("/" + n.id + "/Attacker")
      const D = a._nodeAndRoleForPath("/" + n.id + "/Defender")
      res.att.n++
      res.def.n++
      if (A.idx >= 0 && A.role === fr) res.att.ok++
      if (D.idx >= 0 && D.role === flip) res.def.ok++
      // the two perspectives of one technique are the two halves of ONE site
      if (A.idx >= 0 && D.idx >= 0 && site(A.idx) === site(D.idx)) res.mirror++
      if (res.sample.length < 3) res.sample.push([n.id, fr, A.role, D.role, site(A.idx)])
    }
    return res
  })

  // Both are real built pages (`content/Transitions/<x>/{Attacker,Defender}.md`). Before v1.126.0
  // the Attacker page resolved to NOTHING — the attacker member IS the hub and carries the bare
  // id, so `/X/Attacker` matched no id and no regex — while the Defender page resolved and seeded
  // the ATTACKER's side, 1,330 of 1,330: the page says you are the one being armbarred and the
  // app dealt you the armbar.
  expect(r.att.ok, "every Attacker page seats the performing side").toBe(r.att.n)
  expect(r.def.ok, "every Defender page seats the OTHER side").toBe(r.def.n)
  expect(r.mirror, "…and both name the same origin site").toBe(r.att.n)
  // 1,325 and not 1,330, for the same reason the three counts above moved: v1.155.0 collapsed five
  // moves authored as BOTH a transition and a submission, so five technique PAGES are gone with
  // them. v1.155.2 followed the collapse through this file and this literal was the one it missed —
  // and it went unseen because a push to dev runs no e2e, so the next PR is where it surfaces.
  // Derive it, never guess it: 1,462 wire nodes − 136 positions − game-over = 1,325.
  expect(r.att.n, "over every technique page in the corpus").toBe(1325)
})
