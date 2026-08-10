import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * Q008 (KNOWN RED) — the card names your side; most of the hand under it is AUTHORED for the other.
 *
 * This is the reviewer's cold-start observation, reproduced. It is NOT the v1.82.4 identity/deck fix
 * (that one is closed and pinned as a property over all 272 combos in
 * e2e/journeys/first-impression.spec.ts): the label, the deck key, `_posKey` and the roll-log row now
 * all agree about which side you are on. What still disagrees is the CONTENT of the hand.
 *
 * `optionsFor` decides "is this move mine?" from the strength pair `n.s` — `myVal(n) >= oppVal(n) -
 * 0.05` — which asks whether the move's OUTCOME favours me. The authored truth about whose move it is
 * lives in `fromRole`, and the two disagree constantly:
 *
 *      Half Guard, playing BOTTOM   22 role-filtered candidates, 14 authored fromRole "top"
 *      Closed Guard, playing TOP    22 role-filtered candidates, 19 authored fromRole "bottom",
 *                                   14 of them submissions
 *
 * Half Guard and Closed Guard are two of the three states WIN 1 now sends newcomers to most often, so
 * this is squarely on the first-impression path. It is also game-wide and pre-existing — a graph-data
 * coherence question about `fromRole`/`fromPositionId` (see project_graph_coherence_invariant), not a
 * cold-start bug — so it is deliberately parked here rather than fixed inside journey 3. The related
 * hole: 54 of 136 positions carry NO technique whose canonical origin is that position, so for 109 of
 * the 272 position x side combos the role filter empties and `optionsFor` deals from its unfiltered
 * escape instead.
 *
 * Green here means the coherence work landed: promote to e2e/gen/ and close Q008.
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
        const side = (
          document.querySelector("[data-land-id]") as HTMLElement
        ).innerText
          .replace(/\s+/g, " ")
          .trim();
        const hand = (a.optionIdxs || []).map((i: number) => a.nodes[i]);
        const mine = hand.filter(
          (n: any) => (n.fromRole || "").toLowerCase() === role,
        );
        rows.push({
          node: nd.t,
          role,
          cardSays: side,
          dealt: hand.length,
          authoredForMe: mine.length,
          authoredForOther: hand
            .filter((n: any) => (n.fromRole || "").toLowerCase() !== role)
            .map((n: any) => `${n.t} [fromRole=${n.fromRole}]`),
        });
      }
    }
    return rows;
  });

  for (const r of audit) {
    expect(
      r.cardSays.toLowerCase(),
      `the card names the side being played (this half is FIXED as of v1.82.4)`,
    ).toContain(r.role);
    expect(
      r.authoredForOther.length,
      `${r.node} playing ${r.role}: ${r.authoredForOther.length} of ${r.dealt} dealt options are ` +
        `authored for the other side — ${JSON.stringify(r.authoredForOther)}`,
    ).toBe(0);
  }
});
