// FGHYD1: one Win-chance restart per deck-hydration burst, not one per deck. The real app path,
// `_onDeckHydrated` -> its "deck-hydrated" knowledge notice -> `_onKnowledgeChanged` ->
// `_residencyChanged`, on Node's mock clock; the solve itself is the counted `_gameValueChanged`
// seam. Mutants, recorded 2026-10-01: restarting per deck in `_onDeckHydrated`, or
// `_onKnowledgeChanged` ignoring `onlyHydration`, each turn the burst cases red (100 against 2).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { gameplanAppSource } from "./_gameplan_harness.mjs";

const Component = new Function("DCLogic", "React", gameplanAppSource + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });

function app() {
  const a = Object.create(Component.prototype), calls = [];
  a._gameValueChanged = (reason, kind) => calls.push([Date.now(), reason, kind]);
  a.onFlashcardsReady = () => {}; a._onGameplanKnowledgeChanged = () => {}; a.renderTabSubtitles = null;
  a._gameStudyPriorityChanged = () => {};
  return { a, calls };
}
// a deck lands in its own task: its knowledge notice runs on the next microtask, then time passes
const land = async (a, ms) => { a._onDeckHydrated("D|Top"); await Promise.resolve(); await Promise.resolve(); mock.timers.tick(ms); };

test("a burst of decks restarts the solve twice: on its first deck and once when it settles", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    for (let i = 0; i < 100; i++) await land(a, 10);          // 100 decks over 1 s
    assert.equal(calls.length, 1, "only the leading edge while decks keep landing");
    mock.timers.tick(300);
    assert.equal(calls.length, 2, "one trailing restart once the burst settles");
    assert.ok(calls.every(([, reason, kind]) => reason === "deck-hydrated" && kind === "residency"));
    assert.deepEqual(a._residencyStats, { decks: 100, restarts: 2 });
  } finally { mock.timers.reset(); }
});

test("a single deck restarts once, exactly as before the change", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    await land(a, 1000);
    assert.equal(calls.length, 1);
    await land(a, 1000);                                       // a later, separate deck: its own burst
    assert.equal(calls.length, 2);
  } finally { mock.timers.reset(); }
});

test("a long stream still re-solves at least every max-hold, and settles to one trailing restart", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    for (let i = 0; i < 500; i++) await land(a, 10);          // 5 s of decks, 10 ms apart
    mock.timers.tick(300);
    // leading (t=0) + one at each 2 s cap (t=2000, 4000) + trailing = 4, against 500 per-deck restarts
    assert.equal(calls.length, 4, "restarts " + calls.length);
    const gaps = calls.slice(1).map(([t], i) => t - calls[i][0]);
    assert.ok(gaps.every((g) => g <= 2000 + 300), "never more than max-hold between restarts while streaming: " + gaps);
  } finally { mock.timers.reset(); }
});

test("a destroyed app never restarts on a late timer", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    await land(a, 10); await land(a, 10);
    a.__ngDestroyed = true;
    mock.timers.tick(1000);
    assert.equal(calls.length, 1);
  } finally { mock.timers.reset(); }
});

test("a genuine knowledge change in the same turn as a deck landing still restarts at once", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    await land(a, 10);                                   // a burst is open (one leading restart)
    a._onDeckHydrated("D|Top"); a._publishKnowledge("grade:mc");   // a grade lands with a deck
    await Promise.resolve(); await Promise.resolve();
    assert.equal(calls.length, 2, "the grade's restart is not held back by the burst");
    assert.equal(calls[1][1], "knowledge:grade:mc");
  } finally { mock.timers.reset(); }
});

// The third restart path (measured on the built bundle: 29-35 snapshots per corpus hydration after
// the first two were closed): the hydration refresh's `refreshOptionOdds`, and any re-render's
// `refreshChoiceValues`, mid-burst. They mark the burst dirty; an explicit change still goes through.
// Mutants, recorded 2026-10-01: refreshOptionOdds restarting unconditionally, or refreshChoiceValues
// ignoring an open burst, each turn this red.
test("inside a burst, odds refreshes and re-render refreshes are held for the trailing restart", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const { a, calls } = app();
    a._optionCards = []; a._defendSub = null;
    await land(a, 10);                                   // burst open: one leading restart
    for (let i = 0; i < 20; i++) { a.refreshOptionOdds(); mock.timers.tick(5); }
    assert.equal(calls.length, 1, "odds refreshes inside the burst do not restart");
    a._optionCards = [{ opt: { threat: false } }];
    a.refreshChoiceValues();
    assert.equal(a._choiceValueQueued, undefined, "a re-render refresh inside the burst queues no request");
    mock.timers.tick(300);
    assert.equal(calls.length, 2, "one trailing restart carries them");
    a.refreshOptionOdds();
    assert.equal(calls.length, 3, "outside a burst, odds that moved restart at once");
  } finally { mock.timers.reset(); }
});
