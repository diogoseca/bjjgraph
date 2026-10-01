// A LISTING ABSENT IN ONE RULESET IS NOT DEALT THERE (v1.215.0, origin coherence; OCPRB7).
//
// `cal.avail` masks a move out of a frame altogether. It cannot say "dealt at THIS listing in gi but
// not in no-gi", and `optionsFor` / `_mdp_mechanics.options` never read a listing's attempt share,
// so such a listing would be dealt where it does not exist while build_hand drops it. The wire now
// names those listings per frame (`absentAt`, regenerate_neural_data.listing_absences), and both
// dealers skip them. Cases 2 and 3 inject one at a state both rulesets reach.
//   1. Today (v1.216.0, B2) the only absences are B2's 4 gi-only `deal_here` tables at states no-gi
//      masks (worm, spider, lasso and double-sleeve guard).
//   2. Injected on a real dealt listing (a `deal_here` one and an origin one): the card is not dealt
//      there in no-gi, is dealt there in gi, and every OTHER hand is exactly what it was.
//   3. The app-vs-_mdp_mechanics differential (tests/mdp_data_corpus.test.mjs) passes on that wire, in
//      both rulesets, so the producer skips exactly what the app skips.
//   4. A FLIP at one of those masked states (full-game review OCPRB8-FG). `setGiMode` does not re-seat,
//      so a player standing there in gi who flips to no-gi is dealt there in no-gi. Gi deals the
//      listing's table; no-gi never does, whatever else the relaxed fallback deals. With the absences
//      the flipped no-gi hands are exactly the pre-B2 ones (measured against dev + PR 252).
// MUTANTS (each turns this file red; measured at v1.215.0):
//   - optionsFor ignoring absentAt: cases 2 and 3;
//   - _mdp_mechanics.options ignoring absent_at: case 3;
//   - the member copy dropping absentAt (ingest): case 2;
//   - listing_absences not naming a listing at a state the frame masks (v1.216.0): case 4, which then
//     deals the gi-only table at all 4 states in no-gi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + read("neural/src/app.src.jsx") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const DATA = "source/quartz/static/neural";
const WIRE = JSON.parse(read(DATA + "/graph-data.json"));
const GRAPH = JSON.parse(read("graph.json"));

function app(wire, frame) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.get = (_k, d) => d; a.set = a.track = a._saveProgress = () => {};
  a.noteChallenges = () => {};   // challenge bookkeeping on a fallback beat, not the hand
  a.ingest(structuredClone(wire));
  a._giMode = frame;
  return a;
}

// two real listings the game deals today: a `deal_here` one, and a technique's own origin
const TECH = Object.fromEntries(["transitions", "submissions"].flatMap((c) => Object.entries(GRAPH[c])).filter(([k]) => k.endsWith("/attacker")).map(([k, v]) => [k.slice(0, -9), v]));
const ALIAS = new Set(WIRE.nodes.filter((n) => n.ty === "positions" && n.cal?.stateAlias).map((n) => n.posId));
const USED = new Set();   // the two picks sit at DIFFERENT states, so each moves its own hand
function pick(pred) {
  for (const [pk, p] of Object.entries(GRAPH.positions)) for (const t of p.transitions || []) {
    const tv = TECH[t.target];
    if (!tv || tv.fromRole !== p.role || ALIAS.has(p.hub) || USED.has(pk) || !pred(p, t, tv)) continue;
    const cells = t.attemptProbabilityByRuleset || {};
    if (!(cells.gi > 0 && cells.nogi > 0)) continue;
    USED.add(pk);
    return { posId: p.hub, role: p.role, name: t.technique, tv };
  }
  throw new Error("no listing found");
}
const PICKS = [pick((_p, t) => t.dealHere === true), pick((p, t, tv) => tv.fromPositionId === p.hub && !t.dealHere)];

function inject(wire) {
  const w = structuredClone(wire);
  for (const x of PICKS) {
    const n = w.nodes.find((m) => m.t === x.name && m.ty !== "positions");
    assert.ok(n, x.name + ": on the wire");
    n.absentAt = { nogi: [...new Set([...((n.absentAt || {}).nogi || []), x.posId])].sort() };
  }
  return w;
}
function hands(a) {
  const out = new Map();
  for (const n of a.nodes) {
    if (n.ty !== "positions" || n.cal?.stateAlias) continue;
    for (const role of ["top", "bottom"]) {
      a.currentPos = n.idx; a.playerRole = role; a.aiSkill = 0.13;
      // keyed by SITE: a state is drawn as two pair members, and both deal the same hand for a role
      out.set(n.posId + "/" + role, a.optionsFor(n.idx, role).map((o) => o.node.id).sort().join("|"));
    }
  }
  return out;
}

