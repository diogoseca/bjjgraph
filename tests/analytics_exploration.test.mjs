// Executes production input handlers and app methods, not a second event classifier.
// No browser/dependency install is needed. Browser hit testing, network delivery and
// remote PostHog configuration remain host checks; mutation receipts live in the handoff.
import { test, after } from "node:test";
import nodeAssert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

let assertions = 0;
const assert = new Proxy(nodeAssert, { get: (target, key) => typeof target[key] === "function"
  ? (...args) => { assertions++; return target[key](...args); } : target[key] });
after(() => { console.log(`asserted analytics_exploration: ${assertions} assertions (no optional dependencies or skips)`); nodeAssert.ok(assertions > 0); });
const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const readerSource = readFileSync(new URL("../neural/src/reader.src.js", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const { Reader, ROLES } = new Function(readerSource.replace(/^export /gm, "") + "\nreturn { Reader, ROLES };")();
const exploration = events => events.filter(([name]) => /^neural_(node_opened|connection_followed|side_crossed)$/.test(name));
const noop = () => {};

function fixture() {
  const events = [], opened = [], historyWrites = [];
  globalThis.window = { posthog: { capture: (name, props) => events.push([name, props]) }, innerWidth: 1440 };
  globalThis.location = { href: "https://example.test/Positions/Mount/Top", origin: "https://example.test", pathname: "/Positions/Mount/Top", search: "" };
  globalThis.history = { state: {}, pushState: (...args) => historyWrites.push(args), replaceState: (...args) => historyWrites.push(args) };
  const a = Object.create(Component.prototype);
  a.nodes = [
    { id: "Positions/Mount", t: "Mount Top", ty: "positions", role: "top", rep: true, pi: 1 },
    { id: "Positions/Mount/Bottom", t: "Mount Bottom", ty: "positions", role: "bottom", rep: false, pi: 0 },
    { id: "Transitions/Sweep", t: "Sweep", ty: "transitions", role: "attacker", fromRole: "bottom", fromPositionId: "mount", rep: true, pi: 3 },
    { id: "Transitions/Sweep/Defender", t: "Sweep", ty: "transitions", role: "defender", fromRole: "bottom", fromPositionId: "mount", rep: false, pi: 2 },
    { id: "Positions/Guard", t: "Guard Top", ty: "positions", role: "top", rep: true, pi: -1 },
    { id: "Submissions/Armbar", t: "Armbar", ty: "submissions", role: "attacker", fromRole: "top", fromPositionId: "mount", rep: true, pi: 6 },
    { id: "Submissions/Armbar/Defender", t: "Armbar", ty: "submissions", role: "defender", fromRole: "top", fromPositionId: "mount", rep: false, pi: 5 },
  ].map((n, idx) => ({ ...n, idx, pairId: n.pi < 0 ? null : "pair", x: Math.floor(idx / 2) * 200, y: (idx % 2) * 70 }));
  a._idIndex = new Map(a.nodes.map(n => [n.id, n.idx]));
  a.adj = [[1, 2], [0, 2], [3, 0], [2], [], [6], [5]];
  a.focusIdx = a.currentPos = 0; a.playerRole = "top"; a._giMode = "gi"; a.now = 1;
  a.rsAllows = n => !!n && n.allowed !== false;
  a.rsAllowsIdx = i => a.rsAllows(a.nodes[i]);
  a.posNodeForId = id => id === "mount" ? 0 : -1;
  a._readerLoad = Promise.resolve();
  a._reader = { path: "/Positions/Mount/Top", on: () => true, open: r => opened.push(r) };
  a._declineLandQ = a._leaveRollForReference = a.setDeckOpen = noop;
  a.noteChallenges = noop; // challenge module is outside this analytics fixture
  return { a, events, opened, historyWrites };
}

function dossier(a) {
  for (const name of ["_stopSystemPreview", "_stopConceptFilm", "releaseCamera", "stageRollAt", "flare"]) a[name] = noop;
  a.setPaused = v => { a.paused = v; };
  a.W = 1440;
}

function input(a) {
  const handlers = {};
  const el = { style: {}, addEventListener: (name, f) => { handlers[name] = f; }, setPointerCapture: noop, releasePointerCapture: noop, closest: () => null };
  globalThis.document = { addEventListener: noop };
  a.wrapRef = { current: el }; a.nodeCardRef = a.dossierSheetRef = { current: null };
  a.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  a.W = 1000; a.H = 800; a.graphW = 2000;
  a.cam = { cx: 0, cy: 0, vw: 1000 }; a.camTarget = { ...a.cam };
  a._rulesetMask = () => a.nodes.map(n => a.rsAllows(n));
  a.closeDeckIfStudying = a.releaseCamera = noop;
  a.stageRollAt = noop; a._tapBackground = noop;
  a.attachInput();
  return (type, x, y, extra = {}) => handlers[type]({ type, clientX: x, clientY: y, pointerId: 1, target: el, preventDefault: noop, ...extra });
}

function linkEvent(path, overrides = {}) {
  const link = { href: new URL(path, location.href).href, dataset: {}, target: "", hasAttribute: () => false };
  return { button: 0, target: { closest: () => link }, stopPropagation: noop, preventDefault: noop, ...overrides };
}

test("Browse and search choose one event per action, with fixed properties and no query/title/URL", async () => {
  const { a, events, opened } = fixture();
  a.nodes[4].t = "private typed title";
  for (const surface of ["browse", "search"]) {
    await a._readArticle("/Positions/Guard?search=private-text#private-fragment", true, true, surface);
    assert.equal(exploration(events).length, opened.length);
    assert.deepEqual(events.at(-1), ["neural_node_opened", { variant: "neural", surface, node_type: "positions", role: "top", from_type: "positions", from_role: "top", ruleset: "gi" }]);
  }
  assert.equal(opened.length, 2, "two real repeated choices count twice, without a time debounce");
  assert.doesNotMatch(JSON.stringify(events), /private|Guard|Mount|example|https/);
});

test("rendered search, singleton and family rows wire real clicks; repainting sends nothing", async () => {
  const { a, events } = fixture();
  const element = () => ({ style: {}, children: [], handlers: {},
    set innerHTML(value) { this.html = value; this.children = []; }, get innerHTML() { return this.html; },
    setAttribute: noop, querySelector: () => null, querySelectorAll: () => [],
    appendChild(el) { this.children.push(el); }, addEventListener(name, fn) { this.handlers[name] = fn; } });
  globalThis.document = { createElement: element };
  const list = element(); a.explorerListRef = { current: list }; a._viewMode = "explore";
  for (const name of ["_stopConceptFilm", "_stopSystemPreview", "renderTabSubtitles", "_syncExploreTools", "clearFocus", "_ensureSystems", "_renderSystemsStatus", "_ensureConcepts", "renderLists"]) a[name] = noop;
  a.buildExplorer = () => ({ groups: { positions: { Guard: [a.nodes[4]] }, transitions: { Moves: [a.nodes[2], a.nodes[5]] } }, order: [["Positions", "positions"], ["Transitions", "transitions"]] });
  a._exploreSectionOpen = () => true; a._exp = { f: new Set(["transitions|Moves"]) };
  a.nodeMatches = n => n.idx === 2; a.nodeQual = () => ""; a.hex = () => "#fff";
  a.graphName = n => n.t; a._withListAdd = (el, n) => { el.chosen = n.idx; return el; };
  a._exQ = "sweep"; a.renderExplorer(); a.renderExplorer();
  assert.equal(events.length, 0);
  await list.children.find(el => el.chosen === 2).handlers.click();
  assert.equal(events.length, 1, "the rendered search row is an instrumented input");
  assert.equal(events[0][1].surface, "search");
  a._exQ = ""; a.renderExplorer(); a.renderExplorer();
  assert.equal(events.length, 1);
  for (const idx of [4, 2]) await list.children.find(el => el.chosen === idx).handlers.click();
  assert.deepEqual(events.map(([name, p]) => [name, p.surface]), [
    ["neural_node_opened", "search"], ["neural_node_opened", "browse"], ["neural_node_opened", "browse"],
  ]);
});

test("production article handler follows a connection, excludes anchors, modifiers and external links", async () => {
  const { a, events, opened } = fixture();
  const r = Object.create(Reader.prototype); r.app = a;
  r.link(linkEvent("/Transitions/Sweep/Attacker?view=guide#overview"));
  await Promise.resolve();
  assert.equal(exploration(events).length, 1);
  assert.equal(events[0][0], "neural_connection_followed");
  assert.equal(events[0][1].surface, "article_link");
  assert.equal(events[0][1].role, "attacker", "bottom performer is still the attacker");
  const destination = new URL(opened[0].path, location.href);
  assert.equal(destination.pathname + destination.search + destination.hash, "/Transitions/Sweep/Attacker?view=guide#overview", "reader normalization preserves query and anchor");
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) r.link(linkEvent("/Positions/Guard", overrides));
  r.link(linkEvent("https://elsewhere.test/Positions/Guard"));
  let anchors = 0; r.readingInteraction = noop; r.anchor = () => anchors++;
  const e = linkEvent("#overview"); const l = e.target.closest(); l.dataset.readerAnchor = "true"; l.closest = () => ({}); r.link(e);
  assert.equal(anchors, 1);
  assert.equal(exploration(events).length, 1);
});

test("position and technique perspective links emit only side_crossed, using physical seat correctly", async () => {
  for (const [from, target, kind, before, afterRole] of [
    ["/Positions/Mount/Top", "/Positions/Mount/Bottom", "positions", "top", "bottom"],
    ["/Positions/Mount/Bottom", "/Positions/Mount/Top", "positions", "bottom", "top"],
    ["/Transitions/Sweep/Attacker", "/Transitions/Sweep/Defender", "transitions", "attacker", "defender"],
    ["/Transitions/Sweep/Defender", "/Transitions/Sweep/Attacker", "transitions", "defender", "attacker"],
    ["/Submissions/Armbar/Attacker", "/Submissions/Armbar/Defender", "submissions", "attacker", "defender"],
  ]) {
    const { a, events } = fixture(); a._reader.path = from;
    const r = Object.create(Reader.prototype); r.app = a; r.link(linkEvent(target));
    await Promise.resolve();
    assert.deepEqual(events.map(([n]) => n), ["neural_side_crossed"]);
    assert.equal(events[0][1].node_type, kind); assert.equal(events[0][1].from_role, before); assert.equal(events[0][1].role, afterRole);
  }
});

test("a reference article link does not borrow a stale game seat; same-side links are openings", async () => {
  const { a, events } = fixture();
  a._reader.path = "/Principles/Frames";
  await a._readArticle("/Positions/Mount/Bottom", true, true, "article_link");
  assert.equal(events[0][0], "neural_connection_followed");
  assert.equal(events[0][1].from_type, null); assert.equal(events[0][1].from_role, null);
  a._reader.path = "/Positions/Mount/Top";
  await a._readArticle("/Positions/Mount/Top#overview", true, true, "article_link");
  assert.equal(events[1][0], "neural_node_opened");
  a.focusIdx = 1; a.playerRole = "bottom";
  await a._readArticle("/Positions/Mount", true, true, "browse");
  assert.equal(events[2][0], "neural_node_opened", "a site row's default role is not an explicit side choice");
});

test("actual graph pointer handler distinguishes paired side, adjacent node and unrelated node once", () => {
  for (const [idx, event] of [[1, "neural_side_crossed"], [2, "neural_connection_followed"], [4, "neural_node_opened"]]) {
    const { a, events } = fixture(); const dispatch = input(a), n = a.nodes[idx];
    dispatch("pointerdown", 500 + n.x, 400 + n.y); dispatch("pointerup", 500 + n.x, 400 + n.y);
    assert.deepEqual(exploration(events).map(([name]) => name), [event]);
    dispatch("pointerup", 500 + n.x, 400 + n.y);
    assert.equal(exploration(events).length, 1, "a second release without a press is not a second action");
  }
});

test("graph connections use either pair member's adjacency, never mere proximity", () => {
  const { a, events } = fixture();
  a.adj[0] = [1]; a._trackExplore(2, "graph");
  assert.equal(events[0][0], "neural_connection_followed", "the bottom member carries the connection");
  a.adj[1] = [0]; a._trackExplore(2, "graph");
  assert.equal(events[1][0], "neural_node_opened", "a nearby unconnected orb remains an opening");
  a.focusIdx = 2; a.playerRole = "bottom"; a._trackExplore(3, "graph");
  assert.equal(events[2][0], "neural_side_crossed");
  assert.equal(events[2][1].from_role, "attacker"); assert.equal(events[2][1].role, "defender");
});

test("map partner redirect through the production reader wrapper does not duplicate an event", async () => {
  const { a, events, opened } = fixture(); const dispatch = input(a);
  const wrapper = readerSource.match(/  for \(const name of \["rollFromPosition"[\s\S]*?\n  const activate =/)?.[0].replace(/  const activate =$/, "");
  assert.ok(wrapper, "execute the actual installed wrapper");
  a._reader.intent = true;
  new Function("app", "reader", "ROLES", wrapper)(a, a._reader, ROLES);
  dispatch("pointerdown", 500, 470); dispatch("pointerup", 500, 470);
  await Promise.resolve();
  assert.equal(opened.length, 1); assert.equal(opened[0].path, "/Positions/Mount/Bottom");
  assert.deepEqual(exploration(events).map(([name]) => name), ["neural_side_crossed"]);
});

test("pan, wheel, cancellation, background and disabled graph are not exploration", () => {
  for (const gesture of ["pan", "wheel", "cancel", "background", "disabled"]) {
    const { a, events } = fixture(); const dispatch = input(a);
    if (gesture === "disabled") a._reader.on = () => false;
    if (gesture === "wheel") dispatch("wheel", 500, 400, { deltaY: -20 });
    else {
      const x = gesture === "background" ? 980 : 500;
      dispatch("pointerdown", x, 470);
      if (gesture === "pan") dispatch("pointermove", 650, 470);
      dispatch(gesture === "cancel" ? "pointercancel" : "pointerup", gesture === "pan" ? 650 : x, 470);
    }
    assert.equal(exploration(events).length, 0, gesture);
  }
});

test("list/reference navigation counts, generic dossier calls and automatic zoom do not", () => {
  const { a, events } = fixture(); dossier(a);
  a.openDossier(4, false, "list");
  a.openDossier(4, false, "reference");
  assert.equal(exploration(events).length, 2);
  a.openDossier(4); a.openDossier(4, true, "list");
  a.W = 390; a.graphW = 2000; a.cam = { cx: 0, cy: 0, vw: 50 }; a._zoomOpenCheck(50);
  assert.equal(exploration(events).length, 2);
});

test("boot, popstate, automatic articles, re-render and retry have no exploration event", async () => {
  const { a, events, opened } = fixture();
  for (const args of [[true, false], [false, false], [true, true]]) await a._readArticle("/Positions/Mount/Bottom", ...args);
  for (let i = 0; i < 3; i++) a._reader.open(a._readerRequest);
  assert.equal(opened.length, 6);
  assert.equal(exploration(events).length, 0);
  // Even an accidentally forwarded source cannot turn restore/automatic intent into an action.
  await a._readArticle("/Positions/Mount/Bottom", true, false, "browse");
  await a._readArticle("/Positions/Mount/Bottom", false, true, "browse");
  assert.equal(exploration(events).length, 0);
  await a._readArticle("/Positions/Guard", true, true, "browse");
  await a._readArticle(a._readerRequest.path, a._readerRequest.intent, a._readerRequest.push);
  assert.equal(exploration(events).length, 1, "retry of an already chosen article is not another choice");
});

test("automatic seat, URL sync, queued article and replay steps stay silent", async () => {
  const { a, events } = fixture();
  for (const name of ["_endArrival", "_gameValueChanged", "clearTimers", "clearOptions", "clearEngagement", "_cancelCheckpoint", "_updateComboChip", "_closeRoll", "releaseCamera", "_prefetchLandDeck", "hideCenter", "flare", "enterLand"]) a[name] = noop;
  a.rng = () => 0.5; a.myVal = () => 0; a.pairMid = n => ({ x: n.x, y: n.y });
  a.rollCamTarget = p => ({ ...p, vw: 400 }); a.setPaused = v => { a.paused = v; };
  a.rollFromPosition(0, true); a.stageRollAt(1);
  a._syncUrl(4); a._syncUrl(0, true);
  const queued = [];
  globalThis.requestAnimationFrame = f => queued.push(f);
  a._readerIntent = false; a._urlSeeded = true; a.optionsRef = { current: null };
  a._queueReader(a.nodes[4]); queued.shift()();
  await new Promise(resolve => setTimeout(resolve, 10));
  a._replay = { i: -1, reduced: true, steps: [{ kind: "land", to: 0 }, { kind: "land", to: 1 }, { kind: "sweep", from: 1, via: 2, to: 4 }] };
  a._replayAim = a.setEvent = a._renderReplayBar = noop; a.after = () => 1;
  a._replayStep(); a._replayStep(); a._replayStep();
  assert.equal(a.focusIdx, 2, "real replay step changed focus");
  assert.equal(exploration(events).length, 0);
});

test("unavailable, unresolved, non-node and unrecognized surface inputs cannot create events", async () => {
  const { a, events } = fixture(); a.nodes[4].allowed = false;
  a._trackExplore(4, "graph"); a._trackExplore(-1, "browse"); a._trackExplore(0, "a typed query");
  await a._readArticle("/Principles/Frames", true, true, "browse");
  await a._readArticle("/Positions/Missing", true, true, "browse");
  await a._readArticle("https://elsewhere.test/Positions/Mount", true, true, "article_link");
  assert.equal(exploration(events).length, 0);
  a.nodes[4].allowed = true; a._giMode = "nogi"; a._trackExplore(4, "graph");
  assert.equal(events[0][1].ruleset, "nogi");
});

test("keyless, opted-out and throwing SDKs send nothing and cannot break navigation", async () => {
  for (const mode of ["keyless", "opted-out", "throws"]) {
    const { a, events, opened } = fixture();
    if (mode === "keyless") delete window.posthog;
    if (mode === "opted-out") window.posthog.has_opted_out_capturing = () => true;
    if (mode === "throws") window.posthog.capture = () => { throw Error("unavailable"); };
    await assert.doesNotReject(a._readArticle("/Positions/Guard", true, true, "browse"));
    assert.equal(events.length, 0, mode); assert.equal(opened.length, 1, mode);
    if (mode === "keyless") assert.equal(window.posthog, undefined, "no stub/SDK created by a consumer");
  }
  const { a, events } = fixture();
  window.posthog.has_opted_out_capturing = () => false;
  a._trackExplore(4, "browse");
  assert.equal(events.length, 1, "the positive SDK control captures");
});
