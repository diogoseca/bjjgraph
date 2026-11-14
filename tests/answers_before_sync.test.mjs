// ANSWERS GIVEN BEFORE A COPY HAS SEEN THE CARD'S ROW (v1.280.1, NEXT2, ruled NEXT2-GO) — the journal and the replay in
// neural/src/progress-owner.src.js (`ngProgressReplay`, the host's `journal`, `replayCloud`, `delivered`, the tab merge and
// the guest join) and the app's writers that feed it (`_gradeKnowledge`, `_schedule`, `_gradeMove`).
//
// Until v1.280.1 a first right answer ([d+1, 1, d], the same row a miss writes) given before a device's first pull, offline,
// by a guest before signing in, or in a tab that never saw another tab's row, met the other copy in a merge that keeps the
// later answer, and a mature schedule became one day (proven in four places on v1.279.0). Now each owner keeps the
// answers this browser has not yet seen delivered, and where its copy meets another copy's rows those cards are rebuilt
// on the other copy's rows by the writer. Every answer here is given through the app's own writer and every sync runs
// through the app's own pull, push, save and join, against a FAKE CLOUD THAT HOLDS ROWS.
//
// INVARIANTS: a right answer never makes a card due sooner than the other copy had it; a miss counts wherever it was made;
// an entry leaves the journal only when a copy the cloud accepted or holds has its row (never cleared too early, never
// applied twice); two devices converge in both orders; one owner's answers never reach another owner's rows except
// through the guest join, once; an older client receives ordinary rows; nothing is written on a passive boot.
//
// MUTANTS (v1.280.1), each applied alone to a clean tree and run against this file; each turned the NAMED test red:
//   J1 the pull does not replay (`replayCloud` returns the merge)          → "P1 a new device…", "P2 an offline device…"
//   J2 the replay skips a miss                                             → "a miss counts wherever it was made…"
//   J3 an entry held by the other copy is applied again (no held check)    → "a push that landed but answered false…"
//   J4 entries cleared at the pull whatever the cloud holds               → "a push that fails keeps the entry…"
//   J6 the guest join does not replay                                      → "P3 a guest's first right answer…"
//   J7 the guest high-water `g` ignored                                    → "a guest copy that joins twice…"
//   J8 the cap ignored                                                     → "the journal is capped…"
//   J9 a push's delivery taken without its rows (every entry cleared)      → "an answer given while a push is in flight…"
//
// Run: node --test tests/answers_before_sync.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ngProgressOwner, ngProgressLocalKey, ngProgressCreateHost, ngProgressJournalParse, NG_PROGRESS_JOURNAL_CAP } from "../neural/src/progress-owner.src.js";
import { ngKnowledgeScheduleRow, ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const deps = ["lists-codec", "lists", "belt", "knowledge-profile", "rating", "challenge-definitions", "challenge-engine"].map((n) => strip(read("../neural/src/" + n + ".src.js"))).join("\n");
const Component = new Function("DCLogic", "React", strip(read("../neural/src/progress-owner.src.js")) + "\n" + deps + "\n" + read("../neural/src/app.src.jsx") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const OLD = JSON.parse(read("./artifacts/schedule_old_client.json"));
const devSrsMerge = new Function("cloud", OLD.app.srsMerge);
const copy = (v) => JSON.parse(JSON.stringify(v));
const D = 20400;
const Q1 = "Which grip breaks the posture?", Q2 = "Where does the knee go?", H1 = ngKnowledgeQuestionHash(Q1), H2 = ngKnowledgeQuestionHash(Q2);
const MATURE = [D + 30, 60, D - 30];   // the other copy: a 60-day card answered 30 days ago, due in 30
const write = ngKnowledgeScheduleRow;

// A FAKE CLOUD THAT HOLDS ROWS: a push stores the blob (or, as asked, fails, or stores it and answers false)
function cloud(blob = null) {
  const c = { blob: blob && copy(blob), pushes: 0, mode: "ok", pulls: 0, pullFails: false };
  c.pull = async (id) => { c.pulls++; if (c.pullFails) throw new Error("offline"); return { userId: id, blob: c.blob && copy(c.blob) }; };
  c.push = async (b) => { c.pushes++; if (c.mode === "fail") return false; c.blob = copy(b); return c.mode !== "lost-answer"; };
  return c;
}
function memory() { const rows = new Map(); return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)) }; }
function harness(mem, C) {
  let current, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true, pullNeural: (id) => C.pull(id), pushNeural: (b) => C.push(b) };
  const host = ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(boot) {
    const inst = new Component({}); current = inst; host.bind(inst, boot);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = () => {}; inst.fx = () => {}; inst._announceArrival = () => {}; inst._auth = () => facade; inst.isTest = () => true;
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const signIn = (id) => { identity = { id, email: id + "@example.invalid" }; const old = current; old._applyUser(identity); current._applyUser(identity); return current; };
  return { host, facade, get: () => current, signIn, boot: () => host.bootstrap() };
}
async function fakeTimers(run) {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout; let seq = 0; const q = new Map();
  globalThis.setTimeout = (fn) => { const id = ++seq; q.set(id, fn); return id; }; globalThis.clearTimeout = (id) => q.delete(id);
  try { return await run({ flush: async () => { for (let i = 0; i < 4 && q.size; i++) { const jobs = [...q.values()]; q.clear(); for (const fn of jobs) await fn(); } },
    drop: () => q.clear(), kick: () => { const jobs = [...q.values()]; q.clear(); for (const fn of jobs) fn(); } }); }
  finally { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear; }
}
async function withDay(day, run) {
  const had = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = { ...(had ? had.value : {}), __NG_EPOCH_DAY__: day };
  try { return await run(); } finally { if (had) Object.defineProperty(globalThis, "window", had); else delete globalThis.window; }
}
const blob = (extra = {}) => ({ v: 2, prep: {}, ...extra });
const journal = (mem, owner) => ngProgressJournalParse(mem.getItem(ngProgressLocalKey(owner, "pending")));
const A = ngProgressOwner("A"), GUEST = ngProgressOwner();
// answer through the app's own writers
const answer = (a, q, ok, deck = "d") => a._gradeKnowledge(deck, { q }, ok, "recall");
function answerMove(a, seat, mv, ok) {
  a._moveKey = () => [seat, mv]; a._sealCard = () => {}; a._moveState = () => "known";
  a._gradeMove({ node: { t: "x" }, threat: false, action: "move" }, ok, null);
}
// a pull or push already in flight settles before the next step (`_pullAndMerge` refuses while one is in flight)
const settle = () => new Promise((r) => setImmediate(r));
// boot an account on a browser and try its first pull (it lands unless the cloud is set to fail)
async function account(mem, C, flush, id = "A") { const h = harness(mem, C); await h.boot(); const a = h.signIn(id); await a._pullAndMerge(); await flush(); await settle(); return { h, a }; }
async function pull(a, flush) { await settle(); const ok = await a._pullAndMerge(); await flush(); await settle(); return ok; }

