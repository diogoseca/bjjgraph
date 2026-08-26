import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * EDGE — the option card's corner number, and the order of the hand (v1.118.0).
 *
 * EDGE = 100 × ( Q(s,a) − B(s) ), B(s) = Σ attempt%(a′)·Q(s,a′): how much better or worse this
 * move is than the ORDINARY choice from where you are standing, counting not just whether it
 * works but where a miss leaves you. 0 is not "no value" — it IS "the normal thing to do here".
 *
 * The wire (v1.117.0) ships the LINE, not the point — `cal.ev[role] = [nodeIdxs, attemptPct,
 * ...[e0,c1] per evLam]` — because `moveChance` is not a constant. Everything below is measured
 * against that wire, never against a number this spec invents.
 *
 * Surfaces pinned here:
 *   .ngedge      — the card's corner integer
 *   .ngglyph     — the category glyph, whose COLOUR is now the same channel
 *   .ngedgebig   — the option-detail sheet's enlarged copy of the same value
 */

/** Pin every technique to its own authored (evFrame) rate, so moveChance(n) === p0(n) exactly and
 *  no modifier — drilling, momentum, the opponent's resistance — is in the picture. NB
 *  `successOverride` matches by TITLE and titles repeat across origins, so a handful of nodes
 *  resolve to a sibling's rate; that leaves a sub-0.02 residual in the raw value and never moves
 *  the displayed integer, which is what is asserted. */
async function atRest(page: any) {
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.userMods = a.nodes
      .map((n: any) => {
        const p0 = a._evP0(n);
        return p0 == null
          ? null
          : { on: true, name: n.t, pct: Math.round(p0 * 100) };
      })
      .filter(Boolean);
    a.refreshOptionOdds();
  });
}

const cardEdges = (page: any) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-tech]")].map((c: any) => ({
      tech: c.getAttribute("data-tech"),
      // the node's real type, so the caption can be checked PER CARD rather than against one
      // constant — a build that printed "Transition" on everything would otherwise pass
      ty: (() => {
        const a: any = (window as any).__neural;
        const o = (a._optList || []).find((x: any) => x.node && x.node.t === c.getAttribute("data-tech"));
        return o && o.node ? o.node.ty : null;
      })(),
      mid:
        // v1.134.0: the category eyebrow dropped to .05em tracking and gained its own handle
        (c.querySelector("[data-cat]") || {}).textContent || "",
      edge: c.querySelector(".ngedge")
        ? c.querySelector(".ngedge").textContent
        : null,
      edgeCol: c.querySelector(".ngedge")
        ? c.querySelector(".ngedge").style.color
        : null,
      glyphFilter: c.querySelector(".ngglyph")
        ? c.querySelector(".ngglyph").style.filter
        : null,
      odds: (c.querySelector(".ngodds") || {}).textContent || null,
    })),
  );

/** Land, then flip the roll to the BOTTOM side of the same position — every position hub is titled
 *  "… Top" (the visual layer collapses the pair), so the side is `playerRole`, not the name.
 *  `j.land` rigs role=top; the tests that need the other half read the hand through `optionsFor`,
 *  which is the same seam `enterLand` deals from. `aiSkill` is pinned to the journeys' rigged 0.13
 *  so the opponent's contribution to `moveChance` is a fixed, stateable number. */
async function landBottom(j: any, page: any, position: string) {
  await j.land(position);
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.playerRole = "bottom";
    a.aiSkill = 0.13;
  });
}

