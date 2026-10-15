// v1.225.2: the real wire/ingest/myVal/optionsFor path, with only the three formerly
// missing strength pairs removed in the control. This pins the gameplay blast radius;
// it does not assert canvas pixels or replace the browser journeys.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const wire = JSON.parse(read("source/quartz/static/neural/graph-data.json"));
const expected = new Map([
  ["Transitions/Fireman's-Carry", [-0.099, 0.099]],
  ["Transitions/Counter-Entry-to-Opponent's-Leg", [-0.158, 0.158]],
  ["Transitions/100%-Sweep", [0.016, -0.016]],
]);
const Component = new Function("DCLogic", "React",
  `${knowledgeSource}\n${read("neural/src/app.src.jsx")}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

// Use the real lazy loader, replacing only HTTP with the emitted submission chunks.
globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(
  read("source/quartz/static/neural/" + String(url).replace("/strength-test/", "")),
) });

async function app(frame, control = false) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  const data = structuredClone(wire);
  if (control) for (const n of data.nodes) if (expected.has(n.id)) n.s = null;
  a.ingest(data);
  a._giMode = frame; a._rebuildRulesetMask();
  a.flashcards = { decks: {} }; a.prep = {}; a.rec = {}; a.stage = {}; a.srs = {}; a._sharp = {};
  a._dataBase = () => "/strength-test/";
  await Promise.all(a.nodes.filter((n) => n.rep && n.ty === "submissions")
    .map((n) => a.loadSubmissionChoices(n)));
  return a;
}

test("all wire nodes carry strength, including the three punctuation slugs", () => {
  assert.ok(wire.nodes.length > 1400, `wire coverage starved: ${wire.nodes.length}`);
  for (const n of wire.nodes) {
    assert.ok(Array.isArray(n.s) && n.s.length === 2 && n.s.every(Number.isFinite), n.id);
  }
  for (const [id, pair] of expected) {
    assert.deepEqual(wire.nodes.find((n) => n.id === id)?.s, pair, id);
  }
  console.log(`strength coverage: ${wire.nodes.length}/${wire.nodes.length} wire nodes`);
});

test("only the three technique pairs change colour/value; every dealt hand stays identical", async () => {
  let states = 0, cards = 0, submissionStates = 0, submissionOptions = 0;
  const techniqueHands = new Map([...expected.keys()].map((id) => [id, []]));
  for (const frame of ["gi", "nogi"]) {
    const before = await app(frame, true), after = await app(frame);
    assert.equal(after.nodes.length, before.nodes.length);
    const changed = [];
    for (const n of after.nodes) {
      const b = before.nodes[n.idx];
      assert.equal(n.id, b.id);
      if (n.dom !== b.dom) changed.push(n.id);
      for (const a of [before, after]) a.playerRole = n.fromRole || "top";
      if (expected.has(n.id)) {
        assert.equal(after.myVal(n), expected.get(n.id)[0], n.id);
        after.playerRole = n.fromRole === "bottom" ? "top" : "bottom";
        assert.equal(after.myVal(n), expected.get(n.id)[1], n.id);
        if (frame === "gi") console.log(JSON.stringify({
          id: n.id, fromRole: n.fromRole,
          before: { pair: b.s, dom: b.dom, colour: before.hex(b.col) },
          after: { pair: n.s, colours: [after.hex(n.col), after.hex(after.nodes[n.pi].col)] },
        }));
      } else if (!expected.has(after.siteIdOf(n.id))) {
        assert.equal(after.myVal(n), before.myVal(b), n.id);
        assert.deepEqual(n.col, b.col, n.id);
      }
    }
    assert.deepEqual(changed.sort(), [...expected.keys()].flatMap((id) => [id, id + "/Defender"]).sort());
    for (const p of after.nodes.filter((n) => (n.ty === "positions" || n.ty === "submissions") && after.rsAllows(n))) {
      const hands = [before, after].map((a) => {
        a.currentPos = p.idx;
        a.playerRole = p.ty === "positions" ? p.role
          : p.role === "attacker" ? p.fromRole : p.fromRole === "top" ? "bottom" : "top";
        return a.optionsFor(p.idx).map(({ node, ...option }) => ({
          ...option, id: node.id, chance: a.moveChance(node), edge: a.edgeMark({ node, ...option }),
        }));
      });
      if (p.ty === "positions") assert.ok(hands[1].length > 0, `${frame}:${p.id} dealt no cards`);
      assert.deepEqual(hands[1], hands[0], `${frame}:${p.id} changed its hand`);
      for (const o of hands[1]) if (techniqueHands.has(o.id)) techniqueHands.get(o.id).push(`${frame}:${p.id}`);
      if (p.ty === "positions") { states++; cards += hands[1].length; }
      else { submissionStates++; submissionOptions += hands[1].length; }
    }
  }
  assert.ok(states > 450 && cards > 2400, `hand coverage starved: ${states} states, ${cards} cards`);
  assert.ok(submissionStates > 1000 && submissionOptions > 1000,
    `submission coverage starved: ${submissionStates} states, ${submissionOptions} options`);
  // A named technique can already be absent from every hand (e.g. an origin now
  // projected onto a submission state). Report zero honestly; the whole-hand
  // differential above still covers it without inventing a dealt-card requirement.
  console.log(JSON.stringify({ states, cards, submissionStates, submissionOptions,
    changedHands: 0, techniqueHands: Object.fromEntries(techniqueHands) }));
});
