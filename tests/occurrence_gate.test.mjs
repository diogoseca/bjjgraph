// Pure-unit suite for the ruleset-availability reporter:
//   node --test tests/occurrence_gate.test.mjs
//
// WHAT THIS IS FOR. `validate_occurrence_surface.py` reports a TRIAGE LIST, and a triage list
// nobody can trust is worse than none: it either gets acted on wholesale or ignored wholesale.
// The two failure modes it must never have are the two that shipped elsewhere this week —
// a check that cannot fail, and a check that fires on the wrong signal.
//
// So these tests pull in opposite directions on purpose:
//
//   1. ZERO COVERAGE IS FATAL. Pointed at an empty corpus the script must EXIT NON-ZERO, not
//      print an empty report. CLAUDE.md 6.6: never let "found no problems" and "never looked"
//      produce the same output. This is the only failure reporting mode cannot mask.
//
//   2. IT READS THE REQUIREMENT, NOT THE NAME. The whole point of section 4 is that it does not
//      infer gi-dependence from a technique or position NAME — the calibration panel warned that
//      name-substring availability inference "would wrongly zero" `Collar Sleeve to De La Riva`,
//      and a name regex flags `Rear Naked Choke from Invisible Collar`, the canonical no-gi choke.
//      The fixture below is the proof: two positions with IDENTICAL cloth-sounding names, differing
//      only in their authored `prerequisites`. Exactly one may be reported. If someone later
//      "improves" this into a name matcher, this test goes red — which is its entire job.
//
// NOT COVERED, recorded here so nobody reads this file as more than it is: sections 1-3 have no
// unit test. They were mutation-proved by hand (bow-and-arrow nogi 0->9 moved section 1 from 7 to
// 8 unexplained; zeroing `De La Riva to Lapel Guard` moved section 3 from 12 inbound to 11), and a
// surviving mutant there would not turn this suite red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = resolve(ROOT, "scripts/validate_occurrence_surface.py");

/** Drive the REAL script over a throwaway corpus — never a re-implementation of its rules. */
function runGate({ positions = {}, transitions = {}, calibration = { containers: [] } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "occurrence-surface-"));
  try {
    const content = join(dir, "content");
    for (const sub of ["Positions", "Transitions", "Submissions"]) mkdirSync(join(content, sub), { recursive: true });
    for (const [name, body] of Object.entries(positions)) {
      writeFileSync(join(content, "Positions", `${name}.json`), JSON.stringify(body, null, 1));
    }
    for (const [name, body] of Object.entries(transitions)) {
      writeFileSync(join(content, "Transitions", `${name}.json`), JSON.stringify(body, null, 1));
    }
    const cal = join(dir, "calibration.json");
    writeFileSync(cal, JSON.stringify(calibration));
    const r = spawnSync("python3", [GATE, content, cal, "--ledger", join(dir, "absent.json")],
      { cwd: ROOT, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** One role-block with a populated no-gi frame and whatever prerequisites the caller wants. */
const position = (name, slug, prerequisites) => ({
  name, slug,
  bottom: {
    prerequisites,
    state_invariants: ["Practitioner maintains the configuration"],
    transitions: [{ transition: `${name} Sweep`, attempt_probability: { gi: 100, nogi: 100 } }],
  },
});

test("zero coverage is fatal — an empty corpus must not read as a clean report", () => {
  const { code, out } = runGate();
  assert.equal(code, 1, `expected exit 1 on an empty corpus, got ${code}\n${out}`);
  assert.match(out, /zero coverage/i);
  assert.match(out, /indistinguishable from a clean run/i);
});

test("section 4 keys on the authored requirement, never on the name", () => {
  // Both names contain "Lapel" — a substring the panel explicitly warned about and one the app's
  // own giAllows fallback regex fires on — so a name matcher reports BOTH. Only the prerequisites
  // differ. If the fixture names did not trigger a plausible name heuristic, this assertion would
  // be vacuous: an earlier cut used "Collar Guard A/B", which the requirement regex never matches
  // as a name, and a deliberately name-matching mutant of the script SURVIVED it.
  // The calibration container and the transition exist only to clear the coverage floors, so the
  // run reaches section 4 at all — without them the (correct) zero-coverage failure masks it.
  const { code, out } = runGate({
    positions: {
      "Lapel Guard A": position("Lapel Guard A", "lapel-guard-a",
        ["Opponent wearing gi with accessible lapel to be gripped"]),
      "Lapel Guard B": position("Lapel Guard B", "lapel-guard-b",
        ["Opponent seated within range", "Practitioner has an underhook"]),
    },
    transitions: {
      "Lapel Guard A Sweep": {
        name: "Lapel Guard A Sweep",
        outcomes: [{ to: "Lapel Guard A/Top", probability: { gi: 100, nogi: 100 }, result: "success" }],
      },
    },
    calibration: {
      containers: [{
        key: "lapel-guard-a__bottom", file: "content/Positions/Lapel Guard A.json",
        position: "Lapel Guard A", role: "bottom", frame_unavailable: [],
        moves: [{ transition: "Lapel Guard A Sweep", final: { gi: 100, nogi: 100 } }],
      }],
    },
  });
  assert.equal(code, 0, `expected a clean exit, got ${code}\n${out}`);
  assert.match(out, /lapel-guard-a__bottom/,
    `the gi-requiring position must be reported\n${out}`);
  assert.doesNotMatch(out, /lapel-guard-b__bottom/,
    `a cloth-SOUNDING name with no cloth requirement must NOT be reported — that is a name matcher\n${out}`);
  assert.match(out, /TIER A explicit garment req\s*:\s*1\b/,
    `exactly one Tier A row expected\n${out}`);
});