test("P1 a new device answers before its first pull lands: the card is rebuilt on the cloud's row, then delivered", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } }, moves: { "1/top": { m: MATURE.concat(1) } } }));
  C.pullFails = true;   // the first pull has not landed yet
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); answerMove(a, "1/top", "m", true); await settle();
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "on this copy alone: a first answer");
  assert.equal(journal(mem, A).e.length, 2, "both answers wait in the journal");
  C.pullFails = false;
  assert.equal(await pull(a, flush), true);
  const want = write(MATURE, true, D);
  assert.deepEqual(a.srs.d[H1], want, "the writer on the cloud's row: never sooner than the cloud had it, its credit earned");
  assert.ok(want[0] > MATURE[0]);
  assert.deepEqual(a.moves["1/top"].m, want.concat(1), "the hidden move the same, its Yes kept");
  assert.equal(a.stage.d[H1], 3, "the stage is a MAX, as before");
  assert.deepEqual(C.blob.srs.d[H1], want, "and that is what the cloud holds");
  assert.equal(journal(mem, A).e.length, 0, "delivered: the push that carried them cleared them");
})));

test("a miss counts wherever it was made: before the first pull, offline, and against a later right answer elsewhere", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  let a;
  await withDay(D, async () => {
    C.pullFails = true;
    a = (await account(mem, C, flush)).a;
    answer(a, Q1, false);   // a miss on day D, before the pull
    answer(a, Q2, false); await settle();   // another, on a card another device answers right the next day
  });
  C.blob.srs.d[H2] = write(MATURE, true, D + 1);
  await withDay(D + 2, async () => {   // the pull lands two days later
    C.pullFails = false;
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "back to one day");
    assert.deepEqual(a.srs.d[H2], [D + 2, 1, D + 1], "filed on the other copy's later answer, never lost to it");
    assert.deepEqual(C.blob.srs.d[H2], [D + 2, 1, D + 1]);
  });
}));

