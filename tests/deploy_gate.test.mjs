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
// GATE6 (v1.263.3, the reviewer's findings 1, 5 and 6 on #388), each mutant applied alone to a scratch copy, this file
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
//
// GATE7 (v1.264.2, the reviewer's new 1-3, 6 and 7 on #392), each mutant applied alone to a scratch copy, killed at:
//   PROMOTION  the head's own run not looked at first → "a fast-forward of main onto a dev tip with a green push-run
//              passes on that tip"; the second parent's run not looked at → "a --no-ff promotion with no run of its own
//              falls back to its dev parent"; no keepalive walk → "a keepalive on top of a promotion passes"; every
//              single-parent commit walked → /is a single-parent commit that changes more than/; the recipe dropped from
//              that failure → "...and its message gives the branch-and-dispatch recipe for that commit".
//   COUNT      ran leaving no count → "ran leaves what it counted beside the report, for the tripwire"; a missing count
//              passing → "a missing count (the hook never ran) fails the tripwire"; the tripwire ignoring the count → "a
//              missing or wrong count turns the tripwire red even when the time is fine"; a tracked .npmrc with
//              ignore-scripts=true → ".npmrc sets ignore-scripts…"; npm_config_ignore_scripts on deploy.yaml's gate
//              step → "deploy.yaml sets npm_config_ignore_scripts…".
//   PUSH-RUN   the tested-site upload without if-no-files-found → "nothing packaged fails the upload…"; an `if:` on the
//              shards' "Download tested site" (the reviewer's M7c, which survived #392) → "…carries the condition …".
//
// GATE8 (the reviewer's new 1-4 on #393), each mutant applied alone to a scratch copy, killed at:
//   LISTING    the old porcelain `git diff --name-only` (renames on), and diff-tree with -M → "R2 stops the walk itself:
//              the listing sees both paths of the rename, before any backstop"; diff-tree without
//              --ignore-submodules=none → "a submodule bump beside a keepalive edit is a real change, even under
//              ignore = all"; the head backstop removed → "the head is compared with the commit whose own run vouched,
//              whatever the steps' listings said". NOT KILLED, by design: diff-tree without -z. git quotes any name
//              holding a control character, so a newline-led name can never split into a keepalive line; -z stays for
//              exact raw paths.
//   GUARDS     (the reviewer's six survivors on #393) every→some in the walk → "a keepalive edit plus another file is
//              not keepalive-only"; the judgment ignoring the count, and a constant count → "no count file in the tree:
//              the tripwire is red though the time is fine"; the merge path's tree check against the merge → "the tree
//              check on the merge path is against the head…"; the walk limit removed → "the twenty-first fails closed";
//              schedule runs counted → "a green schedule run does not vouch".
//   EMPTY      no empty-commit step → "an empty commit on a promotion passes on the promotion's dev parent"; emptiness
//              decided by the listing → "...the walk stops AT that commit, before any backstop has to catch it".
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ROOT, BUDGET, MANIFEST, check, scanSites, checkStatic, checkBudget, checkListed, flattenListing,
  evaluateTripwire, parseGateLog, lineLiterals, loadJson, flattenResults, checkRan, RESULTS,
  judgePromotion, evaluatePromotion, TESTED_ONLY_DIFF, ran, COUNT, evaluateCount, tripwireExit, gitAccess, tripwireJudge,
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

// A fixture commit graph for judgePromotion: each commit has parents and a tree (path -> content); runs are by sha.
function graph(commits, runs = {}) {
  const tree = (sha) => commits[sha].tree;
  return {
    parentsOf: (sha) => commits[sha].parents,
    diff: (a, b) => [...new Set([...Object.keys(tree(a)), ...Object.keys(tree(b))])].filter((f) => tree(a)[f] !== tree(b)[f]).sort(),
    runsOf: async (sha) => (runs[sha] || []).map((r, i) => ({ id: i + 1, head_sha: sha, status: "completed", ...r })),
  };
}
const sha = (c) => c.repeat(40);
const T = { "app.js": "v1", ".github/keepalive.txt": "dev" };
const KEEP = { ...T, ".github/keepalive.txt": "main, week 2" };
const GREEN = [{ event: "push", conclusion: "success" }];

