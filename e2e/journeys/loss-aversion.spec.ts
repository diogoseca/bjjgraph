import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * WINNING vs NOT LOSING — the loss-aversion dial (v1.124.0).
 *
 * Owner: "we really don't want to lose the game and we want to win the game … we're more averse to
 * losing than to winning. It depends if it's the context of sport or self-defense … maybe that can
 * be a setting of an optimization function."  They chose SLIGHTLY LOSS-AVERSE as the default.
 *
 * The wire has carried one independent solve per preset since v1.117.0 (`evLam = [1,2,4]`), and
 * `V = p_win − λ·p_loss` puts the BALANCED point at λ=1 — so λ=2 was already the owner's
 * "slightly loss-averse" and was already `NG_EDGE_LAM`. Nothing was re-emitted; what shipped is
 * the control and the honest name. These journeys pin the four claims that make it safe:
 *
 *   1. it is in Settings → Rolling, it speaks sport/self-defence, and never says "lambda"
 *   2. it re-ranks hands but can never change WHICH moves are dealt (v1.123.0 uncapped the hand,
 *      so there is no truncation for a re-ranking to reach through)
 *   3. it touches nothing earned — belt, evidence, odds, clock, blob
 *   4. the order is FROZEN at deal time: flipping it cannot move the tray under a live hand
 *
 * …plus the owner's own falsifiable prediction, answered on the shipped build.
 */

const LAMS = [1, 2, 4];

/** Every live role-hand at one preset: the dealt set, its order, and its printed integers.
 *  Pinned exactly as `option-edge`'s RANKWALK is — fixed aiSkill, no user mods, a state key with
 *  no drilling bonus — so nothing here depends on what an earlier journey touched. */
const WALK = (lam: number) => `(() => {
  const a = window.__neural;
  a.aiSkill = 0.13; a.userMods = null;
  a.set("lossAversion", ${lam});
  const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
  a._posKey = "__lamwalk__";
  const out = [];
  for (let pi = 0; pi < a.nodes.length; pi++) {
    const p = a.nodes[pi];
    if (p.ty !== "positions" || !p.posId) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = pi; a.playerRole = role;
      const dealt = a.optionsFor(pi);
      if (dealt.length < 2) continue;
      out.push({
        st: p.posId + "/" + role,
        order: dealt.map((o) => o.node.t),
        set: dealt.map((o) => o.node.t).slice().sort(),
        print: dealt.map((o) => (a.edgeMark(o) ? a.edgeMark(o).i : null)).filter((v) => v != null),
        // keyed BY TECHNIQUE, never positional: the dial re-orders the array, so a positional
        // odds comparison reports every re-ordered hand as an odds change (it did, on 3 states)
        odds: dealt.map((o) => o.node.t + "=" + Math.round(a.moveChance(o.node) * 1e6)).sort(),
      });
    }
  }
  a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
  return out;
})()`;

const walk = (page: any, lam: number) => page.evaluate(WALK(lam));

/** the ascending steps in a hand's printed integers — a ranking that reads as a bug, counted */
const outOfOrder = (hands: any[]) =>
  hands.filter((h) =>
    h.print.some((v: number, i: number) => i > 0 && v > h.print[i - 1]),
  );

