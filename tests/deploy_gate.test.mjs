// THE DEPLOY GATE'S LEDGER AND TRIPWIRE, UNDER TEST (v1.263.0, GATE5; the owner's U147 a). The mechanism and its
// history are in scripts/deploy_gate.mjs's header; this file pins what it claims:
//   TAGS      every @curated in code under e2e/journeys sits in a title a row of tests/artifacts/deploy_gate.json
//             matches: a tag with no row fails, a row with no tag fails, a row two tags could own fails;
//   BUDGET    the rows' seconds, a new test counted at the measured rows' p90, plus the start-up, fit under the
//             line of tests/artifacts/deploy_gate_budget.json; zero rows or zero measurements fail;
//   LISTED    (the exact half, run in e2e-full's build job, where the site exists) Playwright's own selection equals
//             the rows title for title; zero listed fails;
//   TRIPWIRE  exactly one step of the gate's name, completed: ok under the target, a warning over it, an error over
//             the line; zero or two steps, or a failed one, is an error and never reads as fast;
//   WIRING    both deploys run the gate with the budget's timeout, and the tripwire after the Pages upload with
//             `actions: read`; deploy.yaml's tripwire cannot cancel Lighthouse, IndexNow or the release and still
//             turns its verdict job red; e2e-full runs on push to dev and checks the listing.
// WHAT THIS CANNOT SEE, beside these: a parametrised title's expansion. A template site is a wildcard here, so a
// condition widened to tag more cases (`width === 390` made `true`) passes this file and fails LISTED in e2e-full.
//
// MUTANTS (2026-11-12, each applied to the real tree alone, this file run, then reverted; the first failing case
// is the kill):
//   a 57th test tagged (alias-search's first, no row)        → "the real tree" (TAGS: a tagged test with no row)
//   one row deleted (golden-path)                            → "the real tree" (TAGS: same)
//   a kept test renamed (one word of hidden-moves' title)    → "the real tree" (TAGS: a row matches no tagged test, and its tag no row)
//   one row's ci_s set to 900                                → "the real tree" (BUDGET: over the line)
//   deploy-dev's gate timeout put back to 45                 → "both deploys" (WIRING)
//   deploy.yaml's tripwire without continue-on-error         → "both deploys" (WIRING)
//   e2e-full's push trigger removed                          → "e2e-full" (WIRING)
//   game-value-live's condition widened to every width       → NOT killed here, by design (see above); killed by
//                                                              `check --listed`: "the gate runs a test with no row"
//
// GATE6 (v1.263.1, the reviewer's findings 1, 5 and 6 on #388), each mutant applied alone to a scratch copy, this file
// run, reverted; every one killed at the named assertion:
//   RAN        posttest:curated removed → "npm runs the count after every green curated run"; the config's JSON reporter
//              removed → "the core config writes the report the count reads"; a skipped test counted as passed → "a
//              skipped test is counted as skipped, never as passed"; a row that did not run unreported → "a row the gate
//              did not run"; an empty report passing → /ZERO tests/. On a REAL report (golden-path's kept test given a
//              test.skip): "skipped in the gate, so its surface went unchecked: golden-path.spec.ts › …".
//   PROMOTION  pull_request runs counted → "a PR run tested a merge ref, not this commit"; a cancelled run vouching →
//              "a cancelled run (a burst of merges) does not vouch"; the merge's MAIN parent taken → "a promotion merge
//              is vouched for by its DEV parent, the second"; the tree check dropped → "a merge whose tree differs from
//              its dev parent's beyond keepalive fails closed"; an octopus traced to its second parent → "a head with 3
//              parents is no promotion shape"; deploy.yaml without the step → "the promotion rule runs once"; the step
//              made continue-on-error → "the promotion rule is unconditional and blocking" (check_build_chains.py also
//              refuses both; tests/build_chains.test.mjs pins those).
//   PUSH-RUN   `paths: ["docs/**"]` on the push trigger → "e2e-full's push trigger carries no paths"; the shard job
//              `if: github.event_name == 'pull_request'` → "test runs whenever the site built, and on nothing else"; gen
//              without its condition → "gen runs whenever…"; an `if:` on the shard command → "the suite commands
//              themselves are unconditional and blocking". (The reviewer's two survivors on #388 are the first two.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ROOT, BUDGET, MANIFEST, check, scanSites, checkStatic, checkBudget, checkListed, flattenListing,
  evaluateTripwire, parseGateLog, lineLiterals, loadJson, flattenResults, checkRan, RESULTS,
  promotionTarget, evaluatePromotion, TESTED_ONLY_DIFF,
} from "../scripts/deploy_gate.mjs";

