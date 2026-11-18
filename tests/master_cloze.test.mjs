// The cloze (L2, v1.292.0): neural/src/master-cloze.src.js, its pure parts. Where a move takes you (design/master-r4/spec.md,
// "What it says"), the day's words after Done, and the words over the rows (the Bars drawings). The page that asks is
// pinned by e2e/journeys/master-cloze.spec.ts.
//
// MUTANTS (each applied alone to master-cloze.src.js, red on the named test; the clean file green before and after):
//   L2-1 a failure outcome can be the place                       → "the place is the likeliest SUCCESS outcome…"
//   L2-2 a null cell read as 0 and kept                           → "a null cell is an outcome that does not exist…"
//   L2-3 the second place shown under 25                          → "a second place only from 25"
//   L2-4 ties broken by the last authored                         → "ties keep the authored order"
//   L2-5 a weekday past six days                                  → "the day's words"
//   L2-12 a role on a finish (the seam hands a side for a submission)  → "the seam: where a row leads…"
//   L2-13 an outcome that does not resolve is guessed, not counted     → "the seam: where a row leads…"
//   L2-14 a control position drawn as a finish again (L2-R1, ruling 5)  → "the seam: where a row leads…" and "over the whole
//         wire, both rulesets: a row's second line agrees with its outcome's node…"
// AND ON THE APP CLASS (L2-R1):
//   L2-15 the seat's existence read per answer (the reader's finding 1) → "two new moves at a place that had none, then Undo…"
//   (no mutant for "a 'Did not' on a move you knew…": it states what the writer leaves alone, the belt's two readings; that
//    a held level never falls is the rating's own rule and its own tests, tests/rating.test.mjs)
// THE WRITER (app.src.jsx, `_gradeMoves`, `_ungradeMoves`, `_movesToday`), on the app class with this payload:
//   L2-6 one point for six (the day counts a cloze, not its moves)    → "six answers are six of the day's 20…"
//   L2-7 the row written with its pair at index 3                     → "a cloze of six writes six rows…"
//   L2-8 the journal line dropped                                     → "a cloze of six writes six rows…"
//   L2-9 the badge without moves                                      → "six answers are six of the day's 20…"
//   L2-10 Undo leaving a row changed (a new cell kept)                → "Undo takes the confirm back exactly…"
//   L2-11 Undo leaving the answers in the journal                     → "Undo takes the confirm back exactly…"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ngClozeLeads, ngClozeBack, ngClozeSay, ngClozeLeadsOf } from "../neural/src/master-cloze.src.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ngKnowledgeScheduleRow } from "../neural/src/knowledge-profile.src.js";
import { ratingApp, RATING_DAY } from "./_rating_fixture.mjs";
import { gameplanRuntime as G } from "./_gameplan_harness.mjs";
import { ngGameplanReviewed } from "../neural/src/gameplan-debt.src.js";
// the rating fixture's app is the class without the planner's debt file, which `practiceToday` reads: handed in here
globalThis.ngGameplanReviewed = ngGameplanReviewed;

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../source/quartz/static/neural");

const o = (to, probability, result = "success") => ({ to, probability, result });

test("the place is the likeliest SUCCESS outcome; failure and counter outcomes are never shown", () => {
  const upa = [o("Closed Guard/Top", 45), o("Mount/Bottom", 40, "failure"), o("Back Control/Bottom", 60, "counter")];
  assert.deepEqual(ngClozeLeads(upa).map((x) => x.to), ["Closed Guard/Top"]);
  assert.deepEqual(ngClozeLeads([o("Mount/Bottom", 70, "failure")]), [], "no success outcome: nothing is said");
  assert.deepEqual(ngClozeLeads(null), []);
});

test("a null cell is an outcome that does not exist in this frame, never zero", () => {
  const rows = [o("Worm Guard/Bottom", null), o("Open Guard/Bottom", 20)];
  assert.deepEqual(ngClozeLeads(rows).map((x) => x.to), ["Open Guard/Bottom"]);
  assert.deepEqual(ngClozeLeads([o("Worm Guard/Bottom", null)]), [], "the only success does not exist here: nothing is said");
  assert.deepEqual(ngClozeLeads([o("Open Guard/Bottom", 0)]).map((x) => x.to), ["Open Guard/Bottom"], "0 exists (never attempted), and is kept");
});

