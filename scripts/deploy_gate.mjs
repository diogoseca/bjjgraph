#!/usr/bin/env node
// THE DEPLOY GATE'S OWN LEDGER, AND ITS TRIPWIRE (v1.263.0, GATE5; the owner's U147 a, 12 Nov 2026).
//
// What the gate is. `npm run test:curated` runs every core journey tagged `@curated`, on one worker, in both deploy
// workflows, after the keyed build and before the Pages upload. Until v1.263.0 the tag meant "a fast representative
// sample", and it grew from 427 tests on 1 Oct to 914 on 12 Nov: 33.6 to 36.8 minutes of a 45-minute step timeout,
// about 2.6 minutes more every day (the GATE1 plan, `reports/gatetime.md`, outside the repo). The owner's answer: "only what a deploy can break,
// plus one quick test per surface". 56 tests at v1.263.0, about 3 minutes; the tiers as v1.263.4 states them:
//   D  a test that reads what only a deploy build has: the keyed Supabase and PostHog config in postscript.js, or this
//      checkout's own history (publication dates). NOT the build stamp: NeuralMount.tsx writes window.__NEURAL_BUILD on
//      every build, keyed or not (v1.263.4 moved bundle-version's two rows to S; the reviewer's new 5 on #392);
//   S  re-run on the exact tree that ships, reading nothing a PR build lacks: one quick test per surface, plus the
//      sign-in and account seams the owner's answer kept whole.
//   v1.263.0 called 41 rows D. The reviewer of #388 (finding 4) showed 28 of them cannot see a deploy-only input (their
//   fixture supplies the Supabase config, or they stub PostHog after boot), so v1.263.3 moved them to S with reasons
//   that say what they check, and dropped "the affiliate stamp" from D: no row reads a stamped link, which the static
//   deploy gates (check_affiliate_surface.py --built, check_systems_payload.py) check instead.
// Every other journey still runs, unchanged, in e2e-full.yml's four core shards: on every PR into dev and main, and
// since this change on every push to dev (one concurrency group, so a burst of merges costs one run). A promotion
// to production takes only a commit whose push-run e2e-full is green (CLAUDE.md, Shipping).
//
// Why a ledger. A tag nobody accounts for grows back: 427 to 914 in six weeks, each test added for a good reason.
// `tests/artifacts/deploy_gate.json` holds one row per tagged test (file, Playwright's full title, tier D or S, the
// reason it needs a deploy, its last CI seconds). `tests/artifacts/deploy_gate_budget.json` holds the numbers
// (target 5 min, line 10, step timeout 20), and nothing in prose repeats them.
//
// The checks, and what each one can see:
//   check            (tests/deploy_gate.test.mjs, in `test:units`, so on every PR and every push to dev, no browser,
//                    no build): every `@curated` in code under e2e/journeys must sit in a title literal that a row
//                    matches (a tag with no row fails); every row must match exactly one such site (a row for a test
//                    that is gone fails); the rows' seconds plus the start-up must fit under the line, a row with no
//                    measurement counting at the measured rows' p90. It cannot expand a parametrised title, so...
//   check --listed   (e2e-full's build job, after the site is built: 9 spec files read built files while Playwright
//                    collects them, so the listing cannot run in ci-validate): Playwright's own
//                    `--list --grep @curated`, the gate's exact selection, must equal the rows, title for title.
//                    That is what catches a parametrised condition widened to tag more cases.
//   ran              (posttest:curated, so in both deploys before the Pages upload, and on every local curated run):
//                    the tests that ran and passed must be exactly the rows, none skipped, more than zero.
//   promotion        (deploy.yaml only, its first gate, before the build): the commit that vouches for a push to main
//                    must have a green e2e-full run (push or dispatch); see its section below for every push shape.
//   tripwire         (both deploys, AFTER the Pages upload and the live checks; since v1.263.4 it also fails when the
//                    count `ran` leaves in e2e/test-results is missing or differs from the ledger. So a count switched
//                    off by ignore-scripts is caught AFTER the upload: the site already serves the build, the run (or
//                    deploy.yaml's deployed-console verdict) goes red, and nothing is blocked or rolled back; the count
//                    blocks before the upload whenever the hook runs, every deploy today): reads the gate step's start and end
//                    from this run attempt's own jobs API, requires exactly one step of that name (zero or two must
//                    not read as fast), warns over the target and fails over the line. It runs after the upload on
//                    purpose: a slow but green gate still ships, and a deploy blocked at the line would only move the
//                    cliff from 45 minutes to 10. It reads the API instead of timing the gate's own command because
//                    scripts/check_build_chains.py compares every step before the Pages boundary across the two deploys.
//   refresh          (by hand only, never self-advancing): rewrites the rows' seconds from a deploy's gate log.
//
// Usage:
//   node scripts/deploy_gate.mjs check [--listed]
//   node scripts/deploy_gate.mjs ran [--report <file>]          (npm runs it after `npm run test:curated`)
//   node scripts/deploy_gate.mjs promotion [--commit <sha> | --head <sha>]
//       (deploy.yaml, on HEAD; --head runs the whole rule on another commit, --commit only the run check on one)
//   node scripts/deploy_gate.mjs tripwire                      (in a workflow: GH_TOKEN and the GITHUB_* variables)
//   node scripts/deploy_gate.mjs refresh --log <gate log> --run <run id>
//       (gh run view <id> --log > gate.log; rows the log does not name keep their seconds and are listed)
import { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TEST_DIR = "e2e/journeys";
export const MANIFEST = "tests/artifacts/deploy_gate.json";
export const BUDGET = "tests/artifacts/deploy_gate_budget.json";
const TAG = "@curated";
const SEP = " › ";

export const loadJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

// ── the static half: tag sites in the spec sources ─────────────────────────────────────────────
function specFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...specFiles(p));
    else if (name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

/** Top-level string literals on one line (a `//` outside a literal ends the line). */
export function lineLiterals(line) {
  const out = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") break;
    if (c !== '"' && c !== "'" && c !== "`") continue;
    let j = i + 1, depth = 0;
    for (; j < line.length; j++) {
      const d = line[j];
      if (d === "\\") { j++; continue; }
      if (c === "`" && d === "$" && line[j + 1] === "{") { depth++; j++; continue; }
      if (c === "`" && depth > 0 && d === "}") { depth--; continue; }
      if (depth === 0 && d === c) break;
    }
    if (j >= line.length) return { literals: out, open: true }; // a literal that runs past the line
    out.push({ quote: c, body: line.slice(i + 1, j) });
    i = j;
  }
  return { literals: out, open: false };
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A matcher for the titles a literal can produce: exact for a plain string, `${…}` as a wildcard in a template. */
export function literalMatcher({ quote, body }) {
  if (quote !== "`" || !body.includes("${")) {
    const text = body.replace(/\\(.)/g, "$1");
    return { kind: "exact", test: (t) => t === text, text };
  }
  const parts = [];
  let i = 0, start = 0;
  while (i < body.length) {
    if (body[i] === "\\") { i += 2; continue; }
    if (body[i] === "$" && body[i + 1] === "{") {
      parts.push(escapeRx(body.slice(start, i).replace(/\\(.)/g, "$1")));
      let depth = 1; i += 2;
      while (i < body.length && depth > 0) { if (body[i] === "{") depth++; else if (body[i] === "}") depth--; i++; }
      parts.push(".*?");
      start = i;
      continue;
    }
    i++;
  }
  parts.push(escapeRx(body.slice(start).replace(/\\(.)/g, "$1")));
  const rx = new RegExp("^" + parts.join("") + "$", "s");
  return { kind: "template", test: (t) => rx.test(t), text: body };
}

/** Every `@curated` in code under e2e/journeys (comment lines are prose, not tags). */
export function scanSites(root) {
  const sites = [], errors = [];
  for (const abs of specFiles(join(root, TEST_DIR))) {
    const file = relative(join(root, TEST_DIR), abs).split("\\").join("/");
    readFileSync(abs, "utf8").split("\n").forEach((line, k) => {
      const s = line.trim();
      if (!s.includes(TAG) || s.startsWith("//") || s.startsWith("*") || s.startsWith("/*")) return;
      const { literals, open } = lineLiterals(line);
      const tagged = literals.filter((l) => l.body.includes(TAG));
      if (open || tagged.length !== 1)
        errors.push(`${TEST_DIR}/${file}:${k + 1}: a ${TAG} this check cannot read as ONE title literal on one line` +
          ` (${open ? "a literal runs past the line" : tagged.length + " tagged literals"}); put the tagged title on one line`);
      else sites.push({ file, line: k + 1, ...literalMatcher(tagged[0]) });
    });
  }
  return { sites, errors };
}

const segments = (title) => title.split(SEP);

/** Rows against sites: a tag with no row fails, a row with no tag fails, a row two tags could own fails. */
export function checkStatic(sites, manifest) {
  const errors = [];
  const rows = manifest.tests || [];
  const owned = new Map(sites.map((s) => [s, 0]));
  for (const r of rows) {
    const hits = sites.filter((s) => s.file === r.file && segments(r.title).some((seg) => s.test(seg)));
    if (hits.length === 0)
      errors.push(`row matches no tagged test: ${r.file} › "${r.title}" (renamed, untagged or deleted? update or remove the row)`);
    else if (hits.length > 1)
      errors.push(`row matches ${hits.length} tagged sites, lines ${hits.map((h) => h.line).join(", ")}: ${r.file} › "${r.title}"`);
    else owned.set(hits[0], owned.get(hits[0]) + 1);
  }
  for (const [s, n] of owned)
    if (n === 0)
      errors.push(`${TEST_DIR}/${s.file}:${s.line}: a tagged test with no row in ${MANIFEST}: add one (file, title, tier D or S, ` +
        `reason, ci_s null until a deploy measures it), or drop the tag; the full suite runs it in e2e-full either way`);
  return errors;
}

/** Field shapes, duplicates, and the budget: measured seconds, the p90 for the unmeasured, the start-up. */
export function checkBudget(manifest, budget) {
  const errors = [], warnings = [];
  const rows = manifest.tests || [];
  const keys = new Set();
  for (const r of rows) {
    const key = r.file + SEP + r.title;
    if (keys.has(key)) errors.push(`duplicate row: ${key}`);
    keys.add(key);
    if (!["D", "S"].includes(r.tier)) errors.push(`tier must be D (reads what only a deploy build has) or S (re-run on the tree that ships): ${key}`);
    if (typeof r.reason !== "string" || r.reason.trim().length < 10) errors.push(`a row needs its reason: ${key}`);
    if (!(r.ci_s === null || (typeof r.ci_s === "number" && r.ci_s > 0))) errors.push(`ci_s must be a positive number or null: ${key}`);
  }
  const measured = rows.filter((r) => typeof r.ci_s === "number" && r.ci_s > 0).map((r) => r.ci_s).sort((a, b) => a - b);
  const unmeasured = rows.length - measured.length;
  if (rows.length === 0) errors.push("the manifest has no rows: a gate of zero tests is not a gate");
  if (measured.length === 0) errors.push("no row carries a measurement, so there is no p90 to count a new test at");
  const p90 = measured.length ? measured[Math.ceil(0.9 * measured.length) - 1] : 0;
  const total = measured.reduce((a, b) => a + b, 0) + unmeasured * p90 + budget.startup_s;
  const line = budget.line_min * 60, target = budget.target_min * 60;
  if (!(budget.target_min > 0 && budget.line_min > budget.target_min && budget.timeout_min > budget.line_min))
    errors.push(`the budget must read 0 < target < line < timeout, got ${budget.target_min} / ${budget.line_min} / ${budget.timeout_min}`);
  if (total > line)
    errors.push(`the gate's rows sum to ${Math.round(total)} s, over its ${budget.line_min}-min line (${line} s): ` +
      `${measured.length} measured, ${unmeasured} counted at the p90 of ${p90.toFixed(1)} s, start-up ${budget.startup_s} s`);
  else if (total > target)
    warnings.push(`the gate's rows sum to ${Math.round(total)} s, over its ${budget.target_min}-min target (${target} s)`);
  return { errors, warnings, total, p90, measured: measured.length, unmeasured };
}

// ── the exact half: Playwright's own selection ────────────────────────────────────────────────
/** Flatten Playwright's JSON listing into { file, title } with the titles the list reporter prints. */
export function flattenListing(json) {
  const out = [];
  const walk = (suite, titles) => {
    const t = suite.title && !suite.title.endsWith(".spec.ts") ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) for (const _ of spec.tests || [null]) out.push({ file: spec.file, title: [...t, spec.title].join(SEP) });
    for (const child of suite.suites || []) walk(child, t);
  };
  for (const s of json.suites || []) walk(s, []);
  return out;
}

