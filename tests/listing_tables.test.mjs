// A LISTING'S OWN OUTCOME TABLE, IN THE GAME (v1.214.0, origin coherence PR B1).
//
// B1 is the MECHANISM with no table applied: the wire may carry `cal.at[posId]` on a technique, and
// every reader honours it through one seam (`ngKnowledgeCalAt`: the app's `_at`, the adapter's
// `actAt`; the Python twins `_mdp_mechanics.cal_at` and `solve_edge_values.listing_view`). These
// cases run the real app class on the real wire.
//   1. Byte-identity at the dealer: on today's corpus no hand deals an overlay, so every dealt card
//      IS the node at its index (the claim that lets B1 ship without moving a number).
//   2. With panel tables injected exactly as regenerate_neural_data emits them, a listing's card is
//      dealt, priced, landed and drawn from THAT listing's table, and the option sheet shows it.
//   3. The full app-vs-Python mechanics differential (tests/mdp_data_corpus.test.mjs) passes on that
//      injected wire, so the adapter capture and _mdp_mechanics agree on every hand, destination
//      and node, the listing tables included.
// MUTANTS (each turns this file red; measured at v1.214.0):
//   - optionsFor dealing `node: n` instead of the overlay: case 2;
//   - resolve back on `this.nodes[opt.idx]`: case 2 (the draw comes from the canonical table);
//   - _tableLanding replaced by resultPos: cases 2 and 3 (the landing, and the differential);
//   - _mdp_mechanics.options without table_landing: case 3;
//   - ngKnowledgeCalAt returning the node always: cases 2 and 3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const SRC = read("neural/src/app.src.jsx");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + SRC + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const DATA = "source/quartz/static/neural";
const WIRE = JSON.parse(read(DATA + "/graph-data.json"));
const TABLES = JSON.parse(read("calibration/listing_tables.json")).tables;
const CODE = { success: "s", failure: "f", counter: "c" };

function app(wire) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.get = (_k, d) => d; a.set = a.track = a._saveProgress = () => {};
  a.ingest(structuredClone(wire));
  return a;
}

/** The wire regenerate_neural_data emits for these tables: `cal.at[posId]` on the technique, in the
 *  canonical table's shape (frames equal to the scalar trimmed), and the listing in `alsoFrom`. The
 *  panel's pooled success cells equal its no-gi rate on every table, so no rescale is needed here. */
function inject(wire, tables) {
  const w = structuredClone(wire);
  const placed = [];
  for (const t of tables) {
    const posId = t.listing.split("/")[0];
    const n = w.nodes.find((x) => x.t === t.move && x.ty === "transitions");
    assert.ok(n && n.cal, t.key + ": the technique is on the wire");
    const r = t.result.success_rate, entry = { successRate: r.nogi };
    if (r.gi != null && r.gi !== r.nogi) entry.successRateByRuleset = { gi: r.gi };
    entry.outcomes = t.result.outcomes.map((o) => [o.to, o.nogi, CODE[o.result]]);
    n.cal.at = { ...(n.cal.at || {}), [posId]: entry };
    n.alsoFrom = [...new Set([...(n.alsoFrom || []), posId])].sort();
    placed.push({ t, posId, id: n.id });
  }
  return { wire: w, placed };
}

// listings present in both frames, on distinct techniques, so each injected card is unambiguous, and
// NOT at a control-alias position: the app canonicalises those into a submission state, whose hand is
// the submission's own (finish, continuations, defenses), so a listing there is never dealt (12 of the
// 107 panel tables sit at one; PR B2 decides what they become)
const ALIAS = new Set(WIRE.nodes.filter((n) => n.ty === "positions" && n.cal?.stateAlias).map((n) => n.posId));
const PICKS = [];
for (const t of TABLES) {
  if (t.result.success_rate.nogi == null || PICKS.some((p) => p.move === t.move) || ALIAS.has(t.listing.split("/")[0])) continue;
  PICKS.push(t);
  if (PICKS.length === 6) break;
}

test("today no hand deals an overlay: every dealt card is the node at its index", () => {
  const a = app(WIRE);
  let cards = 0, same = 0;
  for (const n of a.nodes) {
    if (n.ty !== "positions" || n.cal?.stateAlias) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = n.idx; a.playerRole = role; a.aiSkill = 0.13;
      for (const o of a.optionsFor(n.idx, role)) { cards++; same += o.node === a.nodes[o.idx] ? 1 : 0; }
    }
  }
  assert.ok(cards > 2000, `${cards} cards dealt over the corpus`);
  assert.equal(same, cards, "B1 moves nothing: no listing carries a table yet");
});