test("@curated at the authored odds the card IS the published value — Frame -12, Escape +18", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await landBottom(j, page, "Side Control Top");
  await atRest(page);

  const rows = await page.evaluate(() => {
    const a = (window as any).__neural;
    return a.optionsFor(a.currentPos).map((o: any) => ({
      t: o.node.t,
      edge: a.edgeMark(o) ? a.edgeMark(o).i : null,
      e0: o.ev ? o.ev.e0 : null,
      odds: Math.round(a.moveChance(o.node) * 100),
    }));
  });

  // EVERY valued card is exactly the integer the build-time solve published — no drift, no round
  for (const r of rows)
    if (r.e0 != null) expect(r.edge, `${r.t} at rest`).toBe(r.e0);

  // the spec's two worked examples, by name
  const frame = rows.find((r: any) => r.t === "Frame from Side Control");
  const esc = rows.find((r: any) => r.t === "Side Control Escape");
  expect(
    frame,
    "Frame from Side Control is dealt from side-control/bottom",
  ).toBeTruthy();
  expect(
    frame.edge,
    "the most-attempted move from here is the worst card on the board",
  ).toBe(-12);
  expect(esc.edge, "Side Control Escape").toBe(18);
  expect(esc.odds).toBe(60);
  expect(frame.odds).toBe(50);

  // `p0` is the SOLVE's frame, NEVER the active ruleset. A real browser reads `bjj_gi_mode` and
  // defaults to gi; 140 wire entries carry a gi rate that differs from the frame the table was
  // solved in (no-gi), so anchoring on `calSuccess` would put those cards off their published
  // value at rest, with no drill and no modifier in sight. `_giMode` is set explicitly here
  // because under test it stays lazy until something builds the explorer.
  const anchor = await page.evaluate(() => {
    const a = (window as any).__neural;
    a._giMode = "gi";
    for (const n of a.nodes) {
      const br = (n.cal || {}).successRateByRuleset;
      if (!br || br.gi == null || br.gi === n.cal.successRate) continue;
      return {
        gi: br.gi,
        frame: n.cal.successRate,
        p0: a._evP0(n),
        cal: a.calSuccess(n),
      };
    }
    return null;
  });
  expect(
    anchor,
    "a gi-divergent node exists to test the anchor on",
  ).toBeTruthy();
  expect(
    anchor!.cal! * 100,
    "calSuccess follows the ACTIVE ruleset",
  ).toBeCloseTo(anchor!.gi, 6);
  expect(anchor!.p0! * 100, "p0 follows the SOLVE's frame instead").toBeCloseTo(
    anchor!.frame,
    6,
  );
  expect(
    anchor!.p0,
    "and the two really do differ on this node",
  ).not.toBeCloseTo(anchor!.cal!, 6);
});

test("@curated the baseline moves with the hand: EDGE stays a DIFFERENCE at live odds", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await landBottom(j, page, "Side Control Top");

  // No overrides: this is a real mid-roll hand, where `moveChance` subtracts the opponent's
  // resistance — a per-STATE shift that hits every card. At side-control/bottom it measures
  // ~26pp. EDGE is a DIFFERENCE against the ordinary choice, so a shift shared by the whole hand
  // must not push the whole hand one way: Σ att·EDGE / Σ att stays 0, by definition of zero.
  const m = await page.evaluate(() => {
    const a = (window as any).__neural;
    const opts = a.optionsFor(a.currentPos).filter((o: any) => o.ev);
    let w = 0,
      s = 0;
    const edges = [];
    for (const o of opts) {
      const e = a.moveEdge(o);
      w += o.ev.att;
      s += o.ev.att * e;
      edges.push(e);
    }
    const p0 = a._evP0(opts[0].node);
    return {
      wmean: s / w,
      shift: a.moveChance(opts[0].node) - p0,
      positives: edges.filter((e: number) => e > 0).length,
      n: edges.length,
    };
  });
  expect(
    Math.abs(m.shift),
    "the opponent really is shifting these odds",
  ).toBeGreaterThan(0.15);
  expect(
    Math.abs(m.wmean),
    "Σ att·EDGE / Σ att == 0 — that is what zero MEANS",
  ).toBeLessThan(1.5);
  expect(
    m.positives,
    "a hand cannot be entirely worse than its own average",
  ).toBeGreaterThan(0);
});

test("the card FACE labels the number opposite it", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const cards = await cardEdges(page);
  expect(cards.length).toBeGreaterThan(0);
  let labelled = 0;
  for (const c of cards) {
    if (c.edge == null) continue;
    // v1.129.1, OWNER'S DECISION: the middle slot names the move's KIND again (the pre-v1.118.0
    // face) — "'edge' doesn't give us any information saying that. I'd rather you say 'submission
    // position transition'". The corner number is bare on the card face as a result; that
    // trade-off is recorded at `headMid`. Asserted per-type so a build that prints one constant
    // for everything still fails.
    expect(
      c.mid.trim(),
      `${c.tech} names what kind of move it is`,
    ).toBe(c.ty === "submissions" ? "Submission" : c.ty === "positions" ? "Position" : "Transition");
    expect(c.edge, `${c.tech} renders a signed integer`).toMatch(/^[+-]?\d+$/);
    expect(c.edge, "never -0").not.toBe("-0");
    labelled++;
  }
  expect(labelled, "the hand carried EDGE cards at all").toBeGreaterThan(3);
});