test("a second place only from 25", () => {
  // the spec's own rows: Mount Escape to Half Guard Back Take (Back Control 35, Half Guard 30), Elbow Escape to Guard (16/16/8)
  assert.deepEqual(ngClozeLeads([o("Back Control/Top", 35), o("Half Guard/Bottom", 30), o("Mount/Bottom", 35, "failure")]).map((x) => x.to), ["Back Control/Top", "Half Guard/Bottom"]);
  assert.deepEqual(ngClozeLeads([o("Knee Shield Half Guard/Bottom", 30), o("Closed Guard/Bottom", 25)]).map((x) => x.to), ["Knee Shield Half Guard/Bottom", "Closed Guard/Bottom"], "25 is in");
  assert.deepEqual(ngClozeLeads([o("Half Guard/Bottom", 16), o("Closed Guard/Bottom", 16), o("Open Guard/Bottom", 8)]).map((x) => x.to), ["Half Guard/Bottom"], "no second place reaches 25");
  assert.deepEqual(ngClozeLeads([o("A/Top", 30), o("B/Top", 26), o("C/Top", 25)]).map((x) => x.to), ["A/Top", "B/Top"], "never a third");
});

test("ties keep the authored order", () => {
  assert.deepEqual(ngClozeLeads([o("Half Guard/Bottom", 30), o("Closed Guard/Bottom", 30)]).map((x) => x.to), ["Half Guard/Bottom", "Closed Guard/Bottom"]);
  assert.deepEqual(ngClozeLeads([o("X/Top", 10), o("Half Guard/Bottom", 30), o("Closed Guard/Bottom", 30)]).map((x) => x.to), ["Half Guard/Bottom", "Closed Guard/Bottom"]);
});

// THE SEAM (ruling 8): one function says where a row leads; the second line reads it and L2b's map will. On a small map
// of its own: a position, a submission, the control position a submission is held from, a move that is its own finish.
test("the seam: where a row leads is a place and its side, or a finish with no side; an outcome that does not resolve is counted, never guessed", () => {
  const nodes = [
    { t: "Half Guard Top", ty: "positions" },
    { t: "Armbar", ty: "submissions" },
    { t: "Armbar Control Top", ty: "positions", cal: { stateAlias: 1 } },
    { t: "Kimura from Guard", ty: "submissions" },
  ];
  const app = { nodes, graphName: (n) => (n.ty === "positions" ? n.t.replace(/ (Top|Bottom)$/, "") : n.t.replace(/ from .*$/, "")),
    _actOf: (opt) => opt.act, resolveOutcomeTo: (to) => to };
  const leads = (outcomes, idx = 9, s = null) => ngClozeLeadsOf(app, { idx, act: { cal: { outcomes } } }, s);
  assert.deepEqual(leads([o({ idx: 0, role: "bottom" }, 70)]), [{ idx: 0, sub: false, role: "bottom", name: "Half Guard" }], "a place and the side you land on");
  assert.deepEqual(leads([o({ idx: 1, role: "top" }, 60)]), [{ idx: 1, sub: true, role: null, name: "Armbar" }], "a submission is its finish: no side");
  assert.deepEqual(leads([o({ idx: 2, role: "top" }, 60)]), [{ idx: 2, sub: false, role: "top", name: "Armbar Control" }], "the position a submission is held from is a PLACE, with its side (L2-R1, ruling 5): the rule is the outcome's node");
  assert.deepEqual(leads([o({ terminal: true }, 55)], 3), [{ idx: 3, sub: true, role: null, name: "Kimura" }], "a move that ends the game names itself");
  assert.deepEqual(leads([o({ idx: 0, role: "top" }, 50), o({ idx: 1, role: "top" }, 30)]).map((l) => [l.name, l.role]), [["Half Guard", "top"], ["Armbar", null]], "a second place from 25, each by its own kind");
  const s = {};
  assert.deepEqual(leads([o({ idx: -1 }, 80), o({ idx: 0, role: "top" }, 30)], 9, s), [{ idx: 0, sub: false, role: "top", name: "Half Guard" }], "an outcome the map cannot place is left out");
  assert.equal(s.czLost, 1, "and counted");
  assert.deepEqual(leads([o({ idx: 0, role: "top" }, 40, "failure")]), [], "no success outcome: nothing is said");
});

test("the day's words", () => {
  const DAY = 20774;   // a Tuesday (17 Nov 2026)
  assert.equal(ngClozeBack([DAY + 7, 7, DAY, 1], DAY, true), "back in 7 days");
  assert.equal(ngClozeBack([DAY + 30, 30, DAY, 1], DAY, true), "back in 30 days");
  assert.equal(ngClozeBack([DAY + 1, 1, DAY, 0], DAY, false), "again on Wednesday", "a miss comes back tomorrow, named by its day");
  assert.equal(ngClozeBack([DAY + 2, 1, DAY, 0], DAY, false), "again on Thursday");
  assert.equal(ngClozeBack([DAY + 3, 3, DAY, 1], DAY, true), "back on Friday", "inside a week: the day's name");
  assert.equal(ngClozeBack([DAY + 6, 6, DAY, 1], DAY, true), "back on Monday");
  assert.equal(ngClozeBack([DAY, 1, DAY, 0], DAY, false), "again on Wednesday", "never today: the day after at the soonest");
});

