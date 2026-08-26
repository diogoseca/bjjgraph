// Pure-unit contract for the graph-data WIRE EXPANSION (v1.144.0).
//
// graph-data.json is the largest boot payload, so it ships COMPACT and `ingest()` expands it
// back into the shapes every reader downstream already knew (v1.107.0). Each compaction that
// goes onto that wire buys bytes with a decode, and a decode that quietly stops running does not
// crash: it hands `drawOutcome`, `resolve` and `_deriveDualPairs` a value of the wrong TYPE,
// which they answer with `{idx:-1}` / an empty landing map — a plausible, silent, wrong graph
// (CLAUDE.md §6.6). That is what this file exists to make loud.
//
// The v1.144.0 addition it was written for: outcome DESTINATIONS are interned. The corpus names
// 293 distinct places a branch can land and writes them 4,160 times, so the wire carries the
// strings once in `toTab` and an outcome's first slot is an index into it (64,272 B raw /
// 2,809 B gzip off the boot payload). Drop the lookup and every `to` is a number.
//
// WHAT THIS FILE GATES, AND WHAT IT DOES NOT (§6.9):
//   Pinned here          — the decode RUNS: no `to` survives as a number, and every destination
//                          still resolves to a state the game can enter.
//   Partially pinned     — a PERMUTED table (an emitter bug that files consistent but WRONG
//                          indexes). A rotate-by-one was caught here, but only because it moved
//                          `game-over` onto a slug that resolves to nothing; a permutation
//                          among position slugs would leave every destination a resolvable
//                          string and this file would stay green while every card pointed
//                          somewhere else. The gate for that is a differential against the
//                          previous emitter — `tests/artifacts/_verify_wire_intern.py`, which
//                          compares the DECODED wire byte-for-byte against the pre-intern
//                          emitter's own output. Run it whenever you touch the emitter.
//
// It reads the EMITTED wire, at module top level, exactly like tests/flow.test.mjs — the payload
// is generated (gitignored), so ci-validate.yml emits it in the step above "Pure unit suites".
// Run: npm run regenerate:neural && node --test tests/neural_wire_expansion.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));

const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);

/** The real `ingest`, on the real payload — never a spec-side re-implementation (§6.3). */
function booted(wire) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(wire)));
  return a;
}

/** Every outcome row the app is holding after ingest, flattened. */
function outcomeRows(a) {
  const rows = [];
  for (const n of a.nodes) {
    const outs = n.cal && n.cal.outcomes;
    if (Array.isArray(outs)) for (const o of outs) rows.push(o);
  }
  return rows;
}

const APP = booted(WIRE);
const ROWS = outcomeRows(APP);

test("the emitted wire really is interned — otherwise this file is measuring nothing", () => {
  // A gate whose subject is absent from its input passes for the wrong reason (§6.6). If the
  // emitter stops interning, this says so instead of silently becoming a no-op.
  assert.ok(Array.isArray(WIRE.toTab) && WIRE.toTab.length > 0, "graph-data.json carries no toTab");
  const slots = WIRE.nodes.flatMap((n) => ((n.cal && n.cal.outcomes) || []).map((o) => o[0]));
  assert.ok(slots.length >= 4000, `only ${slots.length} outcome rows on the wire`);
  assert.equal(
    slots.filter((s) => typeof s !== "number").length, 0,
    "an outcome slot on the wire is not an index — the intern is partial",
  );
  assert.ok(
    WIRE.toTab.length * 4 < slots.length,
    `a ${WIRE.toTab.length}-entry table for ${slots.length} references is not worth interning`,
  );
});

test("ingest decodes every outcome destination back to a string", () => {
  assert.ok(ROWS.length >= 4000, `only ${ROWS.length} outcome rows after ingest`);
  const bad = ROWS.filter((o) => typeof o.to !== "string");
  assert.equal(bad.length, 0, `${bad.length} destinations survived ingest as non-strings`);
  // and the table was really consulted: one collapsed entry would also be "all strings"
  const distinct = new Set(ROWS.map((o) => o.to));
  assert.ok(distinct.size > 100, `only ${distinct.size} distinct destinations — the decode collapsed`);
});

test("every authored destination resolves to a state the game can enter", () => {
  // The payoff assertion: `resolveOutcomeTo` is what `resolve()` and `opponentDefend` call, and
  // it answers a wrong-TYPE destination with {idx:-1} rather than throwing. Measured on the
  // shipped wire: 4,160 rows = 3,863 node landings + 297 game-over, and ZERO unresolved.
  let node = 0, terminal = 0;
  const unresolved = [];
  for (const o of ROWS) {
    const r = APP.resolveOutcomeTo(o.to);
    if (r.terminal) terminal++;
    else if (r.idx >= 0) node++;
    else unresolved.push(o.to);
  }
  assert.deepEqual(unresolved.slice(0, 8), [], `${unresolved.length} outcome destinations resolve to nothing`);
  assert.equal(node + terminal, ROWS.length);
  assert.ok(node >= 3800, `only ${node} destinations land on a node`);
  assert.ok(terminal >= 250, `only ${terminal} destinations are game-over — submissions lost their finish`);
});

test("a wire with plain-string destinations still expands (the fixture path)", () => {
  // The fork is per SLOT, so an old file on a CDN edge, or a spec-authored fixture, keeps
  // working. Pinning it here is what makes that claim more than a comment.
  const plain = JSON.parse(JSON.stringify(WIRE));
  const tab = plain.toTab;
  delete plain.toTab;
  for (const n of plain.nodes)
    for (const o of ((n.cal && n.cal.outcomes) || [])) o[0] = tab[o[0]];
  const rows = outcomeRows(booted(plain));
  assert.equal(rows.length, ROWS.length);
  assert.deepEqual(rows.map((o) => o.to), ROWS.map((o) => o.to));
});