test("@curated the submissions constant is gone: the hand is ranked, not alphabetical", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const titles = await j.optionTitles();
  // HEAD dealt eight submissions in ALPHABETICAL order, because movePotential returned a flat 1
  // for every one of them. Americana → Armbar → Cross Collar → Ezekiel → Kimura → ... is that
  // signature; the ranked hand opens on the best-EDGE card instead.
  const subsInOrder = await page.evaluate(() => {
    const a = (window as any).__neural;
    const t = [...document.querySelectorAll("[data-tech]")].map((c: any) =>
      c.getAttribute("data-tech"),
    );
    const subs = t.filter(
      (x: string) =>
        (a.nodes.find((n: any) => n.t === x) || {}).ty === "submissions",
    );
    return subs.join("|") === subs.slice().sort().join("|") && subs.length >= 5;
  });
  expect(
    subsInOrder,
    "submissions are no longer dealt in alphabetical order",
  ).toBe(false);

  // THE RANK KEY IS THE DISPLAYED NUMBER. This is the assertion the deleted constant cannot
  // survive: with `return 1` back, every submission's `ord` is 1 while its card shows +6, +5, +5…
  // — the ranking and the number would be describing different things again.
  const keyed = await page.evaluate(() =>
    (window as any).__neural._optList.map((o: any) => ({
      t: o.node.t,
      ord: o.ord,
      edge: (window as any).__neural.moveEdge(o),
    })),
  );
  for (const k of keyed)
    expect(k.ord, `${k.t}: the sort key IS the EDGE the card prints`).toBe(
      k.edge,
    );

  // sorted by that value, descending; unvalued cards LAST, never mixed in as if they were 0
  const vals = keyed.map((k: any) => k.ord);
  const valued = vals.filter((v: number | null) => v != null);
  for (let i = 1; i < valued.length; i++)
    expect(
      valued[i],
      `card ${i} ranks below card ${i - 1}`,
    ).toBeLessThanOrEqual(valued[i - 1]);
  const firstNull = vals.indexOf(null);
  if (firstNull >= 0)
    expect(vals.slice(firstNull).every((v: any) => v == null)).toBe(true);

  expect(titles[0], "the hand opens on its best-EDGE card").toBe(
    "Kimura from Mount",
  );
});

test("@curated a JIT grade moves the numbers and NEVER the order", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const before = await cardEdges(page);
  const order0 = before.map((c: any) => c.tech).join("|");
  // Drill the LAST VALUED card — the one whose promotion would be most visible.
  //
  // "last in the hand" was the same thing until v1.123.0 lifted the cap: Mount Top used to deal
  // 10 cards and now deals 16, and its final three (Cross Collar Choke, Gift Wrap, Loop Choke)
  // carry NO wire row, so they print no number at all. That is the deliberate "unvalued LAST and
  // never as 0" rule, not a gap — and an unvalued card cannot demonstrate an EDGE that MOVES,
  // which is this journey's whole subject. Asserted below, so the day the corpus values them the
  // spec says so instead of quietly drilling a different card.
  const valued = before.filter((c: any) => Number.isFinite(parseInt(c.edge, 10)));
  expect(valued.length, "the hand has valued cards to drill").toBeGreaterThan(0);
  expect(
    valued.length,
    "and some of Mount Top's hand is legitimately unvalued — the tail this skips",
  ).toBeLessThan(before.length);
  const last = valued[valued.length - 1];
  const target = last.tech;
  const e0 = last.edge;
  const targetIdx = before.findIndex((c: any) => c.tech === target);

  const drill = await page.evaluate(async (t: string) => {
    const a = (window as any).__neural;
    const n = a.nodes.find((x: any) => x.t === t);
    const key = a.deckKeyFor(n).key;
    // exactly what a JIT drill does: this move's own deck must be RESIDENT before grading it —
    // decks arrive on demand (v1.80.4) and an unhydrated stub grades nothing, which would make
    // this whole journey a no-op that passes.
    await a.hydrateDeck(key);
    const cards = a._cardsOf(a.flashcards.decks[key]) || [];
    // `prep` is what `mastery()` reads (0.03/card, capped 0.15); `_bumpStage` writes the SRS
    // stage and would leave the odds — and therefore the EDGE — exactly where they were.
    for (const c of cards) {
      a.prep[key] = (a.prep[key] || 0) + 1;
      a.noteCardDone(c, key);
      a._bumpStage(key, c.q, 4);
    }
    // WOULD a live re-sort have moved this hand? Asked BEFORE the refresh, off the untouched
    // list, so it reports what the new odds imply rather than what the refresh may have done.
    // If the answer were "no", the freeze would be untested and this journey decoration.
    const live = a._optList
      .map((o: any) => ({ t: o.node.t, v: a.orderScore(o) }))
      .sort((x: any, y: any) =>
        y.v == null ? -1 : x.v == null ? 1 : y.v - x.v,
      )
      .map((x: any) => x.t)
      .join("|");
    a.refreshOptionOdds();
    return { cards: cards.length, bonus: a.stateBonus(key), live };
  }, target);

  expect(drill.cards, "the drilled deck was resident").toBeGreaterThan(0);
  expect(
    drill.live,
    "a LIVE re-sort really would have moved this hand",
  ).not.toBe(order0);

  const after = await cardEdges(page);
  expect(
    after.map((c: any) => c.tech).join("|"),
    "the tray did not re-sort",
  ).toBe(order0);
  expect(
    (
      await page.evaluate(() =>
        (window as any).__neural._optList.map((o: any) => o.node.t),
      )
    ).join("|"),
    "_optList — which the 1-9 keys index — did not re-sort either",
  ).toBe(order0);
  const now = after[targetIdx];
  expect(now.tech).toBe(target);
  expect(
    parseInt(now.edge, 10),
    "the drilled card's EDGE moved",
  ).toBeGreaterThan(parseInt(e0, 10));
});

