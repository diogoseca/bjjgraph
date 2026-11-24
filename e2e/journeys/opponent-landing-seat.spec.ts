import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * OPP1-S0 (v1.299.1): THE OPPONENT'S LANDING STANDS ON THE PLAYER'S ORB OF THE PAIR.
 *
 * The owner, on his own play of the preview (24 Nov): "seems to be going into butterfly guard or something now? why?".
 * The opponent's outcome is written from HIS side ("Butterfly Guard/Top"), and `resolveOutcomeTo` returns that side's
 * member, so the landing stood on the opponent's orb: the pulse ran on to the other orb of the position it had just left,
 * the address named the opponent's side, and a reload seated the player there. Measured on dev before the fix: 39 of 39
 * landings after an opponent's move at 1048, 41 of 41 at 390 (reports/mapshows.md, OPP1 Part A). `opponentDefend` now
 * mirrors the seat through `_seatMember`, as its escape branch always did; a move of his that fails and stays comes BACK
 * to the player's orb ([P, O, P]).
 *
 * Every draw that can end or redirect the exchange is rigged (CLAUDE.md §6.3): `resolve` (the player's attempt fails),
 * `outcome` (its miss stays; then the opponent's own draw), `opp-finish` (he never goes for a finish), `opp-pick`.
 * The landings are read where the player can act again: the hand dealt, no pulse, no exchange.
 *
 * The harness serves no dossier chunks, so there is no film here; nothing below reads one (§6.4).
 *
 * MUTANTS (each red after a green control, the run in reports/mapshows.md, OPP1-S0):
 *   S0a the mirror removed (`actualDest = intendDest`, `currentPos = nd`)  → every case, at "stands on his own orb"
 *   S0b the stay's path back to two nodes ([P, O])                         → "a stay comes back", both stay cases
 *   S0c the mirror kept on arrival only (the path still runs to his orb)   → "the pulse ends on the orb he lands on"
 *   S0d the seam in `rollFromPosition` removed (the sibling, at the foot)  → "Last rolls' ▶ on a Bottom row…" at "seated on its
 *       bottom orb"
 *   X2 (the reader's; S0-F2) `_pendingIntent.idx` back to the unmirrored member → "after an opponent's move his Last rolls
 *       row…" at "no 'aimed for'"
 *   S0a also → that test at "the hand…is a fresh roll's hand", and "his miss that stays…" at "costs no move"
 */

type W = any;

const at = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, n = a.nodes[a.currentPos] || {};
  const live = (a._optionCards || []).filter((c: W) => c.card && c.card.isConnected && c.card.offsetParent !== null);
  return {
    cur: a.currentPos, t: n.t, ty: n.ty, member: n.role || null, paired: n.pi != null && n.pi >= 0, role: a.playerRole,
    url: location.pathname, hand: live.length, pulse: a.pulse && !a.pulse.done ? { path: a.pulse.path.slice() } : null,
    actor: a.activeMove ? a.activeMove.verb : null, text: (a.evTextRef.current || {}).textContent || "",
  };
});

/** From the press to the moment he can act again: the opponent's pulse paths, and the place he lands on. */
const opponentTurn = async (page: Page, j: ReturnType<typeof journey>) => {
  const paths: number[][] = [];
  let opp = "";
  for (let k = 0; k < 300; k++) {
    await j.advance(100);
    const s = await at(page);
    if (s.pulse && s.actor === "Defending") {
      const last = paths[paths.length - 1];
      if (!last || last.join() !== s.pulse.path.join()) paths.push(s.pulse.path);
      opp = s.text;
    }
    if (k > 3 && s.hand > 0 && !s.pulse && !s.actor) return { paths, opp, land: s };
  }
  throw new Error("the player never got a hand back");
};

const rigAll = async (j: ReturnType<typeof journey>, missOutcome: number, oppPick: number, oppOutcome: number) => {
  await j.rig("resolve", [0.999]);                    // his attempt fails
  await j.rig("outcome", [missOutcome, oppOutcome]);  // the miss's place, then the opponent's own draw
  await j.rig("opp-finish", [0.99]);                  // the opponent never goes for a finish here
  await j.rig("opp-pick", [oppPick]);
};

const sideOf = (url: string) => (/\/(Top|Bottom)$/.exec(url) || [])[1]?.toLowerCase() || null;

// Mount top, his Gift Wrap misses and stays (Gift Wrap's misses: Mount/Top 25 · Half Guard/Bottom 10), then the opponent's
// Trap and Roll from Mount, whose own table is Closed Guard/Top 45 (success) · Mount/Bottom 35 (failure) · High Mount/Bottom
// 20 (counter): a move that seats him BOTTOM elsewhere, and a failure that STAYS (his case, below, stays on the bottom).
// Its counter is not a case here: "High Mount" is a variation of Mount, not a position.
for (const [label, draw, where, role, stays] of [
  ["his move seats you bottom elsewhere (Closed Guard)", 0.2, "Closed Guard", "bottom", false],
  ["his move fails and stays (Mount)", 0.6, "Mount", "top", true],
] as const) {
  test(`at Mount top, the opponent's Trap and Roll: ${label}; the landing stands on his own orb and the address names his side`, async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const before = await at(page);
    expect([before.member, before.role], "premise: he starts on Mount's top orb, playing top").toEqual(["top", "top"]);
    await rigAll(j, 0.55, 0.0, draw);
    await j.pick("Gift Wrap");
    const { paths, opp, land } = await opponentTurn(page, j);
    expect(opp, "premise: the opponent goes for Trap and Roll from Mount").toContain("Trap and Roll");
    expect(paths.length, "premise: one opponent's path").toBe(1);
    const [P, , L] = paths[0];
    expect(P, "his path starts where the player stands").toBe(before.cur);
    expect([land.ty, land.paired, land.t.replace(/\s+Top$/, "")], "premise: the landing's place").toEqual(["positions", true, where]);
    expect([land.member, land.role], "the landing stands on his own orb, the side he plays (S0a)").toEqual([role, role]);
    expect(L, "the pulse ends on the orb he lands on (S0c)").toBe(land.cur);
    expect(sideOf(land.url), "the address names his side").toBe(role);
    if (stays) expect(paths[0], "a stay comes back to the orb he stands on: [P, O, P] (S0b)").toEqual([before.cur, paths[0][1], before.cur]);
  });
}

