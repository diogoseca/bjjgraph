// The owner's U151 a (12 Nov 2026): the name once, in the privacy page's "Who we are" line ("The data controller is **...**,
// reachable at ..."). This pins it: across every file under content/, the name and each word of it appear in exactly one place,
// that line, in content/privacy.md's "Who we are" section; "an individual" appears in none of the three pages that said it
// (privacy, terms and the home page); and the /dev catalog (forward/, whose signed-in sample now reads "Player") carries no word of it.
// The name is read from that line, never typed here, and every scan counts what it read, so a scan that read nothing cannot pass
// (CLAUDE.md 6.6). The short boxes' own rule (no In short prints the name) stays in tests/legal_boxes.test.mjs.
// Integration collection: root package.json test:units includes tests/*.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// paths, not URLs: content/ has file names with "%" ("100% Sweep"), which a URL reads as an escape
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");
const LINE = /^The data controller is \*\*([^*]+)\*\*, reachable at .*$/m;
const WHO = /^## Who we are[ \t]*\n([\s\S]*?)(?=^## )/m;
function walk(rel, out = []) {
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    if (e.isDirectory()) walk(rel + e.name + "/", out); else if (e.isFile()) out.push(rel + e.name);
  }
  return out;
}
function controller() {
  const m = LINE.exec(read("content/privacy.md"));
  assert.ok(m, "premise: the privacy page carries the line 'The data controller is **...**, reachable at ...'");
  const words = m[1].trim().split(/\s+/);
  assert.ok(words.length >= 2 && words.every((w) => w.length >= 2), "premise: the line names a person, first name and surname");
  return { line: m[0], words };
}
// a word, whole (no letter or digit either side), case as written; every occurrence counted
const count = (text, w) => (text.match(new RegExp("(?<![\\p{L}\\p{N}])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])", "gu")) || []).length;
function occurrences(dir, words) {
  const files = walk(dir), found = {};
  for (const f of files) {
    const text = read(f), n = Object.fromEntries(words.map((w) => [w, count(text, w)]));
    if (Object.values(n).some(Boolean)) found[f] = n;
  }
  return { scanned: files.length, found };
}

test("content/: the name is printed once, in the privacy page's data-controller line under 'Who we are'", () => {
  const { line, words } = controller();
  const { scanned, found } = occurrences("content/", words);
  assert.ok(scanned >= 6000, `scanned only ${scanned} files under content/`);
  assert.deepEqual(found, { "content/privacy.md": Object.fromEntries(words.map((w) => [w, 1])) },
    "the name, and each word of it, appears once in content/: in content/privacy.md");
  const who = WHO.exec(read("content/privacy.md"))?.[1];
  assert.ok(who != null, "premise: the privacy page has a 'Who we are' section");
  assert.ok(who.includes(line), "the data-controller line is in 'Who we are'");
  console.log(`operator_named_once: ${scanned} files under content/, the name once (content/privacy.md, Who we are)`);
});

test("'an individual' is in none of the three pages: privacy, terms, home", () => {
  const pages = ["content/privacy.md", "content/terms.md", "content/index.md"];
  const said = pages.filter((p) => /an\s+individual/i.test(read(p)));
  assert.ok(pages.every((p) => read(p).length > 2000), "premise: the three pages were read whole");
  assert.deepEqual(said, []);
});

test("forward/ (the /dev catalog) carries no word of the name", () => {
  const { words } = controller();
  const { scanned, found } = occurrences("forward/", words);
  assert.ok(scanned >= 30, `scanned only ${scanned} files under forward/`);
  assert.deepEqual(found, {});
});

test("the scans can fail: the name pasted into a page is counted, and 'an individual' is seen", () => {
  const { words } = controller();
  const text = "## Who we are\n\nA line naming " + words.join(" ") + " again, " + words[0] + ".\n";
  assert.deepEqual(words.map((w) => count(text, w)), [2, ...words.slice(1).map(() => 1)]);
  assert.equal(count(words[0] + "x " + "x" + words[0], words[0]), 0, "a word inside another word is not the name");
  assert.ok(/an\s+individual/i.test("operated by someone as an\nindividual"));
});