test("three marks, two channels: the glyph wears the corner number's colour", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const cards = await cardEdges(page);
  let checked = 0;
  for (const c of cards) {
    if (!c.edge || !c.edgeCol || !c.glyphFilter) continue;
    // the glyph's drop-shadow is the SAME colour as the number (alpha 0x70 → 0.44)
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c.glyphFilter);
    const n = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c.edgeCol);
    expect(m && n, `${c.tech} paints both marks`).toBeTruthy();
    expect([m![1], m![2], m![3]].join(","), `${c.tech}: glyph == corner`).toBe(
      [n![1], n![2], n![3]].join(","),
    );
    checked++;
  }
  expect(checked, "cards actually carried both marks").toBeGreaterThan(3);
});

test("a move the table cannot value shows NO number — never a fabricated 0", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await landBottom(j, page, "Side Control Top");

  const probe = await page.evaluate(() => {
    const a = (window as any).__neural;
    const opts = a.optionsFor(a.currentPos);
    const unvalued = opts.filter((o: any) => !o.ev);
    const zero = opts.filter(
      (o: any) => o.ev && a.edgeMark(o) && a.edgeMark(o).i === 0,
    );
    return {
      unvalued: unvalued.map((o: any) => o.node.t),
      unvaluedEdge: unvalued.map((o: any) => a.moveEdge(o)),
      // a genuinely-zero card, found anywhere in the corpus, still renders its 0
      zeroSomewhere: (() => {
        for (let pi = 0; pi < a.nodes.length; pi++) {
          if (a.nodes[pi].ty !== "positions" || !a.nodes[pi].posId) continue;
          for (const role of ["top", "bottom"]) {
            if (!a._ev.get(pi + "/" + role)) continue;
            a.currentPos = pi;
            a.playerRole = role;
            for (const o of a.optionsFor(pi)) {
              const m = o.ev && a.edgeMark(o);
              if (m && m.i === 0) return { t: o.node.t, txt: m.txt };
            }
          }
        }
        return null;
      })(),
      zeroHere: zero.length,
    };
  });
  expect(
    probe.unvalued.length,
    "this hand really does deal cards the table cannot value",
  ).toBeGreaterThan(0);
  for (const v of probe.unvaluedEdge)
    expect(v, "no value means null, not 0").toBeNull();
  expect(
    probe.zeroSomewhere,
    "a genuinely-zero EDGE exists and prints",
  ).toBeTruthy();
  expect(probe.zeroSomewhere!.txt).toBe("0");
});

test("the sheet's enlarged head cannot contradict the card it grew from", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const cards = await cardEdges(page);
  const first = cards.find((c: any) => c.edge != null)!;
  await page.locator(`[data-tech="${first.tech}"]`).first().click();
  const big = page.locator(".ngedgebig");
  await expect(big, "the sheet carries the same value").toHaveText(first.edge!);
  const bigCol = await big.evaluate((el: any) => el.style.color);
  expect(bigCol).toBe(first.edgeCol);
});

