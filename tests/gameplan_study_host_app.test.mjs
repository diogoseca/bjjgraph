// Real candidate app seam source, exercised without a browser. A worker testing
// an isolated patch sets BJJ_STUDY_APP_SOURCE; integration/CI reads its own app.
// This tests intent/lifecycle/DOM text, not layout, network timing or gameplay.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(process.env.BJJ_STUDY_APP_SOURCE || new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", source + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
class Element {
  children = []; attrs = {}; style = {}; textContent = "";
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(k, fn) { this["on" + k] = fn; }
  querySelector(s) {
    const key = s.slice(1, -1);
    for (const c of this.children) { if (key in c.attrs) return c; const nested = c.querySelector(s); if (nested) return nested; }
    return null;
  }
  text() { return this.textContent + " " + this.children.map(c => c.text()).join(" "); }
}
globalThis.document = { createElement: () => new Element() };
function fixture() {
  const app = Object.create(Component.prototype), calls = { loads: 0, requests: [], reconciles: [], destroys: 0, paints: 0 };
  app._gameplanStudyDeclaration = { mode: 'current-position', targets: { kind: 'sharp-refresh', deckKeys: ['Mount|Top'] } };
  app._progressOwnerStamp = {}; app._progressCurrent = () => true; app._refreshGameplanUI = () => calls.paints++;
  app._session = { keys: ["due", "saved-new"], idx: 1, review: { count: 1 }, plan: { frozen: "order" } };
  app.drillListRef = { current: new Element() };
  const host = { request(i) { calls.requests.push(i); return Promise.resolve({ phase: "pending" }); },
    reconcile(r) { calls.reconciles.push(r); }, destroy() { calls.destroys++; }, snapshot() { return { phase: "pending" }; } };
  app._fetchGameplanStudyHost = async (_attempt, options) => { calls.loads++; calls.observer = options.onState; return host; };
  return { app, calls, host };
}

test("app status rendering and due-only plan intent do not import study code", async () => {
  const { app, calls } = fixture();
  assert.equal(app._gameStudyStatText({ status: "unavailable", fresh: [] }, String), "Study plan");
  app._gameStudyPanel(); app._gameStudyChanged("stats"); app._gameStudyPriorityChanged(); await flush();
  assert.equal(calls.loads, 0); assert.deepEqual(calls.requests, []);
});

test("explicit plan intent lazily installs one host and later status leaves mounted order unchanged", async () => {
  const { app, calls, host } = fixture(), session = app._session, before = structuredClone(session);
  const a = app._requestGameplanStudy("open-plan"), b = app._requestGameplanStudy("suggestions"); await Promise.all([a, b]);
  assert.equal(calls.loads, 1); assert.equal(app._gameStudyHost, host);
  assert.deepEqual(calls.requests, ["open-plan", "suggestions"]);
  calls.observer({ phase: "partial", message: "Some comparisons remain uncertain.", provider: { study: { groups: [] } } });
  assert.equal(app._gameStudyState.phase, "partial"); assert.equal(app._session, session); assert.deepEqual(session, before);
  app._gameStudyChanged("knowledge"); app._gameStudyPriorityChanged(); assert.deepEqual(calls.reconciles, ["knowledge", "live-choice-priority"]);
});

test("late lazy installation is disposed after context invalidation or teardown without an implicit restart", async () => {
  for (const change of [app => app._gameStudyChanged("profile"), app => { app.__ngDestroyed = true; app._destroyGameplanStudy(); }]) {
    const { app, host, calls } = fixture(), gate = deferred(); app._fetchGameplanStudyHost = () => gate.promise;
    const promise = app._requestGameplanStudy("open-plan"); await flush(); change(app); gate.resolve(host); await promise;
    assert.equal(calls.destroys, 1); assert.deepEqual(calls.requests, []); assert.ok(!app._gameStudyHost);
  }
});

test("owner replacement during a lazy load cannot leave the new owner stuck in pending", async () => {
  const { app, host, calls } = fixture(), gate = deferred(); app._fetchGameplanStudyHost = () => gate.promise;
  const p = app._requestGameplanStudy("open-plan"); await flush(); app._progressOwnerStamp = {}; gate.resolve(host); await p;
  assert.equal(calls.destroys, 1); assert.equal(app._gameStudyState.phase, "unavailable"); assert.deepEqual(calls.requests, []);
});

test("missing factory and import failure have honest distinct states and explicit retry is fresh", async () => {
  const { app, calls } = fixture(); delete app._fetchGameplanStudyHost;
  await app._requestGameplanStudy("open-plan"); assert.equal(app._gameStudyState.phase, "unavailable");
  app._fetchGameplanStudyHost = async () => { throw Error("test import failure"); };
  await app._requestGameplanStudy("retry"); assert.equal(app._gameStudyState.phase, "error");
  const replacement = fixture(); app._fetchGameplanStudyHost = replacement.app._fetchGameplanStudyHost;
  await app._requestGameplanStudy("retry"); assert.equal(replacement.calls.loads, 1);
  await app._requestGameplanStudy("retry"); assert.equal(replacement.calls.destroys, 1); assert.equal(replacement.calls.loads, 2);
  assert.deepEqual(calls.requests, []);
});