// every absence on today's wire, as [node, posId, frame]
const TODAY = WIRE.nodes.filter((n) => n.absentAt).flatMap((n) => Object.entries(n.absentAt).flatMap(([fr, ps]) => ps.map((p) => [n, p, fr])));

test("today the only absences are at states no-gi masks", () => {
  assert.equal(TODAY.length, 4, "B2's 4 gi-only deal_here tables at states no-gi never reaches");
  const a = app(WIRE, "nogi");
  for (const [n, posId, fr] of TODAY) {
    assert.equal(fr, "nogi", n.t);
    const st = a.nodes.find((m) => m.ty === "positions" && m.posId === posId && m.role === n.fromRole);
    assert.ok(st && !a.rsAllows(st), `${n.t} at ${posId}: a state the no-gi mask excludes`);
  }
});

test("a listing absent in no-gi is not dealt there in no-gi, is dealt in gi, and no other hand moves", () => {
  const w = inject(WIRE);
  for (const frame of ["nogi", "gi"]) {
    const before = hands(app(WIRE, frame)), after = hands(app(w, frame));
    let moved = 0;
    for (const [k, v] of before) if (after.get(k) !== v) moved++;
    const a = app(w, frame);
    for (const x of PICKS) {
      const st = a.nodes.find((n) => n.ty === "positions" && n.posId === x.posId && n.role === x.role);
      a.currentPos = st.idx; a.playerRole = x.role; a.aiSkill = 0.13;
      const dealt = a.optionsFor(st.idx, x.role).some((o) => o.node.t === x.name);
      assert.equal(dealt, frame === "gi", `${x.name} at ${x.posId}/${x.role}: dealt in ${frame}? ${dealt}`);
    }
    assert.equal(moved, frame === "nogi" ? PICKS.length : 0, `${frame}: exactly the absent listings' hands moved (${moved})`);
  }
});

test("the app capture and _mdp_mechanics skip the same listings, in both rulesets", () => {
  const work = mkdtempSync(resolve(process.env.TMPDIR || tmpdir(), "listing-absence-data-"));
  try {
    writeFileSync(resolve(work, "graph-data.json"), JSON.stringify(inject(WIRE)));
    mkdirSync(resolve(work, "submission-details"));
    for (const f of readdirSync(resolve(ROOT, DATA, "submission-details")))
      copyFileSync(resolve(ROOT, DATA, "submission-details", f), resolve(work, "submission-details", f));
    // a child of the test runner would report over its IPC channel: drop the context, name the reporter
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

// the flip case's states come from graph.json, NOT from the wire's absentAt, so a wire that dropped them
// cannot make it vacuous: every deal_here listing whose no-gi attempt is null, at a state no-gi masks.
// 7 today: 4 kept out of the no-gi hand by absentAt, and 3 whose MOVE the no-gi mask removes outright
// (Tripod Sweep, Leg Extraction from Lapel Wrap, Collar Drag from Open Guard)
const MASKED_NULL = (() => {
  const a = app(WIRE, "nogi"), out = [];
  for (const p of Object.values(GRAPH.positions)) for (const t of p.transitions || []) {
    if (!t.dealHere || (t.attemptProbabilityByRuleset || {}).nogi !== null) continue;
    const st = a.nodes.find((m) => m.ty === "positions" && m.posId === p.hub && m.role === p.role);
    if (st && !a.rsAllows(st)) out.push([WIRE.nodes.find((m) => m.t === t.technique && m.ty !== "positions"), p.hub]);
  }
  return out;
})();

test("a flip to no-gi at a masked state never deals the gi-only table there (setGiMode does not re-seat)", () => {
  assert.equal(MASKED_NULL.length, 7, "B2's gi-only deal_here tables at states no-gi masks");
  for (const [n, posId] of MASKED_NULL) {
    const a = app(WIRE, "gi");
    a._syncBelt = a._gameValueChanged = () => {};   // the belt and the value worker, not the hand
    a.explorerListRef = { current: null };
    const st = a.nodes.find((m) => m.ty === "positions" && m.posId === posId && m.role === n.fromRole);
    a.currentPos = st.idx; a.playerRole = n.fromRole; a.aiSkill = 0.13;
    const table = () => a.optionsFor(st.idx, n.fromRole).filter((o) => o.node.t === n.t && o.node.here === posId);
    assert.equal(table().length, 1, `${n.t} at ${posId}: gi deals the listing's own table`);
    a.setGiMode("nogi");
    assert.equal(a.currentPos, st.idx, "the flip does not re-seat");
    assert.equal(table().length, 0, `${n.t} at ${posId}: no-gi deals the gi-only table`);
  }
  assert.equal(MASKED_NULL.filter(([n]) => n.absentAt).length, 4, "4 of them carried by absentAt");
});