/* ── THE `cardOrder` SETTING IS RETIRED (v1.122.0) ─────────────────────────────────────────────
 *
 * It offered Potential / Popularity. `orderScore` forked on it; `edgeMark` did not. So choosing
 * Popularity ranked the tray by `movePopularity` — a placeholder pick-rate estimate, jittered by a
 * `Math.sin` hash — while every card went on printing its EDGE. Measured before the fix over the
 * 270 live role-hands: 211 printed their corner integers OUT of descending order, worst
 * `back-control/bottom` at [-6,-20,+6,+8,-2,+14,+17,+19] with the +19 card dealt LAST. One
 * settings click from the default, and precisely the "a legitimate ranking reads as a bug" failure
 * the `Edge` caption exists to prevent.
 *
 * The owner retired the setting rather than repair the second mode, and the reason is measurable:
 * across those same 270 hands the choice changed the dealt SET in 16 and re-ordered 223 — control
 * over the ORDER of almost everything and over the action space of almost nothing.
 *
 * A settings key cannot be deleted from a synced blob (`_pullAndMerge` has no tombstone — see the
 * note on `orderScore`), so `cardOrder` stays DORMANT in old profiles. These journeys therefore
 * boot a profile that really has `cardOrder:"popularity"` saved and prove it changes nothing. */

/** Every live role-hand, with the two quantities that must not be allowed to disagree: the value
 *  the hand was RANKED by (`orderScore`) and the value each card PRINTS (`edgeMark` → `moveEdge`).
 *  Pinned the way `option-hand`'s sweep is — fixed aiSkill, no user mods, a state key that carries
 *  no drilling bonus — so nothing here depends on what an earlier journey touched. */
const RANKWALK = `(() => {
  const a = window.__neural;
  a.aiSkill = 0.13; a.userMods = null;
  const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
  a._posKey = "__rankwalk__";
  const out = [];
  for (let pi = 0; pi < a.nodes.length; pi++) {
    const p = a.nodes[pi];
    if (p.ty !== "positions" || !p.posId) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = pi; a.playerRole = role;
      // marks MUST be read while currentPos/playerRole are still set: moveChance reads oppVal of
      // the CURRENT position, which is the per-state handicap EDGE's baseline cancels
      const dealt = a.optionsFor(pi);
      if (dealt.length < 2) continue;
      out.push({
        st: p.posId + "/" + role,
        order: dealt.map((o) => o.node.t),
        // bit-identical or bust — null included, since "no value on the wire" is not 0
        split: dealt.filter((o) => a.orderScore(o) !== a.moveEdge(o)).map((o) => o.node.t),
        print: dealt.map((o) => (a.edgeMark(o) ? a.edgeMark(o).i : null)).filter((v) => v != null),
      });
    }
  }
  a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
  return out;
})()`;

const rankwalk = (page: any) => page.evaluate(RANKWALK);

/** the ascending steps in a hand's printed integers — the contradiction, counted */
const outOfOrder = (hands: any[]) =>
  hands.filter((h) =>
    h.print.some((v: number, i: number) => i > 0 && v > h.print[i - 1]),
  );

test("@curated a saved cardOrder=popularity cannot rank the hand — the setting is retired", async ({
  page,
}) => {
  const j = journey(page);
  // a REAL returning profile: the key is in the blob, with a fresh per-key timestamp, exactly as a
  // user who clicked Popularity before v1.122.0 carries it
  await j.boot("/", {
    initialState: {
      v: 2,
      prep: {},
      days: {},
      settings: { cardOrder: "popularity" },
      settingsAt: { cardOrder: Date.now() },
    },
  });

  // if the seed did not survive the boot this journey proves nothing at all
  const stored = await page.evaluate(() =>
    (window as any).__neural.get("cardOrder", "potential"),
  );
  expect(stored, "the retired value really is loaded in this profile").toBe(
    "popularity",
  );

  const withKey = await rankwalk(page);
  expect(withKey.length, "the walk reached the corpus").toBeGreaterThan(200);

  // SOFT on the first two: they are two halves of ONE fact (rank by X, print Y), so a mutant that
  // re-forks the ranking should report BOTH — the split cards and the trays they mis-order —
  // rather than stopping at whichever assertion runs first.

  // 1. one quantity, not two: what the hand is ranked by IS what the card prints
  const split = withKey.filter((h: any) => h.split.length);
  expect
    .soft(
      `${split.length} of ${withKey.length} hands · ` +
        split
          .map((h: any) => `${h.st}:${h.split.join(",")}`)
          .slice(0, 3)
          .join(" | "),
      "orderScore and moveEdge are the same number on every dealt card",
    )
    .toBe(`0 of ${withKey.length} hands · `);

  // 2. therefore the printed integers run downhill — the visible half of the same fact
  const bad = outOfOrder(withKey);
  expect
    .soft(
      `${bad.length} of ${withKey.length} hands · ` +
        bad
          .map((h: any) => `${h.st} ${JSON.stringify(h.print)}`)
          .slice(0, 2)
          .join(" | "),
      "no hand prints its EDGE out of descending order (was 211 of 270)",
    )
    .toBe(`0 of ${withKey.length} hands · `);

  // 3. and the key is inert: flipping it moves no hand, in membership or in order
  await page.evaluate(() =>
    (window as any).__neural.set("cardOrder", "potential"),
  );
  const flipped = await rankwalk(page);
  const diff = withKey
    .map((h: any, i: number) =>
      h.order.join("|") === flipped[i].order.join("|") ? null : h.st,
    )
    .filter(Boolean);
  expect(
    diff.slice(0, 5).join(" | "),
    "flipping the dormant key changes no hand",
  ).toBe("");
  expect(flipped.length, "both walks covered the same corpus").toBe(
    withKey.length,
  );
});

