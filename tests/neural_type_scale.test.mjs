// THE STATE'S NAME OUTRANKS THE ANNOUNCER — the ordering gate for the app's on-screen type
// hierarchy (v1.138.0).
//
// Owner, watching a roll: "the announcement ... is larger than the current label of the current
// node, and it shouldn't be the case. The current node is the fucking URL of the page ... it
// should be absolutely the biggest text that's shown on this page, not the announcement."
//
// It was: the announcer shipped at 22px straight from the original design import and the focused
// pair label at 18px, so a transient status line outranked the state it was describing by 1.22x.
// That label is the ONLY place the current node is named during a roll — `renderLandCard`
// deliberately carries no header (v1.101.1) *because* "the graph names the focused node beside
// it" — so the inversion left the page's subject as the second-largest thing on its own screen.
//
// WHY A UNIT AND NOT ONLY A JOURNEY. Before this file, setting the announcer to 40px and the
// label to 6px turned ZERO specs red across every journey, gen spec, probe and unit in the repo:
// nothing anywhere asserted either size, or the relation between them. This runs in
// `npm run test:units` (ci-validate.yml, every PR) with no browser, so the ordering can never
// silently invert again. e2e/journeys/announcer-coherence.spec.ts covers what this cannot —
// the RENDERED sizes, through a real cascade and the render's own published output.
//
// THREE COUPLINGS, one question each:
//   1. the announcer must read BELOW the name, at every breakpoint;
//   2. the draw, `richLabel` and `_labelWidthPx` must all read `nameFontPx()` — that trio was
//      hand-copied literals, and `dual-pair.spec.ts` measures `_labelWidthPx`, NOT the render, so
//      a drift there mis-frames the phone with every existing test still green (CLAUDE.md 6.5);
//   3. the template's inline size is a first-frame guess and must stay a plain literal, because
//      `_applyTypeScale` overwrites it — if it ever grows a `{{ }}` or a breakpoint, this file's
//      reading of it is wrong and it should fail loudly rather than pass on a stale parse.
//
// `new Component({})`, NOT `Object.create(Component.prototype)`: these are class FIELDS, which
// live on the instance, so the prototype route reads `undefined` and every comparison below would
// compare undefined against undefined — a check that never ran, reporting clean (CLAUDE.md 6.6).
//
// Run: node --test tests/neural_type_scale.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "../neural/src/app.src.jsx");
const TPL = resolve(HERE, "../neural/src/xdc-template.html");
const src = readFileSync(APP, "utf8");
const tpl = readFileSync(TPL, "utf8");

const Component = new Function(
  "DCLogic",
  "React",
  `${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

/** The real instance at a given viewport width. `isMobile()` reads `this.W` (falling back to
 *  `window.innerWidth`, which does not exist here), so the width must be set explicitly. */
function at(width) {
  const a = new Component({});
  a.W = width;
  return a;
}

const WIDTHS = [320, 360, 390, 414, 640, 641, 768, 1024, 1280, 1440];

test("the announcer never outranks the name of the state it is describing", () => {
  let checked = 0;
  for (const w of WIDTHS) {
    const a = at(w);
    const name = a.nameFontPx();
    const ann = a.announcerPx();
    assert.ok(Number.isFinite(name) && name > 0, `${w}px: nameFontPx() must be a real size, got ${name}`);
    assert.ok(Number.isFinite(ann) && ann > 0, `${w}px: announcerPx() must be a real size, got ${ann}`);
    // a full step, not a rounding: the owner asked for a hierarchy you can see, and 1px is not one
    assert.ok(
      ann <= name / 1.15,
      `${w}px: the announcer (${ann}px) must read clearly below the state's name (${name}px)`,
    );
    checked++;
  }
  // POSITIVE COVERAGE (CLAUDE.md 6.6): "matched nothing" must never look like "all fine"
  assert.equal(checked, WIDTHS.length, "every viewport in the table must have been checked");
});

test("the phone keeps the label size its @curated width bound was measured at", () => {
  // e2e/journeys/dual-pair.spec.ts asserts `labelRight < W` at 320/360/390 from the UNTRIMMED
  // `_labelWidthPx`, and measured (tests/artifacts/_label_size_probe.mjs) 320px admits at most
  // 19px before that deploy gate goes red. Growing this without re-running that probe is the
  // failure this test exists to make loud.
  assert.ok(at(320).nameFontPx() <= 19, "320px: the narrow label size must stay inside dual-pair.spec.ts's bound");
  assert.equal(at(640).nameFontPx(), at(320).nameFontPx(), "one narrow value up to isMobile()'s own 640px edge");
  assert.ok(at(641).nameFontPx() > at(640).nameFontPx(), "…and the wide step must actually be a step");
});

test("the draw, richLabel and _labelWidthPx all read nameFontPx() — no hand-copied mirrors", () => {
  // CLAUDE.md 6.5: `_labelWidthPx` is a MEASUREMENT of what the draw will do, and dual-pair.spec.ts
  // reads the measurement rather than the render — so a literal re-appearing at any of these three
  // sites is invisible to every other gate in the repo.
  const sites = [
    [/const namePx = focused \? this\.nameFontPx\(\) : 15;/, "pair-group draw"],
    [/const rNamePx = big \? this\.nameFontPx\(\) : 13;/, "richLabel big branch"],
    [/const px = this\.nameFontPx\(\);/, "_labelWidthPx"],
  ];
  for (const [re, what] of sites) {
    assert.equal((src.match(re) || []).length, 1, `${what} must read nameFontPx() exactly once`);
  }
  // and the literal that used to live there must be gone from every canvas font string
  assert.equal(
    (src.match(/ctx\.font = \(?(?:big|focused) \? "700 18px /g) || []).length,
    0,
    "no canvas label may hard-code the old 18px focus size",
  );
  // the drawn size must be PUBLISHED, or the journey gate has to re-type it and would agree with
  // a broken build by construction (CLAUDE.md 6.3)
  assert.match(src, /_lastPairLabel = \{[^}]*namePx: namePx/, "_lastPairLabel must publish namePx");
  assert.match(src, /_lastRichLabel = \{[^}]*namePx: rNamePx/, "_lastRichLabel must publish namePx");
});

test("the template's announcer size is a first-frame guess the app overwrites", () => {
  const row = tpl.match(/<div ref="\{\{ evTextRef \}\}" style="([^"]*)"/);
  assert.ok(row, "the announcer text row must still be findable in xdc-template.html");
  const px = row[1].match(/font-size:([\d.]+)px;/);
  assert.ok(px, `the announcer row must carry a plain px font-size, got: ${row[1].slice(0, 60)}`);
  const guess = parseFloat(px[1]);
  // it is never READ by the app, but a guess further from the truth than the step it is guessing
  // means a visible reflow on the first resize — so pin it to the wide value it stands in for.
  assert.equal(guess, at(1280).announcerPx(), "the first-frame guess must match announcerPx() at desktop width");
  assert.match(src, /_applyTypeScale\(\)/, "…and _applyTypeScale must exist to overwrite it");
  assert.match(
    src,
    /resize\(\)\s*\{[\s\S]*?this\._applyTypeScale\(\);[\s\S]*?\n  \}/,
    "_applyTypeScale must be driven from resize(), which is where this.W is set",
  );
});
