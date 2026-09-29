import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => JSON.parse(readFileSync(path, "utf8"));

test("principle sourcing preserves existing instructionals when supplementing Shorts", () => {
  const result = spawnSync("python3", ["-B", "tests/principle_clips.py"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("principle bodies sanitize player fields and stably put Shorts first without changing source", () => {
  const result = spawnSync("python3", ["-B", "-c", `
import copy, json, sys
sys.path.insert(0, 'scripts')
from regenerate_neural_data import _concept_body
data = {'clips': [
    {'id': 'aaaaaaaaaaa', 'title': 'Long lesson', 'by': 'Teacher', 'start': 20, 'end': 50,
     'vertical': False, 'verified': '2026-09-20', 'channel': 'Provenance'},
    {'id': 'invalid', 'title': 'Reject'},
    {'id': 'bbbbbbbbbbb', 'title': 'First Short', 'vertical': True},
    {'id': 'bbbbbbbbbbb', 'title': 'Duplicate'},
    {'id': 'ccccccccccc', 'title': 'Second Short', 'vertical': True},
    {'id': 'ddddddddddd', 'title': 'Second lesson'},
    {'id': 'eeeeeeeeeee', 'title': 'Over cap'}]}
before = copy.deepcopy(data)
out = _concept_body(data, 'Principle')
assert data == before
assert 'clips' not in _concept_body(data, 'Learning')
assert 'clips' not in _concept_body({}, 'Principle')
assert 'clips' not in _concept_body({'clips': []}, 'Principle')
print(json.dumps(out['clips']))
`], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    { id: "bbbbbbbbbbb", title: "First Short", vertical: true },
    { id: "ccccccccccc", title: "Second Short", vertical: true },
    { id: "aaaaaaaaaaa", title: "Long lesson", by: "Teacher", start: 20, end: 50, vertical: false },
    { id: "ddddddddddd", title: "Second lesson" },
  ]);
});

test("every authored principle's clips reach its emitted body, never the lightweight index", () => {
  const payload = resolve(root, "source/quartz/static/neural");
  const concepts = read(resolve(payload, "concepts.json")).concepts.filter((c) => c.cat === "Principle");
  assert.ok(concepts.length > 0, "principle index was emitted");
  const bodies = new Map();
  const keys = new Set(concepts.map((c) => c.key));
  for (const file of readdirSync(resolve(payload, "content")).filter((f) => f.endsWith(".json"))) {
    for (const [key, body] of Object.entries(read(resolve(payload, "content", file)))) {
      if (keys.has(key)) bodies.set(key, body);
    }
  }
  let withClips = 0;
  for (const c of concepts) {
    assert.equal(Object.hasOwn(c, "clips"), false, `${c.id}: videos stay deferred`);
    assert.ok(bodies.has(c.key), `${c.id}: body exists`);
    const authored = read(resolve(root, "content/Principles", c.name + ".json")).clips || [];
    const emitted = bodies.get(c.key).clips || [];
    assert.deepEqual(emitted.map((clip) => clip.id).sort(), authored.map((clip) => clip.id).sort(), c.id);
    let landscapeSeen = false;
    for (const clip of emitted) {
      if (!clip.vertical) landscapeSeen = true;
      else assert.equal(landscapeSeen, false, `${c.id}: Shorts precede longer videos`);
      for (const field of ["id", "title", "by", "start", "end", "vertical"]) {
        assert.equal(clip[field], authored.find((source) => source.id === clip.id)[field], `${c.id}: ${field}`);
      }
      assert.equal(Object.hasOwn(clip, "verified"), false);
      assert.equal(Object.hasOwn(clip, "channel"), false);
    }
    if (emitted.length) withClips++;
  }
  assert.ok(withClips > 0, "positive clip coverage, not an empty-loop pass");
});

test("film thumbnails escape fetched titles and expose keyboard button names", () => {
  const source = readFileSync(resolve(root, "neural/src/app.src.jsx"), "utf8");
  const Component = new Function("DCLogic", "React", `${source}\nreturn Component;`)(
    class {}, { createRef: () => ({ current: null }) },
  );
  const app = Object.create(Component.prototype);
  const html = app.filmStudyHTML([{ id: "aaaaaaaaaaa", title: '<img onerror="bad">', by: "A & B" }]);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Play: &lt;img onerror=&quot;bad&quot;&gt; — A &amp; B"/);
  assert.doesNotMatch(html, /<img onerror/);
  assert.equal(app.filmStudyHTML([]), "");
});