test("Settings no longer offers an ordering it does not use", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", {
    initialState: {
      v: 2,
      prep: {},
      days: {},
      settings: { cardOrder: "popularity" },
      settingsAt: { cardOrder: Date.now() },
    },
  });
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));

  const rolling = await page.evaluate(() => {
    const m =
      document.querySelector("[data-settings]") ||
      document.querySelector(".ng-modal");
    return {
      html: m ? (m as HTMLElement).innerText : "",
      raw: m ? (m as HTMLElement).innerHTML : "",
    };
  });

  // the row is gone, both of its choices with it
  expect(rolling.html, "no Option ordering row").not.toContain(
    "Option ordering",
  );
  expect(rolling.html, "no Potential choice").not.toContain("Potential");
  expect(rolling.html, "no Popularity choice").not.toContain("Popularity");
  // and the explainer that was false even before EDGE — it promised the score blends "how likely
  // you are to land the move", which `movePotential` never did (it reads the LANDING position's
  // dominance and its degree; the odds are not an input) and `moveEdge` does differently
  expect(rolling.raw, "the false Potential explainer is gone").not.toContain(
    "Bayesian",
  );
  expect(rolling.raw, "the false Potential explainer is gone").not.toContain(
    "how likely you are to land the move",
  );
  // the tab still renders its other rows — a blank modal must not pass as a deletion
  expect(rolling.html, "the Rolling tab still renders").toContain(
    "Sound volume",
  );
});

/**
 * THE SHEET IS THE CARD YOU PRESSED, VERBATIM (v1.136.0). Owner, on the old head: the EDGE
 * explainer paragraph "is not supposed to show to every user every time … needs to be a small,
 * almost noticeable tooltip near the number"; the from→to decomposition ("Headquarters Position
 * → open-guard") "is fucking unreadable — the technique's own name should really stand out";
 * the glyph "used to say 2, and now it just shows the transition icon without a 2"; and the
 * landing card "magically disappears — it should be BEHIND the maximized card, not gone".
 * Mutants that must die: restoring the explainer paragraph; restoring the from→to title;
 * dropping the digit (nodeGlyph instead of catGlyph); re-hiding the landcard on expand.
 *
 * v1.137.0 SHARPENS THE LANDCARD HALF. "Behind it" was true of the paint and false of everything
 * else: the card stayed at full opacity while `_detailCtx` sat in `_landHidden()`'s holder list,
 * so A-D refused to grade a card that looked completely live. The claim is now "dimmed, present,
 * and inert" rather than "opacity is exactly 1" — the original mutant still dies, on `> 0` and on
 * visibility:visible. Also killed here: `_syncDetailDim` no-oping, `closeOptionDetail` reverting
 * to a bare `_detailCtx = null`, dropping `inert`, and deleting the helmet.html rule.
 */
