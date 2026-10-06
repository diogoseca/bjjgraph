// THE ORDINAL-KEYED EAGER WIRE (v1.204.3) — pinned against truths that never pass through an ordinal.
//
// flashcards/_index.json (format 4) and curriculum.json (`scoreWeightsByOrd`) stopped spelling
// "<Name>|<Role>": they key every deck and every belt-score weight by the owning node's permanent
// share ORDINAL, and the reader (neural/src/wire-keys.src.js) derives the name back from the node.
// That is an index-keyed join, and CLAUDE.md §6.6 says exactly how those fail: a wrong remap still
// finds rows and prints a believable number on every card. So nothing here counts non-nulls. Each
// test compares the app's WHOLE decoded structure, through the app's real methods, against a
// NAME-keyed truth built on a different path:
//
//   decks   the per-deck CHUNK files — {deckKey: {cat, role, cards}}, written by the emitter
//           straight from its name-keyed deck dict and never re-keyed. Rebuilt into a FORMAT-3
//           manifest (the old wire, [cat, n] per name) and ingested through the app's legacy
//           branch, it is the old wire's in-memory result; the format-4 ingest must deep-equal it,
//           key ORDER included, because `shared` indexes into that order.
//   weights the tables recomputed from the committed graph.json by the emitter's own
//           `build_score_weights`, in a Python child — the same numbers `validate:score-coverage`
//           reads, keyed by name, never touched by an ordinal.
//
// Plus a non-triviality floor on each, so an empty-on-both-sides result cannot pass.
//
// MUTANTS (v1.204.3) — 20 run, 20 killed, each by the test named below (others may also go red):
//   emitter  E1  deck ordinals shifted to the next live one -> the EMITTER refuses (its round-trip)
//            E1n E1 with that round-trip neutralised, the wire shipped -> "decks:" red here
//            E2  score ordinals shifted likewise -> the emitter refuses
//            E2n E2 neutralised -> "weights:" red here
//            P1  the Python READER off by one -> the emitter refuses
//            D1  ties back in PYTHONHASHSEED order -> the ORDER test red
//   decoder  J1 delta decode off by one · J2 seats swapped · J3 posFamily dropped · J4 a technique's
//            Defender weight not stored · J5 an unresolved ordinal not counted · J6 the name sort
//            removed · J7 the position seat ignored · J9 a duplicate ordinal replacing the first
//            -> red here; J8 a `t` ordinal on a position accepted -> red in neural_score_weights
//   app      A1/A3 decoded without the nodes · A2 the wire_key_unresolved beat dropped -> red here
//   Worker   W1 no graph fetched · W2 the unresolved count dropped -> red in digest_suppress_sync
// NOT COVERED by this file, stated so nobody reads it as covering them:
//   · an OLD bundle meeting the format-4 manifest during the edge-cache skew after a deploy — it
//     ingests zero decks and scores 0 until the next reload (the failure wire-keys.src.js accepts,
//     as v1.145.13 and v1.146.0 did for their curriculum keys; nothing in it deletes progress);
//   · whether wrangler bundles the Worker's cross-tree import at deploy — esbuild does, locally.
//
// Run: node --test tests/neural_wire_keys.test.mjs   (npm run test:units)
import { test } from "node:test";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ngWireDecks, ngWireScoreWeights, ngWireDeckName, ngWireSeats, ngWireCat,
} from "../neural/src/wire-keys.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const NEURAL = R("source/quartz/static/neural");
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const WIRE = JSON.parse(readFileSync(resolve(NEURAL, "graph-data.json"), "utf8"));
const MANIFEST = JSON.parse(readFileSync(resolve(NEURAL, "flashcards/_index.json"), "utf8"));
const CUR = JSON.parse(readFileSync(resolve(NEURAL, "curriculum.json"), "utf8"));

