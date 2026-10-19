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

test("execution framing clears a top-scrolled card and announcer without moving the card or accumulating a correction", () => {
  globalThis.getComputedStyle = el => el.style;
  const surface = (left, top, width, height) => ({ isConnected: true, style: { opacity: "1" },
    getBoundingClientRect: () => ({ left, right: left + width, top, bottom: top + height, width, height }) });
  for (const [cardX, cardY] of [[978, 68], [0, 68], [978, 620]]) for (const reward of [false, true]) {
    const n = { idx: 0, pi: 1, x: 0, y: 0 }, partner = { idx: 1, x: 0, y: 32 };
    const card = surface(cardX, cardY, 150, 144), toast = surface(450, 30, 540, 40.59375);
    const r = Object.create(Reader.prototype), a = r.app = { W: 1440, H: 900, graphW: 16000, nodes: [n, partner],
      _execution: { card }, evRef: { current: toast }, accountRef: {}, shareCueRef: {},
      // Rewards portal outside the fixed wrap; querying wrap descendants misses them.
      _challengeRewardEl: reward ? surface(620, 90, 300, 100) : null,
      wrapRef: { current: { querySelectorAll: () => [] } }, _LY: q => q.y,
      _nodeHalfW: () => 17, _labelWidthPx: () => 110, pairMid: () => ({ x: 0, y: 16 }), _paneLayout: () => ({ left: 0 }) };
    r.root = { getBoundingClientRect: () => ({ top: 68, bottom: 800 }), contains: () => false };
    r.articleEl = surface(380, cardY + 158, 680, 800); r.contents = surface(1216, 68, 200, 600); r.gameSections = [];
    const target = { cx: 86.4, cy: 375.4, vw: 1440, _paneFraction: 0 }, before = card.getBoundingClientRect();
    const fixed = r.frameExecution(target, n), point = { x: 720 - fixed.cx, y: 450 - fixed.cy };
    assert.ok(point.y - 17 > toast.getBoundingClientRect().bottom, "the whole upper orb clears the announcer");
    assert.ok(point.y + 49 < r.articleEl.getBoundingClientRect().top, "both orbs clear the article");
    assert.ok(point.x > 17 && point.x + 17 + 11 + 110 < 1216, "the whole name clears the index");
    if (reward) assert.ok(point.x + 138 <= 620 || point.x - 17 >= 920 || point.y + 49 <= 90 || point.y - 17 >= 190,
      "the portal-owned reward is occupied even though it is not in the wrap");
    if (cardY > 70.59375) assert.ok(point.y < cardY, "the original above-card bound survives wherever its band exists");
    assert.deepEqual(card.getBoundingClientRect(), before, "camera composition never moves the clicked card");
    assert.deepEqual(r.frameExecution(fixed, n), fixed, "a second pass cannot accumulate the correction");
    assert.equal(fixed.vw, target.vw, "the existing execution zoom and pane stamp survive");
    assert.equal(fixed._paneFraction, target._paneFraction);
  }
});

test("D-329: reading-view execution framing stays inside the node band the landing rows mount below", () => {
  // camera-continuity:287 at 390px: D-322 fitted the pair under the card (y323); the landing's rows
  // then mounted from y269 over it. The band is where the reading view frames the node anyway.
  globalThis.getComputedStyle = el => el.style;
  const surface = (left, top, width, height) => ({ isConnected: true, style: { opacity: "1" },
    getBoundingClientRect: () => ({ left, right: left + width, top, bottom: top + height, width, height }) });
  const n = { idx: 0, pi: 1, x: 0, y: 0 }, partner = { idx: 1, x: 0, y: 32 };
  const card = surface(0, 78, 150, 144), toast = surface(27, 30, 336, 37);
  const r = Object.create(Reader.prototype), a = r.app = { W: 390, H: 844, graphW: 16000, nodes: [n, partner],
    _execution: { card }, evRef: { current: toast }, accountRef: {}, shareCueRef: {}, _challengeRewardEl: null,
    wrapRef: { current: { querySelectorAll: () => [] } }, _LY: q => q.y, get: (key, fallback) => fallback,
    _nodeHalfW: () => 17, _labelWidthPx: () => 110, pairMid: () => ({ x: 0, y: 16 }), _paneLayout: () => ({ left: 0 }) };
  r.root = { getBoundingClientRect: () => ({ top: 78, bottom: 754 }), contains: () => false };
  r.articleEl = surface(12, 234, 366, 520); r.contents = null; r.gameSections = [];
  r.nodeBand = { top: 78, bottom: 214, height: 136 };
  const fixed = r.frameExecution({ cx: 0, cy: 0, vw: 390, _paneFraction: 0 }, n), p = { x: 195 - fixed.cx, y: 422 - fixed.cy };
  assert.ok(p.y - 36 >= 78 && p.y + 56 <= 214, "the reserved pair box sits inside the node band: " + JSON.stringify(p));
  assert.ok(p.x - 17 >= 150 + 4, "and beside the card, never under it");
  r.nodeBand = null;
  const free = r.frameExecution({ cx: 0, cy: 0, vw: 390, _paneFraction: 0 }, n);
  assert.notDeepEqual(free, fixed, "without the band the free-space search answers differently (the control)");
});