test("@curated the sheet keeps the card's name, digit and quiet category — and the landcard stays behind it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
  const opened = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const opt = a._optList && a._optList[1] // the card that wears digit 2
    if (!opt) return false
    a.expandOption(opt, () => {})
    return true
  })
  expect(opened, "a second option to expand").toBe(true)
  await j.advance(300)
  await page.waitForTimeout(400) // the card's wall-clock entry animation must finish before computed opacity means anything
  const r = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const opt = a._optList[1]
    const panel = a.optDetailRef.current
    const land = a._landEl
    const titleEl = [...panel.querySelectorAll("div")].find((d: any) => d.style.fontSize === "27px")
    return {
      spMain: a.splitName(a.nodes[opt.idx].t).main,
      title: titleEl ? titleEl.textContent : null,
      decomposed: panel.innerHTML.includes('→</span><span style="font-size:25px'),
      explainer: panel.innerHTML.includes("How far this tilts the roll"),
      tooltip: (panel.querySelector(".ngedgebig")?.getAttribute("title") || ""),
      digit: panel.querySelector(".ngglyph")?.innerHTML.includes(">2<") || false,
      landOpacity: land ? getComputedStyle(land).opacity : null,
      landVisibility: land ? getComputedStyle(land).visibility : null,
      landMarked: land ? land.hasAttribute("data-behind-sheet") : null,
      // the children are what carry `inert` — the ROOT stays hit-testable on purpose, so that a
      // tap on the card is still swallowed by attachInput's early-return instead of falling
      // through to the canvas and destroying the card (see _syncDetailDim)
      landRootInert: land ? !!(land as any).inert : null,
      kidsInert: land ? [...land.children].every((c: any) => c.inert === true) : null,
      kidCount: land ? land.children.length : 0,
      // PAINT ORDER, not z-index arithmetic (§6.3): a point inside both rects must resolve to
      // the sheet — the first cut compared z integers across two stacking contexts and passed
      // green on a build where the card painted over the sheet.
      sheetOverLand: (() => {
        if (!land) return false
        const cr = land.getBoundingClientRect(), pr = panel.getBoundingClientRect()
        const x = (Math.max(cr.left, pr.left) + Math.min(cr.right, pr.right)) / 2
        const y = (Math.max(cr.top, pr.top) + Math.min(cr.bottom, pr.bottom)) / 2
        if (Math.min(cr.bottom, pr.bottom) <= Math.max(cr.top, pr.top)) return true // no overlap: vacuously fine
        const hit = document.elementFromPoint(x, y)
        return !!(hit && panel.contains(hit))
      })(),
    }
  })
  expect(r!.title, "the technique's OWN name is the title").toBe(r!.spMain)
  expect(r!.decomposed, "the from→to decomposition is gone").toBe(false)
  expect(r!.explainer, "no explainer paragraph on every open").toBe(false)
  expect(r!.tooltip, "the explainer became the number's tooltip").toContain("By-the-book opponent")
  expect(r!.digit, "the glyph still wears the tray digit").toBe(true)
  // PRESENT, BUT STOOD DOWN. Strictly between 0 and 1: `0` would be the v1.135 hide this test was
  // written to forbid, `1` would be the v1.136 lie where a fully-live-looking card refused A-D.
  const op = parseFloat(r!.landOpacity!)
  expect(op, "the landing card is still painted behind the sheet").toBeGreaterThan(0)
  expect(op, "...but dimmed, so it cannot read as the live surface").toBeLessThan(1)
  expect(r!.landVisibility).toBe("visible")
  expect(r!.landMarked, "and it carries the stand-down marker").toBe(true)
  expect(r!.kidCount, "a card with content to disarm").toBeGreaterThan(0)
  expect(r!.kidsInert, "its children are inert — no clicks, no tab stops, no a11y tree").toBe(true)
  expect(r!.landRootInert, "the root is NOT inert: it must still swallow the tap").toBe(false)
  expect(r!.sheetOverLand, "and the sheet stacks over it").toBe(true)

  // THE KEYBOARD AGREES WITH THE PAINT. A dimmed card must not grade — this is the assertion that
  // gates `_detailCtx`'s membership in `_landHidden()` from the mouse side of the app.
  const answeredWhileOpen = (await j.beats()).filter((b) => b.beat === "land_q_answered").length
  await page.keyboard.press("a")
  await j.advance(200)
  expect(
    (await j.beats()).filter((b) => b.beat === "land_q_answered").length,
    "A-D does not grade the card standing behind the sheet",
  ).toBe(answeredWhileOpen)

  // ...AND IT ALL COMES BACK. The restore is flag-synchronous (`_landHidden` asks the holders, not
  // the pixels), so the card is live again the instant the sheet closes.
  await page.keyboard.press("Escape")
  await j.advance(400)
  await page.waitForTimeout(400) // the .22s dim transition is wall-clock, like the entry animation
  const back = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const land = a._landEl
    return {
      opacity: land ? getComputedStyle(land).opacity : null,
      marked: land ? land.hasAttribute("data-behind-sheet") : null,
      kidsInert: land ? [...land.children].some((c: any) => c.inert === true) : null,
      ctx: !!a._detailCtx,
    }
  })
  expect(back!.ctx, "Esc closed the sheet").toBe(false)
  expect(back!.opacity, "the card is at full strength again").toBe("1")
  expect(back!.marked, "the marker is gone").toBe(false)
  expect(back!.kidsInert, "and nothing is left inert").toBe(false)
})