export function listGate(root) {
  const r = spawnSync("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", "--list", "--grep", TAG, "--reporter=json"],
    { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
  let json;
  try { json = JSON.parse(r.stdout); } catch { throw new Error(`playwright --list printed no JSON (exit ${r.status}): ${(r.stderr || "").slice(0, 2000)}`); }
  if ((json.errors || []).length) throw new Error("playwright could not collect the suite:\n" + json.errors.map((e) => e.message).join("\n").slice(0, 4000));
  return flattenListing(json);
}

export function checkListed(listed, manifest) {
  const errors = [];
  const key = (x) => x.file + SEP + x.title;
  const want = new Map(), have = new Map();
  for (const r of manifest.tests || []) want.set(key(r), (want.get(key(r)) || 0) + 1);
  for (const t of listed) have.set(key(t), (have.get(key(t)) || 0) + 1);
  if (listed.length === 0) errors.push("Playwright lists ZERO @curated tests: the gate would run nothing");
  for (const [k, n] of have) if (!want.has(k)) errors.push(`the gate runs a test with no row: ${k}`); else if (n !== 1) errors.push(`the gate lists ${n} tests with one title: ${k}`);
  for (const k of want.keys()) if (!have.has(k)) errors.push(`row names a test the gate does not run: ${k}`);
  return errors;
}

// ── the count of what RAN (v1.263.3, GATE6; the reviewer's finding 6 on #388) ─────────────────────
// `--grep @curated` failing on zero matches is Playwright's default, but a kept test that SKIPS at run time passes the
// gate silently, and with ~60 tests each one is a surface. `posttest:curated` (package.json) runs `ran` after a green
// curated run, before the Pages upload in both deploys (scripts/check_build_chains.py expands the hook as part of the
// curated gate, so it is required in both): the tests that ran and passed must be exactly the rows, none skipped, and
// more than zero. It reads the JSON reporter's file from e2e/playwright.config.ts, which lands in an outputDir that
// Playwright wipes at the start of every run, so it can only ever count this run.
export const RESULTS = "e2e/test-results/results.json";
// What `ran` counted, for the tripwire (v1.263.4, GATE7; the reviewer's new 3 on #392). The count runs as an npm
// post-hook, and npm skips pre and post hooks under `ignore-scripts` (an .npmrc line, or npm_config_ignore_scripts in the
// environment) while still running the main script green: the count would be switched off with nothing red. So `ran`
// leaves its count here, beside the report, in the outputDir Playwright wipes at every run's start (so it can only be
// this run's), and the tripwire, later in the same job, fails unless it is there and equals the ledger. The tripwire
// cannot read the gate step's LOG instead: the job-logs API serves a job's log only after the whole job completes (it
// answered 404 BlobNotFound for deploy-dev run 43274512974's job while it ran), and the tripwire is a step of that job.
export const COUNT = "e2e/test-results/gate-count.json";

/** Flatten Playwright's JSON report into { file, title, status, result } (status: expected|unexpected|flaky|skipped). */
export function flattenResults(json) {
  const out = [];
  const walk = (suite, titles) => {
    const t = suite.title && !suite.title.endsWith(".spec.ts") ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      const last = (test.results || []).at(-1);
      out.push({ file: spec.file, title: [...t, spec.title].join(SEP), status: test.status, result: last ? last.status : null });
    }
    for (const child of suite.suites || []) walk(child, t);
  };
  for (const s of json.suites || []) walk(s, []);
  return out;
}

