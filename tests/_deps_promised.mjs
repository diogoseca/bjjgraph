// ── PROMISED DEPENDENCIES: fail in CI, skip loudly at home, count what ran ──────────────────
//
// THE CLASS THIS CLOSES (CLAUDE.md §6.6, "a check that never ran reports clean"). Unit suites
// that exercise the real Quartz transformer resolve `tsx`, `esbuild` and the libgit2 binding
// from `source/package.json`, i.e. from `source/node_modules`. Until v1.195.9 nothing in
// `ci-validate.yml` installed them: two files died at module top level with a bare
// `Cannot find module 'tsx/esm/api'` (run 35577916246 on dev, 301/303), and a third caught the
// same absence and printed `SKIP … run npm install first` — green, with its one real assertion
// never made. Three merges cited "units 314/314" from local runs where the install existed.
//
// THE RULE, shared with the Quartz replacement programme's contract tests so that one marker
// means one design everywhere:
//   · The guard reads `process.env.CI` and NOTHING else — no GITHUB_ACTIONS, no custom flag.
//     GitHub Actions sets CI=true on every step; `ci-validate.yml` also pins it on the unit
//     step so the promise is visible at the call site.
//   · CI set and a promised module absent → the caller FAILS with ONE line naming the module,
//     where it was expected, and the install step that should have provided it. Called at
//     module top level that is the whole file; called inside a test body it is that test.
//   · CI unset (a checkout nobody ran the install in) → `ok` is false, one loud `SKIP` line
//     prints, and every case registered through `deps.test` is SKIPPED with the same reason.
//     A skip is a local convenience, never a CI outcome.
//   · A file that registers its cases through `deps.test` prints a POSITIVE count at the end —
//     tests that ran, assertions made, cases skipped — and, when the dependencies were
//     present, fails if either count is zero. "0 asserted" can therefore never read as green.
//
// USE. One call per file, at module top level, before anything touches the promised modules:
//
//   import { depsPromised, SOURCE_DEPS } from "./_deps_promised.mjs";
//   const deps = depsPromised(import.meta.url, { ...SOURCE_DEPS, modules: ["tsx/esm/api"] });
//   const { test, assert, require } = deps;
//   const { tsImport } = await deps.setup(() => require("tsx/esm/api"));
//   test("…", async (t) => { assert.equal(…) });          // skipped locally when absent
//   test.always("a source-text pin", () => { … });         // runs either way, still counted
//
// DELEGATION. A shared harness helper adopts the rule in one line — the call is memoised per
// caller URL, so a `harnessAvailable()` consulted by every spec of a suite throws or skips
// exactly once and never registers a second count hook:
//
//   export const harnessAvailable = () =>
//     depsPromised(import.meta.url, { ...SOURCE_DEPS, modules: ["tsx/esm/api"] }).ok;
//
//   deps.ok        true when every listed module resolves from the manifest's node_modules.
//   deps.missing   the module names that did not resolve (empty when ok).
//   deps.reason    null when ok; otherwise the one-line skip reason (also the SKIP line).
//   deps.require   createRequire bound to the manifest — the real thing, it throws normally.
//   deps.setup(fn) runs fn (sync or async) only when deps.ok; otherwise resolves to `{}` so a
//                  destructuring `const { x } = await deps.setup(…)` yields undefined for
//                  every name. Reachable only by a case the guard did not skip, i.e. one
//                  registered through bare node:test instead of deps.test.
//   deps.test      node:test's `test(name, [opts], fn)`, promise or sync bodies; counts a case
//                  as asserted when its body returns without throwing. The first registration
//                  arms the end-of-file count line and its zero check.
//   deps.assert    node:assert/strict behind a counting proxy (assert(), assert.equal, …).
//
// NON-KILLS, recorded so nobody reads this as broader than it is: the guard asks whether a
// module RESOLVES, not whether it loads — a native binding whose platform package is missing
// passes the guard and fails inside the test that requires it, which is red either way. And a
// file that uses bare node:test gets the fail/skip rule but not the count line; the three
// transformer suites in this directory all use the wrapper.
import { test as nodeTest, after } from "node:test";
import nodeAssert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The Quartz sub-package: what `ci-validate.yml` installs before "Pure unit suites". */
export const SOURCE_DEPS = Object.freeze({
  manifest: "source/package.json",
  installedBy:
    "ci-validate.yml step 'Install source/ dependencies (promised to the unit suites)' = cd source && npm ci",
});

