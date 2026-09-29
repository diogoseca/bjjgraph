import { bindProgressGuestForTest } from './_progress_owner_harness.mjs';
// Real app methods and grades; the tiny DOM here only hosts callbacks/markup.
// Pixel geometry, mouse hit testing and keyboard routing are browser journeys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gameplanAppSource, gameplanRuntime } from "./_gameplan_harness.mjs";
import { ngGameplanDebt } from "../neural/src/gameplan-debt.src.js";
const Component = new Function("DCLogic", "React", gameplanAppSource + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });

class Element {
  style = {}; attrs = {}; children = []; html = ""; cache = new Map();
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k, fn) { this["on" + k] = fn; }
  appendChild(v) { this.children.push(v); return v; }
  set innerHTML(v) { this.html = v; this.cache.clear(); this.children = []; }
  get innerHTML() { return this.html; }
  querySelector(s) {
    const found = s.startsWith(".") ? this.html.includes('class="' + s.slice(1) + '"') : this.html.includes(s.slice(1, -1) + '=');
    if (!found) return null;
    if (!this.cache.has(s)) this.cache.set(s, new Element());
    return this.cache.get(s);
  }
  querySelectorAll() { return []; }
}
globalThis.document = { createElement: () => new Element() };

function app(cards = [{ q: "first", a: "one" }, { q: "second", a: "two" }]) {
  const a = Object.create(Component.prototype);
  bindProgressGuestForTest(a);
  a.day = 100; a._epochDay = () => a.day;
  a.flashcards = { decks: { "Move|Defender": { cat: "Transition", cards } } };
  a.prep = {}; a.stage = {}; a.rec = {}; a.srs = {}; a.settings = {}; a._days = {};
  a.nodeForKey = () => -1; a._saveProgress = () => {}; a.fx = () => {};
  a.renderTabSubtitles = () => {}; a.noteCardAnswered = () => {}; a.refreshOptionOdds = () => {};
  a._refreshGameplanUI = () => {}; a.events = []; a.track = (event, data) => a.events.push({ event, data });
  a.setGameplanRuntime(gameplanRuntime);
  return a;
}
function mini(a, cards) { return a._miniDeck("Move|Defender", a.flashcards.decks["Move|Defender"], false, "s0", null, cards); }

test("inline reveal alone gives no evidence; repeated old Got-it callbacks cannot grade the next card", () => {
  const a = app(), el = mini(a), reg = a._miniReg.s0;
  reg.enter();
  assert.equal(a.prep["Move|Defender"], undefined);
  const click = el.querySelector("[data-mini-got]").onclick;
  click(); click();
  reg.enter(); // reveal the next card, then replay the previous card's handler
  click();
  assert.equal(a.prep["Move|Defender"], 1);
  assert.equal(Object.keys(a.srs["Move|Defender"]).length, 1);
  assert.equal(a._deckState["Move|Defender"].idx, 1, "advance precedes grade-driven paints");
});

test("a reordered due subset uses question identity, then permits its next-day review", () => {
  const a = app(), cards = a.flashcards.decks["Move|Defender"].cards;
  mini(a, [cards[0]]); a._miniReg.s0.enter(); a._miniReg.s0.enter();
  mini(a, [cards[1]]); a._miniReg.s0.enter(); a._miniReg.s0.enter();
  assert.equal(a.prep["Move|Defender"], 2, "index zero is not a card identity");
  a.day++;
  mini(a, [cards[0]]); a._miniReg.s0.enter(); a._miniReg.s0.enter();
  assert.equal(a.prep["Move|Defender"], 3);
  assert.equal(a.srs["Move|Defender"][a.qhash(cards[0].q)][2], 101);
});

test("a still-mounted question can be reviewed after midnight; failure resolves today's due obligation", () => {
  const a = app([{ q: "only", a: "answer" }]), el = mini(a);
  a._miniReg.s0.enter(); el.querySelector("[data-mini-again]").onclick();
  assert.equal(a.dueCount(), 0); assert.equal(a.prep["Move|Defender"], undefined);
  a.day++;
  assert.equal(a.dueCount(), 1);
  // The row remains mounted. A local reveal/enter reads the new day, without reload.
  a._miniReg.s0.enter();
  assert.equal(a.dueCount(), 0);
  assert.equal(a.prep["Move|Defender"], 1);
});

test("stored review and shared question credit prevent same-day replay after a rebuilt mini deck", () => {
  const a = app([{ q: "shared", a: "answer" }]);
  a.flashcards.decks["Move|Attacker"] = { n: 1 };
  a._sharedQ = new Map([[a.qhash("shared"), ["Move|Defender", "Move|Attacker"]]]);
  mini(a); a._miniReg.s0.enter(); a._miniReg.s0.enter();
  assert.equal(a.srs["Move|Attacker"][a.qhash("shared")][2], 100);
  a._miniGraded = new Set();
  mini(a); a._miniReg.s0.enter(); a._miniReg.s0.enter();
  assert.equal(a.prep["Move|Defender"], 1);
});

test("the app's due subset stays empty when debt drains; it never reopens the whole deck", () => {
  const a = app();
  assert.deepEqual(a._entryForKey("Move|Defender", "due").cards, []);
});