export function checkRan(results, manifest) {
  const errors = [];
  const key = (x) => x.file + SEP + x.title;
  const want = new Set((manifest.tests || []).map(key));
  const seen = new Map();
  let passed = 0, skipped = 0;
  if (results.length === 0) errors.push("the gate's report holds ZERO tests: nothing ran, which must not read as a pass");
  for (const r of results) {
    const k = key(r);
    seen.set(k, (seen.get(k) || 0) + 1);
    if (r.status === "skipped" || r.result === "skipped") { skipped++; errors.push(`skipped in the gate, so its surface went unchecked: ${k}`); }
    else if (r.result !== "passed" || r.status !== "expected") errors.push(`did not pass in the gate (${r.status}, ${r.result}): ${k}`);
    else passed++;
    if (!want.has(k)) errors.push(`ran in the gate with no row: ${k}`);
  }
  for (const [k, n] of seen) if (n > 1) errors.push(`ran ${n} times under one title: ${k}`);
  for (const k of want) if (!seen.has(k)) errors.push(`a row the gate did not run: ${k}`);
  return { errors, passed, skipped, rows: want.size, total: results.length };
}

export function ran(root, args) {
  const file = args.includes("--report") ? args[args.indexOf("--report") + 1] : RESULTS;
  let json;
  try { json = JSON.parse(readFileSync(resolve(root, file), "utf8")); }
  catch (e) { console.log(`FAIL the gate's report ${file} cannot be read (${e.code || e.message}): what ran cannot be counted, so the gate is red`); return 1; }
  const r = checkRan(flattenResults(json), loadJson(root, MANIFEST));
  console.log(`deploy gate ran ${r.total} tests: ${r.passed} passed of ${r.rows} rows, ${r.skipped} skipped`);
  for (const e of r.errors) console.log("FAIL " + e);
  mkdirSync(dirname(resolve(root, COUNT)), { recursive: true });
  writeFileSync(resolve(root, COUNT), JSON.stringify({ total: r.total, passed: r.passed, skipped: r.skipped, rows: r.rows, errors: r.errors.length }) + "\n");
  return r.errors.length ? 1 : 0;
}

