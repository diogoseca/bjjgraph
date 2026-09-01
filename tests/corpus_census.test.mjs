// CORPUS CENSUS GATE — every hard-coded corpus size, checked in one place, on every push to dev.
//
// The literals stay hard-coded and exact. That is deliberate and it is canon: a tripwire for
// silent corpus loss, and a number derived from the source it checks agrees by construction
// (CLAUDE.md 6.3). What this gate removes is not the tripwire — it is the DISCOVERY COST. Before
// it, a content change invalidated literals across five files and you met them one at a time, on
// a deploy, because a push to dev runs no Playwright. Twice: v1.155.2 missed one literal in
// `dual-consumers.spec.ts` (its own comment records this), and v1.156.0 left ten e2e literals for
// the v1.158.1 deploy to find.
//
// Now a drift fails HERE, in `node --test tests/*.test.mjs`, which `ci-validate.yml` runs on every
// dev push right after it emits the wire — and it names every stale literal at once, with
// file:line and old -> new, so the fix is one command and one commit-message note.
//
//   npm run census:update      rewrite the marked literals to today's corpus
//
// ADDING A MARKER: put `// census:<key>` at the end of the assertion line, where <key> is a key
// from computeCensus(). The line must carry exactly one numeric literal outside of strings — the
// scan refuses anything ambiguous rather than guessing which number it governs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCensus, scanMarkers, SCAN_DIRS } from "./_census.mjs";

// A FLOOR, NOT A FIGURE. It exists so a deleted marker, a renamed directory or a glob that
// stopped matching fails loudly instead of reporting a clean census over nothing — the repo's
// most-repeated defect class (CLAUDE.md 6.6: never let "found no problems" and "never looked"
// produce the same output). Raise it when markers are added; it is not a target.
const MARKER_FLOOR = 19;

test("every census marker sits on a line the scan can read unambiguously", () => {
  const { bad } = scanMarkers();
  assert.deepEqual(
    bad.map((b) => `${b.file}:${b.line} — ${b.why}`), [],
    "a marker the scan cannot resolve is worse than no marker: it reads as covered and checks nothing",
  );
});

test("positive coverage: the census actually found markers to check", () => {
  const { found } = scanMarkers();
  assert.ok(
    found.length >= MARKER_FLOOR,
    `only ${found.length} census marker(s) found across ${SCAN_DIRS.map((s) => s.dir).join(", ")}; ` +
    `expected at least ${MARKER_FLOOR}. Either markers were deleted or the scan stopped matching — ` +
    `both mean this gate is now checking nothing while reporting green.`,
  );
});

test("every census marker names a key the census computes", () => {
  const census = computeCensus();
  const { found } = scanMarkers();
  const unknown = found
    .filter((f) => !(f.key in census))
    .map((f) => `${f.file}:${f.line} — census:${f.key} is not a computed key`);
  assert.deepEqual(unknown, [], `known keys: ${Object.keys(census).sort().join(", ")}`);
});

test("no hard-coded corpus size has gone stale", () => {
  const census = computeCensus();
  const { found } = scanMarkers();
  const drift = found.filter((f) => f.key in census && f.value !== census[f.key]);
  if (drift.length === 0) return;

  const width = Math.max(...drift.map((d) => `${d.file}:${d.line}`.length));
  const rows = drift
    .map((d) => `  ${`${d.file}:${d.line}`.padEnd(width)}  ${d.value} -> ${census[d.key]}   (census:${d.key})`)
    .join("\n");
  const keys = [...new Set(drift.map((d) => d.key))].sort();
  assert.fail(
    `${drift.length} hard-coded corpus size(s) no longer match the corpus:\n${rows}\n\n` +
    `Keys that moved: ${keys.map((k) => `${k}=${census[k]}`).join(", ")}.\n` +
    `If the corpus change was DELIBERATE: \`npm run census:update\`, then say what moved and why ` +
    `in the commit message — the numbers are tripwires, so a drift is a fact about the corpus, ` +
    `not a chore.\nIf it was NOT deliberate, something removed content and this is the gate ` +
    `doing its job.`,
  );
});
