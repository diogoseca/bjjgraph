/* @hyperspace {"theme":"onboarding","L":"first-visit","F":"option-hand","B":"role-correctness"}
   @invariant "On the three states the weighted first draw sends most newcomers to, BOTH sides: every option dealt into the hand is authored for the side being played — zero dealt techniques carry a fromRole naming the opponent (the v1.103.0 fromRole hard filter in optionsFor's main loop AND its no-candidates fallback)." */
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * PROMOTED — Q008 is FIXED (v1.103.0 role correctness). Born red in quarantine; green post-fix.
 *
 * The original observation: the card named your side while most of the hand under it was AUTHORED
 * for the other. `optionsFor` decided "is this move mine?" from the strength pair (`myVal >=
 * oppVal - 0.05`) — a heuristic over a score — while the authored truth lived in `fromRole`.
 * Measured then: Half Guard playing bottom dealt 14 of 22 candidates authored fromRole "top";
 * Closed Guard playing top dealt 19 of 22 authored "bottom". v1.103.0 made the data decide:
 * `if (n.fromRole && n.fromRole !== this.playerRole) continue;` in BOTH the main loop and the
 * fallback (which relaxes ORIGIN but never ROLE), and the leaf-slug `posId` fix un-starved the
 * origin join (54 of 136 positions had an empty hand and ran entirely on the fallback).
 *
 * The quarantine spec's OTHER half — "the card names the side being played" — is not here: that
 * was fixed in v1.82.4 and is pinned as a property over all 272 combos in
 * e2e/journeys/first-impression.spec.ts, and its `[data-land-id]` read crashed after v1.101.1
 * deleted the landing card's identity block (the graph names the state in-node now).
 */

test("the hand dealt under a named side is authored for that side", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });

  const audit = await page.evaluate(() => {
    const a = (window as any).__neural;
    // the three states WIN 1 sends most first impressions to, both sides
    const NAMES = ["Half Guard Top", "Closed Guard Top", "Side Control Top"];
    const rows: any[] = [];
    for (const t of NAMES) {
      const nd = a.nodes.find((n: any) => n.ty === "positions" && n.t === t);
      for (const role of ["top", "bottom"]) {
        a.playerRole = role;
        a.currentPos = nd.idx;
        a.rollLog = [];
        a._landQ = null;
        a.enterLand(false);
        const hand = (a.optionIdxs || []).map((i: number) => a.nodes[i]);
        rows.push({
          node: nd.t,
          role,
          dealt: hand.length,
          authoredForOther: hand
            .filter(
              (n: any) =>
                n.fromRole && (n.fromRole || "").toLowerCase() !== role,
            )
            .map((n: any) => `${n.t} [fromRole=${n.fromRole}]`),
        });
      }
    }
    return rows;
  });

  for (const r of audit) {
    expect(r.dealt, `${r.node} playing ${r.role}: a hand was dealt`).toBeGreaterThan(0);
    expect(
      r.authoredForOther.length,
      `${r.node} playing ${r.role}: ${r.authoredForOther.length} of ${r.dealt} dealt options are ` +
        `authored for the other side — ${JSON.stringify(r.authoredForOther)}`,
    ).toBe(0);
  }
});