/** The tripwire's second question: did the count run, and did it count exactly the ledger? `count` is COUNT's JSON or null. */
export function evaluateCount(count, rows) {
  if (!count) return { ok: false, message: `the gate's count is missing (${COUNT}): posttest:curated did not run. npm skips post-hooks under ignore-scripts (an .npmrc line or npm_config_ignore_scripts); the tests that ran were never compared with the ledger` };
  const { total, passed, skipped, errors } = count;
  if (!(rows > 0 && count.rows === rows && total === rows && passed === rows && skipped === 0 && errors === 0))
    return { ok: false, message: `the gate's count does not equal the ledger: ran ${total}, passed ${passed}, skipped ${skipped}, errors ${errors}, against ${count.rows} rows counted and ${rows} in the ledger now` };
  return { ok: true, message: `the gate's count: ${passed} passed of ${rows} rows, 0 skipped` };
}

/** The tripwire's exit: red when the gate passed its line (or its time could not be read), or when the count is wrong. */
export const tripwireExit = (time, count) => (time.level === "error" || !count.ok ? 1 : 0);

// ── the promotion rule, enforced (v1.263.3, GATE6; the reviewer's finding 1 on #388; refined v1.263.4, GATE7) ───────
// Production runs only the deploy gate, so the full suite must already have passed on the exact tree it ships. A
// promotion is a `--no-ff` merge of a preview-verified dev commit, pushed straight to main with no PR, so no PR run ever
// sees main's tree; the only full run of it is that dev commit's push-run of e2e-full. `promotion` (the first gate in
// deploy.yaml, before the build) finds the commit that vouches for this push and fails unless an e2e-full run on THAT
// commit concluded success. It walks from the pushed commit, and at each commit it looks at, in this order:
//   its own runs           a counted green run on the commit itself vouches for it. That is how a FAST-FORWARD of main
//                          onto a dev tip passes: dev's tips are PR merge commits (two parents) whose push-run is
//                          theirs alone, so judging them by their second parent would ask the PR branch's head, which
//                          has only pull_request runs (GATE7, the reviewer's new 1 on #392: FFDEV and FF8844 failed so);
//   two parents            then the second parent, the dev side of a `--no-ff` promotion; main's tree must equal its tree
//                          except for the files only main carries (TESTED_ONLY_DIFF);
//   one parent             if the commit is EMPTY (its tree hash is its parent's) or changes nothing but
//                          TESTED_ONLY_DIFF from its parent (a keepalive commit: the
//                          weekly workflow commits to main alone, [skip ci]), step back to the parent and look again, so
//                          a manual redeploy after a keepalive passes on the promotion beneath it (the reviewer's new 2);
//                          any other single-parent commit was made on main and nothing ran the suite on it: it fails,
//                          and the message gives the branch-and-dispatch recipe for that commit;
//   no parents             fails closed, and says why it usually happens: a SHALLOW checkout (deploy.yaml checks out
//                          with fetch-depth: 0, which is what lets the rule see a merge's parents); an octopus merge
//                          fails closed too: no promotion shape this repo makes.
// Which runs count: event push (dev's merges) or workflow_dispatch (the way to get one by hand), conclusion success.
// A pull_request run tested a merge ref, not this commit, so it never counts. ONE RUN PER BURST, deliberately: dev's
// push-runs share a concurrency group with cancel-in-progress, so a commit followed by another merge before its run
// finishes keeps a CANCELLED run. The rule then takes the newest dev commit with a green run, and the failure message
// says how to get one for any other commit. One full run per merge instead would queue six jobs behind every merge.
export const TESTED_ONLY_DIFF = [".github/keepalive.txt"];
// A CHOICE, not a hole: `schedule` runs are not counted. One checks out main's exact tip, so counting it would be sound,
// but the weekly run is usually older than a keepalive tip, so it would rarely vouch; the keepalive walk is the remedy.
const COUNTED_EVENTS = ["push", "workflow_dispatch"];
// A CHOICE: twenty weeks of keepalive commits with no promotion in between; past that the rule fails closed rather
// than walk an unbounded history (a promotion resets it).
const KEEPALIVE_WALK = 20;

