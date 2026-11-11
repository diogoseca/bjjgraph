// `mangleProps` on reader.js renames READER_ONLY_PROPS, and a listed name read from outside the reader comes back undefined
// rather than throwing, so a typo'd journey or a new caller fails as a wrong value, far from here. It stays only because the
// deferred cap has no room for it: 620 B of savings against 6 B free at v1.251.0 (neural/build/build.mjs names the list).
//
// Two tests, because the names are of two kinds. All but `held` are unique to the reader, so any use anywhere else is a read,
// whatever object it comes through: `.name`, a quoted "name", or `name:` as a key or in a destructuring, which is how `closedRow`
// was pinned although it lived on section objects, not on the reader (it left with the fold, HIDESEC2). `held` is common (40-odd unrelated objects carry one), so it
// is read by its receiver: `_reader`, `reader`, `__seatReader` or `r`, with `?.`, `!.` and `(r as any).` all seen.
// v1.251.3 (#348's review) widened it: a destructuring default (`{ placeTop = 0 }`), every script under e2e/ (not only .ts), scripts/,
// forward/ and source/quartz, and the reader itself, where a listed name used as a dataset key or a data-* attribute would be renamed
// with the property and break the attribute silently.
// BLIND SPOT: `held` through any other local name; any name built from strings at runtime; tests/artifacts/*.mjs, whose mutant tables
// spell names to edit the source before the build, which is not a read; and Python, which reads nothing of the reader. Pinned for the rest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const build = readFileSync(join(root, "neural/build/build.mjs"), "utf8");
const names = build.match(/READER_ONLY_PROPS = \/\^\(\?:([^)]+)\)\$\//)?.[1].split("|") ?? [];
const COMMON = new Set(["held"]);
const unique = names.filter(n => !COMMON.has(n)), common = names.filter(n => COMMON.has(n));
const bare = new RegExp(String.raw`\.(?:${unique.join("|")})\b|['"\`](?:${unique.join("|")})['"\`]|\b(?:${unique.join("|")})\s*(?:[:,}]|=(?!=))`, "g");
const receiver = new RegExp(String.raw`(?:_reader|\breader|__seatReader|\br)(?:\s+as\s+any\))?[!?]?\.(?:${common.join("|")})\b`, "g");
const reads = line => [...(line.match(bare) ?? []), ...(line.match(receiver) ?? [])];
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
// This file and the mutant runner quote the names to test them; the build's own list is the definition.
// v1.252.0: two unit tests build a reader from reader.src.js itself, the unmangled source, so a listed name they set or read is the
// source's own name and the build never touches it. They are named, not detected, so a new test is scanned by default; each must
// still read the source and never the bundle, or it is scanned again.
const SOURCE_READERS = ["tests/analytics_exploration.test.mjs", "tests/reader_handoff.test.mjs"];
const sourceOnly = f => /neural\/src\/reader\.src\.js/.test(f) && !/reader\.js["'`]|dist\/reader|app\/reader/.test(f.replace(/reader\.src\.js/g, ""));
const sources = [
  ...walk(join(root, "neural/src")).filter(f => /\.src\.jsx?$/.test(f) && !f.endsWith("reader.src.js")),
  ...walk(join(root, "e2e")).filter(f => /\.(ts|mjs|js)$/.test(f) && !f.includes("node_modules")),
  ...walk(join(root, "scripts")).filter(f => /\.(mjs|js|ts)$/.test(f)),
  ...walk(join(root, "forward")).filter(f => /\.(mjs|js|html)$/.test(f) && !f.includes("node_modules")),
  ...walk(join(root, "source/quartz")).filter(f => /\.(ts|tsx|js|mjs)$/.test(f) && !f.includes("/static/")),
  ...readdirSync(join(root, "tests")).filter(f => f.endsWith(".mjs") && f !== "reader_mangle.test.mjs" && !SOURCE_READERS.includes("tests/" + f)).map(f => join(root, "tests", f)),
];

test("the two exempt unit tests still build their reader from its source, and only from it", () => {
  for (const f of SOURCE_READERS) assert.ok(sourceOnly(readFileSync(join(root, f), "utf8")), f + " no longer reads only reader.src.js, so scan it");
  assert.equal(sourceOnly('readFileSync("../source/quartz/static/neural/app/reader.js")'), false, "the check can fail");
});

test("the list parses, and every listed name still lives in the reader", () => {
  assert.ok(names.length >= 20, `READER_ONLY_PROPS parsed to ${names.length} names`);
  assert.deepEqual(common, ["held"], "held is the one common name, and it is still listed");
  const reader = readFileSync(join(root, "neural/src/reader.src.js"), "utf8");
  assert.deepEqual(names.filter(n => !new RegExp(String.raw`\.${n}\b`).test(reader)), [], "a stale name mangles nothing and hides a typo");
});

test("no source outside the reader reads a mangled name", () => {
  assert.ok(sources.length >= 300, `scanned only ${sources.length} files`);
  const found = sources.flatMap(file => reads(readFileSync(file, "utf8")).map(hit => relative(root, file) + ": " + hit));
  assert.deepEqual(found, []);
  console.log(`reader_mangle: ${unique.length} names anywhere and ${common.length} by receiver, over ${sources.length} files, 0 reads from outside`);
});

test("the reader uses no listed name as a dataset key or a data-* attribute", () => {
  const reader = readFileSync(join(root, "neural/src/reader.src.js"), "utf8");
  const kebab = n => n.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
  const used = (n, text) => [...text.matchAll(new RegExp(String.raw`dataset\??\.${n}\b|["'\[]data-${kebab(n)}\b`, "g"))].map(m => n + ": " + m[0]);
  assert.deepEqual(names.flatMap(n => used(n, reader)), []);
  assert.equal(used("placeTop", 'el.dataset.placeTop = 1; q("[data-place-top]")').length, 2, "the check can fail");
  assert.ok(reads("const { placeTop = 0 } = a._reader").length, "a destructuring default is a read");
});

test("the patterns catch each spelling, so the green above can fail", () => {
  // v1.253.0: bookScroll left the list with the article-away view (U114 a); placeTop stands in for it as a listed name.
  // HIDESEC2: closedRow left the list with the Hidden sections fold; leadCells stands in for a listed name reached through another object.
  for (const line of ["r.gameSections.find(f).leadCells", "a._reader!.syncIndex()", "(r as any).placeTop", "w.__seatReader.gamePage", "const {placeTop} = a._reader",
    "const { placeTop, x } = r", "el['mediaNext']", "a._reader.heldAt", "a._reader!.held", "(r as any).held", "reader?.held", "w.__seatReader.held", "r.held"]) {
    assert.ok(reads(line).length, line);
  }
  assert.deepEqual(reads("belt.held + hand.weight + a.heldBy"), [], "an unrelated object's .held is not a read");
});
