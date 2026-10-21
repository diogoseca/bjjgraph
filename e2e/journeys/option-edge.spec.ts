// v1.230.0 reverses v1.218.1 Inspect and v1.220.0 sheet/category/score hierarchy.
// Old sheet paint/inert cases are superseded by video-cards.spec.ts Watch modal tests.
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * Legacy EDGE arithmetic remains an opponent/comparator regression boundary below.
 * Player card surfaces now expose personalized Win chance and separate immediate chance;
 * choice-value.spec.ts supplies controlled solver replies for the asynchronous boundary.
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
      win: c.querySelector("[data-choice-win]")?.textContent,
      valueLabel: c.querySelector("[data-choice-value]")?.textContent,
      immediateLabel: c.querySelector("[data-immediate-label]")?.textContent,
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

test("@curated at the authored odds the card IS the published value — the worked examples, Frame and Escape", async ({
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
  // THE CLAIM, restated at v1.210.0 (origin coherence). Until then this read "the most-attempted move
  // from here is the worst card on the board" at Frame -12, Escape +18. Listing the side-control
  // orphans at their origin (Shrimp Escape, Arm Extraction, Roll to Turtle; calibration/
  // origin_coherence.json) added cards to this hand, which lowered its attempt-weighted baseline:
  // Frame -12 -> -11 and Escape +18 -> +20. The new Roll to Turtle (-25: a miss concedes the back) is
  // now the worst card. What still holds, and is asserted: Frame is the most-ATTEMPTED card this
  // hand deals, and it sits BELOW the ordinary choice. Both values are census-tracked, so the next
  // content change names them on the push that moves them. The census scan reads unsigned integers,
  // so Frame is pinned by its deficit below the ordinary choice.
  // v1.212.0 (phase 2): Elbow Escape to Guard was re-homed to side-control/bottom, so this hand now
  // deals it too, at Frame's own share (12 of the authored no-gi points each, 15% of the dealt
  // hand). Frame is now TIED for most-attempted, which `toBe(topAtt)` still asserts, and its deficit
  // moved 11 -> 10.
  const attOf = await page.evaluate(() => {
    const a = (window as any).__neural;
    return a.optionsFor(a.currentPos).filter((o: any) => o.ev).map((o: any) => ({ t: o.node.t, att: o.ev.att }));
  });
  const topAtt = Math.max(...attOf.map((r: any) => r.att));
  expect(attOf.find((r: any) => r.t === "Frame from Side Control")!.att, "Frame is the most-attempted card dealt here (tied since v1.212.0)").toBe(topAtt);
  expect(frame.edge, "and it sits below the ordinary choice").toBeLessThan(0);
  expect(-frame.edge, "Frame's deficit below the ordinary choice").toBe(10); // census:edgeFrameDeficit
  expect(esc.edge, "Side Control Escape").toBe(20); // census:edgeSideControlEscape
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

test("the card face names future win and immediate chance separately", async ({ page }) => {
  const j = journey(page);
  await j.boot("/"); await j.land("Mount Top");
  const cards = await cardEdges(page);
  expect(cards.length).toBeGreaterThan(3);
  for (const c of cards) {
    expect(c.mid.trim(), "the direct title has no category eyebrow").toBe("");
    expect(c.edge, "legacy utility is no longer a player-card headline").toBeNull();
    expect(c.valueLabel).toContain("Win %");
    expect(c.win).toMatch(/^(—|(?:<|>)?\d+(?:–\d+)?)$/);
    expect(c.immediateLabel).toMatch(/^(Works|Submit|Move|Escape)$/);
    expect(c.odds).toMatch(/^(—|(?:<|>)?\d+)$/);
    // a submission dealt on a position steps in with certainty; its small line is the finish
    // it leads to, never that step's 100% (v1.213.0, owner 2026-10-01). Non-kill, recorded: this
    // reads the dealt face BEFORE values arrive ("Works —"), so a view printing the step once they
    // land survives here; submission-card-odds.spec.ts and option-hand.spec.ts kill it.
    if (c.ty === "submissions") { expect(c.immediateLabel, c.tech).toBe("Works"); expect(c.odds, c.tech).not.toBe("100"); }
  }
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

test("@curated a study grade updates immediate chance without moving card or keyboard identity", async ({ page }) => {
  const j = journey(page);
  await j.boot("/"); await j.land("Mount Top"); await j.decksSettled();
  const before = await cardEdges(page);
  const candidate = before.slice(0, 8).find((c: any) => c.ty === "transitions" && parseInt(c.odds, 10) < 80);
  expect(candidate, "an unclamped transition with a study deck").toBeTruthy();
  const first = page.locator(`[data-tech="${candidate!.tech}"]`);
  await first.scrollIntoViewIfNeeded();
  // Owner decision 2026-10-15 retired JIT; keep the grade/order law on sidebar study.
  await j.watchChoice(candidate!.tech); // the real video-viewer action marks this hand touched
  await j.studyChoice(candidate!.tech);
  await j.studyGrade();
  const after = await cardEdges(page);
  expect(after.map((c: any) => c.tech)).toEqual(before.map((c: any) => c.tech));
  expect(await page.evaluate(() => (window as any).__neural._optList.map((o: any) => o.node.t))).toEqual(before.map((c: any) => c.tech));
  const changed = after.find((c: any) => c.tech === candidate!.tech)!;
  expect(parseInt(changed.odds!, 10)).toBeGreaterThan(parseInt(candidate!.odds!, 10));
  expect(changed.valueLabel).toContain("Win %");
  expect(changed.edge).toBeNull();
});

test("player values remain understandable without glyph colour", async ({ page }) => {
  const j = journey(page);
  await j.boot("/"); await j.land("Mount Top");
  const cards = await cardEdges(page);
  expect(cards.length).toBeGreaterThan(3);
  for (const c of cards) {
    expect(c.valueLabel).toContain("Win %");
    expect(c.immediateLabel).toMatch(/^(Works|Submit|Move|Escape)$/);
    expect(c.mid.trim(), "no category eyebrow").toBe("");
  }
});

test("a move the table cannot value shows NO number — never a fabricated 0", async ({
  page,
}) => {
  // WHERE THE UNVALUABLE CARDS ARE (v1.210.0). Until then this spec read Side Control (bottom): its hand
  // dealt three origin orphans with no attempt share, so no EDGE row. Origin coherence listed them at
  // their origin, so that hand is now fully valued. The premise is real elsewhere and durable. EDGE is
  // solved in ONE frame (`evFrame`, no-gi) and the app boots in gi (no localStorage), so a gi-only card
  // has no row. So are the moves authored at 0% from their own origin, which the app deals and the
  // solver does not. The probe SEARCHES every seat for them instead of pinning one hand, so the next
  // content change cannot quietly empty it again.
  // MUTANT: `moveEdge` returning 0 for a card with no row ("if (!r) return 0") turns this red —
  // measured at v1.210.1 by the same probe over the same source and wire: 114 unvalued gi cards across
  // 40 seats, all 114 printing a number under the mutant, 0 without it.
  const j = journey(page);
  await j.boot("/");
  await landBottom(j, page, "Side Control Top");

  const probe = await page.evaluate(() => {
    const a = (window as any).__neural;
    const unvalued: any[] = [];
    let zeroSomewhere: any = null;
    for (let pi = 0; pi < a.nodes.length; pi++) {
      if (a.nodes[pi].ty !== "positions" || !a.nodes[pi].posId || !a.nodes[pi].rep) continue;
      for (const role of ["top", "bottom"]) {
        a.currentPos = pi;
        a.playerRole = role;
        for (const o of a.optionsFor(pi)) {
          if (!o.ev) unvalued.push({ at: a.nodes[pi].t + " [" + role + "]", t: o.node.t, edge: a.moveEdge(o), mark: a.edgeMark(o) });
          // a genuinely-zero card, found anywhere in the corpus, still renders its 0
          const m = o.ev && a.edgeMark(o);
          if (!zeroSomewhere && m && m.i === 0) zeroSomewhere = { t: o.node.t, txt: m.txt };
        }
      }
    }
    return { mode: a._giMode, unvalued, zeroSomewhere };
  });
  expect(
    probe.unvalued.length,
    `some ${probe.mode} hand really does deal cards the table cannot value`,
  ).toBeGreaterThan(0);
  for (const u of probe.unvalued) {
    expect(u.edge, `${u.t} at ${u.at}: no value means null, not 0`).toBeNull();
    expect(u.mark, `${u.t} at ${u.at}: and no mark is drawn`).toBeNull();
  }
  expect(
    probe.zeroSomewhere,
    "a genuinely-zero EDGE exists and prints",
  ).toBeTruthy();
  expect(probe.zeroSomewhere!.txt).toBe("0");
});

test("Read leaves the dealt card and its displayed value intact", async ({ page }) => {
  const j = journey(page);
  await j.boot("/"); await j.land("Mount Top");
  const first = page.locator('[data-choice-group="you"] [data-tech]').first();
  const name = (await first.getAttribute("data-tech"))!;
  const values = await first.locator(".ngodds, [data-choice-win]").allTextContents();
  await j.watchChoice(name);
  await expect(first).toBeVisible();
  expect(await first.locator(".ngodds, [data-choice-win]").allTextContents()).toEqual(values);
  await expect(page.locator("[data-choice-value-detail], .ngedgebig")).toHaveCount(0);
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

// The retired Inspect shell's category banner, enlarged glyph, explanation and behind-sheet
// dimming were v1.136/v1.137 contracts, reversed by the approved v1.230 design. The replacement
// Watch modal's pointer/keyboard isolation and restoration live in video-cards.spec.ts.
test("@curated the direct choice keeps its own name and digit without a category or sheet", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  const choice = page.locator('[data-choice-group="you"] [data-tech]').nth(1)
  await expect(choice.locator('[data-choice-number]')).toHaveText('2')
  await expect(choice.locator('.ngchoice-title')).not.toBeEmpty()
  await expect(choice.locator('[data-cat], .ngglyph')).toHaveCount(0)
  await page.keyboard.press('Shift+Digit2')
  await expect(page.locator('[data-go], [data-choice-value-detail]')).toHaveCount(0)
  await expect(page.locator('[data-executing-tech]')).toHaveCount(0)
  await expect(page.locator('[data-landcard]')).toBeVisible()
})
