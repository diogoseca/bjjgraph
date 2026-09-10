import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (path) =>
  JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const source = readFileSync(
  new URL("../neural/src/app.src.jsx", import.meta.url),
  "utf8",
);
const Component = new Function(
  "DCLogic",
  "React",
  `${source}\nreturn Component;`,
)(class {}, { createRef: () => ({ current: null }) });
const wire = read("source/quartz/static/neural/graph-data.json");
const concepts = read("source/quartz/static/neural/concepts.json");
function app(frame = "gi") {
  const a = Object.create(Component.prototype);
  a.settings = {};
  a.track = () => {};
  a.get = (_, fallback) => fallback;
  a.set = () => {};
  a._giMode = frame;
  a.ingest(structuredClone(wire));
  a._giMode = frame;
  a._rebuildRulesetMask();
  a.concepts = structuredClone(concepts.concepts);
  a._onConcepts();
  a.W = 1440;
  a.H = 900;
  return a;
}

test("concept payload gate counts the same highlights as the app across every encoding", () => {
  const a = app();
  const expected = a.concepts.reduce((n, c) => n + c.nodes.length, 0);
  const output = execFileSync("python3", ["-c", `
import json, sys
sys.path.insert(0, 'scripts')
from check_systems_payload import check_concept_membership
from pathlib import Path
root = Path('source/quartz/static/neural')
wire = json.loads((root / 'graph-data.json').read_text())
concepts = json.loads((root / 'concepts.json').read_text())
errors, total = check_concept_membership(concepts, {n['id']: n for n in wire['nodes']})
assert not errors, errors
print(total)
`], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(Number(output.trim()), expected);
  assert(expected > 690, "must exercise actual concept highlights");
});

test("concept payload gate rejects dead memberships and inflated coverage metadata", () => {
  execFileSync("python3", ["-c", `
import sys
sys.path.insert(0, 'scripts')
from check_systems_payload import check_concept_membership
# Sparse permanent ordinals deliberately differ from array indexes.
graph = {'A': {'o': 0}, 'B': {'o': 5}, 'C': {'o': 9}}
def check(concepts, count):
    return check_concept_membership({'concepts': concepts, '_meta': {'nodes': count}}, graph)
assert check([{'allNodes': True}, {'nodeMask': '220'}, {'nodes': ['A']}], 6) == ([], 6)
for encoded in ('', '-1', 'xyz', 1, None):
    errors, total = check([{'nodeMask': encoded}], 0)
    assert errors and total == 0, (encoded, errors, total)
errors, total = check([{'nodeMask': '222'}], 3)
assert any('ordinals absent' in e for e in errors) and total == 2
errors, total = check([{'nodes': ['A', 'gone']}], 2)
assert any('nodes absent' in e for e in errors) and total == 1
errors, total = check([{'nodes': ['A', 'A']}], 2)
assert any('_meta.nodes' in e for e in errors) and total == 1
assert check([{'nodes': []}], 100)[0]
assert check([{'nodeMask': '0'}], 0) == ([], 0)
`], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
});

test("principle coverage includes both roles, every category, and respects the ruleset", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = app(frame),
      c = a._conceptsById["Principles/Alignment"];
    a.focusConcept(c);
    const expected = a.nodes.filter((n) => a.rsAllowsIdx(n.idx));
    assert.equal(a._focusIdxSet.size, expected.length);
    assert(expected.length > 2000);
    assert.deepEqual(
      new Set(expected.map((n) => n.role)),
      new Set(["top", "bottom", "attacker", "defender"]),
    );
    for (const n of expected) assert(a._focusIdxSet.has(n.idx), n.id);
  }
});