test("the words over the rows", () => {
  assert.deepEqual(ngClozeSay({ hide: 6, goal: 20 }), ["Six moves start here. Say each one to yourself, then Show.", "Each blank is one move; each counts one toward today's 20."]);
  assert.deepEqual(ngClozeSay({ hide: 1, goal: 30 }), ["One move starts here. Say it to yourself, then Show.", "Each blank is one move; each counts one toward today's 30."]);
  assert.deepEqual(ngClozeSay({ hide: 2, solid: 4 }), ["Two moves to say. The four you have stay in sight.", ""]);
  assert.deepEqual(ngClozeSay({ hide: 1, solid: 1 }), ["One move to say. The one you have stays in sight.", ""]);
  assert.deepEqual(ngClozeSay({ hide: 6, shown: true }), ["Tap the ones you had.", "Nothing tapped = not yet. Hide puts the blanks back."]);
  assert.deepEqual(ngClozeSay({ hide: 6, shown: true, had: 4 }), ["Tap the ones you had. 4 so far.", "Nothing tapped = not yet. Hide puts the blanks back."]);
  assert.equal(ngClozeSay({ hide: 6, shown: true })[1], ngClozeSay({ hide: 6, shown: true, had: 1 })[1], "ONE small line for both states: nothing moves at the first tap (L2-R1)");
  assert.deepEqual(ngClozeSay({ hide: 2, solid: 9 })[0], "Two moves to say. The 9 you have stay in sight.", "past six, the figure");
});

// ── the writer, on the app class (the census way: tests/_rating_fixture.mjs) ──
function app() {
  const a = ratingApp(DIR, "gi"), lines = [];
  let id = 100;
  a._progressHost = {
    journal: (_i, rows) => rows.map((r) => { lines.push([++id, ...r]); return id; }),
    unjournal: (_i, ids) => { const gone = new Set(ids); let n = 0; for (let i = lines.length - 1; i >= 0; i--) if (gone.has(lines[i][0])) { lines.splice(i, 1); n++; } return n; },
  };
  a._published = 0; a._publishKnowledge = () => { a._published++; };
  a._pushes = 0; a._pushCloud = () => { a._pushes++; };
  return { a, lines };
}
const SIX = [["76/bottom", "301", true], ["76/bottom", "302", true], ["76/bottom", "303", false], ["76/bottom", "304", true], ["90/top", "305", false], ["76/bottom", "306", true]];

test("a cloze of six writes six rows through the one writer: the row, the journal line, ONE revision, ONE republish, ONE save", () => {
  const { a, lines } = app(), D = RATING_DAY;
  a.moves = { "76/bottom": { 301: [D - 1, 7, D - 8, 1, 7, 7], 303: [D - 2, 30, D - 32, 1, 30, 30] } };
  const before = structuredClone(a.moves), rev = a._movesRev || 0;
  const u = a._gradeMoves(SIX);
  for (const [st, mv, ok] of SIX) {
    const want = ngKnowledgeScheduleRow(before[st] && before[st][mv], ok, D, 4);
    assert.deepEqual(a.moves[st][mv], want, `${st} ${mv}: the writer's own row, its pair at index 4`);
    assert.equal(a.moves[st][mv][2], D, "answered today");
    assert.equal(a.moves[st][mv][3], ok ? 1 : 0, "the answer at [3]");
  }
  assert.deepEqual(a.moves["76/bottom"][303].slice(0, 4), [D + 1, 1, D, 0], "not tapped: what a hidden move's No stores (back to one day)");
  assert.deepEqual(lines.map((l) => l.slice(1, 6)), SIX.map(([st, mv, ok]) => [1, st, mv, ok ? 1 : 0, D]), "one journal line an answer, in order");
  assert.deepEqual(lines.map((l) => l[6]), SIX.map(([st, mv]) => a.moves[st][mv]), "each line carries the row it left");
  assert.equal(u.ids.length, 6);
  assert.deepEqual([a._movesRev - rev, a._published, a._saves], [1, 1, 1], "one revision, one republish, one save for the whole cloze");
});

