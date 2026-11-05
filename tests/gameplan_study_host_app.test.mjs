// Real candidate app seam source, exercised without a browser. A worker testing
// an isolated patch sets BJJ_STUDY_APP_SOURCE; integration/CI reads its own app.
// This tests intent/lifecycle/DOM text, not layout, network timing or gameplay.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ngGameplanDebt, ngGameplanReviewed } from "../neural/src/gameplan-debt.src.js";
const source = readFileSync(process.env.BJJ_STUDY_APP_SOURCE || new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
// The build composes these eager modules into the app's scope. openPlanSession has framed its session
// from the real debt since v1.248.0, so they are the real modules here too, never a stub.
const Component = new Function("DCLogic", "React", "ngGameplanDebt", "ngGameplanReviewed", source + "\nreturn Component;")(
  class {}, { createRef: () => ({ current: null }) }, ngGameplanDebt, ngGameplanReviewed);
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
globalThis.location = { href: "https://bjjgraph.test/" }; // the session's Back origin reads it
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
// The eager half of openPlanSession: one real owed question, and the seams around the session it opens.
function practiceSeat(app, calls) {
  app._ensureGameplanClock = () => {}; app.explorerListRef = { current: null };
  app._requestGameplanStudy = i => { calls.requests.push(i); return Promise.resolve(); };
  app._epochDay = () => 5; app.srs = { "real-due": { "q-due": [4, 2, 3] } };
  app._gameplanDecks = () => ({ "real-due": { count: 1, exact: true, questions: ["q-due"], allowed: true } });
  for (const name of ["closeModal", "applyDeckVisibility", "_stopSystemPreview", "_stopConceptFilm", "track"]) app[name] = () => {};
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
  const { app, calls } = fixture(); practiceSeat(app, calls);
  app._gameplanRuntime = { ngGameplanSummary: () => "plan", ngGameplanBind: x => x };
  app.planSummary = () => ({ due: [], fresh: [], more: [], queue: [], dueCards: 0, newCards: 0 });
  app.hydrateDecks = () => Promise.resolve(); app._sessionInline = () => false; app.renderSession = () => {};
  app.openPlanSession("due"); assert.deepEqual(calls.requests, []); const visit = app._session;
  app.openPlanSession("new"); app.openPlanSession("new", false); app.openPlanSession("due", "refresh-plan"); await flush();
  assert.deepEqual(calls.requests, ["open-plan", "refresh-plan"]);
  assert.equal(app._session, visit, "one visit owns one session: a refresh extends it, never replaces it");
});

// SIDE-R2 B1 (v1.242.0), carried onto the v1.248.0 contract: Practice is ONE session from the first press,
// and the planner's arrival extends it instead of re-entering openPlanSession. So the old "reopened as
// ('new', false)" receipt has no successor call to count, and these cases read the effect it stood for: an
// UNTOUCHED queue takes the plan's own order, asking for no study of its own, while one GRADED or REVEALED
// keeps its place and gains the plan behind it, unrendered, because that is the card under the player's hand.
// SIDE-R3 N4: use the real _sessionInline guard. Removing it dies at open-deck; removing the
// revealed guard is also covered by practice-mix's held-planner, real-Reveal browser mutation.
test("active due queue survives deferred planner arrival and study notifications once graded, revealed or in an open deck; an untouched one becomes the plan", async () => {
  for (const interaction of ["untouched", "graded", "revealed", "open-deck", "reveal-during-press"]) {
    const { app, calls } = fixture(), ready = deferred();
    let done = 0, renders = 0, rows = 0; app.practiceToday = () => ({ done, goal: 20 });
    practiceSeat(app, calls); app.deckShown = true; app.hydrateDecks = async () => {};
    app.renderSession = () => { renders++; app._session.started ??= done; }; // _renderPractice's own stamp
    app._practiceRows = () => { rows++; }; app._paintGameplanProgress = () => {};
    app._ensureGameplanRuntime = () => ready.promise.then(() => { app._gameplanRuntime = { ngGameplanBind: x => x }; return true; });
    // The plan puts its new deck FIRST, so its order and an append behind the open card cannot agree.
    app.planSummary = () => ({ due: [{ key: "real-due", questions: ["q-due"], count: 1 }], more: [], queue: ["plan-new", "real-due"],
      fresh: [{ key: "plan-new", questions: ["q-new"], pending: 0, count: 1 }] });
    app.openPlanSession("new"); const due = app._session, mounted = renders;
    assert.equal(due.practice, true, interaction); assert.deepEqual(due.keys, ["real-due"], interaction);
    if (interaction === "graded") done = 1;
    if (interaction === "revealed") app._deckState = { "real-due": { idx: 0, revealed: true } };
    if (interaction === "open-deck") app.deck = [{ q: "An open study card", a: "Its answer" }];
    if (interaction === "reveal-during-press") app._panePress = true;
    ready.resolve(true); await flush();
    if (interaction === "reveal-during-press") {
      assert.equal(app._paneOwed?.length, 1, "the landing waits for the press");
      assert.deepEqual(due.keys, ["real-due"], "nothing lands under the press");
      app._deckState = { "real-due": { idx: 0, revealed: true } };
      app._panePress = false; app._paneOwed.splice(0).forEach(fn => fn());
      await flush();
    }
    assert.equal(app._session, due, interaction); assert.deepEqual(calls.requests, ["open-plan"], interaction);
    if (interaction === "open-deck") {
      assert.deepEqual(due.keys, ["real-due"], interaction); assert.equal(due.plan, undefined, interaction);
      assert.ok(due.review, interaction); assert.equal(renders, mounted, interaction); assert.equal(rows, 0, interaction);
    } else if (interaction === "untouched") {
      assert.deepEqual(due.keys, ["plan-new", "real-due"], interaction); assert.equal(due.keys[due.idx], "real-due", interaction);
      assert.equal(renders, mounted + 1, interaction); assert.equal(rows, 0, interaction); assert.equal(due.plan.total, 2, interaction);
    } else {
      assert.deepEqual(due.keys, ["real-due", "plan-new"], interaction); assert.equal(due.idx, 0, interaction);
      assert.equal(renders, mounted, interaction); assert.equal(rows, 1, interaction); assert.equal(due.plan.total, 2, interaction);
    }
  }
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