test("specific principles highlight relevant families and leave unrelated submissions dim", () => {
  const a = app(),
    c = a._conceptsById["Principles/Compression-Locks"];
  a.focusConcept(c);
  const slicers = a.nodes.filter((n) =>
    n.id.startsWith("Submissions/Bicep-Slicer/"),
  );
  const armbars = a.nodes.filter((n) => n.id.startsWith("Submissions/Armbar/"));
  assert(slicers.length >= 2 && armbars.length >= 4);
  for (const n of slicers) assert(a._focusIdxSet.has(n.idx), n.id);
  assert(
    armbars.some((n) => !a._focusIdxSet.has(n.idx)),
    "unrelated armbar family must not be swept in by adjacency",
  );
  for (const i of a._focusIdxSet) {
    const twin = a._idIndex.get(a.nodes[i].pairId);
    if (twin != null) assert(a._focusIdxSet.has(twin));
  }
});

test("principle framing settles on the whole graph and survives an expired camera lease", () => {
  const a = app(),
    c = a._conceptsById["Principles/Compression-Locks"];
  a._conceptId = c.id;
  a.now = 100;
  a.startTime = 0;
  a.introDone = true;
  a.userActiveNow = () => false;
  a.cfg = () => ({ cameraMode: "Follow" });
  a.rollCamTarget = () => ({ cx: 99999, cy: 99999, vw: 10 });
  a.cam = { cx: 0, cy: 0, vw: 10, lvw: Math.log(10) };
  // A narrow principle is the case where framing just its members could hide the rest.
  a.focusConcept({ ...c, nodes: [c.nodes[0]], _idxs: null });
  a.releaseCamera();
  for (let i = 0; i < 600; i++) a.updateCamera(1 / 60);
  for (const n of a.nodes.filter((n) => n.rep && a.rsAllowsIdx(n.idx))) {
    const x = ((n.x - a.cam.cx) * a.W) / a.cam.vw + a.W / 2;
    const y = ((n.y - a.cam.cy) * a.W) / a.cam.vw + a.H / 2;
    assert(x > 0 && x < a.W && y > 0 && y < a.H, n.id);
  }
});

test("emitter validates principle schemas, resolves families, and stays within payload budgets", () => {
  const output = execFileSync(
    "python3",
    [
      "-c",
      `
import json, pathlib, sys, contextlib, io
import jsonschema
sys.path.insert(0, 'scripts')
from regenerate_neural_data import build_concepts, build_systems
root = pathlib.Path('.')
schema = json.loads((root/'templates/Principles.json').read_text())
files = list((root/'content/Principles').glob('*.json'))
assert len(files) >= 62
for path in files:
    data = json.loads(path.read_text())
    jsonschema.validate(data, schema)
    assert data.get('graph_applicability'), path
wire = json.loads((root/'source/quartz/static/neural/graph-data.json').read_text())
with contextlib.redirect_stdout(io.StringIO()):
    index, bodies = build_concepts([n['id'] for n in wire['nodes']])
raw = lambda d: len(json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode())
systems = json.loads((root/'source/quartz/static/neural/systems.json').read_text())
assert raw(index) + raw(systems) <= 500000, raw(index) + raw(systems)
assert max(map(raw, bodies.values())) <= 40000
principles = [c for c in index['concepts'] if c['cat'] == 'Principle']
assert all(c.get('allNodes') or c.get('nodeMask') for c in principles)
assert len([c for c in principles if c.get('allNodes')]) >= 20
print(f'{len(principles)} principles; deferred {raw(index)+raw(systems)} bytes; largest concept {max(map(raw,bodies.values()))} bytes')
`,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      maxBuffer: 2_000_000,
    },
  );
  assert.match(output, /\d+ principles; deferred/);
});

test("switching rulesets refreshes an open principle without losing its selected page", () => {
  const a = app("gi");
  a._conceptId = "Principles/Alignment";
  a.explorerListRef = { current: null };
  a.focusConcept(a._conceptsById[a._conceptId]);
  const full = a._focusIdxSet.size;
  a.setGiMode("nogi");
  assert(a._focusIdxSet.size < full);
  assert.equal(a._conceptId, "Principles/Alignment");
  for (const i of a._focusIdxSet) assert(a.rsAllowsIdx(i));
  a.setGiMode("gi");
  assert.equal(a._focusIdxSet.size, full);
});
