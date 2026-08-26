// Pure-unit suite for the analytics deploy gate itself:
//   node --test tests/analytics_surface_gate.test.mjs
//
// WHAT THIS IS FOR. `scripts/check_analytics_surface.py` reads BUILT bytes, so it can only run in
// the two deploy workflows — `ci-validate.yml` installs no node dependencies and never builds, so
// there is no postscript.js there for it to read. That leaves the gate's own logic ungated on every
// PR, which is the shape this repo has been bitten by repeatedly: the gate that nothing checks
// quietly stops discriminating and keeps printing OK.
//
// These tests drive the REAL script over synthetic output directories — never a re-implementation
// of its rules — and they pull in opposite directions on purpose. The three claims that matter:
//
//   1. a keyless build must be CLEAN (the v1.136.1 bug: `posthog.init("")` + the stub loader),
//   2. a keyed build must CARRY the injection with THIS environment's token (zero occurrences is
//      analytics silently ceasing to be collected — CLAUDE.md §6.7's telemetry-loss class), and
//   3. the app's own guarded READS of `window.posthog` must never trip either direction.
//
// Claim 3 is the one a careless "just grep for posthog" fix breaks, and breaking it makes the gate
// permanently red on a correct build — so it is pinned twice below, once as a pass and once as the
// count the gate prints about what it declined to flag.
//
// SCOPE, stated so nobody reads more coverage into this file than it has: these fixtures are
// SYNTHETIC. They prove the gate's discrimination, not that the emitter still emits what they
// imitate — the fixture-drift test at the end is what ties them back to
// componentResources.ts, and the end-to-end proof (four mutants of the emitter, each rebuilt with
// `npx quartz build` over a one-page corpus and each turning the gate red) is recorded in the
// commit that added this file, `git log --diff-filter=A -- tests/analytics_surface_gate.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = resolve(ROOT, "scripts/check_analytics_surface.py");
const EMITTER = resolve(ROOT, "source/quartz/plugins/emitters/componentResources.ts");

// ── the two halves of the posthog injection, VERBATIM from the emitter's template literal ──
// The last test asserts both are still substrings of componentResources.ts, so a vendor-snippet
// change cannot leave these fixtures quietly testing bytes the build no longer produces.
const STUB_ASSIGNMENT = "(window.posthog=e,e._i=[],e.init=function(";
const STUB_LOADER = '.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js"';
const stubFor = () => `!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||${STUB_ASSIGNMENT}i,s,a){}(p=t.createElement("script")).src=s.api_host${STUB_LOADER};`;
const initFor = (token) =>
  `posthog.init(${JSON.stringify(token)},{api_host:"https://us.i.posthog.com",person_profiles:'always'})`;

// The app's own consumers, in the shape they COMPILE to. Both read the global and neither creates
// it: variant.inline.ts -> prescript.js, and app.src.jsx's track() -> static/neural/app/neural.js.
const CONSUMER_PRESCRIPT = `let n=window.posthog;n?.capture&&n.capture("neural_variant_exposure",{variant:"neural"})`;
const CONSUMER_NEURAL = `const ph=window.posthog;if(ph&&ph.capture)ph.capture(e,{variant:"neural"})`;

