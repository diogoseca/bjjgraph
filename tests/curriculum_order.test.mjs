// The score-weight wire (`scoreWeightsByRuleset` in static/neural/curriculum.json) is on the first-hand
// payload path, so its bytes must not depend on the Python process's string-hash seed. Until v1.198.4,
// scripts/regenerate_neural_data.py `_compact_score_weights` sorted two SETS of strings by weight alone;
// tied keys kept set-iteration order, which follows PYTHONHASHSEED (random per process, pinned by no
// workflow). Eight seeds gave eight byte streams of the same 96,746 bytes, gzipping 20,888–20,910 B, and one
// draw in eight pushed the first-hand core past the payload delta cap.
//
// This pin emits an OWNED fixture made of ties under several seeds and requires identical bytes. It reads no
// corpus on purpose: a control that samples live content can lose its ties to an ordinary content edit and
// then pass for the wrong reason (CLAUDE.md §6.6 — a user-visible order needs a strict total order whose
// final tiebreak is stable content). Non-vacuity is asserted: the fixture must still contain the ties.
// Red-proved: with the `, k` tiebreak removed from either sort key, this test fails.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

const PY = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "scripts")
from regenerate_neural_data import _compact_score_weights
pos = {f"Pos-{c}": 0.25 for c in "ABCDEFGH"}
pos["Pos-top"] = 0.5
tech = {}
for c in "ABCDEFGH":
    tech[f"Tech-{c}|Attacker"] = tech[f"Tech-{c}|Defender"] = 0.125
tables = {"gi": {**pos, **tech}, "nogi": {**pos, **tech}}
with contextlib.redirect_stdout(io.StringIO()):
    wire = _compact_score_weights(tables)
print(json.dumps(wire))
`

const SEEDS = [0, 1, 2, 3, 4, 5]
const emit = (seed) =>
  execFileSync("python3", ["-B", "-c", PY], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PYTHONHASHSEED: String(seed) },
  }).trim()

test("score-weight wire bytes do not depend on PYTHONHASHSEED: ties are broken by the key", () => {
  const outs = SEEDS.map(emit)
  const wire = JSON.parse(outs[0])

  const tiedPositions = wire.p.k.filter((k) => /^Pos-[A-H]$/.test(k)).length
  const tiedTechniques = wire.t.k.filter((k) => /^Tech-[A-H]$/.test(k)).length
  assert.equal(tiedPositions, 8, "the fixture must still carry its 8 tied position keys")
  assert.equal(tiedTechniques, 8, "the fixture must still carry its 8 tied technique keys")

  for (let i = 1; i < SEEDS.length; i++) {
    assert.equal(outs[i], outs[0], `PYTHONHASHSEED=${SEEDS[i]} emitted different bytes than PYTHONHASHSEED=0`)
  }
  assert.deepEqual(wire.p.k, ["Pos-top", ..."ABCDEFGH".split("").map((c) => `Pos-${c}`)])
  assert.deepEqual(wire.t.k, "ABCDEFGH".split("").map((c) => `Tech-${c}`))
  console.log(`# tied keys exercised: ${tiedPositions} position + ${tiedTechniques} technique, ${SEEDS.length} hash seeds, 1 byte stream`)
})