const quote = (s) => `'${s}'`;
const guards = new Map(); // importMetaUrl -> the frozen guard object (memoised per caller)

export function depsPromised(importMetaUrl, { manifest, modules, installedBy } = {}) {
  if (guards.has(importMetaUrl)) return guards.get(importMetaUrl);
  const file = path
    .relative(ROOT, fileURLToPath(importMetaUrl))
    .split(path.sep)
    .join("/");
  if (typeof manifest !== "string" || !manifest) {
    throw new TypeError(`${file}: depsPromised needs { manifest } — the package.json whose node_modules is promised`);
  }
  if (!Array.isArray(modules) || modules.length === 0 || modules.some((m) => typeof m !== "string" || !m)) {
    throw new TypeError(`${file}: depsPromised needs { modules: [name, …] } — at least one module this file requires`);
  }
  if (typeof installedBy !== "string" || !installedBy) {
    throw new TypeError(`${file}: depsPromised needs { installedBy } — the install step a CI failure should point at`);
  }
  const manifestPath = path.resolve(ROOT, manifest);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`${file}: depsPromised manifest ${quote(manifest)} does not exist — that is a misconfiguration, not a missing install`);
  }
  const where = path.posix.join(path.dirname(manifest).split(path.sep).join("/"), "node_modules");
  const require = createRequire(manifestPath);

  const missing = [];
  for (const m of modules) {
    try {
      require.resolve(m);
    } catch (err) {
      if (err && err.code === "MODULE_NOT_FOUND") missing.push(m);
      else throw err;
    }
  }
  const ok = missing.length === 0;
  const inCI = Boolean(process.env.CI);
  const absent = ok ? null : `${missing.map(quote).join(", ")} absent under ${where}`;

  if (!ok && inCI) {
    // ONE line: what is missing, where it was promised, who should have installed it.
    throw new Error(
      `${file}: promised dependency ${absent} — CI is set, so this is a FAILURE, not a skip; the install step that should have provided it: ${installedBy}`,
    );
  }
  const reason = ok ? null : `${absent} — run: ${installedBy}`;
  if (!ok) {
    console.log(`SKIP ${file}: ${reason} (CI is unset, so this file skips; under CI it fails)`);
  }

  const counts = { registered: 0, ran: 0, skipped: 0, assertions: 0 };
  let armed = false;
  const arm = () => {
    if (armed) return;
    armed = true;
    after(() => {
      const tail = ok ? "" : ` — SKIPPED: ${reason}`;
      console.log(
        `asserted ${file}: ${counts.ran} of ${counts.registered} tests, ${counts.assertions} assertions, ${counts.skipped} skipped${tail}`,
      );
      if (ok && (counts.ran === 0 || counts.assertions === 0)) {
        throw new Error(
          `${file}: ${counts.ran} tests asserted with ${counts.assertions} assertions while every promised dependency was present — an empty run must not read as green`,
        );
      }
    });
  };

  function wrap(always) {
    return function guardedTest(name, optsOrFn, maybeFn) {
      const fn = typeof optsOrFn === "function" ? optsOrFn : maybeFn;
      const opts = typeof optsOrFn === "function" ? {} : { ...(optsOrFn || {}) };
      if (typeof fn !== "function") {
        throw new TypeError(`${file}: deps.test(${JSON.stringify(name)}) needs a function body`);
      }
      arm();
      counts.registered += 1;
      if (!ok && !always) {
        counts.skipped += 1;
        return nodeTest(name, { ...opts, skip: reason }, fn);
      }
      return nodeTest(name, opts, async (t) => {
        const out = await fn(t);
        counts.ran += 1;
        return out;
      });
    };
  }
  const test = wrap(false);
  test.always = wrap(true);

  const counted = new Map();
  const assert = new Proxy(nodeAssert, {
    apply(target, thisArg, args) {
      counts.assertions += 1;
      return Reflect.apply(target, thisArg, args);
    },
    get(target, prop, receiver) {
      if (prop === "strict") return receiver;
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string" || !/^[a-z]/.test(prop)) return value;
      if (!counted.has(prop)) {
        counted.set(prop, function countedAssertion(...args) {
          counts.assertions += 1;
          return value.apply(target, args);
        });
      }
      return counted.get(prop);
    },
  });

  const setup = async (fn) => (ok ? await fn() : {});

  const guard = Object.freeze({ ok, missing, reason, where, file, require, setup, test, assert, counts });
  guards.set(importMetaUrl, guard);
  return guard;
}
