#!/usr/bin/env node
// THE DEPLOY GATE'S OWN LEDGER, AND ITS TRIPWIRE (v1.263.0, GATE5; the owner's U147 a, 12 Nov 2026).
//
// What the gate is. `npm run test:curated` runs every core journey tagged `@curated`, on one worker, in both deploy
// workflows, after the keyed build and before the Pages upload. Until v1.263.0 the tag meant "a fast representative
// sample", and it grew from 427 tests on 1 Oct to 914 on 12 Nov: 33.6 to 36.8 minutes of a 45-minute step timeout,
// about 2.6 minutes more every day (the GATE1 plan, `reports/gatetime.md`, outside the repo). The owner's answer: "only what a deploy can break,
// plus one quick test per surface". 56 tests at v1.263.0, about 3 minutes; the tiers as v1.263.1 states them:
//   D  a test that reads what only a deploy build has: the keyed Supabase and PostHog config in postscript.js (and the
//      build stamp it carries), or this checkout's own history (publication dates);
//   S  re-run on the exact tree that ships, reading nothing a PR build lacks: one quick test per surface, plus the
//      sign-in and account seams the owner's answer kept whole.
//   v1.263.0 called 41 rows D. The reviewer of #388 (finding 4) showed 28 of them cannot see a deploy-only input (their
//   fixture supplies the Supabase config, or they stub PostHog after boot), so v1.263.1 moved them to S with reasons
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
//   tripwire         (both deploys, AFTER the Pages upload and the live checks): reads the gate step's start and end
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
import { readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
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

// ── the count of what RAN (v1.263.1, GATE6; the reviewer's finding 6 on #388) ─────────────────────
// `--grep @curated` failing on zero matches is Playwright's default, but a kept test that SKIPS at run time passes the
// gate silently, and with ~60 tests each one is a surface. `posttest:curated` (package.json) runs `ran` after a green
// curated run, before the Pages upload in both deploys (scripts/check_build_chains.py expands the hook as part of the
// curated gate, so it is required in both): the tests that ran and passed must be exactly the rows, none skipped, and
// more than zero. It reads the JSON reporter's file from e2e/playwright.config.ts, which lands in an outputDir that
// Playwright wipes at the start of every run, so it can only ever count this run.
export const RESULTS = "e2e/test-results/results.json";

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

function ran(root, args) {
  const file = args.includes("--report") ? args[args.indexOf("--report") + 1] : RESULTS;
  let json;
  try { json = JSON.parse(readFileSync(resolve(root, file), "utf8")); }
  catch (e) { console.log(`FAIL the gate's report ${file} cannot be read (${e.code || e.message}): what ran cannot be counted, so the gate is red`); return 1; }
  const r = checkRan(flattenResults(json), loadJson(root, MANIFEST));
  console.log(`deploy gate ran ${r.total} tests: ${r.passed} passed of ${r.rows} rows, ${r.skipped} skipped`);
  for (const e of r.errors) console.log("FAIL " + e);
  return r.errors.length ? 1 : 0;
}

// ── the promotion rule, enforced (v1.263.1, GATE6; the reviewer's finding 1 on #388) ──────────────
// Production runs only the deploy gate, so the full suite must already have passed on the exact tree it ships. A
// promotion is a `--no-ff` merge of a preview-verified dev commit, pushed straight to main with no PR, so no PR run ever
// sees main's tree; the only full run of it is that dev commit's push-run of e2e-full. `promotion` (the first gate in
// deploy.yaml, before the build) resolves which commit vouches for this push and fails unless an e2e-full run on THAT
// commit concluded success:
//   a merge (two parents)  the dev side, the second parent; and main's tree must equal its tree except for the files
//                          only main carries (TESTED_ONLY_DIFF: the keepalive workflow commits to main alone, [skip ci]);
//   one parent             the pushed commit itself: a fast-forward of main onto a tested dev commit passes, a commit
//                          made on main fails, because nothing ran the full suite on it;
//   anything else          fails closed: an octopus merge or a root commit is no promotion shape this repo makes.
// Which runs count: event push (dev's merges) or workflow_dispatch (the way to get one by hand), conclusion success.
// A pull_request run tested a merge ref, not this commit, so it never counts. ONE RUN PER BURST, deliberately: dev's
// push-runs share a concurrency group with cancel-in-progress, so a commit followed by another merge before its run
// finishes keeps a CANCELLED run. The rule then takes the newest dev commit with a green run, and the failure message
// says how to get one for any other commit. One full run per merge instead would queue six jobs behind every merge.
export const TESTED_ONLY_DIFF = [".github/keepalive.txt"];
const COUNTED_EVENTS = ["push", "workflow_dispatch"];

/** Which commit's full-suite run vouches for a push to main, from HEAD's parents and the tree diff to that commit. */
export function promotionTarget({ head, parents, diff = () => [] }) {
  if (parents.length === 2) {
    const tested = parents[1];
    const extra = diff(tested).filter((f) => !TESTED_ONLY_DIFF.includes(f));
    if (extra.length)
      return { error: `main's tree is not the tree that was tested: ${head.slice(0, 9)} differs from its dev parent ${tested.slice(0, 9)} in ${extra.length} file(s) beyond ${TESTED_ONLY_DIFF.join(", ")}: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? ", ..." : ""}` };
    return { tested, shape: "a --no-ff promotion merge; its dev parent" };
  }
  if (parents.length === 1) return { tested: head, shape: "a single-parent push; the pushed commit itself" };
  return { error: `a push to main whose head has ${parents.length} parents cannot be traced to one tested commit (fails closed)` };
}

/** The e2e-full runs on one commit: does any counted run vouch for it? */
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
    `cancels the rest by design. To get a green run for ${short} itself, while it is dev's tip and no merge is in flight: ` +
    `gh workflow run e2e-full.yml --ref dev; otherwise give it a branch of its own, which cancels nothing on dev: ` +
    `git push origin ${sha}:refs/heads/verify-${short} && gh workflow run e2e-full.yml --ref verify-${short}. Then re-run this deploy.` };
}

const git = (root, ...a) => {
  const r = spawnSync("git", a, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${(r.stderr || "").trim()}`);
  return r.stdout.trim();
};

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
    let tested, shape;
    if (args.includes("--commit")) { tested = args[args.indexOf("--commit") + 1]; shape = "named on the command line (a dry run of the run check)"; }
    else {
      const at = args.includes("--head") ? args[args.indexOf("--head") + 1] : "HEAD"; // --head: a dry run of the whole rule
      const head = git(root, "rev-parse", at);
      const parents = git(root, "rev-list", "--parents", "-n", "1", head).split(" ").slice(1);
      const t = promotionTarget({ head, parents, diff: (other) => git(root, "diff", "--name-only", other, head).split("\n").filter(Boolean) });
      if (t.error) { console.log(`::error title=Promotion rule::${t.error}`); return 1; }
      ({ tested, shape } = t);
    }
    if (!/^[0-9a-f]{40}$/.test(tested || "")) { console.log(`::error title=Promotion rule::not a full commit sha: ${tested}`); return 1; }
    const v = evaluatePromotion(await e2eFullRuns(tested), tested);
    console.log(`promotion: the commit that vouches for this push is ${tested} (${shape}); e2e-full runs on it: ${v.runs}`);
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
  const line = { error: "::error title=Deploy gate time::", warning: "::warning title=Deploy gate time::", ok: "::notice title=Deploy gate time::" }[verdict.level];
  console.log(line + verdict.message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Deploy gate time\n${verdict.message}\n`);
  return verdict.level === "error" ? 1 : 0;
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