const budget = loadJson(ROOT, BUDGET);
const row = (file, title, ci_s = 1, tier = "S") => ({ file, title, tier, reason: "a reason of some length", ci_s });

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "deploy-gate-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, "e2e/journeys", name, ".."), { recursive: true });
    writeFileSync(join(root, "e2e/journeys", name), text);
  }
  return root;
}

test("the real tree: every @curated tag has its row, every row its tag, and the rows fit under the line", () => {
  const r = check(ROOT);
  console.log("# " + r.summary);
  assert.deepEqual(r.errors, []);
  const manifest = loadJson(ROOT, MANIFEST);
  assert.ok(r.sites.length > 0 && manifest.tests.length > 0, "positive coverage: tag sites and rows were both found");
  assert.ok(r.sites.length <= manifest.tests.length, "a site is a title; a parametrised one may own more than one row");
  assert.ok(r.budget.total <= budget.line_min * 60);
});

test("TAGS: a tag with no row, a row with no tag, and a row two tags could own all fail", () => {
  const root = fixture({
    "a.spec.ts": [
      'test("@curated kept one", async () => {})',
      'test("untagged", async () => {})',
      "// a comment saying @curated is prose, not a tag",
      ' * and so is this @curated',
      'test("a new test tagged @curated", async () => {})',
    ].join("\n"),
    "sub/b.spec.ts": 'for (const w of [1440, 390]) test(`${w === 390 ? "@curated " : ""}smoke at ${w}px`, async () => {})',
  });
  try {
    const { sites, errors } = scanSites(root);
    assert.deepEqual(errors, []);
    assert.deepEqual(sites.map((s) => `${s.file}:${s.line}:${s.kind}`), ["a.spec.ts:1:exact", "a.spec.ts:5:exact", "sub/b.spec.ts:1:template"]);
    const rows = [row("a.spec.ts", "@curated kept one"), row("sub/b.spec.ts", "@curated smoke at 390px"), row("a.spec.ts", "@curated gone")];
    const errs = checkStatic(sites, { tests: rows });
    assert.equal(errs.length, 2, errs.join("\n"));
    assert.match(errs.find((e) => e.includes("gone")), /row matches no tagged test/);
    assert.match(errs.find((e) => e.includes(":5:")), /a tagged test with no row/);
    // a describe's tag is owned through the describe segment of the title
    const d = fixture({ "d.spec.ts": 'test.describe("Engine @curated", () => {\n  test("one", async () => {})\n})' });
    assert.deepEqual(checkStatic(scanSites(d).sites, { tests: [row("d.spec.ts", "Engine @curated › one")] }), []);
    rmSync(d, { recursive: true, force: true });
    // ambiguity: two sites with the same literal
    const twin = fixture({ "t.spec.ts": 'test("@curated same", async () => {})\ntest("@curated same", async () => {})' });
    assert.match(checkStatic(scanSites(twin).sites, { tests: [row("t.spec.ts", "@curated same")] })[0], /matches 2 tagged sites/);
    rmSync(twin, { recursive: true, force: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("TAGS: a tag the scan cannot read as one title on one line fails, never passes unseen", () => {
  const root = fixture({ "m.spec.ts": 'test(wide ? "@curated wide" : "@curated narrow", async () => {})\nconst t = `@curated open\nstill open`\ntest(\n  "@curated a title that starts here" +\n  " and ends here", async () => {})' });
  try {
    const { sites, errors } = scanSites(root);
    assert.equal(errors.length, 2, errors.join("\n"));
    assert.ok(errors.every((e) => /cannot read as ONE title literal on one line/.test(e)));
    // a title split over lines reads as its first half, which no row's title equals: it fails as a tag with no row
    assert.match(checkStatic(sites, { tests: [row("m.spec.ts", "@curated a title that starts here and ends here")] }).join("\n"), /a tagged test with no row/);
  } finally { rmSync(root, { recursive: true, force: true }); }
  assert.deepEqual(lineLiterals('x("a // b", `c ${d("e")} f`) // "g"').literals.map((l) => l.body), ["a // b", 'c ${d("e")} f']);
});

test("BUDGET: an unmeasured row counts at the measured p90; over the line fails, over the target warns", () => {
  const b = { target_min: 1, line_min: 2, timeout_min: 3, startup_s: 5 };
  const ten = Array.from({ length: 10 }, (_, i) => row("f.spec.ts", "t" + i, i + 1)); // 55 s, p90 = 9 s
  let r = checkBudget({ tests: ten }, b);
  assert.deepEqual([r.errors, r.warnings, r.total, r.p90], [[], [], 60, 9]);
  r = checkBudget({ tests: [...ten, row("f.spec.ts", "new", null)] }, b);
  assert.deepEqual([r.errors, r.total, r.unmeasured], [[], 69, 1]);
  assert.match(r.warnings[0], /over its 1-min target/);
  r = checkBudget({ tests: [...ten, ...Array.from({ length: 6 }, (_, i) => row("f.spec.ts", "n" + i, null))] }, b);
  assert.deepEqual([r.errors, r.total], [[], 114]);
  r = checkBudget({ tests: [...ten, ...Array.from({ length: 7 }, (_, i) => row("f.spec.ts", "n" + i, null))] }, b);
  assert.match(r.errors[0], /sum to 123 s, over its 2-min line \(120 s\): 10 measured, 7 counted at the p90 of 9\.0 s/);
});

test("BUDGET: zero rows, zero measurements, a bad field, a duplicate and a disordered budget all fail", () => {
  const b = { target_min: 5, line_min: 10, timeout_min: 20, startup_s: 10 };
  assert.ok(checkBudget({ tests: [] }, b).errors.some((e) => /no rows/.test(e)));
  assert.ok(checkBudget({ tests: [row("f.spec.ts", "a", null)] }, b).errors.some((e) => /no row carries a measurement/.test(e)));
  const bad = checkBudget({ tests: [row("f.spec.ts", "a", 0), { ...row("f.spec.ts", "b"), tier: "X" }, { ...row("f.spec.ts", "c"), reason: "" }, row("f.spec.ts", "d"), row("f.spec.ts", "d")] }, b).errors;
  for (const rx of [/ci_s must be/, /tier must be/, /needs its reason/, /duplicate row/]) assert.ok(bad.some((e) => rx.test(e)), rx + "\n" + bad.join("\n"));
  assert.ok(checkBudget({ tests: [row("f.spec.ts", "a")] }, { ...b, timeout_min: 10 }).errors.some((e) => /target < line < timeout/.test(e)));
});

test("LISTED: Playwright's selection must equal the rows, and zero listed fails", () => {
  const json = { suites: [{ title: "x.spec.ts", specs: [{ file: "x.spec.ts", title: "@curated a", tests: [{}] }], suites: [{ title: "D", specs: [{ file: "x.spec.ts", title: "@curated b", tests: [{}] }] }] }] };
  const listed = flattenListing(json);
  assert.deepEqual(listed, [{ file: "x.spec.ts", title: "@curated a" }, { file: "x.spec.ts", title: "D › @curated b" }]);
  assert.deepEqual(checkListed(listed, { tests: [row("x.spec.ts", "@curated a"), row("x.spec.ts", "D › @curated b")] }), []);
  const errs = checkListed(listed, { tests: [row("x.spec.ts", "@curated a"), row("x.spec.ts", "gone")] });
  assert.ok(errs.some((e) => /runs a test with no row: x\.spec\.ts › D › @curated b/.test(e)) && errs.some((e) => /does not run: x\.spec\.ts › gone/.test(e)));
  assert.ok(checkListed([], { tests: [] }).some((e) => /ZERO/.test(e)));
});

test("RAN: the tests that ran and passed must be exactly the rows, none skipped, and more than zero", () => {
  const rows = { tests: [row("a.spec.ts", "@curated one"), row("a.spec.ts", "D › @curated two")] };
  const t = (status = "expected", result = "passed") => ({ status, results: [{ status: result }] });
  const report = (one, two, extra = []) => ({ suites: [{ title: "a.spec.ts", file: "a.spec.ts", specs: [...(one ? [{ title: "@curated one", file: "a.spec.ts", tests: [one] }] : []), ...extra],
    suites: two ? [{ title: "D", file: "a.spec.ts", specs: [{ title: "@curated two", file: "a.spec.ts", tests: [two] }] }] : [] }] });
  const at = (json) => checkRan(flattenResults(json), rows);
  let r = at(report(t(), t()));
  assert.deepEqual([r.errors, r.passed, r.skipped, r.rows], [[], 2, 0, 2], "every row ran and passed: no error");
  r = at(report(t(), t("skipped", "skipped")));
  assert.deepEqual([r.passed, r.skipped], [1, 1], "a skipped test is counted as skipped, never as passed");
  assert.match(r.errors.join("\n"), /skipped in the gate, so its surface went unchecked: a\.spec\.ts › D › @curated two/);
  assert.match(at(report(t(), null)).errors.join("\n"), /a row the gate did not run: a\.spec\.ts › D › @curated two/);
  assert.match(at({ suites: [] }).errors.join("\n"), /ZERO tests/);
  assert.match(at(report(t(), t("unexpected", "failed"))).errors.join("\n"), /did not pass in the gate \(unexpected, failed\)/);
  assert.match(at(report(t(), t(), [{ title: "@curated three", file: "a.spec.ts", tests: [t()] }])).errors.join("\n"), /ran in the gate with no row: a\.spec\.ts › @curated three/);
});

test("RAN is wired: the curated script's post hook counts the config's own JSON report", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["posttest:curated"], "node scripts/deploy_gate.mjs ran", "npm runs the count after every green curated run");
  const config = readFileSync(join(ROOT, "e2e/playwright.config.ts"), "utf8");
  assert.match(config, /\["json", \{ outputFile: "test-results\/results\.json" \}\]/, "the core config writes the report the count reads");
  assert.equal(RESULTS, "e2e/test-results/results.json", "the config's outputDir-relative report, as the count reads it");
});

test("PROMOTION: which commit vouches for a push to main, for every shape of push", () => {
  const H = "a".repeat(40), M = "b".repeat(40), D = "c".repeat(40);
  // the --no-ff promotion merge: its dev parent, when main's tree is that parent's plus only the keepalive file
  assert.equal(promotionTarget({ head: H, parents: [M, D], diff: () => [...TESTED_ONLY_DIFF] }).tested, D, "a promotion merge is vouched for by its DEV parent, the second");
  assert.equal(promotionTarget({ head: H, parents: [M, D], diff: () => [] }).tested, D, "...with or without the keepalive difference");
  const drifted = promotionTarget({ head: H, parents: [M, D], diff: () => [".github/keepalive.txt", "neural/src/app.src.jsx"] });
  assert.ok(drifted.error && !drifted.tested, "a merge whose tree differs from its dev parent's beyond keepalive fails closed");
  assert.match(drifted.error, /main's tree is not the tree that was tested: .* in 1 file\(s\) beyond .*neural\/src\/app\.src\.jsx/);
  // a non-merge push: the pushed commit itself must carry the green run
  assert.equal(promotionTarget({ head: H, parents: [M] }).tested, H);
  // anything else fails closed
  for (const parents of [[M, D, "d".repeat(40)], []]) {
    const t = promotionTarget({ head: H, parents });
    assert.ok(t.error && !t.tested, `a head with ${parents.length} parents is no promotion shape: it fails closed`);
    assert.match(t.error, new RegExp(`${parents.length} parents cannot be traced`));
  }
});

test("PROMOTION: only a green push or dispatch run of e2e-full on that commit vouches for it", () => {
  const D = "c".repeat(40);
  const run = (id, event, conclusion, status = "completed", head_sha = D) => ({ id, event, conclusion, status, head_sha });
  assert.equal(evaluatePromotion([run(1, "push", "success")], D).ok, true, "a green push-run");
  const cancelled = evaluatePromotion([run(2, "push", "cancelled")], D);
  assert.equal(cancelled.ok, false, "a cancelled run (a burst of merges) does not vouch");
  assert.match(cancelled.message, /runs found: run 2 \(push, cancelled\)/);
  assert.match(cancelled.message, /Promote the newest dev commit whose push-run of e2e-full is green: a burst of merges keeps one run/);
  assert.match(cancelled.message, /gh workflow run e2e-full\.yml --ref dev;.*git push origin c{40}:refs\/heads\/verify-c{9} && gh workflow run e2e-full\.yml --ref verify-c{9}/);
  assert.match(evaluatePromotion([], D).message, /runs found: none/, "no run at all");
  assert.equal(evaluatePromotion([run(3, "push", "failure"), run(4, "workflow_dispatch", "success")], D).ok, true, "a red run next to a green dispatched re-run");
  assert.equal(evaluatePromotion([run(5, "pull_request", "success")], D).ok, false, "a PR run tested a merge ref, not this commit");
  assert.equal(evaluatePromotion([run(6, "push", null, "in_progress")], D).ok, false, "a run still going vouches for nothing yet");
  assert.equal(evaluatePromotion([run(7, "push", "success", "completed", "e".repeat(40))], D).ok, false, "another commit's green run");
});

test("TRIPWIRE: exactly one completed gate step; ok, warning and error by the budget; absence is an error", () => {
  const step = (min, over = {}) => ({ name: budget.step, status: "completed", conclusion: "success", started_at: "2026-11-12T10:00:00Z", completed_at: new Date(Date.parse("2026-11-12T10:00:00Z") + min * 60000).toISOString().replace(".000", ""), ...over });
  const jobs = (...steps) => ({ jobs: [{ name: "deploy", steps: [{ name: "Set up job", status: "completed" }, ...steps] }] });
  const at = (v) => [v.level, v.retry];
  assert.deepEqual(at(evaluateTripwire(jobs(step(budget.target_min - 0.1)), budget)), ["ok", false]);
  assert.deepEqual(at(evaluateTripwire(jobs(step(budget.target_min + 0.1)), budget)), ["warning", false]);
  const over = evaluateTripwire(jobs(step(budget.line_min + 0.1)), budget);
  assert.deepEqual(at(over), ["error", false]);
  assert.match(over.message, /this deployment went out; the gate itself is too slow/);
  assert.match(evaluateTripwire(jobs(), budget).message, /exactly one step .* found 0/);
  assert.match(evaluateTripwire({ jobs: [{ steps: [step(1)] }, { steps: [step(1)] }] }, budget).message, /found 2/);
  assert.deepEqual(at(evaluateTripwire(jobs(step(1, { status: "in_progress", completed_at: null })), budget)), ["error", true]);
  assert.deepEqual(at(evaluateTripwire(jobs(step(1, { conclusion: "failure" })), budget)), ["error", false]);
});

test("refresh reads the list reporter's lines, in a gh run view log and a raw one, and only passed tests", () => {
  const log = [
    "deploy-preview\tCurated journey gate (Playwright E2E)\t2026-11-12T11:43:42.7887696Z   ✓    1 e2e/journeys/a.spec.ts:29:5 › @curated one (1.2s)",
    "2026-11-12T11:43:43.0Z   ✓    2 e2e/journeys/b.spec.ts:3:1 › D › @curated two (845ms)",
    "2026-11-12T11:43:44.0Z   ✓    3 e2e/journeys/c.spec.ts:3:1 › @curated three (1.5m)",
    "2026-11-12T11:43:45.0Z   ✘    4 e2e/journeys/d.spec.ts:3:1 › @curated red (2.0s)",
    "2026-11-12T11:43:46.0Z   -    5 e2e/journeys/e.spec.ts:3:1 › @curated skipped",
  ].join("\n");
  assert.deepEqual([...parseGateLog(log)], [["a.spec.ts › @curated one", 1.2], ["b.spec.ts › D › @curated two", 0.845], ["c.spec.ts › @curated three", 90]]);
});

// ── the wiring, read through PyYAML (ci-validate installs it before this suite; `on:` is YAML 1.1's boolean) ──
function workflow(name) {
  const r = spawnSync("python3", ["-B", "-c", "import json,sys,yaml\nw=yaml.safe_load(open(sys.argv[1]))\nw['on']=w.pop(True,w.get('on'))\nprint(json.dumps(w))", join(ROOT, ".github/workflows", name)], { encoding: "utf8" });
  assert.equal(r.status, 0, `PyYAML could not read ${name}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test("both deploys: the gate step at the budget's timeout, then the tripwire after the Pages upload", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts["test:curated"], /playwright test -c e2e\/playwright\.config\.ts --grep @curated$/, "the gate's selection is what this ledger models");
  let seen = 0;
  for (const name of ["deploy-dev.yaml", "deploy.yaml"]) {
    const wf = workflow(name);
    const gates = [], wires = [];
    for (const [jid, job] of Object.entries(wf.jobs)) (job.steps || []).forEach((s, i) => {
      if (s.name === budget.step) gates.push({ jid, job, s, i });
      if (/node scripts\/deploy_gate\.mjs tripwire\b/.test(s.run || "")) wires.push({ jid, job, s, i });
    });
    assert.equal(gates.length, 1, `${name}: exactly one "${budget.step}" step`);
    assert.equal(wires.length, 1, `${name}: exactly one tripwire step`);
    const [g] = gates, [w] = wires;
    assert.equal(g.s.run, "npm run test:curated", `${name}: the gate runs the curated script`);
    assert.equal(g.s["timeout-minutes"], budget.timeout_min, `${name}: the gate's timeout is the budget's timeout_min`);
    assert.equal(w.jid, g.jid, `${name}: the tripwire reads the gate in its own job`);
    const cf = g.job.steps.findIndex((s) => /^cloudflare\/wrangler-action@/.test(s.uses || "") && /pages deploy/.test(s.with?.command || ""));
    assert.ok(cf > g.i && w.i > cf, `${name}: gate, then the Pages upload, then the tripwire`);
    assert.equal(w.s.env?.GH_TOKEN, "${{ github.token }}", `${name}: the tripwire reads the jobs API with the run's token`);
    assert.equal(w.job.permissions?.actions, "read", `${name}: the job may read its own run's jobs`);
    const promo = Object.values(wf.jobs).flatMap((j) => j.steps || []).filter((s) => /deploy_gate\.mjs promotion/.test(s.run || ""));
    if (name === "deploy.yaml") {
      assert.equal(promo.length, 1, "deploy.yaml: the promotion rule runs once");
      const steps = g.job.steps, at = steps.indexOf(promo[0]);
      assert.ok(at >= 0 && at < steps.findIndex((s) => s.name === "Build Quartz"), "deploy.yaml: in the deploy job, before the build");
      assert.equal(promo[0].run, "node scripts/deploy_gate.mjs promotion");
      assert.ok(!("if" in promo[0]) && !promo[0]["continue-on-error"], "deploy.yaml: the promotion rule is unconditional and blocking");
      assert.equal(promo[0].env?.GH_TOKEN, "${{ github.token }}");
      assert.equal(steps[0].with?.["fetch-depth"], 0, "deploy.yaml: full history, so the merge's parents and their trees are there");
    } else assert.equal(promo.length, 0, "deploy-dev.yaml: a preview has nothing to promote");
    if (name === "deploy.yaml") {
      assert.equal(w.s["continue-on-error"], true, "deploy.yaml: a slow gate must not cancel Lighthouse, IndexNow or the release");
      assert.ok(w.s.id, "deploy.yaml: the tripwire has an id");
      const out = Object.entries(w.job.outputs || {}).find(([, v]) => v === `\${{ steps.${w.s.id}.outcome }}`);
      assert.ok(out, "deploy.yaml: the tripwire's outcome is a job output");
      const verdict = Object.values(wf.jobs).filter((j) => (j.steps || []).some((s) => (s.run || "").includes(`needs.${w.jid}.outputs.${out[0]}`)));
      assert.equal(verdict.length, 1, "deploy.yaml: exactly one verdict job turns a slow gate red");
    }
    seen++;
  }
  assert.equal(seen, 2);
});

test("e2e-full: every push to dev runs the full suite, one run per burst, and checks the gate's listing", () => {
  const wf = workflow("e2e-full.yml");
  assert.deepEqual(wf.on.push?.branches, ["dev"], "e2e-full runs on push to dev");
  assert.ok(wf.on.pull_request, "and still on every PR");
  assert.equal(wf.concurrency["cancel-in-progress"], true, "a burst of merges costs one run");
  assert.match(wf.concurrency.group, /github\.ref/);
  const listed = Object.values(wf.jobs).flatMap((j) => j.steps || []).filter((s) => /node scripts\/deploy_gate\.mjs check --listed/.test(s.run || ""));
  assert.equal(listed.length, 1, "exactly one step checks Playwright's own selection against the rows");
});

// v1.263.1 (GATE6 part 5, the reviewer's finding 5 on #388): the promotion rule relies on the push-run being the WHOLE
// suite, so nothing may narrow it: no path filter on either trigger, and no condition that could skip a job beyond
// the one part 4 adds (the shards and gen wait on the tested site's upload, not on the build job's other gates).
test("e2e-full: nothing narrows the push-run: no path filter, no job or step condition beyond 'the site built'", () => {
  const wf = workflow("e2e-full.yml");
  for (const ev of ["push", "pull_request"]) for (const k of ["paths", "paths-ignore", "branches-ignore", "tags", "tags-ignore"])
    assert.ok(!(k in (wf.on[ev] || {})), `e2e-full's ${ev} trigger carries no ${k}`);
  assert.deepEqual(Object.keys(wf.jobs).sort(), ["build", "gen", "test"], "the three jobs, and no fourth one to hide a condition in");
  assert.ok(!("if" in wf.jobs.build), "the build job always runs");
  const SITE = "${{ !cancelled() && needs.build.outputs.site == 'success' }}";
  for (const j of ["test", "gen"]) {
    assert.equal(wf.jobs[j].if, SITE, `${j} runs whenever the site built, and on nothing else`);
    assert.equal(wf.jobs[j].needs, "build");
  }
  const upload = wf.jobs.build.steps.find((s) => s.id === "upload-site");
  assert.equal(wf.jobs.build.outputs?.site, "${{ steps.upload-site.outcome }}", "the output the shards wait on is the tested site's upload");
  assert.equal(upload?.if, "${{ !cancelled() && steps.site-build.outcome == 'success' }}");
  const shard = wf.jobs.test.steps.filter((s) => /npm test -- --shard=\$\{\{ matrix\.shard \}\}\/4/.test(s.run || ""));
  const gen = wf.jobs.gen.steps.filter((s) => /npm run e2e:gen/.test(s.run || ""));
  assert.equal(shard.length, 1, "each shard runs its quarter of the core suite");
  assert.equal(gen.length, 1, "gen runs the generated suite");
  assert.ok(![...shard, ...gen].some((s) => "if" in s || s["continue-on-error"]), "the suite commands themselves are unconditional and blocking");
  assert.deepEqual(wf.jobs.test.strategy?.matrix?.shard, [1, 2, 3, 4], "all four shards");
});