/** Build a throwaway "build output" and run the REAL gate over it. `key` of null = env var unset. */
function runGate(files, key) {
  const dir = mkdtempSync(join(tmpdir(), "analytics-surface-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = join(dir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    // Delete rather than blank the variable: a developer with the real key exported would otherwise
    // flip every "no key" case here into a "key set" case and the suite would grade the wrong branch.
    const env = { ...process.env };
    delete env.POSTHOG_API_KEY;
    if (key !== null) env.POSTHOG_API_KEY = key;
    const r = spawnSync("python3", [GATE, "--out", dir], { cwd: ROOT, encoding: "utf8", env });
    return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A keyless build as the emitter leaves it: consumers present, nothing created. */
const cleanBuild = () => ({
  "postscript.js": "(function(){document.dispatchEvent(new CustomEvent('nav'))})();",
  "prescript.js": `(function(){${CONSUMER_PRESCRIPT}})();`,
  "static/neural/app/neural.js": `(function(){${CONSUMER_NEURAL}})();`,
});

/** A keyed build: the same, plus the full injection in postscript.js. */
const keyedBuild = (token) => ({
  ...cleanBuild(),
  "postscript.js": `(function(){var s=document.createElement("script");s.innerHTML=\`${stubFor()}\n${initFor(token)}\`;document.head.appendChild(s)})();`,
});

test("a keyless build with only guarded consumer reads passes, and SAYS what it looked at", () => {
  const r = runGate(cleanBuild(), null);
  assert.equal(r.code, 0, `a clean keyless build must pass; gate said:\n${r.out}`);
  assert.match(r.out, /branch: NO KEY/, "the branch it took must print every run");
  assert.match(r.out, /scanned 3 emitted \.js file\(s\)/, "positive coverage count, never silence");
  assert.match(r.out, /init=0 window\.posthog-assignment=0 assets-host=0/);
  // The discrimination, stated as a number: it saw real analytics code and declined to flag it.
  assert.match(r.out, /guarded-reads=2/, "both consumer reads must be COUNTED, not just ignored");
});

test("...and the identical bytes FAIL once the environment does have a key", () => {
  // Same directory, opposite environment. This is the half a one-directional gate omits: zero
  // occurrences in a keyed build is analytics silently not being collected in production.
  const r = runGate(cleanBuild(), "phc_fixture_token");
  assert.equal(r.code, 1, `a keyed build with no init must fail; gate said:\n${r.out}`);
  assert.match(r.out, /ZERO posthog\.init/);
  assert.match(r.out, /branch: KEY SET/);
});

test("a keyed build carrying THIS environment's token passes", () => {
  const r = runGate(keyedBuild("phc_fixture_token"), "phc_fixture_token");
  assert.equal(r.code, 0, `a correct keyed build must pass; gate said:\n${r.out}`);
  assert.match(r.out, /exactly 1 posthog\.init\(\) carrying this environment's POSTHOG_API_KEY/);
});

test("...but a build carrying a DIFFERENT project's token fails", () => {
  // Non-empty is not the claim. A stale or foreign token reports real user traffic into the wrong
  // PostHog project and looks completely healthy doing it, so the gate compares the real value.
  const r = runGate(keyedBuild("phc_someone_elses"), "phc_fixture_token");
  assert.equal(r.code, 1, `a mismatched token must fail; gate said:\n${r.out}`);
  assert.match(r.out, /DIFFERENT key/);
  assert.doesNotMatch(r.out, /phc_someone_elses/, "a token must never be echoed whole into a log");
});

test("the v1.136.1 bug — a full injection in a keyless build — fails", () => {
  const r = runGate(keyedBuild(""), null);
  assert.equal(r.code, 1, `posthog.init("") must fail; gate said:\n${r.out}`);
  assert.match(r.out, /1 posthog\.init\(\) call\(s\) in postscript\.js/);
  assert.match(r.out, /cfg\.analytics\.apiKey/, "the failure must name the guard to restore");
});

test("...and so does the tempting HALF-fix: the stub alone, with no init", () => {
  // Guarding only the `init` line still ships the snippet, and the snippet is the problem: it
  // installs a window.posthog whose capture is a queue-pushing shim, so every consumer guard above
  // passes and queues events forever against an instance that never initialised. init=0 here, so
  // the stub markers are the ONLY thing that can catch this.
  const files = cleanBuild();
  files["postscript.js"] = `(function(){var s=document.createElement("script");s.innerHTML=\`${stubFor()}\`})();`;
  const r = runGate(files, null);
  assert.equal(r.code, 1, `a stub-only build must fail; gate said:\n${r.out}`);
  assert.match(r.out, /init=0 window\.posthog-assignment=1 assets-host=1/, "init clean, stub dirty");
  assert.match(r.out, /queue-pushing shim/);
});

test("an empty output directory is a HARD FAILURE, not a clean pass", () => {
  // Every assertion in the gate is an occurrence count, and an empty file set satisfies the whole
  // keyless branch perfectly. "Found no problems" and "never looked" must not print the same thing.
  const r = runGate({}, null);
  assert.equal(r.code, 1, `an empty scan must fail; gate said:\n${r.out}`);
  assert.match(r.out, /scanned 0 \.js files/);
});

test("...as is a directory with JS but no postscript.js, the injection's only sink", () => {
  const r = runGate({ "prescript.js": `(function(){${CONSUMER_PRESCRIPT}})();` }, null);
  assert.equal(r.code, 1, `a build with no postscript.js must fail; gate said:\n${r.out}`);
  assert.match(r.out, /none of them is postscript\.js/);
});

test("a build whose consumers have all vanished fails, keyless", () => {
  // Deleting the last reader of window.posthog is a capability lost, not moved: every dashboard fed
  // by neural_variant_exposure and track() goes flat from that deploy, with nothing erroring.
  const files = cleanBuild();
  delete files["prescript.js"];
  delete files["static/neural/app/neural.js"];
  const r = runGate(files, null);
  assert.equal(r.code, 1, `no consumer must fail; gate said:\n${r.out}`);
  assert.match(r.out, /no emitted \.js file READS window\.posthog/);
});

test("...and the injection's OWN internal reads do not stand in for a consumer", () => {
  // The snippet reads window.posthog three times before assigning it. Counting reads globally
  // would let a keyed build satisfy the consumer requirement with the vendor's own code while
  // every product event in the app had been deleted — so the count is taken only in files that
  // create nothing.
  const r = runGate(
    { "postscript.js": keyedBuild("phc_fixture_token")["postscript.js"] },
    "phc_fixture_token",
  );
  assert.equal(r.code, 1, `the snippet's own reads must not count; gate said:\n${r.out}`);
  assert.match(r.out, /no emitted \.js file READS window\.posthog/);
  assert.match(r.out, /in files that create nothing/);
});

test("the fixtures above are still verbatim substrings of the real emitter", () => {
  // Without this, a vendor-snippet change in componentResources.ts would leave every test in this
  // file green while testing bytes the build no longer produces — a suite measuring its own
  // fixtures. Both halves are pinned: the global assignment and the CDN loader host.
  const src = readFileSync(EMITTER, "utf8");
  assert.ok(
    src.includes(STUB_ASSIGNMENT),
    `the emitter no longer contains ${STUB_ASSIGNMENT}; update STUB_ASSIGNMENT here AND check that ` +
      "scripts/check_analytics_surface.py's CREATE_PATTERNS still match the new snippet",
  );
  assert.ok(
    src.includes(STUB_LOADER),
    `the emitter no longer contains ${STUB_LOADER}; update STUB_LOADER here AND check that ` +
      "scripts/check_analytics_surface.py's CREATE_PATTERNS still match the new snippet",
  );
  assert.ok(
    src.includes("posthog.init(${JSON.stringify(cfg.analytics.apiKey)}"),
    "the emitter no longer writes the key through JSON.stringify into posthog.init(, so the gate " +
      "can no longer read the token out of the built bytes — update both files together",
  );
});