// HIS CASE, as he played it: /Transitions/Arm-Drag-to-Back stages Butterfly Guard, bottom; his Arm Drag to Back misses and
// stays (Butterfly Guard/Bottom 30 · Side Control/Bottom 12), and the opponent's Body Lock Pass, played from Butterfly
// Guard by its own table there (Side Control/Top 43 · Butterfly Guard/Top 23 failure · Half Guard/Top 17 · Half Guard/
// Bottom 17), fails and stays. Before the fix the pulse went on to the TOP orb of Butterfly Guard and the address said
// /Positions/Butterfly-Guard/Top with him on the bottom; a reload of that address seated him on top.
test("his case: Body Lock Pass fails and stays; the pulse comes back to his bottom orb, the address says Bottom, and a reload seats him bottom", async ({ page }) => {
  const j = journey(page);
  await j.boot("/Transitions/Arm-Drag-to-Back");
  for (let i = 0; i < 20; i++) {
    await j.advance(1000);
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null && !a.pulse; })) break;
  }
  await j.engage();
  const before = await at(page);
  expect([before.t.replace(/\s+Top$/, ""), before.member, before.role], "premise: the page stages Butterfly Guard, bottom").toEqual(["Butterfly Guard", "bottom", "bottom"]);
  await rigAll(j, 0.55, 0.34, 0.5);
  await j.pick("Arm Drag to Back");
  const { paths, opp, land } = await opponentTurn(page, j);
  expect(opp, "premise: the opponent goes for Body Lock Pass").toContain("Body Lock Pass");
  expect(paths[0], "a stay comes back to the orb he stands on: [P, O, P] (S0b)").toEqual([before.cur, paths[0][1], before.cur]);
  expect([land.cur, land.member, land.role], "the landing stands on his own bottom orb (S0a)").toEqual([before.cur, "bottom", "bottom"]);
  expect(land.url, "the address names his side").toBe("/Positions/Butterfly-Guard/Bottom");
  // the reload: the address he was left on seats him where he was
  await j.boot(land.url);
  for (let i = 0; i < 20; i++) {
    await j.advance(1000);
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null; })) break;
  }
  const again = await at(page);
  expect([again.t.replace(/\s+Top$/, ""), again.member, again.role], "a reload of that address seats him bottom of Butterfly Guard").toEqual(["Butterfly Guard", "bottom", "bottom"]);
});