test("PROMOTION: a head with its own green run passes on it first; only then the second parent and the tree check", async () => {
  // dev's tip D is a PR merge (parents: dev's previous tip P and the PR head R); R has only a pull_request run
  const base = { [sha("p")]: { parents: [], tree: T }, [sha("r")]: { parents: [sha("p")], tree: T },
    [sha("d")]: { parents: [sha("p"), sha("r")], tree: T } };
  const prRun = { [sha("r")]: [{ event: "pull_request", conclusion: "success" }] };
  // FAST-FORWARD of main onto D, which has its own green push-run: passes on D itself (FFDEV / FF8844 on #392 failed here)
  let v = await judgePromotion({ head: sha("d"), ...graph(base, { ...prRun, [sha("d")]: GREEN }) });
  assert.equal(v.ok, true, "a fast-forward of main onto a dev tip with a green push-run passes on that tip");
  assert.equal(v.tested, sha("d"), "...and the commit that vouches is the pushed commit itself, not its second parent");
  // the --no-ff promotion M (parents: main's tip, D): M has no run of its own, so the second parent D vouches
  const promo = { ...base, [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP } };
  v = await judgePromotion({ head: sha("m"), ...graph(promo, { ...prRun, [sha("d")]: GREEN }) });
  assert.equal(v.ok, true, "a --no-ff promotion with no run of its own falls back to its dev parent");
  assert.equal(v.tested, sha("d"), "...the second parent");
  // the order matters: a merge with its OWN green run passes even when its second parent has none
  v = await judgePromotion({ head: sha("m"), ...graph(promo, { [sha("m")]: [{ event: "workflow_dispatch", conclusion: "success" }] }) });
  assert.equal(v.tested, sha("m"), "the pushed commit's own green run is looked at before its second parent");
  // a fast-forward onto a dev tip WITHOUT a green run falls back to the PR head, which has only a pull_request run: fails
  v = await judgePromotion({ head: sha("d"), ...graph(base, prRun) });
  assert.equal(v.ok, false, "a two-parent head with no green run of its own or of its second parent fails");
  assert.match(v.message, new RegExp(`neither ${sha("d").slice(0, 9)} .* nor its dev parent has a counted green run`));
  // the tree check still guards the fallback
  const drift = { ...promo, [sha("m")]: { parents: [sha("p"), sha("d")], tree: { ...KEEP, "app.js": "v2" } } };
  v = await judgePromotion({ head: sha("m"), ...graph(drift, { [sha("d")]: GREEN }) });
  assert.ok(!v.ok && /main's tree is not the tree that was tested: .* in 1 file\(s\) beyond .*app\.js/.test(v.message), "a merge whose tree differs from its dev parent's beyond keepalive fails closed");
});

test("PROMOTION: keepalive commits on main are walked back through; any other single-parent tip fails with a recipe", async () => {
  const base = { [sha("p")]: { parents: [], tree: T }, [sha("d")]: { parents: [sha("p")], tree: T },
    [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP },
    [sha("k")]: { parents: [sha("m")], tree: { ...KEEP, ".github/keepalive.txt": "main, week 3" } },
    [sha("j")]: { parents: [sha("k")], tree: { ...KEEP, ".github/keepalive.txt": "main, week 4" } },
    [sha("x")]: { parents: [sha("m")], tree: { ...KEEP, "app.js": "hotfix" } } };
  const runs = { [sha("d")]: GREEN };
  let v = await judgePromotion({ head: sha("k"), ...graph(base, runs) });
  assert.equal(v.ok, true, "a keepalive on top of a promotion passes");
  assert.equal(v.tested, sha("d"), "...on the commit that vouched for the promotion");
  v = await judgePromotion({ head: sha("j"), ...graph(base, runs) });
  assert.deepEqual([v.ok, v.tested], [true, sha("d")], "two keepalives in a row are both walked back through");
  v = await judgePromotion({ head: sha("x"), ...graph(base, runs) });
  assert.equal(v.ok, false, "a real commit on top of a promotion fails: nothing ran the suite on its tree");
  assert.match(v.message, /is a single-parent commit that changes more than \.github\/keepalive\.txt/);
  assert.match(v.message, new RegExp(`git push origin ${sha("x")}:refs/heads/verify-${sha("x").slice(0, 9)} && gh workflow run e2e-full\\.yml --ref verify-`), "...and its message gives the branch-and-dispatch recipe for that commit");
});

// A REAL git repository for the cases a path-by-path tree fixture cannot express (a rename, a gitlink, a raw name).
// Commits are built with plumbing (a private index, hash-object, commit-tree) under the identity "fixture <>", with no
// global or system git config, so nothing on the machine running the test can change what git lists.
function gitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "deploy-gate-git-"));
  const env = { ...process.env, HOME: dir, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_INDEX_FILE: join(dir, "fixture.index"),
    GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "", GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "" };
  const g = (args, input) => {
    const r = spawnSync("git", args, { cwd: dir, env, encoding: "utf8", input });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  g(["init", "-q", "."]);
  // files: path -> text (100644), { text, mode } (100755), { link } (a symlink), { gitlink: sha }, or null (removed)
  const commit = (parents, files) => {
    g(parents.length ? ["read-tree", parents[0]] : ["read-tree", "--empty"]);
    for (const [path, f] of Object.entries(files)) {
      if (f === null) { g(["update-index", "--force-remove", "--", path]); continue; }
      if (f.gitlink) { g(["update-index", "--add", "--cacheinfo", `160000,${f.gitlink},${path}`]); continue; }
      const plain = typeof f === "string"; // (a string has a .link: String.prototype.link, so test the type first)
      const text = plain ? f : f.text ?? f.link;
      const mode = plain ? "100644" : typeof f.link === "string" ? "120000" : f.mode || "100644";
      const blob = g(["hash-object", "-w", "--stdin"], text);
      g(["update-index", "--add", "--cacheinfo", `${mode},${blob},${path}`]);
    }
    const tree = g(["write-tree"]);
    return g(["commit-tree", tree, ...parents.flatMap((p) => ["-p", p]), "-m", "fixture"]);
  };
  return { dir, commit, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("PROMOTION on real git: no listing trick lets the keepalive walk step over a real change (the reader's R1/R2 and past it)", async () => {
  const r = gitRepo();
  try {
    const K = ".github/keepalive.txt";
    const B = r.commit([], { [K]: "k0", "content/terms.md": "the terms page\n", "a.txt": "a\n" });
    const runs = async (sha) => (sha === B ? [{ id: 1, head_sha: B, event: "push", status: "completed", conclusion: "success" }] : []);
    const judge = (head) => judgePromotion({ head, ...gitAccess(r.dir), runsOf: runs });
    // the control: a keepalive-only commit on B passes on B's own run
    assert.equal((await judge(r.commit([B], { [K]: "k1" }))).tested, B, "control: a keepalive-only commit is stepped over to B, which vouches");
    // R1 deletes the keepalive file; R2 RENAMES content/terms.md onto it: main would ship without the terms page
    const R1 = r.commit([B], { [K]: null });
    const R2 = r.commit([R1], { "content/terms.md": null, [K]: "the terms page\n" });
    let v = await judge(R2);
    assert.equal(v.ok, false, "R2: a commit that renames another file onto the keepalive path is not keepalive-only (the reader's false pass on #393)");
    assert.match(v.message, /single-parent commit that changes more than/, "R2 stops the walk itself: the listing sees both paths of the rename, before any backstop");
    // past the reader: a gitlink bumped beside a keepalive edit, with .gitmodules saying ignore = all (written in the
    // worktree too, where git reads it): porcelain AND plumbing hide the bump without --ignore-submodules=none
    writeFileSync(join(r.dir, ".gitmodules"), '[submodule "sub"]\n\tpath = sub\n\turl = ./sub\n\tignore = all\n');
    const S1 = r.commit([B], { ".gitmodules": '[submodule "sub"]\n\tpath = sub\n\turl = ./sub\n\tignore = all\n', sub: { gitlink: B } });
    const S2 = r.commit([S1], { [K]: "k2", sub: { gitlink: R1 } });
    const subRuns = async (sha) => (sha === S1 ? [{ id: 2, head_sha: S1, event: "push", status: "completed", conclusion: "success" }] : []);
    v = await judgePromotion({ head: S2, ...gitAccess(r.dir), runsOf: subRuns });
    assert.equal(v.ok, false, "a submodule bump beside a keepalive edit is a real change, even under ignore = all");
    // a name that starts with a newline and then reads as the keepalive path: one raw entry, never a keepalive line
    v = await judge(r.commit([B], { [K]: "k3", "\n.github/keepalive.txt": "x\n" }));
    assert.equal(v.ok, false, "a name like \"\\n.github/keepalive.txt\" is its own file, not the keepalive path");
    // listed correctly already, pinned so it stays so: a mode change and a symlink swap beside a keepalive edit
    v = await judge(r.commit([B], { [K]: "k4", "a.txt": { text: "a\n", mode: "100755" } }));
    assert.equal(v.ok, false, "a mode change beside a keepalive edit stops the walk");
    v = await judge(r.commit([B], { [K]: "k5", "a.txt": { link: "content/terms.md" } }));
    assert.equal(v.ok, false, "a symlink swap beside a keepalive edit stops the walk");
  } finally { r.done(); }
});

test("PROMOTION backstop: a walk step whose listing under-reports cannot carry a change past an own-run pass", async () => {
  // K1 really changes app.js, but its step's listing LIES (keepalive only), as a rename did before GATE8. K2 is an honest
  // keepalive. The walk steps over both to B, whose own run vouches; only comparing the HEAD with B catches it.
  const commits = { [sha("b")]: { parents: [], tree: T }, [sha("1")]: { parents: [sha("b")], tree: { ...KEEP, "app.js": "v2" } },
    [sha("2")]: { parents: [sha("1")], tree: { ...KEEP, "app.js": "v2", ".github/keepalive.txt": "week 3" } } };
  const g = graph(commits, { [sha("b")]: GREEN });
  const lying = { ...g, diff: (a, b) => (a === sha("b") && b === sha("1") ? [".github/keepalive.txt"] : g.diff(a, b)) };
  const v = await judgePromotion({ head: sha("2"), ...lying });
  assert.equal(v.ok, false, "the head is compared with the commit whose own run vouched, whatever the steps' listings said");
  assert.match(v.message, /main's tree is not the tree that was tested: .* whose own run vouched, in 1 file\(s\) beyond .*app\.js/);
});

// GATE8 (the reviewer's new 2 on #393): four guards the code had right and no test held.
test("PROMOTION guards: a keepalive commit that also changes another file is not stepped over, nor anything beneath it", async () => {
  const commits = { [sha("p")]: { parents: [], tree: T }, [sha("d")]: { parents: [sha("p")], tree: T },
    [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP },
    [sha("x")]: { parents: [sha("m")], tree: { ...KEEP, ".github/keepalive.txt": "week 3", "app.js": "v2" } },
    [sha("y")]: { parents: [sha("x")], tree: { ...KEEP, ".github/keepalive.txt": "week 4", "app.js": "v2" } } };
  let v = await judgePromotion({ head: sha("x"), ...graph(commits, { [sha("d")]: GREEN }) });
  assert.equal(v.ok, false, "a keepalive edit plus another file is not keepalive-only: the walk stops there");
  v = await judgePromotion({ head: sha("y"), ...graph(commits, { [sha("d")]: GREEN }) });
  assert.equal(v.ok, false, "a keepalive on top of it steps back to it and stops there too");
  assert.match(v.steps.at(-1), new RegExp(`^${sha("x").slice(0, 9)} `), "...the last commit looked at is the mixed one");
});

test("PROMOTION guards: the merge path compares the dev parent with the HEAD's tree, not the merge's", async () => {
  // K1 on top of the promotion merge really changes app.js, but its step's listing LIES; only the head comparison sees it
  const commits = { [sha("p")]: { parents: [], tree: T }, [sha("d")]: { parents: [sha("p")], tree: T },
    [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP },
    [sha("1")]: { parents: [sha("m")], tree: { ...KEEP, "app.js": "v2" } },
    [sha("2")]: { parents: [sha("1")], tree: { ...KEEP, "app.js": "v2", ".github/keepalive.txt": "week 3" } } };
  const g = graph(commits, { [sha("d")]: GREEN });
  const lying = { ...g, diff: (a, b) => (a === sha("m") && b === sha("1") ? [".github/keepalive.txt"] : g.diff(a, b)) };
  const v = await judgePromotion({ head: sha("2"), ...lying });
  assert.equal(v.ok, false, "the tree check on the merge path is against the head, so a lying step cannot carry app.js past it");
  assert.match(v.message, /main's tree is not the tree that was tested: .* the dev parent of .* app\.js/);
});

test("PROMOTION choices: the walk stops at twenty keepalive commits, and schedule runs do not count", async () => {
  const commits = { [sha("p")]: { parents: [], tree: T }, [sha("d")]: { parents: [sha("p")], tree: T },
    [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP } };
  let prev = sha("m");
  for (let i = 1; i <= 21; i++) { const c = `k${String(i).padStart(2, "0")}`.padEnd(40, "0"); commits[c] = { parents: [prev], tree: { ...KEEP, ".github/keepalive.txt": `week ${i}` } }; prev = c; }
  const at = (n) => `k${String(n).padStart(2, "0")}`.padEnd(40, "0");
  assert.equal((await judgePromotion({ head: at(20), ...graph(commits, { [sha("d")]: GREEN }) })).ok, true, "twenty keepalive commits are walked back through");
  const v = await judgePromotion({ head: at(21), ...graph(commits, { [sha("d")]: GREEN }) });
  assert.ok(!v.ok && /more than 20 keepalive-only or empty commits/.test(v.message), "the twenty-first fails closed: a choice, written at KEEPALIVE_WALK");
  const D = sha("d");
  assert.equal(evaluatePromotion([{ id: 9, head_sha: D, event: "schedule", status: "completed", conclusion: "success" }], D).ok, false, "a green schedule run does not vouch: a choice, written at COUNTED_EVENTS");
});

test("TRIPWIRE judgment: it reads the count file from the tree, so neither the call site nor a constant can skip it", () => {
  const root = mkdtempSync(join(tmpdir(), "deploy-gate-trip-"));
  try {
    mkdirSync(join(root, "tests/artifacts"), { recursive: true });
    writeFileSync(join(root, MANIFEST), JSON.stringify({ tests: [row("a.spec.ts", "@curated one"), row("a.spec.ts", "@curated two")] }));
    writeFileSync(join(root, BUDGET), JSON.stringify(budget));
    const jobs = { jobs: [{ name: "deploy", steps: [{ name: budget.step, status: "completed", conclusion: "success", started_at: "2026-11-12T10:00:00Z", completed_at: "2026-11-12T10:02:00Z" }] }] };
    let r = tripwireJudge(root, jobs);
    assert.equal(r.exit, 1, "no count file in the tree: the tripwire is red though the time is fine");
    assert.match(r.lines[1], /::error title=Deploy gate count::the gate's count is missing/);
    mkdirSync(join(root, "e2e/test-results"), { recursive: true });
    writeFileSync(join(root, COUNT), JSON.stringify({ total: 2, passed: 2, skipped: 0, rows: 2, errors: 0 }));
    r = tripwireJudge(root, jobs);
    assert.deepEqual([r.exit, r.time.level, r.count.ok], [0, "ok", true], "the count file equal to the ledger, and the time inside the target: green");
    writeFileSync(join(root, COUNT), JSON.stringify({ total: 1, passed: 1, skipped: 0, rows: 1, errors: 0 }));
    assert.equal(tripwireJudge(root, jobs).exit, 1, "a count file that is not the ledger's is read, and turns it red");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("PROMOTION: an empty commit is stepped over by its tree hash, never by an empty listing (GATE8, the reviewer's new 4)", async () => {
  const commits = { [sha("p")]: { parents: [], tree: T }, [sha("d")]: { parents: [sha("p")], tree: T },
    [sha("m")]: { parents: [sha("p"), sha("d")], tree: KEEP },
    [sha("e")]: { parents: [sha("m")], tree: { ...KEEP } },
    [sha("x")]: { parents: [sha("m")], tree: { ...KEEP, "app.js": "v2" } } };
  const g = graph(commits, { [sha("d")]: GREEN });
  const same = (a, b) => JSON.stringify(commits[a].tree) === JSON.stringify(commits[b].tree);
  let v = await judgePromotion({ head: sha("e"), ...g, sameTree: same });
  assert.deepEqual([v.ok, v.tested], [true, sha("d")], "an empty commit on a promotion passes on the promotion's dev parent");
  // a listing that says "nothing changed" for a commit whose tree differs: it is NOT empty, and it is not keepalive-only
  const lying = { ...g, sameTree: same, diff: (a, b) => (a === sha("m") && b === sha("x") ? [] : g.diff(a, b)) };
  v = await judgePromotion({ head: sha("x"), ...lying });
  assert.equal(v.ok, false, "emptiness is decided by tree hash, so an empty listing cannot pass a real change off as empty");
  assert.match(v.message, /is a single-parent commit that changes more than/, "...the walk stops AT that commit, before any backstop has to catch it");
  // the same on real git: a commit object with its parent's tree, which git itself would call --allow-empty
  const r = gitRepo();
  try {
    const B = r.commit([], { ".github/keepalive.txt": "k0", "a.txt": "a\n" });
    const E = r.commit([B], {});
    v = await judgePromotion({ head: E, ...gitAccess(r.dir), runsOf: async (s) => (s === B ? [{ id: 1, head_sha: B, event: "push", status: "completed", conclusion: "success" }] : []) });
    assert.deepEqual([v.ok, v.tested], [true, B], "a real empty commit is stepped over to the commit that vouches");
  } finally { r.done(); }
});

test("PROMOTION: no parents names the checkout depth, an octopus fails closed", async () => {
  let v = await judgePromotion({ head: sha("r"), ...graph({ [sha("r")]: { parents: [], tree: T } }) });
  assert.ok(!v.ok && /SHALLOW checkout\. deploy\.yaml must check out with fetch-depth: 0/.test(v.message), "a head with no parents fails closed and names the checkout depth");
  const octo = { [sha("a")]: { parents: [], tree: T }, [sha("b")]: { parents: [], tree: T }, [sha("c")]: { parents: [], tree: T },
    [sha("o")]: { parents: [sha("a"), sha("b"), sha("c")], tree: T } };
  v = await judgePromotion({ head: sha("o"), ...graph(octo) });
  assert.ok(!v.ok && /3 parents: an octopus merge/.test(v.message), "an octopus merge fails closed");
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

test("COUNT: ran leaves what it counted; the tripwire fails when the count is missing or is not the ledger", () => {
  const root = mkdtempSync(join(tmpdir(), "deploy-gate-count-"));
  try {
    mkdirSync(join(root, "tests/artifacts"), { recursive: true });
    mkdirSync(join(root, "e2e/test-results"), { recursive: true });
    writeFileSync(join(root, MANIFEST), JSON.stringify({ tests: [row("a.spec.ts", "@curated one"), row("a.spec.ts", "@curated two")] }));
    const t = { status: "expected", results: [{ status: "passed" }] };
    writeFileSync(join(root, RESULTS), JSON.stringify({ suites: [{ title: "a.spec.ts", file: "a.spec.ts", specs: [
      { title: "@curated one", file: "a.spec.ts", tests: [t] }, { title: "@curated two", file: "a.spec.ts", tests: [t] }] }] }));
    assert.equal(ran(root, []), 0, "a report equal to the rows counts green");
    assert.ok(existsSync(join(root, COUNT)), "ran leaves what it counted beside the report, for the tripwire");
    const count = JSON.parse(readFileSync(join(root, COUNT), "utf8"));
    assert.deepEqual(count, { total: 2, passed: 2, skipped: 0, rows: 2, errors: 0 }, "ran leaves what it counted beside the report");
    assert.equal(evaluateCount(count, 2).ok, true, "a count equal to the ledger passes the tripwire");
  } finally { rmSync(root, { recursive: true, force: true }); }
  const ok = { total: 2, passed: 2, skipped: 0, rows: 2, errors: 0 };
  const missing = evaluateCount(null, 2);
  assert.equal(missing.ok, false, "a missing count (the hook never ran) fails the tripwire");
  assert.match(missing.message, /count is missing .*posttest:curated did not run\. npm skips post-hooks under ignore-scripts/, "...and is named");
  assert.equal(evaluateCount({ ...ok, passed: 1, errors: 1 }, 2).ok, false, "a short count fails");
  assert.equal(evaluateCount({ ...ok, skipped: 1, passed: 1 }, 2).ok, false, "a skip fails");
  assert.equal(evaluateCount(ok, 3).ok, false, "a ledger that differs from what was counted fails");
  assert.equal(evaluateCount({ ...ok, total: 0, passed: 0, rows: 0 }, 0).ok, false, "zero is never a count");
  assert.equal(tripwireExit({ level: "ok" }, { ok: false }), 1, "a missing or wrong count turns the tripwire red even when the time is fine");
  assert.equal(tripwireExit({ level: "warning" }, { ok: true }), 0, "over the target but under the line, with the count right, stays green");
  assert.equal(tripwireExit({ level: "error" }, { ok: true }), 1, "over the line is red whatever the count");
});

test("COUNT cannot be switched off unseen: no tracked .npmrc sets ignore-scripts, and no deploy sets npm_config_ignore_scripts", () => {
  const r = spawnSync("git", ["ls-files", "--", ".npmrc", "*.npmrc", "**/.npmrc"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const npmrcs = r.stdout.split("\n").filter(Boolean);
  console.log(`# tracked .npmrc files scanned: ${npmrcs.length}`);
  for (const f of npmrcs) assert.doesNotMatch(readFileSync(join(ROOT, f), "utf8"), /^\s*ignore-scripts\s*=\s*true/mi, `${f} sets ignore-scripts, which skips posttest:curated: the count would never run`);
  let envs = 0;
  for (const name of ["deploy-dev.yaml", "deploy.yaml"]) {
    const wf = workflow(name);
    const maps = [wf.env, ...Object.values(wf.jobs).flatMap((j) => [j.env, ...(j.steps || []).map((s) => s.env)])].filter(Boolean);
    envs += maps.length;
    for (const m of maps) for (const k of Object.keys(m)) assert.notEqual(k.toLowerCase(), "npm_config_ignore_scripts", `${name} sets ${k}, which skips posttest:curated`);
  }
  assert.ok(envs > 0, "positive coverage: the deploys' env maps were found and read");
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

// v1.263.3 (GATE6 part 5, the reviewer's finding 5 on #388): the promotion rule relies on the push-run being the WHOLE
// suite, so nothing may narrow it: no path filter on either trigger, and no condition that could skip a job beyond
// the one part 4 adds (the shards and gen wait on the tested site's upload, not on the build job's other gates).
// v1.264.2 (GATE7, the reviewer's new 7 on #392): the title said "no job or step condition" while only the suite commands
// were pinned, so an `if:` on "Download tested site" passed. Every step of `test` and `gen` is pinned now: its only
// conditions are the browser-cache choice of how to install Chromium, and the failure-artifact upload.
test("e2e-full: nothing narrows the push-run: no path filter, no job condition beyond 'the site built', no step condition beyond the browser-cache choice and the failure upload", () => {
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
  assert.equal(upload?.with?.["if-no-files-found"], "error", "nothing packaged fails the upload, so outputs.site is not success and the shards skip (GATE7)");
  const shard = wf.jobs.test.steps.filter((s) => /npm test -- --shard=\$\{\{ matrix\.shard \}\}\/4/.test(s.run || ""));
  const gen = wf.jobs.gen.steps.filter((s) => /npm run e2e:gen/.test(s.run || ""));
  assert.equal(shard.length, 1, "each shard runs its quarter of the core suite");
  assert.equal(gen.length, 1, "gen runs the generated suite");
  assert.ok(![...shard, ...gen].some((s) => "if" in s || s["continue-on-error"]), "the suite commands themselves are unconditional and blocking");
  const ALLOWED = { "steps.pw-cache.outputs.cache-hit != 'true'": "Install Chromium", "steps.pw-cache.outputs.cache-hit == 'true'": "Install Chromium OS deps (cache hit)", "failure()": "Upload failure artifacts" };
  let pinned = 0;
  for (const j of ["test", "gen"]) for (const st of wf.jobs[j].steps) {
    pinned++;
    assert.ok(!st["continue-on-error"], `${j}: "${st.name || st.uses}" is blocking`);
    if ("if" in st) assert.equal(ALLOWED[st.if], st.name, `${j}: "${st.name || st.uses}" carries the condition ${st.if}, which could skip it on a push`);
  }
  assert.ok(pinned >= 20, `positive coverage: every step of test and gen was read (${pinned})`);
  assert.deepEqual(wf.jobs.test.strategy?.matrix?.shard, [1, 2, 3, 4], "all four shards");
});
