// No neural bundle may contain a regex lookbehind. Safari below 16.4 cannot parse one, and a literal is a SyntaxError at parse time,
// so one sentence split would take a whole module down on every article, not just the feature that used it (the first one, in
// reader.src.js at v1.251.0, was caught by review before it shipped). A `new RegExp()` string fails at run time, but it is the
// same bug, so the scan does not care which. The Safari floor is from memory, not run here: the rule is cheap either way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname, LOOKBEHIND = /\(\?<[=!]/;
const scan = (dir, pattern) => existsSync(dir) ? readdirSync(dir).filter(f => pattern.test(f)).map(f => join(dir, f)) : [];
const dirty = files => files.filter(f => LOOKBEHIND.test(readFileSync(f, "utf8"))).map(f => f.slice(root.length));

test("no neural source holds a lookbehind", () => {
  const sources = scan(join(root, "neural/src"), /\.src\.jsx?$/);
  assert.ok(sources.length >= 8, `scanned only ${sources.length} sources`);
  assert.deepEqual(dirty(sources), []);
  console.log(`neural_bundle_regex: ${sources.length} sources`);
});

// ci-validate never builds the bundles, so the bundles' own scan lives in neural/build/build.mjs, which throws. This pins that it
// stays, and adds a scan of whatever a local build left behind. (This file first asserted bundles exist in CI: that went red on PR 341.)
test("the build refuses a lookbehind in a bundle", () => {
  const build = readFileSync(join(root, "neural/build/build.mjs"), "utf8");
  assert.match(build, /a regex lookbehind reached a bundle/, "the guard in build.mjs is gone");
  const bundles = scan(join(root, "neural/dist"), /\.js$/);
  assert.deepEqual(dirty(bundles), []);
  console.log(`neural_bundle_regex: the build guard is in place, ${bundles.length} local bundles scanned`);
});

test("the pattern sees both forms, in a literal and in a string", () => {
  for (const specimen of ["/(?" + "<=[.!?])x/", "/(?" + "<![a-z])x/", 'new RegExp("(?' + '<=a)b")']) assert.ok(LOOKBEHIND.test(specimen), specimen);
  assert.equal(LOOKBEHIND.test("/(?=x)(?!y)(?<name>z)/"), false, "a lookahead or a named group is not one");
});