test("execution framing before the first frame keeps the target instead of throwing", () => {
  // CI 48be3a910: 15 defending journeys threw "t._LY is not a function" from the frame
  // loop. updateCamera runs before draw, and a pumped advance draws only at its end.
  const r = Object.create(Reader.prototype);
  r.app = { W: 390, H: 844, graphW: 16000, nodes: [], _execution: { card: null } };
  const target = { cx: 12, cy: 34, vw: 390, _paneFraction: 0 };
  let framed;
  assert.doesNotThrow(() => { framed = r.frameExecution(target, { idx: 0, pi: -1, x: 0, y: 0 }); });
  assert.equal(framed, target, "no painted pair yet, so nothing to fit");
});

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
    removeAttribute: key => attrs.delete(key),
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
    resize: { observe() {}, unobserve() {} }, on: part => part !== "book" });
  r.root = node({ top: "68px", height: "682px" }); r.root.scrollTop = 50;
  r.root.getBoundingClientRect = () => ({ top: +parseFloat(r.root.style.top), bottom: 750 });
  r.game = node({ height: adopted ? "626.75px" : "0px" });
  r.game.getBoundingClientRect = () => ({ top: parseFloat(r.root.style.top) - r.root.scrollTop, height: parseFloat(r.game.style.height) });
  r.articleEl = node(); r.mediaHome = node();
  r.gameSections = [{ card: node() }, { card: node() }];
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
  Object.assign(a, { W: 390, H: 844, _paneLayout: () => ({ width: window.innerWidth, center: window.innerWidth / 2 }),
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

test("native layout leaves Inspect's horizontal animation to its own writer", () => {
  const f = fixture();
  for (const transform of ["translateX(-846px)", "translateX(24px)", "none"]) {
    f.row.style.transform = transform;
    f.r.layoutNow();
    f.r.layoutNow();
    assert.equal(f.row.style.transform, transform);
    assert.equal(f.row.style.getPropertyPriority("transform"), "");
  }
});

test("Book reserves its node and section headers without changing an execution snapshot", () => {
  const f = fixture();
  f.r.on = () => true;
  f.r.layoutNow();
  assert.deepEqual(f.r.nodeBand, { top: 68, bottom: 204, height: 136 });
  assert.equal(f.r.gameSections[0].card.style.top, "136px");
  assert.equal(f.r.gameSections[1].card.style.top, "196px");
  assert.equal(f.row.style.top, "240px");
  choose(f);
  const snapshot = f.a._execution.card._ngDock.reader;
  f.r.gameTop = 6;
  f.r.layoutNow();
  assert.equal(parseFloat(f.row.style.top), snapshot.rowTop);
  assert.equal(parseFloat(f.r.game.style.height), snapshot.height);
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
  assert.equal(f.row.id, "reader-hand-body", "adoption publishes the named eye's actual target");
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

test("the article and shelf have one frame writer while fixed replay keeps its own writer", () => {
  const { a, r } = fixture();
  window.innerWidth = a.W = 1440;
  a.isMobile = () => false; a._compactLandDeck = () => false;
  let center = 800;
  a._paneLayout = () => ({ center, width: 2 * (1440 - center) });
  a._layerDockEl = r.dock; r.dock.style.left = "720px";
  const replay = a._replayEl = node(); replay.offsetWidth = 360;
  let pending, queued = 0;
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { pending = callback; queued++; return 1; };
  try {
    for (let i = 0; i < 4; i++) a._layoutLandHorizontal();
    assert.equal(r.dock.style.left, "720px", "legacy positioning cannot move the shelf ahead of its article");
    assert.equal(replay.style.left, "800px", "fixed replay still follows the pane immediately");
    assert.equal(queued, 1, "one coalesced native layout");
    pending();
    assert.equal(parseFloat(r.dock.style.left), center);
    assert.equal(parseFloat(r.articleEl.style["margin-left"]) + parseFloat(r.articleEl.style.width) / 2, center);
    // A reference or hidden game can leave only the reader-owned shelf. That
    // must still schedule layout after excluding it from the legacy writers.
    a._replayEl = null; center = 860;
    a._layoutLandHorizontal();
    assert.equal(queued, 2);
    assert.equal(r.dock.style.left, "800px");
    pending();
    assert.equal(parseFloat(r.dock.style.left), center);
    assert.equal(parseFloat(r.articleEl.style["margin-left"]) + parseFloat(r.articleEl.style.width) / 2, center);
  } finally {
    if (original) globalThis.requestAnimationFrame = original;
    else delete globalThis.requestAnimationFrame;
  }
});

console.log("reader handoff: 8 behavioral cases; real browser geometry is pinned separately");