// THE SIBLING THE SURVEY FOUND (OPP1-S0): Last rolls' per-row ▶ finds its place by `nodeForKey(row.key)`, which answers
// "<place>|Top" AND "<place>|Bottom" with the TOP orb, and passes the row's side; `rollFromPosition` seated that side on
// whatever orb it was handed, so a Bottom row's ▶ seated the player bottom on the top orb and the address named Top
// (probed on dev: Mount|Bottom and Closed Guard|Bottom). `rollFromPosition` now seats the orb of the side played.
// Mutant S0d (that seam removed) → this test, at "seated on its bottom orb".
test("Last rolls' ▶ on a Bottom row seats the roll on that place's bottom orb, and the address says Bottom", async ({ page }) => {
  const j = journey(page);
  await j.boot("/Positions/Butterfly-Guard/Bottom");
  for (let i = 0; i < 20; i++) {
    await j.advance(1000);
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null && !a.pulse; })) break;
  }
  await j.engage();
  const start = await at(page);
  expect([start.t.replace(/\s+Top$/, ""), start.member, start.role], "premise: the page seats Butterfly Guard, bottom").toEqual(["Butterfly Guard", "bottom", "bottom"]);
  // one move that lands elsewhere, so "Butterfly Guard, bottom" is a row the roll no longer stands on
  const move = await page.evaluate(() => { const a = (window as W).__neural; for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string; return null; });
  expect(move, "premise: the hand deals a transition").not.toBeNull();
  await j.rig("resolve", [0.0]); await j.rig("outcome", [0.01]); await j.rig("opp-finish", [0.99]);
  await j.pick(move as string);
  await j.nextHand();
  const log = await page.evaluate(() => ((window as W).__neural.rollLog || []).map((h: W) => h.key as string));
  expect(log[0], "premise: the roll's first row is Butterfly Guard, bottom").toBe("Butterfly Guard|Bottom");
  expect(log[log.length - 1], "premise: and it stands somewhere else now").not.toBe("Butterfly Guard|Bottom");
  await j.clickByMouse(".ng-logo", "open the drawer");
  await j.clickByMouse('[data-view="history"]', "Last rolls");
  const play = '[data-hist="Butterfly Guard|Bottom"] .hplay';
  await page.locator(play).scrollIntoViewIfNeeded();
  await j.clickByMouse(play, "▶, roll from Butterfly Guard, bottom");
  let s = await at(page);
  for (let i = 0; i < 30 && !(s.hand > 0 && !s.pulse && s.t.startsWith("Butterfly Guard")); i++) { await j.advance(500); s = await at(page); }
  expect([s.t.replace(/\s+Top$/, ""), s.member, s.role], "the roll is seated on its bottom orb, playing bottom (S0d)").toEqual(["Butterfly Guard", "bottom", "bottom"]);
  expect(s.url, "the address names the side played").toBe("/Positions/Butterfly-Guard/Bottom");
});