test("complete-session event is emitted once and never from prior lesson credit with live debt", () => {
  const a = app([{ q: "due", a: "answer" }]);
  const qh = a.qhash("due"); a.srs = { "Move|Defender": { [qh]: [99, 3, 96] } }; a.prep["Move|Defender"] = 5;
  const plan = a.planSummary();
  const s = { plan, keys: ["Move|Defender"], required: 1 };
  assert.equal(a._sessionDone(s), 0);
  assert.equal(a._sessionDoneCard(s).attrs["data-session-complete"], undefined);
  assert.equal(a.events.filter((e) => e.event === "neural_session_completed").length, 0);
  a.gradeRecall("Move|Defender", a.flashcards.decks["Move|Defender"].cards[0], false);
  assert.equal(a._sessionDoneCard(s).attrs["data-session-complete"], "1");
  a._sessionDoneCard(s); a._sessionDoneCard(s);
  assert.equal(a.events.filter((e) => e.event === "neural_session_completed").length, 1);
  a.day++;
  assert.equal(a._sessionDoneCard(s).attrs["data-session-complete"], undefined);
});

test("late recommendation responses cannot override a changed ruleset/profile context", () => {
  const a = app(), stamp = a._gameplanStamp();
  a._giMode = "nogi";
  assert.equal(a.setGameplanRecommendations({ stamp, status: "ready" }), false);
  assert.equal(a._gameplanProvider, undefined);
  const newStamp = a._gameplanStamp(); a._knowledgeRevision = 5;
  assert.equal(a.setGameplanRecommendations({ stamp: newStamp, status: "ready" }), false);
});

test("shared credit completing a mounted plan paints completion without a local mini callback", () => {
  const a = app([{ q: "shared", a: "answer" }]), qh = a.qhash("shared");
  a.srs = { "Move|Defender": { [qh]: [99, 3, 96] } };
  const s = a._session = { plan: a.planSummary(), keys: ["Move|Defender"], required: 1 };
  const list = new Element();
  list.querySelector = (selector) => list.children.find((el) => el.attrs[selector.slice(1, -1)]) || null;
  a.drillListRef = { current: list }; a.drillFootRef = { current: null }; a.setDrillHeader = () => {};
  a._paintGameplanProgress(s);
  assert.equal(list.children.length, 0);
  // This is authoritative SRS evidence delivered after a shared/remote grade.
  a.srs["Move|Defender"][qh] = [107, 7, 100];
  a._paintGameplanProgress(s); a._paintGameplanProgress(s);
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].attrs["data-session-complete"], "1");
  assert.equal(a.events.filter((e) => e.event === "neural_session_completed").length, 1);
});

test("a valid empty FLOW ranking stays distinct from a cold kernel", () => {
  const a = app(); a.flowScore = () => ({ ranked: [], backfiring: [], r0: 0 });
  assert.equal(a.weakSpots().cold, undefined);
  a.flowScore = () => null;
  assert.equal(a.weakSpots().cold, true);
});

test("before the planner loads, DUE completion still requires frozen question and day evidence", () => {
  const a = app([{ q: "due", a: "answer" }]), qh = a.qhash("due");
  delete a._gameplanRuntime;
  a.srs = { "Move|Defender": { [qh]: [99, 3, 96] } }; a.prep["Move|Defender"] = 5;
  assert.equal(a.planSummary(), null, "no invented zero-sized plan before runtime");
  const s = { keys: ["Move|Defender"], filter: "due", review: {
    ...ngGameplanDebt({ day: a.day, srs: a.srs, decks: a._gameplanDecks() }), day: a.day } };
  assert.deepEqual(a.bucketTechniques("due"), s.keys);
  assert.equal(a._gameplanProgress(s).complete, false);
  a.srs = {};
  assert.equal(a._gameplanProgress(s).complete, false, "reset is not a review");
  a.gradeRecall("Move|Defender", a.flashcards.decks["Move|Defender"].cards[0], false);
  assert.equal(a._gameplanProgress(s).complete, true);
  a._sessionDoneCard(s); a._sessionDoneCard(s);
  assert.equal(a.events.filter((e) => e.event === "neural_session_completed").length, 1);
  a.day++;
  assert.equal(a._gameplanProgress(s).complete, false);
});

test("intent-only runtime loading coalesces, retries failures, and preserves the active review queue", async () => {
  const a = app(), queue = a._session = { review: {} }, attempts = [];
  delete a._gameplanRuntime;
  a._fetchGameplanRuntime = async (attempt) => {
    attempts.push(attempt);
    if (attempt === 1) throw Error("offline");
    return gameplanRuntime;
  };
  a.planSummary(); a.newTechniques();
  assert.deepEqual(attempts, [], "reads do not request the runtime");
  const one = a._ensureGameplanRuntime(), same = a._ensureGameplanRuntime();
  assert.equal(one, same); assert.equal(await one, false);
  assert.equal(a._gameplanLoadState, "failed");
  assert.equal(await a._ensureGameplanRuntime(), true);
  assert.deepEqual(attempts, [1, 2]); assert.equal(a._session, queue);
});

test("queued model results recheck current context on runtime arrival and teardown rejects installation", () => {
  const a = app(); delete a._gameplanRuntime;
  const context = { stamp: a._gameplanStamp() };
  assert.equal(a.setGameplanModelResult({ status: "unavailable" }, context), true);
  assert.ok(a._gameplanPendingModel);
  a.day++;
  a.setGameplanRuntime(gameplanRuntime);
  assert.equal(a._gameplanProvider, undefined, "old-day model reply is not installed");
  const b = app(); delete b._gameplanRuntime; b.__ngDestroyed = true;
  assert.equal(b.setGameplanRuntime(gameplanRuntime), false);
});