test("P2 an offline device: rebuilt on the newer cloud row two days later, from a stale row and from none", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: [D - 4, 14, D - 18] } } }));
  await withDay(D - 10, async () => { const { a } = await account(mem, C, flush); await flush(); assert.deepEqual(a.srs.d[H1], [D - 4, 14, D - 18]); });
  // another device takes the card to 60 days; this one is offline and answers both cards on day D
  C.blob = blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } });
  await withDay(D, async () => {
    C.pullFails = true; const { a } = await account(mem, C, flush);
    answer(a, Q1, true); answer(a, Q2, true); await settle();
    assert.equal(a.srs.d[H1][1], 30, "from its stale 14 days, on time: 30");
    C.pullFails = false;
  });
  await withDay(D + 2, async () => {   // the pull lands two days later
    const { a } = await account(mem, C, flush);
    assert.deepEqual(a.srs.d[H1], write(MATURE, true, D), "the stale row's answer, rebuilt on the cloud's 60 days");
    assert.deepEqual(a.srs.d[H2], write(MATURE, true, D), "a first answer, the same");
    assert.equal(journal(mem, A).e.length, 0);
  });
}));

test("P3 a guest's first right answer joins an account that holds the card mature: rebuilt, then the account delivers it", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, moves: { "1/top": { m: MATURE.concat(1) } }, prep: { d: 5 } }));
  const h = harness(mem, C); await h.boot(); const g = h.get();
  answer(g, Q1, true); answerMove(g, "1/top", "m", true); g._flushSave(); await flush();
  assert.equal(journal(mem, GUEST).e.length, 2, "the guest's answers wait in the guest's journal");
  const a = h.signIn("A"); await pull(a, flush);
  const want = write(MATURE, true, D);
  assert.deepEqual(a.srs.d[H1], want, "the account's card: the guest's answer applied to it");
  assert.deepEqual(a.moves["1/top"].m, want.concat(1));
  assert.deepEqual(C.blob.srs.d[H1], want);
  assert.equal(journal(mem, A).e.length, 0, "taken in, then delivered by the account's push");
  assert.equal(journal(mem, A).g, journal(mem, GUEST).e.at(-1)[0], "the account remembers the guest answers it has taken in");
  assert.equal(journal(mem, GUEST).e.length, 2, "the guest's copy and journal stay as they were (signing out still plays them)");
})));

test("a guest copy that joins twice (the guest played again) applies only its new answers", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  const h = harness(mem, C); await h.boot(); const g = h.get();
  answer(g, Q1, false); g._flushSave(); await flush();       // the guest misses Q1
  let a = h.signIn("A"); await pull(a, flush);
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D]);
  // the account answers Q1 right twice and syncs (no one-answer step leads back to the guest's row any more); then,
  // signed out, the guest plays Q2; then signs in again
  await withDay(D + 1, async () => { answer(a, Q1, true); a._flushSave(); await flush(); await settle(); });
  await withDay(D + 4, async () => { answer(a, Q1, true); a._flushSave(); await flush(); await settle(); });
  const after = copy(C.blob.srs.d[H1]);
  assert.deepEqual(after, write(write([D + 1, 1, D], true, D + 1), true, D + 4));
  const h2 = harness(mem, C); await h2.boot(); const g2 = h2.get();
  await withDay(D + 4, async () => { answer(g2, Q2, true); g2._flushSave(); await flush(); a = h2.signIn("A"); await pull(a, flush); });
  assert.deepEqual(a.srs.d[H1], after, "the guest's old miss is not counted a second time");
  assert.deepEqual(a.srs.d[H2], write(MATURE, true, D + 4), "its new answer is");
})));

