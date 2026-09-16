// Source -> actual emitted chunks/index contracts. No renderer or emitter copies stand in
// for the artifacts a browser fetches. Run regenerate:neural before this suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAYLOAD = join(ROOT, "source/quartz/static/neural");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith(".json") ? [path] : [];
  });
}
const source = Object.fromEntries(["Positions", "Transitions", "Submissions"].map((section) => [
  section, files(join(ROOT, "content", section)).map((path) => ({ path, data: read(path) })),
]));
const families = new Map(source.Submissions.filter(({ data }) => data.is_family)
  .map(({ path, data }) => [path.slice(0, -5), data]));
const familyOf = ({ path }) => families.get(dirname(path));
const chunks = files(join(PAYLOAD, "content"));
const dossiers = Object.assign({}, ...chunks.map(read));
const wire = read(join(PAYLOAD, "graph-data.json"));
const aliases = read(join(PAYLOAD, "aliases.json"));
const ownAliases = (data) => data.aliases || [];
const confuse = (data) => (data?.disambiguations || []).map(({ name, reason }) => ({ n: name, why: reason }));

function eachDossier(fn) {
  for (const [section, records] of Object.entries(source)) {
    for (const record of records) {
      const { data } = record;
      if (data.is_family) continue;
      for (const role of section === "Positions" ? ["top", "bottom"] : [null]) {
        const key = data.name + (role ? `|${role[0].toUpperCase()}${role.slice(1)}` : "");
        assert.ok(dossiers[key], `missing emitted dossier ${key}`);
        fn(dossiers[key], data, section, role, section === "Submissions" ? familyOf(record) : undefined, key);
      }
    }
  }
}

test("all source names and own summaries reach dossiers with family provenance", () => {
  let seen = 0, inherited = 0, own = 0, distinctions = 0;
  eachDossier((dossier, data, section, role, family, key) => {
    seen++;
    assert.equal(dossier.lead, data.summary, `${key}: own summary`);
    assert.deepEqual(dossier.aka || [], ownAliases(data), `${key}: own aliases`);
    assert.deepEqual(dossier.confuse || [], confuse(data), `${key}: own disambiguation`);
    own += !!data.aliases?.length;
    if (family && (family.aliases?.length || family.disambiguations?.length)) {
      assert.equal(dossier.family?.name, family.name, `${key}: source family`);
      assert.deepEqual(dossier.family.aka || [], ownAliases(family));
      assert.deepEqual(dossier.family.confuse || [], confuse(family));
      inherited += !!family.aliases?.length;
      distinctions += !!family.disambiguations?.length;
    } else assert.equal(dossier.family, undefined, `${key}: no invented family`);
  });
  assert.ok(seen > 1000 && own > 0 && inherited > 0 && distinctions > 0, "nontrivial source coverage");
  assert.equal(dossiers["Reverse Armbar from Mount"].family.name, "Armbar");
  assert.equal(dossiers["Rolling Omoplata from Omoplata Control"].family.name, "Omoplata");
  assert.equal(dossiers["Buggy Choke from Half Guard"].family, undefined, "a root leaf is not a family hub");
});

test("both position seats preserve their properties and decision targets", () => {
  let roles = 0, actions = 0;
  eachDossier((dossier, data, section, role, family, key) => {
    if (!role) return;
    roles++;
    const rd = data[role], p = rd.state_properties;
    assert.deepEqual(dossier.props, { pts: p.point_value, type: p.position_type,
      risk: p.risk_level, energy: p.energy_cost, time: p.time_sustainability }, key);
    assert.deepEqual(dossier.drills, rd.training_drills.slice(0, 3).map(({ name, duration }) => ({ n: name, dur: duration })));
    for (let branch = 0; branch < dossier.decisionTree.length; branch++) {
      const emitted = dossier.decisionTree[branch], authored = rd.decision_tree[branch];
      assert.equal(emitted.cond, authored.condition);
      for (let a = 0; a < emitted.acts.length; a++) {
        const raw = authored.actions[a], [technique, probability, target] = emitted.acts[a];
        actions++;
        assert.equal(technique, raw.technique);
        assert.equal(probability, raw.probability);
        assert.equal(target, raw.target === "game-over" ? "Game Over" : raw.target);
        assert.ok(target, `${key}: destination cannot be empty`);
      }
    }
  });
  assert.equal(roles, source.Positions.length * 2);
  assert.ok(actions > 2000);
  assert.equal(dossiers["Mount|Top"].props.pts, 4);
  assert.equal(dossiers["Mount|Bottom"].props.pts, -4);
  assert.equal(dossiers["Knee on Belly|Bottom"].props.pts, 0);
});

test("every leaf submission keeps complete safety instructions and categories", () => {
  let count = 0, longerProtocols = 0;
  eachDossier((dossier, data, section, role, family, key) => {
    if (section !== "Submissions") return;
    count++;
    const sc = data.safety_considerations, safety = dossier.safety;
    assert.deepEqual(dossier.kind, { cat: data.submission_category, type: data.submission_type, area: data.target_area });
    assert.deepEqual(safety.risks, sc.injury_risks.map(({ injury, severity }) => ({ i: injury, sev: severity })), key);
    assert.equal(safety.speed, sc.application_speed, `${key}: application text must not be clipped`);
    assert.deepEqual(safety.tap, sc.tap_signals);
    assert.deepEqual(safety.release, sc.release_protocol);
    assert.deepEqual(safety.restrictions, sc.training_restrictions);
    assert.ok(safety.notice.includes(data.target_area));
    assert.ok(safety.notice.includes(sc.injury_risks[0].injury));
    assert.match(safety.notice, /Tap early; release immediately on the tap/);
    longerProtocols += sc.release_protocol.length > 3;
  });
  assert.equal(count, source.Submissions.filter(({ data }) => !data.is_family).length);
  assert.ok(longerProtocols > 200, "fixtures really exercise protocol entries beyond three");
  assert.ok(dossiers["Inside Heel Hook from Honey Hole"].safety.speed.length > 160);
});