// S0-F2 (the reader of PR #460, its section 7: three behaviours of the fix no test pinned; its mutant X2 survived 40 of 40).
// Mutants: X2 (`_pendingIntent.idx` back to the unmirrored member) → the first test, at "no 'aimed for'"; S0a (the mirror
// removed) → the first at "the hand is a fresh roll's hand" and the second at "costs no move".
test("after an opponent's move his Last rolls row says nothing he 'aimed for', and the hand is a fresh roll's hand at that seat, titles and destinations", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await rigAll(j, 0.55, 0.0, 0.2);
  await j.pick("Gift Wrap");
  const { land } = await opponentTurn(page, j);
  expect([land.t.replace(/\s+Top$/, ""), land.member, land.role], "premise: his Trap and Roll seats the player bottom in Closed Guard").toEqual(["Closed Guard", "bottom", "bottom"]);
  const row = await page.evaluate(() => { const a = (window as W).__neural, h = a.rollLog[a.rollLog.length - 1]; return { key: h.key, actor: h.actor, intend: h.intend }; });
  expect(row, "his row: the opponent's, landed where he aimed, so no 'aimed for' (X2)").toEqual({ key: "Closed Guard|Bottom", actor: "opp", intend: null });
  const hand = () => page.evaluate(() => { const a = (window as W).__neural;
    return (a._optionCards || []).filter((c: W) => !c.opt.threat).map((c: W) => a.nodes[c.opt.idx].t + " → " + (c.opt.res >= 0 ? a.nodes[c.opt.res].id : "-")).sort(); });
  const after = await hand();
  expect(after.length, "premise: a hand is dealt").toBeGreaterThan(3);
  await j.clickByMouse(".ng-logo", "open the drawer");
  await j.clickByMouse('[data-view="history"]', "Last rolls");
  await expect(page.locator('[data-hist="Closed Guard|Bottom"]').first(), "his row in Last rolls").toBeVisible();
  expect(await page.locator('[data-hist="Closed Guard|Bottom"]').first().textContent(), "…without an 'aimed for' line").not.toMatch(/aimed for/);
  await page.keyboard.press("Escape");
  // a fresh roll at the same seat (the app's own "roll from here", bottom)
  await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.nodeForKey("Closed Guard|Bottom"), false, "bottom"); });
  for (let i = 0; i < 30; i++) { await j.advance(500); if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && !a.pulse && a.playerRole === "bottom"; })) break; }
  expect(await hand(), "the hand after his move is a fresh roll's hand at that seat: titles and destinations (S0a)").toEqual(after);
});

test("his miss that stays, after the opponent's move that stays, costs no move and travels nowhere", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await rigAll(j, 0.55, 0.0, 0.6);
  await j.pick("Gift Wrap");
  const first = await opponentTurn(page, j);
  expect([first.land.member, first.land.role], "premise: the opponent's Trap and Roll fails and stays: Mount, top").toEqual(["top", "top"]);
  const m1 = await page.evaluate(() => (window as W).__neural.moveCount);
  await rigAll(j, 0.55, 0.0, 0.6);
  await j.pick("Gift Wrap");
  const paths: number[][] = [];
  let atChoice: number | null = null;
  for (let k = 0; k < 200 && atChoice == null; k++) {
    await j.advance(100);
    const s = await page.evaluate(() => { const a = (window as W).__neural; return { p: a.pulse && !a.pulse.done ? a.pulse.path.slice() : null, actor: a.activeMove ? a.activeMove.verb : null, moves: a.moveCount }; });
    if (s.p && (!paths.length || paths[paths.length - 1].join() !== s.p.join())) paths.push(s.p);
    if (s.actor === "Defending") atChoice = s.moves;
  }
  expect(atChoice, "when the opponent chooses again, his stay has cost no move (S0a)").toBe(m1);
  expect(paths.filter((p) => p.length === 2 && p[0] !== p[1] && p[1] === first.land.cur), "and no travel back to his own orb").toEqual([]);
});