test("a push that fails keeps the entry: the next pull applies it once, on what the cloud then holds", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  let a;
  await withDay(D, async () => {
    C.pullFails = true;
    a = (await account(mem, C, flush)).a;
    answer(a, Q1, false); await settle();   // a miss, offline
    C.pullFails = false; C.mode = "fail";
    assert.equal(await pull(a, flush), true, "the pull lands; its push fails");
    assert.deepEqual(C.blob.srs.d[H1], MATURE, "the cloud never got the miss");
    assert.equal(journal(mem, A).e.length, 1, "so the miss stays in the journal");
  });
  C.blob.srs.d[H1] = write(MATURE, true, D + 1);   // another device answers the card right the next day
  await withDay(D + 2, async () => {
    C.mode = "ok";
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(C.blob.srs.d[H1], [D + 2, 1, D + 1], "the miss, once, on the row the cloud then held");
    assert.equal(journal(mem, A).e.length, 0);
  });
}));

test("an answer given while a push is in flight stays until a copy holds it", () => fakeTimers(async ({ flush, kick, drop }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  let a, open;
  await withDay(D, async () => {
    a = (await account(mem, C, flush)).a;
    const push = C.push; let gate; C.push = async (b) => { await new Promise((r) => { gate = r; }); return push(b); };
    answer(a, Q1, true); kick(); await settle();   // its push starts, and waits at the server
    open = gate;
    answer(a, Q2, false);                            // given while that push is in flight: not in the copy it carries
    C.push = push; open(); await settle(); await settle();
    assert.deepEqual(C.blob.srs.d[H1], write(MATURE, true, D), "the first push landed");
    assert.deepEqual(C.blob.srs.d[H2], MATURE, "without the second answer");
    drop();                                          // and the second answer's own push never runs (the tab closed)
  });
  // the push of the second answer is lost (say the tab closed); another device answers Q2 right the next day
  C.blob.srs.d[H2] = write(MATURE, true, D + 1);
  await withDay(D + 1, async () => {
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(a.srs.d[H2], [D + 2, 1, D + 1], "the miss given during the push still counts");
  });
}));

test("a push that landed but answered false is not applied twice: the cloud's row proves it", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  await withDay(D, async () => {
    const { a } = await account(mem, C, flush); await flush();
    C.mode = "lost-answer";
    answer(a, Q1, false); await flush(); await settle();   // stored at the server, answered false
    assert.deepEqual(C.blob.srs.d[H1], [D + 1, 1, D]);
    assert.equal(journal(mem, A).e.length, 1);
    C.mode = "ok";
  });
  // the next day another device answers it right (from the cloud's row, which holds the miss); then this device pulls
  C.blob.srs.d[H1] = write([D + 1, 1, D], true, D + 1);
  await withDay(D + 1, async () => {
    const { a } = await account(mem, C, flush);
    assert.deepEqual(a.srs.d[H1], write([D + 1, 1, D], true, D + 1), "the miss is not counted a second time over the other device's answer");
  });
}));

test("an app closed between the answer and its push: the answer is delivered at the next session's pull", () => withDay(D, () => fakeTimers(async ({ flush, drop }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); await settle(); drop();   // closed before any push
  C.pullFails = false;
  const { a: b } = await account(mem, C, flush);
  assert.deepEqual(b.srs.d[H1], write(MATURE, true, D));
  assert.deepEqual(C.blob.srs.d[H1], write(MATURE, true, D));
  assert.equal(journal(mem, A).e.length, 0);
})));