/**
 * A REAL MOUSE ON THE STOOD-DOWN CARD DOES NOTHING — AND "NOTHING" IS TWO CLAIMS (v1.137.0).
 *
 * The card behind the sheet must neither GRADE (its buttons are inert) nor be DESTROYED. The
 * second half is the one that is easy to get wrong: `attachInput`'s pointerdown early-return is a
 * TARGET test (`ov.contains(e.target)`), so the obvious implementations — `pointer-events:none` on
 * the card root, or `inert` on the root — make the tap miss the card entirely and land on the
 * canvas, where `_tapBackground()` declines the question and clears the card while the sheet is
 * still open. That kills the pinned "back out of a sheet and the question still pays" contract
 * from a direction no keyboard test can see. Hence: children inert, root left hit-testable.
 *
 * `locator.click()` cannot make this claim (§6.3) — it dispatches ON the element. This uses
 * page.mouse at a MEASURED point, which is the only thing that exercises the real hit test.
 *
 * Mutants that must die: dropping `inert` from `_syncDetailDim` (the click grades); moving `inert`
 * to the card root, or setting pointer-events:none on it (the click destroys the card).
 */
test("a real click on the card behind the sheet neither answers it nor destroys it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const mc = await j.landQuestion()
  expect(mc, "a live landing question to stand down").toBeTruthy()

  await page.keyboard.press("1") // digit opens the first option's sheet
  await expect(page.locator("[data-go]"), "digit 1 opened an option sheet").toBeVisible()
  await j.advance(300)
  await page.waitForTimeout(400)

  // Find a point that is inside the card and NOT under the sheet. Measured, never assumed: the
  // sheet is bottom-anchored and the card's exposed strip shrinks as the sheet grows.
  const pt = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const land = a._landEl, panel = a.optDetailRef.current
    if (!land || !panel) return null
    const cr = land.getBoundingClientRect(), pr = panel.getBoundingClientRect()
    const y = Math.min(cr.bottom, pr.top) - 6 // just above the sheet's top edge, inside the card
    if (y <= cr.top + 2) return null          // no exposed strip at this viewport
    const x = cr.left + cr.width / 2
    const hit = document.elementFromPoint(x, y)
    return { x, y, insideCard: !!(hit && land.contains(hit)), hitTag: hit ? hit.tagName : null }
  })
  // POSITIVE COVERAGE (§6.6): if the strip is not there, this test proves nothing and must say so
  // rather than passing quietly on a click into empty space.
  expect(pt, "the card has a strip exposed above the sheet to click on").toBeTruthy()
  expect(
    pt!.insideCard,
    `the measured point resolves into the card, not ${pt!.hitTag} — the root must stay hit-testable`,
  ).toBe(true)

  const before = await j.beats()
  await page.mouse.click(pt!.x, pt!.y)
  await j.advance(400)
  const after = await j.beats()
  const fired = (name: string) =>
    after.filter((b) => b.beat === name).length - before.filter((b) => b.beat === name).length

  expect(fired("land_q_answered"), "the click did not grade the stood-down question").toBe(0)
  const state = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return { card: !!a._landEl, ctx: !!a._detailCtx, mc: !!a._mc }
  })
  expect(state!.card, "the card survived the click").toBe(true)
  expect(state!.ctx, "and the sheet is still open").toBe(true)
  expect(state!.mc, "and the question is still there to come back to").toBe(true)

  // THE REFUSAL IS IN THE MODEL, NOT ONLY IN THE CSS. `_mc.answer(i)` is the seam BOTH input paths
  // call — `_onKey` invokes it for A-D, and every option button's click listener is a closure over
  // the same function — so driving it is driving the real entry point, not a second implementation
  // of it (§6.3). Without this, `inert` alone hides the grading path from every spec and the
  // model-level guard has no gate: mutating it away left the whole suite green.
  const beforeSeam = (await j.beats()).filter((b) => b.beat === "land_q_answered").length
  await page.evaluate(() => {
    const a: any = (window as any).__neural
    if (a._mc && a._mc.answer) a._mc.answer(a._mc.correct)
  })
  await j.advance(300)
  expect(
    (await j.beats()).filter((b) => b.beat === "land_q_answered").length,
    "the answer seam itself refuses while the card is stood down",
  ).toBe(beforeSeam)

  // the contract the swallow protects: back out, and the question still pays
  await page.keyboard.press("Escape")
  await j.advance(300)
  await page.keyboard.press("abcd"[mc!.correct])
  await j.advance(300)
  const paid = (await j.beats()).filter((b) => b.beat === "land_q_answered")
  expect(paid.length, "after Esc the question answers normally").toBe(1)
  expect((paid[0] as any).correct).toBe(true)
})
