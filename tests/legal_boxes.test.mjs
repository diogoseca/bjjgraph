// LEGAL3 (v1.264.0): the legal boxes have ONE source, the pages. Until v1.263 their words were typed into app.src.jsx apart from
// content/privacy.md and content/terms.md, and drifted ("export or delete ... from Settings", a contact address the pages never
// used). The box now reads the page (openLegal: the server's article, or one fetch of the page), so no sentence of either page may
// live in any app source. This scans every source file under neural/src that a bundle is built from (the build inputs: *.src.js,
// *.src.jsx, *.css, *.html) for every sentence of both pages, and counts what it scanned, so a scan that read nothing cannot pass
// (CLAUDE.md 6.6). Integration collection: root package.json test:units includes tests/*.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
// a page's prose, without its front matter, its JSON-LD block, markdown links, emphasis, table pipes and code ticks
function sentences(md) {
  const body = md.replace(/^---[\s\S]*?\n---\n/, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const prose = body.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`>|#]/g, " ").replace(/^\s*-\s+/gm, " ");
  return prose.split(/(?<=[.!?:;])\s+|\n{2,}/).map(norm).filter((s) => s.length >= 32);
}
const PAGES = ["content/privacy.md", "content/terms.md"];
const SOURCES = readdirSync(new URL("neural/src/", root)).filter((f) => /\.src\.jsx?$|\.css$|\.html$/.test(f) && !/^Neural Graph/.test(f));

test("no sentence of either legal page is copied into the app's sources", () => {
  const src = SOURCES.map((f) => [f, norm(readFileSync(new URL("neural/src/" + f, root), "utf8"))]);
  let scanned = 0;
  const found = [];
  for (const page of PAGES) for (const s of sentences(readFileSync(new URL(page, root), "utf8"))) {
    scanned++;
    for (const [f, text] of src) if (text.includes(s)) found.push(`${page}: "${s.slice(0, 60)}..." in neural/src/${f}`);
  }
  assert.ok(SOURCES.length >= 20, `scanned only ${SOURCES.length} source files`);
  assert.ok(scanned >= 60, `scanned only ${scanned} sentences of the two pages`);
  assert.deepEqual(found, []);
  console.log(`legal_boxes: ${scanned} sentences of 2 pages, ${SOURCES.length} source files, 0 copies`);
});

test("the scan can fail: a page sentence pasted into a source is found", () => {
  const s = sentences(readFileSync(new URL(PAGES[0], root), "utf8"))[3];
  assert.ok(s && norm('const x = "' + s + '";').includes(s));
});

test("arriving opens a box on exactly the two legal addresses", () => {
  const app = readFileSync(new URL("neural/src/app.src.jsx", root), "utf8");
  const m = /^const NG_LEGAL_PAGE = (\/.+\/);$/m.exec(app);
  assert.ok(m, "NG_LEGAL_PAGE is one regex literal");
  const re = new Function("return " + m[1])();
  const yes = ["/privacy", "/terms", "/privacy/", "/terms/", "/privacy.html", "/terms.html"];
  const no = ["/", "/Privacy", "/privacyx", "/terms/x", "/x/privacy", "/Tree", "/tags/bjj", "/Principles/Frames", "/Positions/Mount/Top"];
  assert.deepEqual(yes.filter((p) => !re.test(p)), []);
  assert.deepEqual(no.filter((p) => re.test(p)), []);
  assert.deepEqual(yes.map((p) => re.exec(p)[1]), ["privacy", "terms", "privacy", "terms", "privacy", "terms"]);
});

// The owner's note on U150 (12 Nov 2026): the short box never prints the operator's name or "an individual". The box's short part is
// a page's "In short", so each one is held to it. The name is the one the privacy page gives as its data controller ("The data controller
// is **...**", the owner's U151 a), read from the page, never typed here. Both pages carry an "In short".
const controllerName = () => /The data controller is \*\*([^*]+)\*\*/.exec(readFileSync(new URL("content/privacy.md", root), "utf8"))?.[1];
test('each "In short" section names no data controller and says no "an individual"', () => {
  const name = controllerName();
  assert.ok(name && name.trim().split(/\s+/).length >= 2, "premise: the privacy page names its data controller");
  let sections = 0;
  for (const page of PAGES) {
    const md = readFileSync(new URL(page, root), "utf8");
    const section = /^## In short[ \t]*\n([\s\S]*?)(?=^## )/m.exec(md)?.[1];
    if (section == null) continue;
    sections++;
    assert.ok(!name.split(/\s+/).some((w) => new RegExp("\\b" + w + "\\b").test(section)), page + ': its "In short" names the data controller');
    assert.ok(!/an individual/i.test(section), page + ': its "In short" says "an individual"');
  }
  assert.equal(sections, 2, 'both pages carry an "In short" section');
});