test("six answers are six of the day's 20, by the plan's own rule; never on Multiple choice", () => {
  const { a } = app(), D = RATING_DAY;
  a.srs = { "Mount|Top": { q1: [D + 1, 1, D], q2: [D + 3, 3, D - 2] } };   // one card answered today
  assert.equal(a.practiceToday().done, 1);
  a._gradeMoves(SIX);
  assert.equal(a.practiceToday().done, 7, "each move answered is one, a Yes or not");
  assert.equal(a._movesToday(), G.ngGameplanMovesToday(a.moves, D), "the eager count IS the plan's (gameplan.src.js)");
  a.moves["76/bottom"][999] = [D + 9, 9, D - 1, 1];   // answered yesterday
  a.moves["76/bottom"][998] = [D + 1, 0, D, 1];       // not a row the plan counts (no interval)
  a._movesRev++;
  assert.equal(a.practiceToday().done, 7);
  assert.equal(a._movesToday(), G.ngGameplanMovesToday(a.moves, D));
  const get = a.get; a.get = (k, d) => (k === "mcMode" ? "mc" : get(k, d));
  assert.equal(a.practiceToday().done, 1, "Multiple choice: the plan asks no moves, so the day counts none (ruling 6)");
});

test("Undo takes the confirm back exactly: the rows, a cell and a state that were not there, the journal; then the push goes", () => {
  const { a, lines } = app(), D = RATING_DAY;
  a.moves = { "76/bottom": { 301: [D - 1, 7, D - 8, 1, 7, 7], 303: [D - 2, 30, D - 32, 1, 30, 30] } };
  lines.push([7, 1, "12/top", "5", 1, D - 1, [D + 2, 3, D - 1, 1, 3, 3]]);   // an answer of before, undelivered
  const before = JSON.stringify(a.moves), journal = JSON.stringify(lines), done = a.practiceToday().done;
  const u = a._gradeMoves(SIX);
  assert.notEqual(JSON.stringify(a.moves), before);
  a._undoHold = "held";
  assert.equal(a._ungradeMoves(u), true);
  assert.equal(JSON.stringify(a.moves), before, "byte for byte: 302, 304, 306 and the state 90/top are gone again; 301 and 303 are their old rows");
  assert.equal(JSON.stringify(lines), journal, "the journal holds what it held, in order");
  assert.equal(a.practiceToday().done, done, "and the day's count is what it was");
  assert.equal(a._undoHold, null, "the held push is let go");
  assert.equal(a._pushes, 1, "…and asked for, once");
});

test("Undo is refused once a row is no longer the row the confirm wrote (a pull or another tab rebuilt it)", () => {
  const { a, lines } = app(), D = RATING_DAY;
  const u = a._gradeMoves(SIX);
  a.moves["76/bottom"][302] = [D + 3, 3, D, 1, 3, 3];   // a merge's row
  const now = JSON.stringify(a.moves), n = lines.length;
  assert.equal(a._ungradeMoves(u), false);
  assert.equal(JSON.stringify(a.moves), now, "nothing is touched");
  assert.equal(lines.length, n, "the journal neither");
});

// ── L2-R1 (the reader of PR #438 and the orchestrator's rulings, 18 Nov 2026) ──
test("two new moves at a place that had none, then Undo: the moves record is what it was, the empty seat gone (L2-R1, finding 1)", () => {
  const { a, lines } = app(), D = RATING_DAY;
  a.moves = { "76/bottom": { 301: [D - 1, 7, D - 8, 1, 7, 7] } };
  const before = JSON.stringify(a.moves);
  const u = a._gradeMoves([["108/top", "316", true], ["108/top", "1242", false]]);
  assert.deepEqual(Object.keys(a.moves["108/top"]), ["316", "1242"], "premise: two rows at a seat that did not exist");
  assert.deepEqual(u.prior.map((p) => p[2]), [false, false], "the seat did not exist, for the second answer as for the first: decided once, before the loop");
  assert.equal(a._ungradeMoves(u), true);
  assert.equal(JSON.stringify(a.moves), before, "exactly: no \"108/top\":{} left behind");
  assert.equal(lines.length, 0, "and its answers left the journal");
  // a seat that existed, emptied by an Undo of its own new cells, stays (it was there before)
  a.moves = { "76/bottom": {} };
  const u2 = a._gradeMoves([["76/bottom", "301", true], ["76/bottom", "302", true]]);
  assert.equal(a._ungradeMoves(u2), true);
  assert.equal(JSON.stringify(a.moves), JSON.stringify({ "76/bottom": {} }), "a seat that was there, empty, is there again, empty");
});