const recipe = (sha) => {
  const short = sha.slice(0, 9);
  return `To get a green run for ${short} itself, while it is dev's tip and no merge is in flight: gh workflow run e2e-full.yml ` +
    `--ref dev; otherwise give it a branch of its own, which cancels nothing on dev: git push origin ${sha}:refs/heads/verify-${short} ` +
    `&& gh workflow run e2e-full.yml --ref verify-${short}. Then re-run this deploy.`;
};

/** The e2e-full runs on one commit: does any counted run vouch for it?
 *  ANY counted green run vouches, and a later red run on the same commit does not revoke it: the tree passed the whole
 *  suite once, so a later red on that same tree is a flake or an environment fault, which the deploy gate and the next
 *  push-run judge for themselves; the suite is deterministic by design (retries: 0), so this tolerates nothing it should
 *  catch. A RE-RUN attempt is different: the API reports a run's latest attempt, so green then red on a re-run of the
 *  same run reads as red, and red then green as green. (GATE7, the reviewer's new 8 on #392.) */
export function evaluatePromotion(runs, sha) {
  const mine = (runs || []).filter((r) => r.head_sha === sha);
  const counted = mine.filter((r) => COUNTED_EVENTS.includes(r.event));
  const green = counted.filter((r) => r.status === "completed" && r.conclusion === "success");
  const list = mine.map((r) => `run ${r.id} (${r.event}, ${r.status === "completed" ? r.conclusion : r.status})`).join("; ") || "none";
  const short = sha.slice(0, 9);
  if (green.length) return { ok: true, runs: list, message: `${short} passed the full suite: ${green.map((r) => `run ${r.id} (${r.event})`).join(", ")}` };
  return { ok: false, runs: list, message:
    `no e2e-full run on ${short} concluded success (runs found: ${list}); production would ship a tree the full suite never passed. ` +
    `Promote the newest dev commit whose push-run of e2e-full is green: a burst of merges keeps one run, for its newest tip, and ` +
    `cancels the rest by design. ${recipe(sha)}` };
}

/** Which commit vouches for a push to main, walking from the head as the header says. `parentsOf(sha)` and
 *  `diff(a, b)` (changed paths) read git; `runsOf(sha)` reads the runs API. `steps` records every commit looked at. */