test("a push that succeeds while another tab pushed an older copy: nothing is lost", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const t1 = (await account(mem, C, flush)).a; await flush();
  const t2 = (await account(mem, C, flush)).a; await flush();
  const older = copy(C.blob);
  answer(t2, Q1, false); await flush(); await settle();   // tab 2's push delivers the miss: the cloud holds it, the entry goes
  assert.equal(journal(mem, A).e.length, 0);
  C.blob = older;                         // ...then tab 1's older push lands over it
  assert.equal(await pull(t1, flush), true);
  assert.deepEqual(t1.srs.d[H1], [D + 1, 1, D], "the browser's copy still holds the miss, the later answer, and pushes it again");
  assert.deepEqual(C.blob.srs.d[H1], [D + 1, 1, D]);
})));

test("two devices converge in both orders, each with an answer the other has not seen", () => fakeTimers(async ({ flush }) => {
  for (const order of [["X", "Y"], ["Y", "X"]]) {
    const C = cloud(blob({ srs: { d: { [H1]: MATURE } } })), dev = { X: memory(), Y: memory() }, app = {};
    await withDay(D - 1, async () => { for (const n of ["X", "Y"]) { app[n] = (await account(dev[n], C, flush)).a; await flush(); } });
    await withDay(D, async () => {
      C.pullFails = true;
      answer(app.X, Q1, true); answer(app.Y, Q1, false); await settle();   // offline, both answer the card: X right, Y wrong
      C.pullFails = false;
      for (const n of order) await pull(app[n], flush);
      for (const n of order) await pull(app[n], flush);
      assert.deepEqual(app.X.srs.d[H1], app.Y.srs.d[H1], `order ${order}: both devices hold one row`);
      assert.deepEqual(app.X.srs.d[H1], [D + 1, 1, D], `order ${order}: the miss counts`);
    });
  }
}));

test("one owner's answers never reach another owner's rows", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush);
  answer(a, Q1, false); await settle();   // account A misses the card, offline
  // A signs out; account B signs in on the same browser, its cloud holding the card mature
  const B = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const { a: b } = await account(mem, B, flush, "B");
  assert.deepEqual(b.srs.d[H1], MATURE, "B's card is B's");
  assert.equal(journal(mem, ngProgressOwner("B")).e.length, 0);
  assert.equal(journal(mem, A).e.length, 1, "A's miss waits for A");
})));

test("the journal is capped: beyond it the oldest answers meet other copies by the merge's rule", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); await settle();
  const rows = Array.from({ length: NG_PROGRESS_JOURNAL_CAP }, (_, i) => [0, "filler", "q" + i, 1, D, [D + 1, 1, D]]);
  a._journal(rows);
  const j = journal(mem, A);
  assert.equal(j.e.length, NG_PROGRESS_JOURNAL_CAP);
  assert.ok(!j.e.some((e) => e[3] === H1), "the oldest went");
  C.pullFails = false;
  assert.equal(await pull(a, flush), true);
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "that card met the cloud by the merge's rule, as before v1.280.1");
})));

test("nothing is written on a passive boot, and an older client receives ordinary rows", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const { a } = await account(mem, C, flush); await flush();
  assert.equal(mem.getItem(ngProgressLocalKey(A, "pending")), null, "no journal written by a boot and a pull");
  C.pullFails = true; answer(a, Q1, true); await settle(); C.pullFails = false;
  await pull(a, flush);
  const pushed = C.blob;
  assert.ok(!JSON.stringify(pushed).includes("pending"), "the journal never rides the blob");
  assert.ok(Object.values(pushed.srs.d).every((r) => r.length === 3), "ordinary rows");
  // dev's own pull (captured) of what was pushed, against its copy of the mature row: an ordinary merge, never sooner
  const dev = { srs: { d: { [H1]: MATURE.slice() } }, _epochDay: () => D };
  devSrsMerge.call(dev, { srs: copy(pushed.srs) });
  assert.ok(dev.srs.d[H1][0] >= MATURE[0]);
  assert.deepEqual(dev.srs.d[H1], pushed.srs.d[H1]);
})));