test("pending queued unavailable error and partial states never display an invented zero suggestion count", () => {
  const { app } = fixture(), plan = { status: "exhausted", fresh: [] };
  for (const phase of ["pending", "queued", "unavailable", "error", "partial"]) {
    app._gameStudyState = { phase }; assert.doesNotMatch(app._gameStudyStatText(plan, String), /^0/);
  }
  app._gameStudyState = { phase: "ready" }; assert.equal(app._gameStudyStatText(plan, String), "0 new", "a complete assessed result may honestly have no suggestions");
});

test("joint coverage text preserves roles uncertainty and full-group conditions without numeric win promises", () => {
  const { app } = fixture(), session = structuredClone(app._session);
  app._gameStudyState = { phase: "partial", message: "Partial comparison", sourceProvenance: { starts: { scope: "next-roll-current-conditions" } }, provider: { study: { secondaryUnresolved: true,
    groups: ["beneficial", "uncertain", "non-positive", "unavailable"].map((status, i) => ({ status,
      source: { deckKeys: [{ deckKey: "Move|Defender", role: "Defender" }], benefit: { pointEstimate: .37, orderingScore: .31 } } })) } } };
  const box = app._gameStudyPanel(), copy = box.text();
  assert.match(copy, /Move · Defender/); assert.match(copy, /all the proposed bonuses/); assert.match(copy, /remains uncertain/);
  assert.match(copy, /complete comparison is unavailable/); assert.match(copy, /do not predict how much you will learn/);
  assert.match(copy, /Next-roll starting positions, keeping this roll’s length and opponent strength/);
  assert.doesNotMatch(copy, /\.37|\.31|37%|31%|simulatedWinDelta/); assert.deepEqual(app._session, session);
  app._gameStudyState = { phase: "queued", dependency: "live-choice" }; app._paintGameStudyPanel(box);
  assert.match(box.querySelector("[data-gameplan-study-state]").textContent, /move’s calculation goes first/);
});

test("new plan and explicit refresh request study; due-only entry and internal runtime reopening do not", async () => {
  const { app, calls } = fixture(); app._requestGameplanStudy = i => { calls.requests.push(i); return Promise.resolve(); };
  app._ensureGameplanClock = () => {}; app._gameplanRuntime = { ngGameplanSummary: () => "plan", ngGameplanBind: x => x };
  app.planSummary = () => ({ due: [], fresh: [], more: [], dueCards: 0, newCards: 0 });
  app.hydrateDecks = () => Promise.resolve(); app._sessionInline = () => false; app.nodeForKey = () => -1;
  for (const name of ["closeModal", "frameNodes", "renderSession", "applyDeckVisibility"]) app[name] = () => {};
  app.openPlanSession("due"); assert.deepEqual(calls.requests, []);
  app.openPlanSession("new"); app.openPlanSession("new", false); app.openPlanSession("due", "refresh-plan"); await flush();
  assert.deepEqual(calls.requests, ["open-plan", "refresh-plan"]);
});

test("active due queue survives deferred planner arrival and study notifications", async () => {
  const { app, calls } = fixture(), ready = deferred();
  app._requestGameplanStudy = i => { calls.requests.push(i); return Promise.resolve(); };
  app._ensureGameplanClock = () => {}; app.openSession = () => { app._session = { keys: ["real-due"], idx: 0, review: { count: 1 } }; };
  app._ensureGameplanRuntime = () => ready.promise; app._sessionInline = () => true; app.dueCount = () => 1;
  app.openPlanSession("new"); const due = app._session; ready.resolve(true); await flush();
  assert.equal(app._session, due); assert.deepEqual(due.keys, ["real-due"]); assert.deepEqual(calls.requests, ["open-plan"]);
});

test("live queue notification occurs before deferred card evaluation and render notification sees pending state", async () => {
  const { app } = fixture(), seen = [];
  app._gameStudyHost = { reconcile() { seen.push({ queued: !!app._choiceValueQueued, status: app._choiceValues?.snapshot?.()?.status }); } };
  app._optionCards = [{ opt: {} }]; app._ensureGameValues = () => {}; app.choiceValueRuntime = () => null;
  app.paintChoiceValues = () => app._gameStudyPriorityChanged();
  app.refreshChoiceValues(); assert.equal(seen[0].queued, true); await flush();
  app._choiceValues = { snapshot: () => ({ status: "pending" }) }; app._gameStudyPriorityChanged();
  assert.equal(seen.at(-1).status, "pending");
});


test("opening a plan without declared scope and targets only installs controls, never requests calculations", async () => {
  const { app, calls } = fixture(); delete app._gameplanStudyDeclaration;
  await app._requestGameplanStudy("open-plan");
  assert.equal(calls.loads, 1); assert.deepEqual(calls.requests, []);
  assert.equal(app._gameStudyState.phase, "idle");
  app._gameplanStudyDeclaration = { mode: "current-position", targets: { kind: "sharp-refresh", deckKeys: ["Mount|Top"] } };
  await app._requestGameplanStudy("suggestions"); assert.deepEqual(calls.requests, ["suggestions"]);
});

test("runtime admission rejection remains unavailable and import failure remains error", async () => {
  for (const [error, phase] of [[Object.assign(new Error("unverified-graph"), { phase: "unavailable" }), "unavailable"], [new Error("network"), "error"]]) {
    const { app } = fixture(); app._fetchGameplanStudyHost = async () => { throw error; };
    await app._requestGameplanStudy("open-plan"); assert.equal(app._gameStudyState.phase, phase);
  }
});
