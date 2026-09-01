// CORPUS CENSUS — the shared computation behind `tests/corpus_census.test.mjs` and
// `scripts/update_census.mjs`. Not a test file: `node --test tests/*.test.mjs` does not collect it.
//
// WHY THIS EXISTS. This repo hard-codes corpus sizes as tripwires on purpose — a silent drop in
// technique count has to fail something, and a number derived from the source it checks agrees by
// construction (CLAUDE.md 6.3). That property is worth keeping. What was NOT worth keeping is how
// the literals were maintained: scattered across three e2e spec files and two unit files, each
// discovered separately, and — because a push to dev runs no Playwright — usually one deploy after
// the content change that invalidated them.
//
// Measured cost of that: v1.155.2 followed a corpus change through `dual-consumers.spec.ts` and
// missed exactly one literal (its own comment records this). v1.156.0 added two nodes, fixed the
// four unit constants in the same commit because those DO run on a dev push, and left ten e2e
// literals to be found by the v1.158.1 deploy — five in the curated gate, one only reachable from a
// PR. Twice, for the same reason.
//
// So: the literals stay where they are and stay exact. This module computes what each one SHOULD
// be, from the emitted wire, in ~0.2s with no browser and no site build — and `corpus_census`
// reports every drifted one at once, on the push that caused it. `ci-validate.yml` emits the wire
// immediately before it runs the unit suites, so this needs nothing new in CI.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { ngFlowBuild, ngFlowAdjoint } from "../neural/src/flow.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const R = (p) => resolve(HERE, "..", p);

/** Every file the marker scan reads. Both globs are shell-expanded elsewhere, so they are explicit
 *  here — and the scan asserts a positive marker count, so a directory that stopped matching fails
 *  loudly instead of reporting a clean census (CLAUDE.md 6.6). */
export const SCAN_DIRS = [
  { dir: "e2e/journeys", ext: ".spec.ts" },
  { dir: "tests", ext: ".test.mjs" },
];

/** Build the app exactly the way tests/flow.test.mjs does — one construction pattern, not two. */
function app(WIRE) {
  const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
  const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
    class DCLogic {}, { createRef: () => ({ current: null }) },
  );
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  return a;
}

/**
 * The census. Each key is a corpus size some assertion pins; the VALUE is derived here and the
 * literal stays in the spec. Keys are named for what they count, not for where they are used, so
 * one key can back several literals (e.g. `sites` backs both a node count and an ordinal count —
 * which is itself the claim that the rep member IS the hub).
 */
export function computeCensus() {
  const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));
  const a = app(WIRE);
  const nodes = a.nodes;
  const reps = nodes.filter((n) => n.rep);
  const positions = reps.filter((n) => n.ty === "positions");

  // the dealt hand, over every position seat — the same sweep dual-consumers harvests
  let dealtCards = 0;
  const savedRole = a.playerRole, savedPos = a.currentPos;
  for (const p of positions) {
    for (const role of ["top", "bottom"]) {
      a.playerRole = role; a.currentPos = p.idx;
      try { dealtCards += a.optionsFor(p.idx).length; } catch { /* a seat that cannot deal is a
        different gate's problem; the census must not mask it by counting it as zero silently */ }
    }
  }
  a.playerRole = savedRole; a.currentPos = savedPos;

  // cal.outcomes lives on the WIRE, not on the ingested node — read it there
  const withOutcomes = WIRE.nodes.filter((n) => n && n.cal && Array.isArray(n.cal.outcomes));
  const endsCounter = withOutcomes.filter((n) => {
    const o = n.cal.outcomes;
    return o.length > 0 && o[o.length - 1][2] === "c";
  }).length;

  // FLOW's negative set: decks where drilling LOWERS the score. Corpus-derived and it moves with
  // content — 18 -> 19 -> 24 across v1.157.0/v1.158.0 as the Kimura Trap seat ruling made five
  // grip-establishing moves succeed into a state that can no longer finish. Solved at the
  // reference's own lam/horizon so this key means the same thing the assertion does.
  const REF = JSON.parse(readFileSync(R("tests/artifacts/flow_reference.json"), "utf8"));
  const K = ngFlowBuild(a);
  const RUN = ngFlowAdjoint(K, new Float64Array(K.deckKeys.length), REF.lam, REF.horizon, null, null);
  const negDecks = K.deckKeys.filter((_d, i) => RUN.grad[i] < -1e-12).length;

  return {
    negDecks,
    sites:            reps.length,
    members:          nodes.length,
    positions:        positions.length,
    roleHands:        positions.length * 2,
    techSites:        reps.filter((n) => n.ty !== "positions").length,
    techMembers:      nodes.filter((n) => n.ty !== "positions").length,
    submissions:      reps.filter((n) => n.ty === "submissions").length,
    transitions:      reps.filter((n) => n.ty === "transitions").length,
    ordinals:         nodes.filter((n) => n.o != null).length,
    // a technique PAGE per site, minus the positions and minus the single game-over terminal.
    // Derived, never guessed — the literal it backs is the one v1.155.2 missed.
    techPages:        reps.length - positions.length - 1,
    dealtCards,
    calOutcomeNodes:  withOutcomes.length,
    endsCounter,
  };
}

/** Strip string literals so digits inside a message ("all 2,656 members…") are never mistaken for
 *  the assertion's own number. */
function stripStrings(line) {
  return line.replace(/"(?:[^"\\]|\\.)*"/g, '""')
             .replace(/'(?:[^'\\]|\\.)*'/g, "''")
             .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const MARKER = /\/\/\s*census:([A-Za-z][A-Za-z0-9]*)\s*$/;

/**
 * Find every `// census:<key>` marker and the numeric literal it governs.
 * Returns { file, line, key, value, text } plus any structural problems as `bad`.
 */
export function scanMarkers() {
  const found = [], bad = [];
  for (const { dir, ext } of SCAN_DIRS) {
    let names;
    try { names = readdirSync(R(dir)); } catch { bad.push({ file: dir, line: 0, why: "scan directory is unreadable" }); continue; }
    for (const name of names.filter((n) => n.endsWith(ext)).sort()) {
      const rel = join(dir, name);
      const lines = readFileSync(R(rel), "utf8").split("\n");
      lines.forEach((text, i) => {
        const m = MARKER.exec(text);
        if (!m) return;
        const key = m[1];
        const code = stripStrings(text.slice(0, m.index));
        const ints = code.match(/\b\d+\b/g) || [];
        if (ints.length !== 1) {
          bad.push({
            file: rel, line: i + 1, why:
              `a census marker must sit on a line with EXACTLY ONE numeric literal outside strings; ` +
              `found ${ints.length} (${ints.join(", ") || "none"}). Split the assertion or move the marker.`,
          });
          return;
        }
        found.push({ file: rel, line: i + 1, key, value: Number(ints[0]), text });
      });
    }
  }
  return { found, bad };
}