test("a listing's table is dealt, priced, landed and drawn from that listing, and the sheet shows it", () => {
  const { wire, placed } = inject(WIRE, PICKS);
  const a = app(wire);
  // resolve()'s own consumers move the roll (travel, landing): they are stubbed to RECORD the drawn
  // outcome, and nothing else is, so the draw is resolve's own (feedback: stub the DOM, not the state)
  const drawn = [];
  a.enterSuccessCal = (_o, out) => drawn.push(out); a.enterFailCal = (_o, out) => drawn.push(out); a._noteFlow = () => {};
  let checked = 0, landingDiffers = 0;
  for (const { t, posId } of placed) {
    const role = t.listing.split("/")[1];
    const st = a.nodes.find((n) => n.ty === "positions" && n.posId === posId && n.role === role);
    assert.ok(st, t.key + ": the listing state");
    a.currentPos = st.idx; a.playerRole = role; a.aiSkill = 0.13;
    const opt = a.optionsFor(st.idx, role).find((o) => o.node.t === t.move);
    assert.ok(opt, t.key + ": dealt at the listing");
    assert.equal(opt.node.here, posId, t.key + ": the dealt card is the listing overlay");
    assert.equal(a.calSuccess(opt.node, "nogi"), t.result.success_rate.nogi / 100, t.key + ": priced at the listing's rate");
    const canon = a.nodes[opt.idx];
    assert.notDeepEqual(opt.node.cal.outcomes, canon.cal.outcomes, t.key + ": a real difference from the canonical table");
    // the landing is the table's first non-finish success row, resolved and canonicalised
    const row = opt.node.cal.outcomes.find((o) => o.result === "success" && o.to !== "game-over");
    const r = a.resolveOutcomeTo(row.to);
    assert.equal(opt.res, a.canonicalState(r.idx, r.role || role), t.key + ": lands where its own table says");
    if (opt.res !== a.resultPos(opt.idx, st.idx)) landingDiffers++;
    // the draw, through resolve() itself: forced success and forced miss, the outcome rigged across
    // its range; every row drawn is one of the LISTING's rows
    const tos = new Set(opt.node.cal.outcomes.map((o) => o.to));
    for (const branch of [true, false]) {
      a.rig("outcome", [0.001, 0.5, 0.999]);
      for (let i = 0; i < 3; i++) {
        drawn.length = 0;
        a.resolve(opt, branch);
        const out = drawn[0];
        assert.ok(out && tos.has(out.to), t.key + ": resolve drew from the listing's table, got " + (out && out.to));
      }
    }
    // a miss can land back on the listing: every panel table sends one there
    assert.ok(opt.node.cal.outcomes.some((o) => o.result !== "success" && o.to === t.listing), t.key + ": a miss stays here");
    // the option sheet's "Where it leads" is this table (D4)
    const info = a._sheetInfo(opt.node, { outcomes: [{ result: "Success", position: "canonical", prob: 1, tone: "good" }] });
    assert.deepEqual(info.outcomes.map((o) => o.position), opt.node.cal.outcomes.map((o) => o.to.split("/")[0]), t.key + ": the sheet");
    checked++;
  }
  assert.equal(checked, PICKS.length, `${checked} listings checked`);
  assert.ok(checked >= 5, "a non-trivial sample of the panel's tables");
  // the landing parity (case 3, _tableLanding vs _mdp_mechanics.table_landing) is not vacuous: some
  // injected table lands where plain adjacency would not
  assert.ok(landingDiffers >= 1, `${landingDiffers} injected listings land off the adjacency landing`);
});

test("the app capture and _mdp_mechanics agree on a wire that carries listing tables", () => {
  const { wire } = inject(WIRE, PICKS);
  const work = mkdtempSync(resolve(process.env.TMPDIR || tmpdir(), "listing-tables-data-"));
  try {
    writeFileSync(resolve(work, "graph-data.json"), JSON.stringify(wire));
    mkdirSync(resolve(work, "submission-details"));
    for (const f of readdirSync(resolve(ROOT, DATA, "submission-details")))
      copyFileSync(resolve(ROOT, DATA, "submission-details", f), resolve(work, "submission-details", f));
    // a child of the test runner inherits NODE_TEST_CONTEXT and would report over the runner's IPC
    // channel instead of printing TAP, so the context is dropped and the reporter named
    const env = { ...process.env, MDP_DATA_ROOT: work };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", resolve(ROOT, "tests/mdp_data_corpus.test.mjs")],
      { env, encoding: "utf8", timeout: 600000 });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out.slice(-4000));
    assert.match(out, /# pass [1-9]/, "the differential ran");
    assert.match(out, /# fail 0/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
