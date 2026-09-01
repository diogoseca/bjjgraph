// Fork-safety gate for the weekly proofread bot:
//   node --test tests/proofread_fork_safety.test.mjs
//
// WHAT THIS IS FOR. `scripts/proofread_all_transitions.py` is labelled an audit but it MUTATES
// AND SAVES authored content, and `.github/workflows/proofread-bot.yml` opens a PR from what it
// writes. Until v1.153.1 it loaded through `reduce_to_scalar(frame="nogi")` and saved THAT, so a
// single list edit collapsed every {gi,nogi} map in the file to its no-gi cell and destroyed the
// authored gi value. Nothing went red: the schema accepts int OR map, and the next
// `npm run migrate:ruleset` re-mirrors the survivor, so the loss leaves no trace anywhere.
// Measured on the one real bot run (493bd838e, Submissions, 18 files): 72 of 72 ruleset maps
// de-forked, and ZERO probability values actually changed — 100% of the damage was collateral
// from the load path.
//
// These tests drive the REAL script over a throwaway corpus with a canned LLM response
// (--stub-response), never a re-implementation of its rules (CLAUDE.md §6.3).
//
//   1. COLLATERAL IS IMPOSSIBLE. An edit that touches only a list must leave every probability
//      cell BYTE-IDENTICAL, maps included. This is the mutant that matters: re-arm the reduced
//      load and this goes red.
//   2. AN AUDITED PROBABILITY IS A NO-GI VERDICT. The model reads the no-gi frame, so its number
//      lands in `nogi` and the authored `gi` survives untouched — and each frame independently
//      still sums to 100 (CLAUDE.md §7).
//   3. LIST EDITS STAY INSIDE THE SCHEMA. The audit used to remove `from_positions` past the
//      schema's minItems and append a bare string to a FAMILY hub's object-form
//      `related_submissions`, so the bot's own validate step reverted the file. Measured on the
//      v1.154.1 Submissions re-run: 12 of 30 files discarded that way (9 to the floor, 3 to the
//      object form). These two tests are the floor and the shape.
//   4. THE GATE CANNOT PASS ON NOTHING. The preserved-map count is printed and must be positive;
//      a run that preserved zero maps because it never saw any is not a pass (CLAUDE.md §6.6).
//
// NOT COVERED, so nobody reads this file as more than it is: the inference call itself, the
// prompt text, `--dry-run`, and the workflow's validate/revert step are untested here. The
// null-frame skip in `_prob_write` has no fixture because content carries 0 null cells today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/proofread_all_transitions.py");

/** A position whose attempt_probability cells are DIVERGENT — the thing being protected. */
const FORKED_POSITION = {
  name: "Fixture Control",
  slug: "fixture-control",
  position_type: "neutral",
  top: {
    transitions: [
      { transition: "Fixture Sweep", attempt_probability: { gi: 37, nogi: 41 } },
      { transition: "Fixture Pass", attempt_probability: { gi: 23, nogi: 20 } },
      { transition: "Fixture Back Take", attempt_probability: { gi: 40, nogi: 39 } },
    ],
  },
  bottom: {
    transitions: [
      { transition: "Fixture Escape", attempt_probability: { gi: 55, nogi: 52 } },
      { transition: "Fixture Recover", attempt_probability: { gi: 45, nogi: 48 } },
    ],
  },
};

/** A transition, forked the way the whole corpus is. Reproduces the real bot run's shape:
 *  the audit edits `from_position` and every probability in the file is collateral. */
const FORKED_TRANSITION = {
  name: "Fixture Sweep",
  slug: "fixture-sweep",
  from_position: "Mount/Bottom",
  success_rate: { gi: 68, nogi: 62 },
  outcomes: [
    { to: "Mount/Top", probability: { gi: 60, nogi: 55 }, result: "success" },
    { to: "Closed Guard/Bottom", probability: { gi: 25, nogi: 30 }, result: "failure" },
    { to: "Side Control/Bottom", probability: { gi: 15, nogi: 15 }, result: "counter" },
  ],
};

