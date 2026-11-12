// LEGAL1 (v1.263.0): the site's legal pages are one set answered in two bundles. The eager app decides the ARRIVAL
// (`NG_SITE_PAGE` in app.src.jsx: read, never played) before the deferred reader exists; the reader decides the POSTURE
// (`SITE` and `REFERENCE` in reader.src.js: a page, every section shown, no ✕). They cannot share a scope, so this pins
// them equal over the addresses a visitor can type, after the reader's own cleanPath (CLAUDE.md §6.5: one question in
// two places). It also pins that the two boxes the account menu used to open are gone with every string of them.
// Integration collection: root package.json test:units includes tests/*.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const reader = readFileSync(new URL("../neural/src/reader.src.js", import.meta.url), "utf8");
const settings = readFileSync(new URL("../neural/src/settings-ui.src.js", import.meta.url), "utf8");
const literal = (source, name) => {
  const m = new RegExp("^const " + name + " = (/.+/[a-z]*);$", "m").exec(source);
  assert.ok(m, name + " is declared as one regex literal");
  return new Function("return " + m[1])();
};
const NG_SITE_PAGE = literal(app, "NG_SITE_PAGE"), SITE = literal(reader, "SITE"), REFERENCE = literal(reader, "REFERENCE");
// the reader's cleanPath, minus decodeURI and the URL parse, which these plain paths do not need
const cleanPath = (p) => p.replace(/\.html$/, "").replace(/\/$/, "") || "/";

const PATHS = ["/privacy", "/terms", "/privacy/", "/terms/", "/privacy.html", "/terms.html", "/Privacy", "/TERMS",
  "/privacy-policy", "/privacyx", "/terms/x", "/x/privacy", "/", "/Tree", "/tags/bjj", "/Game-Over", "/404",
  "/Principles/Frames", "/Learning/BJJ-For-Beginners-Roadmap", "/Systems", "/Positions/Mount/Top"];

test("the app's arrival set and the reader's page set are one set", () => {
  let positives = 0;
  for (const p of PATHS) {
    const arrives = NG_SITE_PAGE.test(p), reads = SITE.test(cleanPath(p));
    assert.equal(reads, arrives, p);
    if (arrives) positives++;
  }
  // a positive count, so a pair of regexes that matched nothing cannot pass as "equal" (CLAUDE.md §6.6)
  assert.equal(positives, 6, "/privacy and /terms, each bare, with a slash and with .html");
});

test("a legal page is a reference page to the reader, and the Principles, Learning and Systems pages still are", () => {
  for (const p of ["/privacy", "/terms", "/Principles/Frames", "/Learning/X", "/Systems/X"]) assert.ok(REFERENCE.test(p), p);
  for (const p of ["/Positions/Mount/Top", "/Transitions/X", "/Tree", "/", "/privacyx"]) assert.ok(!REFERENCE.test(p), p);
});

test("the two boxes are gone with every string of them", () => {
  for (const [name, source] of [["app.src.jsx", app], ["settings-ui.src.js", settings]]) {
    // the method by any call or definition (the comments that name it, at the code that replaced it, are stripped by the build)
    assert.ok(!/openLegal\s*\(/.test(source), name + " still calls or defines openLegal");
    for (const s of ["Terms of Use", "privacy@bjjgraph.org", "legal@bjjgraph.org", "Last updated July 2026",
      "export or delete your account", "Assumption of risk"]) assert.ok(!source.includes(s), name + " still carries " + JSON.stringify(s));
  }
  // and both doors to the pages build the one link (a new tab, the page's own address)
  assert.match(app, /legal\("data-menu-terms", "Terms"\), legal\("data-menu-privacy", "Privacy"\)/);
  assert.match(settings, /const a = this\._sitePageLink\(label\);/);
  assert.match(app, /a\.href = "\/" \+ label\.toLowerCase\(\); a\.target = "_blank"; a\.rel = "noopener";/);
});