test("all variation shapes and mistake consequences reach their emitted readers", () => {
  let submissions = 0, positions = 0, reasons = 0;
  eachDossier((dossier, data, section, role) => {
    const entries = data.variations || data.variants_and_adaptations || data.variations_and_setups || [];
    if (entries.length) {
      const selected = entries.slice(0, 6);
      assert.deepEqual(dossier.variations, selected.map((entry) => entry.name || entry.variant_name || entry.variation_name));
      for (const name of dossier.variations) assert.ok(dossier.varNote[name], `${data.name}: ${name} lacks context`);
      submissions += section === "Submissions";
      positions += section === "Positions";
    }
    for (const perspective of role ? [role] : ["attacker", "defender"]) {
      const mistakes = role ? dossier.mistakes : dossier.perspectives[perspective].mistakes;
      for (let i = 0; i < mistakes.length; i++) {
        const consequence = data[perspective].common_errors[i].consequence;
        assert.ok(mistakes[i].why, `${data.name}: consequence lost`);
        assert.ok(mistakes[i].why.length <= 140);
        assert.ok(consequence.startsWith(mistakes[i].why.replace(/…$/, "")));
        reasons++;
      }
    }
  });
  assert.ok(submissions > 200 && positions > 0 && reasons > 1000);
});

test("deferred aliases have exact site IDs and match dossier provenance", () => {
  const expected = new Set();
  for (const node of wire.nodes) {
    const section = node.id.split("/")[0];
    const name = section === "Positions" ? node.t.replace(/ Top$/, "") : node.t;
    const record = source[section].find(({ data }) => data.name === name && !data.is_family);
    assert.ok(record, `wire site cannot be independently joined by title: ${node.id}`);
    const { data } = record;
    const family = section === "Submissions" ? familyOf(record) : undefined;
    if (!data.aliases?.length && !family?.aliases?.length) continue;
    expected.add(node.id);
    const actual = aliases[node.id];
    assert.ok(actual, `${node.id}: no deferred record`);
    assert.deepEqual(actual.aka, data.aliases || []);
    if (family?.aliases?.length) assert.deepEqual(actual.family, { name: family.name, aka: family.aliases });
    else assert.equal(actual.family, undefined);
  }
  assert.deepEqual(new Set(Object.keys(aliases)), expected, "no missing or invented sites");
  assert.ok(expected.size > 150);
  assert.ok(chunks.every((path) => statSync(path).size <= 40000), "actual chunk buckets fit the payload ceiling");
});

function python(script) {
  const result = spawnSync("python3", ["-B", "-c", script], {
    cwd: ROOT, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, BJJ_JOIN_STRICT: "0" },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
}

test("synthetic aliases retain order, provenance, and entries beyond six; target probability keeps zero", () => {
  python(String.raw`
import sys
sys.path.insert(0, 'scripts')
import _neural_content as nc
own = {'name': 'Rolling Finish', 'summary': 'A precise variant definition.',
       'aliases': [' First ', 'first', '', *[f'Name {i}' for i in range(7)]]}
family = {'name': 'Family', 'summary': 'General definition.', 'aliases': ['Family synonym'],
          'disambiguations': [{'name': 'Other', 'reason': 'Different mechanics.'}]}
d = nc._technique_dossier(own, 'Transition', {}, hub=family)
assert d['aka'] == ['First', *[f'Name {i}' for i in range(7)]]
assert d['family'] == {'name': 'Family', 'aka': ['Family synonym'],
                       'confuse': [{'n': 'Other', 'why': 'Different mechanics.'}]}
assert d['lead'] == own['summary']
rd = {'decision_tree': [{'condition': 'Blocked', 'actions': [
    {'technique': 'Reset', 'success_rate': 0, 'probability': 75, 'target': 'Guard'},
    {'technique': 'Absent frame', 'success_rate': None, 'probability': 75, 'target': 'Guard'}]}]}
p = nc._position_dossier(rd, 'Bottom')
assert p['decisionTree'][0]['acts'] == [['Reset', 0, 'Guard'], ['Absent frame', None, 'Guard']]
`);
});

test("source-mapping guards refuse lost safety and missing alias sites even in report-only mode", () => {
  python(String.raw`
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
import _neural_content as nc
import regenerate_neural_data as bridge
graph = json.loads(Path('graph.json').read_text())
original = nc._safety
def truncate(source):
    emitted = original(source)
    emitted['release'] = emitted['release'][:3]
    return emitted
nc._safety = truncate
try:
    nc.build_ng_content(graph)
except SystemExit as failure:
    assert 'submission safety missing or truncated: release' in str(failure)
else:
    raise AssertionError('truncated safety emitted successfully with JOIN_STRICT=0')
nodes = json.loads(Path('source/quartz/static/neural/graph-data.json').read_text())['nodes']
nodes = [n for n in nodes if n.get('t') != 'Kosoto Gari']
try:
    bridge.build_alias_index(nodes)
except SystemExit as failure:
    assert 'Kosoto Gari' in str(failure) and 'expected one alias site' in str(failure)
else:
    raise AssertionError('missing alias site emitted successfully with JOIN_STRICT=0')
`);
});
