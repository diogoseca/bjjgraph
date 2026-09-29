// The score-weight wire (`scoreWeightsByOrd` in static/neural/curriculum.json since v1.204.3; it was the
// name-keyed `scoreWeightsByRuleset` before) is on the first-hand payload path, so its bytes must not depend on
// the Python process's string-hash seed. Until v1.198.4, scripts/regenerate_neural_data.py
// `_compact_score_weights` sorted two SETS of strings by weight alone; tied keys kept set-iteration order, which
// follows PYTHONHASHSEED (random per process, pinned by no workflow). Eight seeds gave eight byte streams of the
// same 96,746 bytes, gzipping 20,888–20,910 B, and one draw in eight pushed the first-hand core past the payload
// delta cap.
//
// This pin emits an OWNED fixture made of ties under several seeds and requires identical bytes. It reads no
// corpus on purpose: a control that samples live content can lose its ties to an ordinary content edit and
// then pass for the wrong reason (CLAUDE.md §6.6 — a user-visible order needs a strict total order whose
// final tiebreak is stable content). Non-vacuity is asserted: the fixture must still contain the ties.
// Red-proved: with the `, k` tiebreak removed from the sort key, this test fails.
//
// THE ORDINAL WIRE (v1.204.3). The table now names each entry by its node's share ORDINAL (`p.o` + seat
// `p.r`, `t.o`), so the fixture carries its own graph nodes, and their ordinals run AGAINST name order —
// otherwise a sort that fell back to ordinal order would pass for one that breaks ties by name. The expected
// order is read back through the fixture's own ordinal -> name map.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

const PY = String.raw`
import contextlib, io, json, sys
sys.path.insert(0, "scripts")
from regenerate_neural_data import _compact_score_weights
L = "ABCDEFGH"
# graph-data-shaped nodes; ordinals DESCEND as names ascend, so ordinal order is the reverse of name order
nodes = [{"o": 100 - i, "ty": "positions", "t": f"Pos-{c} Top"} for i, c in enumerate(L)]
nodes += [{"o": 50 - i, "ty": "transitions", "t": f"Tech-{c}"} for i, c in enumerate(L)]
nodes += [{"o": 7, "ty": "positions", "t": "Pos-top Top"}]
pos = {f"Pos-{c}|Top": 0.25 for c in L}
pos["Pos-top|Top"] = 0.5
tech = {}
for c in L:
    tech[f"Tech-{c}|Attacker"] = tech[f"Tech-{c}|Defender"] = 0.125
tables = {"gi": {**pos, **tech}, "nogi": {**pos, **tech}}
with contextlib.redirect_stdout(io.StringIO()):
    wire = _compact_score_weights(tables, nodes)
names = {n["o"]: n["t"] for n in nodes}
print(json.dumps({"wire": wire, "names": names}))
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
  const { wire, names } = JSON.parse(outs[0])
  const pNames = wire.p.o.map((o) => names[o])
  const tNames = wire.t.o.map((o) => names[o])

  const tiedPositions = pNames.filter((t) => /^Pos-[A-H] Top$/.test(t)).length
  const tiedTechniques = tNames.filter((t) => /^Tech-[A-H]$/.test(t)).length
  assert.equal(tiedPositions, 8, "the fixture must still carry its 8 tied position keys")
  assert.equal(tiedTechniques, 8, "the fixture must still carry its 8 tied technique keys")

  for (let i = 1; i < SEEDS.length; i++) {
    assert.equal(outs[i], outs[0], `PYTHONHASHSEED=${SEEDS[i]} emitted different bytes than PYTHONHASHSEED=0`)
  }
  // name order, which here is the REVERSE of ordinal order — a fall back to ordinals cannot pass
  assert.deepEqual(pNames, ["Pos-top Top", ..."ABCDEFGH".split("").map((c) => `Pos-${c} Top`)])
  assert.deepEqual(wire.p.r, Array(9).fill(0), "every fixture weight sits on the Top seat")
  assert.deepEqual(tNames, "ABCDEFGH".split("").map((c) => `Tech-${c}`))
  console.log(`# tied keys exercised: ${tiedPositions} position + ${tiedTechniques} technique, ${SEEDS.length} hash seeds, 1 byte stream`)
})
