// `mangleProps` on reader.js renames READER_ONLY_PROPS, and a listed name read from outside the reader comes back undefined
// rather than throwing, so a typo'd journey or a new caller fails as a wrong value, far from here. It stays only because the
// deferred cap has no room for it: 620 B of savings against 32 B free at v1.251.0 (neural/build/build.mjs names the list).
// This is the guard the comment there used to ask a person to run by hand.
//
// The pattern reads a listed name off the reader, by its three spellings in this repo: `_reader.x`, `reader.x`, and `r.x`, which
// is the app's and the specs' local for the reader. `.held` alone cannot be the test: 40-odd unrelated objects carry one.
// BLIND SPOT: another local name for the reader, or a bracket read. Pinned for those three spellings only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const build = readFileSync(join(root, "neural/build/build.mjs"), "utf8");
const names = build.match(/READER_ONLY_PROPS = \/\^\(\?:([^)]+)\)\$\//)?.[1].split("|") ?? [];
const reads = new RegExp(String.raw`(?:_reader|\breader|\br)\??\.(${names.join("|")})\b`, "g");
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const sources = [
  ...walk(join(root, "neural/src")).filter(f => /\.src\.jsx?$/.test(f) && !f.endsWith("reader.src.js")),
  ...walk(join(root, "e2e")).filter(f => f.endsWith(".ts") && !f.includes("node_modules")),
  ...readdirSync(join(root, "tests")).filter(f => f.endsWith(".mjs") && f !== "reader_mangle.test.mjs").map(f => join(root, "tests", f)),
];

test("the list parses, and every listed name still lives in the reader", () => {
  assert.ok(names.length >= 20, `READER_ONLY_PROPS parsed to ${names.length} names`);
  const reader = readFileSync(join(root, "neural/src/reader.src.js"), "utf8");
  assert.deepEqual(names.filter(n => !new RegExp(String.raw`\.${n}\b`).test(reader)), [], "a stale name mangles nothing and hides a typo");
});

test("no source outside the reader reads a mangled name off the reader", () => {
  assert.ok(sources.length >= 300, `scanned only ${sources.length} files`);
  const found = sources.flatMap(file => [...readFileSync(file, "utf8").matchAll(reads)].map(m => relative(root, file) + ": " + m[0]));
  assert.deepEqual(found, []);
  console.log(`reader_mangle: ${names.length} names over ${sources.length} files, 0 reads from outside`);
});

test("the pattern catches each spelling, so the green above can fail", () => {
  for (const line of ["a._reader.heldAt", "const y = reader.bookScroll", "r.syncIndex()", "__neural._reader?.held"]) {
    assert.ok(line.match(reads), line);
  }
  assert.equal("belt.held + hand.heldAt".match(reads), null, "an unrelated object's .held is not a read");
});