export async function judgePromotion({ head, parentsOf, diff, runsOf, sameTree = (a, b) => diff(a, b).length === 0 }) {
  const steps = [];
  const look = async (sha, role) => {
    const v = evaluatePromotion(await runsOf(sha), sha);
    steps.push(`${sha.slice(0, 9)} (${role}): e2e-full runs ${v.runs}`);
    return v;
  };
  let at = head, walked = 0;
  for (;;) {
    const role = at === head ? "the pushed commit" : `beneath ${walked} keepalive or empty commit(s)`;
    const own = await look(at, role);
    if (own.ok) {
      // the backstop (GATE8): whatever the walk stepped over, main's tree must be this commit's tree but for
      // TESTED_ONLY_DIFF, compared HEAD to it directly, so a step whose listing under-reported cannot carry a change in
      const drift = at === head ? [] : diff(at, head).filter((f) => !TESTED_ONLY_DIFF.includes(f));
      if (drift.length)
        return { ok: false, tested: at, steps, message: `main's tree is not the tree that was tested: ${head.slice(0, 9)} differs from ${at.slice(0, 9)}, whose own run vouched, in ${drift.length} file(s) beyond ${TESTED_ONLY_DIFF.join(", ")}: ${drift.slice(0, 10).join(", ")}${drift.length > 10 ? ", ..." : ""}; it fails closed` };
      return { ok: true, tested: at, shape: `${role}, on its own run`, message: own.message, steps };
    }
    const parents = parentsOf(at);
    if (parents.length === 2) {
      const tested = parents[1];
      const extra = diff(tested, head).filter((f) => !TESTED_ONLY_DIFF.includes(f));
      if (extra.length)
        return { ok: false, tested, steps, message: `main's tree is not the tree that was tested: ${head.slice(0, 9)} differs from ${tested.slice(0, 9)}, the dev parent of ${at.slice(0, 9)}, in ${extra.length} file(s) beyond ${TESTED_ONLY_DIFF.join(", ")}: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? ", ..." : ""}` };
      const v = await look(tested, `the dev parent of ${at.slice(0, 9)}`);
      if (v.ok) return { ok: true, tested, shape: `the --no-ff promotion merge ${at.slice(0, 9)}'s dev parent`, message: v.message, steps };
      return { ok: false, tested, steps, message: `neither ${at.slice(0, 9)} (${role}) nor its dev parent has a counted green run. For the dev parent: ${v.message} For ${at.slice(0, 9)} itself, the same recipe applies to its own sha.` };
    }
    if (parents.length === 1) {
      // an EMPTY commit (GATE8, the reviewer's new 4 on #393) is stepped over too: its tree is its parent's, byte for
      // byte, so whatever vouches for the parent vouches for it. Decided by TREE HASH, never by an empty listing, so a
      // listing that under-reports cannot pass a real change off as empty.
      const changed = sameTree(parents[0], at) ? [] : diff(parents[0], at);
      if (sameTree(parents[0], at) || (changed.length && changed.every((f) => TESTED_ONLY_DIFF.includes(f)))) {
        if (++walked > KEEPALIVE_WALK) return { ok: false, steps, message: `more than ${KEEPALIVE_WALK} keepalive-only or empty commits on main with no promotion beneath them: fails closed` };
        at = parents[0];
        continue;
      }
      return { ok: false, tested: at, steps, message: `${at.slice(0, 9)} (${role}) is a single-parent commit that changes more than ${TESTED_ONLY_DIFF.join(", ")}, so it was made on main and no promotion vouches for it. ${own.message}` };
    }
    if (parents.length === 0)
      return { ok: false, steps, message: `${at.slice(0, 9)} has no parents in this checkout: the repository's root commit, or, far more likely, a SHALLOW checkout. deploy.yaml must check out with fetch-depth: 0 so the rule can see a merge's parents; it fails closed` };
    return { ok: false, steps, message: `${at.slice(0, 9)} has ${parents.length} parents: an octopus merge is no promotion shape this repo makes; it fails closed` };
  }
}