const NO_CHANGES = {
  top_transitions_to_remove: [], top_transitions_to_add: [], top_probability_adjustments: [],
  bottom_transitions_to_remove: [], bottom_transitions_to_add: [], bottom_probability_adjustments: [],
  outcomes_to_remove: [], outcomes_to_add: [], outcome_probability_adjustments: [],
  from_positions_to_remove: [], from_positions_to_add: [],
  related_submissions_to_remove: [], related_submissions_to_add: [],
};

/** Run the real script over a scratch corpus; returns { stdout, before, after }. */
function runAudit({ dir: sub, name, doc, changes }) {
  const dir = mkdtempSync(join(tmpdir(), "proofread-fork-"));
  try {
    for (const c of ["Positions", "Transitions", "Submissions"]) {
      mkdirSync(join(dir, "content", c), { recursive: true });
    }
    // The bot always runs from the repo root, so the real schemas are on hand — the script
    // resolves list bounds through validate_json.load_schema, which reads templates/ relatively.
    cpSync(resolve(ROOT, "templates"), join(dir, "templates"), { recursive: true });
    const target = join(dir, "content", sub, `${name}.json`);
    writeFileSync(target, JSON.stringify(doc, null, 2) + "\n");
    const before = readFileSync(target, "utf8");

    const stub = join(dir, "stub.json");
    writeFileSync(stub, JSON.stringify({
      file_name: `${name}.json`, has_changes: true, reasoning: "fixture",
      changes: { ...NO_CHANGES, ...changes }, suggested_new_files: [],
    }));

    const r = spawnSync("python3", [SCRIPT, "--file", target, "--stub-response", stub, "--batch"],
      { cwd: dir, encoding: "utf8" });
    return { stdout: `${r.stdout}${r.stderr}`, before, after: readFileSync(target, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const LIST_ONLY = {
  dir: "Transitions", name: "Fixture Sweep", doc: FORKED_TRANSITION,
  changes: { from_position_fix: { current: "Mount/Bottom", suggested: "Closed Guard/Bottom", reason: "fixture" } },
};

test("a non-probability edit leaves every ruleset map byte-identical", () => {
  const { after, before, stdout } = runAudit(LIST_ONLY);
  const a = JSON.parse(after), b = JSON.parse(before);

  // the edit itself landed, so this is not a vacuous pass
  assert.equal(a.from_position, "Closed Guard/Bottom", `edit did not apply.\n${stdout}`);

  assert.deepEqual(a.success_rate, b.success_rate,
    `success_rate was de-forked by an edit that never touched it.\n${stdout}`);
  assert.deepEqual(a.outcomes, b.outcomes,
    `outcome probabilities were rewritten by an edit that never touched them.\n${stdout}`);
});

test("an audited probability moves ONLY the no-gi cell; gi survives; both frames sum to 100", () => {
  const { after, stdout } = runAudit({
    dir: "Positions", name: "Fixture Control", doc: FORKED_POSITION,
    changes: {
      top_probability_adjustments: [
        { transition: "Fixture Sweep", current: 41, suggested: 50, reason: "fixture" },
      ],
    },
  });
  const a = JSON.parse(after);
  const byName = Object.fromEntries(a.top.transitions.map((t) => [t.transition, t.attempt_probability]));

  assert.equal(byName["Fixture Sweep"].gi, 37, `authored gi was overwritten by a no-gi verdict.\n${stdout}`);
  assert.ok(byName["Fixture Sweep"].nogi >= 45, `no-gi verdict did not land.\n${stdout}`);

  for (const rs of ["gi", "nogi"]) {
    const sum = a.top.transitions.reduce((n, t) => n + t.attempt_probability[rs], 0);
    assert.equal(sum, 100, `top ${rs} frame sums to ${sum}, not 100.\n${stdout}`);
  }
  // the gi frame already summed to 100, so it is not renormalized at all
  assert.equal(byName["Fixture Pass"].gi, 23, `gi frame was renormalized off a no-gi edit.\n${stdout}`);
  // the untouched role is not disturbed
  assert.deepEqual(a.bottom.transitions.map((t) => t.attempt_probability),
    [{ gi: 55, nogi: 52 }, { gi: 45, nogi: 48 }], `bottom role was disturbed.\n${stdout}`);
});

test("the save prints a POSITIVE preserved-map count, so it cannot pass on nothing", () => {
  const { stdout } = runAudit(LIST_ONLY);
  const m = stdout.match(/Ruleset maps preserved: (\d+)\/(\d+)/);
  assert.ok(m, `no preserved-map count printed — the gate did not run.\n${stdout}`);
  assert.equal(m[1], m[2], `maps were lost: ${m[0]}`);
  assert.ok(Number(m[1]) > 0, `preserved-map count is zero — nothing was actually checked.\n${stdout}`);
});

/** A DUAL submission: schema wants from_positions minItems 2, related_submissions minItems 3. */
const DUAL_SUBMISSION = {
  name: "Fixture Lock", slug: "fixture-lock",
  starting_position: "Mount", from_position: "Mount/Top",
  success_rate: { gi: 68, nogi: 62 },
  from_positions: ["Mount", "S Mount"],
  related_submissions: ["Armbar", "Kimura", "Americana"],
  outcomes: [
    { to: "game-over", probability: { gi: 60, nogi: 55 }, result: "success" },
    { to: "Mount/Top", probability: { gi: 40, nogi: 45 }, result: "failure" },
  ],
  attacker: {}, defender: {},
};

/** A FAMILY hub: related_submissions items are {name, relationship} OBJECTS, not strings. */
const FAMILY_HUB = {
  name: "Fixture Family", slug: "fixture-family", is_family: true,
  from_positions: ["Mount", "Side Control"],
  related_submissions: [{ name: "Kimura", relationship: "sister shoulder lock" }],
  variations: [{ name: "Fixture Family/from Mount" }],
};

test("a removal never takes a list below its schema floor", () => {
  const { after, stdout } = runAudit({
    dir: "Submissions", name: "Fixture Lock", doc: DUAL_SUBMISSION,
    changes: {
      from_positions_to_remove: [{ position: "S Mount", reason: "fixture" }],
      related_submissions_to_remove: [{ name: "Americana", reason: "fixture" }],
      from_positions_to_add: [{ position: "High Mount", reason: "fixture" }],
    },
  });
  const a = JSON.parse(after);
  // from_positions is at minItems 2 -> the removal is refused, the addition still lands
  assert.ok(a.from_positions.includes("S Mount"),
    `removal took from_positions below its schema floor.\n${stdout}`);
  assert.ok(a.from_positions.includes("High Mount"), `addition did not land.\n${stdout}`);
  // related_submissions is at minItems 3 -> that removal is refused too
  assert.equal(a.related_submissions.length, 3,
    `removal took related_submissions below its schema floor.\n${stdout}`);
  assert.match(stdout, /schema floor/, `no skip was printed — the guard is silent.\n${stdout}`);
});

test("an addition matches the schema's declared item SHAPE (object vs string)", () => {
  const { after, stdout } = runAudit({
    dir: "Submissions", name: "Fixture Family", doc: FAMILY_HUB,
    changes: {
      related_submissions_to_add: [
        { name: "Armbar", reason: "the primary chain" },
        { name: "Kimura", reason: "already present as an object — must not double-add" },
      ],
    },
  });
  const a = JSON.parse(after);
  // dedup must compare by NAME across both shapes: an object never equals its own name string
  assert.equal(a.related_submissions.filter((e) => (e.name ?? e) === "Kimura").length, 1,
    `an entry already present as an object was added again as a duplicate.\n${stdout}`);
  const added = a.related_submissions.find((e) => (e.name ?? e) === "Armbar");
  assert.ok(added, `addition did not land.\n${stdout}`);
  assert.equal(typeof added, "object",
    `a bare string was appended to an object-form list — the bot's validate step reverts this.\n${stdout}`);
  assert.equal(added.relationship, "the primary chain",
    `the audit's reason was dropped instead of becoming the relationship.\n${stdout}`);
});