test("a 'Did not' on a move you knew can lower the number, never the belt or its stripes; Undo restores the number exactly (L2-R1, ruling 7)", () => {
  const { a } = app(), D = RATING_DAY, G = a._ratingGame("gi");
  const [st, hand] = [...G.seats].find(([, h]) => [...h].some(([, w]) => typeof w === "number" && w > 0));
  const mv = [...hand].find(([, w]) => typeof w === "number" && w > 0)[0];
  a.moves = { [st]: { [mv]: [D + 300, 365, D - 65, 1, 365, 365] } };   // known for a year, not due
  a._movesRev = (a._movesRev || 0) + 1;
  const n0 = a.rating().points, belt0 = JSON.stringify(a.beltWorn()), path0 = JSON.stringify(a.wornBelt());
  assert.ok(Number.isFinite(n0), "premise: the number is read");
  const u = a._gradeMoves([[st, mv, false]]);
  const n1 = a.rating().points;
  assert.ok(n1 < n0, `the number dips, as a roll's No does (${n0} → ${n1}): the owner's rule is about the belt, not the number`);
  assert.equal(JSON.stringify(a.beltWorn()), belt0, "the belt and its stripes are what they were");
  assert.equal(JSON.stringify(a.wornBelt()), path0, "and the Path's own belt");
  assert.equal(a._ungradeMoves(u), true);
  assert.equal(a.rating().points, n0, "Undo restores the number exactly");
  assert.equal(JSON.stringify(a.beltWorn()), belt0);
});

// THE RULE IS THE OUTCOME'S NODE (ruling 5), on the real wire, every seat of each ruleset's game and every move its hand
// deals: the second line's kind (a place with a side, or a finish with none) against the wire's own outcome id, which
// says it by its form (a role node ends in /top or /bottom; a submission and the end of the game do not).
test("over the whole wire, both rulesets: a row's second line agrees with its outcome's node (a role node is a place with its side, only a submission a finish)", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = ratingApp(DIR, frame), G = a._ratingGame(frame), n = { moves: 0, place: 0, finish: 0, control: 0, none: 0, lost: 0, unpriced: 0, unpricedSeats: 0 };
    assert.ok(G && G.seats && G.seats.size > 100, frame + ": premise: the game's seats are read");
    for (const [st, hand] of G.seats) {
      const at = a._seatOf(st);
      if (!at) continue;
      const price = new Map([...hand].map(([mv, w]) => [String(mv), w])); let bare = 0;
      for (const opt of a._dealtOpts(at.i, at.role) || []) {
        const ord = String(a._ordById.get(a.siteIdOf(a.nodes[opt.idx].id)));
        if (price.has(ord) && typeof price.get(ord) !== "number") bare++;   // dealt here, and the game does not price it (ruling 8's count)
        n.moves++;
        const act = a._actOf(opt), wire = ngClozeLeads(act && act.cal && act.cal.outcomes), s = {}, leads = ngClozeLeadsOf(a, opt, s);
        if (!wire.length) { n.none++; assert.deepEqual(leads, [], st + ": no success outcome, nothing said"); continue; }
        n.lost += s.czLost || 0;
        assert.equal(leads.length + (s.czLost || 0), wire.length, st + " " + a.nodes[opt.idx].t + ": one lead an outcome, or counted as lost");
        if (s.czLost) continue;
        wire.forEach((o, i) => {
          const l = leads[i], role = (/\/(top|bottom)$/i.exec(String(o.to)) || [])[1], what = st + " " + a.nodes[opt.idx].t + " → " + o.to;
          if (role) {
            assert.deepEqual([l.sub, l.role], [false, role.toLowerCase()], what + ": a role node is a place, with its side");
            assert.equal(a.nodes[l.idx].ty, "positions", what);
            n.place++; if (a.nodes[l.idx].cal && a.nodes[l.idx].cal.stateAlias) n.control++;
          } else {
            assert.deepEqual([l.sub, l.role], [true, null], what + ": a submission (or the end of the game) is a finish, no side");
            n.finish++;
          }
        });
      }
      if (bare) { n.unpriced += bare; n.unpricedSeats++; }
    }
    console.log(`[cloze] ${frame}: ${n.moves} dealt moves read · places ${n.place} (of them ${n.control} a control position a submission is held from) · finishes ${n.finish} · no success outcome ${n.none} · not resolved ${n.lost} · dealt and not priced by this ruleset's game: ${n.unpriced} moves at ${n.unpricedSeats} seats`);
    assert.ok(n.place > 0 && n.finish > 0, frame + ": both kinds were met (" + JSON.stringify(n) + ")");
    assert.ok(n.control > 0, frame + ": and control positions among the places");
    assert.equal(n.lost, 0, frame + ": every outcome of a dealt move resolves on this wire");
  }
});