const git = (root, ...a) => {
  const r = spawnSync("git", a, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" } });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${(r.stderr || "").trim()}`);
  return r.stdout;
};

/** git as the promotion rule reads it (v1.263.4, GATE8; the reviewer's new 1 on #393). A diff LISTING can under-report,
 *  and an under-reported change is exactly what would let the keepalive walk step over a real one. Measured in a scratch
 *  repo, each case and what closes it:
 *    a rename        porcelain `git diff --name-only` prints only a rename's DESTINATION, so a commit renaming
 *                    content/terms.md onto .github/keepalive.txt read as keepalive-only and was stepped over: the
 *                    reader's R1/R2 false pass. Closed by plumbing `diff-tree` with `--no-renames` (and it ignores
 *                    diff.renames from any config);
 *    a submodule     a gitlink bump is hidden from BOTH porcelain and plumbing when .gitmodules says `ignore = all`.
 *                    Closed by `--ignore-submodules=none`;
 *    a subdirectory  porcelain with diff.relative=true lists only paths under the working directory; diff-tree lists
 *                    full paths from anywhere;
 *    odd names       a non-ASCII or newline-bearing name is quoted (never split, so a name like "\n.github/keepalive.txt"
 *                    cannot pose as the keepalive path); `-z` takes the raw bytes, one NUL-separated entry each;
 *    replace refs    `refs/replace/*` can swap a commit's parents or tree; GIT_NO_REPLACE_OBJECTS=1 reads the real ones;
 *    no change       an empty listing is not trusted to mean "nothing changed": `sameTree` compares tree hashes.
 *  Listed correctly already, so nothing to close: a mode change, a symlink swap, a path that only starts with the
 *  keepalive name (it is its own entry, and the match is exact). */
export function gitAccess(root) {
  return {
    parentsOf: (sha) => git(root, "rev-list", "--parents", "-n", "1", sha).trim().split(" ").slice(1),
    diff: (a, b) => git(root, "diff-tree", "-r", "-z", "--name-only", "--no-renames", "--ignore-submodules=none", "--no-commit-id", a, b).split("\0").filter(Boolean),
    sameTree: (a, b) => git(root, "rev-parse", `${a}^{tree}`).trim() === git(root, "rev-parse", `${b}^{tree}`).trim(),
  };
}

async function e2eFullRuns(sha) {
  const { GITHUB_API_URL = "https://api.github.com", GITHUB_REPOSITORY = "diogoseca/bjjgraph", GH_TOKEN } = process.env;
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/workflows/e2e-full.yml/runs?head_sha=${sha}&per_page=100`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}) } });
      if (res.ok) return (await res.json()).workflow_runs || [];
      if (attempt >= 3) throw new Error(`the runs API answered ${res.status}`);
    } catch (e) { if (attempt >= 3) throw e; }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function promotion(root, args) {
  try {
    if (args.includes("--commit")) { // a dry run of the run check alone, on one named commit
      const sha = args[args.indexOf("--commit") + 1];
      if (!/^[0-9a-f]{40}$/.test(sha || "")) { console.log(`::error title=Promotion rule::not a full commit sha: ${sha}`); return 1; }
      const v = evaluatePromotion(await e2eFullRuns(sha), sha);
      console.log(`promotion --commit ${sha}: e2e-full runs on it: ${v.runs}`);
      console.log((v.ok ? "::notice title=Promotion rule::" : "::error title=Promotion rule::") + v.message);
      return v.ok ? 0 : 1;
    }
    const at = args.includes("--head") ? args[args.indexOf("--head") + 1] : "HEAD"; // --head: a dry run of the whole rule
    const head = git(root, "rev-parse", at).trim();
    const v = await judgePromotion({
      head,
      ...gitAccess(root),
      runsOf: async (sha) => {
        if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`not a full commit sha: ${sha}`);
        return e2eFullRuns(sha);
      },
    });
    for (const step of v.steps) console.log(`promotion: looked at ${step}`);
    if (v.ok) console.log(`promotion: the commit that vouches for ${head} is ${v.tested} (${v.shape})`);
    console.log((v.ok ? "::notice title=Promotion rule::" : "::error title=Promotion rule::") + v.message);
    return v.ok ? 0 : 1;
  } catch (e) { console.log(`::error title=Promotion rule::the rule could not be checked (${e.message}); it fails closed`); return 1; }
}

// ── the tripwire ──────────────────────────────────────────────────────────────────────────────
/** One step of the gate's name in this run attempt, completed: its minutes and the verdict against the budget. */
export function evaluateTripwire(jobs, budget) {
  const hits = [];
  for (const job of jobs.jobs || []) for (const st of job.steps || []) if (st.name === budget.step) hits.push({ job: job.name, ...st });
  if (hits.length !== 1)
    return { level: "error", retry: false, message: `expected exactly one step named "${budget.step}" in this run attempt, found ${hits.length}: the gate's time cannot be read, and absence must not read as fast` };
  const h = hits[0];
  if (h.status !== "completed" || !h.started_at || !h.completed_at)
    return { level: "error", retry: true, message: `the step "${budget.step}" is not completed in the jobs API yet (status ${h.status})` };
  if (h.conclusion !== "success")
    return { level: "error", retry: false, message: `the step "${budget.step}" concluded ${h.conclusion}, not success` };
  const seconds = (Date.parse(h.completed_at) - Date.parse(h.started_at)) / 1000;
  if (!(seconds >= 0)) return { level: "error", retry: false, message: `unreadable step times: ${h.started_at} to ${h.completed_at}` };
  const min = (seconds / 60).toFixed(1);
  const limits = `target ${budget.target_min}, line ${budget.line_min}, timeout ${budget.timeout_min}`;
  if (seconds > budget.line_min * 60)
    return { level: "error", retry: false, seconds, message: `the curated gate took ${min} min (${limits}): this deployment went out; the gate itself is too slow. Trim the tag (${MANIFEST}).` };
  if (seconds > budget.target_min * 60)
    return { level: "warning", retry: false, seconds, message: `the curated gate took ${min} min, over its ${budget.target_min}-min target (${limits})` };
  return { level: "ok", retry: false, seconds, message: `the curated gate took ${min} min (${limits})` };
}

async function tripwire(root) {
  const budget = loadJson(root, BUDGET);
  const { GITHUB_API_URL = "https://api.github.com", GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT = "1", GH_TOKEN } = process.env;
  if (!GITHUB_REPOSITORY || !GITHUB_RUN_ID) { console.log(`::error::tripwire: GITHUB_REPOSITORY and GITHUB_RUN_ID are required`); return 1; }
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}/jobs?per_page=100`;
  let verdict = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}) } });
      if (!res.ok) verdict = { level: "error", retry: true, message: `the jobs API answered ${res.status}` };
      else verdict = evaluateTripwire(await res.json(), budget);
    } catch (e) { verdict = { level: "error", retry: true, message: `the jobs API could not be read: ${e.message}` }; }
    if (!verdict.retry) break;
    if (attempt < 5) await new Promise((r) => setTimeout(r, 6000));
  }
  const r = tripwireJudge(root, verdict);
  for (const l of r.lines) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Deploy gate time\n${r.time.message}\n\n${r.count.message}\n`);
  return r.exit;
}