const openRolling = async (page: any) => {
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  return page.evaluate(() => {
    const m =
      document.querySelector("[data-settings]") ||
      document.querySelector(".ng-modal");
    const seg = document.querySelector("[data-settings-loss]");
    const gi = document.querySelector("[data-settings-gi]");
    return {
      text: m ? (m as HTMLElement).innerText : "",
      raw: m ? (m as HTMLElement).innerHTML : "",
      present: !!seg,
      picks: [...document.querySelectorAll("[data-loss-pick]")].map((b: any) => ({
        lam: b.getAttribute("data-loss-pick"),
        label: b.textContent.trim(),
        // segBtn paints the ACTIVE choice with a filled background; "transparent"/near-zero
        // alpha is the resting state
        active: /rgba\(74, 108, 255/.test(b.style.background),
      })),
      note: (document.querySelector("[data-loss-note]") || { textContent: "" })
        .textContent,
      noteFor: (document.querySelector("[data-loss-note]") || {
        getAttribute: () => null,
      }).getAttribute("data-loss-note"),
      // DOM order: the dial must sit after the uniform choice it was asked to live beside
      giBeforeLoss: !!(
        gi &&
        seg &&
        gi.compareDocumentPosition(seg) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
    };
  });
};

/* ── 1. THE CONTROL ITSELF ─────────────────────────────────────────────────────────────────── */

test("@curated the dial ships in Settings → Rolling beside the uniform choice, in white-belt words", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  const s = await openRolling(page);
  expect(s.present, "the row rendered").toBe(true);
  expect(s.giBeforeLoss, "it sits after the Gi / No-gi choice").toBe(true);

  // the presets come from the WIRE, in wire order — not from a hardcoded three
  const wire = await page.evaluate(() => (window as any).__neural._evLam);
  expect(wire, "this build ships the three-preset table").toEqual(LAMS);
  expect(s.picks.map((p: any) => Number(p.lam))).toEqual(wire);
  expect(s.picks.map((p: any) => p.label)).toEqual([
    "Sport",
    "Slightly cautious",
    "Self-defence",
  ]);

  // the owner's chosen default is the one that is lit, with no profile input at all
  expect(
    s.picks.filter((p: any) => p.active).map((p: any) => p.lam),
    "exactly one choice is active, and it is the slightly-cautious default",
  ).toEqual(["2"]);
  expect(s.noteFor).toBe("2");
  expect(s.note).toContain("the default");

  // the axis is the one a white belt has, and the model's vocabulary never reaches the screen
  expect(s.text).toContain("Winning vs not losing");
  expect(s.text).toContain("Sport");
  expect(s.text).toContain("Self-defence");
  // NB matched on the VISIBLE text with word boundaries, not on innerHTML: a raw-HTML substring
  // check for "EV" hits `class="paceVal"` and reports a jargon leak that is not on screen.
  for (const jargon of [
    "lambda",
    "λ",
    "loss aversion",
    "loss-aversion",
    "expected value",
    "EV",
    "MDP",
    "utility",
    "optimi",
  ])
    expect(
      new RegExp(`\\b${jargon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
        s.text,
      ),
      `never says "${jargon}"`,
    ).toBe(false);

  // it must not over-promise: the honest scope claim is part of the copy
  expect(s.text).toContain("order");
  expect(s.text).toContain("a nudge, not a different game");

  // the tab still renders its neighbours — a blank modal must not pass as a shipped row
  expect(s.text).toContain("Answer time");
  expect(s.text).toContain("Sound volume");
});

test("the presets are read off the wire — two blocks show two buttons, none shows no row", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  // a wire carrying two presets must render exactly those two, by VALUE not by position
  await page.evaluate(() => ((window as any).__neural._evLam = [2, 4]));
  let s = await openRolling(page);
  expect(s.picks.map((p: any) => p.lam)).toEqual(["2", "4"]);
  expect(s.picks.map((p: any) => p.label)).toEqual([
    "Slightly cautious",
    "Self-defence",
  ]);

  // a wire with no EDGE table at all: the dial would control NOTHING, so it does not render
  await page.evaluate(() => ((window as any).__neural._evLam = []));
  s = await openRolling(page);
  expect(s.present, "no table on the wire, no control over it").toBe(false);
  expect(s.text, "and the rest of the tab is untouched").toContain(
    "Answer time",
  );

  // an unknown preset is NAMED, never hidden — hiding a real choice is worse than a dull label
  await page.evaluate(() => ((window as any).__neural._evLam = [2, 3]));
  s = await openRolling(page);
  expect(s.picks.map((p: any) => p.lam)).toEqual(["2", "3"]);
  expect(s.picks[1].label).toContain("3");
});

/* ── 2. IT RE-RANKS THE HAND, AND CAN NEVER CHANGE WHICH MOVES ARE IN IT ────────────────────── */

test("@curated the dial re-orders hands but the dealt SET is identical at every preset", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  const w: Record<number, any[]> = {};
  for (const lam of LAMS) w[lam] = await walk(page, lam);
  expect(w[2].length, "the walk reached the corpus").toBeGreaterThan(200);
  for (const lam of LAMS)
    expect(w[lam].length, `lam=${lam} walked the same corpus`).toBe(
      w[2].length,
    );

  // THE SAFETY PROPERTY. Since v1.123.0 uncapped the hand there is no truncation for a
  // re-ranking to reach through, so the dial cannot add or withhold a single move — which is
  // also why it cannot move the option COUNT, and therefore cannot move the decision clock.
  const setDiff = w[2]
    .map((h: any, i: number) =>
      h.set.join("|") === w[1][i].set.join("|") &&
      h.set.join("|") === w[4][i].set.join("|")
        ? null
        : h.st,
    )
    .filter(Boolean);
  expect(
    `${setDiff.length} of ${w[2].length} · ${setDiff.slice(0, 3).join(" | ")}`,
    "the dealt set is identical at every preset",
  ).toBe(`0 of ${w[2].length} · `);

  // ...and the odds are identical too: `moveChance` has no loss-aversion input
  const oddsDiff = w[2]
    .map((h: any, i: number) =>
      h.odds.join("|") === w[4][i].odds.join("|") ? null : h.st,
    )
    .filter(Boolean);
  expect(oddsDiff.slice(0, 3).join(" | "), "no card's odds move").toBe("");

  // it IS a real control: it re-orders a minority of hands, and that minority is not zero
  const ordDiff = w[2].filter(
    (h: any, i: number) => h.order.join("|") !== w[4][i].order.join("|"),
  );
  const topDiff = w[2].filter(
    (h: any, i: number) => h.order[0] !== w[4][i].order[0],
  );
  expect(
    ordDiff.length,
    "Sport → Self-defence re-orders some hands (measured 29 of 272 offline)",
  ).toBeGreaterThan(5);
  expect(ordDiff.length, "…and only a minority of them").toBeLessThan(
    w[2].length / 2,
  );
  expect(topDiff.length, "…changing the top card in a few").toBeGreaterThan(0);

  // at EVERY preset the printed integers still run downhill. This is the failure v1.122.0
  // retired `cardOrder` for: a hand ranked by one number while printing another.
  for (const lam of LAMS) {
    const bad = outOfOrder(w[lam]);
    expect(
      `lam=${lam} ${bad.length} of ${w[lam].length} · ` +
        bad
          .map((h: any) => `${h.st} ${JSON.stringify(h.print)}`)
          .slice(0, 2)
          .join(" | "),
      "no hand prints its EDGE out of descending order",
    ).toBe(`lam=${lam} 0 of ${w[lam].length} · `);
  }
});

/* ── 3. IT TOUCHES NOTHING YOU HAVE EARNED ─────────────────────────────────────────────────── */

const EARNED = `(() => {
  const a = window.__neural;
  const g = a.gameScore();
  return {
    score: Math.round(g.score * 1e9), belt: g.belt, next: g.next, stripes: g.stripes,
    stage: JSON.stringify(a.stage || {}),
    srs: JSON.stringify(a.srs || {}),
    prep: JSON.stringify(a.prep || {}),
    rec: JSON.stringify(a.rec || {}),
    challenges: JSON.stringify(a.challenges || {}),
    badges: JSON.stringify(a.badges || {}),
    coins: JSON.stringify(a.coins || {}),
    units: JSON.stringify(a.units || {}),
    due: a.dueCount ? a.dueCount() : null,
  };
})()`;

/** the persisted blob with ONLY the dial's own key removed — its value, its per-key LWW stamp,
 *  and the blob's own write clock. A setting that persists MUST move those three; the claim being
 *  tested is that it moves nothing ELSE.
 *
 *  SECOND CLASS THIS CATCHES, FOR FREE — read it before you relax anything here. `_saveProgress`
 *  serialises the WHOLE of memory, so the dial's write also flushes anything else still pending,
 *  and the before/after diff prints it as the dial's doing. It went red exactly once, on
 *  `explored`: v1.138.0 promoted `_exploredKeys` into the blob without giving its only write site
 *  (`enterLand`) a save, so the persisted blob sat permanently one key behind memory and the dial
 *  was simply the first writer after a landing. THE APP WAS FIXED, NOT THIS ASSERTION — a
 *  persisted field whose write path never fires is a §6.6 durability bug, and this diff is the
 *  only thing in the suite that notices one. Mutants that still kill it (v1.143.2): the dial's
 *  onClick adding an explored key → "the rest of the blob is untouched"; the dial writing
 *  `prep` → "belt score, SRS, evidence, rewards — all untouched". */
const BLOB = `(() => {
  const raw = localStorage.getItem("bjj-neural-progress");
  if (!raw) return "";
  const b = JSON.parse(raw);
  if (b.settings) delete b.settings.lossAversion;
  if (b.settingsAt) delete b.settingsAt.lossAversion;
  delete b.updatedAt;
  return JSON.stringify(b);
})()`;

test("@curated changing the dial changes nothing you have earned", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const before = await page.evaluate(EARNED);
  const blobBefore = await page.evaluate(BLOB);
  const beats = await page.evaluate(
    () => (window as any).__neural.beats.length,
  );
  const clock = await page.evaluate(() => {
    const d = (window as any).__neural._decision;
    return d ? { total: d.total, remaining: Math.round(d.remaining) } : null;
  });

  // driven through the REAL CONTROL, not through `set()`. A journey that pokes the key directly
  // tests the setting and not the button — mutant L7 (an `fx()` beat added to the button's own
  // onClick) survived exactly that version of this test, because the handler never ran.
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  for (const lam of [1, 4, 2, 4, 1]) {
    await page.click(`[data-loss-pick="${lam}"]`);
    expect(
      await page.evaluate(() => (window as any).__neural.get("lossAversion", 2)),
      `the click really set ${lam}`,
    ).toBe(lam);
  }
  await page.evaluate(() => (window as any).__neural.closeModal());

  const after = await page.evaluate(EARNED);
  expect(after, "belt score, SRS, evidence, rewards — all untouched").toEqual(
    before,
  );
  expect(await page.evaluate(BLOB), "the rest of the blob is untouched").toBe(
    blobBefore,
  );

  // CHALLENGE EVIDENCE is offered beats through fx(); a settings write must emit none, or the
  // dial would be a way to farm objectives. `track()` is allowed to know — it is not fx.
  expect(
    await page.evaluate(() => (window as any).__neural.beats.length),
    "not one gameplay beat was emitted",
  ).toBe(beats);

  // the decision clock is a function of the option COUNT, which the dial cannot move
  expect(
    await page.evaluate(() => {
      const d = (window as any).__neural._decision;
      return d ? { total: d.total, remaining: Math.round(d.remaining) } : null;
    }),
    "the clock did not move",
  ).toEqual(clock);

  // and the key that WAS written is the only one
  expect(
    await page.evaluate(() => (window as any).__neural.get("lossAversion", 2)),
  ).toBe(1);
});

/* ── 4. THE ORDER IS FROZEN AT DEAL TIME ───────────────────────────────────────────────────── */

const TRAY = `[...document.querySelectorAll("[data-tech]")].map((c) => ({
  tech: c.getAttribute("data-tech"),
  edge: c.querySelector(".ngedge") ? c.querySelector(".ngedge").textContent : null,
}))`;

test("@curated flipping the dial cannot move the tray under a live hand", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  // a hand the dial demonstrably DOES re-rank, so a frozen tray is a real result and not a
  // vacuous one. `land()` rigs role=top, so the search is over TOP hands only — asserting a
  // freeze on a hand the dial would not have moved anyway proves nothing.
  const target = await page.evaluate(`(() => {
    const a = window.__neural;
    a.aiSkill = 0.13; a.userMods = null;
    const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
    a._posKey = "__lamfreeze__";
    let best = null;
    for (let pi = 0; pi < a.nodes.length; pi++) {
      const p = a.nodes[pi];
      if (p.ty !== "positions" || !p.posId) continue;
      a.currentPos = pi; a.playerRole = "top";
      a.set("lossAversion", 1); const one = a.optionsFor(pi).map((o) => o.node.t);
      a.set("lossAversion", 4); const four = a.optionsFor(pi).map((o) => o.node.t);
      if (one.length < 3) continue;
      let d = 0; for (let i = 0; i < one.length; i++) if (one[i] !== four[i]) d++;
      if (!best || d > best.d) best = { title: p.t, d: d, n: one.length };
    }
    a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
    a.set("lossAversion", 2);
    return best;
  })()`);
  expect(
    (target as any).d,
    "found a top hand the two extremes really do order differently",
  ).toBeGreaterThan(0);

  await j.land((target as any).title);
  const before = await page.evaluate(TRAY);
  expect(before.length, "a hand is on the table").toBeGreaterThan(1);

  await page.evaluate(() => (window as any).__neural.set("lossAversion", 4));
  await page.evaluate(() => (window as any).__neural.refreshOptionOdds());

  expect(
    await page.evaluate(TRAY),
    "the tray the player is reaching into did not move — order OR numbers",
  ).toEqual(before);
  // `_optList` is what the 1-9 keys index; it must be the same frozen array
  expect(
    await page.evaluate(
      () => ((window as any).__neural._optList || []).map((o: any) => o.node.t),
    ),
  ).toEqual(before.map((c: any) => c.tech));

  // ...and the NEXT deal does use the new setting
  const nextK = await page.evaluate(() => (window as any).__neural._evLamIdx());
  expect(nextK, "the dial now selects the self-defence block").toBe(2);
});

/* ── 5. THE OWNER'S OWN FALSIFIABLE PREDICTION, ON THE SHIPPED BUILD ────────────────────────── */

/**
 * Owner: "typically in self-defence they really don't want to lose. That's why they prioritize
 * mount over side control because it's more for the street."
 *
 * This journey does not assert the prediction is TRUE — it measures it and pins the measurement,
 * so the day content or the model changes the number, the answer changes with it. What the
 * offline solve reports (tests/artifacts/_lambda_probe.py) is that the prediction holds for the
 * POSITIONS and fails for the MOVE most people would name: `Side Control to Mount` is ranked 21st
 * of 25 at every preset, and its EDGE gets WORSE as loss aversion rises.
 */
test("mount vs side control: the prediction, measured in a real dealt hand", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");

  const m = await page.evaluate(`(() => {
    const a = window.__neural;
    a.aiSkill = 0.13; a.userMods = null;
    const keepPos = a.currentPos, keepRole = a.playerRole, keepKey = a._posKey;
    a._posKey = "__lammount__";
    // the SUCCESS branch is where a move lands you — the same derivation the offline probe uses
    const hubs = (n) => {
      const o = (n.cal && n.cal.outcomes) || [];
      return o.filter((x) => x.result === "success").map((x) => String(x.to).split("/")[0]);
    };
    const per = {};
    for (const lam of [1, 2, 4]) {
      a.set("lossAversion", lam);
      const rows = [];
      for (let pi = 0; pi < a.nodes.length; pi++) {
        const p = a.nodes[pi];
        if (p.ty !== "positions" || !p.posId) continue;
        for (const role of ["top", "bottom"]) {
          a.currentPos = pi; a.playerRole = role;
          const dealt = a.optionsFor(pi);
          if (dealt.length < 2) continue;
          const mnt = [], sc = [];
          for (const o of dealt) {
            const h = hubs(o.node); const e = a.moveEdge(o);
            if (e == null) continue;
            if (h.indexOf("mount") >= 0) mnt.push(e);
            if (h.indexOf("side-control") >= 0) sc.push(e);
          }
          if (mnt.length && sc.length)
            rows.push({ st: p.posId + "/" + role,
                        mnt: Math.max.apply(null, mnt), sc: Math.max.apply(null, sc) });
        }
      }
      per[lam] = { n: rows.length, mountWins: rows.filter((r) => r.mnt > r.sc).length };
    }
    // and the single most-named instance, in the hand it actually lives in.
    // NB posId is a TOP-LEVEL node field, not a cal field.
    const scTop = a.nodes.findIndex((n) => n.ty === "positions" && n.posId === "side-control");
    const rank = {};
    if (scTop >= 0) {
      a.currentPos = scTop; a.playerRole = "top";
      for (const lam of [1, 2, 4]) {
        a.set("lossAversion", lam);
        const dealt = a.optionsFor(scTop);
        const i = dealt.findIndex((o) => o.node.t === "Side Control to Mount");
        rank[lam] = i < 0 ? null
          : { rank: i + 1, of: dealt.length, edge: Math.round(a.moveEdge(dealt[i])) };
      }
    }
    a.currentPos = keepPos; a.playerRole = keepRole; a._posKey = keepKey;
    a.set("lossAversion", 2);
    return { per: per, rank: rank };
  })()`);

  const per = (m as any).per;
  const rank = (m as any).rank;
  // the measurement is the point of this journey, so it is printed even on a pass
  console.log(
    "[mount vs side-control] " +
      LAMS.map((l) => `lam=${l}: ${per[l].mountWins}/${per[l].n}`).join("  ") +
      " | Side Control to Mount " +
      LAMS.map(
        (l) => `lam=${l}: rank ${rank[l].rank}/${rank[l].of} edge ${rank[l].edge}`,
      ).join("  "),
  );

  // the corpus really does contain the head-to-head, so this is a measurement about content and
  // not a vacuous walk over an empty pool
  expect(
    per[2].n,
    "hands offering a move into BOTH mount and side control",
  ).toBeGreaterThan(10);

  // THE PREDICTION, ANSWERED: it does not hold as a rule at any preset, and self-defence does
  // not move it toward holding. Loss aversion does not turn mount into the better landing.
  for (const lam of LAMS)
    expect(
      per[lam].mountWins,
      `lam=${lam}: mount does not beat side control in most hands`,
    ).toBeLessThan(per[lam].n / 2);
  expect(
    per[4].mountWins,
    "self-defence does not raise mount's share of those hands above sport's",
  ).toBeLessThanOrEqual(per[1].mountWins);

  // and at the instance the owner named, the answer is a flat NO at every preset: the move is in
  // the bottom half of its own hand, and loss aversion makes it score WORSE rather than better
  expect(rank[1], "Side Control to Mount is dealt from side control/top").toBeTruthy();
  for (const lam of LAMS)
    expect(
      rank[lam].rank,
      `lam=${lam}: Side Control to Mount sits in the bottom half of that hand`,
    ).toBeGreaterThan(rank[lam].of / 2);
  expect(
    rank[4].edge,
    "self-defence makes that move score WORSE, not better",
  ).toBeLessThan(rank[1].edge);
});