// The bundle concatenates wire-keys.src.js and knowledge-profile.src.js above the class;
// `knowledgeSource` is that same prelude, so this runs the ONE decoder the browser runs.
const Component = new Function(
  "DCLogic", "React", `${knowledgeSource}\n${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

/** The real `ingest`, on the real payload — never a test-side re-implementation (§6.3). */
function app() {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.noteChallenges = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  return a;
}
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const unresolvedBeats = (a) => a.beats.filter((b) => b.beat === "wire_key_unresolved");

/** Truth 1: every deck the chunk files hold, as {key: [cat, n]} in name order — format 3. */
function chunkManifest() {
  const FC = resolve(NEURAL, "flashcards");
  const found = {};
  let files = 0;
  for (const f of readdirSync(FC)) {
    if (f === "_index.json" || !f.endsWith(".json")) continue;
    files++;
    const blob = JSON.parse(readFileSync(resolve(FC, f), "utf8"));
    for (const k in blob) found[k] = [blob[k].cat, blob[k].cards.length];
  }
  const decks = {};
  for (const k of Object.keys(found).sort(byCodeUnit)) decks[k] = found[k];
  return { files, manifest: { _meta: { format: 3 }, decks, shared: MANIFEST.shared } };
}

test("the manifest is format 4: no deck is spelled on the boot path", () => {
  assert.equal(MANIFEST._meta.format, 4);
  assert.equal(MANIFEST.decks, undefined, "format 3's name-keyed `decks` must not ship beside it");
  assert.ok(Array.isArray(MANIFEST.deckOrd.o) && MANIFEST.deckOrd.n.length === 2 * MANIFEST.deckOrd.o.length);
});

test("decks: the ordinal wire ingests to EXACTLY what the old name-keyed wire did — keys, order, cat, n, shared", () => {
  const { files, manifest: OLD } = chunkManifest();
  const neu = app();
  neu._ingestDeckManifest(JSON.parse(JSON.stringify(MANIFEST)));
  const old = app();
  old._ingestDeckManifest(OLD);

  // floor FIRST: two empty maps are deep-equal. The census literal is the whole deck corpus.
  const keys = Object.keys(neu.flashcards.decks);
  assert.ok(keys.length >= 2896, `decoded ${keys.length} decks`); // census:members
  assert.ok(files > 1000, `the truth came from ${files} chunk files`);
  const cats = new Set(keys.map((k) => neu.flashcards.decks[k].cat));
  assert.deepEqual([...cats].sort(), ["Position", "Submission", "Transition"]);

  assert.deepEqual(neu.flashcards.decks, old.flashcards.decks, "every deck's cat and n");
  assert.deepEqual(keys, Object.keys(old.flashcards.decks), "name ORDER — `shared` indexes into it");
  assert.ok(neu._sharedQ && neu._sharedQ.size > 100, `shared index built: ${neu._sharedQ && neu._sharedQ.size}`);
  assert.deepEqual([...neu._sharedQ], [...old._sharedQ], "cross-deck credit resolves to the same decks");
  assert.deepEqual(unresolvedBeats(neu), [], "no ordinal named nothing");
});

/** Truth 2: the emitter's own tables, from graph.json, keyed by NAME — as the integers the wire
 *  carries (round(w * div)), so equality is exact rather than a float tolerance. */
function pythonTables(div) {
  const code = [
    "import sys, json, contextlib",
    "sys.path.insert(0, 'scripts')",
    "import regenerate_neural_data as R",
    "g = json.load(open('graph.json'))",
    "with contextlib.redirect_stdout(sys.stderr):",
    "    t = {fr: R.build_score_weights(g, fr) for fr in ('gi', 'nogi')}",
    `print(json.dumps({fr: {k: round(v * ${div}) for k, v in w.items()} for fr, w in t.items()}))`,
  ].join("\n");
  const out = execFileSync("python3", ["-c", code], {
    cwd: R("."), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out);
}

test("weights: scoreWeights(gi|nogi) decodes to exactly the emitter's name-keyed tables", () => {
  const bo = CUR.scoreWeightsByOrd;
  assert.ok(bo && bo.div, "curriculum.json carries scoreWeightsByOrd");
  assert.equal(CUR.scoreWeightsByRuleset, undefined, "the name-keyed table must not ship beside it");
  const truth = pythonTables(bo.div);
  const a = app();
  a.curriculum = CUR;
  for (const fr of ["gi", "nogi"]) {
    const w = a.scoreWeights(fr);
    const want = truth[fr];
    // floor FIRST: {} deep-equals {}. Both frames score well over a thousand decks.
    assert.ok(Object.keys(want).length > 1000, `${fr}: truth has ${Object.keys(want).length} keys`);
    assert.ok(Object.keys(w).length > 1000, `${fr}: decoded ${Object.keys(w).length} keys`);
    const got = Object.fromEntries(Object.keys(w).map((k) => [k, Math.round(w[k] * bo.div)]));
    const missing = Object.keys(want).filter((k) => !(k in got));
    const invented = Object.keys(got).filter((k) => !(k in want));
    const wrong = Object.keys(want).filter((k) => k in got && got[k] !== want[k]);
    assert.deepEqual({ missing: missing.slice(0, 5), invented: invented.slice(0, 5), wrong: wrong.slice(0, 5) },
      { missing: [], invented: [], wrong: [] }, `${fr}: ${missing.length} missing, ${invented.length} invented, ${wrong.length} wrong`);
    // each frame's table is normalised to 1 across ALL its seats (build_score_weights)
    const total = Object.values(w).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(total - 1) < 1e-3, `${fr}: mass ${total}`);
  }
  assert.deepEqual(unresolvedBeats(a), [], "no ordinal named nothing");
});

test("the app's ingested nodes decode exactly as the raw wire does (the Worker and e2e path)", () => {
  // The app decodes against ITS nodes — after ingest and the pair derivation, where only the rep
  // carries `o`. The digest Worker, e2e/decks.ts and scripts decode against graph-data.json's raw
  // nodes. One function, two node sets: they must agree, or the mail allow-list drifts from the app.
  const a = app();
  a._ingestDeckManifest(JSON.parse(JSON.stringify(MANIFEST)));
  const raw = ngWireDecks(MANIFEST, WIRE.nodes);
  assert.equal(raw.unresolved, 0);
  assert.equal(raw.dupes, 0);
  assert.deepEqual(raw.decks, a.flashcards.decks);
  a.curriculum = CUR;
  for (const fr of ["gi", "nogi"]) {
    const r = ngWireScoreWeights(CUR, fr, WIRE.nodes);
    assert.equal(r.unresolved, 0, fr);
    assert.deepEqual(Object.entries(r.w), Object.entries(a.scoreWeights(fr)), `${fr}: same keys, values AND order`);
  }
});

test("the module's name rule IS deckKeyFor, on every member of every pair", () => {
  // wire-keys.src.js spells the name rule a second time because it must run where the app class
  // does not. This is what keeps the two one rule: every member, both seats, and the category.
  const a = app();
  const byId = new Map(a.nodes.map((n) => [n.id, n]));
  let checked = 0;
  for (const rep of a.nodes.filter((n) => n.rep)) {
    const partner = byId.get(rep.pairId);
    const seats = ngWireSeats(rep);
    assert.equal(ngWireDeckName(rep) + "|" + seats[0], a.deckKeyFor(rep).key, rep.id);
    assert.equal(ngWireCat(rep), a.deckCat(rep), rep.id);
    checked++;
    if (partner) {
      assert.equal(ngWireDeckName(rep) + "|" + seats[1], a.deckKeyFor(partner).key, partner.id);
      checked++;
    }
  }
  assert.equal(checked, 2896, "positive coverage: every member was named"); // census:members
});

test("an ordinal that names no node is COUNTED and announced, never guessed", () => {
  const bad = JSON.parse(JSON.stringify(MANIFEST));
  bad.deckOrd.o = bad.deckOrd.o.concat([100000]);   // one ordinal past any minted one
  bad.deckOrd.n = bad.deckOrd.n.concat([5, 5]);
  const a = app();
  a._ingestDeckManifest(bad);
  const beats = unresolvedBeats(a);
  assert.equal(beats.length, 1, "announced once");
  assert.equal(beats[0].unresolved, 1);
  const good = ngWireDecks(MANIFEST, WIRE.nodes);
  assert.deepEqual(a.flashcards.decks, good.decks, "and nothing was invented in its place");
});

test("a second node claiming an ordinal is COUNTED and never replaces the first", () => {
  // Unreachable on the real wire (the pair derivation gives the partner `o: null`; the emitter
  // mints each ordinal once), so this pins the decoder on a fixture: a broken wire must not be
  // decoded by whichever claimant happened to come last.
  const nodes = [
    { o: 3, ty: "positions", t: "Mount Top" },
    { o: 3, ty: "transitions", t: "Impostor" },
  ];
  const dec = ngWireDecks({ _meta: { format: 4 }, deckOrd: { o: [3], n: [4, 5] }, shared: {} }, nodes);
  assert.equal(dec.dupes, 1);
  assert.deepEqual(dec.decks, { "Mount|Bottom": { cat: "Position", n: 5 }, "Mount|Top": { cat: "Position", n: 4 } });
});

test("the score table's ORDER is deterministic: weight descending, name as the tiebreak", () => {
  // The emitter sorted a Python SET by -max(weight), so ties landed in PYTHONHASHSEED order and
  // the same inputs emitted a different file every run. gameScore sums in this order, so it is
  // pinned here on the emitted file itself: within each block, max weight never rises and a tie
  // is always in name order.
  const bo = CUR.scoreWeightsByOrd;
  const byOrd = new Map(WIRE.nodes.map((n) => [n.o, n]));
  for (const [blk, name] of [["p", (i) => ngWireDeckName(byOrd.get(bo.p.o[i])) + "|" + ngWireSeats(byOrd.get(bo.p.o[i]))[bo.p.r[i]]],
    ["t", (i) => ngWireDeckName(byOrd.get(bo.t.o[i]))]]) {
    const B = bo[blk];
    let ties = 0;
    for (let i = 1; i < B.o.length; i++) {
      const prev = Math.max(B.gi[i - 1], B.nogi[i - 1]), cur = Math.max(B.gi[i], B.nogi[i]);
      assert.ok(cur <= prev, `${blk}[${i}] rises: ${cur} after ${prev}`);
      if (cur === prev) {
        ties++;
        assert.ok(byCodeUnit(name(i - 1), name(i)) < 0, `${blk}[${i}] tie out of name order: ${name(i - 1)} / ${name(i)}`);
      }
    }
    if (blk === "t") assert.ok(ties > 50, `the tiebreak was exercised: ${ties} adjacent ties`);
  }
});