/** The tripwire's whole judgment once the jobs API has answered (GATE8, the reviewer's new 2 on #393: split out so a test
 *  feeds it a jobs JSON and a root holding, or lacking, the count file). `time` is a jobs JSON or an evaluateTripwire
 *  verdict; the count is READ from `root` here, never passed in, so the call site cannot skip it. */
export function tripwireJudge(root, time) {
  const verdict = time && time.level ? time : evaluateTripwire(time, loadJson(root, BUDGET));
  let count = null;
  try { count = JSON.parse(readFileSync(resolve(root, COUNT), "utf8")); } catch { count = null; }
  const c = evaluateCount(count, loadJson(root, MANIFEST).tests.length);
  const line = { error: "::error title=Deploy gate time::", warning: "::warning title=Deploy gate time::", ok: "::notice title=Deploy gate time::" }[verdict.level];
  return { exit: tripwireExit(verdict, c), time: verdict, count: c,
    lines: [line + verdict.message, (c.ok ? "::notice title=Deploy gate count::" : "::error title=Deploy gate count::") + c.message] };
}

// ── refresh, by hand ──────────────────────────────────────────────────────────────────────────
const LOG_RX = /^(?:[^\t]*\t[^\t]*\t)?\uFEFF?\S+Z\s+(✓|✘|-)\s+\d+\s+e2e\/journeys\/(\S+?):\d+:\d+ › (.*?)(?: \(([\d.]+)(ms|s|m)\))?$/;
/** { "file › title": seconds } for every passed test the list reporter printed. */
export function parseGateLog(text) {
  const out = new Map();
  for (const raw of text.split("\n")) {
    const m = LOG_RX.exec(raw.replace(/\r$/, ""));
    if (!m || m[1] !== "✓" || !m[4]) continue;
    out.set(m[2] + SEP + m[3], +(Number(m[4]) * { ms: 0.001, s: 1, m: 60 }[m[5]]).toFixed(3));
  }
  return out;
}

function refresh(root, args) {
  const log = args[args.indexOf("--log") + 1], run = args[args.indexOf("--run") + 1];
  if (!args.includes("--log") || !args.includes("--run") || !log || !run) { console.error("usage: refresh --log <gate log> --run <run id>"); return 2; }
  const seen = parseGateLog(readFileSync(log, "utf8"));
  if (seen.size === 0) { console.error(`refresh: no passed test lines in ${log}; nothing changed`); return 1; }
  const manifest = loadJson(root, MANIFEST);
  const missing = [];
  let n = 0;
  for (const r of manifest.tests) {
    const s = seen.get(r.file + SEP + r.title);
    if (s === undefined) missing.push(r.file + SEP + r.title); else { r.ci_s = s; n++; }
  }
  manifest.measured = { ...manifest.measured, run: Number(run), refreshed_rows: n };
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`refresh: ${n} of ${manifest.tests.length} rows measured from run ${run}; ${missing.length} not in the log:`);
  for (const m of missing) console.log("  " + m);
  return 0;
}

// ── check ─────────────────────────────────────────────────────────────────────────────────────
export function check(root, { listed = null } = {}) {
  const manifest = loadJson(root, MANIFEST), budget = loadJson(root, BUDGET);
  const { sites, errors: siteErrors } = scanSites(root);
  const errors = [...siteErrors];
  if (sites.length === 0) errors.push(`no ${TAG} tag found under ${TEST_DIR}: the scan saw nothing, which must not read as clean`);
  errors.push(...checkStatic(sites, manifest));
  const b = checkBudget(manifest, budget);
  errors.push(...b.errors);
  if (listed) errors.push(...checkListed(listed, manifest));
  const files = new Set(sites.map((s) => s.file)).size;
  const summary = `deploy gate: ${manifest.tests.length} rows (${b.measured} measured, ${b.unmeasured} at the p90 of ${b.p90.toFixed(1)} s), ` +
    `${sites.length} tag sites in ${files} files, ${(b.total / 60).toFixed(1)} min against a ${budget.target_min}-min target and a ${budget.line_min}-min line` +
    (listed ? `; Playwright lists ${listed.length} tests, set-equal to the rows: ${errors.length === 0}` : "");
  return { errors, warnings: b.warnings, summary, sites, budget: b };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "check") {
    const r = check(ROOT, { listed: args.includes("--listed") ? listGate(ROOT) : null });
    console.log(r.summary);
    for (const w of r.warnings) console.log("WARNING " + w);
    for (const e of r.errors) console.log("FAIL " + e);
    process.exit(r.errors.length ? 1 : 0);
  } else if (cmd === "tripwire") process.exit(await tripwire(ROOT));
  else if (cmd === "ran") process.exit(ran(ROOT, args));
  else if (cmd === "promotion") process.exit(await promotion(ROOT, args));
  else if (cmd === "refresh") process.exit(refresh(ROOT, args));
  else { console.error("usage: node scripts/deploy_gate.mjs check [--listed] | ran [--report <file>] | promotion [--commit <sha> | --head <sha>] | tripwire | refresh --log <file> --run <id>"); process.exit(2); }
}
