// Exercise the actual reader layout and shared execution gate without a browser.
// Rectangles are fixture inputs; actual mouse reachability and the <=2px flight
// contract remain in card-click-contract.spec.ts and require a built browser run.
// Seven unit controls failed at assertions: missing label clearance, native snapshot,
// row reservation, height reservation, release gate, late adoption and bottom-writer guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const appSource = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const readerSource = readFileSync(new URL("../neural/src/reader.src.js", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${appSource}\nreturn Component;`)(class {}, { createRef: () => ({ current: null }) });
const Reader = new Function(readerSource.replace(/^export /gm, "") + "\nreturn Reader;")();
const wrapper = readerSource.match(/  const execution = app.executionCard;[\s\S]*?\n  };/)?.[0];
assert.ok(wrapper, "exercise the installed execution wrapper, not a test-side formula");

class Style {
  constructor(values = {}) { Object.assign(this, values); this.priorities = {}; }
  getPropertyValue(key) { return this[key] || ""; }
  getPropertyPriority(key) { return this.priorities[key] || ""; }
  setProperty(key, value, priority = "") { this[key] = value; this.priorities[key] = priority; }
}
function node(values = {}) {
  const attrs = new Set();
  return { style: new Style(values), dataset: {}, isConnected: true,
    setAttribute: key => attrs.add(key), hasAttribute: key => attrs.has(key),
    toggleAttribute(key, on) { if (on) attrs.add(key); else attrs.delete(key); },
    append(el) { el.parentElement = this; }, appendChild(el) { this.append(el); },
    remove() { this.isConnected = false; },
  };
}
function fixture(adopted = true) {
  globalThis.window = { innerWidth: 390, innerHeight: 844 };
  globalThis.getComputedStyle = el => el.style;
  const a = new Component({}), r = a._reader = Object.create(Reader.prototype);
  Object.assign(r, { app: a, path: "/Positions/Mount/Bottom", gameTop: 180, gameHomes: new Map(),
    resize: { observe() {}, unobserve() {} }, on: () => true });
  r.root = node({ top: "68px", height: "682px" }); r.root.scrollTop = 50;
  r.root.getBoundingClientRect = () => ({ top: +parseFloat(r.root.style.top), bottom: 750 });
  r.game = node({ height: adopted ? "626.75px" : "0px" });
  r.game.getBoundingClientRect = () => ({ top: parseFloat(r.root.style.top) - r.root.scrollTop, height: parseFloat(r.game.style.height) });
  r.articleEl = node(); r.mediaHome = node();
  r.dock = node(); r.dock.getBoundingClientRect = () => ({ top: 758, height: 48 });
  const wrap = node(); wrap.querySelector = () => null; a.wrapRef.current = wrap;
  const row = a.optionsRef.current = node({ top: "430.5px", bottom: "auto", paddingTop: "8px" });
  row.parentElement = adopted ? r.game : wrap; row.fixtureHeight = 196.25;
  if (adopted) { row.setAttribute("data-reader-game-part"); r.gameHomes.set(row, {}); }
  row.getBoundingClientRect = () => {
    if (row.parentElement !== r.game) return { top: 520, bottom: 716.25, height: 196.25 };
    const top = r.game.getBoundingClientRect().top + parseFloat(row.style.top);
    return { top, bottom: top + row.fixtureHeight, height: row.fixtureHeight };
  };
  Object.assign(a, { _paneLayout: () => ({ width: window.innerWidth, center: window.innerWidth / 2 }),
    _readerShelfBottom: () => 12, _handShown: () => true, isMobile: () => true });
  return { a, r, row };
}
function choose(f) {
  const { a, r, row } = f, opt = {};
  const stand = node(); stand._ngDock = { w: 390, h: 844, bottom: NaN };
  a._optionCards = [{ opt, card: { getBoundingClientRect: () => ({ top: 492.75 }) } }];
  a.executionCard = () => stand;
  new Function("app", "reader", wrapper)(a, r);
  assert.equal(a.executionCard(opt), stand);
  a._execution = { card: stand, result: false };
  return stand;
}

test("native capture measures label clearance and replaces container bottom with the shared viewport datum", () => {
  const f = fixture(), card = choose(f);
  assert.equal(card.style.marginTop, "36.25px");
  assert.equal(f.a._landDatum().tray, 199.25);
  assert.deepEqual(card._ngDock.reader, { rowTop: 430.5, height: 626.75 });
});

test("teardown and result display keep the same native row and article reservation", () => {
  const f = fixture(); choose(f);
  f.row.fixtureHeight = 180; // removing taller siblings must not pull the article over the choice
  for (const result of [false, true]) {
    f.a._execution.result = result;
    f.r.gameTop = 32;
    f.r.layoutNow();
    assert.equal(f.row.style.top, "430.5px");
    assert.equal(f.r.game.style.height, "626.75px");
    assert.equal(f.row.getBoundingClientRect().top, 448.5);
  }
});

for (const release of ["resize", "reading", "arrival"]) {
  test(`${release} releases the native reservation through the existing execution owner`, () => {
    const f = fixture(); choose(f);
    if (release === "resize") window.innerWidth = 500;
    if (release === "reading") f.r.interacting = true;
    if (release === "arrival") f.a.clearExecution();
    assert.equal(f.a._executionDock(), null);
    f.r.layoutNow();
    assert.equal(f.row.style.top, "180px");
    assert.equal(f.r.game.style.height, "376.25px");
  });
}

test("adoption during an existing fixed execution translates its measured rectangle once", () => {
  const f = fixture(false), card = node();
  card._ngDock = { w: 390, h: 844, bottom: 127.75 };
  f.a._execution = { card };
  f.r.layoutNow();
  assert.equal(f.row.parentElement, f.r.game);
  assert.deepEqual(card._ngDock.reader, { rowTop: 502, height: 698.25 });
  assert.equal(f.row.getBoundingClientRect().top, 520);
  const snapshot = card._ngDock.reader;
  f.r.layoutNow();
  assert.equal(card._ngDock.reader, snapshot, "later passes cannot recapture the reservation");
  assert.equal(f.row.getBoundingClientRect().top, 520);
});

test("startExecution uses the shared bottom only for the fixed home", () => {
  for (const adopted of [false, true]) {
    const { a, row } = fixture(adopted), card = node(); card._ngDock = {};
    let reads = 0;
    a._landDatum = () => { reads++; return { tray: 199.25 }; };
    a._placeOnTable = () => {};
    a.startExecution({ idx: 1 }, card);
    assert.equal(row.style.bottom, adopted ? "auto" : "199.25px");
    assert.equal(reads, adopted ? 0 : 1);
  }
});

console.log("reader handoff: 7 behavioral cases; real browser geometry remains pending");
